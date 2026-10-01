// Wukong3D.jsx —— 悟空 AI 助手的"真 3D"版（Three.js 程序化建模 + 程序化 PBR 纹理）
// 质感升级：Canvas 程序化纹理（脸部五官/虎皮条纹/金箍纹）+ RoomEnvironment 环境光照贴图（PBR 反射高光）
// 结构：3D 筋斗云（静止底座）+ 3D 悟空（金毛头/金箍/虎皮裙/四肢/金箍棒）
// 动画全部在 3D 空间完成（setInterval 自维护时钟）：
//   待机(呼吸浮动) → 后空翻(绕X轴向后整圈 + 抛物线 + 空中团身收腿) → 待机 → 招手(手臂摆动) → 回绕
// props: paused —— 拖拽期间暂停动画
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// ---- 配色 ----
const C = {
  fur: 0xf5b83d, furDark: 0xd98e1f, skin: 0xffcf9e, blush: 0xff9d9d,
  band: 0xffcc33, cloth: 0x8b4513, clothDark: 0x3d2314, scarf: 0xd52b2b,
  guard: 0x262626, staff: 0xcc2222, boot: 0xd9a441, cloud: 0xffffff,
}

// ---- 程序化纹理 ----
function canvasTexture(w, h, draw) {
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  draw(cv.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(cv)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// 脸部贴图：肤色 + 大眼睛（高光）+ 眉毛 + 小嘴（透明背景，径向渐晕融入金毛头）
function makeFaceTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    const cx = w / 2, cy = h / 2
    // 肤色椭圆底（径向渐晕）
    const grad = ctx.createRadialGradient(cx, cy, 60, cx, cy, 240)
    grad.addColorStop(0, '#ffcf9e')
    grad.addColorStop(0.7, '#ffc38d')
    grad.addColorStop(1, 'rgba(255,195,141,0)')
    ctx.fillStyle = grad
    ctx.beginPath(); ctx.ellipse(cx, cy, 205, 215, 0, 0, Math.PI * 2); ctx.fill()
    // 腮红
    const blush = (x) => {
      const g = ctx.createRadialGradient(x, cy + 66, 6, x, cy + 66, 52)
      g.addColorStop(0, 'rgba(255,140,140,0.85)')
      g.addColorStop(1, 'rgba(255,140,140,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(x, cy + 66, 52, 0, Math.PI * 2); ctx.fill()
    }
    blush(cx - 118); blush(cx + 118)
    // 眼睛（大圆眼 + 瞳孔 + 高光）
    const eye = (x) => {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.ellipse(x, cy - 36, 52, 62, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#241d18'
      ctx.beginPath(); ctx.ellipse(x, cy - 30, 26, 34, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(x - 7, cy - 46, 9, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(x + 8, cy - 22, 5, 0, Math.PI * 2); ctx.fill()
      // 眼线
      ctx.strokeStyle = '#241d18'; ctx.lineWidth = 6
      ctx.beginPath(); ctx.ellipse(x, cy - 36, 54, 64, 0, Math.PI, Math.PI * 2); ctx.stroke()
    }
    eye(cx - 96); eye(cx + 96)
    // 眉毛
    ctx.strokeStyle = '#7a4a21'; ctx.lineWidth = 10; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(cx - 138, cy - 118); ctx.quadraticCurveTo(cx - 96, cy - 132, cx - 56, cy - 116); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx + 138, cy - 118); ctx.quadraticCurveTo(cx + 96, cy - 132, cx + 56, cy - 116); ctx.stroke()
    // 嘴
    ctx.fillStyle = '#b04040'
    ctx.beginPath(); ctx.ellipse(cx, cy + 92, 34, 20, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#8a2c2c'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.arc(cx, cy + 84, 34, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke()
  })
}

// 虎皮裙条纹贴图（黑黄虎纹）
function makeSkirtTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8b4513'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#f0c040'
    for (let y = 0; y < h; y += 42) {
      ctx.fillRect(0, y, w, 20)
    }
    // 黑色虎纹（弯曲条纹）
    ctx.strokeStyle = '#2a1610'; ctx.lineWidth = 10; ctx.lineCap = 'round'
    for (let i = 0; i < 14; i++) {
      const x = (i * 37 + 13) % w
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.quadraticCurveTo(x + 14, h * 0.5, x - 8, h)
      ctx.stroke()
    }
  })
}

// 金箍/金属纹
function makeBandTexture() {
  return canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffcc33'
    ctx.fillRect(0, 0, w, h)
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.45, 'rgba(200,130,20,0.25)')
    g.addColorStop(1, 'rgba(120,70,10,0.5)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

// 金箍棒红金渐变 + 端环
function makeStaffTexture() {
  return canvasTexture(128, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0)
    g.addColorStop(0, '#a41616')
    g.addColorStop(0.5, '#e84a2a')
    g.addColorStop(1, '#a41616')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.fillRect(0, 0, w, 26)
    ctx.fillRect(0, h - 26, w, 26)
  })
}

function makeMaterial(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.05,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    map: opts.map || null,
  })
}

