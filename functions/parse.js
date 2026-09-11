// Pages Function: /parse —— 解析 B站 / YouTube / 直链
// 部署到 Cloudflare Pages 后自动运行：https://你的项目.pages.dev/parse?url=...
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type, Cache-Control',
}
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json;charset=utf-8' },
  })
}

export async function onRequest(context) {
  const { request } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }
  const url = new URL(request.url)
  const page = url.searchParams.get('url') || ''
  try {
    if (/bilibili\.com|b23\.tv/i.test(page)) return await parseBilibili(page)
    if (/youtu\.?be/i.test(page)) return await parseYoutube(page)
    if (/\.(mp4|webm|m3u8|m4v|mov)(\?|$)/i.test(page)) {
      return json({
        ok: true,
        title: '',
        videoUrl: '/proxy?u=' + encodeURIComponent(page),
        sentences: [],
        hint: 'direct',
      })
    }
    return json({ ok: false, error: '暂不支持该链接，请使用 B站 / YouTube 链接，或直接粘贴 MP4 / m3u8 直链' })
  } catch (e) {
    return json({ ok: false, error: '解析失败: ' + e.message })
  }
}

// ---------------- B站 ----------------
async function parseBilibili(page) {
  const bvid = (page.match(/BV[0-9A-Za-z]{10}/) || [])[0]
  if (!bvid) return json({ ok: false, error: '未识别到 BV 号' })

  const bHeaders = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' }

  const viewR = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { headers: bHeaders })
  const view = await viewR.json()
  if (view.code !== 0) return json({ ok: false, error: '获取视频信息失败: ' + (view.message || 'code ' + view.code) })
  const cid = view.data.cid
  const title = view.data.title || ''

  const playR = await fetch(
    `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=32&fnval=16&platform=html5&high_quality=1`,
    { headers: bHeaders },
  )
  const play = await playR.json()
  let rawUrl = null
  if (play.code === 0 && play.data && play.data.durl && play.data.durl[0] && play.data.durl[0].url) {
    rawUrl = play.data.durl[0].url
  }
  if (!rawUrl) {
    return json({ ok: false, error: '获取播放地址失败（该视频可能需登录/会员，或接口变动），建议改用直链导入', title })
  }
  const videoUrl = '/proxy?u=' + encodeURIComponent(rawUrl) + '&ref=' + encodeURIComponent('https://www.bilibili.com/')

  let sentences = []
  try {
    const subR = await fetch(`https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${cid}`, { headers: bHeaders })
    const sub = await subR.json()
    const subs = (sub.data && sub.data.subtitle && sub.data.subtitle.subtitles) || []
    const pick =
      subs.find(s => /zh|cn/i.test(s.lan)) ||
      subs.find(s => /ru/i.test(s.lan)) ||
      subs[0]
    if (pick && pick.url) {
      const bodyR = await fetch(pick.url, { headers: bHeaders })
      const body = await bodyR.json()
      if (Array.isArray(body.body)) {
        sentences = body.body
          .filter(x => x.content && x.content.trim())
          .map(x => ({
            start: Math.max(0, x.from || 0),
            end: Math.max(0, x.to || x.from || 0) + 0.3,
            text: x.content.trim().replace(/\{.*?\}/g, ''),
          }))
      }
    }
  } catch (e) { /* 字幕失败不影响视频 */ }

  return json({ ok: true, title, videoUrl, sentences, hint: sentences.length ? 'subs' : 'no-subs' })
}

// ---------------- YouTube ----------------
async function parseYoutube(page) {
  const m = page.match(/[?&]v=([\w-]{11})/) || page.match(/youtu\.be\/([\w-]{11})/) || []
  const vid = m[1]
  if (!vid) return json({ ok: false, error: '未识别到 YouTube 视频 ID' })

  const key = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'
  const body = {
    context: { client: { clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 30 } },
    videoId: vid,
  }
  const r = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  const title = (j.videoDetails && j.videoDetails.title) || ''

  let rawUrl = null
  const fmts = [
    ...((j.streamingData && j.streamingData.formats) || []),
    ...((j.streamingData && j.streamingData.adaptiveFormats) || []),
  ]
  const pick =
    fmts.find(f => f.itag === 18) ||
    fmts.find(f => f.itag === 22) ||
    fmts.find(f => f.itag === 137) ||
    fmts.find(f => f.itag === 136)
  if (pick && pick.url) rawUrl = pick.url
  if (!rawUrl && j.streamingData && j.streamingData.formats && j.streamingData.formats[0]) {
    rawUrl = j.streamingData.formats[0].url
  }
  if (!rawUrl) {
    return json({ ok: false, error: '获取 YouTube 播放地址失败（可能需要代理），建议改用直链导入', title })
  }
  const videoUrl = '/proxy?u=' + encodeURIComponent(rawUrl)

  let sentences = []
  try {
    const caps = (j.captions && j.captions.playerCaptionsTracklistRenderer && j.captions.playerCaptionsTracklistRenderer.captionTracks) || []
    const pick2 =
      caps.find(c => /^ru/i.test(c.languageCode)) ||
      caps.find(c => /^zh/i.test(c.languageCode)) ||
      caps[0]
    if (pick2 && pick2.baseUrl) {
      const sr = await fetch(pick2.baseUrl + '&fmt=json3', { headers: { 'User-Agent': UA } })
      const sj = await sr.json()
      const ev = sj.events || []
      sentences = ev
        .filter(e => e.segs && e.segs.length)
        .map(e => ({
          start: Math.max(0, (e.tStartMs || 0) / 1000),
          end: ((e.tStartMs || 0) + (e.dDurationMs || 2000)) / 1000,
          text: e.segs.map(s => s.utf8 || '').join('').trim(),
        }))
        .filter(s => s.text)
    }
  } catch (e) { /* 字幕失败不影响视频 */ }

  return json({ ok: true, title, videoUrl, sentences, hint: sentences.length ? 'subs' : 'no-subs' })
}
