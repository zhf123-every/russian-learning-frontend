// 学习事件埋点（占位 → P0-1 接真实上报）
// 控制台打印 + 本地 streak 同步；后端就绪后在此接入 /api/dashboard/event。
import { getStreak, bumpStreak } from './todayFlow'

export const TRACK_EVENT = {
  MANUAL_CHECKIN: 'manual_checkin',        // 手动打卡
  LISTEN_FINISH: 'listen_finish',          // 五步精听完成
  QUEST_UNIT_FINISH: 'quest_unit_finish',  // 句子闯关单元完成
  AI_CHAT_END: 'ai_chat_end',             // AI 对话会话结束
}

// 上报到后端（失败静默，不影响主流程）
async function postEvent(eventName, payload) {
  try {
    const base = import.meta.env.VITE_API_BASE || 'https://russian-learning-jetq.onrender.com'
    await fetch(`${base}/api/dashboard/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: eventName, payload }),
    })
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[埋点上报失败]', eventName, e)
  }
}

export function trackStudyComplete(eventName, payload) {
  if (import.meta.env.DEV) console.log('[埋点预留]', eventName, payload || '')

  // 自动打卡 / 连胜：训练类完成事件视为完成今日对应步骤
  if (eventName === TRACK_EVENT.LISTEN_FINISH) {
    try { bumpStreak() } catch (e) {}
    window.dispatchEvent(new Event('rlearn:flow-changed'))
  }
  if (eventName === TRACK_EVENT.QUEST_UNIT_FINISH) {
    try { bumpStreak() } catch (e) {}
    window.dispatchEvent(new Event('rlearn:flow-changed'))
  }
  if (eventName === TRACK_EVENT.AI_CHAT_END) {
    try { bumpStreak() } catch (e) {}
    window.dispatchEvent(new Event('rlearn:flow-changed'))
  }

  // 真实上报（异步，不阻塞）
  postEvent(eventName, payload)
}

// 读取本地 streak（后端 /api/dashboard/stats 就绪后优先用后端值）
export function localStreak() {
  try { return getStreak() || 0 } catch (e) { return 0 }
}