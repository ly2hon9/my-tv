import { json, getUser } from './_security.js';

const CACHE_KEY = 'aurora_trending_cache_v1';
const UPSTREAM_URL = 'https://my-yuan.pages.dev/api/recommendations';
const MAX_AGE_MS = 23 * 60 * 60 * 1000;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p/';
const SHORT_DRAMA = /短剧|微短剧|竖屏剧|爽剧|付费短剧|小程序剧|mini\s*drama|vertical\s*drama/i;

const VARIETY_TITLE_RE = /(?:你好，?星期六|明星大侦探|大侦探(?:第|·|\d)|奔跑吧|乘风(?:20\d\d|破浪|第|\s)|披荆斩棘|极限挑战|向往的生活|现在就出发|哈哈哈哈哈|喜人奇妙夜|密室大逃脱|种地吧|声生不息|再见爱人|令人心动的offer|歌手20\d\d|脱口秀大会|无限超越班|花儿与少年|非诚勿扰|快乐大本营|王牌对王牌)/i;
const ANIME_TITLE_RE = /(?:妖神记|仙逆|凡人修仙传|斗罗大陆|斗破苍穹|完美世界|吞噬星空|神印王座|猪猪侠|沧元图|灵笼|遮天(?:动画|年番)|一人之下|画江湖之不良人|狐妖小红娘|鬼灭之刃|海贼王|航海王|ONE\s*PIECE|海绵宝宝|SpongeBob|火影忍者|名侦探柯南|动漫|动画版|动画片)/i;
function genreIds(item) {
  return (Array.isArray(item?.genreIds) ? item.genreIds : Array.isArray(item?.genre_ids) ? item.genre_ids : Array.isArray(item?.genres) ? item.genres : [])
    .map(x => Number(x && typeof x === 'object' ? x.id : x)).filter(Number.isFinite);
}
function strictType(item, fallbackType = '电影') {
  const genres = genreIds(item);
  const raw = String(item?.type || item?.media_type || fallbackType || '').trim();
  const title = String(item?.title || item?.name || '');
  const text = raw + ' ' + String(item?.type_name || item?.category || '');
  if (genres.includes(16) || /动漫|动画|番剧|animation|anime/i.test(text) || ANIME_TITLE_RE.test(title)) return '动漫';
  if (genres.includes(10764) || genres.includes(10767) || /综艺|真人秀|脱口秀|variety|reality|talk\s*show/i.test(text) || VARIETY_TITLE_RE.test(title)) return '综艺';
  if (/电影|movie/i.test(raw)) return '电影';
  if (/剧集|电视剧|连续剧|tv|series|国产剧|美剧|韩剧|日剧/i.test(raw)) return '电视剧';
  return fallbackType === '电视剧' ? '电视剧' : '电影';
}

function normalizeItem(item, fallbackType) {
  const title = String(item?.title || item?.name || item?.original_title || item?.original_name || '').trim();
  const overview = String(item?.overview || item?.remarks || '').trim();
  if (!title || SHORT_DRAMA.test(title) || SHORT_DRAMA.test(overview)) return null;
  const posterRaw = String(item?.poster || item?.poster_url || item?.vod_pic || '');
  const backdropRaw = String(item?.backdrop || item?.backdrop_url || '');
  const poster = posterRaw || (item?.poster_path ? `${TMDB_IMAGE}w500${item.poster_path}` : '');
  const backdrop = backdropRaw || (item?.backdrop_path ? `${TMDB_IMAGE}w1280${item.backdrop_path}` : '');
  if (!poster) return null;
  const type = strictType(item, fallbackType);
  const date = String(item?.releaseDate || item?.release_date || item?.first_air_date || item?.year || '');
  return {
    id: Number(item?.id || 0), title, type,
    year: date.slice(0, 4), releaseDate: date,
    overview: overview.slice(0, 600), poster, backdrop,
    voteAverage: Number(item?.voteAverage ?? item?.vote_average ?? 0),
    voteCount: Number(item?.voteCount ?? item?.vote_count ?? 0),
    popularity: Number(item?.popularity || 0),
    genreIds: genreIds(item),
    originCountry: item?.originCountry || item?.origin_country || [],
    originalLanguage: item?.originalLanguage || item?.original_language || '',
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
  url.searchParams.set('without_genres', type === '动漫' ? '10764|10767' : '16');
  url.searchParams.set('page', '1');
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, cf: { cacheTtl: 300 } });
  if (!response.ok) throw new Error(`TMDB ${type}分类请求失败：HTTP ${response.status}`);
  const payload = await response.json();
  return (Array.isArray(payload.results) ? payload.results : [])
    .map(item => normalizeItem(item, type)).filter(Boolean)
    .sort((a, b) => b.popularity - a.popularity).slice(0, 20);
}

