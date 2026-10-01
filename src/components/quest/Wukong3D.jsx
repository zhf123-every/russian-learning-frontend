// Wukong3D.jsx —— 悟空 AI 助手的"精致 3D"版
// 形象：AI 渲染的精致悟空立像（站立/蹬棒腾空/招手）+ 精致筋斗云，全抠图透明 webp
// 场景：真 3D（Three.js）—— 精致云（静止底座）+ 立像在 3D 空间做动作
// 动作：待机呼吸浮动 → 蹬棒腾跃（抛物线跳跃，棒随悟空一起）→ 落地待机 → 招手
// 落地感：立像下方有软阴影，跳起时阴影同步缩小变淡（实物感，去"图片痕迹"）
// 质感：RoomEnvironment 环境光照（立像图自带光影 + 环境氛围）
// props: paused —— 拖拽期间暂停动画
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const STAND_URL = '/images/ai-assistant/wukong-stand.webp'   // 精致站立立像
const HOP_URL   = '/images/ai-assistant/wukong-hop.webp'     // 蹬棒腾空立像（金箍棒踩在脚下）
const CLOUD_URL = '/images/ai-assistant/cloud-fine.webp'     // 精致筋斗云立像（毛绒蓬松质感）
const WAVE_URLS = [
  '/images/ai-assistant/wave-1.webp',
  '/images/ai-assistant/wave-2.webp',
  '/images/ai-assistant/wave-3.webp',
  '/images/ai-assistant/wave-4.webp',
]

// 贴图加载（带失败重试：网络抖动时回调不触发，opacity 卡 0 会导致立像/球不可见）
function loadTexWithRetry(loader, url, mat, tries) {
  loader.load(
    url,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      mat.map = tex
      mat.opacity = 1
    },
    undefined,
    () => {
      if (tries < 4) setTimeout(() => loadTexWithRetry(loader, url, mat, tries + 1), 350)
    }
  )
}

// 立像 plane（贴图原样显示：MeshBasicMaterial，保留 AI 渲染光影；贴图加载完成前透明，防止闪白）
// alphaTest 硬裁剪半透明边缘，去掉透明卡片边框残影
function makeSprite(url, height, ratio) {
  const loader = new THREE.TextureLoader()
  const mat = new THREE.MeshBasicMaterial({
    map: null, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0,
    alphaTest: 0.05,
  })
  loadTexWithRetry(loader, url, mat, 0)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(height * ratio, height), mat)
  return { mesh, mat }
}

