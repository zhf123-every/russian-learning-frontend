/**
 * jlTableEngine.js —— 句乐部式 6 列表格生成引擎（路线 B，P0 骨架）
 *
 * 目标（用户已定案）：
 *   - 不要"3 档路径(scaffoldingPaths)"，改为为每个句子生成一张 6 列可编辑表格：
 *       序号 | 卡片类型 | 俄语内容 | 中文翻译 | 语法标签 | 组ID
 *   - 生成逻辑与句乐部完全一致（20 类固定节奏模板，从句乐部 01-194 步截图逐行反推）
 *   - 错误率极低：模板引擎（机器，结构零错误）+ 课级词池 + AI 只做 3 件事
 *     （① 拆零件/意群分组 ② 从词池选词填模板 ③ 变格变位 + 中文翻译）+ 机器硬校验
 *   - 方案 A：每课第 1 句为核心句 → 全量长链（20 类模板全开，~190 步）；
 *     其余句子 → 短链（骨架 + 否定 + 时间，~15-30 步）
 *   - 学生端不显示序号/列表：每题只给中文翻译 → 学生打字输入俄语 → 按表格顺序逐题
 *
 * 行格式（与飞书模板《俄语课句子数据模板》6 列对齐，字段名统一 cardType，无第二套命名）：
 *   { seq, cardType: '积木'|'完整句', ru, zh, tag, groupId }
 *
 * 意图（intent）格式（AI 填词前的"步骤意图序列"，机器生成，AI 只填空）：
 *   {
 *     kind: 'part'|'full'|'review',
 *     cardType: '积木'|'完整句',
 *     source: 'core'|'pool'|'reuse'|'template',
 *     // part 行：
 *     //   source=core     → tokensRef: [start, end]（引用核心句 tokens 索引区间；AI 只做分组决策，文本机械截取）
 *     //   source=pool     → poolKey: 'negation'|'time'|'predicates'|'objects'|'evaluation'|'degree'|'preposition'|'connector'|'place',
 *     //                       poolIndex: n
 *     //   source=reuse    → reuseRef: { section, step }（引用前面已生成行）
 *     //   source=template → templateText: 'не'（模板固定词，如 не/это/очень）
 *     role: '主语'|'谓语'|'补语'|'否定'|'时间'|'地点'|'程度'|'评价'|...,
 *     // full 行：
 *     //   template: 'skeleton'|'negation'|'time_pos'|'time_neg'|'predicate_pos'|'predicate_neg'
 *     //             |'object_pos'|'object_neg'|'evaluation'|'evaluation_ext'|'degree'
 *     //             |'prep'|'compound'|'place_pos'|'place_neg'|'if'|'so'|'not'|'review'
 *     //   compose: [源行引用]（机器拼装用）；整句重写的模板（换谓语/换宾语/评价/复合句）由 AI 填完整句
 *   }
 *
 * 组 ID：groupId = 'G_' + 两位序号（核心句链从 G_01 起；短链句从 G_01 起；多句连排时全局递增）
 *
 * 本文件 P0 只提供：模板库常量（20 类节奏定义）+ 导出函数签名 + JSDoc。
 * 所有函数空实现（throw 'not implemented'），P1 填实现。
 * 单测框架（tests/jlTableEngine.test.js）：跑起来是"一堆红"，预期。
 */

// ============ 常量：6 列表头（与飞书模板一致，禁止改名） ============
export const TABLE_COLUMNS = ['序号', '卡片类型', '俄语内容', '中文翻译', '语法标签', '组ID']