async function fetchChinesePopularTV(env) {
  if (!env.TMDB_API_KEY) return [];
  const url = new URL(`${TMDB_BASE}/discover/tv`);
  url.searchParams.set('api_key', env.TMDB_API_KEY);
  url.searchParams.set('language', 'zh-CN');
  url.searchParams.set('sort_by', 'popularity.desc');
  url.searchParams.set('include_adult', 'false');
  url.searchParams.set('with_origin_country', 'CN');
  url.searchParams.set('with_original_language', 'zh');
  url.searchParams.set('without_genres', '16|10764|10767');
  url.searchParams.set('vote_count.gte', '10');
  url.searchParams.set('page', '1');
  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 300 }
  });
  if (!response.ok) throw new Error(`国产热门电视剧请求失败：HTTP ${response.status}`);
  const payload = await response.json();
  return (Array.isArray(payload.results) ? payload.results : [])
    .map(item => normalizeItem({ ...item, source: '国产热门电视剧' }, '电视剧'))
    .filter(item => item && item.type === '电视剧')
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 30);
}

// Supplement each shelf with real TMDB items so 3/4/6-column layouts have complete rows.
// A page is at most 20 items; query the next page only during the once-daily D1 refresh.
const CATEGORY_TARGET = 24;
async function discoverCategoryPage(env, type, page) {
  if (!env.TMDB_API_KEY) return [];
  const isMovie = type === '电影';
  const url = new URL(`${TMDB_BASE}/discover/${isMovie ? 'movie' : 'tv'}`);
  url.searchParams.set('api_key', env.TMDB_API_KEY);
  url.searchParams.set('language', 'zh-CN');
  url.searchParams.set('sort_by', 'popularity.desc');
  url.searchParams.set('include_adult', 'false');
  url.searchParams.set('page', String(page));
  if (type === '电视剧') {
    // Exclude animation, reality and talk shows from scripted drama shelves.
    url.searchParams.set('without_genres', '16,10764,10767');
  } else if (type === '综艺') {
    // TMDB pipe = either Reality OR Talk. Comma here would exclude many shows.
    url.searchParams.set('with_genres', '10764|10767');
    url.searchParams.set('without_genres', '16');
  } else if (type === '动漫') {
    url.searchParams.set('with_genres', '16');
    url.searchParams.set('without_genres', '10764,10767');
  }
  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' }, cf: { cacheTtl: 300 }
  });
  if (!response.ok) throw new Error(`TMDB ${type} 第${page}页获取失败：HTTP ${response.status}`);
  const payload = await response.json();
  return (Array.isArray(payload.results) ? payload.results : [])
    .map(item => normalizeItem({ ...item, source: 'TMDB同类热门' }, type))
    .filter(item => item && item.type === type && item.poster);
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
  let variety = [], anime = [], chineseShows = [];
  const supplemental = { '电影':[], '电视剧':[], '综艺':[], '动漫':[] };
  const warnings = [];
  if (env.TMDB_API_KEY) {
    const requests = [
      fetchPopularTVCategory(env, '综艺', '10764|10767'),
      fetchPopularTVCategory(env, '动漫', '16'),
      fetchChinesePopularTV(env),
      ...(['电影','电视剧','综艺','动漫'].flatMap(type => [
        discoverCategoryPage(env, type, 1),
        discoverCategoryPage(env, type, 2)
      ]))
    ];
    const results = await Promise.allSettled(requests);
    if (results[0].status === 'fulfilled') variety = results[0].value;
    if (results[1].status === 'fulfilled') anime = results[1].value;
    if (results[2].status === 'fulfilled') chineseShows = results[2].value;
    const types = ['电影','电视剧','综艺','动漫'];
    types.forEach((type, i) => {
      for (const index of [3+i*2, 4+i*2]) {
        if (results[index].status === 'fulfilled') supplemental[type].push(...results[index].value);
      }
    });
    results.forEach((result, index) => {
      if (result.status === 'rejected') warnings.push(`补充数据请求${index+1}失败：${result.reason?.message || '接口异常'}`);
    });
  }
  // Legacy cron payloads often omit genreIds: do not trust generic TV labels when
  // verified genre-aware discover results are available.
  const baseItems = env.TMDB_API_KEY ? mainItems.filter(item =>
    item.type !== '电视剧' || (item.genreIds?.length || 0) > 0
  ) : mainItems;
  const pools = [...baseItems, ...variety, ...anime, ...chineseShows,
    ...supplemental['电影'], ...supplemental['电视剧'],
    ...supplemental['综艺'], ...supplemental['动漫']];
  const categories = ['电影','电视剧','综艺','动漫'];
  const byCategory = Object.fromEntries(categories.map(type => [type, new Map()]));
  for (const item of pools) {
    if (!item || !byCategory[item.type]) continue;
    const mediaKey = item.type === '电影' ? 'movie' : 'tv';
    const key = `${mediaKey}:${item.id || item.title.toLowerCase()}`;
    const map = byCategory[item.type];
    const prev = map.get(key);
    if (!prev || /国产热门电视剧/.test(String(item.source || ''))) map.set(key, item);
  }
  const items = [];
  const counts = { movies:0, shows:0, variety:0, anime:0, total:0 };
  const countName = { '电影':'movies','电视剧':'shows','综艺':'variety','动漫':'anime' };
  for (const type of categories) {
    const values = [...byCategory[type].values()];
    values.sort((a,b) => {
      if (type === '电视剧') {
        const cnA = /国产热门电视剧/.test(a.source || '') ? 1 : 0;
        const cnB = /国产热门电视剧/.test(b.source || '') ? 1 : 0;
        if (cnA !== cnB) return cnB-cnA;
      }
      return (b.popularity || 0) - (a.popularity || 0);
    });
    const selected = values.slice(0, CATEGORY_TARGET);
    counts[countName[type]] = selected.length;
    items.push(...selected);
  }
  counts.total = items.length;
  const normalized = {
    source: payload.source || 'TMDB',
    catalogVersion: 4,
    updatedAt: new Date().toISOString(),
    upstreamUpdatedAt: payload.updatedAt || null,
    counts,
    warning: !env.TMDB_API_KEY
      ? 'my-tv Pages 尚未配置 TMDB_API_KEY，无法补足同类别真实海报'
      : warnings.length ? warnings.join('；').slice(0,350) : null,
    items
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
      ...payload,
      items: payload.items.map(item => normalizeItem(item, item?.type)).filter(Boolean),
      updatedAt: payload.updatedAt || row.updated_at || null
    };
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
      const hasDomesticShows = Boolean(cached?.items?.some(item =>
        item?.type === '电视剧' && /国产热门电视剧|中国大陆热门|中国地区热门/.test(String(item?.source || ''))
      ));
      // A previous KV sync only contained films/series; do not keep serving an
      // incomplete D1 snapshot for 23 hours after the updated sync adds variety/anime.
      const categorySet = new Set(cached?.items?.map(item => item?.type));
      const categoryComplete = cached?.catalogVersion >= 4 && categorySet.has('电影') && categorySet.has('电视剧') &&
        categorySet.has('综艺') && categorySet.has('动漫');
      if (cached && isFresh(cached, row) && !forceRefresh && categoryComplete) {
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
