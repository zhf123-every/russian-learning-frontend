// Wukong3D.jsx —— 悟空 AI 助手的"精致 3D"版
// 形象：AI 渲染的精致悟空立像（站立/蹬棒腾空/招手）+ 精致筋斗云，全抠图透明 webp
// 场景：真 3D（Three.js）—— 精致云（静止底座）+ 立像在 3D 空间做动作
// 动作：待机呼吸浮动 → 蹬棒腾跃（抛物线跳跃，棒随悟空一起）→ 落地待机 → 招手
// 皮肤：props.skin 指定皮肤 id（默认 default），素材从 petSkins 注册表读取；
//       仅皮肤切换才重建场景（useEffect 依赖 [skin]），拖拽 paused 只暂停动画不重建
// 质感：RoomEnvironment 环境光照（立像图自带光影 + 环境氛围）
// props: paused —— 拖拽期间暂停动画；skin —— 皮肤 id
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { resolveSkin } from '../../lib/petSkins'

const STAND_URL = '/images/ai-assistant/wukong-stand.webp'   // 精致站立立像
const HOP_URL   = '/images/ai-assistant/wukong-hop.webp'     // 蹬棒腾空立像（金箍棒踩在脚下）
const CLOUD_URL = '/images/ai-assistant/cloud-fine.webp'     // 精致筋斗云立像（毛绒蓬松质感）
const WAVE_BASE_URLS = [
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
      // 贴图 alpha 已二值化（无半透明边缘）；禁用 mipmap 缩小采样，
      // 防止小画布缩放时边缘像素与透明区重新混合泛黄/切割
      tex.generateMipmaps = false
      tex.minFilter = THREE.LinearFilter
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
// 贴图已做边缘硬化（PIL 去除残影环），alphaTest=0 保留柔和毛发边缘，无边框切割痕
function makeSprite(url, height, ratio) {
  const loader = new THREE.TextureLoader()
  const mat = new THREE.MeshBasicMaterial({
    map: null, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0,
  })
  loadTexWithRetry(loader, url, mat, 0)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(height * ratio, height), mat)
  return { mesh, mat }
}

export default function Wukong3D({ paused = false, skin = 'default' }) {
  const mountRef = useRef(null)
  // 场景只在皮肤变化时重建；paused 用 ref 读取，
  // 拖拽时只暂停/恢复动画，绝不销毁重建场景（否则贴图重载期间悟空消失、多次拖拽叠加多份 canvas）
  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const skinCfg = resolveSkin(skin)
    const STAND_URL = skinCfg.assets.stand
    const HOP_URL = skinCfg.assets.hop
    const CLOUD_URL = skinCfg.assets.cloud
    const WAVE_URLS = skinCfg.assets.waves || WAVE_BASE_URLS

    const W = 288
    const H = 288

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100)
    camera.position.set(0, 1.1, 6.0)
    camera.lookAt(0, 1.0, 0)

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

    // 精致筋斗云立像（AI 渲染毛绒蓬松质感）
    // 悟空脚底对齐云图 33% 处（云的蓬松上表面内部）+ 云前移到悟空脚前（z=0.2）
    // → 云的上部凸起真实遮挡悟空脚部，视觉上"脚陷进云里、站在云上面"
    const CLOUD_TOP = 0.10
    const CLOUD_ASPECT = 1.565                // 云主体宽/高（抠图实测）
    const CLOUD_STAND_RATIO = 0.33            // 悟空脚底对齐点在贴图中的比例（云上表面内部）
    const CLOUD_W = 2.1                       // 云宽（世界单位）
    const CLOUD_H = CLOUD_W / CLOUD_ASPECT    // 云高
    const cloud = makeSprite(CLOUD_URL, CLOUD_H, CLOUD_ASPECT)
    // 脚底对齐点固定在 y=CLOUD_TOP：云中心 y = CLOUD_TOP + (0.5 - standRatio) * 高
    cloud.mesh.position.y = CLOUD_TOP + (0.5 - CLOUD_STAND_RATIO) * CLOUD_H
    cloud.mesh.position.z = 0.2               // 云前移：上部在悟空脚前，形成踩入遮挡
    scene.add(cloud.mesh)

    // 立像底部对齐云上表面（y=CLOUD_TOP），悟空/云整体构图居中（头顶完整展示，不裁切）
    const STAND_H = 2.5
    const HOP_H = 2.55
    const WAVE_H = 2.5
    const stand = makeSprite(STAND_URL, STAND_H, 0.62)
    const hop = makeSprite(HOP_URL, HOP_H, 0.54)
    const waves = WAVE_URLS.map((u) => makeSprite(u, WAVE_H, 0.62))

    const wukong = new THREE.Group()
    wukong.add(stand.mesh, hop.mesh, ...waves.map((w) => w.mesh))
    // 立像中心 = 云上表面 + 半高（保证底部贴云）
    stand.mesh.position.y = CLOUD_TOP + STAND_H / 2
    hop.mesh.position.y = CLOUD_TOP + HOP_H / 2
    waves.forEach((w) => { w.mesh.position.y = CLOUD_TOP + WAVE_H / 2 })
    scene.add(wukong)

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

    // 调试句柄（便于浏览器侧验证动画状态）
    window.__wukongDebug = {
      getState: () => ({
        rx: Number(wukong.rotation.x.toFixed(3)),
        y: Number(wukong.position.y.toFixed(3)),
        acc: Number(acc.toFixed(2)),
        stand: stand.mesh.visible,
        hop: hop.mesh.visible,
        waves: waves.map((w) => w.mesh.visible),
      }),
    }

    const iv = setInterval(() => {
      if (pausedRef.current) {
        renderer.render(scene, camera)
        return
      }
      acc += STEP
      const t = acc % CYCLE

      // 贴图未就绪（网络加载中）：保持静态渲染，避免悟空透明/悬空/闪变
      if (stand.mat.opacity < 1 || cloud.mat.opacity < 1) {
        show(0)
        wukong.rotation.x = 0
        wukong.position.y = 0
        stand.mesh.scale.set(1, 1, 1)
        renderer.render(scene, camera)
        return
      }

      if (t < HOP_AT) {
        // ---- 待机：站立立像 + 呼吸浮动 ----
        show(0)
        wukong.rotation.x = 0
        wukong.position.y = Math.sin(t * 2.1) * 0.06
        const breath = 1 + Math.sin(t * 3.2) * 0.015
        stand.mesh.scale.set(breath, breath, 1)
      } else if (t < HOP_AT + HOP_LEN) {
        // ---- 蹬棒腾跃：蹬棒立像抛物线跳起-空中-落下 ----
        if (hop.mat.opacity < 1) {
          // 蹬棒贴图未就绪：回退为站立待机
          show(0)
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
        wukong.position.y = hv * 0.45         // 腾空高度（压低，保证头顶完整展示）
        hop.mesh.scale.set(1 - hv * 0.15, 1 - hv * 0.15, 1)  // 跳起缩小（透视远+防裁切），落地恢复
      } else if (t < HOP_AT + HOP_LEN + 1.5) {
        // ---- 落地待机 ----
        show(0)
        wukong.rotation.x = 0
        wukong.position.y = Math.sin((t - HOP_AT - HOP_LEN) * 2.1) * 0.06
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
  }, [skin])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
