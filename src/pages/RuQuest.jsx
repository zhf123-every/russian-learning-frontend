import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLevelVideos, LEVELS } from '../data/courseLibrary'
import { callAI } from '../lib/ai'
import { API_BASE } from '../lib/api'
import { toast } from '../lib/toast'

// ================= 工具 =================
const stripStress = s => (s || '').replace(/[\u0300-\u036f]/g, '')
const shuffle = arr => {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const norm = w => stripStress(w || '').toLowerCase().trim()
const cleanWord = w => (w || '').replace(/[.,!?…;:—"«»()]/g, '')
const fmtTime = s => {
  const m = Math.floor(s / 60), ss = s % 60
  return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss
}

const RATINGS = [
  { min: 0.95, label: 'SSS', color: '#FFD75E' },
  { min: 0.88, label: 'SS', color: '#FFB347' },
  { min: 0.8, label: 'S', color: '#FF8A5C' },
  { min: 0.68, label: 'A', color: '#7ED6A5' },
  { min: 0.5, label: 'B', color: '#6FB7FF' },
  { min: 0, label: 'C', color: '#B7A8E8' },
]
const ratingOf = acc => {
  const r = acc.correct / Math.max(1, acc.answered)
  return RATINGS.find(x => r >= x.min) || RATINGS[RATINGS.length - 1]
}

// 环形图（SVG）
const Ring = ({ pct, label, color = '#FFD75E' }) => {
  const R = 26, C = 2 * Math.PI * R
  const v = Math.max(0, Math.min(100, pct))
  return (
    <svg width="68" height="68" viewBox="0 0 68 68">
      <circle cx="34" cy="34" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" />
      <circle
        cx="34" cy="34" r={R} fill="none" stroke={color} strokeWidth="6"
        strokeLinecap="round" strokeDasharray={`${(v / 100) * C} ${C}`}
        transform="rotate(-90 34 34)" style={{ transition: 'stroke-dasharray .6s' }}
      />
      <text x="34" y="37" textAnchor="middle" dominantBaseline="middle" fill="#F5EDE2" fontSize="13" fontWeight="700">
        {Math.round(v)}%
      </text>
      <text x="34" y="63" textAnchor="middle" fill="#A99C8B" fontSize="9">{label}</text>
    </svg>
  )
}

// 页面全局样式（深色游戏风 · 复刻句乐部）
const GLOBAL_CSS = `
.quest-root{min-height:100vh;background:radial-gradient(1200px 600px at 20% -10%,rgba(255,215,94,.07),transparent 60%),linear-gradient(165deg,#100E0C 0%,#191510 55%,#221B14 100%);color:#F5EDE2;font-family:'Segoe UI',system-ui,-apple-system,sans-serif}
.quest-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#F5EDE2;border-radius:999px;padding:9px 20px;cursor:pointer;font-size:14px;transition:.15s}
.quest-btn:hover{border-color:#FFD75E;color:#FFD75E}
.quest-btn.primary{background:linear-gradient(135deg,#FFD75E,#F0B83C);color:#17130E;font-weight:700;border:none}
.quest-btn.primary:hover{filter:brightness(1.08);color:#17130E}
.quest-btn.gold{background:rgba(255,215,94,.14);border-color:rgba(255,215,94,.4);color:#FFD75E}
.kbd{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:5px;padding:2px 7px;font-size:11px;color:#C9BCAB;font-family:ui-monospace,monospace}
`

// ================= 主组件 =================
export default function RuQuest() {
  const navigate = useNavigate()
  // 阶段：landing 落地页 / review 今日推荐 / play 答题 / result 结算
  const [phase, setPhase] = useState('landing')
  const [level, setLevel] = useState('A1')
  const [mode, setMode] = useState('cn2ru') // cn2ru 中译英 / listen 听写 / speak 口语
  const [count, setCount] = useState(10)
  const [round, setRound] = useState([])
  const [qi, setQi] = useState(0)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [perfect, setPerfect] = useState(0)
  const [good, setGood] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [startAt, setStartAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [acc, setAcc] = useState({ answered: 0, correct: 0, firstHit: 0, listens: 0, usedMs: 0 })
  // 单题
  const [words, setWords] = useState([])
  const [shuffled, setShuffled] = useState([])
  const [picked, setPicked] = useState([])
  const [done, setDone] = useState(false)
  const [okSeq, setOkSeq] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analysing, setAnalysing] = useState(false)
  const [grammarTip, setGrammarTip] = useState(null)
  // AI 助手侧栏
  const [aiOpen, setAiOpen] = useState(false)
  const [aiQ, setAiQ] = useState('')
  const [aiThread, setAiThread] = useState([])
  const [aiBusy, setAiBusy] = useState(false)
  // 复习收藏
  const [mastered, setMastered] = useState(() => JSON.parse(localStorage.getItem('rlearn_quest_mastered') || '[]'))
  const [vocabNote, setVocabNote] = useState(() => JSON.parse(localStorage.getItem('rlearn_quest_vocab') || '[]'))
  const [todayQuote, setTodayQuote] = useState(null)

  const audioRef = useRef(null)
  const inputRef = useRef(null)
  const analysisCache = useRef({})
  const gramTipCache = useRef({})
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const cur = round[qi] || null

  // 题库
  const poolOf = useCallback((lv) => {
    const sents = []
    for (const { video } of getLevelVideos(lv)) {
      for (const s of video.sentences || []) {
        if (s.russian && s.russian.trim()) sents.push({ ...s, source: video.title })
      }
    }
    return sents
  }, [])

  // 开始一轮
  const startRound = (lv, m, n) => {
    const pool = shuffle(poolOf(lv))
    setRound(pool.slice(0, n))
    setQi(0); setScore(0); setCombo(0); setMaxCombo(0); setPerfect(0); setGood(0); setSkipped(0)
    setAcc({ answered: 0, correct: 0, firstHit: 0, listens: 0, usedMs: 0 })
    setElapsed(0); setStartAt(Date.now()); setAnalysis(null); setGrammarTip(null); setAiThread([])
    setTodayQuote(pool[Math.floor(Math.random() * pool.length)])
    setPhase('play')
  }

  const loadQuestion = useCallback((idx) => {
    const s = round[idx]
    if (!s) return
    const ws = s.russian.trim().split(/\s+/).filter(Boolean)
    setWords(ws)
    setShuffled(shuffle(ws))
    setPicked([]); setDone(false); setOkSeq(false)
    setAnalysis(analysisCache.current[s.id] || null)
    setGrammarTip(gramTipCache.current[s.id] || null)
    setAnalysing(false)
  }, [round])

  useEffect(() => {
    if (phase === 'play' && round.length) loadQuestion(qi)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, phase])

  useEffect(() => {
    if (phase !== 'play') return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startAt) / 1000)), 1000)
    return () => clearInterval(t)
  }, [phase, startAt])

  // 发音
  const playSound = useCallback((text) => {
    if (!text) return
    if (!audioRef.current) audioRef.current = new Audio()
    const a = audioRef.current
    a.pause()
    a.src = (API_BASE || '') + '/api/tts?text=' + encodeURIComponent(text) + '&_=' + Date.now()
    a.play().catch(() => toast('发音播放失败，请检查后端服务'))
    setAcc(p => ({ ...p, listens: p.listens + 1 }))
  }, [])

  // AI 逐词拆解
  const fetchAnalysis = useCallback(async (s) => {
    if (!s) return
    if (analysisCache.current[s.id]) { setAnalysis(analysisCache.current[s.id]); return }
    setAnalysing(true)
    try {
      const content = await callAI([
        { role: 'system', content: '你是俄语老师。把用户给的俄语句子逐词拆解，严格只输出 JSON，不要任何解释。JSON 格式：{"words":[{"word":"原词","stress":"带重音的规范词形(重音元音后用\'\u0301\'标,如 moma)","pos":"词性(中文)","zh":"中文释义"}],"zh":"整句中文翻译"}' },
        { role: 'user', content: s.russian },
      ])
      let t = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
      const a = t.indexOf('{'), b = t.lastIndexOf('}')
      if (a >= 0 && b > a) t = t.slice(a, b + 1)
      const parsed = JSON.parse(t)
      if (parsed && parsed.words) {
        analysisCache.current[s.id] = parsed
        setAnalysis(parsed)
      } else throw new Error('bad')
    } catch (e) {
      setAnalysis({ words: null, zh: s.chinese || '', err: true })
    } finally {
      if (mounted.current) setAnalysing(false)
    }
  }, [])

  // AI 语法讲解
  const fetchGrammarTip = useCallback(async (s) => {
    if (!s) return
    if (gramTipCache.current[s.id]) { setGrammarTip(gramTipCache.current[s.id]); return }
    try {
      const content = await callAI([
        { role: 'system', content: '你是俄语老师。用 2-3 句话用中文讲解这个俄语句子的关键语法点（时态、变格、句型等），简洁实用。' },
        { role: 'user', content: s.russian },
      ])
      gramTipCache.current[s.id] = content
      if (mounted.current) setGrammarTip(content)
    } catch (e) { /* 静默 */ }
  }, [])

  // 提交单词（点击词块 / 键盘回车）
  const pick = useCallback((w) => {
    if (done) return
    setPicked(prev => {
      const next = [...prev, w]
      if (next.length === words.length) {
        const ok = words.every((ow, i) => norm(cleanWord(next[i])) === norm(cleanWord(ow)))
        const isFirst = prev.length === 0
        setDone(true); setOkSeq(ok)
        if (ok) {
          setCombo(c => { const nc = c + 1; setMaxCombo(m => Math.max(m, nc)); return nc })
          setScore(s => s + 100 + Math.min(500, combo * 50))
          setPerfect(p => p + 1)
          setAcc(a => ({ ...a, answered: a.answered + 1, correct: a.correct + 1, firstHit: a.firstHit + (isFirst ? 1 : 0), usedMs: a.usedMs + 900 }))
          playSound(cur.russian)
          fetchAnalysis(cur)
          fetchGrammarTip(cur)
        } else {
          setCombo(0)
          setGood(g => g + 1)
          setAcc(a => ({ ...a, answered: a.answered + 1, usedMs: a.usedMs + 1800 }))
          toast('顺序不对，看下方正确顺序')
          // 展示正确顺序后题目算错
          return next
        }
      }
      return next
    })
  }, [done, words, combo, cur, playSound, fetchAnalysis, fetchGrammarTip])

  const undo = () => { if (!done) setPicked(p => p.slice(0, -1)) }

  const skip = () => {
    if (done) return
    setDone(true); setOkSeq(false)
    setSkipped(s => s + 1); setCombo(0)
    setAcc(a => ({ ...a, answered: a.answered + 1 }))
    fetchAnalysis(cur)
  }

  const next = () => {
    if (qi + 1 >= round.length) { setPhase('result'); return }
    setQi(q => q + 1)
  }

  const replay = () => loadQuestion(qi)

  const toggleMastered = () => {
    if (!cur) return
    const id = cur.id + '_' + qi
    const nm = mastered.includes(id) ? mastered.filter(x => x !== id) : [...mastered, id]
    setMastered(nm); localStorage.setItem('rlearn_quest_mastered', JSON.stringify(nm))
    toast(mastered.includes(id) ? '已取消掌握' : '已标记掌握')
  }
  const addVocab = () => {
    if (!cur) return
    const id = cur.id + '_' + qi
    const nv = vocabNote.includes(id) ? vocabNote.filter(x => x !== id) : [...vocabNote, id]
    setVocabNote(nv); localStorage.setItem('rlearn_quest_vocab', JSON.stringify(nv))
    toast(vocabNote.includes(id) ? '已从生词移除' : '已加入生词')
  }

  // 快捷键
  useEffect(() => {
    const onKey = (e) => {
      if (phase !== 'play') return
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); playSound(cur?.russian); return }
      if (e.ctrlKey && e.key === ';') { e.preventDefault(); replay(); return }
      if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); toggleMastered(); return }
      if (e.ctrlKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); addVocab(); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cur, done])

  // AI 助手提问
  const askAI = async () => {
    const q = aiQ.trim()
    if (!q || aiBusy) return
    setAiBusy(true)
    const thread = [...aiThread, { role: 'user', text: q }]
    setAiThread(thread); setAiQ('')
    try {
      const content = await callAI([
        { role: 'system', content: '你是俄语老师，回答要简洁、准确，用中文讲解，可以给出例句。' },
        ...thread.map(t => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text })),
      ])
      setAiThread([...thread, { role: 'assistant', text: content }])
    } catch (e) {
      setAiThread([...thread, { role: 'assistant', text: '（AI 助手暂时无法回答，请稍后再试）' }])
    } finally {
      setAiBusy(false)
    }
  }

  const result = useMemo(() => {
    const correct = acc.correct
    const firstRate = acc.answered ? Math.round((acc.firstHit / acc.answered) * 100) : 0
    const correctRate = acc.answered ? Math.round((correct / acc.answered) * 100) : 0
    const avgSec = acc.answered ? +(acc.usedMs / acc.answered / 1000).toFixed(1) : 0
    const rating = ratingOf({ correct, answered: Math.max(1, acc.answered) })
    return { firstRate, correctRate, avgSec, rating }
  }, [acc])

  // ============ 渲染 ============
  return (
    <div className="quest-root">
      <style>{GLOBAL_CSS}</style>

      {/* —— 落地页 —— */}
      {phase === 'landing' && (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 18px 60px' }}>
          <style>{`
            .lp-hero{text-align:center;padding:34px 0 26px}
            .lp-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,215,94,.1);border:1px solid rgba(255,215,94,.35);color:#FFD75E;font-size:13px;padding:6px 16px;border-radius:999px}
            .lp-badge .dot{width:6px;height:6px;border-radius:50%;background:#FFD75E;animation:lpPulse 1.6s infinite}
            @keyframes lpPulse{0%,100%{opacity:1}50%{opacity:.3}}
            .lp-hero h1{font-size:clamp(32px,6vw,52px);margin:20px 0 8px;font-weight:900;letter-spacing:-1px}
            .lp-hero h1 em{font-style:normal;color:#FFD75E}
            .lp-hero .sub{color:#B9AC9B;font-size:15px;margin:0 0 20px}
            .lp-hero .cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
            .lp-hero .cta button{font-size:16px;padding:12px 30px;border-radius:999px;cursor:pointer;transition:.18s}
            .lp-hero .cta .btn-play{background:linear-gradient(135deg,#FFD75E,#F0B83C);color:#17130E;font-weight:800;border:none;box-shadow:0 8px 26px rgba(255,215,94,.25)}
            .lp-hero .cta .btn-play:hover{transform:translateY(-2px)}
            .lp-hero .cta .btn-free{background:transparent;border:1px solid rgba(255,255,255,.22);color:#F5EDE2}
            .lp-hero .cta .btn-free:hover{border-color:#FFD75E}
            .lp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:34px 0 10px}
            .lp-stat{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px 10px;text-align:center}
            .lp-stat b{display:block;font-size:24px;color:#FFD75E;font-weight:800}
            .lp-stat span{font-size:12px;color:#A99C8B}
            .lp-title{font-size:22px;font-weight:800;text-align:center;margin:44px 0 4px}
            .lp-title small{display:block;font-size:13px;color:#A99C8B;font-weight:400;margin-top:4px}
            .lp-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:22px}
            .lp-card{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:20px 18px;transition:.18s}
            .lp-card:hover{transform:translateY(-3px);border-color:rgba(255,215,94,.4)}
            .lp-card .ic{font-size:26px}
            .lp-card h3{font-size:16px;margin:10px 0 6px;color:#FFD75E}
            .lp-card p{font-size:13px;color:#B9AC9B;line-height:1.7;margin:0}
            .lp-faq{margin-top:22px}
            .lp-faq details{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px 18px;margin-bottom:8px}
            .lp-faq summary{cursor:pointer;font-size:14px;font-weight:600;color:#F5EDE2}
            .lp-faq details p{font-size:13px;color:#B9AC9B;line-height:1.8;margin:10px 0 0}
            .lp-foot{text-align:center;margin-top:40px}
          `}</style>
          <div className="lp-hero">
            <span className="lp-badge"><span className="dot" />像玩游戏一样，用句子学俄语</span>
            <h1>Русский <em>Квест</em></h1>
            <p className="sub">谨慎体验 · 小心上瘾</p>
            <div className="cta">
              <button className="btn-play" onClick={() => { setLevel('A1'); setPhase('review') }}>先玩一把</button>
              <button className="btn-free" onClick={() => navigate('/')}>免费体验</button>
            </div>
          </div>

          <div className="lp-stats">
            <div className="lp-stat"><b>1000+</b><span>俄语学习句子</span></div>
            <div className="lp-stat"><b>4</b><span>难度等级 A1-B2</span></div>
            <div className="lp-stat"><b>∞</b><span>练习次数</span></div>
            <div className="lp-stat"><b>10′</b><span>每局约 10 分钟</span></div>
          </div>

          <div className="lp-title">为什么选 Русский Квест<small>像玩游戏一样，把俄语练出来</small></div>
          <div className="lp-cards">
            <div className="lp-card">
              <div className="ic">🎮</div>
              <h3>连对越多，越想继续</h3>
              <p>把练习变成连击游戏——节奏感、即时反馈、Perfect 评分，你的好胜心会驱动你一遍又一遍地练下去。每一遍都是有效训练，但你只会觉得"再来一局"。</p>
            </div>
            <div className="lp-card">
              <div className="ic">🧠</div>
              <h3>忘了的词，它比你先想起来</h3>
              <p>练完了什么时候该复习？系统按艾宾浩斯遗忘曲线自动算好每个知识点的最佳复习时间——你不用管，到时候它会来找你。</p>
            </div>
            <div className="lp-card">
              <div className="ic">🧑‍🏫</div>
              <h3>随时有一个俄语老师</h3>
              <p>为什么这里用变格不用变位？与其硬猜或跳过，不如直接问 AI 俄语老师。带着真实问题去学，比被动听课高效得多。</p>
            </div>
          </div>

          <div className="lp-title">常见问题</div>
          <div className="lp-faq">
            <details open>
              <summary>和背单词 App 有什么不同？</summary>
              <p>背单词解决的是"认识"，Русский Квест 解决的是"会用"。你可能认识 яблоко 这个词，但你能脱口而出 "Я люблю яблоки" 吗？从句子出发，把单词放回真实语境里练，学的是真正能用出来的表达。</p>
            </details>
            <details>
              <summary>适合什么俄语水平？</summary>
              <p>零基础到中高级都可以——A1 从单词连句练起，B2 直接挑战整句。不管你现在什么水平，都能找到适合自己的节奏。</p>
            </details>
            <details>
              <summary>为什么用键盘打字？</summary>
              <p>核心玩法是用键盘打字造句——在电脑前专注练习，手感更爽，效率也更高。需要沉浸式的学习方式，PC 端体验远好于手机。</p>
            </details>
          </div>

          <div className="lp-foot">
            <button className="quest-btn primary" style={{ fontSize: 16, padding: '13px 34px' }} onClick={() => { setLevel('A1'); setPhase('review') }}>立马玩起来</button>
          </div>
        </div>
      )}

      {/* —— 复习本 · 今日推荐 —— */}
      {phase === 'review' && (
        <div style={{ maxWidth: 620, margin: '0 auto', padding: '48px 16px 60px' }}>
          <style>{`
            .rv-head{display:flex;align-items:center;gap:10px;font-size:13px;color:#A99C8B;margin-bottom:26px}
            .rv-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:26px 24px;position:relative}
            .rv-close{position:absolute;top:14px;right:18px;background:transparent;border:none;color:#8C7F6E;font-size:20px;cursor:pointer}
            .rv-card h2{font-size:22px;margin:0 0 18px}
            .rv-card h2 small{font-size:12px;color:#A99C8B;font-weight:400;margin-left:8px}
            .rv-modes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
            .rv-mode{border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px 8px;text-align:center;cursor:pointer;transition:.15s;background:transparent;color:#F5EDE2}
            .rv-mode:hover{border-color:rgba(255,215,94,.5)}
            .rv-mode.on{background:rgba(255,215,94,.12);border-color:#FFD75E;color:#FFD75E}
            .rv-mode b{display:block;font-size:15px;margin-bottom:4px}
            .rv-mode span{font-size:11px;color:#A99C8B}
            .rv-levels{display:flex;gap:8px;margin:18px 0 4px;flex-wrap:wrap}
            .rv-lv{border:1px solid rgba(255,255,255,.14);background:transparent;color:#C9BCAB;border-radius:999px;padding:6px 16px;font-size:13px;cursor:pointer}
            .rv-lv.on{background:#FFD75E;color:#17130E;border-color:#FFD75E;font-weight:700}
            .rv-count{display:flex;align-items:center;gap:12px;margin:18px 0 6px;color:#C9BCAB;font-size:13px}
            .rv-count .stepper{display:flex;align-items:center;gap:10px;margin-left:auto}
            .rv-count .stepper button{width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#F5EDE2;font-size:16px;cursor:pointer}
            .rv-count .stepper b{font-size:16px;color:#FFD75E;min-width:22px;text-align:center}
            .rv-note{font-size:12px;color:#8C7F6E;line-height:1.7;margin:10px 0 20px;border-top:1px dashed rgba(255,255,255,.1);padding-top:12px}
            .rv-start{width:100%;padding:13px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;border:none;background:linear-gradient(135deg,#FFD75E,#F0B83C);color:#17130E}
          `}</style>
          <div className="rv-head">
            <button className="quest-btn" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setPhase('landing')}>← 返回</button>
            <span>今日推荐 · 系统为你挑选</span>
          </div>
          <div className="rv-card">
            <button className="rv-close" onClick={() => navigate('/')}>×</button>
            <h2>今日推荐<small>基于艾宾浩斯遗忘曲线</small></h2>
            <div className="rv-modes">
              <button className={'rv-mode' + (mode === 'cn2ru' ? ' on' : '')} onClick={() => setMode('cn2ru')}>
                <b>中译英</b><span>看中文拼俄语</span>
              </button>
              <button className={'rv-mode' + (mode === 'listen' ? ' on' : '')} onClick={() => setMode('listen')}>
                <b>听写</b><span>盲听拼句子</span>
              </button>
              <button className={'rv-mode' + (mode === 'speak' ? ' on' : '')} onClick={() => setMode('speak')}>
                <b>口语</b><span>跟读练习</span>
              </button>
            </div>
            <div className="rv-levels">
              {LEVELS.map(lv => (
                <button key={lv} className={'rv-lv' + (level === lv ? ' on' : '')} onClick={() => setLevel(lv)}>{lv}</button>
              ))}
            </div>
            <div className="rv-count">
              <span>练习数量</span>
              <div className="stepper">
                <button onClick={() => setCount(c => Math.max(5, c - 5))}>−</button>
                <b>{count} 题</b>
                <button onClick={() => setCount(c => Math.min(20, c + 5))}>+</button>
                <button className="quest-btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setCount(10)}>全部</button>
              </div>
            </div>
            <div className="rv-note">
              基于艾宾浩斯遗忘曲线，系统会智能安排复习时间，让你用更少的时间，记住更多内容。掌握的词会自动进入你的复习本。
            </div>
            <button className="rv-start" onClick={() => startRound(level, mode, count)}>开始复习</button>
          </div>
        </div>
      )}

      {/* —— 答题 —— */}
      {phase === 'play' && cur && (
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '16px 16px 48px' }}>
          <style>{`
            .pg-top{display:flex;align-items:center;gap:10px;font-size:13px;color:#A99C8B;padding:2px 0 8px}
            .pg-top .lv{background:rgba(255,215,94,.12);border:1px solid rgba(255,215,94,.3);color:#FFD75E;padding:3px 10px;border-radius:999px;font-weight:700}
            .pg-top .prog{flex:1;text-align:center}
            .pg-top .bar{height:5px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden;margin-top:4px}
            .pg-top .bar i{display:block;height:100%;background:linear-gradient(90deg,#FFD75E,#F0B83C);transition:width .3s}
            .pg-top .score{color:#FFD75E;font-weight:800;font-size:18px}
            .pg-top .time{font-variant-numeric:tabular-nums}
            .pg-combo{text-align:center;font-size:32px;font-weight:900;color:#FFD75E;min-height:48px;margin:6px 0 0;text-shadow:0 0 20px rgba(255,215,94,.45)}
            .pg-modehint{text-align:center;font-size:12px;color:#8C7F6E;margin:2px 0 4px}
            .pg-zh{text-align:center;font-size:clamp(19px,3.4vw,26px);color:#F5EDE2;font-weight:700;margin:4px 0 4px}
            .pg-stage{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:18px;padding:22px 18px;min-height:140px;margin-top:10px}
            .pg-picked{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;min-height:46px;align-items:center;margin-bottom:12px}
            .pg-picked.empty::after{content:'按正确顺序点下面的单词，或键盘输入后回车';color:#6E6355;font-size:13px}
            .pg-word{border-radius:10px;padding:7px 14px;font-size:18px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:#F5EDE2;cursor:pointer;transition:.15s;user-select:none}
            .pg-word:hover{border-color:#FFD75E}
            .pg-word.picked{background:rgba(255,215,94,.15);border-color:#FFD75E;color:#FFD75E}
            .pg-word.correct{border-color:#4ADE80;color:#4ADE80}
            .pg-word.wrong{border-color:#E5484D;color:#FF6B6B;text-decoration:line-through}
            .pg-inputrow{display:flex;gap:8px;justify-content:center;margin-top:6px}
            .pg-inputrow input{background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);color:#F5EDE2;border-radius:10px;padding:9px 14px;font-size:17px;outline:none;width:min(320px,62%)}
            .pg-inputrow input:focus{border-color:#FFD75E}
            .pg-inputrow button{background:rgba(255,215,94,.14);border:1px solid rgba(255,215,94,.4);color:#FFD75E;border-radius:10px;padding:9px 16px;font-size:14px;cursor:pointer}
            .pg-done{text-align:center;font-size:16px;font-weight:700;margin:8px 0 0}
            .pg-done.ok{color:#4ADE80}
            .pg-done.bad{color:#FF8A5C}
            .pg-analysis{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.07);border-radius:14px;margin-top:12px;padding:14px 16px}
            .pg-analysis h4{font-size:12px;color:#8C7F6E;margin:0 0 10px;font-weight:600}
            .pg-awords{display:flex;flex-wrap:wrap;gap:16px;justify-content:center}
            .pg-aword{text-align:center;min-width:52px}
            .pg-aword .w{font-size:18px;color:#F5EDE2;font-weight:600}
            .pg-aword .ph{font-size:11px;color:#FFD75E;margin-top:1px}
            .pg-aword .pos{font-size:11px;color:#7ED6A5;margin-top:2px}
            .pg-aword .zh{font-size:12px;color:#B9AC9B;margin-top:2px}
            .pg-azh{text-align:center;color:#F5EDE2;font-size:15px;margin-top:12px;padding-top:10px;border-top:1px dashed rgba(255,255,255,.1)}
            .pg-gram{background:linear-gradient(135deg,rgba(126,214,165,.08),transparent);border:1px solid rgba(126,214,165,.2);border-radius:12px;margin-top:10px;padding:12px 14px;font-size:13px;color:#C9EAD9;line-height:1.7}
            .pg-gram b{color:#7ED6A5}
            .pg-hints{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px}
            .pg-actions{display:flex;gap:10px;justify-content:center;margin-top:12px;flex-wrap:wrap}
            .pg-ai-side{position:fixed;right:0;top:0;bottom:0;width:min(360px,92vw);background:#171310;border-left:1px solid rgba(255,255,255,.1);z-index:99;display:flex;flex-direction:column;box-shadow:-10px 0 40px rgba(0,0,0,.4)}
            .pg-ai-side h3{padding:14px 16px;margin:0;font-size:15px;color:#FFD75E;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center}
            .pg-ai-msgs{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
            .pg-ai-bubble{max-width:85%;padding:9px 12px;border-radius:14px;font-size:13px;line-height:1.7;white-space:pre-wrap}
            .pg-ai-bubble.user{background:rgba(255,215,94,.15);color:#FFD75E;align-self:flex-end;border-bottom-right-radius:4px}
            .pg-ai-bubble.ai{background:rgba(255,255,255,.07);color:#E8DFD2;align-self:flex-start;border-bottom-left-radius:4px}
            .pg-ai-in{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.08)}
            .pg-ai-in input{flex:1;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.14);color:#F5EDE2;border-radius:10px;padding:9px 12px;font-size:13px;outline:none}
            .pg-ai-in button{background:#FFD75E;color:#17130E;border:none;border-radius:10px;padding:9px 14px;font-weight:700;cursor:pointer}
          `}</style>

          <div className="pg-top">
            <span className="lv">{level}</span>
            <span>{mode === 'cn2ru' ? '中译英' : mode === 'listen' ? '听写' : '口语'} · 第 {qi + 1} 题 ({qi + (done ? 1 : 0)}/{round.length})</span>
            <div className="prog"><div className="bar"><i style={{ width: Math.round(((qi + (done ? 1 : 0)) / round.length) * 100) + '%' }} /></div></div>
            <span className="score">{score.toLocaleString()}</span>
            <span className="time">{fmtTime(elapsed)}</span>
          </div>

          {combo >= 2 && <div className="pg-combo">Perfect × {combo}</div>}
          <div className="pg-modehint">{mode === 'cn2ru' ? '用键盘输入俄语，按回车键确认' : mode === 'listen' ? '先听发音，再打出你听到的句子' : '听发音跟读，掌握语感'}</div>
          <div className="pg-zh">{mode === 'listen' && !done ? '（先听发音，再写句子）' : (cur.chinese || '')}</div>

          <div className="pg-stage">
            <div className={'pg-picked' + (picked.length === 0 ? ' empty' : '')}>
              {picked.map((w, i) => (
                <span key={i} className={'pg-word picked' + (done ? (okSeq ? ' correct' : (norm(cleanWord(w)) === norm(cleanWord(words[i])) ? ' correct' : ' wrong')) : '')} onClick={undo}>{stripStress(w)}</span>
              ))}
            </div>

            {!done ? (
              <>
                <div className="pg-inputrow">
                  <input
                    ref={inputRef} placeholder="输入单词后回车（或点击下方词块）" autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = e.target.value.trim()
                        if (!v) return
                        const hit = shuffled.find(w => norm(cleanWord(w)) === norm(v))
                        if (hit) { pick(hit); e.target.value = '' }
                        else toast('没找到这个词，试试下方词块')
                      }
                    }}
                  />
                  <button onClick={() => inputRef.current?.focus()}>输入</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 }}>
                  {shuffled.map((w, i) => (
                    <span key={i} className="pg-word" onClick={() => pick(w)}>{stripStress(w)}</span>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className={'pg-done ' + (okSeq ? 'ok' : 'bad')}>
                  {okSeq ? '✓ Perfect！完全正确' : '✗ 正确答案：' + cur.russian}
                </div>
                {(analysis && analysis.words) ? (
                  <div className="pg-analysis">
                    <h4>单词拆解</h4>
                    <div className="pg-awords">
                      {analysis.words.map((aw, i) => (
                        <div key={i} className="pg-aword">
                          <div className="w">{stripStress(aw.word)}</div>
                          <div className="ph">{aw.stress || aw.word}</div>
                          <div className="pos">{aw.pos || ''}</div>
                          <div className="zh">{aw.zh || ''}</div>
                        </div>
                      ))}
                    </div>
                    <div className="pg-azh">{analysis.zh || cur.chinese}</div>
                  </div>
                ) : (analysing ? <div className="pg-done">AI 拆解生成中…</div> : (
                  <div className="pg-analysis">
                    <h4>单词拆解</h4>
                    <div className="pg-awords">
                      {words.map((w, i) => (
                        <div key={i} className="pg-aword"><div className="w">{stripStress(w)}</div></div>
                      ))}
                    </div>
                    <div className="pg-azh">{cur.chinese}</div>
                  </div>
                ))}
                {grammarTip && <div className="pg-gram"><b>语法点：</b>{grammarTip}</div>}
              </>
            )}
          </div>

          <div className="pg-actions">
            {!done ? (
              <>
                <button className="quest-btn gold" onClick={() => playSound(cur.russian)}>🔊 播放发音</button>
                <button className="quest-btn" onClick={undo}>撤销</button>
                <button className="quest-btn" onClick={skip}>跳过</button>
                <button className="quest-btn" onClick={() => { setAiOpen(true); setAiThread([{ role: 'assistant', text: '我是你的俄语 AI 老师，可以随时问我语法问题，比如：这里为什么用变格？' }]) }}>🧑‍🏫 AI 老师</button>
              </>
            ) : (
              <>
                <button className="quest-btn gold" onClick={() => playSound(cur.russian)}>🔊 再听一遍</button>
                <button className="quest-btn" onClick={toggleMastered}>{mastered.includes(cur.id + '_' + qi) ? '✓ 已掌握' : '掌握'}</button>
                <button className="quest-btn" onClick={addVocab}>{vocabNote.includes(cur.id + '_' + qi) ? '✓ 已加生词' : '生词'}</button>
                <button className="quest-btn primary" onClick={next}>{qi + 1 >= round.length ? '查看结算 →' : '下一题'}</button>
              </>
            )}
          </div>

          <div className="pg-hints">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8C7F6E' }}><kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">Enter</kbd>播放发音</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8C7F6E' }}><kbd className="kbd">Enter</kbd>下一题</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8C7F6E' }}><kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">;</kbd>再来一次</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8C7F6E' }}><kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">M</kbd>掌握</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8C7F6E' }}><kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">N</kbd>生词</span>
          </div>

          {aiOpen && (
            <div className="pg-ai-side">
              <h3>句乐部俄语智能助手 <button className="quest-btn" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => setAiOpen(false)}>收起</button></h3>
              <div className="pg-ai-msgs">
                {aiThread.map((t, i) => (
                  <div key={i} className={'pg-ai-bubble ' + t.role}>{t.text}</div>
                ))}
                {aiBusy && <div className="pg-ai-bubble ai">思考中…</div>}
              </div>
              <div className="pg-ai-in">
                <input value={aiQ} placeholder="问问语法：为什么用这个变格？" onChange={e => setAiQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAI()} />
                <button onClick={askAI}>发送</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* —— 结算 —— */}
      {phase === 'result' && (
        <div style={{ maxWidth: 620, margin: '0 auto', padding: '20px 16px 60px' }}>
          <style>{`
            .rs-top{display:flex;align-items:center;gap:8px;font-size:14px;color:#A99C8B;padding:6px 0 16px}
            .rs-hero{text-align:center;padding:6px 0 14px}
            .rs-grade{font-size:66px;font-weight:900;line-height:1;color:${result.rating.color};text-shadow:0 0 34px ${result.rating.color}55}
            .rs-score{font-size:34px;font-weight:800;margin-top:2px}
            .rs-perf{display:flex;gap:30px;justify-content:center;margin-top:12px;color:#C9BCAB;font-size:13px}
            .rs-perf b{display:block;font-size:22px;color:#FFD75E}
            .rs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}
            .rs-cell{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;text-align:center}
            .rs-cell b{display:block;font-size:18px}
            .rs-cell span{font-size:11px;color:#A99C8B}
            .rs-ana{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;margin:12px 0}
            .rs-ana h3{font-size:13px;color:#A99C8B;margin:0 0 12px;font-weight:600}
            .rs-rings{display:flex;gap:6px;justify-content:space-between;flex-wrap:wrap}
            .rs-quote{background:linear-gradient(135deg,rgba(255,215,94,.1),rgba(255,255,255,.03));border:1px solid rgba(255,215,94,.25);border-radius:14px;padding:14px 18px;margin:12px 0}
            .rs-quote .t{font-size:12px;color:#FFD75E;margin-bottom:6px}
            .rs-quote .ru{font-size:16px}
            .rs-quote .zh{font-size:13px;color:#A99C8B;margin-top:4px}
            .rs-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px}
          `}</style>
          <div className="rs-top">
            <button className="quest-btn" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => navigate('/')}>回到首页</button>
            <button className="quest-btn" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => navigate('/course')}>课程列表</button>
            <button className="quest-btn" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => navigate('/profile')}>学习分析</button>
          </div>
          <div className="rs-hero">
            <div className="rs-grade">{result.rating.label}</div>
            <div className="rs-score">{score.toLocaleString()}</div>
            <div className="rs-perf">
              <div><b>{perfect}</b>完美</div>
              <div><b>{good}</b>很好</div>
              <div><b>{skipped}</b>跳过</div>
            </div>
          </div>
          <div className="rs-grid">
            <div className="rs-cell"><b>{fmtTime(elapsed)}</b><span>练习时长</span></div>
            <div className="rs-cell"><b>{round.length}</b><span>答题数</span></div>
            <div className="rs-cell"><b>{maxCombo}</b><span>最大连击</span></div>
          </div>
          <div className="rs-ana">
            <h3>数据分析</h3>
            <div className="rs-rings">
              <Ring pct={result.firstRate} label="一次命中率" />
              <Ring pct={result.correctRate} label="正确率" color="#7ED6A5" />
              <Ring pct={0} label="查看答案" color="#FF8A5C" />
              <Ring pct={Math.min(100, acc.listens * 10)} label="重听次数" color="#6FB7FF" />
              <Ring pct={Math.min(100, result.avgSec * 20)} label="平均用时" color="#B7A8E8" />
            </div>
          </div>
          {todayQuote && (
            <div className="rs-quote">
              <div className="t">今日金句</div>
              <div className="ru">"{todayQuote.russian}"</div>
              <div className="zh">{todayQuote.chinese}</div>
            </div>
          )}
          <div className="rs-actions">
            <button className="quest-btn gold" onClick={() => {
              const txt = `我在「Русский Квест」拿到 ${result.rating.label} 评级 · ${score} 分！一次命中率 ${result.firstRate}%，最大连击 ${maxCombo}。来挑战我！`
              if (navigator.share) navigator.share({ text: txt }).catch(() => {})
              else { navigator.clipboard?.writeText(txt); toast('战绩已复制') }
            }}>炫耀战绩</button>
            <button className="quest-btn" onClick={() => { setQi(0); setPhase('play'); loadQuestion(0) }}>{'<'} 上一课</button>
            <button className="quest-btn primary" onClick={() => startRound(level, mode, count)}>再来一次</button>
            <button className="quest-btn" onClick={() => setPhase('review')}>下一课 {'>'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
