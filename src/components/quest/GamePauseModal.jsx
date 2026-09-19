import { useState, useEffect } from 'react'

// ================= 游戏暂停弹窗 =================
// 对齐官方 GamePauseModal.vue：随机鼓励语 + 继续游戏按钮

const PAUSE_MESSAGES = [
  '别忘了回来继续练习哦，我在等着你呢！',
  '休息一下没关系，但别让我等太久！',
  '快点回来吧，你的俄语能力正在蓄势待发！',
  '休息是为了走更远的路，记得回来继续！',
  '俄语学习贵在坚持，回来我们继续！',
  '喝口水，伸个懒腰，然后继续征服俄语！',
]

export default function GamePauseModal({
  visible,
  elapsed,
  currentQi,
  totalQuestions,
  onResume,
  onGoCourseList,
  theme,
  dark = true,
}) {
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (visible) {
      setMessage(PAUSE_MESSAGES[Math.floor(Math.random() * PAUSE_MESSAGES.length)])
    }
  }, [visible])

  if (!visible) return null

  const T = theme || {
    panel: dark ? '#1e1b2e' : '#ffffff',
    text: dark ? '#F5EDE2' : '#1a1a2e',
    sub: dark ? '#8B7FA3' : '#666',
    border: dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)',
    brand: '#6366F1',
    bgSoft: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)',
    shadow: '0 20px 60px rgba(0,0,0,.4)',
  }

  const fmtTime = s => {
    const m = Math.floor(s / 60), ss = s % 60
    return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      animation: 'pauseFade .25s ease',
    }}>
      <style>{`
        @keyframes pauseFade { from{opacity:0} to{opacity:1} }
        @keyframes pausePop { 0%{transform:scale(.9) translateY(10px); opacity:0} 100%{transform:scale(1) translateY(0); opacity:1} }
        @keyframes pauseBreathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        .pause-btn{ transition:all .2s ease; }
        .pause-btn:hover{ transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,.3); }
      `}</style>
      <div style={{
        width: '100%', maxWidth: 440,
        background: T.panel, borderRadius: 20, border: '1px solid ' + T.border,
        boxShadow: T.shadow, padding: '32px 36px', color: T.text,
        animation: 'pausePop .35s cubic-bezier(.34,1.56,.64,1)',
        textAlign: 'center',
      }}>
        {/* 暂停图标 */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
          background: T.brand + '22', border: '2px solid ' + T.brand,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'pauseBreathe 2s ease-in-out infinite',
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 10, height: 32, background: T.brand, borderRadius: 4 }} />
            <div style={{ width: 10, height: 32, background: T.brand, borderRadius: 4 }} />
          </div>
        </div>

        {/* 标题 */}
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>游戏暂停</div>

        {/* 进度信息 */}
        <div style={{
          display: 'inline-flex', gap: 16, padding: '8px 20px', borderRadius: 10,
          background: T.bgSoft, fontSize: 13, color: T.sub, marginBottom: 20,
        }}>
          <span>⏱ {fmtTime(elapsed)}</span>
          <span style={{ opacity: .4 }}>|</span>
          <span>📝 第 {currentQi + 1}/{totalQuestions} 题</span>
        </div>

        {/* 随机鼓励语 */}
        <div style={{
          fontSize: 15, color: T.sub, lineHeight: 1.7, marginBottom: 28,
          padding: '0 12px', minHeight: 48,
        }}>{message}</div>

        {/* 按钮 */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="pause-btn" onClick={onGoCourseList} style={{
            padding: '12px 28px', borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 600,
            background: T.bgSoft, color: T.sub, border: '1px solid ' + T.border,
          }}>返回课表</button>
          <button className="pause-btn" onClick={onResume} style={{
            padding: '12px 32px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: T.brand, color: '#fff', fontSize: 15, fontWeight: 700,
          }}>▶ 继续游戏</button>
        </div>

        {/* 快捷键提示 */}
        <div style={{ marginTop: 18, fontSize: 12, color: T.sub, opacity: .7 }}>
          按 <kbd style={{ padding: '2px 8px', background: T.bgSoft, borderRadius: 4, border: '1px solid ' + T.border, fontFamily: 'monospace' }}>Esc</kbd> 或 <kbd style={{ padding: '2px 8px', background: T.bgSoft, borderRadius: 4, border: '1px solid ' + T.border, fontFamily: 'monospace' }}>空格</kbd> 继续
        </div>
      </div>
    </div>
  )
}
