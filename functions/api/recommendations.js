import { json, getUser } from './_security.js';

const CACHE_KEY = 'aurora_trending_cache_v1';
const UPSTREAM_URL = 'https://my-yuan.pages.dev/api/recommendations';
const MAX_AGE_MS = 23 * 60 * 60 * 1000;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p/';
const SHORT_DRAMA = /短剧|微短剧|竖屏剧|爽剧|付费短剧|小程序剧|mini\s*drama|vertical\s*drama/i;

function normalizeItem(item, fallbackType) {
  const title = String(item?.title || item?.name || item?.original_title || item?.original_name || '').trim();
  const overview = String(item?.overview || item?.remarks || '').trim();
  if (!title || SHORT_DRAMA.test(title) || SHORT_DRAMA.test(overview)) return null;
  const posterRaw = String(item?.poster || item?.poster_url || item?.vod_pic || '');
  const backdropRaw = String(item?.backdrop || item?.backdrop_url || '');
  const poster = posterRaw || (item?.poster_path ? `${TMDB_IMAGE}w500${item.poster_path}` : '');
  const backdrop = backdropRaw || (item?.backdrop_path ? `${TMDB_IMAGE}w1280${item.backdrop_path}` : '');
  if (!poster) return null;
  const typeRaw = String(item?.type || item?.media_type || fallbackType || '电影');
  const type = /综艺|真人秀|脱口秀|variety/i.test(typeRaw) ? '综艺'
    : /动漫|动画|番剧|anime|animation/i.test(typeRaw) ? '动漫'
    : /电视剧|连续剧|剧集|tv/i.test(typeRaw) ? '电视剧' : '电影';
  const date = String(item?.release_date || item?.first_air_date || item?.year || '');
  return {
    id: Number(item?.id || 0), title, type,
    year: date.slice(0, 4), releaseDate: date,
    overview: overview.slice(0, 600), poster, backdrop,
    voteAverage: Number(item?.voteAverage ?? item?.vote_average ?? 0),
    voteCount: Number(item?.voteCount ?? item?.vote_count ?? 0),
    popularity: Number(item?.popularity || 0),
    voteCount: Number(item?.voteCount ?? item?.vote_count ?? 0),
    originalLanguage: String(item?.originalLanguage || item?.original_language || ''),
    originCountry: Array.isArray(item?.originCountry) ? item.originCountry : (Array.isArray(item?.origin_country) ? item.origin_country : []),
    source: item?.source || 'TMDB 热门'
  };
}

async function fetchPopularTVCategory(env, type, genres) {
  if (!env.TMDB_API_KEY) return [];
  const url = new URL(`${TMDB_BASE}/discover/tv`);
  url.searchParams.set('api_key', env.TMDB_API_KEY);
  url.searchParams.set('language', 'zh-CN');
  url.searchParams.set('sort_by', 'popularity.desc');
  url.searchParams.set('include_adult', 'false');
  url.searchParams.set('with_genres', genres);
  url.searchParams.set('page', '1');
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, cf: { cacheTtl: 300 } });
  if (!response.ok) throw new Error(`TMDB ${type}分类请求失败：HTTP ${response.status}`);
  const payload = await response.json();
  return (Array.isArray(payload.results) ? payload.results : [])
    .map(item => normalizeItem(item, type)).filter(Boolean)
    .sort((a, b) => b.popularity - a.popularity).slice(0, 20);
}

async function refreshD1FromUpstream(env) {
  const response = await fetch(UPSTREAM_URL, {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 0 }
  });
  if (!response.ok) throw new Error(`热门缓存上游返回 HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error('上游热门缓存暂时没有影视数据');

  const mainItems = payload.items.map(item => normalizeItem(item)).filter(Boolean);
  let variety = [], anime = [];
  // 电影/剧集取已同步 KV；综艺和动漫通过 TMDB 的对应电视类型补齐，并一起写入 D1。
  if (env.TMDB_API_KEY) {
    const results = await Promise.allSettled([
      fetchPopularTVCategory(env, '综艺', '10764,10767'),
      fetchPopularTVCategory(env, '动漫', '16')
    ]);
    if (results[0].status === 'fulfilled') variety = results[0].value;
    if (results[1].status === 'fulfilled') anime = results[1].value;
  }
  const seen = new Set();
  const items = [...mainItems, ...variety, ...anime].filter(item => {
    const key = `${item.type}:${item.id || item.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const normalized = {
    source: payload.source || 'TMDB',
    updatedAt: new Date().toISOString(),
    upstreamUpdatedAt: payload.updatedAt || null,
    counts: {
      movies: items.filter(item => item.type === '电影').length,
      shows: items.filter(item => item.type === '电视剧').length,
      variety: items.filter(item => item.type === '综艺').length,
      anime: items.filter(item => item.type === '动漫').length,
      total: items.length
    }, items
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
    return { ...payload, updatedAt: payload.updatedAt || row.updated_at || null };
  } catch { return null; }
}

function isFresh(payload, row) {
  // D1 的 updated_at 是快照写入时间；不要用上游 KV 的更新时间判断，否则每次打开都可能刷新。
  const raw = row?.updated_at || payload?.updatedAt;
  if (!raw) return false;
  const stamp = Date.parse(raw);
  return Number.isFinite(stamp) && Date.now() - stamp < MAX_AGE_MS;
}

export async function onRequest({ request, env }) {
  try {
    const user = await getUser(request, env);
    if (!user) return json({ error: '请先登录' }, 401);
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === '1';
    let row = null, cached = null;
    if (env.DB) {
      row = await env.DB.prepare('SELECT value, updated_at FROM user_data WHERE key = ?').bind(CACHE_KEY).first();
      cached = unpackRow(row);
      const hasCategoryMetadata = cached?.items?.some(item =>
        item.type === '电视剧' && (item.originalLanguage || (Array.isArray(item.originCountry) && item.originCountry.length))
      );
      if (cached && isFresh(cached, row) && !forceRefresh && hasCategoryMetadata) {
        return json(cached, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' });
      }
    }
    try {
      const fresh = await refreshD1FromUpstream(env);
      return json(fresh, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' });
    } catch (error) {
      if (cached) return json(cached, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' });
      return json({ items: [], updatedAt: null, source: 'TMDB', warning: error?.message || '热门推荐暂时不可用' }, 200);
    }
  } catch (error) {
    return json({ error: error?.message || '热门推荐读取失败' }, 500);
  }
}
