export async function onRequest(context) {
  const url = new URL(context.request.url).searchParams.get("url");
  if (!url) return new Response("Missing url", { status: 400 });

  try {
    const targetUrl = decodeURIComponent(url);
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": new URL(targetUrl).origin
      }
    });

    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Headers", "*");

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    });
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}
