// 学习仪表盘导航配置（桌面侧栏、手机抽屉、底部 Tab、Hub 落地页共用）

export const NAV_HOME = { to: '/', icon: '🏠', label: '主页', end: true }

export const NAV_GROUPS = [
  { type: 'item', ...NAV_HOME },
  {
    type: 'group', label: '学习', items: [
      { to: '/quest-store', icon: '🎮', label: '游戏化学习' },
      { to: '/square', icon: '🎧', label: '精听学习' },
      { to: '/tutor', icon: '🗣️', label: 'AI 对话教练' },
    ],
  },
  {
    type: 'group', label: '工具', items: [
      { to: '/vocab', icon: '📒', label: '生词本', badgeKey: 'vocabDue' },
      { to: '/dictionary', icon: '🔎', label: '词典' },
      { to: '/profile', icon: '📊', label: '统计' },
    ],
  },
  {
    type: 'group', label: '账户', items: [
      { to: '/me', icon: '👤', label: '我的' },
    ],
  },
]

// 手机底部 Tab（4 个一级入口；学习/工具进落地页）
export const TABBAR = [
  { to: '/', icon: '🏠', label: '主页', end: true },
  { to: '/learn', icon: '📚', label: '学习' },
  { to: '/tools', icon: '🧰', label: '工具' },
  { to: '/me', icon: '👤', label: '我的' },
]

// 学习落地页
export const LEARN_CARDS = [
  {
    icon: '🎮', to: '/quest-store', title: '游戏化学习',
    desc: '课程包 → 12 单元 → 句型家族渐进构建，连词成句、连击评分、逐词语法拆解。',
    tags: ['463 步', '22 家族', '中译俄 / 听写'],
    tone: { bg: 'var(--db-brand-soft)', color: 'var(--db-brand)' },
  },
  {
    icon: '🎧', to: '/square', title: '精听学习',
    desc: '学习广场：浏览公开视频素材，或上传自己的视频自动转写断句，按五步精听训练。',
    tags: ['盲听 · 听写', '精读 · 跟读 · 复述', '素材共享'],
    tone: { bg: 'var(--db-card-2)', color: 'var(--db-text)' },
  },
  {
    icon: '🗣️', to: '/tutor', title: 'AI 对话教练',
    desc: '和 AI 老师自由聊天，分 A1–B2 等级，说错即时纠正语法并引导你重说。',
    tags: ['A1–B2', '实时纠错', '语音陪练'],
    tone: { bg: 'var(--db-amber-soft)', color: 'var(--db-amber-h)' },
  },
]

// 工具落地页
export const TOOLS_CARDS = [
  {
    icon: '📒', to: '/vocab', title: '生词本',
    desc: '学习中收藏的生词，按间隔重复算法安排复习，到期词会在导航中提醒。',
    tags: ['间隔重复 SRS'],
    tone: { bg: 'var(--db-danger-soft)', color: 'var(--db-danger)' },
  },
  {
    icon: '🔎', to: '/dictionary', title: '词典',
    desc: '俄语单词查询，含重音、词性、变格与例句。',
    tags: ['重音', '变格'],
    tone: { bg: 'var(--db-brand-soft)', color: 'var(--db-brand)' },
  },
  {
    icon: '📊', to: '/profile', title: '统计',
    desc: '学习数据、答题表现与掌握情况总览。',
    tags: ['学习数据'],
    tone: { bg: 'var(--db-card-2)', color: 'var(--db-text)' },
  },
]

// 我的落地页（第一批为占位，第三批建设）
export const ME_CARDS = [
  { icon: '🗂️', title: '学习档案', desc: '按单元 / 家族查看完成情况与掌握度。', soon: '即将上线' },
  { icon: '🔥', title: '打卡记录', desc: '连续打卡、学习热力图与每日目标完成情况。', soon: '即将上线' },
  { icon: '⚙️', title: '设置', desc: '发音、语速、主题与学习偏好。', soon: '即将上线' },
]