// 3D 悟空对象组（返回 { root, parts }，parts 供动画控制）
function buildWukong() {
  const root = new THREE.Group()
  const parts = {}
  const faceTex = makeFaceTexture()
  const skirtTex = makeSkirtTexture()
  const bandTex = makeBandTexture()
  const staffTex = makeStaffTexture()
  const furMat = makeMaterial(C.fur)
  const furMatDark = makeMaterial(C.furDark)
  const bandMat = makeMaterial(C.band, { metalness: 0.6, roughness: 0.28, map: bandTex })
  const bandMatTorus = makeMaterial(C.band, { metalness: 0.65, roughness: 0.25, map: bandTex })

  // ---- 头部 ----
  const head = new THREE.Group()
  const headBall = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 32), furMat)
  headBall.position.y = 1.28
  head.add(headBall)
  // 脸部（圆盘贴图：五官/腮红，渐晕融入）
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78), makeMaterial(0xffffff, { map: faceTex }))
  face.position.set(0, 1.24, 0.38)
  head.add(face)
  // 头毛尖（顶部一圈小锥）
  const spikeMat = makeMaterial(C.fur)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.35
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), spikeMat)
    spike.position.set(Math.cos(a) * 0.34, 1.8, Math.sin(a) * 0.34)
    spike.rotation.z = Math.cos(a) * 0.45
    spike.rotation.x = Math.sin(a) * 0.45
    head.add(spike)
  }
  // 金箍（环，金属纹）
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.062, 16, 48), bandMatTorus)
  band.position.y = 1.38
  band.rotation.x = Math.PI / 2
  head.add(band)
  // 耳朵
  const earMat = makeMaterial(C.fur)
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), earMat)
  earL.position.set(-0.47, 1.32, 0)
  earL.scale.set(0.85, 1.15, 0.7)
  const earR = earL.clone()
  earR.position.x = 0.47
  head.add(earL, earR)
  root.add(head)
  parts.head = head

  // ---- 身体（虎皮裙 + 上衣 + 红领巾） ----
  const body = new THREE.Group()
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.34, 12, 20), furMat)
  torso.position.y = 0.78
  body.add(torso)
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.36, 24, 1, true), makeMaterial(0xffffff, { map: skirtTex }))
  skirt.position.y = 0.5
  body.add(skirt)
  const skirtHem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 24), makeMaterial(C.clothDark))
  skirtHem.position.y = 0.34
  body.add(skirtHem)
  const scarf = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.28, 14), makeMaterial(C.scarf))
  scarf.position.set(0, 1.03, 0.32)
  scarf.rotation.x = Math.PI * 0.9
  body.add(scarf)
  root.add(body)
  parts.body = body

  // ---- 手臂（肩关节） ----
  const armGroup = new THREE.Group()
  const mkArm = (side) => {
    const g = new THREE.Group()
    const shoulder = new THREE.Group()
    shoulder.position.y = 0.95
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.3, 10, 16), furMat)
    arm.position.y = -0.25
    shoulder.add(arm)
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.13, 16), makeMaterial(C.guard))
    guard.position.y = -0.44
    shoulder.add(guard)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), makeMaterial(C.skin))
    hand.position.y = -0.5
    shoulder.add(hand)
    shoulder.position.x = side * 0.4
    g.add(shoulder)
    return { group: g, shoulder }
  }
  const armL = mkArm(-1)
  const armR = mkArm(1)
  armGroup.add(armL.group, armR.group)
  root.add(armGroup)
  parts.armL = armL.shoulder
  parts.armR = armR.shoulder

  // ---- 腿（髋关节） ----
  const legGroup = new THREE.Group()
  const mkLeg = (side) => {
    const g = new THREE.Group()
    const hip = new THREE.Group()
    hip.position.y = 0.36
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.26, 10, 16), furMat)
    leg.position.y = -0.26
    hip.add(leg)
    const boot = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12), makeMaterial(C.boot))
    boot.position.y = -0.5
    hip.add(boot)
    const bootTip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 8), makeMaterial(C.boot))
    bootTip.position.set(side * 0.13, -0.56, 0.02)
    bootTip.rotation.z = side * 0.5
    hip.add(bootTip)
    hip.position.x = side * 0.16
    g.add(hip)
    return { group: g, hip }
  }
  const legL = mkLeg(-1)
  const legR = mkLeg(1)
  legGroup.add(legL.group, legR.group)
  root.add(legGroup)
  parts.legL = legL.hip
  parts.legR = legR.hip

  // ---- 金箍棒（红金渐变 + 端环，斜挎背后） ----
  const staff = new THREE.Group()
  const staffBar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.9, 16), makeMaterial(0xffffff, { map: staffTex }))
  staffBar.rotation.z = Math.PI / 2
  staff.add(staffBar)
  const staffEndL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.13, 16), bandMat)
  staffEndL.position.x = -0.95
  staffEndL.rotation.z = Math.PI / 2
  const staffEndR = staffEndL.clone()
  staffEndR.position.x = 0.95
  staff.add(staffEndL, staffEndR)
  staff.position.set(0, 0.78, -0.52)
  staff.rotation.z = -0.5
  staff.rotation.y = 0.3
  root.add(staff)
  parts.staff = staff

  return { root, parts }
}

