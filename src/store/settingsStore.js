import { create } from 'zustand'
import { loadLS, saveLS, LS } from '../lib/persistence'

const defaults = {
  whisperModel: 'small',
  ttsVoice: 'female',
  ttsSource: 'premium', // 发音源：premium=后端高级发音人 / system=浏览器系统发音
  ttsVoiceName: 'Svetlana', // 发音类型（发音人姓名）
  ttsVolume: 1.0, // 发音音量 0-1
  autoRead: true,
  answerAutoPlay: true, // 答案页自动播放声音
  questionAutoPlay: true, // 答题页自动播放声音
  typingSound: true, // 打字音效开关
  typingSoundType: 'drum', // 打字音效类型（鼓点/键盘/气泡等）
  typingSoundVolume: 1.0, // 打字音效音量 0-1
  feedbackSound: true, // 操作反馈音效开关（答对/答错/完成）
  feedbackSoundVolume: 1.0, // 反馈音效音量 0-1
  voiceURI: '',
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
