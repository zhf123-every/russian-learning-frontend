import { create } from 'zustand'
import { loadLS, saveLS, LS } from '../lib/persistence'

const defaults = {
  whisperModel: 'small',
  ttsVoice: 'female',
  ttsSource: 'premium', // 发音源：premium=后端高级发音人 / system=浏览器系统发音
  vol: 100, // 音量 0-100
  rate: 1.0,
  loopTimes: 3,
  aiVoice: 'female', // AI 朗读声音（与答题页发音类型 ttsVoice 解耦，避免互相覆盖）
}

export const useSettingsStore = create((set, get) => ({
  settings: { ...defaults, ...loadLS(LS.settings, {}) },
  save(patch) {
    const next = { ...get().settings, ...patch }
    // localStorage 配额超限时，保存失败但仍然更新 zustand store，保证当前会话生效
    try {
      saveLS(LS.settings, next)
    } catch (e) {
      console.warn('[settingsStore] localStorage 保存失败，仅更新内存:', e)
    }
    set({ settings: next })
    // 触发 quest-ui-changed 事件，让答题页重新读取设置
    try { window.dispatchEvent(new Event('quest-ui-changed')) } catch (e) {}
  },
}))
