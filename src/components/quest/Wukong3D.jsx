// Wukong3D.jsx —— 悟空 AI 助手的"精致 3D"版
// 形象：AI 渲染的精致悟空立像（站立/团身/招手，抠图透明 webp）
// 场景：真 3D（Three.js）—— 3D 筋斗云（静止底座）+ 立像在 3D 空间做动作
// 动作全在 3D 空间：后空翻 = 绕 X 轴向后整圈（真 3D 透视，近大远小）+ 抛物线位移 + 90°-270° 切团身图
// 质感：RoomEnvironment 环境光照（立像图自带光影 + 3D 云有体积光泽）
// props: paused —— 拖拽期间暂停动画
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const STAND_URL = '/images/ai-assistant/wukong-stand.webp'   // 精致站立立像
const TUCK_URL  = '/images/ai-assistant/wukong-tuck.webp'    // 精致空中团身立像
const WAVE_URLS = [
  '/images/ai-assistant/wave-1.webp',
  '/images/ai-assistant/wave-2.webp',
  '/images/ai-assistant/wave-3.webp',
  '/images/ai-assistant/wave-4.webp',
]

// 3D 筋斗云（静止底座，多层云瓣）
function buildCloud() {
  const cloud = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.92, roughness: 0.8, metalness: 0,
  })
  const blob = (x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 20), mat)
    m.scale.set(sx, sy, sz)
    m.position.set(x, y, z)
    cloud.add(m)
  }
  blob(0, 0, 0, 1.2, 0.34, 0.76)
  blob(-0.76, -0.07, 0.06, 0.6, 0.26, 0.52)
  blob(0.76, -0.07, -0.02, 0.6, 0.26, 0.52)
  blob(0, 0.06, -0.26, 0.78, 0.22, 0.44)
  blob(-0.34, 0.1, 0.22, 0.5, 0.2, 0.4)
  blob(0.36, 0.09, 0.2, 0.46, 0.19, 0.36)
  blob(-0.15, 0.12, -0.05, 0.55, 0.18, 0.3)
  return cloud
}

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
function makeSprite(url, height, ratio) {
  const loader = new THREE.TextureLoader()
  const mat = new THREE.MeshBasicMaterial({
    map: null, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0,
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

    // 3D 云 + 悟空（站立立像/团身3D球/招手立像）
    const cloud = buildCloud()
    scene.add(cloud)

    // 立像底部对齐云顶（云顶约 y=0.15），悟空/云整体构图居中
    const CLOUD_TOP = 0.15
    const STAND_H = 2.8
    const TUCK_R = 0.85
    const WAVE_H = 2.8
    const stand = makeSprite(STAND_URL, STAND_H, 0.62)
    const waves = WAVE_URLS.map((u) => makeSprite(u, WAVE_H, 0.62))

    // 团身 = 真 3D 球体（tuck 立像贴球面）：球任意角度投影都是圆 + 受光有明暗 → 彻底消除纸片感
    // envMapIntensity=0 关闭环境反射（RoomEnvironment 反射会把透明区域渲染成白雾）；alphaTest 硬裁剪透明边缘
    const tuckLoader = new THREE.TextureLoader()
    const tuckMat = new THREE.MeshStandardMaterial({
      map: null, transparent: true, roughness: 0.6, metalness: 0.05, opacity: 0,
      envMapIntensity: 0, alphaTest: 0.05,
    })
    loadTexWithRetry(tuckLoader, TUCK_URL, tuckMat, 0)
    const tuckBall = new THREE.Mesh(new THREE.SphereGeometry(TUCK_R, 48, 32), tuckMat)

    const wukong = new THREE.Group()
    wukong.add(stand.mesh, tuckBall, ...waves.map((w) => w.mesh))
    // 立像中心 = 云顶 + 半高（保证底部贴云顶）；团身球中心 = 云顶 + 半径
    stand.mesh.position.y = CLOUD_TOP + STAND_H / 2
    tuckBall.position.y = CLOUD_TOP + TUCK_R
    waves.forEach((w) => { w.mesh.position.y = CLOUD_TOP + WAVE_H / 2 })
    scene.add(wukong)

    // ---- 动画：setInterval 驱动（自维护时钟，暂停不累计） ----
    const STEP = 1 / 60
    let acc = 0
    const CYCLE = 10.0
    const FLIP_AT = 1.8
    const FLIP_LEN = 2.16
    const WAVE_AT = 5.4
    const WAVE_LEN = 1.08

    const show = (idx) => {
      // 0=stand 1=tuckBall 2..5=wave
      stand.mesh.visible = idx === 0
      tuckBall.visible = idx === 1
      waves.forEach((w, i) => { w.mesh.visible = idx === 2 + i })
    }

    // 调试句柄（便于浏览器侧验证动画状态）
    window.__wukongDebug = {
      getState: () => ({
        rx: Number(wukong.rotation.x.toFixed(3)),
        y: Number(wukong.position.y.toFixed(3)),
        acc: Number(acc.toFixed(2)),
        stand: stand.mesh.visible,
        tuckBall: tuckBall.visible,
        ballRx: Number(tuckBall.rotation.x.toFixed(3)),
        tuckLoaded: !!(tuckMat.map && tuckMat.map.image),
        tuckOpacity: Number(tuckMat.opacity.toFixed(2)),
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

      if (t < FLIP_AT) {
        // ---- 待机：站立立像 + 呼吸浮动 ----
        show(0)
        wukong.rotation.x = 0
        wukong.position.y = Math.sin(t * 2.1) * 0.06
        const breath = 1 + Math.sin(t * 3.2) * 0.015
        stand.mesh.scale.set(breath, breath, 1)
      } else if (t < FLIP_AT + FLIP_LEN) {
        // ---- 后空翻：起跳即团身成 3D 球 → 球向后翻滚整圈（真3D体积，无纸片感）+ 抛物线 ----
        if (tuckMat.opacity < 1) {
          // 团身贴图未就绪（网络加载中）：保持站立等待，就绪后的周期再翻
          show(0)
          wukong.rotation.x = 0
          wukong.position.y = Math.sin(t * 2.1) * 0.06
          stand.mesh.scale.set(1, 1, 1)
          renderer.render(scene, camera)
          return
        }
        const k = (t - FLIP_AT) / FLIP_LEN
        const angle = k * Math.PI * 2
        show(1)
        tuckBall.rotation.x = -angle
        tuckBall.rotation.z = -angle * 0.18
        wukong.rotation.x = 0
        wukong.position.y = Math.sin(angle / 2) * 1.5
      } else if (t < FLIP_AT + FLIP_LEN + 1.5) {
        // ---- 落地待机 ----
        show(0)
        wukong.rotation.x = 0
        wukong.position.y = Math.sin((t - FLIP_AT - FLIP_LEN) * 2.1) * 0.06
        stand.mesh.scale.set(1, 1, 1)
      } else if (t < WAVE_AT + WAVE_LEN) {
        // ---- 招手：依次切招手帧 ----
        const wt = t - WAVE_AT
        const idx = Math.min(3, Math.floor(wt / 0.27))
        show(2 + idx)
        wukong.rotation.x = 0
        wukong.position.y = Math.sin(t * 2.1) * 0.06
      } else {
        // ---- 待机收尾 ----
        show(0)
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
