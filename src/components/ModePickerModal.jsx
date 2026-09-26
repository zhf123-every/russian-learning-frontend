// 练习模式弹窗（左右分栏样式：左模式列表 / 右详情+核心特性+开始按钮）
// 两套清单：课程类（中译俄/听写/听力[灰]/口语评测/阅读）、视频类（整体盲听/逐段盲听/精听/跟读/口语测评）
import { useState } from 'react'

// ============ 两套模式清单 ============
// ready=false 的项整项灰化，点不动，右下角标“即将上线”
export const COURSE_MODES = [
  {
    key: 'chinese_to_english', name: '中译俄模式', emoji: '🐉', tag: '新手推荐',
    desc: '看到中文提示，按句型渐进步骤，逐词到整句用俄语表达。',
    heroTag: '看中文写俄语',
    rhythm: [
      { head: '先想后写', text: '看到中文先在脑中组织俄语，再动手输入，练主动表达。' },
      { head: '留意差异', text: '对照原句时关注性数格、动词变位和词序，这些最容易写错。' },
    ],
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
    heroTag: '听俄语写俄语',
    rhythm: [
      { head: '先听整句', text: '完整听一遍原声，抓句子大意再动笔。' },
      { head: '逐词落笔', text: '听不清就重播单句，逐词写完整再提交。' },
    ],
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
    heroTag: '专注听懂不拼写',
    rhythm: [
      { head: '整体听一遍', text: '先完整听一遍，不暂停不逐句，建立整体语感。' },
      { head: '循环重听', text: '没听懂就循环播放，直到有画面感再进入下一句。' },
    ],
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
    heroTag: '录音AI评分',
    rhythm: [
      { head: '先听再读', text: '先听原声感受发音和语调，再开口跟读。' },
      { head: '重点纠音', text: '根据 AI 标出的读错词重点复读，直到接近原声。' },
    ],
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
    heroTag: '通读理解',
    rhythm: [
      { head: '课前通读', text: '正式做听写或口语练习前，先通读全文，建立情节语境。' },
      { head: '点词理解', text: '遇到陌生表达直接点击查看详细释义，先理解、再输出。' },
    ],
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
    heroTag: '不看字幕硬听',
    rhythm: [
      { head: '整体语境', text: '隐藏字幕反复听完整篇，先抓大意和主旨。' },
      { head: '反复回听', text: '没听清的部分拖动回听，直到有画面感。' },
    ],
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
    heroTag: '听一句写一句',
    rhythm: [
      { head: '一句一停', text: '视频读完一句自动暂停，把听到的敲入输入框。' },
      { head: '提交跳句', text: '输入正确按空格进入下一句，错了重听再写。' },
    ],
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
    heroTag: '悬停查词AI解析',
    rhythm: [
      { head: '边看边查', text: '视频下方显示字幕，随时暂停，悬停单词看释义。' },
      { head: 'AI 解析', text: '不懂的句子交给 AI 逐词解析成分和语法。' },
    ],
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
    heroTag: '影子跟读',
    rhythm: [
      { head: '分段跟读', text: '一句一句跟读，贴着原声模仿语音语调。' },
      { head: '整篇连读', text: '跟熟之后整篇连播跟读，练流利度。' },
    ],
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
    heroTag: '录音AI打分',
    rhythm: [
      { head: '先听再读', text: '先听原声再开口，录音复述整段内容。' },
      { head: '对比纠错', text: '评测后与原文逐词对比，AI 按真实录音打分。' },
    ],
    features: [
      { icon: '🎙️', title: '录音复述', sub: '录下你的复述' },
      { icon: '📊', title: '逐词标注', sub: '读对/读错标出来' },
      { icon: '⭐', title: 'AI 打分', sub: '按真实录音评分' },
    ],
    cta: '开始评测', ready: true,
  },
]

// ============ 模式图标映射（对标句乐部：44px 圆角图片图标；WebP 缩略图秒开） ============
const MODE_IMG = {
  chinese_to_english: '/images/game-modes/chinese_to_russian_sm.webp',
  dictation: '/images/game-modes/dictation_sm.webp',
  listening: '/images/game-modes/listening_sm.webp',
  speaking: '/images/game-modes/speaking_sm.webp',
  reading: '/images/game-modes/reading_sm.webp',
  // 视频类模式复用图标
  listen_overall: '/images/game-modes/listening_sm.webp',
  intensive: '/images/game-modes/dictation_sm.webp',
  correct: '/images/game-modes/reading_sm.webp',
  follow: '/images/game-modes/speaking_sm.webp',
}
// 弹窗挂载时预加载所有模式图与 hero 图（保证随时打开随时有）
const MODE_PRELOAD = Object.values(MODE_IMG).concat(['/images/game-modes/hero.webp'])
function preloadModeImgs() {
  try {
    MODE_PRELOAD.forEach((u) => { const im = new Image(); im.src = u })
  } catch (e) { /* 忽略 */ }
}