// ============ 常量：20 类固定节奏模板（从句乐部 01-194 步截图反推） ============
// 每个 section = 一个"固定节奏套路"：
//   id: 内部标识
//   name: 后台展示名
//   steps: 节奏模式数组。每项是"意图模板"：
//     { kind, cardType, role?, source?, template? }  —— 具体填空值由 buildCoreChainIntent / buildShortChainIntent 生成
// 结构错误率趋近 0 的根基：AI 不决定步数与顺序，模板决定。
export const TEMPLATE_SECTIONS = [
  {
    id: 'skeleton', name: '骨架拆解', steps: [
      { kind: 'part', cardType: '积木', role: '主语' },
      { kind: 'part', cardType: '积木', role: '谓语' },
      { kind: 'part', cardType: '积木', role: '组合' },
      { kind: 'part', cardType: '积木', role: '补语' },
      { kind: 'full', cardType: '完整句', template: 'skeleton' },
    ],
  },
  {
    id: 'negation', name: '否定', steps: [
      { kind: 'part', cardType: '积木', role: '否定', source: 'template', templateText: 'не' },
      { kind: 'part', cardType: '积木', role: '组合' },
      { kind: 'full', cardType: '完整句', template: 'negation' },
    ],
  },
  {
    id: 'infinitive', name: '不定式扩展', steps: [
      { kind: 'part', cardType: '积木', role: '不定式', source: 'template', templateText: 'делать' },
      { kind: 'part', cardType: '积木', role: '宾语', source: 'template', templateText: 'это' },
      { kind: 'part', cardType: '积木', role: '组合' },
      { kind: 'full', cardType: '完整句', template: 'object_pos' },
      { kind: 'part', cardType: '积木', role: '否定组合', source: 'reuse' },
      { kind: 'full', cardType: '完整句', template: 'object_neg' },
    ],
  },
  {
    id: 'time', name: '时间状语', steps: [
      { kind: 'part', cardType: '积木', role: '时间', source: 'pool', poolKey: 'time' },
      { kind: 'full', cardType: '完整句', template: 'time_pos' },
      { kind: 'full', cardType: '完整句', template: 'time_neg' },
    ],
  },
  {
    id: 'place', name: '地点块', steps: [
      { kind: 'part', cardType: '积木', role: '地点', source: 'pool', poolKey: 'place' },
      { kind: 'part', cardType: '积木', role: '组合' },
      { kind: 'full', cardType: '完整句', template: 'place_pos' },
      { kind: 'part', cardType: '积木', role: '否定组合', source: 'reuse' },
      { kind: 'full', cardType: '完整句', template: 'place_neg' },
      { kind: 'part', cardType: '积木', role: '时间', source: 'pool', poolKey: 'time' },
      { kind: 'full', cardType: '完整句', template: 'time_neg' },
    ],
  },
  {
    id: 'predicate_swap', name: '换谓语', steps: [
      { kind: 'part', cardType: '积木', role: '谓语', source: 'pool', poolKey: 'predicates' },
      { kind: 'part', cardType: '积木', role: '补语', source: 'reuse' },
      { kind: 'full', cardType: '完整句', template: 'predicate_pos' },
      { kind: 'part', cardType: '积木', role: '否定组合', source: 'template', templateText: 'не' },
      { kind: 'full', cardType: '完整句', template: 'predicate_neg' },
    ],
  },
  {
    id: 'predicate_time', name: '换谓语+时间', steps: [
      { kind: 'part', cardType: '积木', role: '时间', source: 'pool', poolKey: 'time' },
      { kind: 'full', cardType: '完整句', template: 'time_pos' },
      { kind: 'full', cardType: '完整句', template: 'time_neg' },
    ],
  },
  {
    id: 'object_swap', name: '换宾语（+状语）', steps: [
      { kind: 'part', cardType: '积木', role: '不定式', source: 'pool', poolKey: 'objects', poolField: 'inf' },
      { kind: 'part', cardType: '积木', role: '补语', source: 'pool', poolKey: 'objects' },
      { kind: 'part', cardType: '积木', role: '组合' },
      { kind: 'full', cardType: '完整句', template: 'object_pos' },
      { kind: 'part', cardType: '积木', role: '时间', source: 'pool', poolKey: 'time' },
      { kind: 'full', cardType: '完整句', template: 'time_pos' },
      { kind: 'part', cardType: '积木', role: '否定组合', source: 'reuse' },
      { kind: 'full', cardType: '完整句', template: 'swap_neg' },
    ],
  },
  {
    id: 'freq_every_day', name: '频率状语 every day', steps: [
      { kind: 'part', cardType: '积木', role: '频率', source: 'template', templateText: 'каждый день' },
      { kind: 'full', cardType: '完整句', template: 'time_pos' },
      { kind: 'full', cardType: '完整句', template: 'freq_neg' },
    ],
  },
  {
    id: 'freq_all_day', name: '另一频率词 all the day', steps: [
      { kind: 'part', cardType: '积木', role: '频率', source: 'template', templateText: 'весь день' },
      { kind: 'full', cardType: '完整句', template: 'time_pos' },
    ],
  },
  {
    id: 'predicate_cycle_need', name: '谓语循环（need）', steps: [
      { kind: 'part', cardType: '积木', role: '谓语', source: 'pool', poolKey: 'predicates' },
      { kind: 'part', cardType: '积木', role: '补语', source: 'reuse' },
      { kind: 'full', cardType: '完整句', template: 'predicate_pos' },
      { kind: 'part', cardType: '积木', role: '否定组合', source: 'template', templateText: 'не' },
      { kind: 'full', cardType: '完整句', template: 'predicate_neg' },
      { kind: 'part', cardType: '积木', role: '时间', source: 'pool', poolKey: 'time' },
      { kind: 'full', cardType: '完整句', template: 'time_pos' },
      { kind: 'full', cardType: '完整句', template: 'time_neg' },
    ],
  },
  {
    id: 'predicate_cycle_have_to', name: '谓语循环（have to）', steps: [
      { kind: 'part', cardType: '积木', role: '谓语', source: 'pool', poolKey: 'predicates' },
      { kind: 'part', cardType: '积木', role: '组合' },
      { kind: 'full', cardType: '完整句', template: 'predicate_pos' },
      { kind: 'part', cardType: '积木', role: '时间', source: 'pool', poolKey: 'time' },
      { kind: 'full', cardType: '完整句', template: 'time_pos' },
      { kind: 'part', cardType: '积木', role: '否定组合', source: 'template', templateText: 'не' },
      { kind: 'full', cardType: '完整句', template: 'predicate_neg' },
      { kind: 'part', cardType: '积木', role: '频率', source: 'template', templateText: 'каждый день' },
      { kind: 'full', cardType: '完整句', template: 'time_pos' },
    ],
  },
  {
    id: 'new_object', name: '新宾语（know/see/tell you）', steps: [
      { kind: 'part', cardType: '积木', role: '不定式', source: 'pool', poolKey: 'objects' },
      { kind: 'part', cardType: '积木', role: '宾语', source: 'template', templateText: 'тебя' },
      { kind: 'part', cardType: '积木', role: '组合' },
      { kind: 'full', cardType: '完整句', template: 'object_pos' },
      { kind: 'part', cardType: '积木', role: '时间', source: 'pool', poolKey: 'time' },
      { kind: 'full', cardType: '完整句', template: 'time_pos' },
    ],
  },
  {
    id: 'something_ext', name: 'something 扩展', steps: [
      { kind: 'part', cardType: '积木', role: '宾语', source: 'template', templateText: 'что-то' },
      { kind: 'part', cardType: '积木', role: '评价', source: 'pool', poolKey: 'evaluation' },
      { kind: 'part', cardType: '积木', role: '组合' },
      { kind: 'full', cardType: '完整句', template: 'object_pos' },
      { kind: 'full', cardType: '完整句', template: 'object_pos' },
    ],
  },
  {
    id: 'it_is_base', name: 'It is + 形容词基础', steps: [
      { kind: 'part', cardType: '积木', role: '指示词', source: 'template', templateText: 'это' },
      { kind: 'full', cardType: '完整句', template: 'evaluation' },
      { kind: 'part', cardType: '积木', role: '程度', source: 'pool', poolKey: 'degree' },
      { kind: 'full', cardType: '完整句', template: 'degree' },
    ],
  },
  {
    id: 'for_me', name: 'for me 扩展', steps: [
      { kind: 'part', cardType: '积木', role: '补语', source: 'template', templateText: 'для меня' },
      { kind: 'full', cardType: '完整句', template: 'evaluation_ext' },
    ],
  },
  {
    id: 'to_do_eval', name: '不定式评价', steps: [
      { kind: 'part', cardType: '积木', role: '不定式', source: 'reuse' },
      { kind: 'full', cardType: '完整句', template: 'evaluation_ext' },
    ],
  },
  {
    id: 'adj_rotate', name: '形容词轮换', steps: [
      { kind: 'part', cardType: '积木', role: '评价', source: 'pool', poolKey: 'evaluation' },
      { kind: 'full', cardType: '完整句', template: 'evaluation' },
      { kind: 'part', cardType: '积木', role: '不定式', source: 'reuse' },
      { kind: 'full', cardType: '完整句', template: 'evaluation_ext' },
      { kind: 'part', cardType: '积木', role: '时间', source: 'pool', poolKey: 'time' },
      { kind: 'full', cardType: '完整句', template: 'time_pos' },
    ],
  },
  {
    id: 'clause', name: '连句（if / so / not）', steps: [
      { kind: 'part', cardType: '积木', role: '连词', source: 'pool', poolKey: 'connector' },
      { kind: 'full', cardType: '完整句', template: 'if' },
      { kind: 'full', cardType: '完整句', template: 'so' },
      { kind: 'part', cardType: '积木', role: '评价', source: 'template', templateText: 'не важно' },
      { kind: 'full', cardType: '完整句', template: 'not' },
      { kind: 'full', cardType: '完整句', template: 'so' },
    ],
  },
  {
    id: 'review', name: '复习幕', steps: [
      { kind: 'full', cardType: '完整句', template: 'review' },
      { kind: 'full', cardType: '完整句', template: 'review' },
      { kind: 'full', cardType: '完整句', template: 'review' },
      { kind: 'full', cardType: '完整句', template: 'review' },
    ],
  },
]

