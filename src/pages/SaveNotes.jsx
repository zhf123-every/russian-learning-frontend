// 关卡笔记 · 笔记（对照句乐部「笔记」页）
// 路由：/save/notes（侧边栏「通关存档 → 关卡笔记」）
// 布局：顶部标签(笔记/全部笔记/按课程包) + 空态（还没有笔记）
import { useState } from 'react'

const TABS = ['笔记', '全部笔记', '按课程包']

export default function SaveNotes() {
  const [tab, setTab] = useState(0)
  return (
    <div style={{ padding: 16 }}>
      {/* 标签栏（对照截图） */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map((t, i) => (
          <button
            key={t}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold"
            style={tab === i
              ? { background: '#6d28d9', color: '#fff' }
              : { color: '#888' }}
            onClick={() => setTab(i)}
          >{t}</button>
        ))}
      </div>

      {/* 空态（对照截图：笔记图标 + 还没有笔记 + 说明） */}
      <div className="rounded-xl border border-gray-200 bg-white py-24 text-center">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 16,
            background: 'linear-gradient(135deg,#F3E8FF,#EDE9FE)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, color: '#6d28d9',
          }}>📝</div>
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#18181B', margin: 0 }}>还没有笔记</h3>
        <p style={{ fontSize: 13, color: '#999', marginTop: 8 }}>练习时答完题可以记录你的学习心得</p>
      </div>
    </div>
  )
}
