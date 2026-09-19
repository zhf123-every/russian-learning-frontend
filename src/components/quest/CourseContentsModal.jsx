import { useState, useEffect, useRef } from 'react'

// ================= 本课内容面板（句子列表 + 筛选 + 发音 + 跳转） =================
// 对齐官方 CourseContents.vue

const FILTERS = [
  { label: '全部', value: 'all' },
  { label: '已掌握', value: 'mastered' },
  { label: '未掌握', value: 'notMastered' },
]

export default function CourseContentsModal({
  visible,
  sentences,       // [{ russian, chinese, soundmark, isMastered, qi }]
  currentQi,
  onJump,          // (qi) => void
  onPlaySound,     // (text) => void
  onClose,
  theme,
  dark = true,
}) {
  const [filter, setFilter] = useState('all')
  const listRef = useRef(null)
  const itemRefs = useRef([])

  useEffect(() => {
    if (visible) {
      setFilter('all')
      // 滚动到当前题目
      setTimeout(() => {
        const idx = sentences.findIndex(s => s.qi === currentQi)
        if (idx >= 0 && itemRefs.current[idx]) {
          itemRefs.current[idx].scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    }
  }, [visible, currentQi, sentences])

  if (!visible) return null

  const T = theme || {
    panel: dark ? '#1e1b2e' : '#ffffff',
    text: dark ? '#F5EDE2' : '#1a1a2e',
    sub: dark ? '#8B7FA3' : '#666',
    border: dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)',
    brand: '#6366F1',
    ok: '#4ADE80',
    bgSoft: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)',
    brandSoft: dark ? 'rgba(232,121,249,.12)' : 'rgba(232,121,249,.08)',
    shadow: '0 20px 60px rgba(0,0,0,.4)',
  }

  const filtered = sentences.filter(s => {
    if (filter === 'mastered') return s.isMastered
    if (filter === 'notMastered') return !s.isMastered
    return true
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      animation: 'ccFade .2s ease',
    }} onClick={onClose}>
      <style>{`
        @keyframes ccFade { from{opacity:0} to{opacity:1} }
        @keyframes ccPop { 0%{transform:scale(.96) translateY(10px); opacity:0} 100%{transform:scale(1) translateY(0); opacity:1} }
        .cc-row{ transition:all .2s ease; }
        .cc-row:hover:not(.cc-disabled){ transform:translateX(4px); }
      `}</style>
      <div style={{
        width: '100%', maxWidth: 720, height: '85vh', maxHeight: 720,
        background: T.panel, borderRadius: 18, border: '1px solid ' + T.border,
        boxShadow: T.shadow, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'ccPop .3s ease',
      }} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px 12px', borderBottom: '1px solid ' + T.border,
        }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>📖 课程目录</div>
            <div style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>
              共 {sentences.length} 句 · 已掌握 {sentences.filter(s => s.isMastered).length} 句
            </div>
          </div>
          <button onClick={onClose} style={{
            background: T.bgSoft, border: '1px solid ' + T.border, color: T.sub,
            width: 36, height: 36, borderRadius: 10, cursor: 'pointer', fontSize: 18,
          }}>✕</button>
        </div>

        {/* 筛选栏 */}
        <div style={{
          display: 'flex', gap: 8, padding: '12px 24px', borderBottom: '1px solid ' + T.border,
        }}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                padding: '7px 18px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                border: '1px solid ' + (filter === f.value ? T.brand : T.border),
                background: filter === f.value ? T.brandSoft : 'transparent',
                color: filter === f.value ? T.brand : T.sub,
                transition: 'all .15s ease',
              }}
            >
              {f.label}
              {f.value === 'mastered' && ` (${sentences.filter(s => s.isMastered).length})`}
              {f.value === 'notMastered' && ` (${sentences.filter(s => !s.isMastered).length})`}
            </button>
          ))}
        </div>

        {/* 句子列表 */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: T.sub, fontSize: 15 }}>
              {filter === 'mastered' ? '还没有掌握的句子，继续加油！' : '没有未掌握的句子，太棒了！🎉'}
            </div>
          ) : filtered.map((s, i) => {
            const isCur = s.qi === currentQi
            return (
              <div
                key={s.qi}
                ref={el => { itemRefs.current[i] = el }}
                className={'cc-row ' + (s.isMastered ? 'cc-disabled' : '')}
                onClick={() => { if (!s.isMastered) { onJump(s.qi); onClose() } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', marginBottom: 8, borderRadius: 12,
                  background: isCur ? T.brandSoft : T.bgSoft,
                  border: '1px solid ' + (isCur ? T.brand : T.border),
                  cursor: s.isMastered ? 'not-allowed' : 'pointer',
                  opacity: s.isMastered ? 0.55 : 1,
                }}
              >
                {/* 序号 + 掌握标记 */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  width: 36, flexShrink: 0,
                }}>
                  <span style={{
                    fontSize: 17, fontWeight: 800,
                    color: isCur ? T.brand : s.isMastered ? T.ok : T.sub,
                  }}>{sentences.indexOf(s) + 1}</span>
                  {s.isMastered && (
                    <span style={{ fontSize: 16, color: T.ok, marginTop: 2 }}>✓</span>
                  )}
                </div>

                {/* 句子内容 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: isCur ? T.brand : T.text,
                    marginBottom: 3, lineHeight: 1.4,
                  }}>{s.russian}</div>
                  <div style={{ fontSize: 13, color: T.sub, marginBottom: 2 }}>{s.chinese}</div>
                  {s.soundmark && (
                    <div style={{ fontSize: 12, color: T.sub, opacity: .7 }}>{s.soundmark}</div>
                  )}
                </div>

                {/* 发音按钮 */}
                <button
                  onClick={e => { e.stopPropagation(); onPlaySound && onPlaySound(s.russian) }}
                  title="播放发音"
                  style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: T.brand + '18', border: '1px solid ' + T.brand + '44',
                    color: T.brand, cursor: 'pointer', fontSize: 18,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = T.brand + '33'}
                  onMouseLeave={e => e.currentTarget.style.background = T.brand + '18'}
                >🔊</button>

                {/* 跳转标记 */}
                <div style={{ width: 50, textAlign: 'right', flexShrink: 0 }}>
                  {isCur ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.brand }}>当前</span>
                  ) : s.isMastered ? (
                    <span style={{ fontSize: 12, color: T.ok }}>已掌握</span>
                  ) : (
                    <span style={{ fontSize: 12, color: T.sub }}>跳转 ›</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 底部提示 */}
        <div style={{
          padding: '12px 24px', borderTop: '1px solid ' + T.border,
          fontSize: 12, color: T.sub, textAlign: 'center',
        }}>
          点击未掌握的句子可直接跳转练习 · 点击 🔊 播放发音 · 已掌握的句子不可跳转
        </div>
      </div>
    </div>
  )
}
