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
    key: 'listen_overall', name: '盲听', emoji: '🎬', tag: '第1步',
    desc: '隐藏字幕，反复听完整篇素材，感受整体语境与主旨。',
    features: [
      { icon: '🙈', title: '隐藏字幕', sub: '不看字幕硬听' },
      { icon: '🌐', title: '整体语境', sub: '先抓大意主旨' },
      { icon: '🔁', title: '反复听', sub: '直到有画面感' },
    ],
    cta: '开始盲听', ready: true,
  },
  {
    key: 'intensive', name: '听写', emoji: '⌨️', tag: '第2步',
    desc: '单句循环播放，把听到的敲入下划线输入框，正确按空格跳下一句。',
    features: [
      { icon: '🔂', title: '一句一停', sub: '读完自动暂停' },
      { icon: '⌨️', title: '逐句听写', sub: '听一句敲一句' },
      { icon: '⏎', title: '空格跳句', sub: '提交正确即下一句' },
    ],
    cta: '开始听写', ready: true,
  },
  {
    key: 'correct', name: '精读纠错', emoji: '📖', tag: '第3步',
    desc: '视频下方显示字幕，随时暂停；悬停字幕查词，AI 解析同页完成。',
    features: [
      { icon: '🖱️', title: '悬停查词', sub: '单词释义即指即查' },
      { icon: '🤖', title: 'AI 解析', sub: '逐词/成分/语法' },
      { icon: '⏸️', title: '随时暂停', sub: '边看边读边查' },
    ],
    cta: '开始精读', ready: true,
  },
  {
    key: 'follow', name: '跟读', emoji: '🪞', tag: '第4步',
    desc: '可分段跟读，也可整篇跟读；视频下方显示字幕跟随高亮。',
    features: [
      { icon: '👤', title: '影子跟读', sub: '贴着原声模仿' },
      { icon: '🔂', title: '分段跟读', sub: '一句练到位' },
      { icon: '🎞️', title: '整篇跟读', sub: '连播字幕跟随' },
    ],
    cta: '开始跟读', ready: true,
  },
  {
    key: 'speaking', name: '口语评测', emoji: '🎤', tag: 'AI',
    desc: '录音复述，AI 把你的发音和原声逐词比对，按真实数据打分。',
    features: [
      { icon: '🎙️', title: '录音复述', sub: '录下你的复述' },
      { icon: '📊', title: '逐词标注', sub: '读对/读错标出来' },
      { icon: '⭐', title: 'AI 打分', sub: '按真实录音评分' },
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
        {/* ===== 左栏：模式列表（对标句乐部：卡片式按钮，移动端横向滚动 / 桌面纵向） ===== */}
        <div className="flex-1 overflow-x-auto md:overflow-y-auto custom-scrollbar flex md:flex-col p-3 space-x-2 md:space-x-0 md:space-y-1.5" style={{ borderRight: '1px solid #f0f0f4', background: '#fff' }}>
          {modes.map((m) => {
            const on = m.key === activeKey
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => handlePick(m)}
                className={`relative flex-shrink-0 md:flex-shrink w-64 md:w-full text-left p-2.5 rounded-xl border transition-all select-none group ${
                  on
                    ? 'bg-primary/10 border-primary text-foreground shadow-xs font-medium'
                    : m.ready
                      ? 'bg-transparent border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                      : 'bg-transparent border-transparent text-muted-foreground opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className={`relative size-11 rounded-lg overflow-hidden flex-shrink-0 bg-muted transition-all ${on ? 'opacity-100 scale-105' : 'opacity-70 group-hover:opacity-90'}`}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 24 }}>{m.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <h3 className="font-semibold text-xs sm:text-sm truncate transition-colors">{m.name}</h3>
                    </div>
                  </div>
                </div>
              </button>
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
                  <div style={{ fontSize: 20, color: '#8b5cf6' }}>{f.icon}</div>
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
                flex: 1, background: '#6d28d9', color: '#fff', border: 'none', borderRadius: 12,
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
