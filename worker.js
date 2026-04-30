const ACCESS_KEY = 'ch-qbank-2026';

const ALLOWED_ORIGINS = [
  'https://competitionhub.pages.dev',
  'http://localhost',
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Headers': 'x-access-key, CF-Access-Client-Id, CF-Access-Client-Secret',
        }
      });
    }

    // Auth check
    if (request.headers.get('x-access-key') !== ACCESS_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get file path from URL
    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.slice(1));

    if (!key) {
      return new Response('Not found', { status: 404 });
    }

    // Fetch from R2
    const object = await env.QBANK.get(key);
    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    const body = await object.text();
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin,
      }
    });
  }
};