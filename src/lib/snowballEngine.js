// 滚雪球课程引擎：机器按拆词规则生成路径（保证末步=原句）→ AI 审核修正语序/语义/逻辑 → 硬校验
// 思路（用户确认）：第一步第1个词 → 第二步前2个词 → 第三步第3个词 → 第四步前3个词 →
// 后续每组3词：零件-零件-组装 → 最后一步必须 100% 等于原句。
// AI 只负责审核（语序不通/逻辑不顺/语义不当）与中文翻译，不参与路径结构编排，杜绝"AI 发癫"。
import { chat } from './ai'
import { parseAIJSON } from './ai'

// 数字 → 俄语单词（0-9999；教学句子范围内够用）
const RU_N1 = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
const RU_N10 = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
const RU_N100 = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']
const RU_N1000 = ['', 'тысяча', 'две тысячи', 'три тысячи', 'четыре тысячи', 'пять тысяч', 'шесть тысяч', 'семь тысяч', 'восемь тысяч', 'девять тысяч']
export function numberToRussian(n) {
  n = Math.floor(n)
  if (n < 0) return '-' + numberToRussian(-n)
  if (n < 20) return RU_N1[n]
  if (n < 100) return (RU_N10[Math.floor(n / 10)] + (n % 10 ? ' ' + RU_N1[n % 10] : '')).trim()
  if (n < 1000) return (RU_N100[Math.floor(n / 100)] + (n % 100 ? ' ' + numberToRussian(n % 100) : '')).trim()
  if (n < 10000) return (RU_N1000[Math.floor(n / 1000)] + (n % 1000 ? ' ' + numberToRussian(n % 1000) : '')).trim()
  return String(n)
}
// 把一段俄语文本中的阿拉伯数字替换为俄语单词（"500 лет." → "пятьсот лет."）
export function russianizeNumbers(text) {
  return String(text || '').replace(/\d+/g, (m) => numberToRussian(parseInt(m, 10)))
}

// 1. 拆 token：按空格拆分；独立标点（如 ", " 开头的逗号）附着到前一个词；词尾标点（"Москвы."）保持附着
export function splitTokens(sentence) {
  const raw = String(sentence || '').trim().split(/\s+/).filter(Boolean)
  const tokens = []
  for (const w of raw) {
    if (/^[.,!?;:…]+$/.test(w) && tokens.length) {
      tokens[tokens.length - 1] += w
    } else {
      tokens.push(w)
    }
  }
  return tokens
}

// 2. 机器生成步骤（确定性规则，用户确认的"零件-组装交替"模式）
//   组1（词1-3）：w1 → w1+w2 → w3 → w1+w2+w3
//   后续组（每3词，从词4起）：wk → wk+1 → wk+wk+1+wk+2
//   末步强制 = 全句（去重后追加）
export function buildMachineSteps(tokens) {
  const n = tokens.length
  const steps = []
  if (!n) return steps
  // 去重比较：忽略末尾标点（"…город" 与 "…город." 视为同一步，防止重复）
  const normFull = (arr) => arr.join(' ').replace(/[.,!?;:…]+$/, '').trim()
  if (n <= 3) {
    for (let i = 1; i <= n; i++) steps.push(tokens.slice(0, i))
    const dedup = steps.filter((s) => normFull(s) !== normFull(tokens))
    dedup.push(tokens.slice(0))
    return dedup.map((s) => s.map((w) => russianizeNumbers(w)))
  }
  // 组1：w1 / w1+w2 / w3 / w1+w2+w3
  steps.push(tokens.slice(0, 1))
  steps.push(tokens.slice(0, 2))
  steps.push(tokens.slice(2, 3))
  steps.push(tokens.slice(0, 3))
  // 后续组（每3词）：wk / wk+1 / wk..wk+2
  let g = 3
  while (g < n) {
    const left = n - g
    if (left >= 3) {
      steps.push(tokens.slice(g, g + 1))
      steps.push(tokens.slice(g + 1, g + 2))
      steps.push(tokens.slice(g, g + 3))
    } else if (left === 2) {
      steps.push(tokens.slice(g, g + 1))
      steps.push(tokens.slice(g + 1, g + 2))
      steps.push(tokens.slice(g, g + 2))
    } else {
      steps.push(tokens.slice(g, g + 1))
    }
    g += 3
  }
  // 末步 = 全句（去重：与末步仅差末尾标点的步骤一并去掉）
  const dedup = steps.filter((s) => normFull(s) !== normFull(tokens))
  dedup.push(tokens.slice(0))
  return dedup.map((s) => s.map((w) => russianizeNumbers(w)))
}

