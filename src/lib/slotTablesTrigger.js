// slotTablesTrigger.js —— P2：保存课时后异步触发表格生成（6 列表格 → 课时维度持久化 sentence_slot_unit_tables）。
//
// 方案 A（用户已拍板）：每课第 1 句 = 核心长链（~190 步），其余句子 = 短链（~20 步）；
// 三档难度（easy / medium / hard）各生成一次（学生端难度联动出题粒度）。
//
// 边界（与 segmentTrigger 同款，写进契约文档）：
// - inFlight 只防"同页面内"重复触发；跨标签页 / 跨浏览器 / 关页面重开不防。
//   重复触发由后端 table-fill 幂等缓存 + save replace（整课时重写）兜底，成本可控。
// - 关页面后不保证本次生成完成；下次打开课时时由 retryPendingSlotTables 自动补跑。
// - 不做 sendBeacon / keepalive；失败由"下次打开"兜底。
// - 前端禁止直连 LLM：httpPost 必须从 deps 注入（由调用方包装 apiFetch + authBody + 403 重试）。
import { generateUnitTableAsync } from './jlTableEngine.js'
import { normalizeSentence, sentenceHash } from './segmentEngine.js'

const STORAGE_KEY = 'rb_pending_slot_tables'
const inFlight = new Set()
const DIFFICULTIES = ['easy', 'medium', 'hard']

// 默认课级词池（2026-10-06 扩充：时间 20 / 地点 20 / 事物宾语 26 / 谓语 20）
// 拼装约束（机器拼装保证正确性）：
// - time/place：必须是可直接作状语的副词或正确前置格介词短语（в школе、в Москве）
// - objects：ru 必须是宾格形式，inf 是搭配的不定式（есть еду / пить воду → "Я хочу есть еду"）
// - predicates：Я 型变位/短尾（хочу、могу、должен、рад…）+ Мне 型（нужно/надо/можно/нельзя，后端有 nominal_pred 特判）
// 变体行 poolIndex 由 jlTableEngine 按句子确定性轮换（同句稳定、不同句换词）
export const DEFAULT_SLOT_POOL = {
  negation: [{ ru: 'не', zh: '不' }],
  time: [
    { ru: 'сейчас', zh: '现在' }, { ru: 'сегодня', zh: '今天' }, { ru: 'завтра', zh: '明天' },
    { ru: 'вчера', zh: '昨天' }, { ru: 'утром', zh: '早上' }, { ru: 'днём', zh: '白天' },
    { ru: 'вечером', zh: '晚上' }, { ru: 'ночью', zh: '夜里' }, { ru: 'скоро', zh: '很快' },
    { ru: 'потом', zh: '以后' }, { ru: 'сразу', zh: '立刻' }, { ru: 'уже', zh: '已经' },
    { ru: 'ещё', zh: '还' }, { ru: 'всегда', zh: '总是' }, { ru: 'часто', zh: '经常' },
    { ru: 'иногда', zh: '有时' }, { ru: 'редко', zh: '很少' }, { ru: 'обычно', zh: '通常' },
    { ru: 'рано', zh: '早' }, { ru: 'поздно', zh: '晚' },
  ],
  place: [
    { ru: 'здесь', zh: '这里' }, { ru: 'там', zh: '那里' }, { ru: 'дома', zh: '在家' },
    { ru: 'рядом', zh: '旁边' }, { ru: 'везде', zh: '到处' }, { ru: 'наверху', zh: '在上面' },
    { ru: 'внизу', zh: '在下面' }, { ru: 'справа', zh: '在右边' }, { ru: 'слева', zh: '在左边' },
    { ru: 'впереди', zh: '在前面' }, { ru: 'сзади', zh: '在后面' }, { ru: 'далеко', zh: '远' },
    { ru: 'близко', zh: '近' }, { ru: 'в школе', zh: '在学校' }, { ru: 'в Москве', zh: '在莫斯科' },
    { ru: 'на работе', zh: '在上班' }, { ru: 'в парке', zh: '在公园' }, { ru: 'в магазине', zh: '在商店' },
    { ru: 'в кафе', zh: '在咖啡馆' }, { ru: 'на улице', zh: '在街上' },
  ],
  degree: [{ ru: 'очень', zh: '非常' }],
  evaluation: [{ ru: 'важно', zh: '重要' }, { ru: 'хорошо', zh: '好' }, { ru: 'невозможно', zh: '不可能' }, { ru: 'возможно', zh: '可能' }],
  predicates: [
    { ru: 'хочу', zh: '想' }, { ru: 'могу', zh: '能' }, { ru: 'люблю', zh: '喜欢' },
    { ru: 'умею', zh: '会' }, { ru: 'должен', zh: '应该' }, { ru: 'собираюсь', zh: '打算' },
    { ru: 'мечтаю', zh: '梦想' }, { ru: 'рад', zh: '高兴' }, { ru: 'готов', zh: '准备好' },
    { ru: 'стараюсь', zh: '努力' }, { ru: 'начинаю', zh: '开始' }, { ru: 'продолжаю', zh: '继续' },
    { ru: 'пытаюсь', zh: '试图' }, { ru: 'надеюсь', zh: '希望' }, { ru: 'обещаю', zh: '承诺' },
    { ru: 'привык', zh: '习惯' }, { ru: 'нужно', zh: '需要' }, { ru: 'надо', zh: '应当' },
    { ru: 'можно', zh: '可以' }, { ru: 'нельзя', zh: '不可以' },
  ],
  objects: [
    { ru: 'еду', zh: '食物', inf: 'есть' }, { ru: 'воду', zh: '水', inf: 'пить' },
    { ru: 'чай', zh: '茶', inf: 'пить' }, { ru: 'кофе', zh: '咖啡', inf: 'пить' },
    { ru: 'молоко', zh: '牛奶', inf: 'пить' }, { ru: 'хлеб', zh: '面包', inf: 'есть' },
    { ru: 'мясо', zh: '肉', inf: 'есть' }, { ru: 'рыбу', zh: '鱼', inf: 'есть' },
    { ru: 'фрукты', zh: '水果', inf: 'есть' }, { ru: 'овощи', zh: '蔬菜', inf: 'есть' },
    { ru: 'суп', zh: '汤', inf: 'есть' }, { ru: 'кашу', zh: '粥', inf: 'есть' },
    { ru: 'книгу', zh: '书', inf: 'читать' }, { ru: 'журнал', zh: '杂志', inf: 'читать' },
    { ru: 'газету', zh: '报纸', inf: 'читать' }, { ru: 'фильм', zh: '电影', inf: 'смотреть' },
    { ru: 'музыку', zh: '音乐', inf: 'слушать' }, { ru: 'письмо', zh: '信', inf: 'писать' },
    { ru: 'стихи', zh: '诗', inf: 'писать' }, { ru: 'песню', zh: '歌', inf: 'петь' },
    { ru: 'машину', zh: '汽车', inf: 'водить' }, { ru: 'дом', zh: '房子', inf: 'строить' },
    { ru: 'русский язык', zh: '俄语', inf: 'учить' }, { ru: 'подарок', zh: '礼物', inf: 'покупать' },
    { ru: 'цветы', zh: '花', inf: 'покупать' }, { ru: 'билет', zh: '票', inf: 'покупать' },
  ],
  preposition: [{ ru: 'для меня', zh: '对我来说' }],
  connector: [{ ru: 'поэтому', zh: '所以' }],
}

