// unitSentences.js —— 课时句子收集器（例句 + 滚动路径末步）。
// 语块生成 / 批量回填 / 校对页三处的统一句子数据源：
// 课时内容可能只存在滚动路径（scaffoldingPaths）而例句区为空，
// 路径末步即完整句，同样可作为语块数据源。
// 返回 [{ ru, zh }] 对象数组，**严格保序保量**（不过滤重复句）——
// 上传入口改为 CSV/Excel 唯一入口后，文件行顺序 = 学习顺序 = chainIndex 轮换下标，
// 任何去重都会吞行、破坏顺序与轮换对齐，因此这里只过滤空 ru，不去重。
// triggerUnitSegments 兼容 {ru} / {russian} / {text}。

export function collectUnitSentenceObjs(u) {
  const out = []
  const push = (ru, zh) => {
    const k = String(ru || '').trim()
    if (!k) return
    out.push({ ru: k, zh: String(zh || '').trim() })
  }
  ;(u.sentences || []).forEach((s) => push(s && (s.ru || s.russian || s.text), s && (s.chinese || s.zh)))
  ;(u.scaffoldingPaths || []).forEach((p) => {
    const steps = Array.isArray(p.steps) ? p.steps : []
    const last = steps[steps.length - 1]
    push(last && (last.russian || last.ru || last.text), last && (last.chinese || last.zh))
  })
  return out
}

// 句数统计（校对页顶部显示用）
export function countUnitSentences(u) {
  return collectUnitSentenceObjs(u).length
}
