// 解锁游戏商城 · 课程目录
// 说明：内置"课程"（本周精选/通关秘籍）已全部移除——课程只来自用户投稿（gameCourseStore + 云端 kind=course）
// 此处仅保留内置演示视频（供通关视频区 / 视频学习页测试用）
// section: video = 通关视频
// 所有内置演示课程/视频已移除——内容只来自管理员投稿（云端 kind=course / kind=video）
export const GAME_CATALOG = []

export const FEATURED = GAME_CATALOG.filter((g) => g.section === 'featured')
export const VIDEOS = GAME_CATALOG.filter((g) => g.section === 'video')
export const GUIDES = GAME_CATALOG.filter((g) => g.section === 'guide')

/** 按 id 查课程（内置目录；投稿课程请查 useGameCourseStore / 云端 kind=course），未找到返回 undefined */
export function findGameById(id) {
  return GAME_CATALOG.find((g) => g.id === id)
}