// 3. AI 审核：修正语序/语义/逻辑，合并歧义碎片，翻译中文；末步必须=原句
export async function aiReviewSteps(original, machineSteps) {
  const system = '你是一位严格的俄语教学滚雪球课程审核员。只输出 JSON，不要任何解释或 markdown 包裹。'
  const user = `用户将"机器按拆词规则生成的滚雪球步骤"发给你。请审核并修正，产出符合"句乐部"学习逻辑（先学零件→再组装→再变形）的最终步骤。

【审核修正任务】
1. 语义与语序审核：逐条检查每个步骤的俄语片段是否语序通顺、语义自然、符合俄语表达习惯。发现问题必须修正：
   - 专有名词与固定搭配必须作为整体出现（如 "Чистые пруды"、"Дом-музей художника Левитана"、"Московский университет"、"на Волге"、"в центре России"、"На улице"、"на втором этаже"、"у которого"）：机器把这类整体拆碎成单词的步骤必须合并成一个完整步骤
   - 语法一致性：严禁出现主谓不一致（如复数主语"пруды"配单数谓语"находится"）；每个步骤的俄语片段本身必须语法正确
   - 语法上必须成对出现的成分（如 "небольшая, но известная"、"знают и любят"）尽量出现在同一步骤
   - 删除会产生歧义、读不通的碎片步骤，让每一步都"读得通、有教学意义"
2. 保持滚雪球精神与步骤模式（硬要求）：
   - 必须采用"零件-组装"模式：主句块先逐词滚出（如 Плёс → Плёс — это；Этому → Этому городу），后续词块先单独出零件、再出块内组装（мой → родной → мой родной город；500 → лет → 500 лет），副词等小词零件化（уже 单独成步后组装 Этому городу уже），最后一步才是整句合并（Плёс — это мой родной город.；Этому городу уже 500 лет.）
   - 严禁"前缀逐词"模式：绝对禁止每步都从整句开头递增前缀（如 Плёс → Плёс — это → Плёс — это мой → …这种逐步从头拼起的模式）
   - 严禁跳过零件直接组装：不得把"500 лет"一步带过（必须先 500、再 лет、再 500 лет）；不得把"Этому городу"拆成互不关联的两个零件（应先 Этому、再 Этому городу）
   - 步骤数量可以增减，一般 5-12 步。
3. 中文翻译（硬要求）：
   - 中文必须按中文语序重新组织，禁止保留俄语语序逐词硬拼。"地点 + находится + 主语"结构中文必须把主语提前：如 "На улице Чистые пруды находится театр «Современник»" 译"当代剧院坐落在清澈的池塘街上"（绝对禁止"清澈池塘街道上位于当代剧院"）
   - 介词短语（в центре, на Волге, на улице, на этаже, у которого）在中文里必须与其后的名词整合成完整意群，禁止介词单独悬空
   - 禁止使用省略号"..."；禁止括号语法注释（如"这个（与格）"）；禁止"这是"硬拼（"普列斯这是"错误）
   - 每一步的中文单独读出来必须通顺自然、完整、非空，只翻译当前步骤的俄语片段本身，禁止带上未拼出的部分（如 "Этому городу" 只能译"这座城市"，禁止"这座城市已经"；"уже" 只能译"已经"；"500" 只能译"五百"；"500 лет" 只能译"五百年"）
   - 中文翻译中数字用中文汉字（500 → 五百；500 лет → 五百年），禁止阿拉伯数字；russian 步骤中的数字由系统自动俄语化（пятьсот），你无需处理数字写法
   - 常用词与固定搭配用自然中文，禁止逐词直译：родной город = 家乡/故乡（绝对禁止任何含"城市"的译法，如"家乡城市""故乡城市"），мой родной город = 我的家乡；每一步的中文不得与上一步完全重复
4. 禁止重复步骤（硬要求）：
   - 两个步骤的 russian 仅相差末尾标点（如"…город"与"…город."）视为重复，必须只保留一个（保留最后一步）
   - 破折号"—"不应单独成步：若 "Плёс —" 与 "Плёс — это" 两步中文相同，把破折号步合并到下一步
5. 硬约束：最后一步必须 100% 等于原文整句（含标点），不得增删改。
6. 末步中文必须是整句的完整、地道翻译（如 "Это мой друг, который живёт в Москве." 的末步中文必须是"这是我的朋友，他住在莫斯科。"，绝对禁止写成最后片段的翻译"在莫斯科。"）。

【输出格式】严格 JSON 对象：
{"steps":[{"stepIndex":1,"russian":"...","chinese":"..."}, ...]}
只输出 JSON。

原文：${original}
机器生成的步骤：${JSON.stringify(machineSteps.map((s) => s.join(' ')))}`
  const content = await chat({ messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  const parsed = parseAIJSON(content)
  if (!parsed || !Array.isArray(parsed.steps)) throw new Error('AI 审核未返回合法步骤')
  // 后处理：去掉与末步仅差末尾标点的重复步骤（防"整句无句号"+"整句有句号"两步并存）
  if (parsed.steps.length > 1) {
    const normLast = (s) => String(s.russian || '').replace(/\s+/g, ' ').replace(/[.,!?;:…]+$/, '').trim()
    const lastNorm = normLast(parsed.steps[parsed.steps.length - 1])
    parsed.steps = parsed.steps.filter((s, idx) => idx === parsed.steps.length - 1 || normLast(s) !== lastNorm)
  }
  // 后处理：清理中文里的括号语法注释（如"城市（与格）"），只保留括号外文本
  parsed.steps = parsed.steps.map((s) => ({ ...s, chinese: String(s.chinese || '').replace(/（[^）]*）|\([^)]*\)/g, '').replace(/\s+/g, ' ').trim() }))
  // 后处理：所有步骤（含末步）中的阿拉伯数字一律替换为俄语单词（"500" → "пятьсот"）
  parsed.steps = parsed.steps.map((s) => ({ ...s, russian: russianizeNumbers(s.russian) }))
  return parsed.steps
}

// 4. 硬校验：末步必须=原句（原句先做数字俄语化再比较，因为所有步骤的数字已统一俄语化）
export function verifyFinalStep(steps, original) {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim()
  const last = steps && steps.length ? norm(steps[steps.length - 1].russian) : ''
  return !!last && last === norm(russianizeNumbers(original))
}

// 5. 词卡补全：词表匹配 + 词性规则（与后台现有 makeChunk 逻辑一致，供新工具复用）
export function buildChunksForSteps(steps) {
  let vocab = []
  try { vocab = JSON.parse(localStorage.getItem('rlearn_v1_vocab') || '[]') } catch (e) { vocab = [] }
  const vocabMap = {}
  vocab.forEach((c) => { if (c && c.word) { const k = String(c.word).toLowerCase(); if (k && !vocabMap[k]) vocabMap[k] = c } })
  const posColor = { '名词': 'orange', '动词': 'red', '形容词': 'green', '副词': 'green', '代词': 'orange', '数词': 'green', '连接词': 'gray', '疑问词': 'purple', '语气词': 'gray' }
  const makeChunk = (w) => {
    const clean = String(w).toLowerCase().replace(/[.,!?;:«»"'()—]/g, '')
    const c = vocabMap[clean]
    let role = '', color = 'orange'
    if (['не', 'и', 'а', 'но', 'да', 'тоже', 'очень', 'конечно'].includes(clean)) { role = '连接/语气词'; color = 'gray' }
    else if (['что', 'кто', 'как', 'когда', 'где', 'почему'].includes(clean)) { role = '疑问词'; color = 'purple' }
    else if (/(ть|тся|чь)$/.test(clean)) { role = '动词'; color = 'red' }
    if (c) { role = c.pos || role; color = posColor[role] || color }
    return { word: w, translation: c ? (c.chinese || '') : '', role, color }
  }
  return steps.map((st) => {
    const tokens = String(st.russian || '').trim().split(/\s+/).filter(Boolean)
    let prevWords = new Set()
    const newTokens = tokens.filter((t) => !prevWords.has(t.toLowerCase()) && (prevWords.add(t.toLowerCase()), true))
    return { ...st, newChunks: newTokens.map(makeChunk), allChunks: tokens.map(makeChunk) }
  })
}
