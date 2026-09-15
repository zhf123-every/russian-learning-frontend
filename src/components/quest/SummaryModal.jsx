import { useState, useEffect, useRef, useCallback } from 'react'

// ================= 评级定义 =================
const RATINGS = [
  { min: 0.95, label: 'SSS', color: '#FFD75E', desc: '完美！你已经完全掌握这一课！' },
  { min: 0.88, label: 'SS', color: '#FFB347', desc: '非常棒！继续保持！' },
  { min: 0.8, label: 'S', color: '#FF8A5C', desc: '很好！再练一次会更稳。' },
  { min: 0.68, label: 'A', color: '#7ED6A5', desc: '不错！错题再过一遍就更好了。' },
  { min: 0.5, label: 'B', color: '#6FB7FF', desc: '继续加油，多练几遍就会了！' },
  { min: 0, label: 'C', color: '#B7A8E8', desc: '别灰心，从头再来一遍一定行！' },
]
const ratingOf = acc => {
  const r = acc.correct / Math.max(1, acc.answered)
  return RATINGS.find(x => r >= x.min) || RATINGS[RATINGS.length - 1]
}

// ================= 俄语每日一句（励志名言） =================
const DAILY_QUOTES = [
  { ru: 'Каждый великий путь начинается с первого шага.', zh: '每一段伟大的旅程都始于第一步。' },
  { ru: 'Учение — свет, а неученье — тьма.', zh: '学则明，不学则暗。' },
  { ru: 'Терпение и труд всё перетрут.', zh: '耐心和勤奋能克服一切。' },
  { ru: 'Делу время, потехе час.', zh: '工作之时工作，娱乐之时娱乐。' },
  { ru: 'Кто хочет — тот добьётся.', zh: '有志者事竟成。' },
  { ru: 'Язык до Киева доведёт.', zh: '路在嘴边，多问就能到达。' },
  { ru: 'Семь раз отмерь — один раз отрежь.', zh: '三思而后行。' },
  { ru: 'Друзья познаются в беде.', zh: '患难见真情。' },
  { ru: 'В здоровом теле — здоровый дух.', zh: '健全的精神寓于健全的身体。' },
  { ru: 'Лучше поздно, чем никогда.', zh: '迟做总比不做好。' },
  { ru: 'Маленький шаг — большое достижение.', zh: '一小步，也是大成就。' },
  { ru: 'Знание — сила.', zh: '知识就是力量。' },
]
const pickQuote = () => DAILY_QUOTES[Math.floor(Math.random() * DAILY_QUOTES.length)]

// ================= 撒花粒子动效 =================
function useConfetti(canvasRef, active) {
  const particlesRef = useRef([])
  const rafRef = useRef(null)

  const spawn = useCallback((count = 120) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = canvas.width, H = canvas.height
    const colors = ['#FFD75E', '#FF8A5C', '#E879F9', '#7ED6A5', '#6FB7FF', '#FF6B9D', '#A78BFA']
    const ps = []
    for (let i = 0; i < count; i++) {
      ps.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.3,
        y: H * 0.3 + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 16 - 6,
        g: 0.35 + Math.random() * 0.15,
        size: 6 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        life: 1,
        decay: 0.004 + Math.random() * 0.004,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      })
    }
    particlesRef.current = ps
  }, [canvasRef])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)
    spawn(150)

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const ps = particlesRef.current
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]
        p.vy += p.g
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        p.life -= p.decay
        if (p.life <= 0 || p.y > canvas.height + 40) { ps.splice(i, 1); continue }
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
      if (ps.length > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [active, canvasRef, spawn])

  return { spawn }
}

// ================= 环形进度图 =================
function RingChart({ label, value, color, dark }) {
  const r = 42, C = 2 * Math.PI * r
  const off = C * (1 - Math.max(0, Math.min(100, value)) / 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width="110" height="110" viewBox="0 0 118 118">
        <circle cx="59" cy="59" r={r} fill="none" stroke={dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'} strokeWidth="11" />
        <circle cx="59" cy="59" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 59 59)"
          style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
        <text x="59" y="56" textAnchor="middle" fill={dark ? '#F5EDE2' : '#1a1a2e'} fontSize="20" fontWeight="800">{value}%</text>
        <text x="59" y="78" textAnchor="middle" fill={dark ? '#8B7FA3' : '#888'} fontSize="11">{label}</text>
      </svg>
    </div>
  )
}

