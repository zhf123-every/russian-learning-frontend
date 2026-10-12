import { create } from 'zustand'
import { loadLS, saveLS, LS } from '../lib/persistence'

const defaults = {
  whisperModel: 'small',
  ttsVoice: 'female',
  ttsSource: 'premium', // 发音源：premium=后端高级发音人 / system=浏览器系统发音
  vol: 100, // 音量 0-100
  rate: 1.0,
  loopTimes: 3,
}

export const useSettingsStore = create((set, get) => ({
  settings: { ...defaults, ...loadLS(LS.settings, {}) },
  save(patch) {
    const next = { ...get().settings, ...patch }
    saveLS(LS.settings, next)
    set({ settings: next })
  },
}))
