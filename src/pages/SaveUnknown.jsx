// 陌生关卡 · 答错 3 次以上的单词（与复习关卡互斥：进入这里后不再出现在复习关卡）
// 路由：/save/unknown（侧边栏「通关存档 → 陌生关卡」）
// 数据源：rlearn_word_stats（中译俄/听写/听力/口语评测 答题时自动记录）
import { useState } from 'react'
import { getUnknownWords, clearWrongCount } from '../lib/wordStats'
import { speak } from '../lib/tts'

export default function SaveUnknown() {
  const [list, setList] = useState(() => getUnknownWords())
  const refresh = () => setList(getUnknownWords())

  return (
    <div style={{ padding: 16 }}>
      {/* 顶部：标题 + 统计 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>陌生关卡</span>
          <span style={{ fontSize: 13, color: '#999' }}>共 {list.length} 个</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#BBB' }}>答错 3 次以上的单词自动进入这里，练熟后可移回复习关卡</span>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-24 text-center">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 16,
              background: 'linear-gradient(135deg,#FEF3C7,#FDE68A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 34, color: '#D97706',
            }}>🧩</div>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#18181B', margin: 0 }}>没有陌生单词</h3>
          <p style={{ fontSize: 13, color: '#999', marginTop: 8 }}>
            在答题中答错 3 次以上的单词会自动出现在这里
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((c) => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: '1px solid #FDE68A', background: '#FFFBEB' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="ru" style={{ fontSize: 14, fontWeight: 600 }}>{c.word}</span>
                  <span style={{ fontSize: 11, color: '#D97706', background: '#FEF3C7', padding: '2px 8px', borderRadius: 999 }}>答错 {c.wrongCount} 次</span>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#999', marginTop: 4, flexWrap: 'wrap' }}>
                  {c.chinese && <span>{c.chinese}</span>}
                  {c.pos && <span>{c.pos}</span>}
                </div>
              </div>
              <button
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                onClick={() => speak(c.word, { rate: 0.8 })}
              >🔊 发音</button>
              <button
                className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50"
                title="清零错误次数，移回复习关卡"
                onClick={() => { clearWrongCount(c.key); refresh() }}
              >移回复习</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