// ============ 工具：归一化（trim + 压缩空白） ============
export function normalizeTableText(text) {
  return String(text || '').trim().replace(/\s+/g, ' ')
}

// 复用 segmentEngine 的确定性设施（数字俄语化 / 分词 / 索引校验 / 逐字符比较），保证前后端一致
import { normalizeSentence, splitTokens, verifyIndexes, sentenceHash } from './segmentEngine.js'

// 机械截取：tokensRef [start,end] → tokens.slice(start,end+1).join(' ')
export function joinTokensRef(tokens, ref) {
  const s = Array.isArray(ref) && ref.length === 2 ? ref : [0, 0]
  return (Array.isArray(tokens) ? tokens.slice(s[0], s[1] + 1) : []).join(' ')
}

// ============ 骨架幕意图（机器按 tokens + AI 分组决策机械截取） ============
// groups: AI 的意群分组决策，二维索引数组，如 [[0,1],[2],[3,4]]
//   —— 索引并集 = 0..tokens.length-1，不重不漏，组内连续（AI 只做分组，文本由机器截取，拼接天然 == 原句）
// 返回意图序列（句乐部骨架节奏：意群1 单出 → 每个新意群单出 + 累积组合 → 最后完整句）：
//   n=3 时 = part(0) / part(1) / comb(0-1) / part(2) / full(skeleton)
//   对齐句乐部 01-05：I → like → I like → the food → I like the food
// groups 非法（缺号/重复/不连续）返回 null，调用方兜底
export function buildSkeletonIntent(tokens, groups) {
  const n = Array.isArray(tokens) ? tokens.length : 0
  if (!n) return null
  // 归一化：对外契约是二维索引数组 [[0,1],[2]]；verifyIndexes 需要 {indexes:[...]} 对象格式
  const norm = (Array.isArray(groups) ? groups : [])
    .map((g) => ({ indexes: Array.isArray(g) ? g : (g && Array.isArray(g.indexes) ? g.indexes : null) }))
  const sorted = verifyIndexes(norm, n) // 复用：不重不漏 + 组内连续 + 按首索引升序
  if (!sorted) return null
  const steps = []
  const g0 = sorted[0]
  // 意群0 单出
  steps.push({ kind: 'part', cardType: '积木', source: 'core', tokensRef: [g0.indexes[0], g0.indexes[g0.indexes.length - 1]], role: 'chunk', groupId: 'G_01' })
  for (let i = 1; i < sorted.length; i++) {
    const g = sorted[i]
    const end = g.indexes[g.indexes.length - 1]
    // 新意群单出
    steps.push({ kind: 'part', cardType: '积木', source: 'core', tokensRef: [g.indexes[0], end], role: 'chunk', groupId: 'G_01' })
    if (i < sorted.length - 1) {
      // 累积组合块（0..end 机械拼接，文本天然 == 原句前缀）
      steps.push({ kind: 'part', cardType: '积木', source: 'core', tokensRef: [0, end], role: 'comb', groupId: 'G_01' })
    } else {
      // 最后一步 = 完整句（骨架强校验基准）
      steps.push({ kind: 'full', cardType: '完整句', template: 'skeleton', compose: [{ source: 'core', tokensRef: [0, n - 1] }], groupId: 'G_01' })
    }
  }
  // 单意群（整句一组，如 hard 档）：零件单出后必须补完整句行
  if (steps[steps.length - 1].kind !== 'full') {
    steps.push({ kind: 'full', cardType: '完整句', template: 'skeleton', compose: [{ source: 'core', tokensRef: [0, n - 1] }], groupId: 'G_01' })
  }
  return steps
}

