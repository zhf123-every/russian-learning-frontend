// 陌生关卡 · 生词本（对照句乐部「生词本」页）
// 路由：/save/unknown（侧边栏「通关存档 → 陌生关卡」）
// 布局：共N个 + 筛选/导出/选择/开始练习 + 空态（还没有收藏生词）+ 批量添加引导
import { useState } from 'react'
import { useVocabStore } from '../store/vocabStore'
import AddVocabModal from '../components/AddVocabModal'

export default function SaveUnknown() {
  const cards = useVocabStore(s => s.cards)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div style={{ padding: 16 }}>
      {/* 顶部：标题 + 统计 + 操作（对照截图） */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>陌生关卡</span>
          <span style={{ fontSize: 13, color: '#999' }}>共 {cards.length} 个</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">筛选</button>
          <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">导出</button>
          <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">选择</button>
          <button
            className="rounded-lg bg-[#6d28d9] px-4 py-1.5 text-sm font-bold text-white hover:bg-purple-700"
            onClick={() => setShowAdd(true)}
          >开始练习</button>
        </div>
      </div>

      {cards.length === 0 ? (
        <>
          {/* 空态（对照截图：书本图标 + 还没有收藏生词 + 说明） */}
          <div className="rounded-xl border border-gray-200 bg-white py-24 text-center">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 16,
                background: 'linear-gradient(135deg,#F3E8FF,#EDE9FE)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 34, color: '#6d28d9',
              }}>📕</div>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#18181B', margin: 0 }}>还没有收藏生词</h3>
            <p style={{ fontSize: 13, color: '#999', marginTop: 8 }}>
              在练习中遇到不认识的词时，点击它就可以加入生词本
            </p>
          </div>

          {/* 批量添加引导（对照截图） */}
          <div style={{ marginTop: 12, borderRadius: 12, border: '1px solid #E9E4F5', background: '#FDFCFF', padding: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#4C1D95' }}>想批量添加自己的生词？</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                通过编辑端批量录入句子，AI自动拆分，享受造句练习体验
              </div>
            </div>
            <button className="rounded-lg bg-[#6d28d9] px-4 py-1.5 text-sm font-bold text-white hover:bg-purple-700">了解如何批量添加 →</button>
          </div>
          <button
            style={{ border: 'none', background: 'none', color: '#6d28d9', fontSize: 13, fontWeight: 600, marginTop: 12, cursor: 'pointer' }}
            onClick={() => setShowAdd(true)}
          >了解生词本 →</button>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cards.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ru" style={{ fontSize: 14, fontWeight: 600 }}>{c.word}</div>
                {c.chinese && <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{c.chinese}</div>}
              </div>
              {c.pos && <span style={{ fontSize: 12, color: '#888', background: '#F5F5F5', padding: '2px 10px', borderRadius: 4 }}>{c.pos}</span>}
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddVocabModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
