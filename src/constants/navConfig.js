// 学习仪表盘导航配置（桌面侧栏、手机抽屉、底部 Tab、Hub 落地页共用）
// icon 使用 SVG path 字符串，组件中渲染为线性图标

const ICONS = {
  home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  gamepad: 'M6 11h4 M8 9v4 M15 12h.01 M18 10h.01 M2 16a2 2 0 002 2h16a2 2 0 002-2V10a2 2 0 00-2-2H4a2 2 0 00-2 2z',
  play: 'M6 4l14 8-14 8z',
  map: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z M8 2v16 M16 6v16',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  bell: 'M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0',
  database: 'M12 3c5 0 9 1.34 9 3s-4 3-9 3-9-1.34-9-3 4-3 9-3z M21 12c0 1.66-4 3-9 3s-9-1.34-9-3 M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5',
  barChart: 'M18 20V10 M12 20V4 M6 20v-6',
  book: 'M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
  fileText: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8',
  help: 'M12 22a10 10 0 100-20 10 10 0 000 20z M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3 M12 17h.01',
}

export const NAV_HOME = { to: '/', icon: ICONS.home, label: '主页', end: true }

export const NAV_GROUPS = [
  { type: 'item', ...NAV_HOME },
  { type: 'item', to: '/unlocked-games', icon: ICONS.gamepad, label: '解锁游戏' },
  { type: 'item', to: '/my-games', icon: ICONS.play, label: '我的游戏' },
  { type: 'item', to: '/journey', icon: ICONS.map, label: '通关之路' },
  {
    type: 'collapsible', label: '社区', icon: ICONS.users,
    items: [
      { to: '/community/notifications', icon: ICONS.bell, label: '消息通知', soon: true },
      { to: '/community/groups', icon: ICONS.users, label: '学习小组', soon: true },
    ],
  },
  {
    type: 'collapsible', label: '通关存档', icon: ICONS.database,
    items: [
      { to: '/save/proficiency', icon: ICONS.barChart, label: '关卡熟练度' },
      { to: '/vocab', icon: ICONS.book, label: '复习关卡', badgeKey: 'vocabDue' },
      { to: '/save/notes', icon: ICONS.fileText, label: '关卡笔记' },
      { to: '/save/unknown', icon: ICONS.help, label: '陌生关卡' },
    ],
  },
]

// 手机底部 Tab
export const TABBAR = [
  { to: '/', icon: ICONS.home, label: '主页', end: true },
  { to: '/unlocked-games', icon: ICONS.gamepad, label: '游戏' },
  { to: '/journey', icon: ICONS.map, label: '通关' },
  { to: '/me', icon: ICONS.users, label: '我的' },
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

// 我的落地页
export const ME_CARDS = [
  { icon: '🗂️', title: '学习档案', desc: '按单元 / 家族查看完成情况与掌握度。', soon: '即将上线' },
  { icon: '🔥', title: '打卡记录', desc: '连续打卡、学习热力图与每日目标完成情况。', soon: '即将上线' },
  { icon: '⚙️', title: '设置', desc: '发音、语速、主题与学习偏好。', soon: '即将上线' },
]