// ============ 弹窗本体 ============
export default function ModePickerModal({ title = '本课', modes = COURSE_MODES, onClose, onStart }) {
  const readyModes = modes.filter((m) => m.ready)
  preloadModeImgs() // 挂载即预加载插图
  const [activeKey, setActiveKey] = useState(readyModes[0]?.key || modes[0].key)
  const active = modes.find((m) => m.key === activeKey) || modes[0]
  const handlePick = (m) => { if (m.ready) setActiveKey(m.key) }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
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
        {/* ===== 左栏：页眉 + 模式列表（对标句乐部：页眉标题 + 卡片式按钮竖列） ===== */}
        <div className="flex flex-col overflow-y-auto custom-scrollbar" style={{ width: 288, flexShrink: 0, borderRight: '1px solid #f0f0f4', background: '#fff' }}>
          <div className="p-5 pb-3">
            <h2 className="text-lg font-bold text-foreground tracking-tight">选择练习模式</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Select Practice Mode</p>
          </div>
          <div className="px-3 pb-3 space-y-1.5">
          {modes.map((m) => {
            const on = m.key === activeKey
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => handlePick(m)}
                className={`relative w-full text-left p-2.5 rounded-xl border transition-all select-none group ${
                  on
                    ? 'bg-primary/10 border-primary text-foreground shadow-xs font-medium'
                    : m.ready
                      ? 'bg-transparent border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                      : 'bg-transparent border-transparent text-muted-foreground opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className={`relative size-11 rounded-lg overflow-hidden flex-shrink-0 bg-muted transition-all ${on ? 'opacity-100 scale-105' : 'opacity-70 group-hover:opacity-90'}`}>
                    <img src={MODE_IMG[m.key]} alt={m.name} className="size-full object-cover transition-all" />
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
        </div>

        {/* ===== 右栏：hero 横幅 + 内容区 + 底部按钮（对标句乐部） ===== */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
          {/* hero 横幅：模式图背景 + 渐变遮罩 + 标题/标签 */}
          <div className="relative h-44 md:h-48 w-full flex-shrink-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent z-10 pointer-events-none"></div>
            <img src="/images/game-modes/hero.webp" alt={active.name} className="size-full object-cover opacity-65 pointer-events-none" style={{ objectPosition: '50% 42%' }} />
            <div className="absolute bottom-3 left-6 md:left-8 z-20 flex items-center gap-2.5 flex-wrap pr-12">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{active.name}</h1>
              {active.heroTag && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide backdrop-blur-md bg-background/85 text-foreground border border-border/70 shadow-xs inline-flex items-center shrink-0">{active.heroTag}</span>
              )}
            </div>
            <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 14, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.7)', color: '#555', fontSize: 16, cursor: 'pointer', zIndex: 30 }}>✕</button>
          </div>

          {/* 内容区 */}
          <div className="px-6 md:px-8 pb-6 pt-2.5 flex flex-col" style={{ flex: 1, overflowY: 'auto' }}>
            <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed mb-4 max-w-2xl">{active.desc}</p>
            <div className="space-y-3.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">核心特性</span>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {active.features.map((f) => (
                  <div key={f.title} className="min-h-16 md:min-h-18 rounded-xl border border-border/70 bg-card flex flex-col items-center justify-center gap-0.5 p-2 text-center">
                    <span className="text-xs font-semibold text-foreground">{f.title}</span>
                    <span className="text-[10px] text-muted-foreground">{f.sub}</span>
                  </div>
                ))}
              </div>
              {active.rhythm && active.rhythm.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2">
                  <div className="text-xs font-semibold text-foreground">推荐学习节奏</div>
                  <div className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                    {active.rhythm.map((r, i) => (
                      <p key={i} className="flex items-start gap-1.5">
                        <span className="size-1 rounded-full bg-primary/60 mt-1.5 shrink-0"></span>
                        <span><strong className="text-foreground font-medium">{r.head}：</strong>{r.text}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="mt-auto pt-4 flex items-center gap-3 px-6 md:px-8 pb-6">
            <button onClick={onClose} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer h-9 px-4 py-2">重新开始</button>
            <button onClick={() => onStart && onStart(active)} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-purple-600 text-white shadow hover:bg-purple-700 cursor-pointer h-9 px-4 py-2 flex-1">{active.cta}</button>
          </div>
        </div>

      </div>
    </div>
  )
}
