// 练习模式弹窗（左右分栏样式：左模式列表 / 右详情+核心特性+开始按钮）
// 两套清单：课程类（中译俄/听写/听力[灰]/口语评测/阅读）、视频类（整体盲听/逐段盲听/精听/跟读/口语测评）
import { useState } from 'react'

// ============ 两套模式清单 ============
// ready=false 的项整项灰化，点不动，右下角标“即将上线”
export const COURSE_MODES = [
  {
    key: 'chinese_to_english', name: '中译俄模式', emoji: '🐉', tag: '新手推荐',
    desc: '看到中文提示，按句型渐进步骤，逐词到整句用俄语表达。',
    features: [
      { icon: '📝', title: '逐词引导', sub: '从词到整句渐进' },
      { icon: '🧩', title: '句型家族', sub: '按语法家族编排' },
      { icon: '⚡', title: '即时反馈', sub: '对错立刻提示' },
    ],
    cta: '开始练习', ready: true,
  },
  {
    key: 'dictation', name: '听写模式', emoji: '🎧', tag: '初级',
    desc: '听俄语原声，把听到的句子逐词写下来，锻炼听力与拼写。',
    features: [
      { icon: '🔊', title: '原声播放', sub: '标准俄语发音' },
      { icon: '⌨️', title: '逐词拼写', sub: '听一句写一句' },
      { icon: '🚩', title: '错句标记', sub: '弱项自动记录' },
    ],
    cta: '开始听写', ready: true,
  },
  {
    key: 'listening', name: '听力模式', emoji: '👂', tag: '即将上线',
    desc: '纯听训练：听俄语原声，听懂即过，不拼写。',
    features: [
      { icon: '🎵', title: '纯听输入', sub: '专注听懂' },
      { icon: '🔁', title: '循环播放', sub: '没懂就重播' },
      { icon: '✅', title: '懂了就过', sub: '不拼写不卡壳' },
    ],
    cta: '开始听力', ready: false,
  },
  {
    key: 'speaking', name: '口语评测模式', emoji: '🗣️', tag: 'AI',
    desc: '听原句 → 跟读录音 → AI 实时评分，纠正你的发音。',
    features: [
      { icon: '🎙️', title: '录音跟读', sub: '录下你的声音' },
      { icon: '🤖', title: 'AI 转写', sub: '识别你读了什么' },
      { icon: '⭐', title: '发音打分', sub: '逐词比对评分' },
    ],
    cta: '开始评测', ready: true,
  },
  {
    key: 'reading', name: '阅读模式', emoji: '📖', tag: '轻量阅读',
    desc: '像读文章一样浏览课程全文，先理解内容和语境。',
    features: [
      { icon: '📄', title: '全文阅读', sub: '按课程文本浏览' },
      { icon: '🔎', title: '单句精读', sub: '聚焦当前句子' },
      { icon: '💡', title: '点词查义', sub: '点单词看释义' },
    ],
    cta: '开始阅读', ready: true,
  },
]

export const VIDEO_MODES = [
  {
    key: 'listen_overall', name: '整体盲听', emoji: '🎬', tag: '第1步',
    desc: '隐藏字幕，反复听完整篇素材，感受整体语境与主旨。',
    features: [
      { icon: '🙈', title: '隐藏字幕', sub: '不看字幕硬听' },
      { icon: '🌐', title: '整体语境', sub: '先抓大意主旨' },
      { icon: '🔁', title: '反复听', sub: '直到有画面感' },
    ],
    cta: '开始盲听', ready: true,
  },
  {
    key: 'listen_segment', name: '逐段盲听', emoji: '🎞️', tag: '第2步',
    desc: '单句循环播放，只听不写，逐句磨耳朵。',
    features: [
      { icon: '🔂', title: '逐句循环', sub: '一句话听透' },
      { icon: '👂', title: '纯听训练', sub: '不输入只磨耳' },
      { icon: '⏪', title: '自由回放', sub: '没懂倒回去' },
    ],
    cta: '开始听', ready: true,
  },
  {
    key: 'intensive', name: '精听', emoji: '📚', tag: '核心',
    desc: '逐句听写 + 精读纠错，查生词、分析连读弱读差异。',
    features: [
      { icon: '⌨️', title: '逐句听写', sub: '听一句敲一句' },
      { icon: '📖', title: '原文对照', sub: '写完看原文' },
      { icon: '🔖', title: '生词标注', sub: '生词语法点标记' },
    ],
    cta: '开始精听', ready: true,
  },
  {
    key: 'follow', name: '跟读', emoji: '🪞', tag: '第4步',
    desc: '原文显示，单句循环影子跟读，模仿重音、语调与语速。',
    features: [
      { icon: '👤', title: '影子跟读', sub: '贴着原声模仿' },
      { icon: '🎯', title: '语调模仿', sub: '重音语气对齐' },
      { icon: '🔂', title: '单句循环', sub: '一句练到位' },
    ],
    cta: '开始跟读', ready: true,
  },
  {
    key: 'speaking', name: '口语测评', emoji: '🎤', tag: 'AI',
    desc: '录音复述，AI 把你的发音和原声逐句比对打分。',
    features: [
      { icon: '🎙️', title: '录音复述', sub: '录下你的复述' },
      { icon: '🤖', title: 'AI 比对', sub: '和原声逐句比' },
      { icon: '⭐', title: '发音打分', sub: '哪里差指出来' },
    ],
    cta: '开始评测', ready: true,
  },
]

