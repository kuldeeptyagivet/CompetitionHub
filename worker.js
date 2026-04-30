const ACCESS_KEY = 'ch-qbank-2026';

const ALLOWED_ORIGINS = [
  'https://competitionhub.pages.dev',
  'http://localhost',
];

// ── CORS / response helpers ───────────────────────────────────────────────────

function corsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Headers': 'x-access-key, x-user-email, CF-Access-Client-Id, CF-Access-Client-Secret',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function errResponse(msg, status, origin) {
  return jsonResponse({ error: msg }, status, origin);
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

function requireAdmin(userPlan, origin) {
  if (userPlan.role !== 'superadmin' && userPlan.role !== 'admin') {
    return errResponse('forbidden', 403, origin);
  }
  return null;
}

function requireSuperadmin(userPlan, origin) {
  if (userPlan.role !== 'superadmin') {
    return errResponse('superadmin_required', 403, origin);
  }
  return null;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // Validate access key
    if (request.headers.get('x-access-key') !== ACCESS_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Validate user email
    const email = (request.headers.get('x-user-email') || '').trim();
    if (!email) return errResponse('missing_email', 401, origin);

    // Resolve user + plan
    const userPlan = await resolveUserPlan(email, env.DB);
    if (!userPlan)              return errResponse('plan_resolve_failed', 500, origin);
    if (userPlan.is_active === 0) return errResponse('account_disabled', 403, origin);

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
      }, 200, origin);
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
      return jsonResponse(rows.results || [], 200, origin);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Admin routes — require admin or superadmin
    // ────────────────────────────────────────────────────────────────────────
    if (path.startsWith('admin/') || path === 'admin') {
      const adminErr = requireAdmin(userPlan, origin);
      if (adminErr) return adminErr;

      // ── GET /admin/users  (superadmin only) ──────────────────────────────
      if (path === 'admin/users' && method === 'GET') {
        const guard = requireSuperadmin(userPlan, origin);
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
        return jsonResponse(rows.results || [], 200, origin);
      }

      // ── POST /admin/users/update  (superadmin only) ──────────────────────
      if (path === 'admin/users/update' && method === 'POST') {
        const guard = requireSuperadmin(userPlan, origin);
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
        return jsonResponse(updated, 200, origin);
      }

      // ── POST /admin/users/create  (superadmin only) ──────────────────────
      if (path === 'admin/users/create' && method === 'POST') {
        const guard = requireSuperadmin(userPlan, origin);
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
        return jsonResponse(created, 201, origin);
      }

      // ── GET /admin/plans  (superadmin only) ──────────────────────────────
      if (path === 'admin/plans' && method === 'GET') {
        const guard = requireSuperadmin(userPlan, origin);
        if (guard) return guard;
        const rows = await env.DB.prepare('SELECT * FROM plans ORDER BY created_at').all();
        return jsonResponse(rows.results || [], 200, origin);
      }

      // ── POST /admin/plans/update  (superadmin only) ──────────────────────
      if (path === 'admin/plans/update' && method === 'POST') {
        const guard = requireSuperadmin(userPlan, origin);
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
        return jsonResponse(updated, 200, origin);
      }

      // ── POST /admin/plans/create  (superadmin only) ──────────────────────
      if (path === 'admin/plans/create' && method === 'POST') {
        const guard = requireSuperadmin(userPlan, origin);
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
        return jsonResponse(created, 201, origin);
      }

      // ── GET /admin/announcements  (both roles) ───────────────────────────
      if (path === 'admin/announcements' && method === 'GET') {
        const rows = await env.DB
          .prepare('SELECT * FROM announcements ORDER BY created_at DESC')
          .all();
        return jsonResponse(rows.results || [], 200, origin);
      }

      // ── POST /admin/announcements/create  (superadmin only) ──────────────
      if (path === 'admin/announcements/create' && method === 'POST') {
        const guard = requireSuperadmin(userPlan, origin);
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
        return jsonResponse(created, 201, origin);
      }

      // ── DELETE /admin/announcements/:id  (superadmin only) ───────────────
      if (path.startsWith('admin/announcements/') && method === 'DELETE') {
        const guard = requireSuperadmin(userPlan, origin);
        if (guard) return guard;
        const annId = path.slice('admin/announcements/'.length);
        await env.DB
          .prepare('DELETE FROM announcements WHERE id=?').bind(annId).run();
        return jsonResponse({ deleted: true }, 200, origin);
      }

      // ── GET /admin/messages  (both roles) ────────────────────────────────
      if (path === 'admin/messages' && method === 'GET') {
        const rows = await env.DB
          .prepare(`
            SELECT * FROM messages WHERE to_email=? ORDER BY created_at DESC
          `)
          .bind(email)
          .all();
        return jsonResponse(rows.results || [], 200, origin);
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
        return jsonResponse(created, 201, origin);
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
        return jsonResponse(created, 201, origin);
      }

      // ── POST /admin/messages/read  (both roles) ──────────────────────────
      if (path === 'admin/messages/read' && method === 'POST') {
        const body = await request.json();
        await env.DB
          .prepare('UPDATE messages SET is_read=1 WHERE id=? AND to_email=?')
          .bind(body.id, email)
          .run();
        return jsonResponse({ updated: true }, 200, origin);
      }

      // ── GET /admin/user-notes/:email  (both roles) ───────────────────────
      if (path.startsWith('admin/user-notes/') && method === 'GET') {
        const targetEmail = decodeURIComponent(path.slice('admin/user-notes/'.length));
        const rows = await env.DB
          .prepare('SELECT * FROM user_notes WHERE user_email=? ORDER BY created_at DESC')
          .bind(targetEmail)
          .all();
        return jsonResponse(rows.results || [], 200, origin);
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
        return jsonResponse(created, 201, origin);
      }

      // Unknown admin route
      return errResponse('not_found', 404, origin);
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
        return jsonResponse(registry, 200, origin);
      } catch {
        return new Response(body, {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
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
        return jsonResponse(questions, 200, origin);
      } catch {
        return new Response(body, {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
    }

    // All other files (_index.json etc.) — serve unmodified
    return new Response(body, {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};
