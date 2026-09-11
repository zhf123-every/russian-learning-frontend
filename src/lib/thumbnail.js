// 视频缩略图生成工具
// YouTube：用官方缩略图接口 img.youtube.com（无需加载视频）
// 其他 mp4 直链：加载视频元素 → 跳转时间点 → canvas 截帧 → dataURL

export function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

export function isYouTube(url) {
  return !!getYouTubeId(url)
}

export function youtubeThumb(url) {
  const id = getYouTubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

// 通用视频缩略图（mp4 直链等）：异步加载视频并截帧
// 返回 dataURL（jpeg），失败或超时返回 ''
export function generateVideoThumbnail(videoUrl, seekTo = 1) {
  return new Promise(resolve => {
    const yt = youtubeThumb(videoUrl)
    if (yt) { resolve(yt); return }

    if (!videoUrl) { resolve(''); return }

    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'   // 先按跨域处理，失败再重试不带 crossOrigin
    let settled = false
    let retry = false

    const finish = url => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { video.removeAttribute('src'); video.load() } catch (e) {}
      resolve(url)
    }

    const timer = setTimeout(() => finish(''), 9000)

    const doSeek = () => {
      try { video.currentTime = seekTo } catch (e) { finish('') }
    }

    video.onloadeddata = doSeek
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 480
        canvas.height = 270
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, 480, 270)
        finish(canvas.toDataURL('image/jpeg', 0.8))
      } catch (e) {
        finish('')
      }
    }
    video.onerror = () => {
      // 跨域加载失败时，去掉 crossOrigin 重试一次（同域/无限制视频可截）
      if (!retry) {
        retry = true
        video.removeAttribute('crossOrigin')
        video.load()
      } else {
        finish('')
      }
    }

    video.src = videoUrl
    video.load()
  })
}

// 时长格式化：秒 → mm:ss（无时间戳返回 '—'）
export function formatDuration(material) {
  const sents = material.sentences || []
  let last = 0
  for (const s of sents) {
    if (typeof s.end === 'number' && s.end > last) last = s.end
  }
  if (!last) return material.duration || '—'
  const m = Math.floor(last / 60)
  const s = Math.floor(last % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// 日期格式化：时间戳 → YYYY/MM/DD
export function formatDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '—'
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`
}
