// 复习关卡 · 学过的所有单词（答错不足 3 次；答错 ≥3 次的词自动进入「陌生关卡」，互斥不重叠）
// 路由：/vocab（侧边栏「通关存档 → 复习关卡」）
// 数据源：rlearn_word_stats（中译俄/听写/听力/口语评测 答题时自动记录）
import { useState } from 'react'
import { getReviewWords, removeWord } from '../lib/wordStats'
import { speak } from '../lib/tts'

export default function Vocab() {
  const [list, setList] = useState(() => getReviewWords())
  const refresh = () => setList(getReviewWords())

  return (
    <div style={{ padding: 16 }}>
      {/* 顶部：标题 + 统计 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>复习关卡</span>
          <span style={{ fontSize: 13, color: '#999' }}>共 {list.length} 个</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#BBB' }}>中译俄 / 听写 / 听力 / 口语中答过的词自动收录；答错 3 次以上自动移入陌生关卡</span>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-20 text-center">
          <div style={{ fontSize: 52, marginBottom: 12 }}>📖</div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>还没有学过的单词</h3>
          <p style={{ fontSize: 13, color: '#888', marginTop: 6 }}>去中译俄 / 听写 / 听力 / 口语页练习，答过的单词会自动出现在这里</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((c) => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="ru" style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>{c.word}</span>
                  {c.reading && <span style={{ fontSize: 12, color: '#B87333' }}>{c.reading}</span>}
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#BBB', marginTop: 4, flexWrap: 'wrap' }}>
                  {c.chinese && <span>{c.chinese}</span>}
                  {c.pos && <span>{c.pos}</span>}
                  <span>答对 {c.correctCount || 0} 次 · 答错 {c.wrongCount || 0} 次</span>
                </div>
              </div>
              <button
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                onClick={() => speak(c.word, { rate: 0.8 })}
              >🔊 发音</button>
              <button
                style={{ border: 'none', background: 'none', color: '#DDD', cursor: 'pointer', fontSize: 14 }}
                title="移除"
                onClick={() => { if (window.confirm(`确定移除「${c.word}」吗？`)) { removeWord(c.key); refresh() } }}
              >🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
