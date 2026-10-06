// functions/api/data.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const targetProxyUrl = url.searchParams.get("proxy_url");
  const key = url.searchParams.get("key");

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-cache"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  // 自建极速代理服务：专门解决 360资源等接口被浏览器 CORS 拦截的问题
  if (action === "proxy" && targetProxyUrl) {
    try {
      const resp = await fetch(targetProxyUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*"
        }
      });
      const text = await resp.text();
      return new Response(text, { headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: "代理抓取失败: " + e.message }), { status: 500, headers });
    }
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "D1 数据库未绑定" }), { status: 500, headers });
  }

  try {
    if (request.method === "GET") {
      if (key) {
        const row = await env.DB.prepare("SELECT value FROM user_data WHERE key = ?").bind(key).first();
        return new Response(JSON.stringify({ value: row ? row.value : null }), { headers });
      } else {
        const { results } = await env.DB.prepare("SELECT key, value FROM user_data").all();
        const data = {};
        (results || []).forEach(r => { data[r.key] = r.value; });
        return new Response(JSON.stringify(data), { headers });
      }
    } else if (request.method === "POST") {
      const body = await request.json();
      const { key: postKey, value } = body;
      if (!postKey) return new Response(JSON.stringify({ error: "缺少 key" }), { status: 400, headers });

      const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      await env.DB.prepare(
        "INSERT INTO user_data (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
      ).bind(postKey, valStr).run();

      return new Response(JSON.stringify({ success: true }), { headers });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
