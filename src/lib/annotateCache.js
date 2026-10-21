/**
 * annotateCache.js —— 句子标注缓存
 *
 * 原理：进入答题页时就预标注前 20 句，用户答对时直接用缓存，不用等词典加载。
 * 后面的句子异步预标注，避免阻塞 UI。
 */
import { annotateWords } from './wordAnnotate';
import { inferRoles } from './roleRules';

const cache = new Map();

/**
 * 预标注前 N 句（同步，用户可能马上用到）
 * @param {Array} sentences - 句子列表，每项 { ru: "俄语句子", zh: "中文" }
 * @param {number} count - 预标注数量，默认 20
 */
export function preloadAnnotations(sentences, count = 20) {
  if (!Array.isArray(sentences) || sentences.length === 0) return;
  const top = sentences.slice(0, count);
  top.forEach((s) => {
    const ru = s.ru || s.russian || '';
    if (ru && !cache.has(ru)) {
      const dictWords = annotateWords(ru);
      const roleWords = inferRoles(ru, dictWords);
      cache.set(ru, roleWords);
    }
  });
}

/**
 * 异步预标注后面的句子（延迟 100ms，不阻塞 UI）
 * @param {Array} sentences - 句子列表
 * @param {number} start - 从第几句开始预标注
 */
export function preloadAnnotationsAsync(sentences, start = 20) {
  if (!Array.isArray(sentences) || sentences.length <= start) return;
  setTimeout(() => {
    for (let i = start; i < sentences.length; i++) {
      const s = sentences[i];
      const ru = s.ru || s.russian || '';
      if (ru && !cache.has(ru)) {
        try {
          const dictWords = annotateWords(ru);
          const roleWords = inferRoles(ru, dictWords);
          cache.set(ru, roleWords);
        } catch (e) {
          // 预标注失败不影响用户，跳过即可
        }
      }
    }
  }, 100);
}

/**
 * 获取标注结果（命中缓存就直接用）
 * @param {string} sentence - 俄语句子
 * @returns {Array|null} 标注结果，或 null（未命中缓存）
 */
export function getCachedAnnotation(sentence) {
  return cache.get(sentence) || null;
}

/**
 * 清空缓存（切换课程时调用）
 */
export function clearAnnotationCache() {
  cache.clear();
}