export default function Wukong3D({ paused = false }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const W = 184
    const H = 184

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100)
    camera.position.set(0, 1.0, 5.8)
    camera.lookAt(0, 0.9, 0)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    mount.appendChild(renderer.domElement)

    // 环境光照（RoomEnvironment：云有体积光泽、立像周围有氛围）
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTex
    pmrem.dispose()

    // 灯光
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dir = new THREE.DirectionalLight(0xffffff, 1.0)
    dir.position.set(3, 5, 4)
    scene.add(dir)

    // 精致筋斗云立像（AI 渲染毛绒蓬松质感）—— 云顶约 y=0.15，悟空踩云顶
    const CLOUD_TOP = 0.15
    const CLOUD_ASPECT = 1.565                // 云主体宽/高（抠图实测）
    const CLOUD_TOP_RATIO = 0.215             // 云顶在贴图中距顶部的比例（抠图实测）
    const CLOUD_W = 2.0                       // 云宽（世界单位）
    const CLOUD_H = CLOUD_W / CLOUD_ASPECT    // 云高
    const cloud = makeSprite(CLOUD_URL, CLOUD_H, CLOUD_ASPECT)
    // 云顶对齐 CLOUD_TOP：云中心 y = CLOUD_TOP + (0.5 - topRatio) * 高
    cloud.mesh.position.y = CLOUD_TOP + (0.5 - CLOUD_TOP_RATIO) * CLOUD_H
    scene.add(cloud.mesh)

    // 立像底部对齐云顶（云顶约 y=0.15），悟空/云整体构图居中
    const STAND_H = 2.8
    const HOP_H = 2.9
    const WAVE_H = 2.8
    const stand = makeSprite(STAND_URL, STAND_H, 0.62)
    const hop = makeSprite(HOP_URL, HOP_H, 0.54)
    const waves = WAVE_URLS.map((u) => makeSprite(u, WAVE_H, 0.62))

    const wukong = new THREE.Group()
    wukong.add(stand.mesh, hop.mesh, ...waves.map((w) => w.mesh))
    // 立像中心 = 云顶 + 半高（保证底部贴云顶）
    stand.mesh.position.y = CLOUD_TOP + STAND_H / 2
    hop.mesh.position.y = CLOUD_TOP + HOP_H / 2
    waves.forEach((w) => { w.mesh.position.y = CLOUD_TOP + WAVE_H / 2 })
    scene.add(wukong)

    // 软阴影（云面上椭圆渐变，随立像腾跃同步缩小变淡 → 落地实物感）
    const shadowCv = document.createElement('canvas')
    shadowCv.width = 128
    shadowCv.height = 64
    const sctx = shadowCv.getContext('2d')
    const sg = sctx.createRadialGradient(64, 32, 4, 64, 32, 60)
    sg.addColorStop(0, 'rgba(0,0,0,0.36)')
    sg.addColorStop(0.6, 'rgba(0,0,0,0.2)')
    sg.addColorStop(1, 'rgba(0,0,0,0)')
    sctx.fillStyle = sg
    sctx.fillRect(0, 0, 128, 64)
    const shadowTex = new THREE.CanvasTexture(shadowCv)
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.85 })
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), shadowMat)
    shadow.position.set(0, CLOUD_TOP + 0.02, 0.18)
    scene.add(shadow)

    // ---- 动画：setInterval 驱动（自维护时钟，暂停不累计） ----
    const STEP = 1 / 60
    let acc = 0
    const CYCLE = 10.0
    const HOP_AT = 1.8
    const HOP_LEN = 2.16
    const WAVE_AT = 5.4
    const WAVE_LEN = 1.08

    const show = (idx) => {
      // 0=stand 1=hop 2..5=wave
      stand.mesh.visible = idx === 0
      hop.mesh.visible = idx === 1
      waves.forEach((w, i) => { w.mesh.visible = idx === 2 + i })
    }

    const shadowReset = () => {
      shadow.scale.set(1, 1, 1)
      shadowMat.opacity = 0.85
    }

    // 调试句柄（便于浏览器侧验证动画状态）
    window.__wukongDebug = {
      getState: () => ({
        rx: Number(wukong.rotation.x.toFixed(3)),
        y: Number(wukong.position.y.toFixed(3)),
        acc: Number(acc.toFixed(2)),
        stand: stand.mesh.visible,
        hop: hop.mesh.visible,
        shadow: Number(shadowMat.opacity.toFixed(2)),
        waves: waves.map((w) => w.mesh.visible),
      }),
    }

    const iv = setInterval(() => {
      if (paused) {
        renderer.render(scene, camera)
        return
      }
      acc += STEP
      const t = acc % CYCLE

      // 贴图未就绪（网络加载中）：保持静态渲染，避免悟空透明/悬空/闪变
      if (stand.mat.opacity < 1 || cloud.mat.opacity < 1) {
        show(0)
        shadowReset()
        wukong.rotation.x = 0
        wukong.position.y = 0
        stand.mesh.scale.set(1, 1, 1)
        renderer.render(scene, camera)
        return
      }

      if (t < HOP_AT) {
        // ---- 待机：站立立像 + 呼吸浮动 ----
        show(0)
        shadowReset()
        wukong.rotation.x = 0
        wukong.position.y = Math.sin(t * 2.1) * 0.06
        const breath = 1 + Math.sin(t * 3.2) * 0.015
        stand.mesh.scale.set(breath, breath, 1)
      } else if (t < HOP_AT + HOP_LEN) {
        // ---- 蹬棒腾跃：蹬棒立像抛物线跳起-空中-落下，阴影同步缩小变淡 ----
        if (hop.mat.opacity < 1) {
          // 蹬棒贴图未就绪：回退为站立待机
          show(0)
          shadowReset()
          wukong.rotation.x = 0
          wukong.position.y = Math.sin(t * 2.1) * 0.06
          stand.mesh.scale.set(1, 1, 1)
          renderer.render(scene, camera)
          return
        }
        const k = (t - HOP_AT) / HOP_LEN
        const hv = Math.sin(k * Math.PI)      // 0→1→0 抛物线
        show(1)
        wukong.rotation.x = -hv * 0.12        // 跳起微前倾（蹬棒跃姿）
        wukong.position.y = hv * 0.9          // 腾空高度
        hop.mesh.scale.set(1 + hv * 0.05, 1 - hv * 0.05, 1)
        shadow.scale.set(1 - hv * 0.4, 1 - hv * 0.4, 1)
        shadowMat.opacity = 0.85 - hv * 0.55
      } else if (t < HOP_AT + HOP_LEN + 1.5) {
        // ---- 落地待机 ----
        show(0)
        shadowReset()
        wukong.rotation.x = 0
        wukong.position.y = Math.sin((t - HOP_AT - HOP_LEN) * 2.1) * 0.06
        stand.mesh.scale.set(1, 1, 1)
      } else if (t < WAVE_AT + WAVE_LEN) {
        // ---- 招手：依次切招手帧 ----
        const wt = t - WAVE_AT
        const idx = Math.min(3, Math.floor(wt / 0.27))
        show(2 + idx)
        shadowReset()
        wukong.rotation.x = 0
        wukong.position.y = Math.sin(t * 2.1) * 0.06
      } else {
        // ---- 待机收尾 ----
        show(0)
        shadowReset()
        wukong.rotation.x = 0
        wukong.position.y = Math.sin(t * 2.1) * 0.06
        stand.mesh.scale.set(1, 1, 1)
      }

      renderer.render(scene, camera)
    }, 16)

    return () => {
      clearInterval(iv)
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
          else o.material.dispose()
        }
      })
    }
  }, [paused])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
