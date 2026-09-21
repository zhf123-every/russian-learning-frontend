// 解锁游戏商城 · 全部课程目录（商城页 / 我的游戏页共用）
// 每项 id 全局唯一；packId 对应后端 /api/course-packs 的真实课程包 id（用于后续同步学习进度）
// section: featured=本周精选  video=通关视频  guide=通关秘籍

export const GAME_CATALOG = [
  // ===== 本周精选 =====
  {
    id: 'privet_rossiya_a1', packId: 'privet_rossiya_a1', section: 'featured', kind: 'cover',
    cover: 'bg-gradient-to-br from-indigo-600 to-violet-700', ink: 'text-white', big: 'Привет, Россия!',
    title: 'Привет, Россия! 零基础俄语（new）', desc: '最适合零基础入门，从发音到日常对话循序渐进',
    meta: '官方 · 61 课 · 30.5 万人在学', total: 61,
  },
  {
    id: 'newconcept_1', section: 'featured', kind: 'cover',
    cover: 'border-[3px] border-red-500 bg-red-50', ink: 'text-red-600', big: '新概念俄语 第1册',
    title: '新概念俄语第1册【原版音频】', desc: '专为零基础设计的俄语启蒙必修课',
    meta: 'Aviva · 71 课 · 2.1 万人在学', total: 71,
  },
  {
    id: 'words_850', section: 'featured', kind: 'cover',
    cover: 'bg-gradient-to-br from-sky-100 to-blue-200', ink: 'text-blue-900', big: '从 850 个词',
    title: '句乐部的简单俄语表达课', desc: '850 个基础词，1746 个练习句，练到脱口而出',
    meta: '句乐部 · 85 课 · 1.3 万人在学', total: 85,
  },
  {
    id: 'around_russia', section: 'featured', kind: 'cover',
    cover: 'bg-gradient-to-br from-emerald-700 to-green-900', ink: 'text-white', big: '走遍俄罗斯',
    title: '走遍俄罗斯第一册', desc: '北外经典教材配套闯关课程',
    meta: '北外 · 72 课 · 4.5 万人在学', total: 72,
  },

  // ===== 通关视频 =====
  {
    id: 'video_hello', section: 'video', kind: 'video',
    cover: 'bg-gradient-to-br from-rose-400 to-pink-600', eps: '12 集',
    title: '俄语课程视频 · 问候篇', desc: '真人视频情景教学，12 集通关', total: 12,
  },
  {
    id: 'video_grammar', section: 'video', kind: 'video',
    cover: 'bg-gradient-to-br from-amber-400 to-orange-500', eps: '8 集',
    title: '语法讲解视频 · 名词变格', desc: '六大格变格一次讲透，8 集通关', total: 8,
  },
  {
    id: 'video_anime', section: 'video', kind: 'video',
    cover: 'bg-gradient-to-br from-teal-400 to-cyan-600', eps: '20 集',
    title: '影视音乐 · 动画片头', desc: '影视音乐类视频合集，20 集通关', total: 20,
  },
  {
    id: 'video_numbers', section: 'video', kind: 'video',
    cover: 'bg-gradient-to-br from-fuchsia-500 to-purple-700', eps: '6 集',
    title: '俄语课程视频 · 数字篇', desc: '数字主题视频课程，6 集通关', total: 6,
  },
  {
    id: 'video_listen', section: 'video', kind: 'video',
    cover: 'bg-gradient-to-br from-lime-400 to-green-600', eps: '15 集',
    title: '听力训练视频 · 日常对话', desc: '真实场景俄语听力，15 集通关', total: 15,
  },

  // ===== 通关秘籍 =====
  {
    id: 'guide_alphabet', section: 'guide', kind: 'cover',
    cover: 'bg-gradient-to-br from-sky-100 to-sky-300', ink: 'text-sky-800', word: 'А Б В Г Д',
    title: '字母发音 · 33 课', desc: '从零开始学俄语字母与发音', total: 33,
  },
  {
    id: 'guide_dialog', section: 'guide', kind: 'cover',
    cover: 'bg-gradient-to-br from-amber-200 to-orange-300', ink: 'text-orange-900', word: 'Привет!',
    title: '场景对话 · 40 课', desc: '日常场景对话实战练习', total: 40,
  },
  {
    id: 'guide_grammar', section: 'guide', kind: 'cover',
    cover: 'bg-gradient-to-br from-violet-200 to-purple-400', ink: 'text-purple-900', word: 'Грамматика',
    title: '语法专练 · 56 课', desc: '核心语法点专项训练', total: 56,
  },
  {
    id: 'guide_listen', section: 'guide', kind: 'cover',
    cover: 'bg-gradient-to-br from-cyan-100 to-teal-300', ink: 'text-teal-900', word: 'Слушаем',
    title: '听力训练 · 38 课', desc: '分级听力训练课程', total: 38,
  },
  {
    id: 'guide_read', section: 'guide', kind: 'cover',
    cover: 'bg-gradient-to-br from-emerald-200 to-green-400', ink: 'text-emerald-900', word: 'Читаем',
    title: '阅读提升 · 30 课', desc: '俄语阅读能力提升', total: 30,
  },
]

export const FEATURED = GAME_CATALOG.filter((g) => g.section === 'featured')
export const VIDEOS = GAME_CATALOG.filter((g) => g.section === 'video')
export const GUIDES = GAME_CATALOG.filter((g) => g.section === 'guide')

/** 按 id 查课程，未找到返回 undefined */
export function findGameById(id) {
  return GAME_CATALOG.find((g) => g.id === id)
}
