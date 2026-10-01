// Wukong3D.jsx —— 悟空 AI 助手的"真 3D"版（Three.js 程序化建模）
// 结构：3D 筋斗云（静止底座）+ 3D 悟空（Q 版几何体：金毛头/金箍/虎皮裙/四肢/金箍棒）
// 动画全部在 3D 空间完成（rAF 驱动，自己维护时钟，不依赖 CSS currentTime）：
//   待机(呼吸浮动) → 后空翻(整体绕X轴向后整圈 + 抛物线位移 + 空中团身收腿) → 待机 → 招手(手臂摆动) → 回绕
// props: paused —— 拖拽期间暂停动画
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// ---- 配色（对齐核心 IP 资产：金毛/金箍/红金棒/虎皮裙/红领巾/黑护腕护脚/腮红） ----
const C = {
  fur: 0xf5b83d,      // 金黄毛发
  furDark: 0xd98e1f,
  skin: 0xffcf9e,     // 脸
  blush: 0xff9d9d,    // 腮红
  band: 0xffcc33,     // 金箍/金环
  cloth: 0x8b4513,    // 虎皮裙深棕
  clothDark: 0x3d2314,
  scarf: 0xd52b2b,    // 红领巾
  guard: 0x262626,    // 护腕护脚
  staff: 0xcc2222,    // 金箍棒
  boot: 0xd9a441,     // 靴子黄
  cloud: 0xffffff,    // 筋斗云
}

function makeMaterial(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.05,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  })
}

// 3D 悟空对象组（返回 { root, parts }，parts 供动画控制）
function buildWukong() {
  const root = new THREE.Group()
  const parts = {}

  // ---- 头部 ----
  const head = new THREE.Group()
  const headBall = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), makeMaterial(C.fur))
  headBall.position.y = 1.28
  head.add(headBall)
  // 脸（前侧浅色球壳）
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.335, 24, 18), makeMaterial(C.skin))
  face.position.set(0, 1.28, 0.36)
  head.add(face)
  // 腮红
  const blushL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), makeMaterial(C.blush))
  blushL.position.set(-0.24, 1.2, 0.44)
  const blushR = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), makeMaterial(C.blush))
  blushR.position.set(0.24, 1.2, 0.44)
  head.add(blushL, blushR)
  // 金箍（环）
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 12, 32), makeMaterial(C.band, { metalness: 0.55, roughness: 0.3 }))
  band.position.y = 1.36
  band.rotation.x = Math.PI / 2
  head.add(band)
  // 耳朵
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), makeMaterial(C.fur))
  earL.position.set(-0.46, 1.3, 0)
  const earR = earL.clone()
  earR.position.x = 0.46
  head.add(earL, earR)
  root.add(head)
  parts.head = head

  // ---- 身体（虎皮裙锥台 + 上衣） ----
  const body = new THREE.Group()
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.34, 8, 16), makeMaterial(C.fur))
  torso.position.y = 0.78
  body.add(torso)
  // 虎皮裙（锥台，深棕 + 黑纹环）
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.34, 20, 1, true), makeMaterial(C.cloth))
  skirt.position.y = 0.5
  body.add(skirt)
  const skirtRing = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.07, 20), makeMaterial(C.clothDark))
  skirtRing.position.y = 0.58
  body.add(skirtRing)
  // 红领巾
  const scarf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 12), makeMaterial(C.scarf))
  scarf.position.set(0, 1.02, 0.3)
  scarf.rotation.x = Math.PI * 0.9
  body.add(scarf)
  root.add(body)
  parts.body = body

  // ---- 手臂（带肩关节：肩→臂→护腕） ----
  const armGroup = new THREE.Group()
  const mkArm = (side) => {
    const g = new THREE.Group()
    const shoulder = new THREE.Group()
    shoulder.position.y = 0.95
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.28, 6, 12), makeMaterial(C.fur))
    arm.position.y = -0.24
    shoulder.add(arm)
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.12, 12), makeMaterial(C.guard))
    guard.position.y = -0.42
    shoulder.add(guard)
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

  // ---- 腿（带髋关节：髋→腿→护脚） ----
  const legGroup = new THREE.Group()
  const mkLeg = (side) => {
    const g = new THREE.Group()
    const hip = new THREE.Group()
    hip.position.y = 0.36
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.26, 6, 12), makeMaterial(C.fur))
    leg.position.y = -0.26
    hip.add(leg)
    const boot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), makeMaterial(C.boot))
    boot.position.y = -0.5
    hip.add(boot)
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

  // ---- 金箍棒（斜挎背后） ----
  const staff = new THREE.Group()
  const staffBar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.9, 12), makeMaterial(C.staff))
  staffBar.rotation.z = Math.PI / 2
  staff.add(staffBar)
  const staffEndL = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.12, 12), makeMaterial(C.band, { metalness: 0.5, roughness: 0.35 }))
  staffEndL.position.x = -0.95
  staffEndL.rotation.z = Math.PI / 2
  const staffEndR = staffEndL.clone()
  staffEndR.position.x = 0.95
  staff.add(staffEndL, staffEndR)
  staff.position.set(0, 0.78, -0.5)
  staff.rotation.z = -0.5   // 斜挎
  staff.rotation.y = 0.3
  root.add(staff)
  parts.staff = staff

  return { root, parts }
}

