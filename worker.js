const ACCESS_KEY = 'ch-qbank-2026';

const ALLOWED_ORIGINS = [
  'https://competitionhub.pages.dev',
  'http://localhost',
];

// ── CORS / response helpers ───────────────────────────────────────────────────

function corsHeaders(request) {
  const origin = request?.headers?.get('Origin') || '';
  const allowed = [
    'https://competitionhub.pages.dev',
    'https://app.examsindia.org'
  ];
  const allowedOrigin = allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-access-key, x-user-email, cf-access-client-id, cf-access-client-secret',
    'Access-Control-Max-Age':       '86400',
  };
}

function jsonResponse(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

function errResponse(msg, status, request) {
  return jsonResponse({ error: msg }, status, request);
}

// ── Resolve user + plan, auto-provision new users ─────────────────────────────

async function resolveUserPlan(email, db) {
  const row = await db
    .prepare(`
      SELECT u.role, u.plan_id, u.is_active, u.plan_expires_at,
             p.max_questions, p.max_books, p.allow_extracted, p.filter_types
      FROM   users u
      JOIN   plans p ON u.plan_id = p.id
      WHERE  u.email = ?
    `)
    .bind(email)
    .first();

  if (row) return row;

  // Auto-provision with free plan
  await db
    .prepare(`INSERT INTO users (email, role, plan_id, is_active, created_at)
              VALUES (?, 'user', 'free', 1, datetime('now'))`)
    .bind(email)
    .run();

  return db
    .prepare(`
      SELECT u.role, u.plan_id, u.is_active, u.plan_expires_at,
             p.max_questions, p.max_books, p.allow_extracted, p.filter_types
      FROM   users u
      JOIN   plans p ON u.plan_id = p.id
      WHERE  u.email = ?
    `)
    .bind(email)
    .first();
}

// ── Admin role guard ──────────────────────────────────────────────────────────

function requireAdmin(userPlan, request) {
  if (userPlan.role !== 'superadmin' && userPlan.role !== 'admin') {
    return errResponse('forbidden', 403, request);
  }
  return null;
}

function requireSuperadmin(userPlan, request) {
  if (userPlan.role !== 'superadmin') {
    return errResponse('superadmin_required', 403, request);
  }
  return null;
}

// ── D1 table initialisation (runs once per Worker instance) ──────────────────

let tablesInitialized = false;

async function initTables(db) {
  if (tablesInitialized) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS ch_papers (
      id         TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      paper_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ch_attempts (
      id           TEXT PRIMARY KEY,
      user_email   TEXT NOT NULL,
      attempt_json TEXT NOT NULL,
      submitted_at TEXT NOT NULL
    )`)
  ]);
  tablesInitialized = true;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    // CORS preflight — must fire before any route or auth logic
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // Validate access key
    if (request.headers.get('x-access-key') !== ACCESS_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Validate user email
    const email = (request.headers.get('x-user-email') || '').trim();
    if (!email) return errResponse('missing_email', 401, request);

    // Resolve user + plan
    const userPlan = await resolveUserPlan(email, env.DB);
    if (!userPlan)              return errResponse('plan_resolve_failed', 500, request);
    if (userPlan.is_active === 0) return errResponse('account_disabled', 403, request);

    await initTables(env.DB);

    const url    = new URL(request.url);
    const path   = decodeURIComponent(url.pathname.slice(1)); // strip leading /
    const method = request.method;

    // ────────────────────────────────────────────────────────────────────────
    // Route: GET /user-plan
    // ────────────────────────────────────────────────────────────────────────
    if (path === 'user-plan' && method === 'GET') {
      return jsonResponse({
        email,
        role:            userPlan.role,
        plan_id:         userPlan.plan_id,
        max_questions:   userPlan.max_questions,
        max_books:       userPlan.max_books,
        allow_extracted: userPlan.allow_extracted,
        filter_types:    userPlan.filter_types,
      }, 200, request);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Route: GET /announcements  (all authenticated users)
    // ────────────────────────────────────────────────────────────────────────
    if (path === 'announcements' && method === 'GET') {
      const rows = await env.DB
        .prepare(`
          SELECT * FROM announcements
          WHERE (target_plan = 'all' OR target_plan = ?)
            AND (expires_at IS NULL OR expires_at >= date('now'))
          ORDER BY created_at DESC
        `)
        .bind(userPlan.plan_id)
        .all();
      return jsonResponse(rows.results || [], 200, request);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Admin routes — require admin or superadmin
    // ────────────────────────────────────────────────────────────────────────
    if (path.startsWith('admin/') || path === 'admin') {
      const adminErr = requireAdmin(userPlan, request);
      if (adminErr) return adminErr;

      // ── GET /admin/users  (superadmin only) ──────────────────────────────
      if (path === 'admin/users' && method === 'GET') {
        const guard = requireSuperadmin(userPlan, request);
        if (guard) return guard;
        const rows = await env.DB
          .prepare(`
            SELECT u.email, u.role, u.plan_id, u.is_active, u.created_at, u.plan_expires_at,
                   p.name AS plan_name
            FROM   users u
            JOIN   plans p ON u.plan_id = p.id
            ORDER BY u.created_at DESC
          `)
          .all();
        return jsonResponse(rows.results || [], 200, request);
      }

      // ── POST /admin/users/update  (superadmin only) ──────────────────────
      if (path === 'admin/users/update' && method === 'POST') {
        const guard = requireSuperadmin(userPlan, request);
        if (guard) return guard;
        const body = await request.json();
        await env.DB
          .prepare(`
            UPDATE users SET role=?, plan_id=?, is_active=?, plan_expires_at=?
            WHERE email=?
          `)
          .bind(body.role, body.plan_id, body.is_active, body.plan_expires_at || null, body.email)
          .run();
        const updated = await env.DB
          .prepare('SELECT * FROM users WHERE email=?').bind(body.email).first();
        return jsonResponse(updated, 200, request);
      }

      // ── POST /admin/users/create  (superadmin only) ──────────────────────
      if (path === 'admin/users/create' && method === 'POST') {
        const guard = requireSuperadmin(userPlan, request);
        if (guard) return guard;
        const body = await request.json();
        await env.DB
          .prepare(`
            INSERT INTO users (email, role, plan_id, is_active, created_at)
            VALUES (?, ?, ?, 1, datetime('now'))
          `)
          .bind(body.email, body.role, body.plan_id)
          .run();
        const created = await env.DB
          .prepare('SELECT * FROM users WHERE email=?').bind(body.email).first();
        return jsonResponse(created, 201, request);
      }

      // ── GET /admin/plans  (superadmin only) ──────────────────────────────
      if (path === 'admin/plans' && method === 'GET') {
        const guard = requireSuperadmin(userPlan, request);
        if (guard) return guard;
        const rows = await env.DB.prepare('SELECT * FROM plans ORDER BY created_at').all();
        return jsonResponse(rows.results || [], 200, request);
      }

      // ── POST /admin/plans/update  (superadmin only) ──────────────────────
      if (path === 'admin/plans/update' && method === 'POST') {
        const guard = requireSuperadmin(userPlan, request);
        if (guard) return guard;
        const body = await request.json();
        await env.DB
          .prepare(`
            UPDATE plans SET name=?, max_questions=?, max_books=?, allow_extracted=?, filter_types=?
            WHERE id=?
          `)
          .bind(body.name, body.max_questions, body.max_books, body.allow_extracted, body.filter_types, body.id)
          .run();
        const updated = await env.DB
          .prepare('SELECT * FROM plans WHERE id=?').bind(body.id).first();
        return jsonResponse(updated, 200, request);
      }

      // ── POST /admin/plans/create  (superadmin only) ──────────────────────
      if (path === 'admin/plans/create' && method === 'POST') {
        const guard = requireSuperadmin(userPlan, request);
        if (guard) return guard;
        const body = await request.json();
        await env.DB
          .prepare(`
            INSERT INTO plans (id, name, max_questions, max_books, allow_extracted, filter_types, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `)
          .bind(body.id, body.name, body.max_questions, body.max_books, body.allow_extracted, body.filter_types)
          .run();
        const created = await env.DB
          .prepare('SELECT * FROM plans WHERE id=?').bind(body.id).first();
        return jsonResponse(created, 201, request);
      }

      // ── GET /admin/announcements  (both roles) ───────────────────────────
      if (path === 'admin/announcements' && method === 'GET') {
        const rows = await env.DB
          .prepare('SELECT * FROM announcements ORDER BY created_at DESC')
          .all();
        return jsonResponse(rows.results || [], 200, request);
      }

      // ── POST /admin/announcements/create  (superadmin only) ──────────────
      if (path === 'admin/announcements/create' && method === 'POST') {
        const guard = requireSuperadmin(userPlan, request);
        if (guard) return guard;
        const body = await request.json();
        const id   = crypto.randomUUID();
        await env.DB
          .prepare(`
            INSERT INTO announcements (id, message, target_plan, created_by, created_at, expires_at)
            VALUES (?, ?, ?, ?, datetime('now'), ?)
          `)
          .bind(id, body.message, body.target_plan || 'all', email, body.expires_at || null)
          .run();
        const created = await env.DB
          .prepare('SELECT * FROM announcements WHERE id=?').bind(id).first();
        return jsonResponse(created, 201, request);
      }

      // ── DELETE /admin/announcements/:id  (superadmin only) ───────────────
      if (path.startsWith('admin/announcements/') && method === 'DELETE') {
        const guard = requireSuperadmin(userPlan, request);
        if (guard) return guard;
        const annId = path.slice('admin/announcements/'.length);
        await env.DB
          .prepare('DELETE FROM announcements WHERE id=?').bind(annId).run();
        return jsonResponse({ deleted: true }, 200, request);
      }

      // ── GET /admin/messages  (both roles) ────────────────────────────────
      if (path === 'admin/messages' && method === 'GET') {
        const rows = await env.DB
          .prepare(`
            SELECT * FROM messages WHERE to_email=? ORDER BY created_at DESC
          `)
          .bind(email)
          .all();
        return jsonResponse(rows.results || [], 200, request);
      }

      // ── POST /admin/messages/send  (both roles) ──────────────────────────
      if (path === 'admin/messages/send' && method === 'POST') {
        const body = await request.json();
        const id   = crypto.randomUUID();
        await env.DB
          .prepare(`
            INSERT INTO messages (id, from_email, to_email, subject, body, is_read, created_at, thread_id)
            VALUES (?, ?, ?, ?, ?, 0, datetime('now'), ?)
          `)
          .bind(id, email, body.to_email, body.subject, body.body, id)
          .run();
        const created = await env.DB
          .prepare('SELECT * FROM messages WHERE id=?').bind(id).first();
        return jsonResponse(created, 201, request);
      }

      // ── POST /admin/messages/reply  (both roles) ─────────────────────────
      if (path === 'admin/messages/reply' && method === 'POST') {
        const body = await request.json();
        const id   = crypto.randomUUID();
        await env.DB
          .prepare(`
            INSERT INTO messages (id, from_email, to_email, subject, body, is_read, created_at, thread_id)
            VALUES (?, ?, ?, ?, ?, 0, datetime('now'), ?)
          `)
          .bind(id, email, body.to_email, body.subject, body.body, body.thread_id)
          .run();
        const created = await env.DB
          .prepare('SELECT * FROM messages WHERE id=?').bind(id).first();
        return jsonResponse(created, 201, request);
      }

      // ── POST /admin/messages/read  (both roles) ──────────────────────────
      if (path === 'admin/messages/read' && method === 'POST') {
        const body = await request.json();
        await env.DB
          .prepare('UPDATE messages SET is_read=1 WHERE id=? AND to_email=?')
          .bind(body.id, email)
          .run();
        return jsonResponse({ updated: true }, 200, request);
      }

      // ── GET /admin/user-notes/:email  (both roles) ───────────────────────
      if (path.startsWith('admin/user-notes/') && method === 'GET') {
        const targetEmail = decodeURIComponent(path.slice('admin/user-notes/'.length));
        const rows = await env.DB
          .prepare('SELECT * FROM user_notes WHERE user_email=? ORDER BY created_at DESC')
          .bind(targetEmail)
          .all();
        return jsonResponse(rows.results || [], 200, request);
      }

      // ── POST /admin/user-notes/create  (both roles) ──────────────────────
      if (path === 'admin/user-notes/create' && method === 'POST') {
        const body = await request.json();
        const id   = crypto.randomUUID();
        await env.DB
          .prepare(`
            INSERT INTO user_notes (id, user_email, note, created_by, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
          `)
          .bind(id, body.user_email, body.note, email)
          .run();
        const created = await env.DB
          .prepare('SELECT * FROM user_notes WHERE id=?').bind(id).first();
        return jsonResponse(created, 201, request);
      }

      // Unknown admin route
      return errResponse('not_found', 404, request);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Route: POST /save-paper
    // ────────────────────────────────────────────────────────────────────────
    if (path === 'save-paper' && method === 'POST') {
      const body = await request.json();
      await env.DB
        .prepare(`INSERT OR REPLACE INTO ch_papers (id, user_email, paper_json, created_at)
                  VALUES (?, ?, ?, ?)`)
        .bind(body.id, email, JSON.stringify(body), new Date().toISOString())
        .run();
      return jsonResponse({ saved: true }, 200, request);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Route: POST /save-attempt
    // ────────────────────────────────────────────────────────────────────────
    if (path === 'save-attempt' && method === 'POST') {
      const body = await request.json();
      await env.DB
        .prepare(`INSERT OR REPLACE INTO ch_attempts (id, user_email, attempt_json, submitted_at)
                  VALUES (?, ?, ?, ?)`)
        .bind(body.attemptId, email, JSON.stringify(body), new Date().toISOString())
        .run();
      return jsonResponse({ saved: true }, 200, request);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Route: GET /get-papers
    // ────────────────────────────────────────────────────────────────────────
    if (path === 'get-papers' && method === 'GET') {
      const rows = await env.DB
        .prepare(`SELECT id, paper_json, created_at FROM ch_papers
                  WHERE user_email=? ORDER BY created_at DESC`)
        .bind(email)
        .all();
      return jsonResponse(rows.results || [], 200, request);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Route: GET /get-attempts
    // ────────────────────────────────────────────────────────────────────────
    if (path === 'get-attempts' && method === 'GET') {
      const rows = await env.DB
        .prepare(`SELECT id, attempt_json, submitted_at FROM ch_attempts
                  WHERE user_email=? ORDER BY submitted_at DESC`)
        .bind(email)
        .all();
      return jsonResponse(rows.results || [], 200, request);
    }

    // ────────────────────────────────────────────────────────────────────────
    // R2 file routes
    // ────────────────────────────────────────────────────────────────────────
    if (!path) return new Response('Not found', { status: 404 });

    const object = await env.QBANK.get(path);
    if (!object)  return new Response('Not found', { status: 404 });

    const body = await object.text();

    // Enforce plan on _books_registry.json
    if (path === '_books_registry.json') {
      try {
        const registry = JSON.parse(body);
        if (Array.isArray(registry.books)) {
          registry.books = registry.books.slice(0, userPlan.max_books);
        }
        return jsonResponse(registry, 200, request);
      } catch {
        return new Response(body, {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
        });
      }
    }

    // Enforce plan on question JSON files
    const isIndexFile    = path.endsWith('_index.json');
    const isRegistryFile = path === '_books_registry.json';
    const isQuestionFile = path.endsWith('.json') && !isIndexFile && !isRegistryFile;

    if (isQuestionFile) {
      try {
        let questions = JSON.parse(body);
        if (userPlan.allow_extracted === 0 && Array.isArray(questions)) {
          questions = questions.filter(q => q.source_type !== 'extracted');
        }
        return jsonResponse(questions, 200, request);
      } catch {
        return new Response(body, {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
        });
      }
    }

    // All other files (_index.json etc.) — serve unmodified
    return new Response(body, {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
    });
  },
};
// auto-deploy pipeline verified 2026-05-01
