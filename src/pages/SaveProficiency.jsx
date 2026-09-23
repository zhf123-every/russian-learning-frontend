// 关卡熟练度 · 掌握列表（对照句乐部「掌握列表」页）
// 路由：/save/proficiency（侧边栏「通关存档 → 关卡熟练度」）
// 布局：统计(总数/单词数) + 搜索框(Ctrl K) + 全部删除/批量选择 + 空态
import { useState } from 'react'
import { useVocabStore } from '../store/vocabStore'

export default function SaveProficiency() {
  const cards = useVocabStore(s => s.cards)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(false)
  const [checked, setChecked] = useState({})

  const total = cards.length
  const list = cards.filter(c => !q || (c.word + c.chinese).toLowerCase().includes(q.toLowerCase()))

  const toggleAll = () => {
    if (Object.keys(checked).length === list.length && list.length > 0) setChecked({})
    else { const o = {}; list.forEach(c => { o[c.id] = true }); setChecked(o) }
  }
  const delSelected = () => {
    const ids = Object.keys(checked)
    if (!ids.length) return
    if (window.confirm(`确定删除选中的 ${ids.length} 项吗？`)) {
      ids.forEach(id => useVocabStore.getState().remove(id))
      setChecked({})
    }
  }
  const delAll = () => {
    if (!total) return
    if (window.confirm(`确定删除全部 ${total} 项吗？此操作不可恢复`)) {
      cards.forEach(c => useVocabStore.getState().remove(c.id))
    }
  }

  return (
    <div style={{ padding: 16 }}>
      {/* 统计 + 搜索 + 操作（对照截图） */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>掌握列表</span>
          <span style={{ fontSize: 13, color: '#999' }}>总数 {total}</span>
          <span style={{ fontSize: 13, color: '#999' }}>单词数 {total}</span>
        </div>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="搜索已掌握的内容..."
            style={{
              width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8,
              border: '1px solid #E5E7EB', fontSize: 13, outline: 'none',
            }}
          />
          <span style={{ position: 'absolute', left: 12, top: 8, fontSize: 14, color: '#BBB' }}>🔍</span>
          <kbd style={{ position: 'absolute', right: 10, top: 8, fontSize: 11, color: '#BBB', background: '#F5F5F5', padding: '1px 6px', borderRadius: 4 }}>Ctrl K</kbd>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            onClick={delAll}
            disabled={!total}
            style={!total ? { opacity: .4, cursor: 'not-allowed' } : {}}
          >全部删除</button>
          <button
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            onClick={() => { setSel(!sel); setChecked({}) }}
          >{sel ? '取消选择' : '批量选择'}</button>
          {sel && (
            <button
              className="rounded-lg bg-[#6d28d9] px-3 py-1.5 text-sm font-bold text-white hover:bg-purple-700"
              onClick={delSelected}
              disabled={!Object.keys(checked).length}
              style={!Object.keys(checked).length ? { opacity: .4, cursor: 'not-allowed' } : {}}
            >删除选中 ({Object.keys(checked).length})</button>
          )}
        </div>
      </div>

      {/* 空态（对照截图） */}
      {list.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-24 text-center">
          <div style={{ fontSize: 52, marginBottom: 12 }}>🎯</div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>还没有已掌握的内容</h3>
          <p style={{ fontSize: 13, color: '#888', marginTop: 6 }}>闯关熟练度达到 100% 的关卡会显示在这里</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff' }}>
              {sel && (
                <input
                  type="checkbox"
                  checked={!!checked[c.id]}
                  onChange={() => setChecked(p => ({ ...p, [c.id]: !p[c.id] }))}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ru" style={{ fontSize: 14, fontWeight: 600 }}>{c.word}</div>
                {c.chinese && <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{c.chinese}</div>}
              </div>
              {c.pos && <span style={{ fontSize: 12, color: '#888', background: '#F5F5F5', padding: '2px 10px', borderRadius: 4 }}>{c.pos}</span>}
              <span style={{ fontSize: 12, color: '#6d28d9', fontWeight: 700 }}>100%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
