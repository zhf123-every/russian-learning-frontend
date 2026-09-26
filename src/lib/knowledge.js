// knowledge.js —— AI 生成「学习内容弹窗」逐句知识点（对标句乐部：中文翻译/俄语释义/逐词注解/语法分析/文化知识/相关例句）
// 1. 调后端 /api/ai（后端已配置大模型，走其 AI_API_KEY）
// 2. 严格 JSON schema + 容错解析（剥 markdown 包裹、截取首尾大括号）
// 3. localStorage 缓存（按课程ID，key: rlearn_knowledge_v1_<unitId>）

const KNOWLEDGE_PROMPT = `你是一位资深的中国俄语教育专家。请对用户给出的俄语句子做完整的「学习内容」解析，输出严格 JSON（不要 markdown 代码块，不要任何注释，不要多余文字）。

【硬性输出要求】
1. 输出为单行紧凑 JSON，字符串值内禁止出现换行；
2. 所有字符串值内禁止出现英文双引号"；如需引用词语，一律用中文引号「」或『』；
3. 不要输出任何注释或解释文字，只输出 JSON 本身。

输出 JSON 结构（字段名必须完全一致）：
{
  "ru_def": "俄语释义：用简洁俄语解释这句话的含义（1-2句）",
  "words": [
    {
      "word": "原形词或句中词形",
      "stress": "带重音符号的词形（重音元音后加\u0301，如 до́м；单音节词不加重音）",
      "chinese": "中文释义",
      "pos": "词性（名词/动词/形容词/代词/副词/前置词/连词/数词/语气词/感叹词）",
      "basic": "基本含义（1句）",
      "context": "上下文含义（这个词在句中的作用，1句）",
      "synonyms": ["同义词1", "同义词2"],
      "antonyms": ["反义词1"],
      "phrases": ["常用短语1 (中文翻译)", "常用短语2 (中文翻译)"],
      "example": "含该词的例句（俄语）",
      "memory": "记忆技巧（1句，结合词源/谐音/形象联想）"
    }
  ],
  "grammar": {
    "word_explains": [
      {"word": "句中词形", "translation": "该词中文", "explanation": "语法功能解释（如：名词第一格作主语）"}
    ],
    "pattern": "句型（如：主系表结构）",
    "tense": "时态语气（如：现在时，陈述语气）",
    "key": "重点语法（分条列出，用1. 2. 3.）",
    "mistakes": "常见错误（分条 + 避免方法）",
    "order": "词序（说明俄语词序特点及理由）",
    "rules": "语法规则应用（分条）"
  },
  "culture": {
    "elements": "文化元素（与这句话相关的俄罗斯文化背景，1-2句）",
    "usage": "实际应用（列出1) 2) 3) 常见使用场景）",
    "background": "背景信息（语言/语法来源背景，1-2句）"
  },
  "function": "功能和使用场景（一段说明：这句话在日常俄语中的典型用途）",
  "examples": [
    {"ru": "相关例句（俄语）", "zh": "中文翻译", "note": "讲解（1句）"},
    {"ru": "相关例句2（俄语）", "zh": "中文翻译", "note": "讲解（1句）"}
  ]
}`;

const LS_PREFIX = 'rlearn_knowledge_v1_';

// 从 AI 输出中容错提取 JSON
function extractJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  // 剥 markdown 代码块
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // 截取第一个 { 到最后一个 }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) {
    t = t.slice(start, end + 1);
  }
  const tries = [
    () => JSON.parse(t),
    () => JSON.parse(t.replace(/,\s*([}\]])/g, '$1')), // 去尾逗号
  ];
  for (const fn of tries) {
    try { return fn(); } catch (e) { /* 下一级 */ }
  }
  return null;
}

// 空值兜底
function def(v, d) {
  return (v === undefined || v === null || v === '') ? d : v;
}