// ============ 核心句长链意图（方案 A：第 1 句；模板子集，~40 步） ============
// sentence/tokens: 核心句（俄语化后）与其 token 列表；pool: 课级变体词池（9 类）
// zh: 核心句中文翻译
// 返回意图序列数组（含组 ID 分配）；AI 填词后由 aiFillTable 转成行
// 骨架段 = 单个 skeleton full 占位行（compose 空）→ 后端做 AI 分组决策后机器生成完整骨架替换
// 2026-09 收紧（用户要求）：长链上限 ~40 步，符合句乐部教学节奏；保留
//   骨架→否定→不定式→时间→地点→换谓语→换宾语→频率→简短复习，
//   关掉深层模板（something/it_is/for_me/to_do_eval/adj_rotate/clause/need/have_to）。
//   ⚠️ 意图结构变更 → intents_fp 自动失效 → 已入库旧长链由补跑按新结构重生成（无需动后端）。
// ============ 三档难度模式（2026-10-06 用户定稿：提示粒度按档拉开） ============
// easy   = 全量：一词积木 + 组合块 + 完整句全出（后端骨架词级分组展开）
// medium = 只显示"≥2 词的组合积木"（не хочу / делать это / есть еду / Я хочу / читать книгу / каждый день），
//          单个词积木（Я / хочу / не / это / сейчас / здесь / есть / еду / делать）隐藏但喂机器拼装 ctx；骨架后端短语级展开
// hard   = 每步只显示完整句，全部积木隐藏（仍喂 ctx 保证完整句机器拼装正确）；骨架直接引用全句、不展开
// ⚠️ hidden 机制：隐藏 ≠ 删除——后端仍对隐藏行做机器拼装 + ctx 更新，只是不出现在表格
// （完整句的俄语由后端机器上下文拼出，删掉积木行会导致否定句/换宾语句拼错）
export const DIFFICULTY_MODES = {
  easy: { dropSingle: false, dropAllParts: false },
  medium: { dropSingle: true, dropAllParts: false },
  hard: { dropSingle: true, dropAllParts: true },
}

// 按难度模式判断某步如何处理。返回：
// - false   = 正常显示
// - 'hidden' = 隐藏（后端仍喂 ctx，不出现在表格）
// - 'skip'  = 彻底删除（当前无此场景）
function shouldSkipStep(st, secId, difficulty) {
  const opts = DIFFICULTY_MODES[difficulty]
  if (!opts) return false
  if (st.kind !== 'part') return false // 完整句永不隐藏
  if (secId === 'skeleton' && difficulty !== 'hard') return false // 骨架段由后端按难度分组展开
  if (opts.dropAllParts) return 'hidden' // hard：全部积木隐藏
  if (opts.dropSingle) {
    if (st.role === '组合') return false // 组合块（не хочу / делать это / есть еду）正常显示
    if (st.templateText && st.templateText.trim().split(/\s+/).length >= 2) return false // 多词模板词（каждый день）正常显示
    return 'hidden' // 单个词积木（Я / хочу / не / это / сейчас / здесь...）隐藏
  }
  return false
}

// 确定性词池轮换：同一句（tokens+poolKey）永远取同一个词 → 缓存友好（intents_fp 稳定）、不同句取不同词 → 变体练习丰富
export function pickPoolIndex(listLen, seedText) {
  if (!listLen || listLen <= 1) return 0
  let h = 2166136261 >>> 0
  const s = String(seedText)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % listLen
}

