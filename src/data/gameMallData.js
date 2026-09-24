// ========== 游戏商城 · Mock 数据 ==========
// 年级列表（对标句乐部"教材同步"页学段栏）
export const GRADES = [
  '全部',
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
  '七年级', '八年级', '九年级', '高中',
]

// 教材版本列表（俄语实际常用教材）
export const TEXTBOOKS = [
  '全部',
  '走遍俄罗斯',   // 国内最主流的俄语入门教材（外研社出版）
  '大学俄语',     // 北外《大学俄语》（东方）系列，高校俄语专业主流
  '东方俄语',     // 黑龙江大学《东方俄语》
  '新概念俄语',   // 俄罗斯视角编写的综合教材
  '黑大俄语',     // 黑大《俄语》教材（中学俄语常用）
  '北外俄语',     // 北外自编俄语系列
  '自编课',       // 管理员自编内容
]

// 课程包列表（14 条；"版本 × 年级"有真实对应关系）
export const COURSES = [
  // ── 走遍俄罗斯 · 六年级（3 个）──
  {
    id: 'course_01',
    cover: 'https://picsum.photos/seed/course01/400/280',
    title: '走遍俄罗斯 · 六年级上册精讲',
    subtitle: '第1-15课 · 语音基础与日常会话',
    badge: '精选',
    author: '管理员',
    lessons: 15,
    students: 2860,
    grade: '六年级',
    textbook: '走遍俄罗斯',
  },
  {
    id: 'course_02',
    cover: 'https://picsum.photos/seed/course02/400/280',
    title: '走遍俄罗斯 · 六年级下册精讲',
    subtitle: '第16-30课 · 动词变位与情景对话',
    badge: '热销',
    author: '管理员',
    lessons: 15,
    students: 2140,
    grade: '六年级',
    textbook: '走遍俄罗斯',
  },
  {
    id: 'course_03',
    cover: 'https://picsum.photos/seed/course03/400/280',
    title: '走遍俄罗斯 · 六年级词汇闯关',
    subtitle: '六年级必背 300 词 · 闯关式复习',
    badge: '新',
    author: '管理员',
    lessons: 30,
    students: 1580,
    grade: '六年级',
    textbook: '走遍俄罗斯',
  },
  // ── 走遍俄罗斯 · 七年级（2 个）──
  {
    id: 'course_04',
    cover: 'https://picsum.photos/seed/course04/400/280',
    title: '走遍俄罗斯 · 七年级上册精讲',
    subtitle: '名词六格入门 · 课文逐句精读',
    badge: '精选',
    author: '管理员',
    lessons: 18,
    students: 1760,
    grade: '七年级',
    textbook: '走遍俄罗斯',
  },
  {
    id: 'course_05',
    cover: 'https://picsum.photos/seed/course05/400/280',
    title: '走遍俄罗斯 · 七年级语法专练',
    subtitle: '格的用法全梳理 · 配 300 道练习',
    badge: '',
    author: '管理员',
    lessons: 24,
    students: 930,
    grade: '七年级',
    textbook: '走遍俄罗斯',
  },
  // ── 新概念俄语 · 七年级（1 个）──
  {
    id: 'course_06',
    cover: 'https://picsum.photos/seed/course06/400/280',
    title: '新概念俄语 · 七年级同步课',
    subtitle: '教材课文 + 情景对话双轨学习',
    badge: '',
    author: '管理员',
    lessons: 20,
    students: 640,
    grade: '七年级',
    textbook: '新概念俄语',
  },
  // ── 东方俄语 · 八年级（2 个）──
  {
    id: 'course_07',
    cover: 'https://picsum.photos/seed/course07/400/280',
    title: '东方俄语 · 八年级精讲',
    subtitle: '动词完成体/未完成体 · 课文精讲',
    badge: '精选',
    author: '管理员',
    lessons: 16,
    students: 1120,
    grade: '八年级',
    textbook: '东方俄语',
  },
  {
    id: 'course_08',
    cover: 'https://picsum.photos/seed/course08/400/280',
    title: '东方俄语 · 八年级阅读提升',
    subtitle: '短篇阅读 40 篇 · 逐篇精讲',
    badge: '',
    author: '管理员',
    lessons: 40,
    students: 780,
    grade: '八年级',
    textbook: '东方俄语',
  },
  // ── 黑大俄语 · 九年级（1 个）──
  {
    id: 'course_09',
    cover: 'https://picsum.photos/seed/course09/400/280',
    title: '黑大俄语 · 九年级总复习',
    subtitle: '初中语法体系串联 · 中考备考',
    badge: '备考',
    author: '管理员',
    lessons: 36,
    students: 1520,
    grade: '九年级',
    textbook: '黑大俄语',
  },
  // ── 大学俄语 · 高中（2 个）──
  {
    id: 'course_10',
    cover: 'https://picsum.photos/seed/course10/400/280',
    title: '大学俄语 · 高中衔接班',
    subtitle: '从初高中俄语直通大学俄语',
    badge: '衔接',
    author: '管理员',
    lessons: 28,
    students: 880,
    grade: '高中',
    textbook: '大学俄语',
  },
  {
    id: 'course_11',
    cover: 'https://picsum.photos/seed/course11/400/280',
    title: '大学俄语 · 高考俄语冲刺',
    subtitle: '近 5 年高考俄语真题逐题精讲',
    badge: '热销',
    author: '管理员',
    lessons: 45,
    students: 2340,
    grade: '高中',
    textbook: '大学俄语',
  },
  // ── 北外俄语 · 高中（1 个）──
  {
    id: 'course_12',
    cover: 'https://picsum.photos/seed/course12/400/280',
    title: '北外俄语 · 高中进阶阅读',
    subtitle: '俄语报刊选读 · 文化与国情拓展',
    badge: '',
    author: '管理员',
    lessons: 22,
    students: 560,
    grade: '高中',
    textbook: '北外俄语',
  },
  // ── 走遍俄罗斯 · 一年级（1 个启蒙）──
  {
    id: 'course_13',
    cover: 'https://picsum.photos/seed/course13/400/280',
    title: '走遍俄罗斯 · 一年级字母启蒙',
    subtitle: '33 个字母 + 拼读儿歌动画',
    badge: '新',
    author: '管理员',
    lessons: 12,
    students: 1960,
    grade: '一年级',
    textbook: '走遍俄罗斯',
  },
  // ── 自编课 · 高中（1 个）──
  {
    id: 'course_14',
    cover: 'https://picsum.photos/seed/course14/400/280',
    title: '自编课 · 高中俄语口语实战',
    subtitle: '日常对话 50 场景 · 开口就练',
    badge: '',
    author: '管理员',
    lessons: 50,
    students: 710,
    grade: '高中',
    textbook: '自编课',
  },
]
