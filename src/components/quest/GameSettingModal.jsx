import { useState, useEffect } from 'react'

// ================= 游戏内设置弹窗（倍速 / 播放次数 / 播放间隔） =================
// 主要服务听写模式与自动朗读，对齐官方 GameSettingModal.vue

const TOOLBAR_DEFAULTS = {
  rate: '1',       // 倍速
  times: '2',      // 播放次数
  interval: '3000',// 播放间隔(ms)
}

export function loadToolbarData() {
  try {
    const s = JSON.parse(localStorage.getItem('rlearn_quest_toolbar') || 'null')
    return { ...TOOLBAR_DEFAULTS, ...(s || {}) }
  } catch { return { ...TOOLBAR_DEFAULTS } }
}
export function saveToolbarData(data) {
  try { localStorage.setItem('rlearn_quest_toolbar', JSON.stringify(data)) } catch { /* 忽略 */ }
}

const RATE_OPTIONS = [
  { label: '2.0X', value: '2' },
  { label: '1.5X', value: '1.5' },
  { label: '1.0X', value: '1' },
  { label: '0.75X', value: '0.75' },
  { label: '0.5X', value: '0.5' },
]
const TIMES_OPTIONS = [
  { label: '4 次', value: '4' },
  { label: '3 次', value: '3' },
  { label: '2 次', value: '2' },
  { label: '1 次', value: '1' },
]
const INTERVAL_OPTIONS = [
  { label: '10 秒', value: '10000' },
  { label: '5 秒', value: '5000' },
  { label: '3 秒', value: '3000' },
  { label: '1 秒', value: '1000' },
]

export default function GameSettingModal({
  visible,
  onClose,
  onChange, // (data) => void
  theme,
  dark = true,
}) {
  const [data, setData] = useState(() => loadToolbarData())

  useEffect(() => {
    if (visible) setData(loadToolbarData())
  }, [visible])

  if (!visible) return null

  const T = theme || {
    panel: dark ? '#1e1b2e' : '#ffffff',
    text: dark ? '#F5EDE2' : '#1a1a2e',
    sub: dark ? '#8B7FA3' : '#666',
    border: dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)',
    brand: 'oklch(23.27% 0.0249 284.3)',
    bgSoft: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)',
    shadow: '0 20px 60px rgba(0,0,0,.4)',
  }

  const update = (key, val) => {
    const nd = { ...data, [key]: val }
    setData(nd)
    saveToolbarData(nd)
    onChange && onChange(nd)
  }

  const handleReset = () => {
    setData({ ...TOOLBAR_DEFAULTS })
    saveToolbarData({ ...TOOLBAR_DEFAULTS })
    onChange && onChange({ ...TOOLBAR_DEFAULTS })
  }

  const SelectRow = ({ label, value, options, onSelect }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid ' + T.border }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            style={{
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              border: '1px solid ' + (value === o.value ? T.brand : T.border),
              background: value === o.value ? T.brand + '22' : T.bgSoft,
              color: value === o.value ? T.brand : T.sub,
              transition: 'all .15s ease',
            }}
          >{o.label}</button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      animation: 'gsmFade .2s ease',
    }} onClick={onClose}>
      <style>{`
        @keyframes gsmFade { from{opacity:0} to{opacity:1} }
        @keyframes gsmPop { 0%{transform:scale(.95); opacity:0} 100%{transform:scale(1); opacity:1} }
      `}</style>
      <div style={{
        width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto',
        background: T.panel, borderRadius: 18, border: '1px solid ' + T.border,
        boxShadow: T.shadow, padding: '24px 28px', color: T.text,
        animation: 'gsmPop .25s ease',
      }} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>⚙️ 游戏设置</div>
          <button onClick={onClose} style={{
            background: T.bgSoft, border: '1px solid ' + T.border, color: T.sub,
            width: 34, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 16,
          }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 16 }}>
          调整听写模式与自动朗读的播放参数，设置自动保存
        </div>

        {/* 设置项 */}
        <SelectRow label="🎚️ 播放倍速" value={data.rate} options={RATE_OPTIONS} onSelect={v => update('rate', v)} />
        <SelectRow label="🔁 播放次数" value={data.times} options={TIMES_OPTIONS} onSelect={v => update('times', v)} />
        <SelectRow label="⏱️ 播放间隔" value={data.interval} options={INTERVAL_OPTIONS} onSelect={v => update('interval', v)} />

        {/* 提示 */}
        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 10,
          background: T.brand + '11', border: '1px solid ' + T.brand + '33',
          fontSize: 12, color: T.sub, lineHeight: 1.6,
        }}>
          💡 倍速、播放次数和间隔主要影响<strong style={{ color: T.brand }}>听写模式</strong>和<strong style={{ color: T.brand }}>自动朗读</strong>行为。
          听写模式下会按设置的次数和间隔循环播放原句，帮助你逐步听清每个音节。
        </div>

        {/* 底部按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={handleReset} style={{
            padding: '9px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600,
            background: T.bgSoft, color: T.sub, border: '1px solid ' + T.border,
          }}>重置默认</button>
          <button onClick={onClose} style={{
            padding: '9px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: T.brand, color: '#fff', fontSize: 14, fontWeight: 700,
          }}>完成</button>
        </div>
      </div>
    </div>
  )
}
