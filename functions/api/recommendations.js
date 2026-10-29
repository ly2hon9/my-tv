import { json, getUser } from './_security.js';

const CACHE_KEY = 'aurora_trending_cache_v1';
const UPSTREAM_URL = 'https://my-yuan.pages.dev/api/recommendations';
const MAX_AGE_MS = 23 * 60 * 60 * 1000;

// Reads the already-synchronized KV feed and persists a snapshot into D1.
// This means the homepage does not query TMDB or scrape source catalogs on every visit.
async function refreshD1FromUpstream(env) {
  const response = await fetch(UPSTREAM_URL, {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 0 }
  });
  if (!response.ok) throw new Error(`热门缓存上游返回 HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('上游热门缓存暂时没有影视数据');
  }

  const normalized = {
    source: payload.source || 'TMDB',
    updatedAt: payload.updatedAt || new Date().toISOString(),
    counts: payload.counts || {
      movies: payload.items.filter(item => item.type === '电影').length,
      shows: payload.items.filter(item => item.type === '电视剧').length,
      total: payload.items.length
    },
    items: payload.items
  };

  if (env.DB) {
    await env.DB.prepare(
      'INSERT INTO user_data (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
    ).bind(CACHE_KEY, JSON.stringify(normalized)).run();
  }
  return normalized;
}

function unpackRow(row) {
  if (!row?.value) return null;
  try {
    const payload = JSON.parse(row.value);
    if (!Array.isArray(payload.items) || !payload.items.length) return null;
    return {
      source: payload.source || 'TMDB',
      updatedAt: payload.updatedAt || row.updated_at || null,
      counts: payload.counts,
      items: payload.items
    };
  } catch {
    return null;
  }
}

function isFresh(payload, row) {
  const raw = payload?.updatedAt || row?.updated_at;
  if (!raw) return false;
  const stamp = Date.parse(raw);
  return Number.isFinite(stamp) && Date.now() - stamp < MAX_AGE_MS;
}

export async function onRequest({ request, env }) {
  try {
    const user = await getUser(request, env);
    if (!user) return json({ error: '请先登录' }, 401);

    let row = null;
    let cached = null;
    if (env.DB) {
      row = await env.DB.prepare(
        'SELECT value, updated_at FROM user_data WHERE key = ?'
      ).bind(CACHE_KEY).first();
      cached = unpackRow(row);
      if (cached && isFresh(cached, row)) {
        return json(cached, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' });
      }
    }

    // First request populates D1 from the daily KV snapshot. Later requests read D1.
    try {
      const fresh = await refreshD1FromUpstream(env);
      return json(fresh, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' });
    } catch (upstreamError) {
      // Keep serving a previous snapshot if the upstream service is temporarily unavailable.
      if (cached) {
        return json(cached, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' });
      }
      if (!env.DB) {
        return json({ items: [], updatedAt: null, source: 'TMDB', warning: upstreamError?.message || '热门推荐暂时不可用' }, 200);
      }
      return json({ items: [], updatedAt: null, source: 'TMDB', warning: upstreamError?.message || '热门推荐暂时不可用' }, 200);
    }
  } catch (error) {
    return json({ error: error?.message || '热门推荐读取失败' }, 500);
  }
}
