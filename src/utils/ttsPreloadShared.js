/**
 * 预加载共享缓存：Preloader 页真实预载的课程数据与 TTS 音频 URL/对象，
 * 通过 window.__rlearnPreload 共享给后续答题页（路由切换组件重挂载，跨页面共享）。
 * - ttsUrls:  句子文本 → TTS 音频 URL（答题页 ensureTts 命中即免 POST）
 * - ttsAudios: 句子文本 → 已预载内容就绪的 Audio 对象（命中即秒播）
 * - lesson:   预载的课时数据（本地 lesson 结构或后端 build-steps 原始 data）
 * - unitId:   预载对应的单元 ID（防止错页误用）
 */
const KEY = "__rlearnPreload";

// 缓存键按「发音源+音色」隔离：切换发音源/发音类型后旧缓存不命中，新设置立即生效
// （voice 缺省为 "default"，兼容未传音色的旧调用）
function vkey(voice, text) {
  return (voice || "default") + "::" + text;
}

export function getPreloadCache() {
  if (!window[KEY]) {
    window[KEY] = { unitId: "", lesson: null, ttsUrls: {}, ttsAudios: {} };
  }
  return window[KEY];
}

/** 记录某句的 TTS 音频 URL（voiceKey=发音源:音色，如 premium:alena / system:female） */
export function cacheTtsUrl(text, url, voiceKey) {
  if (!text || !url) return;
  getPreloadCache().ttsUrls[vkey(voiceKey, text)] = url;
}

/** 取某句的 TTS 音频 URL（未命中返回空串；需传与写入一致的 voiceKey） */
export function getCachedTtsUrl(text, voiceKey) {
  return (text && getPreloadCache().ttsUrls[vkey(voiceKey, text)]) || "";
}

/** 记录某句已内容就绪的 Audio 对象 */
export function cacheTtsAudio(text, audio, voiceKey) {
  if (!text || !audio) return;
  getPreloadCache().ttsAudios[vkey(voiceKey, text)] = audio;
}

/** 取某句已预载的 Audio 对象（未命中返回 null；需传与写入一致的 voiceKey） */
export function getCachedTtsAudio(text, voiceKey) {
  return (text && getPreloadCache().ttsAudios[vkey(voiceKey, text)]) || null;
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

/**
 * AI 语音对话引导缓存：Preloader 按本课内容预生成的对话引导包
 * data: { topic, greeting_ru, greeting_zh, questions: [ru...], questions_zh: [zh...] }
 */
export function cacheDialogue(unitId, dialogue) {
  const c = getPreloadCache();
  c.dialogue = { unitId: unitId || "", data: dialogue || null };
}

/** 取预载的对话引导包（unitId 不一致返回 null） */
export function getCachedDialogue(unitId) {
  const c = getPreloadCache();
  return c.dialogue && c.dialogue.unitId === unitId ? c.dialogue.data : null;
}

/** 记录「正在生成的对话引导 Promise」（Preloader 发起 → 答题页 await 复用，避免重复请求） */
export function cacheDialoguePromise(unitId, promise) {
  getPreloadCache().dialoguePromise = { unitId: unitId || "", promise: promise || null };
}

/** 取正在生成的对话引导 Promise（unitId 不一致返回 null） */
export function getDialoguePromise(unitId) {
  const c = getPreloadCache();
  return c.dialoguePromise && c.dialoguePromise.unitId === unitId ? c.dialoguePromise.promise : null;
}