// 判断句检测：Это + 名词 / 名词 + 副词谓语（дома/здесь 等），无动词变位
// 判断句不适用：不定式扩展 / 换谓语 / 换宾语（这些模板是为 Я+动词+宾语 结构设计的）
// 判断句适用：否定 / 加时间 / 加地点 / 加频率 / 复习
function isCopulaSentence(tokens) {
  if (!Array.isArray(tokens) || !tokens.length) return false
  // Это/это 开头 = 判断句（这是妈妈/这是爸爸）
  if (/^[эЭ]то$/.test(tokens[0])) return true
  // 名词 + дома（在家）/ здесь（在这里）/ тут（在这里）= 副词谓语判断句（Анна дома）
  if (tokens.length >= 2 && /^(дома|здесь|тут|там)$/i.test(tokens[tokens.length - 1])) return true
  return false
}

export function buildCoreChainIntent({ sentence, tokens, pool, zh, difficulty = 'easy', chainIndex = 0, poolSeed = '' }) {
  const n = Array.isArray(tokens) ? tokens.length : 0
  if (!n) return []
  const intents = []
  // 骨架占位：compose 空 → 后端按难度词级分组展开（easy 全显 / medium 隐藏主语谓语一词 / hard 全隐藏，喂词完整）
  intents.push({ kind: 'full', cardType: '完整句', template: 'skeleton', compose: [], groupId: 'G_01' })
  // 链顺序（对齐句乐部 01-40 节奏）；predicates 按出现次序递增消费词池
  // 判断句（Это + 名词 / 名词 +副词谓语）：跳过不定式/换谓语/换宾语，保留否定/时间/地点/频率/复习
  const copula = isCopulaSentence(tokens)
  const CHAIN_FULL = [
    { id: 'negation', g: 'G_02' },
    { id: 'infinitive', g: 'G_03' },
    { id: 'time', g: 'G_04' },
    { id: 'place', g: 'G_05' },
    { id: 'predicate_swap', g: 'G_06' },
    { id: 'object_swap', g: 'G_07' },
    { id: 'freq_every_day', g: 'G_08' },
    { id: 'review', g: 'G_09', hints: ['复习：object_pos', '复习：time_pos', '复习：time_neg', '复习：predicate_neg'] },
  ]
  const CHAIN_COPULA = [
    { id: 'negation', g: 'G_02' },
    { id: 'time', g: 'G_03' },
    { id: 'place', g: 'G_04' },
    { id: 'review', g: 'G_05', hints: ['复习：negation', '复习：time_pos', '复习：place_pos', '复习：place_neg'] },
  ]
  const CHAIN = copula ? CHAIN_COPULA : CHAIN_FULL
  // B 方案轮转：课程级起点（poolSeed 哈希，同课程稳定、不同课程不同起点）+ 句子序号循环
  // → 一门课 N 句保证池内前 N 个词各用一遍（超出循环），不再依赖句子文本多样性
  const baseFor = (key, len) => pickPoolIndex(len || 1, String(poolSeed || '') + ':base:' + key)
  // objects 轮换候选：排除与句子重复的词（ru/inf/首词命中 tokens 即跳过），索引映射回原池
  let objIdxCache
  const tokensSet = new Set(Array.isArray(tokens) ? tokens.map((t) => t) : [])
  const sectionById = Object.fromEntries(TEMPLATE_SECTIONS.map((s) => [s.id, s]))
  for (const item of CHAIN) {
    const sec = sectionById[item.id]
    if (!sec) continue
    let hintCursor = 0
    for (const st of sec.steps) {
      const skip = shouldSkipStep(st, item.id, difficulty)
      if (skip === 'skip') continue
      const out = { ...st, groupId: item.g }
      if (skip === 'hidden') out.hidden = true
      if (st.source === 'pool') {
        let idx = 0
        if (st.poolKey === 'predicates') {
          const len = (pool?.predicates?.length) || 1
          idx = (baseFor('pred', len) + chainIndex) % len
        }
        else if (st.poolKey === 'evaluation' && item.evaluationIdx !== undefined) idx = item.evaluationIdx
        else if (st.poolKey === 'objects') {
          if (objIdxCache === undefined) {
            const raw = (pool?.objects && Array.isArray(pool.objects)) ? pool.objects : []
            const idxMap = []
            raw.forEach((o, i) => {
              const ru = String((o && o.ru) || '')
              const inf = String((o && o.inf) || '')
              if (!tokensSet.has(ru) && !tokensSet.has(inf) && !tokensSet.has(ru.split(' ')[0])) idxMap.push(i)
            })
            const len = idxMap.length || 1
            objIdxCache = idxMap.length ? idxMap[(baseFor('obj', len) + chainIndex) % len] : 0
          }
          idx = objIdxCache
        }
        else if (st.poolKey === 'time') {
          const len = (pool?.time?.length) || 1
          idx = (baseFor('time', len) + chainIndex) % len
        }
        else if (st.poolKey === 'place') {
          const len = (pool?.place?.length) || 1
          idx = (baseFor('place', len) + chainIndex) % len
        }
        else idx = 0
        out.poolIndex = idx
      }
      if (item.hints && item.hints[hintCursor]) out.hint = item.hints[hintCursor]
      hintCursor++
      intents.push(out)
    }
  }
  return intents
}

