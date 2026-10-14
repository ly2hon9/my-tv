export default async function handler(req, res) {
  // 注入全开放跨域响应头，彻底破除浏览器限制
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, proxy_url } = req.query;

  // 代理转发：解决 M3U 直播源、HTTP 混合内容及跨域切片拦截
  if (action === 'proxy' && proxy_url) {
    try {
      const response = await fetch(decodeURIComponent(proxy_url), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const data = await response.text();
      res.setHeader('Content-Type', response.headers.get('content-type') || 'text/plain; charset=utf-8');
      return res.status(200).send(data);
    } catch (err) {
      return res.status(500).json({ error: '代理请求失败: ' + err.message });
    }
  }

  return res.status(200).json({ status: 'ok' });
}
