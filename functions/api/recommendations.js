import { json, getUser } from './_security.js';

// 首页读取每日热门缓存。真正的同步由 Cloudflare Cron Worker 在后台完成。
export async function onRequest({ request, env }) {
  try {
    if (!env.DB) return json({ error: 'D1 数据库未绑定' }, 503);
    const user = await getUser(request, env);
    if (!user) return json({ error: '请先登录' }, 401);
    const row = await env.DB.prepare('SELECT value, updated_at FROM user_data WHERE key = ?')
      .bind('aurora_trending_cache_v1').first();
    if (!row?.value) return json({ items: [], updatedAt: null, source: 'TMDB' });
    let payload;
    try { payload = JSON.parse(row.value); }
    catch { return json({ items: [], updatedAt: row.updated_at || null, source: 'TMDB' }); }
    return json({
      items: Array.isArray(payload.items) ? payload.items : [],
      updatedAt: payload.updatedAt || row.updated_at || null,
      source: payload.source || 'TMDB'
    });
  } catch (error) {
    return json({ error: error?.message || '热门推荐读取失败' }, 500);
  }
}
