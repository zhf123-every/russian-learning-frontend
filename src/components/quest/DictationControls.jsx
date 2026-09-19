import { useState, useEffect, useRef } from 'react'
import { loadToolbarData } from './GameSettingModal'

// ================= 听写模式播放控制栏 =================
// 三阶段体验：盲听（正常速）→ 慢听（0.5x）→ 显示答案提示
// 对齐官方听写模式工具栏交互

export default function DictationControls({
  text,           // 要播放的俄语句子
  onPlay,         // (text, rate) => void 播放回调
  onToggleTip,    // () => void 切换答案提示显示
  showTip,        // 当前是否显示答案提示
  theme,
  dark = true,
}) {
  const [playing, setPlaying] = useState(null) // 'normal' | 'slow' | null
  const [toolbar, setToolbar] = useState(() => loadToolbarData())
  const playTimers = useRef([])

  useEffect(() => {
    setToolbar(loadToolbarData())
  }, [])

  // 清理定时器
  useEffect(() => {
    return () => playTimers.current.forEach(clearTimeout)
  }, [])

  const T = theme || {
    panel: dark ? '#1e1b2e' : '#ffffff',
    text: dark ? '#F5EDE2' : '#1a1a2e',
    sub: dark ? '#8B7FA3' : '#666',
    border: dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)',
    brand: '#6366F1',
    ok: '#4ADE80',
    bgSoft: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)',
    brandSoft: dark ? 'rgba(232,121,249,.12)' : 'rgba(232,121,249,.08)',
    shadow: '0 8px 24px rgba(0,0,0,.15)',
  }

  // 按设置的次数和间隔循环播放
  const playWithSettings = (rate, label) => {
    if (!text || !onPlay) return
    // 清理之前的定时器
    playTimers.current.forEach(clearTimeout)
    playTimers.current = []

    setPlaying(label)
    const times = parseInt(toolbar.times) || 1
    const interval = parseInt(toolbar.interval) || 3000
    // 估算单句播放时长（按词数估算，每词约0.4秒）
    const wordCount = text.trim().split(/\s+/).length
    const perPlay = Math.max(1500, wordCount * 400 / rate)

    for (let i = 0; i < times; i++) {
      const t = setTimeout(() => {
        onPlay(text, rate)
        if (i === times - 1) {
          // 最后一次播放结束后重置状态
          const endT = setTimeout(() => setPlaying(null), perPlay + 300)
          playTimers.current.push(endT)
        }
      }, i * (perPlay + interval))
      playTimers.current.push(t)
    }
  }

  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 18px', borderRadius: 12, cursor: 'pointer',
    fontSize: 13.5, fontWeight: 600, border: '1px solid ' + T.border,
    background: T.bgSoft, color: T.text, transition: 'all .15s ease',
    minWidth: 96,
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      flexWrap: 'wrap', marginBottom: 24,
    }}>
      <style>{`
        .dc-btn:hover{ transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,.1); }
        .dc-btn:active{ transform:translateY(0); }
        .dc-btn.dc-active{ background:var(--dc-brand-bg); border-color:var(--dc-brand); color:var(--dc-brand); }
        @keyframes dcPulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .dc-playing{ animation:dcPulse 1s ease-in-out infinite; }
      `}</style>

      {/* 阶段1：盲听 - 正常速度播放 */}
      <button
        className={'dc-btn ' + (playing === 'normal' ? 'dc-playing' : '')}
        style={{
          ...btnBase,
          ...(playing === 'normal' ? { background: T.brandSoft, borderColor: T.brand, color: T.brand } : {}),
        }}
        onClick={() => playWithSettings(parseFloat(toolbar.rate) || 1, 'normal')}
        title={`正常速度播放（${toolbar.rate}x，播放${toolbar.times}次）`}
      >
        <span style={{ fontSize: 16 }}>{playing === 'normal' ? '🔊' : '▶️'}</span>
        <span>盲听 {toolbar.rate}x</span>
        {playing === 'normal' && <span style={{ fontSize: 11 }}>播放中</span>}
      </button>

      {/* 阶段2：慢听 - 0.5倍慢速播放 */}
      <button
        className={'dc-btn ' + (playing === 'slow' ? 'dc-playing' : '')}
        style={{
          ...btnBase,
          ...(playing === 'slow' ? { background: T.brandSoft, borderColor: T.brand, color: T.brand } : {}),
        }}
        onClick={() => playWithSettings(0.5, 'slow')}
        title="0.5倍慢速播放，听清每个音节"
      >
        <span style={{ fontSize: 16 }}>{playing === 'slow' ? '🔊' : '🐢'}</span>
        <span>慢听 0.5x</span>
        {playing === 'slow' && <span style={{ fontSize: 11 }}>播放中</span>}
      </button>

      {/* 阶段3：显示答案提示 */}
      <button
        className="dc-btn"
        style={{
          ...btnBase,
          ...(showTip ? { background: T.ok + '22', borderColor: T.ok, color: T.ok } : {}),
        }}
        onClick={onToggleTip}
        title={showTip ? '隐藏答案提示' : '显示答案提示（仅显示首字母或完整句子）'}
      >
        <span style={{ fontSize: 16 }}>{showTip ? '🙈' : '💡'}</span>
        <span>{showTip ? '隐藏提示' : '显示提示'}</span>
      </button>

      {/* 播放设置指示 */}
      <div style={{
        fontSize: 11.5, color: T.sub, padding: '6px 12px',
        background: T.bgSoft, borderRadius: 8, border: '1px solid ' + T.border,
      }}>
        播放 {toolbar.times}次 · 间隔 {parseInt(toolbar.interval) / 1000}s
      </div>
    </div>
  )
}
