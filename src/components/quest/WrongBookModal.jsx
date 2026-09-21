import { useState, useEffect, useMemo } from 'react'

// ================= 错题本弹窗 =================
// 独立的错题本管理面板，支持：
// - 查看全部错题（从 localStorage rlearn_quest_wrongbook 读取）
// - 按错误原因筛选
// - 删除单条/清空全部
// - 播放发音
// - 标记已掌握（移出错题本）

const STORAGE_KEY = 'rlearn_quest_wrongbook'

function loadWrongBook() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function saveWrongBook(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 300))) } catch { /* 忽略 */ }
}

const REASON_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '拼写错误', value: '拼写或词形错误' },
  { label: '漏词', value: '漏词' },
  { label: '多词', value: '多词' },
  { label: '未作答', value: '未作答' },
]

export default function WrongBookModal({
  visible,
  onClose,
  onPlaySound,   // (text) => void
  theme,
  dark = true,
}) {
  const [list, setList] = useState(() => loadWrongBook())
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (visible) setList(loadWrongBook())
  }, [visible])

  const T = theme || {
    panel: dark ? '#1e1b2e' : '#ffffff',
    text: dark ? '#F5EDE2' : '#1a1a2e',
    sub: dark ? '#8B7FA3' : '#666',
    border: dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)',
    brand: 'oklch(23.27% 0.0249 284.3)',
    ok: '#4ADE80',
    err: '#F87171',
    bgSoft: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)',
    shadow: '0 20px 60px rgba(0,0,0,.4)',
  }

  const filtered = useMemo(() => {
    return list.filter(item => {
      if (filter !== 'all' && !(item.reason || '').includes(filter)) return false
      if (search) {
        const q = search.toLowerCase()
        return (item.qText || '').toLowerCase().includes(q) ||
               (item.zh || '').toLowerCase().includes(q) ||
               (item.correct || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [list, filter, search])

  const handleRemove = (id) => {
    const nl = list.filter(x => x.id !== id)
    setList(nl)
    saveWrongBook(nl)
  }

  const handleClearAll = () => {
    if (!window.confirm('确定要清空全部错题吗？此操作不可恢复。')) return
    setList([])
    saveWrongBook([])
  }

  const handleMastered = (id) => {
    handleRemove(id)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      animation: 'wbFade .2s ease',
    }} onClick={onClose}>
      <style>{`
        @keyframes wbFade { from{opacity:0} to{opacity:1} }
        @keyframes wbPop { 0%{transform:scale(.96) translateY(10px); opacity:0} 100%{transform:scale(1) translateY(0); opacity:1} }
        .wb-row{ transition: all .2s ease; }
        .wb-row:hover{ transform: translateX(3px); }
      `}</style>
      <div style={{
        width: '100%', maxWidth: 680, height: '85vh', maxHeight: 720,
        background: T.panel, borderRadius: 18, border: '1px solid ' + T.border,
        boxShadow: T.shadow, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'wbPop .3s ease',
      }} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px 12px', borderBottom: '1px solid ' + T.border,
        }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>📕 错题本</div>
            <div style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>
              共 {list.length} 道错题 · 显示 {filtered.length} 道
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {list.length > 0 && (
              <button onClick={handleClearAll} style={{
                padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: T.err + '18', color: T.err, border: '1px solid ' + T.err + '44',
              }}>清空全部</button>
            )}
            <button onClick={onClose} style={{
              width: 36, height: 36, borderRadius: 10, cursor: 'pointer', fontSize: 18,
              background: T.bgSoft, border: '1px solid ' + T.border, color: T.sub,
            }}>✕</button>
          </div>
        </div>

        {/* 搜索 + 筛选 */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid ' + T.border, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="搜索错题..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 160, padding: '8px 14px', borderRadius: 10,
              background: T.bgSoft, border: '1px solid ' + T.border, color: T.text,
              fontSize: 13, outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {REASON_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                style={{
                  padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  border: '1px solid ' + (filter === f.value ? T.brand : T.border),
                  background: filter === f.value ? T.brand + '22' : 'transparent',
                  color: filter === f.value ? T.brand : T.sub,
                }}
              >{f.label}</button>
            ))}
          </div>
        </div>

        {/* 错题列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>
                {list.length === 0 ? '错题本是空的' : '没有符合条件的错题'}
              </div>
              <div style={{ fontSize: 13, color: T.sub }}>
                {list.length === 0 ? '继续保持，争取全对！' : '试试其他筛选条件'}
              </div>
            </div>
          ) : filtered.map((item, i) => (
            <div key={item.id || i} className="wb-row" style={{
              padding: '14px 16px', marginBottom: 10, borderRadius: 12,
              background: T.bgSoft, border: '1px solid ' + T.border,
              position: 'relative',
            }}>
              {/* 错误原因标签 */}
              <div style={{
                position: 'absolute', top: 10, right: 10,
                padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: T.err + '18', color: T.err,
              }}>{item.reason || '拼写错误'}</div>

              {/* 原句 */}
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4, paddingRight: 80 }}>
                {item.qText || item.q?.s?.russian || ''}
              </div>
              {/* 中文 */}
              <div style={{ fontSize: 13, color: T.sub, marginBottom: 8 }}>
                {item.zh || item.q?.s?.chinese || ''}
              </div>

              {/* 对比 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: T.sub }}>你的输入：</span>
                  <span style={{ color: T.err, fontWeight: 600 }}>{item.user || '(空)'}</span>
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: T.sub }}>正确答案：</span>
                  <span style={{ color: T.ok, fontWeight: 600 }}>{item.correct || item.q?.answer || ''}</span>
                </div>
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => onPlaySound && onPlaySound(item.qText || item.correct || '')}
                  style={{
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: T.brand + '18', color: T.brand, border: '1px solid ' + T.brand + '44',
                  }}
                >🔊 发音</button>
                <button
                  onClick={() => handleMastered(item.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: T.ok + '18', color: T.ok, border: '1px solid ' + T.ok + '44',
                  }}
                >✓ 已掌握</button>
                <button
                  onClick={() => handleRemove(item.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: T.bgSoft, color: T.sub, border: '1px solid ' + T.border,
                  }}
                >🗑 删除</button>
              </div>
            </div>
          ))}
        </div>

        {/* 底部提示 */}
        <div style={{
          padding: '12px 24px', borderTop: '1px solid ' + T.border,
          fontSize: 12, color: T.sub, textAlign: 'center',
        }}>
          错题自动收录 · 最多保存 300 条 · 标记已掌握或删除可移出错题本
        </div>
      </div>
    </div>
  )
}