// ============ 短链意图（方案 A：非核心句；骨架 + 否定 + 时间 + 地点 + 频率，~20 步） ============
export function buildShortChainIntent({ sentence, tokens, pool, zh, difficulty = 'easy', chainIndex = 0, poolSeed = '' }) {
  const n = Array.isArray(tokens) ? tokens.length : 0
  if (!n) return []
  const intents = []
  intents.push({ kind: 'full', cardType: '完整句', template: 'skeleton', compose: [], groupId: 'G_01' })
  const CHAIN = [
    { id: 'negation', g: 'G_02' },
    { id: 'time', g: 'G_03' },
    { id: 'place', g: 'G_04' },
    { id: 'freq_every_day', g: 'G_05' },
  ]
  const baseFor = (key, len) => pickPoolIndex(len || 1, String(poolSeed || '') + ':base:' + key)
  const sectionById = Object.fromEntries(TEMPLATE_SECTIONS.map((s) => [s.id, s]))
  for (const item of CHAIN) {
    const sec = sectionById[item.id]
    if (!sec) continue
    for (const st of sec.steps) {
      const skip = shouldSkipStep(st, item.id, difficulty)
      if (skip === 'skip') continue
      const out = { ...st, groupId: item.g }
      if (skip === 'hidden') out.hidden = true
      if (st.source === 'pool') {
        let idx = 0
        if (st.poolKey === 'time') {
          const len = (pool?.time?.length) || 1
          idx = (baseFor('time', len) + chainIndex) % len
        }
        else if (st.poolKey === 'place') {
          const len = (pool?.place?.length) || 1
          idx = (baseFor('place', len) + chainIndex) % len
        }
        else idx = 0
        out.poolIndex = idx
      }
      intents.push(out)
    }
  }
  return intents
}

// ============ AI 填词（唯一 AI 入口；必须走后端新接口，前端绝不直连 LLM） ============
// 入参 intents: 意图序列；sentence_hash: sha256(俄语化原句).hex() 前 16 位（与 segmentEngine 一致）
// deps: { httpPost(path, body) } 注入
// 后端接口（P1 新增）：POST /api/admin/segments/table-fill
//   body: { sentence_hash, russian_text, tokens, difficulty, intents }
//   出参: { ok:true, rows:[...] } 或 { fallback:true, reason } 或 { pending:true }
// 失败兜底策略（用户已钉死）：
//   - fallback:true → 前端机械兜底（骨架按 tokens 逐词/每 3 词一组）+ reviewStatus='pending'
//   - pending:true  → 不重试，直接返回 pending 状态
//   - 后端成功但前端 verifyTable 失败 → console.error + 上报 + 兜底 + pending，禁止静默
export async function aiFillTable(intents, { sentence, tokens, difficulty = 'easy', pool, httpPost }, deps = {}) {
  const post = httpPost || (deps && deps.httpPost) || defaultHttpPost
  const sentenceText = normalizeSentence(sentence || '')
  const tokenList = tokens && tokens.length ? tokens : splitTokens(sentenceText)
  const zh = normalizeTableText((deps && deps.zh) || '')
  const hash = sentenceHash(sentenceText, difficulty)
  if (!sentenceText || !tokenList.length || !Array.isArray(intents) || !intents.length) {
    return { ok: false, pending: true, fallback: true, reason: 'bad_input' }
  }
  const payload = {
    sentence_hash: hash,
    russian_text: sentenceText,
    tokens: tokenList,
    difficulty,
    intents,
    pool: pool || undefined,
  }
  // 分支契约（用户已钉死）：
  //   {pending:true} → 不重试，直接返回 pending
  //   {fallback:true} / 网络错误 → 重试 1 次
  //   重试仍失败 → 机械兜底 + pending
  //   后端 ok 但前端 verifyTable 失败 → console.error + 兜底 + pending，禁止静默
  let lastReason = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    let res = null
    try {
      res = await post('/api/admin/segments/table-fill', payload)
      // ⚠️ 根因修复（与 aiSegment 同款）：httpPost 可能返回浏览器 fetch Response（res.ok=HTTP 状态）
      // 而非解析后的 JSON → res.pending/fallback/rows 全读不到 → 一律机械兜底，表格从未真正生成过。
      // 兼容两种形态：有 .json() 方法 → 解析；纯对象 → 直接用。
      if (res && typeof res.json === 'function') {
        res = await res.json().catch(() => ({}))
      }
    } catch (e) {
      console.error('[jlTable] table-fill 网络错误', { sentenceHash: hash, difficulty, error: String((e && e.message) || e) })
      lastReason = 'network'
      continue
    }
    if (res && res.pending) {
      return { ok: false, pending: true, reason: res.reason || 'pending' }
    }
    if (res && res.fallback) {
      lastReason = res.reason || 'fallback'
      continue // 重试 1 次
    }
    if (res && res.ok && Array.isArray(res.rows) && res.rows.length) {
      const v = verifyTable(res.rows, sentenceText, zh)
      if (v.ok) {
        return { ok: true, rows: res.rows, reviewStatus: 'ok', sentenceHash: hash, difficulty }
      }
      // 后端放行但前端校验失败：绝不静默兜底
      console.error('[jlTable] verifyTable 失败（后端放行但前端校验未过）', {
        sentenceHash: hash, difficulty, errors: v.errors, rows: res.rows,
      })
      const fb = buildMachineFallbackTable(tokenList, zh)
      return { ok: false, pending: true, fallback: true, reason: 'verify_failed', rows: fb, errors: v.errors, sentenceHash: hash, difficulty }
    }
    lastReason = 'bad_response'
  }
  // 两次都失败 → 机械兜底 + pending（不空数据）
  const fb = buildMachineFallbackTable(tokenList, zh)
  return { ok: false, pending: true, fallback: true, reason: lastReason || 'unknown', rows: fb, sentenceHash: hash, difficulty }
}

