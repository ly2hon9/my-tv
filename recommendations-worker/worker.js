const CACHE_KEY = 'aurora_trending_cache_v1';
const SHORT_DRAMA = /短剧|微短剧|竖屏剧|爽剧|付费短剧|小程序剧|mini\s*drama|vertical\s*drama/i;
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

function clean(item, type) {
  const title = String(item.title || item.name || item.original_title || item.original_name || '').trim();
  const overview = String(item.overview || '').trim();
  if (!title || SHORT_DRAMA.test(title) || SHORT_DRAMA.test(overview)) return null;
  if (!item.poster_path) return null;
  const date = String(item.release_date || item.first_air_date || '');
  return {
    id: Number(item.id),
    title,
    originalTitle: String(item.original_title || item.original_name || ''),
    type,
    year: date.slice(0, 4),
    releaseDate: date,
    overview: overview.slice(0, 420),
    poster: `${IMAGE_BASE}${item.poster_path}`,
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : '',
    vote_average: Number(item.vote_average || 0),
    vote_count: Number(item.vote_count || 0),
    popularity: Number(item.popularity || 0),
    source: 'TMDB 实时热门'
  };
}

async function fetchTrending(type, env) {
  let url;
  if (type === '电影' || type === '电视剧') {
    const endpoint = type === '电影' ? 'movie' : 'tv';
    url = new URL(`https://api.themoviedb.org/3/trending/${endpoint}/day`);
  } else {
    // 影视分类页也要有真实数据：综艺使用真人秀/脱口秀类型，动漫使用动画类型。
    url = new URL('https://api.themoviedb.org/3/discover/tv');
    url.searchParams.set('sort_by', 'popularity.desc');
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('with_genres', type === '动漫' ? '16' : '10764,10767');
  }
  url.searchParams.set('language', 'zh-CN');
  url.searchParams.set('api_key', env.TMDB_API_KEY);
  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 0 }
  });
  if (!response.ok) throw new Error(`TMDB ${type} API 返回 ${response.status}`);
  const payload = await response.json();
  return (Array.isArray(payload.results) ? payload.results : [])
    .map(item => clean(item, type)).filter(Boolean)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 18);
}

async function syncRecommendations(env) {
  if (!env.DB) throw new Error('缺少 D1 绑定 DB');
  if (!env.TMDB_API_KEY) throw new Error('缺少 TMDB_API_KEY Secret');
  const [movies, shows, variety, anime] = await Promise.all([
    fetchTrending('电影', env), fetchTrending('电视剧', env),
    fetchTrending('综艺', env), fetchTrending('动漫', env)
  ]);
  // 首页优先交错展示电影/电视剧；分类页同时拥有独立的真实综艺和动画数据。
  const items = [];
  const max = Math.max(movies.length, shows.length);
  for (let i = 0; i < max; i++) {
    if (movies[i]) items.push(movies[i]);
    if (shows[i]) items.push(shows[i]);
  }
  items.push(...variety, ...anime);
  const payload = JSON.stringify({
    source: 'TMDB',
    updatedAt: new Date().toISOString(),
    items: items.slice(0, 72)
  });
  await env.DB.prepare(
    'INSERT INTO user_data (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
  ).bind(CACHE_KEY, payload).run();
  return { count: items.length, movies: movies.length, shows: shows.length, variety: variety.length, anime: anime.length };
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(syncRecommendations(env));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/sync' && request.method === 'POST') {
      if (!env.SYNC_SECRET || request.headers.get('Authorization') !== `Bearer ${env.SYNC_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
      }
      try {
        const result = await syncRecommendations(env);
        return Response.json({ success: true, ...result, updatedAt: new Date().toISOString() });
      } catch (error) {
        return Response.json({ success: false, error: error?.message || 'sync failed' }, { status: 500 });
      }
    }
    return Response.json({
      service: '拾光影视每日热门同步',
      status: 'ready',
      schedule: '每天 03:00 UTC（北京时间 11:00）',
      manualSync: 'POST /sync with Authorization: Bearer <SYNC_SECRET>'
    });
  }
};
