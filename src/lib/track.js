// 学习事件埋点（占位）
// 本次任务只定义事件常量与入口，控制台打印，不做任何自动打卡/上报。
// P0-1 阶段在此函数内接入真实上报（训练流完成自动打卡），调用方无需改动。

export const TRACK_EVENT = {
  MANUAL_CHECKIN: 'manual_checkin',        // 手动打卡
  LISTEN_FINISH: 'listen_finish',          // 五步精听完成
  QUEST_UNIT_FINISH: 'quest_unit_finish',  // 句子闯关单元完成
  AI_CHAT_END: 'ai_chat_end',             // AI 对话会话结束
}

export function trackStudyComplete(eventName, payload) {
  // TODO(P0-1): 接入 /api/dashboard/event 上报，并驱动自动打卡/连胜。
  if (import.meta.env.DEV) {
    console.log('[埋点预留]', eventName, payload || '')
  }
}
