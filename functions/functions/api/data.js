// functions/api/data.js
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "D1 数据库未绑定" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    if (key) {
      const row = await env.DB.prepare("SELECT value FROM user_data WHERE key = ?").bind(key).first();
      return new Response(JSON.stringify({ value: row ? row.value : null }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      const { results } = await env.DB.prepare("SELECT key, value FROM user_data").all();
      const data = {};
      results.forEach(r => { data[r.key] = r.value; });
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "D1 数据库未绑定" }), { status: 500 });
  }

  try {
    const body = await request.json();
    const { key, value } = body;
    if (!key) return new Response("缺少 key", { status: 400 });

    const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await env.DB.prepare(
      "INSERT INTO user_data (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
    ).bind(key, valStr).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
