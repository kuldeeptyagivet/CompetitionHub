const ACCESS_KEY = 'ch-qbank-2026';

const ALLOWED_ORIGINS = [
  'https://competitionhub.pages.dev',
  'http://localhost',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Headers': 'x-access-key, x-user-email, CF-Access-Client-Id, CF-Access-Client-Secret',
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// ── Resolve user + plan from D1, auto-provisioning if new ────────────────────

async function resolveUserPlan(email, db) {
  const row = await db
    .prepare(`
      SELECT u.role, u.plan_id, u.is_active,
             p.max_questions, p.max_books, p.allow_extracted, p.filter_types
      FROM   users u
      JOIN   plans p ON u.plan_id = p.id
      WHERE  u.email = ?
    `)
    .bind(email)
    .first();

  if (row) return row;

  // New user — auto-provision with free plan
  await db
    .prepare(`
      INSERT INTO users (email, role, plan_id, is_active, created_at)
      VALUES (?, 'user', 'free', 1, datetime('now'))
    `)
    .bind(email)
    .run();

  // Re-query to get plan data
  return db
    .prepare(`
      SELECT u.role, u.plan_id, u.is_active,
             p.max_questions, p.max_books, p.allow_extracted, p.filter_types
      FROM   users u
      JOIN   plans p ON u.plan_id = p.id
      WHERE  u.email = ?
    `)
    .bind(email)
    .first();
}

// ── Main handler ─────────────────────────────────────────────────────────────

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

    // Validate user email header
    const email = (request.headers.get('x-user-email') || '').trim();
    if (!email) {
      return jsonResponse({ error: 'missing_email' }, 401, origin);
    }

    // Resolve user + plan from D1
    const userPlan = await resolveUserPlan(email, env.DB);
    if (!userPlan) {
      return jsonResponse({ error: 'plan_resolve_failed' }, 500, origin);
    }
    if (userPlan.is_active === 0) {
      return jsonResponse({ error: 'account_disabled' }, 403, origin);
    }

    const url  = new URL(request.url);
    const path = decodeURIComponent(url.pathname.slice(1)); // strip leading /

    // ── Route: /user-plan ────────────────────────────────────────────────────
    if (path === 'user-plan') {
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

    // ── Route: R2 file fetch ─────────────────────────────────────────────────
    if (!path) {
      return new Response('Not found', { status: 404 });
    }

    const object = await env.QBANK.get(path);
    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    const body = await object.text();

    // ── Enforce plan on _books_registry.json ─────────────────────────────────
    if (path === '_books_registry.json') {
      try {
        const registry = JSON.parse(body);
        if (Array.isArray(registry.books)) {
          registry.books = registry.books.slice(0, userPlan.max_books);
        }
        return jsonResponse(registry, 200, origin);
      } catch {
        // Serve raw if parse fails
        return new Response(body, {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
    }

    // ── Enforce plan on question JSON files ───────────────────────────────────
    // Question files: .json, not registry, not _index.json
    const isIndexFile    = path.endsWith('_index.json');
    const isRegistryFile = path === '_books_registry.json';
    const isQuestionFile = path.endsWith('.json') && !isIndexFile && !isRegistryFile;

    if (isQuestionFile) {
      try {
        let questions = JSON.parse(body);
        // Filter extracted questions if plan disallows them
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

    // ── All other files (_index.json etc.) — serve unmodified ────────────────
    return new Response(body, {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};