// ================= 主组件 =================
export default function SummaryModal({
  visible,
  acc,
  score,
  elapsed,
  maxCombo,
  totalQuestions,
  totalSentences,
  wrongList,
  lessonTitle,
  onClose,
  onDoAgain,
  onExtraGroup,
  onNextLesson,
  onGoCourseList,
  onShare,
  theme, // { panel, text, sub, border, brand, ok, err, bgSoft, shadow }
  dark = true,
}) {
  const [showWrong, setShowWrong] = useState(false)
  const [quote] = useState(() => pickQuote())
  const canvasRef = useRef(null)
  const { spawn } = useConfetti(canvasRef, visible)

  useEffect(() => {
    if (visible) {
      setShowWrong(false)
      setTimeout(() => spawn(150), 250)
    }
  }, [visible, spawn])

  if (!visible) return null

  const rt = ratingOf(acc)
  const pct = Math.round(100 * acc.correct / Math.max(1, acc.answered))
  const wrongN = Math.max(0, acc.answered - acc.correct)
  const firstPct = Math.round(100 * acc.firstHit / Math.max(1, acc.answered))
  const errPct = Math.max(0, 100 - pct)
  const fmtTime = s => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
    return (h > 0 ? (h < 10 ? '0' + h + ':' : h + ':') : '') + (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss
  }
  const fmtScore = n => n.toLocaleString('en-US')

  const T = theme || {
    panel: dark ? '#1e1b2e' : '#ffffff',
    text: dark ? '#F5EDE2' : '#1a1a2e',
    sub: dark ? '#8B7FA3' : '#666',
    border: dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)',
    brand: '#E879F9',
    ok: '#4ADE80',
    err: '#F87171',
    bgSoft: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)',
    shadow: '0 20px 60px rgba(0,0,0,.4)',
  }

  return (
    <>
      {/* 撒花画布 */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
          pointerEvents: 'none', zIndex: 9998,
        }}
      />

      {/* 结算弹窗 */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'summaryFadeIn .3s ease',
      }}>
        <div style={{
          width: '100%', maxWidth: 720, maxHeight: '92vh', overflowY: 'auto',
          background: T.panel, borderRadius: 20, border: '1px solid ' + T.border,
          boxShadow: T.shadow, padding: '28px 32px', color: T.text,
          animation: 'summaryPop .4s cubic-bezier(.34,1.56,.64,1)',
        }}>
          <style>{`
            @keyframes summaryFadeIn { from{opacity:0} to{opacity:1} }
            @keyframes summaryPop { 0%{transform:scale(.9) translateY(20px); opacity:0} 100%{transform:scale(1) translateY(0); opacity:1} }
            @keyframes summaryBadge { 0%{transform:scale(.5); opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1); opacity:1} }
            .sum-btn{ transition:all .2s ease; }
            .sum-btn:hover{ opacity:.85; transform:translateY(-1px); }
            .sum-btn:active{ transform:translateY(0); }
          `}</style>

          {/* 头部：恭喜 + 评级 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 2 }}>🎉 恭喜完成！</div>
              <div style={{ fontSize: 13, color: T.sub }}>{lessonTitle || '本课练习'}</div>
            </div>
            <div style={{
              fontSize: 48, fontWeight: 900, color: rt.color,
              textShadow: `0 0 30px ${rt.color}55`,
              animation: 'summaryBadge .6s ease .2s both',
              lineHeight: 1,
            }}>{rt.label}</div>
          </div>

          {/* 每日一句 */}
          <div style={{
            margin: '16px 0', padding: '14px 18px',
            background: T.bgSoft, borderRadius: 12, border: '1px solid ' + T.border,
            position: 'relative',
          }}>
            <div style={{ position: 'absolute', top: -6, left: 12, fontSize: 28, color: T.brand, opacity: .4, fontFamily: 'serif' }}>"</div>
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.7, paddingLeft: 14 }}>{quote.ru}</div>
            <div style={{ fontSize: 13, color: T.sub, marginTop: 4, paddingLeft: 14 }}>{quote.zh}</div>
          </div>

          {/* 核心统计 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: T.brand }}>{fmtScore(score)}</div>
              <div style={{ fontSize: 12, color: T.sub }}>总得分</div>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, minWidth: 280 }}>
              {[
                { n: acc.answered, l: '答题数', c: T.text },
                { n: acc.correct, l: '正确', c: T.ok },
                { n: wrongN, l: '错误', c: T.err },
                { n: maxCombo, l: '最高连击', c: T.brand },
                { n: fmtTime(elapsed), l: '用时', c: T.text },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '8px 4px', background: T.bgSoft, borderRadius: 8 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: s.c }}>{s.n}</div>
                  <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 环形图 */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
            <RingChart label="准确率" value={pct} color={T.ok} dark={dark} />
            <RingChart label="一次答对" value={firstPct} color="#FFD75E" dark={dark} />
            <RingChart label="错误率" value={errPct} color={T.err} dark={dark} />
          </div>

          {/* 评语 */}
          <div style={{
            textAlign: 'center', fontSize: 14, color: T.sub,
            padding: '10px 16px', background: T.bgSoft, borderRadius: 10,
            marginBottom: 18,
          }}>{rt.desc}</div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            <button className="sum-btn" onClick={() => { onShare && onShare() }} style={{
              padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#E879F9,#A78BFA)', color: '#fff',
              fontSize: 14, fontWeight: 700, flex: '1 1 120px', minWidth: 110,
            }}>📸 生成打卡图</button>
            <button className="sum-btn" onClick={() => setShowWrong(true)} style={{
              padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
              background: T.bgSoft, color: T.text, border: '1px solid ' + T.border,
              fontSize: 14, fontWeight: 600, flex: '1 1 100px', minWidth: 90,
            }}>📝 错题({wrongList.length})</button>
            <button className="sum-btn" onClick={onDoAgain} style={{
              padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
              background: T.bgSoft, color: T.text, border: '1px solid ' + T.border,
              fontSize: 14, fontWeight: 600, flex: '1 1 100px', minWidth: 90,
            }}>🔄 再来一次</button>
            <button className="sum-btn" onClick={onExtraGroup} style={{
              padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
              background: T.bgSoft, color: T.text, border: '1px solid ' + T.border,
              fontSize: 14, fontWeight: 600, flex: '1 1 100px', minWidth: 90,
            }}>🎲 再来一组</button>
            <button className="sum-btn" onClick={onGoCourseList} style={{
              padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
              background: T.bgSoft, color: T.text, border: '1px solid ' + T.border,
              fontSize: 14, fontWeight: 600, flex: '1 1 100px', minWidth: 90,
            }}>📚 课程列表</button>
            <button className="sum-btn" onClick={onNextLesson} style={{
              padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: T.brand, color: '#fff', fontSize: 14, fontWeight: 700,
              flex: '1 1 120px', minWidth: 110,
            }}>下一课 ↵</button>
          </div>
        </div>
      </div>

      {/* 错题列表面板 */}
      {showWrong && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, animation: 'summaryFadeIn .2s ease',
        }} onClick={() => setShowWrong(false)}>
          <div style={{
            width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto',
            background: T.panel, borderRadius: 16, border: '1px solid ' + T.border,
            boxShadow: T.shadow, padding: 24, color: T.text,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>本次错题 · {wrongList.length} 道</div>
              <button onClick={() => setShowWrong(false)} style={{
                background: T.bgSoft, border: '1px solid ' + T.border, color: T.sub,
                width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16,
              }}>✕</button>
            </div>
            {wrongList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: T.sub, fontSize: 16 }}>
                🎉 全对！本次练习没有错题
              </div>
            ) : wrongList.map((w, i) => (
              <div key={w.id || i} style={{
                padding: '14px 16px', marginBottom: 10, borderRadius: 10,
                background: T.bgSoft, border: '1px solid ' + T.border,
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>{w.q?.s?.russian || w.qText || ''}</div>
                <div style={{ fontSize: 13, color: T.sub, marginBottom: 8 }}>{w.q?.s?.chinese || w.zh || ''}</div>
                <div style={{ fontSize: 13, marginBottom: 2 }}>
                  <span style={{ color: T.sub }}>你的输入：</span>
                  <span style={{ color: T.err, fontWeight: 600 }}>{w.user || '(空)'}</span>
                </div>
                <div style={{ fontSize: 13, marginBottom: 2 }}>
                  <span style={{ color: T.sub }}>正确答案：</span>
                  <span style={{ color: T.ok, fontWeight: 600 }}>{w.q?.answer || w.correct || ''}</span>
                </div>
                <div style={{ fontSize: 12, color: T.sub }}>错误原因：{w.reason || '拼写错误'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
