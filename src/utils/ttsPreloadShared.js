/**
 * 预加载共享缓存：Preloader 页真实预载的课程数据与 TTS 音频 URL/对象，
 * 通过 window.__rlearnPreload 共享给后续答题页（路由切换组件重挂载，跨页面共享）。
 * - ttsUrls:  句子文本 → TTS 音频 URL（答题页 ensureTts 命中即免 POST）
 * - ttsAudios: 句子文本 → 已预载内容就绪的 Audio 对象（命中即秒播）
 * - lesson:   预载的课时数据（本地 lesson 结构或后端 build-steps 原始 data）
 * - unitId:   预载对应的单元 ID（防止错页误用）
 */
const KEY = "__rlearnPreload";

export function getPreloadCache() {
  if (!window[KEY]) {
    window[KEY] = { unitId: "", lesson: null, ttsUrls: {}, ttsAudios: {} };
  }
  return window[KEY];
}

/** 记录某句的 TTS 音频 URL */
export function cacheTtsUrl(text, url) {
  if (!text || !url) return;
  getPreloadCache().ttsUrls[text] = url;
}

/** 取某句的 TTS 音频 URL（未命中返回空串） */
export function getCachedTtsUrl(text) {
  return (text && getPreloadCache().ttsUrls[text]) || "";
}

/** 记录某句已内容就绪的 Audio 对象 */
export function cacheTtsAudio(text, audio) {
  if (!text || !audio) return;
  getPreloadCache().ttsAudios[text] = audio;
}

/** 取某句已预载的 Audio 对象（未命中返回 null） */
export function getCachedTtsAudio(text) {
  return (text && getPreloadCache().ttsAudios[text]) || null;
}

/** 记录预载的课时数据（仅当 unitId 一致时有效） */
export function cacheLesson(unitId, lesson) {
  const c = getPreloadCache();
  c.unitId = unitId || "";
  c.lesson = lesson || null;
}

/** 取预载的课时数据（unitId 不一致返回 null，避免串课） */
export function getCachedLesson(unitId) {
  const c = getPreloadCache();
  return c.unitId === unitId ? c.lesson : null;
}
