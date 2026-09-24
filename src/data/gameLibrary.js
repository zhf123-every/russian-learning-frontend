// 解锁游戏商城 · 课程目录
// 说明：内置"课程"（本周精选/通关秘籍）已全部移除——课程只来自用户投稿（gameCourseStore + 云端 kind=course）
// 此处仅保留内置演示视频（供通关视频区 / 视频学习页测试用）
// section: video = 通关视频
export const GAME_CATALOG = [
  {
    id: 'video_hello', section: 'video', kind: 'video', cat: '基础入门',
    cover: 'bg-gradient-to-br from-rose-400 to-pink-600', eps: '12 集',
    title: '俄语课程视频 · 问候篇', desc: '真人视频情景教学，12 集通关', total: 12,
  },
  {
    id: 'video_grammar', section: 'video', kind: 'video', cat: '语法专练',
    cover: 'bg-gradient-to-br from-amber-400 to-orange-500', eps: '8 集',
    title: '语法讲解视频 · 名词变格', desc: '六大格变格一次讲透，8 集通关', total: 8,
  },
  {
    id: 'video_anime', section: 'video', kind: 'video', cat: '影视音乐',
    cover: 'bg-gradient-to-br from-teal-400 to-cyan-600', eps: '20 集',
    title: '影视音乐 · 动画片头', desc: '影视音乐类视频合集，20 集通关', total: 20,
  },
  {
    id: 'video_numbers', section: 'video', kind: 'video', cat: '基础入门',
    cover: 'bg-gradient-to-br from-fuchsia-500 to-purple-700', eps: '6 集',
    title: '俄语课程视频 · 数字篇', desc: '数字主题视频课程，6 集通关', total: 6,
  },
  {
    id: 'video_listen', section: 'video', kind: 'video', cat: '听力训练',
    cover: 'bg-gradient-to-br from-lime-400 to-green-600', eps: '15 集',
    title: '听力训练视频 · 日常对话', desc: '真实场景俄语听力，15 集通关', total: 15,
  },
]

export const FEATURED = GAME_CATALOG.filter((g) => g.section === 'featured')
export const VIDEOS = GAME_CATALOG.filter((g) => g.section === 'video')
export const GUIDES = GAME_CATALOG.filter((g) => g.section === 'guide')

/** 按 id 查课程（内置目录；投稿课程请查 useGameCourseStore / 云端 kind=course），未找到返回 undefined */
export function findGameById(id) {
  return GAME_CATALOG.find((g) => g.id === id)
}