// 3D 筋斗云（静止底座，多层云瓣 + 底部渐变）
function buildCloud() {
  const cloud = new THREE.Group()
  const mat = makeMaterial(C.cloud, { transparent: true, opacity: 0.92, roughness: 0.8 })
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

export default function Wukong3D({ paused = false }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const W = 184
    const H = 184

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100)
    camera.position.set(0, 1.15, 5.6)
    camera.lookAt(0, 1.0, 0)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    mount.appendChild(renderer.domElement)

    // 环境光照贴图：RoomEnvironment（程序化环境，PBR 反射高光 → 精致金属/毛发光泽）
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTex
    pmrem.dispose()

    // 灯光
    scene.add(new THREE.AmbientLight(0xffffff, 0.65))
    const dir = new THREE.DirectionalLight(0xffffff, 1.1)
    dir.position.set(3, 5, 4)
    scene.add(dir)
    const rim = new THREE.DirectionalLight(0xffe6c0, 0.5)
    rim.position.set(-4, 2, -3)
    scene.add(rim)
    const fill = new THREE.DirectionalLight(0xbfd9ff, 0.35)
    fill.position.set(0, -2, 4)
    scene.add(fill)

    // 3D 悟空 + 3D 云
    const { root: wukong, parts } = buildWukong()
    const cloud = buildCloud()
    scene.add(wukong)
    scene.add(cloud)

    // ---- 动画：setInterval 驱动（自维护时钟，不依赖 rAF/CSS currentTime；暂停时不累计） ----
    const STEP = 1 / 60
    let acc = 0
    const CYCLE = 10.0
    const FLIP_AT = 1.8
    const FLIP_LEN = 2.16
    const WAVE_AT = 5.4
    const WAVE_LEN = 1.1

    const armIdle = { l: 0.12, r: -0.12 }

    const iv = setInterval(() => {
      if (paused) {
        renderer.render(scene, camera)
        return
      }
      acc += STEP
      const t = acc % CYCLE

      // ---- 默认姿态复位 ----
      const resetPose = () => {
        wukong.rotation.x = 0
        wukong.position.y = 0
        wukong.scale.set(1, 1, 1)
        parts.armL.rotation.z = armIdle.l
        parts.armR.rotation.z = armIdle.r
        parts.armL.rotation.x = 0
        parts.armR.rotation.x = 0
        parts.legL.rotation.x = 0
        parts.legR.rotation.x = 0
        parts.body.scale.set(1, 1, 1)
      }

      if (t < FLIP_AT) {
        // ---- 待机：呼吸浮动 ----
        resetPose()
        wukong.position.y = Math.sin(t * 2.1) * 0.045
        const breath = 1 + Math.sin(t * 3.2) * 0.015
        parts.body.scale.set(breath, breath, breath)
        parts.armL.rotation.z = armIdle.l + Math.sin(t * 2.1) * 0.03
        parts.armR.rotation.z = armIdle.r - Math.sin(t * 2.1) * 0.03
      } else if (t < FLIP_AT + FLIP_LEN) {
        // ---- 后空翻：绕 X 轴向后整圈 + 抛物线 + 空中团身 ----
        const k = (t - FLIP_AT) / FLIP_LEN
        const angle = k * Math.PI * 2
        wukong.rotation.x = -angle
        wukong.position.y = Math.sin(angle / 2) * 1.35
        const squat = Math.sin(Math.min(k, 0.18) / 0.18 * Math.PI) * 0.35
        parts.legL.rotation.x = squat
        parts.legR.rotation.x = squat
        const tuck = (angle > Math.PI * 0.45 && angle < Math.PI * 1.55) ? 1 : 0
        const tuckAmt = tuck * Math.sin((angle - Math.PI * 0.45) / (Math.PI * 1.1) * Math.PI)
        parts.legL.rotation.x = (1 - tuckAmt) * squat + tuckAmt * 1.35
        parts.legR.rotation.x = (1 - tuckAmt) * squat + tuckAmt * 1.35
        parts.armL.rotation.z = armIdle.l - tuckAmt * 1.5
        parts.armR.rotation.z = armIdle.r + tuckAmt * 1.5
        parts.armL.rotation.x = -tuckAmt * 0.7
        parts.armR.rotation.x = -tuckAmt * 0.7
        parts.body.scale.y = 1 - tuckAmt * 0.22
      } else if (t < FLIP_AT + FLIP_LEN + 1.5) {
        // ---- 落地待机 ----
        resetPose()
        wukong.position.y = Math.sin((t - FLIP_AT - FLIP_LEN) * 2.1) * 0.045
      } else if (t < WAVE_AT + WAVE_LEN) {
        // ---- 招手：右手挥动 ----
        resetPose()
        const wt = t - WAVE_AT
        const wA = Math.sin(wt * 9) * 0.5
        parts.armR.rotation.z = 0.9 + wA
        parts.armR.rotation.x = 0.5
        parts.armL.rotation.z = armIdle.l
      } else {
        resetPose()
        wukong.position.y = Math.sin(t * 2.1) * 0.045
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