function readStore(deps) {
  const ls = (deps && deps.storage) || (typeof window !== 'undefined' ? window.localStorage : null)
  if (!ls) return { data: {}, ls: null }
  try {
    return { data: JSON.parse(ls.getItem(STORAGE_KEY) || '{}') || {}, ls }
  } catch {
    return { data: {}, ls }
  }
}

function writeStore(ls, data) {
  if (!ls) return
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* 存储不可用：静默降级（不影响主流程） */
  }
}

// 读某课时的待重试记录（[{sentenceHash, difficulty, error, at}]）
export function readPendingSlotTables({ courseId, unitId }, deps = {}) {
  const { data } = readStore(deps)
  return data[`${courseId}::${unitId}`] || []
}

// 写回：done（已成功入库）的 (sentenceHash, difficulty) 从记录中清除；failed（未入库）合并写入。
// pending（机械兜底已入库）不进本列表：下次整课时重跑会再试一次（后端 cache 无 ok 记录则重新生成）。
export function writePendingSlotTables({ courseId, unitId, done, failed }, deps = {}) {
  const { data, ls } = readStore(deps)
  const key = `${courseId}::${unitId}`
  const prev = (data[key] || []).filter(
    (p) => !done.some((d) => d.sentenceHash === p.sentenceHash && d.difficulty === p.difficulty),
  )
  const next = [...prev]
  for (const f of failed) {
    const i = next.findIndex((p) => p.sentenceHash === f.sentenceHash && p.difficulty === f.difficulty)
    const rec = { sentenceHash: f.sentenceHash, difficulty: f.difficulty, error: f.error, at: Date.now() }
    if (i >= 0) next[i] = rec
    else next.push(rec)
  }
  if (next.length) data[key] = next
  else delete data[key]
  writeStore(ls, data)
}

