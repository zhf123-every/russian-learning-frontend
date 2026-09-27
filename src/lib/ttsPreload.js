// ttsPreload.js —— 进答题页之前全量预载单元音频（并发受限 + 进度回调 + 单句超时）
// 用途：数据就绪后、进入答题界面之前，把本单元所有句子的发音内容预载完成，
// 保证进入答题页后任何发音（自动播放/答对/点击）都即时，无延迟不播放。
// 单句超时保护：某句 TTS/音频源不可用时跳过该句，不让预载整体卡死。
export async function preloadTtsAll(items, ensureFn, { concurrency = 4, onProgress, timeout = 12000 } = {}) {
  const seen = new Set();
  const list = [];
  for (const it of items) {
    const text = it?.russian || it?.ru || "";
    if (!text || seen.has(text)) continue;
    seen.add(text);
    list.push(it);
  }
  const total = list.length;
  if (!total) { try { onProgress && onProgress(0, 0); } catch (e) {} return 0; }
  let done = 0;
  const withTimeout = (p) => Promise.race([
    p,
    new Promise((resolve) => setTimeout(resolve, timeout)),
  ]);
  const n = Math.min(concurrency, total);
  const workers = Array.from({ length: n }, async () => {
    while (list.length) {
      const it = list.shift();
      try { await withTimeout(ensureFn(it)); } catch (e) { /* 单句失败不阻塞进入 */ }
      done += 1;
      try { onProgress && onProgress(done, total); } catch (e) {}
    }
  });
  await Promise.all(workers);
  return total;
}
