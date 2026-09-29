import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCourses, saveCourses, deleteCourse } from '../utils/storage'
import { GRADES, TEXTBOOKS } from '../data/gameMallData'
import { API_BASE, apiFetch } from '../lib/api'
import { parseAIJSON, chat } from '../lib/ai'
import { splitTokens, buildMachineSteps, aiReviewSteps, verifyFinalStep, buildChunksForSteps, russianizeNumbers } from '../lib/snowballEngine'
import { useAdminStore } from '../store/adminStore'

// ===== 站长专属后台 · 课程包管理（第三步：课程档案 + 课程序 + 课时内容） =====

// 一级分类（与商城/投稿分类体系一致）
const CATS = ['教材同步', '考试备考', '少儿俄语', '基础俄语', '语法专项', '场景俄语', '阅读听力', '影视俄语', '音乐俄语']
// 角标选项
const BADGES = ['', '精选', '热销', '新', '备考', '衔接']
// 难度
const DIFFS = ['入门', '初级', '中级', '高级']
// 二级标签池（按一级分类联动；年级/教材版本已单列）
const TAG_POOL = {
  '教材同步': ['走遍俄罗斯', '大学俄语', '东方俄语', '新概念俄语', '黑大俄语', '北外俄语', '人教版初中', '人教版高中', '自编课'],
  '考试备考': ['中高考', '专四专八', '考研', 'ТРКИ等级', '留学预科', 'CATTI', '职业俄语'],
  '少儿俄语': ['少儿启蒙', '动画分级', '分级阅读', '动画绘本', '儿歌童谣', '字母拼读', '少儿词汇'],
  '基础俄语': ['零基础路线', '字母发音', '基础语法', '基础词汇', '核心句型', '经典教材', '综合提升'],
  '语法专项': ['主格', '属格', '与格', '宾格', '工具格', '前置格'],
  '场景俄语': ['日常对话', '商务职场', '外贸商务', '旅游出行', '面试校园', '社交口语', '写作邮件'],
  '阅读听力': ['短文精读', '俄语故事', '名著简写', '新闻短文', '文化科普', '专业阅读'],
  '影视俄语': ['情景剧', '影视台词', '电影片段', '动画片段', '经典教材剧'],
  '音乐俄语': ['俄语歌曲'],
}