// 机械兜底：骨架节奏逐词累积（Я / люблю / Я люблю / еду / Я люблю еду），zh 留空待人工；不打 verify（直接 pending）
export function buildMachineFallbackTable(tokens, zh) {
  const n = Array.isArray(tokens) ? tokens.length : 0
  const rows = []
  for (let i = 0; i < n; i++) {
    rows.push({ cardType: '积木', ru: tokens[i], zh: '', tag: '零件' })
    if (i >= 1 && i < n - 1) {
      // 累积组合块（前缀 0..i），与句乐部骨架节奏一致；最后一步由完整句承担
      rows.push({ cardType: '积木', ru: tokens.slice(0, i + 1).join(' '), zh: '', tag: '组合' })
    }
  }
  rows.push({ cardType: '完整句', ru: tokens.join(' '), zh: normalizeTableText(zh), tag: '完整句' })
  return rows.map((r, i) => ({ seq: i + 1, ...r, groupId: 'G_01' }))
}

function defaultHttpPost(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json())
}

// ============ 硬校验（写入前防御；机器校验，不依赖 AI 自觉） ============
// rows: [{seq, cardType, ru, zh, tag, groupId}]
// original: 俄语化压缩空白后的原句（骨架完整句强校验基准）
// originalZh: 用户上传中文（仅参照：骨架完整句 zh 应等于它）
// 校验项（用户已钉死）：
//   1. 序号连续（1..N，无跳号无重复）
//   2. cardType 只允许 '积木'|'完整句'
//   3. 每行 ru/zh 非空
//   4. 骨架完整句（第一个 cardType='完整句' 的行）逐字符 == original（数字俄语化后比较）
//   5. 每个 original token 至少出现在一行 '积木' 中（零件全覆盖）
//   6. 变体完整句不得与原句重复
//   7. 变体完整句 zh 不得照抄 originalZh（中文错乱防线）
// 返回 { ok, errors: [] }
export function verifyTable(rows, original, originalZh) {
  const errors = []
  const arr = Array.isArray(rows) ? rows : []
  if (!arr.length) return { ok: false, errors: ['表格为空'] }
  const okCard = new Set(['积木', '完整句'])
  let skeletonFinal = null
  let skeletonZh = null
  for (let i = 0; i < arr.length; i++) {
    const row = arr[i]
    // 1. 序号连续
    if (row.seq !== i + 1) {
      errors.push(`序号不连续：第${i + 1}行 seq=${row.seq}（应为 ${i + 1}）`)
    }
    // 2. cardType 合法
    if (!okCard.has(row.cardType)) {
      errors.push(`第${i + 1}行非法 cardType：${row.cardType}`)
    }
    // 3. ru/zh 非空
    if (!normalizeTableText(row.ru)) errors.push(`第${i + 1}行俄语内容为空`)
    if (!normalizeTableText(row.zh)) errors.push(`第${i + 1}行中文翻译为空`)
    // 4. 骨架完整句：第一个 完整句 行
    if (row.cardType === '完整句' && skeletonFinal === null) {
      skeletonFinal = normalizeSentence(row.ru)
      skeletonZh = normalizeTableText(row.zh)
    }
  }
  // 4. 骨架完整句逐字符 == 原句（数字俄语化后比较；charCodeAt 逐字符）
  const normOriginal = normalizeSentence(original)
  if (skeletonFinal === null) {
    errors.push('表格中没有完整句行')
  } else if (skeletonFinal.length !== normOriginal.length) {
    errors.push(`骨架完整句长度不一致：${skeletonFinal.length} vs 原句 ${normOriginal.length}（got='${skeletonFinal}' expected='${normOriginal}'）`)
  } else {
    for (let i = 0; i < skeletonFinal.length; i++) {
      if (skeletonFinal.charCodeAt(i) !== normOriginal.charCodeAt(i)) {
        errors.push(`骨架完整句第 ${i} 个字符不一致：'${skeletonFinal[i]}' vs '${normOriginal[i]}'`)
        break
      }
    }
  }
  // 5. 零件全覆盖：原句每个 token 必须精确出现在某积木行（按词匹配，禁止子串误放行如 'еду' ⊂ 'едушки'）
  //    ⚠️ 难度档表格若纯完整句（hard：零件积木隐藏喂 ctx、不出现在表里）→ 跳过本检查
  const hasPartRows = arr.some((r) => r.cardType === '积木')
  if (hasPartRows) {
    const partText = arr.filter((r) => r.cardType === '积木').map((r) => normalizeTableText(r.ru)).filter(Boolean).join(' ')
    const partTokens = new Set(splitTokens(partText))
    for (const t of splitTokens(normOriginal)) {
      const normT = normalizeTableText(t)
      if (normT && !partTokens.has(normT)) {
        errors.push(`零件未覆盖：token '${normT}' 未出现在任何积木行`)
      }
    }
  }
  // 6/7. 变体完整句：不得重复原句；zh 不得照抄原句翻译
  const normOriginalZh = normalizeTableText(originalZh)
  let seen = 0
  for (const row of arr) {
    if (row.cardType !== '完整句') continue
    seen++
    if (seen === 1) continue // 骨架行已单独校验
    const ru = normalizeSentence(row.ru)
    if (ru === normOriginal) {
      errors.push(`变体完整句与骨架重复：'${row.ru}'`)
    }
    if (normOriginalZh && normalizeTableText(row.zh) === normOriginalZh) {
      errors.push(`变体完整句中文照抄原句翻译：'${row.zh}'`)
    }
  }
  // 8. 同组完整句互不重复（机器拼装天然不重；AI 填的 if/so 若重复在此拦截）
  const groupSeen = {}
  for (const row of arr) {
    if (row.cardType !== '完整句') continue
    const ru = normalizeSentence(row.ru)
    const g = row.groupId || ''
    const s = (groupSeen[g] = groupSeen[g] || new Set())
    if (s.has(ru)) {
      errors.push(`同组完整句重复：组 ${g} 出现两次 '${row.ru}'`)
    }
    s.add(ru)
  }
  return { ok: errors.length === 0, errors }
}