// 3D 筋斗云（静止底座）
function buildCloud() {
  const cloud = new THREE.Group()
  const mat = makeMaterial(C.cloud, { transparent: true, opacity: 0.88, roughness: 0.85 })
  const blob = (x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), mat)
    m.scale.set(sx, sy, sz)
    m.position.set(x, y, z)
    cloud.add(m)
  }
  blob(0, 0, 0, 1.15, 0.32, 0.72)       // 主云
  blob(-0.72, -0.06, 0.05, 0.55, 0.24, 0.5)
  blob(0.72, -0.06, -0.02, 0.55, 0.24, 0.5)
  blob(0, 0.06, -0.25, 0.72, 0.2, 0.42)
  blob(-0.3, 0.1, 0.2, 0.45, 0.18, 0.36)
  blob(0.34, 0.08, 0.18, 0.42, 0.17, 0.34)
  return cloud
}

export default function Wukong3D({ paused = false }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    // 高清渲染（2x 尺寸，CSS 缩回按钮大小）
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

    // 灯光
    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const dir = new THREE.DirectionalLight(0xffffff, 1.0)
    dir.position.set(3, 5, 4)
    scene.add(dir)
    const rim = new THREE.DirectionalLight(0xffe6c0, 0.45)
    rim.position.set(-4, 2, -3)
    scene.add(rim)

    // 3D 悟空 + 3D 云
    const { root: wukong, parts } = buildWukong()
    const cloud = buildCloud()
    scene.add(wukong)
    scene.add(cloud)

    // ---- 动画：setInterval 驱动（自维护时钟，不依赖 rAF/CSS currentTime；暂停时不累计） ----
    const STEP = 1 / 60        // 60fps 步进
    let acc = 0                // 累计动画时间（秒）
    const CYCLE = 10.0         // 秒，一整个循环
    const FLIP_AT = 1.8        // 后空翻开始时刻
    const FLIP_LEN = 2.16      // 后空翻时长（对齐旧时间轴 24 tick × 90ms）
    const WAVE_AT = 5.4        // 招手开始时刻
    const WAVE_LEN = 1.1

    const armIdle = { l: 0.12, r: -0.12 }   // 待机手臂自然下垂微张

    const iv = setInterval(() => {
      if (paused) {
        renderer.render(scene, camera)
        return
      }
      acc += STEP
      const t = acc % CYCLE

      // ---- 默认姿态复位（每次循环先回到站立） ----
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
        // ---- 后空翻：整体绕 X 轴向后整圈 + 抛物线 + 空中团身 ----
        const k = (t - FLIP_AT) / FLIP_LEN          // 0..1
        const angle = k * Math.PI * 2               // 0..2π
        wukong.rotation.x = -angle                  // 负方向 = 向后翻（顶部先倒向后方）
        // 抛物线位移（峰值在倒立点 π）
        wukong.position.y = Math.sin(angle / 2) * 1.35
        // 起跳：前段屈膝蓄力
        const squat = Math.sin(Math.min(k, 0.18) / 0.18 * Math.PI) * 0.35
        parts.legL.rotation.x = squat
        parts.legR.rotation.x = squat
        // 空中团身：90°-270°（0.5π-1.5π）收拢四肢 + 压身
        const tuck = (angle > Math.PI * 0.45 && angle < Math.PI * 1.55) ? 1 : 0
        const tuckAmt = tuck * Math.sin((angle - Math.PI * 0.45) / (Math.PI * 1.1) * Math.PI)
        parts.legL.rotation.x = (1 - tuckAmt) * squat + tuckAmt * 1.35   // 收腿
        parts.legR.rotation.x = (1 - tuckAmt) * squat + tuckAmt * 1.35
        parts.armL.rotation.z = armIdle.l - tuckAmt * 1.5                // 抱膝
        parts.armR.rotation.z = armIdle.r + tuckAmt * 1.5
        parts.armL.rotation.x = -tuckAmt * 0.7
        parts.armR.rotation.x = -tuckAmt * 0.7
        parts.body.scale.y = 1 - tuckAmt * 0.22                          // 压身蜷球
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
