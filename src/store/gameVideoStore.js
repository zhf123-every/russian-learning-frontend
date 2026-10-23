// 通关视频 · 用户投稿视频库（本地持久化）
// 投稿后的视频会出现在「游戏商城 → 通关视频」区（影视音乐等分类）
// 字段对齐 gameLibrary 的 video 条目，另存 videoUrl/thumbnail/level 供播放与展示
import { create } from 'zustand'
import { loadLS, saveLS } from '../lib/persistence'

const LS_GAME_VIDEOS = 'rlearn_v1_game_videos'

export const useGameVideoStore = create((set, get) => ({
  videos: loadLS(LS_GAME_VIDEOS, []),

  // 投稿：新视频排最前；localStorage 保存失败时返回 false（内存仍更新）
  submit(item) {
    const videos = [item, ...get().videos]
    const ok = saveLS(LS_GAME_VIDEOS, videos)
    set({ videos })
    return ok
  },

  remove(id) {
    const videos = get().videos.filter(v => v.id !== id)
    saveLS(LS_GAME_VIDEOS, videos)
    set({ videos })
  },

  // 替换条目的部分字段（如重新上传后的 videoUrl），保留其余（标题/字幕/分类）
  update(id, patch) {
    const videos = get().videos.map(v => (v.id === id ? { ...v, ...patch } : v))
    saveLS(LS_GAME_VIDEOS, videos)
    set({ videos })
  },

  // 已投稿的视频总数（用于解锁判断：投稿即已解锁，无需再点解锁）
  isUploaded(id) {
    return get().videos.some(v => v.id === id)
  },
}))