// 保存课时后异步触发：整课时三档生成 → table-fill（AI）→ save（写课时维度库）。
// sentences: 课时句子数组（[{ru, zh}]，兼容 {russian}/{text}/{chinese}）。
// 返回 { skipped: 'in_flight' | 'no_sentences' } 或 { done, failed, pending, saved }。
export async function triggerUnitSlotTables({ courseId, unitId, sentences, deps = {} }) {
  const key = `${courseId}::${unitId}`
  if (inFlight.has(key)) return { skipped: 'in_flight' }
  const list = (Array.isArray(sentences) ? sentences : [])
    .map((s) => ({
      ru: String((s && (s.ru || s.russian || s.text)) || '').trim(),
      zh: String((s && (s.zh || s.chinese)) || '').trim(),
    }))
    .filter((s) => s.ru)
  if (!list.length) return { skipped: 'no_sentences' }
  inFlight.add(key)
  try {
    // 方案 A：第 1 句 = 核心长链；三档难度各生成一次；chainIndex=句子在课程中的序号（B 方案轮转基准）
    const units = []
    list.forEach((s, idx) => {
      for (const d of DIFFICULTIES) units.push({ ru: s.ru, zh: s.zh, difficulty: d, core: idx === 0, chainIndex: idx })
    })
    const pool = (deps && deps.pool) || DEFAULT_SLOT_POOL
    // poolSeed=课程级轮转起点（同课程稳定、不同课程不同起点 → 变体词课程内循环覆盖、跨课程不雷同）
    const poolSeed = deps && deps.courseId ? `${deps.courseId}::${deps.unitId || ''}` : ''
    const r = await generateUnitTableAsync(units, { httpPost: deps.httpPost, pool, poolSeed }, deps)
    // hash → 原句 映射（save 需要 sentence 字段；与 generateUnitTableAsync 内部 hash 算法一致）
    const hashToSentence = {}
    for (const s of list) {
      for (const d of DIFFICULTIES) {
        hashToSentence[sentenceHash(normalizeSentence(s.ru), d)] = s.ru
      }
    }
    // 组装 save items：done(ok) + pending(机械兜底有 rows) 都入库；failed 不存
    const toSave = []
    for (const d of r.done) {
      toSave.push({
        sentence_hash: d.sentenceHash,
        sentence: hashToSentence[d.sentenceHash] || '',
        difficulty: d.difficulty,
        intents_fp: 'unit',
        rows: Array.isArray(d.rows) ? d.rows : [],
        review_status: 'ok',
      })
    }
    for (const p of r.pending) {
      if (Array.isArray(p.rows) && p.rows.length) {
        toSave.push({
          sentence_hash: p.sentenceHash,
          sentence: hashToSentence[p.sentenceHash] || '',
          difficulty: p.difficulty,
          intents_fp: 'unit',
          rows: p.rows,
          review_status: 'pending',
        })
      }
    }
    let saved = 0
    let saveFailed = false
    if (toSave.length) {
      const res0 = await deps.httpPost('/api/admin/slot-tables/save', { course_id: courseId, unit_id: unitId, items: toSave })
      // ⚠️ 同款兼容：httpPost 可能返回 fetch Response（.ok=HTTP 状态）而非 JSON，必须解析后再判断业务 ok
      const res = (res0 && typeof res0.json === 'function') ? await res0.json().catch(() => ({})) : (res0 || {})
      if (res && res.ok) {
        saved = typeof res.saved === 'number' ? res.saved : toSave.length
      } else {
        // save 失败 → 全部进失败列表（下次打开补跑会重新生成 + 重存）
        saveFailed = true
        const allFailed = r.done.map((d) => ({ sentenceHash: d.sentenceHash, difficulty: d.difficulty, error: 'save_failed' }))
        writePendingSlotTables({ courseId, unitId, done: [], failed: allFailed }, deps)
        return { done: [], failed: allFailed, pending: [], saved: 0, saveFailed: true }
      }
    }
    // 成功入库的 done 从待重试清除；生成层 failed（HTTP/JSON 未入库）写入待重试
    writePendingSlotTables({ courseId, unitId, done: r.done, failed: r.failed }, deps)
    return { done: r.done, failed: r.failed, pending: r.pending, saved }
  } finally {
    inFlight.delete(key)
  }
}

// 下次打开课时自动补跑：本机有待重试记录才触发（整课时重跑；后端 table-fill 幂等缓存，已 ok 句命中零 LLM 成本）。
export async function retryPendingSlotTables({ courseId, unitId, sentences, deps = {} }) {
  const pending = readPendingSlotTables({ courseId, unitId }, deps)
  if (!pending.length) return { skipped: 'no_pending' }
  return triggerUnitSlotTables({ courseId, unitId, sentences, deps })
}
