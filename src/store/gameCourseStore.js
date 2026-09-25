// 通关课程 · 用户投稿课程库（本地持久化）
// 投稿后的课程会出现在「游戏商城」页（带"投稿"标记），点击进入游戏详情页显示真实关卡大纲
// 云端名单与视频共用 B2 videos/index.json（kind='course' 区分），sync 时与视频合并传输
import { create } from 'zustand'
import { loadLS, saveLS } from '../lib/persistence'

const LS_GAME_COURSES = 'rlearn_v1_game_courses'

export const useGameCourseStore = create((set, get) => ({
  courses: loadLS(LS_GAME_COURSES, []),

  // 投稿：新课程排最前；localStorage 保存失败时返回 false（内存仍更新）
  submit(item) {
    const courses = [item, ...get().courses]
    const ok = saveLS(LS_GAME_COURSES, courses)
    set({ courses })
    return ok
  },

  remove(id) {
    const courses = get().courses.filter(c => c.id !== id)
    saveLS(LS_GAME_COURSES, courses)
    set({ courses })
  },

  // 按 id 查投稿课程
  find(id) {
    return get().courses.find(c => c.id === id)
  },

  // 已投稿的课程总数
  isUploaded(id) {
    return get().courses.some(c => c.id === id)
  },
}))
