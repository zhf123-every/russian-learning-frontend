// Pages Function: /proxy —— 通用资源代理（视频/字幕）
// 部署到 Cloudflare Pages 后自动运行：https://你的项目.pages.dev/proxy?u=...
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type, Cache-Control',
}
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function onRequest(context) {
  const { request } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }
  const url = new URL(request.url)
  const target = url.searchParams.get('u')
  const ref = url.searchParams.get('ref') || ''
  if (!target) {
    return new Response(JSON.stringify({ ok: false, error: '缺少参数 u' }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json;charset=utf-8' },
    })
  }
  try {
    const headers = {
      'User-Agent': UA,
      Accept: '*/*',
      'Accept-Language': 'ru-RU,zh-CN,en;q=0.8',
    }
    if (ref) headers['Referer'] = ref
    const range = request.headers.get('Range')
    if (range) headers['Range'] = range

    const resp = await fetch(target, { headers })
    const out = new Response(resp.body, { status: resp.status, statusText: resp.statusText })
    const h = new Headers(CORS)
    for (const k of [
      'Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges',
      'Cache-Control', 'ETag', 'Last-Modified',
    ]) {
      const v = resp.headers.get(k)
      if (v) h.set(k, v)
    }
    out.headers = h
    return out
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: '代理请求失败: ' + e.message }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json;charset=utf-8' },
    })
  }
}