function normalize(raw, ru) {
  const k = raw && typeof raw === 'object' ? raw : {};
  const words = Array.isArray(k.words) ? k.words.map((w) => ({
    word: def(w.word, ''),
    stress: def(w.stress, w.word || ''),
    chinese: def(w.chinese, ''),
    pos: def(w.pos, ''),
    basic: def(w.basic, ''),
    context: def(w.context, ''),
    synonyms: Array.isArray(w.synonyms) ? w.synonyms.filter(Boolean) : [],
    antonyms: Array.isArray(w.antonyms) ? w.antonyms.filter(Boolean) : [],
    phrases: Array.isArray(w.phrases) ? w.phrases.filter(Boolean) : [],
    example: def(w.example, ''),
    memory: def(w.memory, ''),
  })).filter((w) => w.word) : [];
  const g = k.grammar || {};
  const c = k.culture || {};
  return {
    ru_def: def(k.ru_def, ''),
    words,
    grammar: {
      word_explains: Array.isArray(g.word_explains) ? g.word_explains.map((x) => ({
        word: def(x.word, ''), translation: def(x.translation, ''), explanation: def(x.explanation, ''),
      })).filter((x) => x.word) : [],
      pattern: def(g.pattern, ''),
      tense: def(g.tense, ''),
      key: def(g.key, ''),
      mistakes: def(g.mistakes, ''),
      order: def(g.order, ''),
      rules: def(g.rules, ''),
    },
    culture: {
      elements: def(c.elements, ''),
      usage: def(c.usage, ''),
      background: def(c.background, ''),
    },
    function: def(k.function, ''),
    examples: Array.isArray(k.examples) ? k.examples.map((e) => ({
      ru: def(e.ru, ''), zh: def(e.zh, ''), note: def(e.note, ''),
    })).filter((e) => e.ru) : [],
    _ru: ru,
    _ts: Date.now(),
  };
}

// 调后端 /api/ai 生成（后端自动用其 AI_API_KEY）
async function callAI(messages) {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  if (!j || !j.ok) throw new Error((j && j.error) || 'AI 接口失败');
  return j.content || '';
}

// 按句生成知识点（失败自动重试 1 次）
export async function generateKnowledge(ru) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
    try {
      const content = await callAI([
        { role: 'system', content: KNOWLEDGE_PROMPT },
        { role: 'user', content: ru },
      ]);
      const raw = extractJson(content);
      if (raw) return normalize(raw, ru);
      lastErr = new Error('AI 输出无法解析为 JSON：RAW:' + String(content || '').slice(0, 120));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('AI 生成失败');
}

// 读取课程缓存
export function readKnowledgeCache(unitId) {
  try {
    const s = localStorage.getItem(LS_PREFIX + unitId);
    return s ? JSON.parse(s) : {};
  } catch (e) {
    return {};
  }
}

// 获取某句知识点（缓存命中直接返回；未命中生成并写缓存）
export async function getKnowledge(unitId, ru) {
  const cache = readKnowledgeCache(unitId);
  if (cache[ru] && cache[ru]._ru) return cache[ru];
  const k = await generateKnowledge(ru);
  try {
    const next = readKnowledgeCache(unitId);
    next[ru] = k;
    localStorage.setItem(LS_PREFIX + unitId, JSON.stringify(next));
  } catch (e) {
    // 存储失败不阻塞
  }
  return k;
}

// 预热：后台预生成整课知识点（可中断），用于缓存
export function prewarmKnowledge(unitId, sentences, onProgress) {
  const cache = readKnowledgeCache(unitId);
  const pending = (Array.isArray(sentences) ? sentences : []).filter((s) => s && s.ru && !cache[s.ru]);
  let i = 0;
  const timer = setInterval(async () => {
    if (i >= pending.length) { clearInterval(timer); return; }
    const s = pending[i];
    i += 1;
    try {
      const k = await generateKnowledge(s.ru);
      const next = readKnowledgeCache(unitId);
      next[s.ru] = k;
      localStorage.setItem(LS_PREFIX + unitId, JSON.stringify(next));
      if (onProgress) onProgress(i, pending.length);
    } catch (e) {
      // 单句失败跳过
    }
  }, 300);
  return () => clearInterval(timer);
}
