export async function onRequest(context) {
  const urlParam = new URL(context.request.url).searchParams.get("url");
  if (!urlParam) return new Response("Missing url", { status: 400 });

  try {
    const targetUrl = decodeURIComponent(urlParam);
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": new URL(targetUrl).origin
      }
    });

    const contentType = response.headers.get("content-type") || "";
    const isM3U8 = contentType.includes("mpegurl") || targetUrl.includes(".m3u8");

    // 如果是 m3u8 索引表，改写里面的分片链接为走当前代理
    if (isM3U8) {
      let text = await response.text();
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

      const modifiedLines = text.split("\n").map(line => {
        const trimmed = line.trim();
        // 忽略注释与空行
        if (!trimmed || trimmed.startsWith("#")) {
          // 处理带有 URI 的标签（如加密密钥或备用音轨）
          return line.replace(/URI="([^"]+)"/g, (match, p1) => {
            const abs = p1.startsWith("http") ? p1 : new URL(p1, baseUrl).href;
            return `URI="/proxy?url=${encodeURIComponent(abs)}"`;
          });
        }
        // 将绝对或相对路径的 ts 分片全部重写为走代理
        const fullTsUrl = trimmed.startsWith("http") ? trimmed : new URL(trimmed, baseUrl).href;
        return `/proxy?url=${encodeURIComponent(fullTsUrl)}`;
      });

      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.set("Access-Control-Allow-Headers", "*");
      newHeaders.set("Content-Type", "application/vnd.apple.mpegurl");

      return new Response(modifiedLines.join("\n"), {
        status: response.status,
        headers: newHeaders
      });
    }

    // 视频分片流(.ts)或其他数据直接透传，并补充跨域头
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