// ============ 组合层：整课/整单元批量生成（方案 A：第 1 句核心全量链，其余短链） ============
// units: [{ ru, zh, tokens?, difficulty?, core? }] —— units[0] 默认是核心句（core:true 可显式指定）
// opts: { pool, batchSize = 3 }
// deps: { httpPost } 注入
// 返回 { done: [{sentenceHash, difficulty, reviewStatus, rows}],
//         failed: [{sentenceHash, difficulty, error}],
//         pending: [{sentenceHash, difficulty, reason, rows?}] }
// 并发分批（slice + Promise.all，批大小 3-5）；单句失败不阻塞整批（catch 只包 HTTP/JSON 层，业务 fallback 不算失败）
export async function generateUnitTableAsync(units, opts = {}, deps = {}) {
  // ⚠️ 2026-10-06 修复：默认串行（batchSize=1）。此前默认并发 3，3 难度 × LLM 密集请求同时打生产
  // （每请求 ~19s）→ 冷启动/限流导致部分难度生成失败；串行 + aiFillTable 重试后每个难度独立稳定生成。
  const batchSize = Math.min(Math.max(opts.batchSize || 1, 1), 5)
  const pool = opts.pool
  const poolSeed = opts.poolSeed || ''
  const httpPost = opts.httpPost || (deps && deps.httpPost)
  const onProgress = opts.onProgress || (deps && deps.onProgress)
  const list = Array.isArray(units) ? units : []
  const done = []
  const failed = []
  const pending = []
  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize)
    const results = await Promise.all(batch.map(async (u, j) => {
      const sentence = normalizeSentence((u && u.ru) || '')
      const tokens = u && u.tokens && u.tokens.length ? u.tokens : splitTokens(sentence)
      const difficulty = (u && u.difficulty) || 'easy'
      const zh = (u && u.zh) || ''
      const isCore = (u && u.core === true) || (i + j === 0) // 方案 A：第一句 = 核心句
      const chainIndex = (u && typeof u.chainIndex === 'number') ? u.chainIndex : (i + j) // 句子在课程中的序号（三档共用 → 同句跨难度同词）
      const hash = sentenceHash(sentence, difficulty)
      if (!sentence || !tokens.length) {
        return { kind: 'failed', item: { sentenceHash: hash, difficulty, error: 'empty_sentence' } }
      }
      try {
        const intents = isCore
          ? buildCoreChainIntent({ sentence, tokens, pool, zh, difficulty, chainIndex, poolSeed })
          : buildShortChainIntent({ sentence, tokens, pool, zh, difficulty, chainIndex, poolSeed })
        const r = await aiFillTable(intents, { sentence, tokens, difficulty, pool, httpPost }, { zh })
        if (r.ok) return { kind: 'done', item: { sentenceHash: hash, difficulty, reviewStatus: 'ok', rows: r.rows } }
        if (r.pending) return { kind: 'pending', item: { sentenceHash: hash, difficulty, reason: r.reason, rows: r.rows } }
        return { kind: 'failed', item: { sentenceHash: hash, difficulty, error: r.reason || 'unknown' } }
      } catch (e) {
        // 只包意外异常（HTTP 层/JSON 解析层）；业务 fallback 已在 aiFillTable 内处理，不算失败
        console.error('[jlTable] generateUnitTableAsync 单句异常', { sentenceHash: hash, difficulty, error: String((e && e.message) || e) })
        return { kind: 'failed', item: { sentenceHash: hash, difficulty, error: String((e && e.message) || e) } }
      }
    }))
    for (const r of results) {
      if (r.kind === 'done') done.push(r.item)
      else if (r.kind === 'pending') pending.push(r.item)
      else failed.push(r.item)
    }
    if (onProgress) {
      try { onProgress({ done: done.length + pending.length + failed.length, total: list.length }) } catch (e) { /* 进度回调失败不影响生成 */ }
    }
  }
  return { done, failed, pending }
}