// ============ 弹窗本体 ============
export default function ModePickerModal({ title = '本课', modes = COURSE_MODES, onClose, onStart }) {
  const readyModes = modes.filter((m) => m.ready)
  const [activeKey, setActiveKey] = useState(readyModes[0]?.key || modes[0].key)
  const active = modes.find((m) => m.key === activeKey) || modes[0]
  const handlePick = (m) => { if (m.ready) setActiveKey(m.key) }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        className="modal-pop"
        style={{
          width: 'min(920px, 96vw)', maxHeight: '92vh', background: '#fff', borderRadius: 18,
          display: 'flex', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== 左栏：模式列表 ===== */}
        <div style={{ width: 288, flexShrink: 0, padding: '24px 16px 20px', borderRight: '1px solid #f0f0f4', overflowY: 'auto' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#18181b', padding: '0 12px' }}>选择练习模式</div>
          <div style={{ fontSize: 12, color: '#9ca3af', margin: '4px 12px 16px' }}>Select Practice Mode</div>
          {modes.map((m) => {
            const on = m.key === activeKey
            return (
              <div
                key={m.key}
                onClick={() => handlePick(m)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', marginBottom: 6,
                  borderRadius: 12, cursor: m.ready ? 'pointer' : 'not-allowed',
                  background: on ? '#F5F3FF' : 'transparent',
                  borderLeft: on ? '3px solid #B026FF' : '3px solid transparent',
                  opacity: m.ready ? 1 : 0.45,
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: on ? '#fff' : '#f4f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{m.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#18181b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                  {!m.ready && <div style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>即将上线</div>}
                </div>
                {on && <span style={{ color: '#B026FF', fontSize: 16 }}>›</span>}
              </div>
            )
          })}
        </div>

        {/* ===== 右栏：详情 ===== */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* 插画头 */}
          <div style={{ position: 'relative', height: 160, background: 'linear-gradient(180deg,#a5d8f5 0%,#d8ecfb 55%,#f4faff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <div style={{ fontSize: 72, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.15))' }}>{active.emoji}</div>
            <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 14, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.7)', color: '#555', fontSize: 16, cursor: 'pointer' }}>✕</button>
          </div>

          {/* 内容 */}
          <div style={{ flex: 1, padding: '18px 24px 8px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ background: '#10b981', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 10px' }}>{active.tag}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#18181b' }}>{active.name}</div>
            <div style={{ fontSize: 13.5, color: '#6b7280', marginTop: 8, lineHeight: 1.6 }}>{active.desc}</div>

            <div style={{ fontSize: 13, fontWeight: 800, color: '#374151', margin: '18px 0 10px' }}>核心特性</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {active.features.map((f) => (
                <div key={f.title} style={{ background: '#f7f7fa', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, color: '#B026FF' }}>{f.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#18181b', marginTop: 4 }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{f.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 底部按钮 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px 20px' }}>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: 15, cursor: 'pointer', padding: '10px 12px' }}>取消</button>
            <button
              onClick={() => onStart && onStart(active)}
              style={{
                flex: 1, background: '#C0392B', color: '#fff', border: 'none', borderRadius: 12,
                padding: '14px 20px', fontSize: 16, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(192,57,43,0.35)',
              }}
            >
              {active.cta} ↻
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