const emptyForm = () => ({
  title: '',
  subtitle: '',
  category: '教材同步',
  grade: '通用',
  textbook: '走遍俄罗斯',
  difficulty: '入门',
  badge: '',
  lessons: 0,
  students: 0,
  tags: [],
  coverUrl: '',
  cover: '', // 封面上传 B2 后的持久地址（b2:// 或 dataURL 待上传）
  coverName: '',
  materials: [], // { name, type, url }
})

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [view, setView] = useState('list')          // list=档案列表 | units=课程序 | unit=课时内容
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')    // 非空 = 正在编辑某条档案
  const [courses, setCourses] = useState([])
  const [toast, setToast] = useState('')
  const [saveBanner, setSaveBanner] = useState(null) // 保存课时后的成功横幅 + 下一步引导
  // —— 连词成句课程生成器：单词 → 提示词 ——
  const [genWords, setGenWords] = useState('')
  const [sentencesInput, setSentencesInput] = useState('')
  const [snowballBusy, setSnowballBusy] = useState(false)
  const [snowballResult, setSnowballResult] = useState(null)
  const [snowballBatch, setSnowballBatch] = useState(2)
  const [snowballDone, setSnowballDone] = useState(0)
  const [genPrompt, setGenPrompt] = useState('')
  const [genBusy, setGenBusy] = useState(false)
  const [showGenPrompt, setShowGenPrompt] = useState(false)

  // 生成器取词：优先用生成器单词框；留空则自动读取本课已保存的词条（老数据兼容）
  const getGenWords = () => {
    let w = String(genWords || '').trim()
    if (!w && activeUnit && activeUnit.vocab) {
      w = String(activeUnit.vocab).split(/\r?\n/).map(l => l.split('|')[0].trim()).filter(Boolean).join(', ')
    }
    return w
  }

  const generatePrompt = () => {
    const words = getGenWords()
    if (!words) { setToast('请先在生成器输入框填写本课单词（逗号隔开）'); return }
    const prompt = `你是一个极度严谨的俄语教学课程设计师。请严格按照"单句逐词派生（长雪球）"生成 JSON，完全对标"句乐部"连词成句打字模式（先学零件 → 再组装 → 再变形）。
【词性驱动分配（必须严格遵守）】
0. 先识别输入单词的词性，再按用途自动分配：
   - 名词（дом, книга, Анна）→ 作主语或宾语，按句法变格（книга -> книгу）；至少一条路径用形容词/数词/物主代词扩展宾语（новую книгу, одну книгу, мою книгу）
   - 动词（любить, читать, знать）→ 变位作谓语（Я люблю, Иван знает）；每个动词至少进入一条路径；整体至少一条路径做否定（не）+ 至少一条做不定式（хочет читать）+ 至少一条做疑问
   - 代词（я, ты, он, она）→ 作主语，必要时变格（ты -> тебя）
   - 形容词（новый, хороший）→ 扩展宾语（новую книгу）
   - 数词（один, два）→ 扩展宾语（одну книгу）
   - 副词（очень, хорошо）→ 程度副词放动词前（Иван хорошо знает Анну）
   - 时间词（сегодня, утром, вечером）→ 动作动词路径加时间状语
   - 地点词（дома, в школе, в городе）→ 动作动词路径加地点状语
   - 疑问词（кто, что, где）→ 至少一条疑问路径用疑问词滚雪球
   - 连接/语气词（не, и, да）→ 否定/连接用
   覆盖要求：输入中出现的每类词，至少在一组路径中被用到；不得跳过某类词。
   自动衍生缺失词类（极其重要）：如果输入中没有某类词，AI 必须自动衍生该类词，并且必须多样化——示例仅供参考，不限于示例，可自由衍生其他高频词：
   - 无动词 → 自由选高频动词（читать, знать, делать, работать, жить, говорить, любить, видеть, хотеть, учить, слушать, смотреть, помогать, идти, есть, пить, учиться, заниматься 等），不同路径换不同动词，严禁全课只用 1 个动词；
   - 无形容词 → 自由选（новый, хороший, большой, маленький, красивый, интересный, вкусный, трудный 等）；
   - 无数词 → 自由选（один, два, три 等）；
   - 无时间词 → 自由选（сегодня, утром, вечером, сейчас, всегда 等）；
   - 无地点词 → 自由选（дома, в школе, в городе, в магазине, на работе 等）；
   - 无疑问词 → 自由选（кто, что, где, когда, как 等）；
   - 无副词 → 自由选（очень, хорошо, быстро, много 等）；
   - 连接/语气词可自由用（и, а, но, тоже, конечно, не）。
   多样性要求：同类衍生成分至少使用 2-3 个不同词轮换，确保课程不单调。
【核心铁律：违反任何一条直接判定失败！】
1. 锁死主语：一个肯定雪球只能有一个主语！在句子滚到 8-12 个词之前，绝对禁止切换主语！
1.1. 动词轮换：如果提供多个动词，不同 pathId 之间必须轮换使用不同动词（如 path_01 用 любить，path_02 用 читать）；同一 pathId 内只能锁一个动词。
2. 严禁横向替换：绝对禁止生成"Я знаю Ивана. Ты знаешь Анну."这种横向换主语或换宾语的平行句！每一步必须比上一步多出一个词或一个词组！
3. 零件 + 组装模式（对标句乐部）：允许"零件关"：动词原形（знать）、不定式（читать）、否定词（не）、宾语（Анну）可单独成一关；但零件关之后必须立即进入组装关（主谓、主谓宾），严禁连续只堆零件。组装顺序：主语 -> 谓语（可先出原形零件再变位）-> 主谓 -> 宾语 -> 主谓宾 -> 扩展。
4. 强制纵向加长（上限8-12个词）：宾语允许用形容词（новую книгу）、数词（одну книгу）、物主代词（мою книгу）扩展；程度副词必须放在动词前面（如 Иван хорошо знает Анну）。滚到 8-12 词后停止加长，开启新 pathId 做变体替换。
5. 语义搭配绝对禁令：状态/心理动词（знать, любить）禁止加时间/地点状语（сегодня, в школе），只能加程度副词（очень, хорошо）或扩展宾语（形容词/数词/物主代词）；动作动词（читать, делать, говорить, жить 等）允许加时间状语（сегодня, утром, вечером）和地点状语（дома, в школе, в городе）；加不自然就直接结束。
6. 禁止滥用"Да"；严禁堆砌名单：禁止用"и"叠加不相关宾语，禁止把代词（это）和人物名词（маму）用 и 并列。
【变体替换规则】
7. 肯定雪球滚到 8-12 词达标后，开启新 pathId：
   【否定路径】按否定零件滚雪球：не -> не знает -> не знает Анну -> Иван не знает Анну -> не очень хорошо -> Иван не очень хорошо знает Анну
   【疑问路径】二选一：a) 取肯定句末尾加问号（Иван хорошо знает Анну?）；b) 用疑问词滚雪球（Кто -> Кто знает -> Кто хорошо знает Анну?）
   【不定式路径】零件：читать -> читать книгу -> Иван хочет читать книгу
8. 强制语义审查：输出前默读中文，如果中文听起来像"我很了解这个和妈妈"，立即停止并结束该 pathId。
9. 严格输出 JSON 格式：字段为 pathId、steps（含 stepIndex, russian, chinese）。可选附 newChunks / allChunks（每个单词含 word / translation / role / color）。russian 以我提供的单词为核心素材（必须全部用上），允许自动衍生所有必要成分（动词变位/не/疑问词/不定式/形容词/数词/程度副词/时间地点状语），衍生成分不受输入限制。每组生成 10-15 关。只输出 JSON，无任何解释或 markdown 包裹。
10. 输出前自查：逐条核对 1-8 条铁律，只要有一条不满足就立即修正后再输出。
单词如下：${words}`
    setGenPrompt(prompt)
    setShowGenPrompt(true)
    setToast('提示词已生成，请复制后粘贴给 AI')
  }

  // 单组单词 → AI 生成路径（核心逻辑，单课生成与批量生成共用；失败自动重试一次）
  const genPathOnce = async (wordsStr) => {
    const system = '你是一个资深俄语教学课程设计师。严格按用户要求只输出 JSON 数组，不要输出任何解释或 markdown 包裹。'
    const user = `你是一个极度严谨的俄语教学课程设计师。请严格按照"单句逐词派生（长雪球）"生成 JSON，完全对标"句乐部"连词成句打字模式（先学零件 → 再组装 → 再变形）。
【词性驱动分配（必须严格遵守）】
0. 先识别输入单词的词性，再按用途自动分配：
   - 名词（дом, книга, Анна）→ 作主语或宾语，按句法变格（книга -> книгу）；至少一条路径用形容词/数词/物主代词扩展宾语（новую книгу, одну книгу, мою книгу）
   - 动词（любить, читать, знать）→ 变位作谓语（Я люблю, Иван знает）；每个动词至少进入一条路径；整体至少一条路径做否定（не）+ 至少一条做不定式（хочет читать）+ 至少一条做疑问
   - 代词（я, ты, он, она）→ 作主语，必要时变格（ты -> тебя）
   - 形容词（новый, хороший）→ 扩展宾语（новую книгу）
   - 数词（один, два）→ 扩展宾语（одну книгу）
   - 副词（очень, хорошо）→ 程度副词放动词前（Иван хорошо знает Анну）
   - 时间词（сегодня, утром, вечером）→ 动作动词路径加时间状语
   - 地点词（дома, в школе, в городе）→ 动作动词路径加地点状语
   - 疑问词（кто, что, где）→ 至少一条疑问路径用疑问词滚雪球
   - 连接/语气词（не, и, да）→ 否定/连接用
   覆盖要求：输入中出现的每类词，至少在一组路径中被用到；不得跳过某类词。
   自动衍生缺失词类（极其重要）：如果输入中没有某类词，AI 必须自动衍生该类词，并且必须多样化——示例仅供参考，不限于示例，可自由衍生其他高频词：
   - 无动词 → 自由选高频动词（читать, знать, делать, работать, жить, говорить, любить, видеть, хотеть, учить, слушать, смотреть, помогать, идти, есть, пить, учиться, заниматься 等），不同路径换不同动词，严禁全课只用 1 个动词；
   - 无形容词 → 自由选（новый, хороший, большой, маленький, красивый, интересный, вкусный, трудный 等）；
   - 无数词 → 自由选（один, два, три 等）；
   - 无时间词 → 自由选（сегодня, утром, вечером, сейчас, всегда 等）；
   - 无地点词 → 自由选（дома, в школе, в городе, в магазине, на работе 等）；
   - 无疑问词 → 自由选（кто, что, где, когда, как 等）；
   - 无副词 → 自由选（очень, хорошо, быстро, много 等）；
   - 连接/语气词可自由用（и, а, но, тоже, конечно, не）。
   多样性要求：同类衍生成分至少使用 2-3 个不同词轮换，确保课程不单调。
【核心铁律：违反任何一条直接判定失败！】
1. 锁死主语：一个肯定雪球只能有一个主语！在句子滚到 8-12 个词之前，绝对禁止切换主语！
1.1. 动词轮换：如果提供多个动词，不同 pathId 之间必须轮换使用不同动词（如 path_01 用 любить，path_02 用 читать）；同一 pathId 内只能锁一个动词。
2. 严禁横向替换：绝对禁止生成"Я знаю Ивана. Ты знаешь Анну."这种横向换主语或换宾语的平行句！每一步必须比上一步多出一个词或一个词组！
3. 零件 + 组装模式（对标句乐部）：允许"零件关"：动词原形（знать）、不定式（читать）、否定词（не）、宾语（Анну）可单独成一关；但零件关之后必须立即进入组装关（主谓、主谓宾），严禁连续只堆零件。组装顺序：主语 -> 谓语（可先出原形零件再变位）-> 主谓 -> 宾语 -> 主谓宾 -> 扩展。
4. 强制纵向加长（上限8-12个词）：宾语允许用形容词（новую книгу）、数词（одну книгу）、物主代词（мою книгу）扩展；程度副词必须放在动词前面（如 Иван хорошо знает Анну）。滚到 8-12 词后停止加长，开启新 pathId 做变体替换。
5. 语义搭配绝对禁令：状态/心理动词（знать, любить）禁止加时间/地点状语（сегодня, в школе），只能加程度副词（очень, хорошо）或扩展宾语（形容词/数词/物主代词）；动作动词（читать, делать, говорить, жить 等）允许加时间状语（сегодня, утром, вечером）和地点状语（дома, в школе, в городе）；加不自然就直接结束。
6. 禁止滥用"Да"；严禁堆砌名单：禁止用"и"叠加不相关宾语，禁止把代词（это）和人物名词（маму）用 и 并列。
【变体替换规则】
7. 肯定雪球滚到 8-12 词达标后，开启新 pathId：
   【否定路径】按否定零件滚雪球：не -> не знает -> не знает Анну -> Иван не знает Анну -> не очень хорошо -> Иван не очень хорошо знает Анну
   【疑问路径】二选一：a) 取肯定句末尾加问号（Иван хорошо знает Анну?）；b) 用疑问词滚雪球（Кто -> Кто знает -> Кто хорошо знает Анну?）
   【不定式路径】零件：читать -> читать книгу -> Иван хочет читать книгу
8. 强制语义审查：输出前默读中文，如果中文听起来像"我很了解这个和妈妈"，立即停止并结束该 pathId。
【输出限制】
9. 严格输出 JSON **数组**，每个元素为 {"pathId": "...", "steps": [{"stepIndex": 1, "russian": "...", "chinese": "..."}]}。**不要输出 newChunks / allChunks**（后台会自动补全词卡）。russian 以我提供的单词为核心素材（必须全部用上），允许自动衍生所有必要成分（动词变位/не/疑问词/不定式/形容词/数词/程度副词/时间地点状语），衍生成分不受输入限制。每组生成 10-15 关。只输出 JSON，无任何解释或 markdown 包裹。
10. 输出前自查：逐条核对 1-8 条铁律，只要有一条不满足就修正后再输出。
单词如下：${wordsStr}`
    let attempt = 0
    while (attempt < 2) {
      attempt++
      try {
        const content = await chat({ messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
        const parsed = parseAIJSON(content)
        if (!parsed) throw new Error('AI 未返回合法 JSON')
        const arr = Array.isArray(parsed) ? parsed : [parsed]
        const paths = arr.filter(p => p && Array.isArray(p.steps))
        if (!paths.length) throw new Error('AI 返回中没有 pathId+steps 路径')
        // 本地补全词卡：词表匹配 + 语法规则（AI 只出 russian/chinese，避免超长截断）
        let vocab = []
        try { vocab = JSON.parse(localStorage.getItem('rlearn_v1_vocab') || '[]') } catch (e) { vocab = [] }
        const vocabMap = {}
        vocab.forEach(c => { if (c && c.word) { const k = String(c.word).toLowerCase(); if (k && !vocabMap[k]) vocabMap[k] = c } })
        const posColor = { '名词': 'orange', '动词': 'red', '形容词': 'green', '副词': 'green', '代词': 'orange', '数词': 'green', '连接词': 'gray', '疑问词': 'purple', '语气词': 'gray' }
        const makeChunk = (w) => {
          const clean = String(w).toLowerCase().replace(/[.,!?;:«»"'()]/g, '')
          const c = vocabMap[clean]
          let role = '', color = 'orange'
          if (['не','и','а','но','да','тоже','очень','конечно'].includes(clean)) { role = '连接/语气词'; color = 'gray' }
          else if (['что','кто','как','когда','где','почему'].includes(clean)) { role = '疑问词'; color = 'purple' }
          else if (/(ть|тся|чь)$/.test(clean)) { role = '动词'; color = 'red' }
          if (c) { role = c.pos || role; color = posColor[role] || color }
          return { word: w, translation: c ? (c.chinese || '') : '', role, color }
        }
        paths.forEach(p => {
          let prevWords = new Set()
          p.steps = p.steps.map(st => {
            const tokens = String(st.russian || '').trim().split(/\s+/).filter(Boolean)
            const newTokens = tokens.filter(t => !prevWords.has(t.toLowerCase()))
            tokens.forEach(t => prevWords.add(t.toLowerCase()))
            const allChunks = tokens.map(makeChunk)
            const newChunks = newTokens.map(makeChunk)
            return { ...st, newChunks, allChunks }
          })
        })
        return paths
      } catch (e) {
        if (attempt === 1) continue // 冷启动/超时自动重试一次
        throw new Error(e.message || 'AI 生成失败')
      }
    }
    throw new Error('AI 生成失败')
  }

  // 🤖 AI 一键生成滚动路径：填词 → 后端 AI 直接返回 JSON → 自动导入本课时（零复制粘贴）
  const aiGenPath = async () => {
    const words = getGenWords()
    if (!words) { setToast('请先在生成器输入框填写本课单词（逗号隔开）'); return }
    const wordsStr = words.split(/[，,]/).map(w => w.trim()).filter(Boolean).join(', ')
    setGenBusy(true)
    try {
      const paths = await genPathOnce(wordsStr)
      const prev = [...(activeUnit.scaffoldingPaths || [])]
      const pathIds = new Set(prev.map(p => p.pathId))
      paths.forEach(p => {
        if (pathIds.has(p.pathId)) { const i = prev.findIndex(x => x.pathId === p.pathId); prev[i] = p }
        else { prev.push(p); pathIds.add(p.pathId) }
      })
      patchUnit({ scaffoldingPaths: prev })
      const emptySteps = paths.reduce((a, p) => a + p.steps.filter(s => (s.allChunks || []).some(c => !c.translation)).length, 0)
      setToast(`✅ AI 已生成 ${paths.length} 条路径（共 ${paths.reduce((a, p) => a + (p.steps || []).length, 0)} 关），词卡已按词表+规则补全；${emptySteps} 关有单词未收录词表（可去词汇表补充）。记得点「保存课时内容」固定入库`)
      setTimeout(() => { const el = document.getElementById('scaffold-section'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 300)
    } catch (e) {
      setToast('⚠️ AI 生成失败：' + e.message + '（可改用「生成提示词」复制后到外部 AI 生成再导入）')
    }
    setGenBusy(false)
  }

  // 🧊 课文句子 → 机器生成滚雪球 + AI 审核（末步强制=原句；AI 只审核语序/语义/翻译，不编排路径，杜绝发散错误）
  // mode='append'：只生成下一批（少量多次，降低长句 AI 出错率），追加到已有结果；mode='full'：清空后全量重新生成
  const genSnowballCourse = async (mode = 'append') => {
    const lines = String(sentencesInput || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (!lines.length) { setToast('请先粘贴课文句子（每行一句）'); return }
    const prevPaths = mode === 'append' ? (snowballResult || []) : []
    const start = mode === 'append' ? snowballDone : 0
    const end = mode === 'append' ? Math.min(snowballDone + snowballBatch, lines.length) : lines.length
    if (mode === 'append' && snowballDone >= lines.length) { setToast('✅ 全部句子都已生成，如需重做请点「重新生成全部」'); return }
    setSnowballBusy(true)
    try {
      const paths = []
      const offset = prevPaths.length
      for (let k = 0; k < end - start; k++) {
        const i = start + k
        const original = lines[i]
        const tokens = splitTokens(original)
        const machine = buildMachineSteps(tokens)
        let steps = []
        try {
          steps = await aiReviewSteps(original, machine)
        } catch (e) {
          // AI 审核不可用：退回纯机器路径（中文留空待补，不阻塞生成）
          steps = machine.map((s, idx) => ({ stepIndex: idx + 1, russian: s.join(' '), chinese: '' }))
        }
        steps = (steps || []).filter(s => s && s.russian && String(s.russian).trim())
        steps = steps.map((s, idx) => ({ ...s, stepIndex: idx + 1 }))
        // 硬校验：末步必须 100% = 原句（数字已由引擎统一俄语化，此处忽略数字写法比较）
        if (!verifyFinalStep(steps, original)) {
          const last = steps[steps.length - 1]
          const lastRuss = last ? String(last.russian || '').replace(/\s+/g, ' ').trim() : ''
          const origNorm = original.replace(/\s+/g, ' ').trim()
          if (last && lastRuss === origNorm) last.russian = russianizeNumbers(original)
          else steps.push({ stepIndex: steps.length + 1, russian: russianizeNumbers(original), chinese: last ? (last.chinese || '') : '' })
        }
        // 词卡补全（词表匹配 + 词性规则）；pathId 从已有结果数续接，避免重复覆盖
        paths.push({ pathId: 'path_' + String(offset + k + 1).padStart(2, '0'), steps: buildChunksForSteps(steps) })
      }
      if (mode === 'append') {
        setSnowballResult([...prevPaths, ...paths])
        setSnowballDone(end)
        setToast(`✅ 已追加生成 ${paths.length} 条（共 ${prevPaths.length + paths.length}/${lines.length}），继续点「生成下一批」或直接保存`)
      } else {
        setSnowballResult(paths)
        setSnowballDone(lines.length)
        setToast(`✅ 已重新生成全部 ${paths.length} 条路径（机器生成 + AI 审核，末步强制=原句），点「保存到本课时」固定入库`)
      }
      setTimeout(() => { const el = document.getElementById('scaffold-section'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 300)
    } catch (e) {
      setToast('⚠️ 生成失败：' + e.message + '（AI 审核不可用时会退回纯机器路径，中文留空待补）')
    }
    setSnowballBusy(false)
  }

  const snowballLineCount = String(sentencesInput || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).length

  // 删除某条路径中的特定步骤（末步=原句，不可删；删除后步骤重新编号）
  const removeSnowballStep = (pathId, stepIndex) => {
    setSnowballResult(prev => (prev || []).map(p => {
      if (p.pathId !== pathId) return p
      const steps = p.steps.filter(s => s.stepIndex !== stepIndex).map((s, i) => ({ ...s, stepIndex: i + 1 }))
      return { ...p, steps }
    }))
    setToast(`🗑️ 已删除 ${pathId} 的第 ${stepIndex} 步（删除后步骤已重新编号）`)
  }

  // 保存机器生成+审核的路径到本课时（复用现有合并逻辑）
  const saveSnowball = () => {
    if (!snowballResult || !snowballResult.length) return
    const prev = [...(activeUnit.scaffoldingPaths || [])]
    const pathIds = new Set(prev.map(p => p.pathId))
    snowballResult.forEach(p => {
      if (pathIds.has(p.pathId)) { const i = prev.findIndex(x => x.pathId === p.pathId); prev[i] = p }
      else { prev.push(p); pathIds.add(p.pathId) }
    })
    patchUnit({ scaffoldingPaths: prev })
    setToast(`✅ 已保存 ${snowballResult.length} 条路径到本课时，记得点「保存课时内容」固定入库`)
  }

  // 🚀 批量生成：多组单词（每组一行=一课）→ 循环 AI 生成 → 自动创建课时并保存
  const batchGenPaths = async () => {
    const raw = String(genWords || '').trim()
    if (!raw) { setToast('请先在生成器输入框填写单词，每组一行=一课'); return }
    const wordGroups = raw.split(/\r?\n/).map(l => l.split(/[，,]/).map(w => w.trim()).filter(Boolean)).filter(g => g.length)
    if (!wordGroups.length) { setToast('请先输入单词，每组一行=一课'); return }
    const total = wordGroups.length
    if (!window.confirm(`将按 ${total} 组单词循环调用 AI 生成路径，并自动创建 ${total} 个新课时（第 ${units.length + 1} 课起）。继续？`)) return
    setGenBusy(true)
    let ok = 0, fail = 0
    const errs = []
    const newUnits = []
    for (let i = 0; i < total; i++) {
      const wordsStr = wordGroups[i].join(', ')
      setToast(`⏳ 正在生成第 ${i + 1}/${total} 课：${wordsStr.slice(0, 24)}${wordsStr.length > 24 ? '…' : ''}`)
      try {
        const paths = await genPathOnce(wordsStr)
        newUnits.push({
          id: 'unit_' + Date.now() + '_' + i,
          title: `第 ${units.length + newUnits.length + 1} 课`,
          desc: '', vocab: '', imported: false,
          words: wordGroups[i], sentences: [], scaffoldingPaths: paths,
        })
        ok++
      } catch (e) {
        fail++
        errs.push('第 ' + (i + 1) + ' 课：' + (e.message || '未知错误'))
        console.warn('批量第 ' + (i + 1) + ' 课生成失败：', e.message)
      }
    }
    if (newUnits.length) {
      persistUnits([...units, ...newUnits])
      const last = newUnits[newUnits.length - 1]
      setActiveUnit(last)
      setTimeout(() => {
        const el = document.getElementById('scaffold-section')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 400)
    }
    setGenBusy(false)
    setToast(`✅ 批量完成：成功 ${ok} 课，失败 ${fail} 课` + (fail ? `（原因：${errs[0] || '未知'}）` : `，已自动切换到「${newUnits[newUnits.length - 1]?.title || ''}」并在下方展示路径，可逐课点选检查`))
  }
  const copyPrompt = () => {
    if (!genPrompt) return
    let ok = false
    try {
      // 方案1（主）：隐藏 textarea + execCommand，同步执行，不依赖页面焦点权限
      const ta = document.createElement('textarea')
      ta.value = genPrompt
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      ok = document.execCommand('copy')
      document.body.removeChild(ta)
    } catch (e) { ok = false }
    // 方案2（兜底）：Clipboard API
    if (!ok && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(genPrompt).catch(() => {})
    }
    setToast('提示词已复制，请粘贴给 AI 生成 JSON')
  }
  // —— 云端同步状态 ——
  const { adminKey, login, logout } = useAdminStore()
  const [adminInput, setAdminInput] = useState(adminKey || '')
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudMsg, setCloudMsg] = useState('')
  const [cloudCount, setCloudCount] = useState(-1)

  // —— 课程序管理状态 ——
  const [active, setActive] = useState(null)        // 当前管理课程序的课程
  const [units, setUnits] = useState([])            // 该课程的课时
  const [newUnitTitle, setNewUnitTitle] = useState('')

  // —— 课时内容管理状态 ——
  const [activeUnit, setActiveUnit] = useState(null) // 当前编辑内容的课时
  const [newSentRu, setNewSentRu] = useState('')
  const [newSentZh, setNewSentZh] = useState('')
  const [editSentIdx, setEditSentIdx] = useState(-1)      // 正在行内编辑的例句下标（-1=未编辑）
  const [editSent, setEditSent] = useState({ ru: '', zh: '', chunks: '' })
  const [jsonText, setJsonText] = useState('')            // 批量导入 JSON（句子）粘贴区
  const [jsonBusy, setJsonBusy] = useState(false)
  const [aiDescBusy, setAiDescBusy] = useState(false)     // AI 自动生成课程简介中
  const [aiUnitTitleBusy, setAiUnitTitleBusy] = useState(false) // AI 生成课时名（手动添加表单）
  const [aiRenameBusy, setAiRenameBusy] = useState(null)  // AI 重命名课时列表中的行 index

  // —— AI 自动生成课程简介（【课程介绍】【学习目标】【适合谁学】）——
  const aiGenDesc = async () => {
    const title = form.title.trim()
    if (!title) { flash('请先填写课程标题，再生成简介'); return }
    setAiDescBusy(true)
    try {
      const ctx = [
        title && `课程标题：${title}`,
        form.category && `分类：${form.category}`,
        form.textbook && `教材：${form.textbook}`,
        form.grade && `年级：${form.grade}`,
        form.difficulty && `难度：${form.difficulty}`,
        form.tags && form.tags.length && `标签：${form.tags.join('、')}`,
      ].filter(Boolean).join('\n')
      const content = await chat({
        messages: [
          { role: 'system', content: '你是俄语课程运营编辑，擅长为俄语学习课程撰写专业、有吸引力、分三段的介绍文案，全部使用简体中文。' },
          { role: 'user', content:
            `请根据以下课程信息，撰写三段式课程简介：\n${ctx}\n\n` +
            '要求：\n1. 第一段以【课程介绍】开头：说明课程内容、学习范围和亮点（100字左右）；\n' +
            '2. 第二段以【学习目标】开头：写3-5条可衡量的学习目标（80字左右）；\n' +
            '3. 第三段以【适合谁学】开头：列出适合的学习人群（60字左右）；\n' +
            '直接输出三段文字，每段以对应方括号标题起行，不要额外解释。' },
        ],
      })
      const text = String(content || '').trim()
      if (!text || !text.includes('【')) { flash('⚠️ AI 生成结果异常，请重试'); return }
      setField('subtitle', text)
      flash('✅ 已用 AI 生成课程简介，可再手动微调')
    } catch (e) {
      flash('⚠️ AI 接口暂不可用：' + (e.message || '请稍后重试'))
    } finally {
      setAiDescBusy(false)
    }
  }

  // —— AI 生成课时标题（手动添加课时表单：基于课程标题推导主题名）——
  const aiGenUnitTitle = async () => {
    const courseTitle = form.title.trim()
    if (!courseTitle) { flash('请先填写课程标题，再生成课时名'); return }
    setAiUnitTitleBusy(true)
    try {
      const content = await chat({
        messages: [
          { role: 'system', content: '你是俄语教学课程设计师，擅长为课时起简洁贴切的中文主题名。' },
          { role: 'user', content:
            `请为课程「${courseTitle}」的第 ${units.length + 1} 课生成一个课时标题（中文）。\n\n` +
            '要求：\n1. 标题体现本课学习主题（如“基础俄语句子学习”“介绍我的家人”“认识新朋友”“我的房间”），不要使用“第X课”编号；\n' +
            '2. 长度 6-10 个汉字；\n3. 面向零基础俄语学习者，积极、易懂、口语化；\n4. 只输出标题文本本身，不要任何解释、引号或多余内容。' },
        ],
      })
      const text = String(content || '').trim().replace(/^["「『]|["」』]$/g, '')
      if (!text) { flash('⚠️ AI 生成结果异常，请重试'); return }
      setNewUnitTitle(text)
      flash('✅ 已生成课时名，可微调后点击「+ 添加」')
    } catch (e) {
      flash('⚠️ AI 接口暂不可用：' + (e.message || '请稍后重试'))
    } finally {
      setAiUnitTitleBusy(false)
    }
  }

  // —— AI 根据课时内容重命名（课时列表每行：读取本课句子/词汇/路径概要）——
  const aiRenameUnit = async (idx) => {
    const u = units[idx]
    if (!u) return
    setAiRenameBusy(idx)
    try {
      const parts = []
      if (Array.isArray(u.scaffoldingPaths) && u.scaffoldingPaths.length) {
        const samples = u.scaffoldingPaths.slice(0, 3).flatMap(p => (p.steps || []).slice(0, 3).map(s => s.russian || '')).filter(Boolean).slice(0, 8)
        parts.push('滚雪球句子：' + samples.join('；'))
      }
      if (Array.isArray(u.sentences) && u.sentences.length) {
        parts.push('例句：' + u.sentences.slice(0, 5).map(s => (s.ru || '') + (s.zh ? '(' + s.zh + ')' : '')).join('；'))
      }
      if (Array.isArray(u.words) && u.words.length) {
        parts.push('词汇：' + u.words.slice(0, 10).map(w => w.ru || w.word || '').join('、'))
      }
      const summary = parts.join('\n') || '（本课时暂无内容）'
      const content = await chat({
        messages: [
          { role: 'system', content: '你是俄语教学课程设计师，擅长为课时起简洁贴切的中文主题名。' },
          { role: 'user', content:
            '根据本课的内容概要，为本课生成一个简洁贴切的课程标题（中文）。\n\n' +
            '要求：\n1. 标题体现本课学习主题（如“基础俄语句子学习”“介绍我的家人”“认识新朋友”“我的房间”），不要使用“第X课”编号；\n' +
            '2. 长度 6-10 个汉字；\n3. 面向零基础俄语学习者，积极、易懂、口语化；\n4. 只输出标题文本本身，不要任何解释、引号或多余内容。\n\n' +
            `本课内容概要：\n${summary}` },
        ],
      })
      const text = String(content || '').trim().replace(/^["「『]|["」』]$/g, '')
      if (!text) { flash('⚠️ AI 生成结果异常，请重试'); return }
      const next = [...units]
      next[idx] = { ...u, title: text }
      persistUnits(next)
      flash(`✅ 已将本课重命名为《${text}》`)
    } catch (e) {
      flash('⚠️ AI 接口暂不可用：' + (e.message || '请稍后重试'))
    } finally {
      setAiRenameBusy(null)
    }
  }



  // 刷新课程列表
  const refresh = () => setCourses(getCourses())
  useEffect(() => { refresh() }, [])

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  // 提示（2.5 秒自动消失）
  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // 封面图：文件 → dataURL（本地预览 + 待保存/发布时上传 B2 持久化，避免 blob 临时链接刷新失效）
  const applyCoverFile = async (f) => {
    if (!f) return
    const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f) })
    setForm(prev => ({ ...prev, coverUrl: dataUrl, cover: dataUrl, coverName: f.name }))
    flash('封面已选择：保存或发布时自动上传云端（全网可见）')
  }
  const onPickCover = (e) => { applyCoverFile(e.target.files && e.target.files[0]) }
  const onCoverDrop = (e) => { e.preventDefault(); e.stopPropagation(); applyCoverFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) }

  // 封面 dataURL → 上传 B2（thumbs 目录）→ 返回 b2:// URL；失败返回 ''（用占位图兜底）
  const uploadCoverToB2 = async (dataUrl) => {
    try {
      if (!adminKey) return ''
      const pr = await apiFetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'cover_' + Date.now() + '.jpg', kind: 'image', contentType: 'image/jpeg', adminKey })
      })
      const pj = await pr.json()
      if (!pj.ok || !pj.uploadUrl) return ''
      const blob = await (await fetch(dataUrl)).blob()
      const res = await new Promise((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', pj.uploadUrl, true)
        xhr.setRequestHeader('Content-Type', 'image/jpeg')
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
        xhr.onerror = () => resolve(false)
        xhr.send(blob)
      })
      return res ? pj.objectUrl : ''
    } catch (e) { return '' }
  }

  // 保存/发布前解析封面：dataURL → 上传 B2 拿持久地址；已持久化（b2:// 或 http）原样返回
  const resolveCover = async () => {
    const raw = form.cover || form.coverUrl || ''
    if (String(raw).startsWith('data:')) {
      const b2 = await uploadCoverToB2(raw)
      return b2 || raw
    }
    return raw
  }

  // 课件上传：多选（PDF/Word/MP3/MP4）→ 本地 URL 模拟
  const onPickMaterials = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const items = files.map(f => ({ name: f.name, type: f.type || f.name.split('.').pop(), url: URL.createObjectURL(f) }))
    setForm(prev => ({ ...prev, materials: [...prev.materials, ...items] }))
    e.target.value = ''
  }

  const toggleTag = (t) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(t) ? prev.tags.filter(x => x !== t) : [...prev.tags, t],
    }))
  }

  // 组装课程档案对象
  const buildCourse = (status, coverOverride) => {
    const title = form.title.trim()
    if (!title) { flash('请先填写课程标题'); return null }
    const now = Date.now()
    const base = {
      title,
      subtitle: form.subtitle.trim(),
      category: form.category,
      grade: form.grade || '通用',
      textbook: form.textbook || '自编课',
      difficulty: form.difficulty,
      badge: form.badge,
      author: '管理员',
      lessons: Number(form.lessons) || 1,
      students: Number(form.students) || 0,
      tags: form.tags,
      cover: coverOverride || form.coverUrl || 'https://picsum.photos/seed/course_' + now + '/400/280',
      materials: form.materials,
      isGrammar: form.category === '语法专项', // 一级分类为「语法专项」即语法课程（点亮变格天赋树）
      units: [], // 第二步「课程序」填充
      status,
      updatedAt: now,
    }
    return base
  }

  // 保存草稿
  const saveDraft = async () => {
    const coverResolved = await resolveCover()
    const base = buildCourse('draft', coverResolved)
    if (!base) return
    const list = getCourses()
    if (editingId) {
      const i = list.findIndex(c => c.id === editingId)
      if (i >= 0) list[i] = { ...list[i], ...base, units: Array.isArray(list[i].units) ? list[i].units : [], id: editingId }
      flash('草稿已更新')
    } else {
      base.id = 'course_' + Date.now()
      base.createdAt = Date.now()
      list.push(base)
      flash('课程档案已保存（草稿），下一步搭课程序')
    }
    if (!saveCourses(list)) { flash('保存失败：浏览器存储不可用'); return }
    setForm(emptyForm())
    setEditingId('')
    refresh()
  }

  // 直接发布上架（发布后自动同步到云端，全网可见，游戏商城页/商城立即可见）
  const publish = async () => {
    const coverResolved = await resolveCover()
    const base = buildCourse('published', coverResolved)
    if (!base) return
    const list = getCourses()
    if (editingId) {
      const i = list.findIndex(c => c.id === editingId)
      if (i >= 0) list[i] = { ...list[i], ...base, units: Array.isArray(list[i].units) ? list[i].units : [], id: editingId }
      flash('已更新并发布上架！')
    } else {
      base.id = 'course_' + Date.now()
      base.createdAt = Date.now()
      list.push(base)
      flash('已发布上架！共 ' + list.length + ' 个课程')
    }
    if (!saveCourses(list)) { flash('保存失败：浏览器存储不可用'); return }
    setForm(emptyForm())
    setEditingId('')
    refresh()
    // 发布即全网可见：自动同步到云端（需已登录管理员）
    await syncToCloud()
  }

  // 继续编辑（把档案填回表单）
  const edit = (c) => {
    setForm({
      title: c.title || '',
      subtitle: c.subtitle || '',
      category: c.category || '教材同步',
      grade: c.grade || '通用',
      textbook: c.textbook || '自编课',
      difficulty: c.difficulty || '入门',
      badge: c.badge || '',
      lessons: c.lessons || 12,
      students: c.students || 0,
      tags: c.tags || [],
      coverUrl: c.cover || '',
      cover: c.cover || '',
      coverName: '',
      materials: c.materials || [],
    })
    setEditingId(c.id)
    setView('list')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 从云端删除该课程（商城/前端读云端名单，删除必须同步云端才会生效）
  const removeFromCloud = async (id) => {
    if (!adminKey) { flash('请先输入管理员密钥并登录，才能删除云端课程'); return false }
    setCloudBusy(true)
    setCloudMsg('正在从云端删除…')
    try {
      const r = await apiFetch('/api/videos/list')
      const j = await r.json()
      if (!j.ok || !Array.isArray(j.videos)) { setCloudMsg('读取云端列表失败，请重试'); setCloudBusy(false); return false }
      const next = j.videos.filter(v => !(v.kind === 'course' && v.id === id))
      const sr = await apiFetch('/api/videos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: next, adminKey }),
      })
      const sj = await sr.json()
      if (sj.ok) {
        setCloudCount(next.length)
        setCloudMsg('✅ 已从云端删除该课程，商城已同步')
        setCloudBusy(false)
        return true
      }
      setCloudMsg('云端删除失败：' + (sj.error || '未知错误'))
      setCloudBusy(false)
      return false
    } catch (e) {
      setCloudMsg('云端删除失败：' + (e.message || '网络错误'))
      setCloudBusy(false)
      return false
    }
  }

  // 删除课程：已发布课程需先删云端（保证商城同步），再删本地
  const remove = async (id) => {
    const c = getCourses().find(x => x.id === id)
    if (!c) return
    const cloudNote = c.status !== 'draft' ? '（已发布课程会同时从云端/商城移除）' : ''
    if (!window.confirm(`确定删除课程《${c.title}》吗？${cloudNote}此操作不可恢复。`)) return
    if (c.status !== 'draft') {
      if (!adminKey) {
        flash('⚠️ 该课程已发布到云端：请先输入管理员密钥并登录，删除后商城才会同步')
        return
      }
      const ok = await removeFromCloud(id)
      if (!ok) return // 云端删除失败则中止，避免本地删了商城还显示
    }
    deleteCourse(id)
    refresh()
    flash('课程已删除（本地 + 云端）')
  }

  // 清空商城课程：移除云端名单中所有 kind='course'（投稿视频等非课程项保留）
  const clearStoreCourses = async () => {
    if (!adminKey) { setCloudMsg('请先输入管理员密钥并登录'); return }
    if (!window.confirm('确定清空游戏商城里的所有课程吗？\n云端课程将全部移除（投稿视频/非课程内容保留），此操作不可恢复。')) return
    setCloudBusy(true)
    setCloudMsg('正在清空商城课程…')
    try {
      const r = await apiFetch('/api/videos/list')
      const j = await r.json()
      if (!j.ok || !Array.isArray(j.videos)) { setCloudMsg('读取云端列表失败，请重试'); setCloudBusy(false); return }
      const keep = j.videos.filter(v => v.kind !== 'course')
      const sr = await apiFetch('/api/videos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: keep, adminKey }),
      })
      const sj = await sr.json()
      if (sj.ok) {
        setCloudCount(keep.length)
        setCloudMsg('✅ 商城课程已清空，访客商城立即同步')
        const list = getCourses().map(c => ({ ...c, cloudSynced: false }))
        saveCourses(list)
        refresh()
      } else {
        setCloudMsg('清空失败：' + (sj.error || '未知错误'))
      }
    } catch (e) {
      setCloudMsg('清空失败：' + (e.message || '网络错误'))
    }
    setCloudBusy(false)
  }

  // ========== 课程数据跨浏览器迁移（导出 / 导入） ==========
  const exportCourses = () => {
    const raw = localStorage.getItem('rb_admin_courses') || '[]'
    const blob = new Blob([raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rb_admin_courses_backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  const importCoursesFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
        const arr = JSON.parse(text)
        if (!Array.isArray(arr)) throw new Error('格式不是数组')
        localStorage.setItem('rb_admin_courses', JSON.stringify(arr))
        setCourses(getCourses())
        setCloudMsg(`已导入 ${arr.length} 门课程，请刷新页面确认后再同步`)
      } catch (e) {
        setCloudMsg('导入失败：' + e.message)
      }
    }
    reader.readAsText(file)
  }
  // ========== 全网可见：后台课程同步到云端（B2 videos/index.json，访客 GET /api/videos/list 可读） ==========
  const syncToCloud = async () => {
    if (cloudBusy) return
    if (!adminKey) { setCloudMsg('请先输入管理员密钥并登录'); return }
    const localPub = getCourses().filter(c => c.status !== 'draft')
    if (!localPub.length) { setCloudMsg('没有已发布的课程可同步'); return }
    setCloudBusy(true)
    setCloudMsg('同步中…')
    try {
      // 1) 现有云端名单（含投稿视频/投稿课程）
      let cloud = []
      try {
        const r = await apiFetch('/api/videos/list')
        const j = await r.json()
        if (j.ok && Array.isArray(j.videos)) cloud = j.videos
      } catch (e) { /* 读不到就当空 */ }
      // 2) 后台已发布课程 → 云端对象（带 units 课时内容），与投稿课程同结构（kind='course'）
      const localObj = localPub.map(c => ({
        ...c,
        kind: 'course',
        src: 'admin', // 后台发布课程标记：商城仅展示 src=admin 的课程（投稿课程不展示）
        section: 'guide',
        cat: c.category,
        category: c.category,
        level: c.difficulty,
        stage: c.grade,
        grade: c.grade,
        textbook: c.textbook,
        eps: (Array.isArray(c.units) ? c.units.length : (c.lessons || 1)) + ' 关',
        total: Array.isArray(c.units) ? c.units.length : (c.lessons || 1),
        thumbnail: c.cover,
        posterUrl: c.cover,
        views: c.students || 0,
        tags: ['course', c.category, c.grade, c.textbook],
      }))
      // 3) 合并：保留云端非本地上传的项，本地上传的同 id 覆盖
      const mineIds = new Set(localObj.map(x => x.id))
      const keep = cloud.filter(v => !(v.kind === 'course' && mineIds.has(v.id)))
      const merged = [...keep, ...localObj]
      // 4) 全量写回 B2
      const sr = await apiFetch('/api/videos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: merged, adminKey }),
      })
      const sj = await sr.json()
      if (sj.ok) {
        setCloudCount(merged.length)
        setCloudMsg('✅ 已同步 ' + localObj.length + ' 门课程到云端，访客可公开访问（名单共 ' + merged.length + ' 项）')
        // 打标 cloudSynced
        const list = getCourses().map(c => localObj.some(x => x.id === c.id) ? { ...c, cloudSynced: true } : c)
        saveCourses(list)
        refresh()
      } else {
        setCloudMsg('同步失败：' + (sj.error || '未知错误'))
      }
    } catch (e) {
      setCloudMsg('同步失败：' + (e.message || '网络错误'))
    }
    setCloudBusy(false)
  }

  const doAdminLogin = async () => {
    const ok = await login(adminInput)
    setCloudMsg(ok ? '✅ 管理员已登录，可以同步到云端' : '密钥无效，请检查')
  }

  // ========== 第二步：课程序管理 ==========

  // 进入课程序管理
  const manageUnits = (c) => {
    setActive(c)
    setUnits(c.units || [])
    setNewUnitTitle('')
    setView('units')
    window.scrollTo({ top: 0 })
  }

  // 持久化课时列表并同步 active
  const persistUnits = (next) => {
    setUnits(next)
    const list = getCourses()
    const i = list.findIndex(x => x.id === active.id)
    if (i >= 0) {
      const updated = { ...list[i], units: next, lessons: next.length || list[i].lessons, updatedAt: Date.now() }
      list[i] = updated
      saveCourses(list)
      setActive(updated)
      refresh()
    }
  }

  // 手动添加课时
  const addUnit = () => {
    const t = newUnitTitle.trim() || ('第 ' + (units.length + 1) + ' 课')
    persistUnits([...units, { id: 'unit_' + Date.now(), title: t, desc: '', vocab: '', imported: false }])
    setNewUnitTitle('')
  }

  // 上移 / 下移
  const moveUnit = (idx, dir) => {
    const to = idx + dir
    if (to < 0 || to >= units.length) return
    const next = [...units]
    ;[next[idx], next[to]] = [next[to], next[idx]]
    persistUnits(next)
  }

  // 删除课时
  const removeUnit = (idx) => {
    persistUnits(units.filter((_, i) => i !== idx))
  }

  // ========== 第三步：课时内容管理 ==========

  // 进入课时内容
  const openUnit = (u) => {
    setActiveUnit({ ...u })
    setNewSentRu('')
    setNewSentZh('')
    setView('unit')
    window.scrollTo({ top: 0 })
  }

  // 更新 activeUnit 副本
  const patchUnit = (patch) => setActiveUnit(prev => ({ ...prev, ...patch }))

  // 课时是否已挂内容（生词/例句/滚雪球路径/素材任一非空）
  const unitHasContent = (u) =>
    (u.sentences && u.sentences.length) ||
    (u.scaffoldingPaths && u.scaffoldingPaths.length) ||
    (u.materials && u.materials.length)

  // 保存课时内容（写回课程 units）
  const saveUnit = () => {
    if (!activeUnit) return
    const nextUnits = units.map(u => (u.id === activeUnit.id ? activeUnit : u))
    persistUnits(nextUnits)
    const sent = (activeUnit.sentences || []).length
    const paths = (activeUnit.scaffoldingPaths || []).length
    const words = (activeUnit.words || []).length
    const stats = [words ? words + ' 词' : '', sent ? sent + ' 句' : '', paths ? paths + ' 条路径' : ''].filter(Boolean).join(' · ')
    const left = nextUnits.filter(u => !unitHasContent(u)).length
    setSaveBanner({ title: activeUnit.title, stats: stats || '（暂无内容）', left })
    flash(`已保存《${activeUnit.title}》` + (stats ? '：' + stats : '') + (left ? `，还有 ${left} 个课时未挂内容` : '，所有课时已就绪'))
    setView('units')
  }

  // 手动添加例句
  const addSentence = () => {
    const ru = newSentRu.trim()
    const zh = newSentZh.trim()
    if (!ru || !zh) { flash('例句需同时填写俄语和中文'); return }
    patchUnit({ sentences: [...(activeUnit.sentences || []), { ru, zh }] })
    setNewSentRu('')
    setNewSentZh('')
  }

  // 删除例句
  const removeSentence = (idx) => {
    patchUnit({ sentences: (activeUnit.sentences || []).filter((_, i) => i !== idx) })
  }
  // 删除一条滚动学习路径
  const removePath = (pi) => {
    const paths = [...(activeUnit.scaffoldingPaths || [])].filter((_, i) => i !== pi)
    patchUnit({ scaffoldingPaths: paths })
  }

  // ========== AI 前置数据入库：批量导入 JSON 句子 + 修复中文（缺失/逐词硬拼），前端只渲染固定数据 ==========
  // 检测某句中文是否需要 AI 修复：缺失 / 俄语残留 / 明显逐词硬拼（如「谁这是？」）
  const needsZhFix = (s) => {
    const zh = String(s.chinese || s.zh || '').trim()
    if (!zh) return true
    if (/[а-яё]/i.test(zh)) return true
    if (/^(谁|什么|哪儿|哪里|怎么|为什么|多少|几)[^。！？]*?(这|那)是/.test(zh)) return true
    return false
  }
  // AI 不可用时的本地兜底修复（仅处理典型「疑问词前置 + 这是」语序错位）
  const localFixZh = (zh) => {
    let t = String(zh || '').trim()
    const m = t.match(/^(谁|什么|哪儿|哪里|怎么|为什么|多少|几)([^。！？]*?)(这|那)是/)
    if (m) t = m[3] + '是' + m[2] + m[1] + t.slice(m[0].length)
    return t
  }
  // 批量调用后端 AI（密钥在服务端）：整句地道中文 + 意群块 chunks
  const aiFixSentences = async (sentences) => {
    const items = sentences.map((s) => String(s.ru || s.russian || '').trim()).filter(Boolean)
    if (!items.length) return {}
    const content = await chat({
      messages: [
        { role: 'system', content: '你是资深俄语→中文翻译，擅长合并意群、调整语序，输出地道中文。' },
        { role: 'user', content:
          '请将以下俄语句子翻译成地道的中文，并自动合并意群，避免逐词硬拼（例如 "Кто это?" 应译为 "这是谁？" 而不是 "谁这是？"）。\n' +
          '返回 JSON 格式：{"items":[{"ru":"原句","chinese":"地道整句中文","chunks":["意群块1","意群块2"]}]}，只输出 JSON。\n句子列表：\n' + JSON.stringify(items) },
      ],
    })
    const r = parseAIJSON(content)
    const map = {}
    ;(Array.isArray(r && r.items) ? r.items : []).forEach((it) => {
      const ru = String(it && it.ru || '').trim()
      if (ru) map[ru] = { chinese: String(it.chinese || '').trim(), chunks: Array.isArray(it.chunks) ? it.chunks.filter(Boolean) : [] }
    })
    return map
  }
  // 粘贴句子 JSON 数组 [{ru, zh}] → 检测异常 → AI 修复 → 去重追加（前端此后直接读 chinese）
  // —— 兼容三类导入：句子数组 / 滚动学习路径 {pathId,steps} / 对话 dialogues ——
  const normalizeImportData = (data) => {
    const out = { sentences: [], paths: [], dialogues: [] }
    const items = Array.isArray(data) ? data : [data]
    items.forEach((it) => {
      if (!it || typeof it !== 'object') return
      // ① 滚动学习路径：{ pathId, steps: [...] }（连词成句「滚雪球」步骤）
      if (Array.isArray(it.steps) && (it.pathId || it.steps.length)) {
        out.paths.push({
          pathId: String(it.pathId || 'path_' + Date.now()),
          steps: it.steps.map((st, i) => ({
            stepIndex: Number(st.stepIndex) || i + 1,
            russian: String(st.russian || st.ru || '').trim(),
            chinese: String(st.chinese || st.zh || '').trim(),
            audioUrl: String(st.audioUrl || st.audio || '').trim(),
            newChunks: Array.isArray(st.newChunks) ? st.newChunks : [],
            allChunks: Array.isArray(st.allChunks) ? st.allChunks : [],
          })).filter((st) => st.russian),
        })
        return
      }
      // ② 混合对象 / 对话：{ sentences:[...] } / { dialogues:[...] } / { dialogue:[...] }
      if (Array.isArray(it.sentences) || Array.isArray(it.dialogues) || Array.isArray(it.dialogue)) {
        if (Array.isArray(it.sentences)) out.sentences.push(...it.sentences)
        if (Array.isArray(it.dialogues)) out.dialogues.push(...it.dialogues)
        if (Array.isArray(it.dialogue)) out.dialogues.push(...it.dialogue)
        return
      }
      // ③ 单句（数组元素）：{ ru / russian / text }
      if (it.ru || it.russian || it.text) out.sentences.push(it)
    })
    return out
  }
  const importSentencesJson = async () => {
    const text = (jsonText || '').trim()
    if (!text) { flash('请先粘贴 JSON'); return }
    let data
    try { data = JSON.parse(text) }
    catch (e) { flash('JSON 解析失败：' + e.message); return }
    const { sentences, paths, dialogues } = normalizeImportData(data)
    // 1) 句子：AI 修复中文 + 去重追加（老逻辑，兼容老数据）
    if (sentences.length) {
      const list = sentences.map((s) => ({
        ru: String(s.ru || s.russian || s.text || '').trim(),
        zh: String(s.zh || '').trim(),
        chinese: String(s.chinese || s.zh || '').trim(),
      })).filter((s) => s.ru)
      if (list.length) {
        const need = list.filter((s) => needsZhFix(s))
        let fixed = list
        if (need.length) {
          setJsonBusy(true)
          try {
            const aiMap = await aiFixSentences(need)
            fixed = list.map((s) => (aiMap[s.ru] ? { ...s, chinese: aiMap[s.ru].chinese || s.chinese, chunks: aiMap[s.ru].chunks } : s))
            flash(`✅ AI 已修复 ${Object.keys(aiMap).length} 句中文（语序/意群）`)
          } catch (e) {
            fixed = list.map((s) => (needsZhFix(s) ? { ...s, chinese: localFixZh(s.chinese || s.zh) } : s))
            flash('⚠️ AI 接口暂不可用：已用本地规则修复典型逐词句，其余请人工复核后保存')
          }
          setJsonBusy(false)
        }
        const merged = [...(activeUnit.sentences || [])]
        const existIdx = new Map()
        merged.forEach((x, i) => { const k = String(x.ru || '').trim().toLowerCase(); if (k && !existIdx.has(k)) existIdx.set(k, i) })
        fixed.forEach((s) => {
          const k = String(s.ru).trim().toLowerCase()
          const i = existIdx.get(k)
          if (i >= 0) {
            const cur = merged[i].chinese || merged[i].zh || ''
            if (s.chinese && s.chinese !== cur) {
              merged[i] = { ...merged[i], chinese: s.chinese, chunks: s.chunks || merged[i].chunks }
            }
          } else {
            merged.push(s)
            existIdx.set(k, merged.length - 1)
          }
        })
        patchUnit({ sentences: merged })
      }
    }
    // 2) 滚动学习路径：按 pathId 去重合并（同 pathId 用新 steps 覆盖）
    if (paths.length) {
      const prev = [...(activeUnit.scaffoldingPaths || [])]
      const pathIds = new Set(prev.map((p) => p.pathId))
      paths.forEach((p) => {
        if (pathIds.has(p.pathId)) {
          const i = prev.findIndex((x) => x.pathId === p.pathId)
          prev[i] = p
        } else {
          prev.push(p)
          pathIds.add(p.pathId)
        }
      })
      patchUnit({ scaffoldingPaths: prev })
    }
    // 3) 对话：透传保存（按 JSON 去重）
    if (dialogues.length) {
      const prev = [...(activeUnit.dialogues || [])]
      const seen = new Set(prev.map((d) => JSON.stringify(d)))
      dialogues.forEach((d) => { const k = JSON.stringify(d); if (!seen.has(k)) { prev.push(d); seen.add(k) } })
      patchUnit({ dialogues: prev })
    }
    if (!sentences.length && !paths.length && !dialogues.length) {
      flash('未识别到可导入内容：需要 句子数组 / {pathId,steps} 滚动路径 / dialogues')
      return
    }
    flash(`✅ 导入完成：句子 ${sentences.length} 条、滚动路径 ${paths.length} 条、对话 ${dialogues.length} 条（点「保存课时内容」固定入库）`)
    setJsonText('')
    if (paths.length) {
      setTimeout(() => { const el = document.getElementById('scaffold-section'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 300)
    }
  }
  // —— 手动修正（后台保留）：行内编辑 sentence 的 ru / chinese / chunks ——
  const startEditSent = (i) => {
    const s = (activeUnit.sentences || [])[i]
    setEditSentIdx(i)
    setEditSent({ ru: s.ru || '', zh: s.chinese || s.zh || '', chunks: Array.isArray(s.chunks) ? JSON.stringify(s.chunks) : '' })
  }
  const saveEditSent = () => {
    const ru = editSent.ru.trim()
    if (!ru) { flash('俄语不能为空'); return }
    let chunks
    try { chunks = editSent.chunks.trim() ? JSON.parse(editSent.chunks) : undefined }
    catch (e) { flash('chunks 不是合法 JSON 数组'); return }
    if (chunks !== undefined && !Array.isArray(chunks)) { flash('chunks 必须是数组'); return }
    const sentences = [...(activeUnit.sentences || [])]
    sentences[editSentIdx] = { ...sentences[editSentIdx], ru, zh: editSent.zh.trim(), chinese: editSent.zh.trim(), chunks }
    patchUnit({ sentences })
    setEditSentIdx(-1)
  }
  const cancelEditSent = () => setEditSentIdx(-1)
  // 课时素材上传（视频/音频/PDF）
  const onPickUnitMaterial = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const items = files.map(f => ({ name: f.name, type: f.type || f.name.split('.').pop(), url: URL.createObjectURL(f) }))
    patchUnit({ materials: [...(activeUnit.materials || []), ...items] })
    e.target.value = ''
  }

  // ========== 渲染 ==========

  // —— 视图三：课时内容管理 ——
  if (view === 'unit' && activeUnit) {
    return (
      <main className="min-h-full bg-base-100 px-6 py-7">
        <div className="mx-auto max-w-[1000px]">
          {toast && (
            <div className="alert alert-success mb-4 shadow-lg" style={{ padding: '10px 16px' }}>
              <span>✅ {toast}</span>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <button className="btn btn-ghost btn-sm -ml-2 text-gray-500" onClick={() => setView('units')}>← 返回课程序</button>
              <h1 className="text-xl font-extrabold text-gray-900 mt-1">{active.title} · {activeUnit.title}</h1>
              <p className="text-xs text-gray-400 mt-0.5">第三步 · 挂内容：例句 + 滚动路径 + 素材</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveUnit}>💾 保存课时内容</button>
          </div>

          {/* ① 例句 */}
          <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-5">
              <h2 className="card-title text-base text-gray-900">① 例句（可手动添加 / 编辑）</h2>

              {(!activeUnit.sentences || !activeUnit.sentences.length) ? (
                <p className="py-8 text-center text-sm text-gray-400">还没有例句，可手动添加；主内容走「滚动学习路径」。</p>
              ) : (
                <>
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    <span className="badge badge-success badge-sm">{activeUnit.sentences.length} 句</span>
                    <span className="badge badge-ghost badge-sm">{((activeUnit.words || []).length) || '-'} 词</span>
                  </div>
                  <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {(activeUnit.sentences || []).map((s, i) => (
                      editSentIdx === i ? (
                        <div key={i} className="rounded-xl border border-primary/40 bg-primary/5 px-3 py-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-primary w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                            <span className="text-xs font-semibold text-gray-600">编辑例句（手动修正中文 / 意群块）</span>
                          </div>
                          <input className="input input-bordered input-sm w-full text-sm mb-1.5" placeholder="俄语（ru）" value={editSent.ru} onChange={e => setEditSent({ ...editSent, ru: e.target.value })} />
                          <input className="input input-bordered input-sm w-full text-sm mb-1.5" placeholder="地道中文（chinese）" value={editSent.zh} onChange={e => setEditSent({ ...editSent, zh: e.target.value })} />
                          <input className="input input-bordered input-sm w-full font-mono text-xs mb-2" placeholder={'chunks JSON 数组，如 ["Кто это?"]（可留空 = 前端按本地规则切块）'} value={editSent.chunks} onChange={e => setEditSent({ ...editSent, chunks: e.target.value })} />
                          <div className="flex gap-2">
                            <button className="btn btn-primary btn-xs" onClick={saveEditSent}>保存</button>
                            <button className="btn btn-ghost btn-xs" onClick={cancelEditSent}>取消</button>
                          </div>
                        </div>
                      ) : (
                        <div key={i} className="flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                          <span className="text-xs font-bold text-gray-400 w-6 shrink-0 pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-gray-900">{s.ru}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{s.chinese || s.zh || <span className="text-amber-600">（缺中文，请编辑或用 AI 修复）</span>}</div>
                            {Array.isArray(s.chunks) && s.chunks.length > 0 && (
                              <div className="text-[10px] text-gray-300 mt-0.5 font-mono">意群块：{s.chunks.join(' | ')}</div>
                            )}
                          </div>
                          <button className="btn btn-ghost btn-xs text-gray-500 shrink-0" onClick={() => startEditSent(i)}>编</button>
                          <button className="btn btn-error btn-xs btn-outline shrink-0" onClick={() => removeSentence(i)}>删</button>
                        </div>
                      )
                    ))}
                  </div>
                </>
              )}

              {/* 手动添加例句 */}
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <input className="input input-bordered flex-1 text-sm" placeholder="俄语例句" value={newSentRu} onChange={e => setNewSentRu(e.target.value)} />
                <input className="input input-bordered flex-1 text-sm" placeholder="中文翻译" value={newSentZh} onChange={e => setNewSentZh(e.target.value)} />
                <button className="btn btn-outline btn-sm" onClick={addSentence}>+ 添加</button>
              </div>

              {/* ② 滚动学习路径（scaffoldingPaths）——连词成句滚雪球 */}
              <div id="scaffold-section" className="card mt-4 border border-purple-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
                <div className="card-body p-5">
                  <h2 className="card-title text-base text-gray-900">② 滚动学习路径（连词成句滚雪球）</h2>
                  <p className="text-xs text-gray-400 mt-1">按 pathId 分组展示；每个 step 就是答题页的一个关卡，顺序即教学顺序。粘贴 pathId + steps 结构 JSON 后立即显示在这里。</p>
                  {(!activeUnit.scaffoldingPaths || !activeUnit.scaffoldingPaths.length) ? (
                    <p className="py-6 text-center text-sm text-gray-400">还没有路径。在下方「批量导入 JSON」粘贴 pathId + steps 数据即可。</p>
                  ) : (
                    <div className="mt-3 space-y-3 max-h-[480px] overflow-y-auto pr-1">
                      {(activeUnit.scaffoldingPaths || []).map((p, pi) => (
                        <div key={pi} className="rounded-xl border border-purple-200 bg-purple-50/50 px-3 py-2.5">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs font-bold text-purple-700">路径 {p.pathId} · {p.steps.length} 关</span>
                            <button className="btn btn-error btn-xs btn-outline" onClick={() => removePath(pi)}>删路径</button>
                          </div>
                          <div className="mt-2 space-y-1">
                            {(p.steps || []).map((st, si) => (
                              <div key={si} className="flex items-center gap-2 text-xs rounded-lg bg-white/70 px-2 py-1.5">
                                <span className="font-bold text-gray-400 w-7 shrink-0">{st.stepIndex || si + 1}</span>
                                <span className="font-mono text-gray-800 min-w-0 truncate flex-1">{st.russian}</span>
                                <span className="text-gray-400 shrink-0">{st.chinese}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 批量导入 JSON（AI 前置修复中文）+ 连词成句课程生成器（并排） */}
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-dashed border-gray-300 p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold text-gray-600">📋 批量导入 JSON（句子数组 / 滚动学习路径 / 对话）+ AI 修复中文（缺失/逐词硬拼）</span>
                    <button className="btn btn-outline btn-xs" onClick={importSentencesJson} disabled={jsonBusy}>
                      {jsonBusy ? 'AI 修复中…' : '导入并 AI 修复'}
                    </button>
                  </div>
                  <textarea
                    className="textarea textarea-bordered mt-2 w-full font-mono text-xs"
                    rows={3}
                    placeholder={'[{ "ru": "Кто это?", "zh": "谁这是？" }, { "ru": "Это дом.", "zh": "这是房子。" }]\n或滚动路径：{ "pathId": "path_01", "steps": [{ "stepIndex": 1, "russian": "Это", "chinese": "这", "newChunks": [{ "word": "Это", "translation": "这", "role": "主语" }], "allChunks": [] }] }\n说明：缺失中文 / 含俄语 / 明显逐词硬拼的句子自动交 AI 重译；滚动路径（连词成句滚雪球）与对话数据按原结构透传保存。'}
                    value={jsonText}
                    onChange={e => setJsonText(e.target.value)}
                  />
                </div>

                {/* 连词成句课程生成器：单词 → 提示词 → 一键复制 */}
                <div className="card border border-gray-200 bg-base-100 shadow-sm">
                  <div className="card-body p-4">
                    <h3 className="card-title text-sm text-gray-900">连词成句课程生成器</h3>
                    <label className="label pb-1">
                      <span className="label-text text-xs text-gray-600">请输入单词（逗号隔开；每组一行 = 一课，可批量生成）</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered w-full font-mono text-xs"
                      rows={4}
                      placeholder={'это, Иван, Анна, дом\nдом, лампа, вода, книга（每组一行=一课，留空则用本课已有词条）'}
                      value={genWords}
                      onChange={e => setGenWords(e.target.value)}
                    />
                    <div className="mt-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button className="btn btn-primary btn-sm" onClick={aiGenPath} disabled={genBusy}>
                          {genBusy ? 'AI 生成中…' : '🤖 AI 一键生成路径'}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={generatePrompt} disabled={genBusy}>生成提示词</button>
                        <button className="btn btn-secondary btn-sm" onClick={batchGenPaths} disabled={genBusy}>
                          {genBusy ? '批量生成中…' : `🚀 批量生成（${genWords.trim() ? genWords.split(/\r?\n/).filter(l => l.trim() && l.split(/[，,]/).some(w => w.trim())).length : 0} 课）`}
                        </button>
                      </div>
                    </div>
                    {showGenPrompt && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-semibold text-gray-600">生成的提示词（复制后粘贴给 AI 生成 JSON）</span>
                          <button className="btn btn-outline btn-xs" onClick={copyPrompt}>一键复制</button>
                        </div>
                        <textarea
                          className="textarea textarea-bordered mt-1 w-full font-mono text-xs"
                          rows={7}
                          value={genPrompt}
                          onChange={e => setGenPrompt(e.target.value)}
                          placeholder="生成的提示词可在此直接编辑（增删单词/规则），改完点「一键复制」复制修改后的版本"
                        />
                      </div>
                    )}

                    {/* 课文句子 → 机器生成滚雪球 + AI 审核（用户拍板方案：机器按拆词规则生成，AI 只审核语义/语序，末步强制=原句） */}
                    <div className="divider my-3 text-xs text-gray-400">或：课文句子 → 机器生成 + AI 审核（末步强制=原句）</div>
                    <label className="label pb-1">
                      <span className="label-text text-xs text-gray-600">粘贴课文句子（每行一句）：先按拆词规则机器生成路径，再交 AI 审核语序/语义并翻译中文，最后一步 100% 等于原句</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered w-full font-mono text-xs"
                      rows={4}
                      placeholder={'Улица Чистые пруды — это старая улица в центре Москвы.\nЭта улица небольшая, но известная.'}
                      value={sentencesInput}
                      onChange={e => setSentencesInput(e.target.value)}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-gray-600">每批
                        <input type="number" min="1" max="5" className="input input-xs input-bordered w-14 text-center" value={snowballBatch}
                          onChange={e => setSnowballBatch(Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 1)))} />
                        条
                      </label>
                      <button className="btn btn-primary btn-sm" onClick={() => genSnowballCourse('append')} disabled={snowballBusy || snowballDone >= snowballLineCount}>
                        {snowballBusy ? '生成+审核中…' : snowballDone >= snowballLineCount ? '✅ 已全部生成' : `🧊 生成下一批（${Math.min(snowballDone + 1, snowballLineCount)}-${Math.min(snowballDone + snowballBatch, snowballLineCount)} / ${snowballLineCount}）`}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => genSnowballCourse('full')} disabled={snowballBusy}>
                        ↺ 重新生成全部
                      </button>
                      {snowballResult && (
                        <button className="btn btn-secondary btn-sm" onClick={saveSnowball}>
                          💾 保存到本课时（{snowballResult.length} 条路径）
                        </button>
                      )}
                    </div>
                    {!snowballBusy && snowballDone > 0 && snowballDone < snowballLineCount && (
                      <p className="mt-1 text-xs text-gray-400">少量多次生成可降低长句出错率；改过句子后请点「重新生成全部」，避免追加错位</p>
                    )}
                    {snowballResult && (
                      <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-2">
                        {snowballResult.map(p => (
                          <div key={p.pathId} className="mb-2 rounded border border-gray-200 bg-white p-2">
                            <div className="mb-1 text-xs font-semibold text-gray-600">{p.pathId}</div>
                            {p.steps.map(s => (
                              <div key={s.stepIndex} className="flex items-baseline gap-2 py-0.5 text-xs">
                                <span className="w-6 shrink-0 text-right text-gray-400">{s.stepIndex}</span>
                                <span className="font-medium text-gray-800">{s.russian}</span>
                                <span className="text-gray-500">{s.chinese}</span>
                                {s.stepIndex < p.steps.length && (
                                  <button className="ml-auto shrink-0 px-1 text-gray-300 hover:text-red-500" title="删除此步骤（末步=原句，不可删）"
                                    onClick={() => removeSnowballStep(p.pathId, s.stepIndex)}>✕</button>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ③ 课时素材 */}
          <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-5">
              <h2 className="card-title text-base text-gray-900">③ 课时素材（视频 / 音频 / PDF）</h2>
              <input type="file" multiple accept=".pdf,.doc,.docx,.mp3,.mp4,audio/*,video/*" className="file-input file-input-bordered file-input-sm mt-2" onChange={onPickUnitMaterial} />
              {(activeUnit.materials || []).length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">还没有素材。可挂本课的视频、音频、课件 PDF。</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {(activeUnit.materials || []).map((m, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600">
                      <span className="badge badge-ghost badge-xs">{String(m.type).split('/').pop()}</span>
                      <span className="truncate flex-1">{m.name}</span>
                      <a href={m.url} target="_blank" rel="noreferrer" className="link link-primary">预览</a>
                      <button className="btn btn-ghost btn-xs text-gray-400" onClick={() => patchUnit({ materials: (activeUnit.materials || []).filter((_, j) => j !== i) })}>✕</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4">
                <button className="btn btn-primary" onClick={saveUnit}>💾 保存课时内容</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // —— 视图二：课程序管理 ——
  if (view === 'units' && active) {
    return (
      <main className="min-h-full bg-base-100 px-6 py-7">
        <div className="mx-auto max-w-[1000px]">
          {toast && (
            <div className="alert alert-success mb-4 shadow-lg" style={{ padding: '10px 16px' }}>
              <span>✅ {toast}</span>
            </div>
          )}

          {saveBanner && (
            <div className="alert alert-success mb-4 shadow-lg border-2 border-success/60" style={{ padding: '12px 16px' }}>
              <div className="flex-1">
                <div className="text-sm font-bold">✅ 已保存《{saveBanner.title}》{saveBanner.stats}</div>
                <div className="text-xs mt-1 opacity-80">
                  {saveBanner.left > 0
                    ? `还有 ${saveBanner.left} 个课时未挂内容，建议逐课保存后再发布。`
                    : '本课程所有课时都已挂内容，可以发布上架了！'}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {saveBanner.left > 0 ? (
                  <button
                    className="btn btn-primary btn-xs"
                    onClick={() => {
                      const n = units.findIndex(u => !unitHasContent(u))
                      if (n >= 0) openUnit(units[n])
                    }}
                  >继续编辑下一课</button>
                ) : (
                  <button className="btn btn-primary btn-xs" onClick={() => { setSaveBanner(null); publish() }}>🚀 发布上架</button>
                )}
                <button className="btn btn-ghost btn-xs" onClick={() => setSaveBanner(null)}>知道了</button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <button className="btn btn-ghost btn-sm -ml-2 text-gray-500" onClick={() => setView('list')}>← 返回课程列表</button>
              <h1 className="text-xl font-extrabold text-gray-900 mt-1">{active.title}</h1>
              <p className="text-xs text-gray-400 mt-0.5">第二步 · 搭课程序：共 {units.length} 个课时</p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/game-mall')}>去商城查看 →</button>
          </div>

          {/* 课时列表 */}
          <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-5">
              <h2 className="card-title text-base text-gray-900">课时列表</h2>
              {units.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">还没有课时，点右上角「手动添加课时」创建第一课。</p>
              ) : (
                <div className="space-y-2">
                  {units.map((u, i) => {
                    const hasContent = unitHasContent(u)
                    return (
                      <div key={u.id} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                        <span className="text-xs font-bold text-gray-400 w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800 truncate">{u.title}</span>
                            {u.imported && <span className="badge badge-info badge-xs shrink-0">AI导入</span>}
                            {hasContent && <span className="badge badge-success badge-xs shrink-0">已挂内容</span>}
                          </div>
                          {u.desc && <div className="text-xs text-gray-400 mt-0.5 truncate">{u.desc}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button className="btn btn-ghost btn-xs" title="AI 根据本课内容生成课时名" disabled={aiRenameBusy !== null} onClick={() => aiRenameUnit(i)}>
                            {aiRenameBusy === i ? '…' : '🤖 改名'}
                          </button>
                          <button className="btn btn-primary btn-xs" onClick={() => openUnit(u)}>内容</button>
                          <button className="btn btn-ghost btn-xs" disabled={i === 0} onClick={() => moveUnit(i, -1)}>↑</button>
                          <button className="btn btn-ghost btn-xs" disabled={i === units.length - 1} onClick={() => moveUnit(i, 1)}>↓</button>
                          <button className="btn btn-error btn-xs btn-outline" onClick={() => removeUnit(i)}>删除</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 手动添加 */}
          <div className="card mt-4 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-body p-5">
              <h2 className="card-title text-base text-gray-900">手动添加课时</h2>
              <div className="flex gap-2 mt-2">
                <input
                  className="input input-bordered flex-1"
                  value={newUnitTitle}
                  onChange={e => setNewUnitTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addUnit() }}
                  placeholder={'课时标题，留空自动命名「第 ' + (units.length + 1) + ' 课」'}
                />
                <button type="button" className="btn btn-outline btn-primary" onClick={aiGenUnitTitle} disabled={aiUnitTitleBusy}>
                  {aiUnitTitleBusy ? '生成中…' : '🤖 AI 生成课时名'}
                </button>
                <button className="btn btn-primary" onClick={addUnit}>+ 添加</button>
              </div>
            </div>
          </div>

        </div>
      </main>
    )
  }

  // —— 视图一：档案表单 + 课程列表 ——
  return (
    <main className="min-h-full bg-base-100 px-6 py-7">
      <div className="mx-auto max-w-[1100px]">
        <h1 className="text-2xl font-extrabold text-gray-900">课程包管理后台</h1>
        <p className="mt-1 text-sm text-gray-400">第一步：建课程档案 → 第二步：搭课程序 → 第三步：挂内容 → 第四步：发布</p>

        {toast && (
          <div className="alert alert-success mt-4 shadow-lg" style={{ padding: '10px 16px' }}>
            <span>✅ {toast}</span>
          </div>
        )}

        {/* ===== ① 课程档案表单 ===== */}
        <div className="card mt-5 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
          <div className="card-body p-6">
            <h2 className="card-title text-base text-gray-900">
              {editingId ? '编辑课程档案' : '① 新建课程档案'}
              {editingId && <span className="badge badge-warning badge-sm ml-1">编辑中</span>}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="form-control sm:col-span-2">
                <label className="label"><span className="label-text">课程标题 *</span></label>
                <input className="input input-bordered" value={form.title} onChange={e => setField('title', e.target.value)} placeholder="例如：走遍俄罗斯 · 第1课《字母与问候》" />
              </div>

              <div className="form-control sm:col-span-2">
                <label className="label">
                  <span className="label-text">课程简介</span>
                  <button type="button" className="btn btn-primary btn-xs" onClick={aiGenDesc} disabled={aiDescBusy}>
                    {aiDescBusy ? '生成中…' : '✨ AI 自动生成'}
                  </button>
                </label>
                <textarea className="textarea textarea-bordered" rows={5} value={form.subtitle} onChange={e => setField('subtitle', e.target.value)} placeholder="可手动填写一句话简介，或点击右上角「✨ AI 自动生成」生成：课程介绍 / 学习目标 / 适合谁学" />
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">封面图（可点击选择或拖拽图片到下方区域）</span></label>
                <input type="file" accept="image/*" className="file-input file-input-bordered file-input-sm" onChange={onPickCover} />
                <div
                  className="group mt-2 h-32 w-full cursor-pointer overflow-hidden rounded-lg border border-gray-200 transition-colors hover:border-primary"
                  onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={onCoverDrop}
                  onClick={() => document.querySelector('#admin-cover-picker')?.click()}
                >
                  <input id="admin-cover-picker" type="file" accept="image/*" className="hidden" onChange={onPickCover} />
                  {form.coverUrl ? (
                    <img src={form.coverUrl} alt="封面预览" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center border border-dashed border-gray-300 text-xs text-gray-400 group-hover:border-primary group-hover:text-primary">点击选择 或 拖拽图片到此处</div>
                  )}
                </div>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">课件上传（PDF/Word/MP3/MP4）</span></label>
                <input type="file" multiple accept=".pdf,.doc,.docx,.mp3,.mp4,audio/*,video/*" className="file-input file-input-bordered file-input-sm" onChange={onPickMaterials} />
                {form.materials.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {form.materials.map((m, i) => (
                      <li key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600">
                        <span className="badge badge-ghost badge-xs">{String(m.type).split('/').pop()}</span>
                        <span className="truncate flex-1">{m.name}</span>
                        <a href={m.url} target="_blank" rel="noreferrer" className="link link-primary">预览</a>
                        <button className="btn btn-ghost btn-xs text-gray-400" onClick={() => setForm(prev => ({ ...prev, materials: prev.materials.filter((_, j) => j !== i) }))}>✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">一级分类</span></label>
                <select className="select select-bordered" value={form.category} onChange={e => setField('category', e.target.value)}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">难度</span></label>
                <select className="select select-bordered" value={form.difficulty} onChange={e => setField('difficulty', e.target.value)}>
                  {DIFFS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">年级</span></label>
                <select className="select select-bordered" value={form.grade} onChange={e => setField('grade', e.target.value)}>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">教材版本</span></label>
                <select className="select select-bordered" value={form.textbook} onChange={e => setField('textbook', e.target.value)}>
                  {TEXTBOOKS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">角标</span></label>
                <select className="select select-bordered" value={form.badge} onChange={e => setField('badge', e.target.value)}>
                  {BADGES.map(b => <option key={b} value={b}>{b === '' ? '无' : b}</option>)}
                </select>
              </div>

            </div>

            {/* 二级标签多选（按一级分类联动） */}
            <div className="form-control mt-3">
              <label className="label"><span className="label-text">二级标签（{form.category}）：{TAG_POOL[form.category]?.length || 0} 个可选，多选</span></label>
              <div className="flex flex-wrap gap-2">
                {(TAG_POOL[form.category] || []).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`badge badge-lg cursor-pointer transition-colors ${form.tags.includes(t) ? 'badge-primary' : 'badge-ghost'}`}
                    style={{ padding: '8px 12px' }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <button className="btn btn-primary" onClick={saveDraft}>💾 保存草稿</button>
              <button className="btn btn-outline" onClick={publish}>🚀 发布上架</button>
              <button className="btn btn-ghost" onClick={() => { setForm(emptyForm()); setEditingId(''); flash('表单已清空') }}>清空表单</button>
              <button className="btn btn-outline btn-sm ml-auto" onClick={() => navigate('/game-mall')}>去商城查看 →</button>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              💡 第一步只建「课程档案」：保存草稿后不会出现在商城；保存后点下方列表的「搭课程序」进入第二步。
            </div>
          </div>
        </div>

        {/* ===== ①.5 全网可见 · 云端同步 ===== */}
        <div className="card mt-6 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
          <div className="card-body p-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="card-title text-base text-gray-900">🌐 全网可见 · 同步到云端</h2>
              <span className="text-xs text-gray-400">后台课程目前只存在你的浏览器；同步后所有访客可见、可学</span>
            </div>
            <div className="mt-3 flex flex-col sm:flex-row items-center gap-2">
              <input
                type="password"
                className="input input-bordered input-sm flex-1"
                placeholder="管理员密钥（与投稿弹窗同一把密钥）"
                value={adminInput}
                onChange={e => setAdminInput(e.target.value)}
              />
              <div className="flex gap-2">
                <button className="btn btn-sm btn-outline" onClick={doAdminLogin} disabled={cloudBusy}>{adminKey ? '已登录 ✓' : '登录'}</button>
                <button className="btn btn-sm btn-primary" onClick={syncToCloud} disabled={cloudBusy || !adminKey}>
                  {cloudBusy ? '同步中…' : '🚀 同步到云端'}
                </button>
                {adminKey && <button className="btn btn-sm btn-ghost" onClick={() => { logout(); setAdminInput(''); setCloudMsg('已退出管理员') }}>退出</button>}
              </div>
            </div>
            {cloudMsg && <div className="mt-3 text-sm text-gray-600">{cloudMsg}</div>}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              <span className="text-xs text-gray-500">课程数据迁移（换浏览器/正式站时使用）：</span>
              <button className="btn btn-xs btn-outline" onClick={exportCourses}>📤 导出课程数据</button>
              <label className="btn btn-xs btn-outline cursor-pointer">
                📥 导入课程数据
                <input type="file" accept=".json,application/json" className="hidden" onChange={e => { importCoursesFile(e.target.files && e.target.files[0]); e.target.value = '' }} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              <span className="text-xs text-gray-500 text-error">危险操作：</span>
              <button className="btn btn-xs btn-error btn-outline" onClick={clearStoreCourses} disabled={cloudBusy || !adminKey}>
                🗑️ 清空商城课程
              </button>
            </div>
            {cloudCount >= 0 && <div className="mt-2 text-xs text-gray-400">云端名单共 {cloudCount} 项（视频 + 课程）</div>}
            <div className="mt-3 text-xs text-gray-400">
              提示：只有「已发布」状态的课程会同步；草稿不会上云。同步前请确保密钥与后端 ADMIN_KEY 一致。
            </div>
          </div>
        </div>

        {/* ===== ② 已有课程列表 ===== */}
        <div className="card mt-6 border border-gray-200 bg-base-100 shadow-sm" style={{ borderRadius: 16 }}>
          <div className="card-body p-6">
            <h2 className="card-title text-base text-gray-900">已有课程（{courses.length}）</h2>
            {courses.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">还没有课程，先填上面表单保存一个草稿试试。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-zebra table-sm">
                  <thead>
                    <tr className="text-xs text-gray-400">
                      <th>状态</th><th>封面</th><th>标题</th><th>分类</th><th>课时</th><th>大纲</th><th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map(c => (
                      <tr key={c.id}>
                        <td>
                          {c.status === 'published' || !c.status
                            ? <span className="badge badge-success badge-sm">已发布</span>
                            : <span className="badge badge-warning badge-sm">草稿</span>}
                          {c.cloudSynced && <span className="badge badge-info badge-sm ml-1">云端</span>}
                        </td>
                        <td>
                          <img src={c.cover} alt="" className="h-10 w-16 rounded object-cover"
                            onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                        </td>
                        <td className="font-medium text-gray-800">
                          <div className="line-clamp-1">{c.title}</div>
                          <div className="text-[11px] text-gray-400">{c.subtitle || '—'}</div>
                        </td>
                        <td className="text-xs">{c.category}</td>
                        <td className="text-xs">{Array.isArray(c.units) && c.units.length ? c.units.length + ' 课' : (c.lessons || 0) + ' 课'}</td>
                        <td className="text-xs">
                          {Array.isArray(c.units) && c.units.length
                            ? <span className="badge badge-success badge-sm">已搭大纲</span>
                            : <span className="badge badge-ghost badge-sm">未搭</span>}
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn btn-primary btn-xs" onClick={() => manageUnits(c)}>搭课程序</button>
                            <button className="btn btn-ghost btn-xs" onClick={() => edit(c)}>编辑</button>
                            <button className="btn btn-error btn-xs btn-outline" onClick={() => remove(c.id)}>删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
