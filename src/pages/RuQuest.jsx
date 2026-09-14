import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLevelVideos, LEVELS } from '../data/courseLibrary'
import { callAI } from '../lib/ai'
import { API_BASE } from '../lib/api'
import { toast } from '../lib/toast'

// —— 工具 ——
const stripStress = s => (s || '').replace(/[\u0300-\u036f]/g, '')
const shuffle = arr => {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
// 与输入的词做归一化比较（去重音、忽略大小写）
const norm = w => stripStress(w || '').toLowerCase().trim()
// 俄语名词等去掉尾部标点，用于输入校验
const cleanWord = w => (w || '').replace(/[.,!?…;:—"«»()]/g, '')

const QUESTS_PER_ROUND = 10
const SCORE_PERFECT = 100 // 基础分

const RATINGS = [
  { min: 0.95, label: 'SSS', color: '#FFD75E' },
  { min: 0.88, label: 'SS', color: '#FFB347' },
  { min: 0.80, label: 'S', color: '#FF8A5C' },
  { min: 0.68, label: 'A', color: '#7ED6A5' },
  { min: 0.5, label: 'B', color: '#6FB7FF' },
  { min: 0, label: 'C', color: '#B7A8E8' },
]
const ratingOf = (acc) => {
  const r = acc.correct / Math.max(1, acc.answered)
  return RATINGS.find(x => r >= x.min) || RATINGS[RATINGS.length - 1]
}

const KEY_HINTS = [
  { k: 'Ctrl', v: '播放发音' },
  { k: 'Enter', v: '下一题' },
  { k: 'Ctrl ;', v: '再来一次' },
  { k: 'Ctrl M', v: '掌握' },
  { k: 'Ctrl N', v: '生词' },
]

export default function RuQuest() {
  const navigate = useNavigate()
  // 阶段：level 选难度 / play 游戏 / result 结算
  const [phase, setPhase] = useState('level')
  const [level, setLevel] = useState('A1')
  const [round, setRound] = useState([])        // 本题句子列表
  const [qi, setQi] = useState(0)               // 当前题索引
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [perfect, setPerfect] = useState(0)
  const [good, setGood] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [startAt, setStartAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [acc, setAcc] = useState({ answered: 0, correct: 0, firstHit: 0, listens: 0, usedMs: 0 })
  // 单题状态
  const [words, setWords] = useState([])        // 原句词（含重音）
  const [shuffled, setShuffled] = useState([])  // 打乱词块
  const [picked, setPicked] = useState([])      // 已选词（按序）
  const [done, setDone] = useState(false)       // 本题是否已过
  const [correctSeq, setCorrectSeq] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analysing, setAnalysing] = useState(false)
  // 复习收藏
  const [mastered, setMastered] = useState(() => JSON.parse(localStorage.getItem('rlearn_quest_mastered') || '[]'))
  const [vocabNote, setVocabNote] = useState(() => JSON.parse(localStorage.getItem('rlearn_quest_vocab') || '[]'))
  const [todayQuote, setTodayQuote] = useState(null)

  const audioRef = useRef(null)
  const inputRef = useRef(null)
  const analysisCache = useRef({})

  const cur = round[qi] || null
  const curZh = cur ? (cur.chinese || '') : ''

  // 组装一轮题目（随机 10 句）
  const startRound = (lv) => {
    const vids = getLevelVideos(lv)
    const sents = []
    for (const { video } of vids) {
      for (const s of video.sentences || []) {
        if (s.russian && s.russian.trim()) sents.push({ ...s, source: video.title })
      }
    }
    const pool = shuffle(sents)
    setRound(pool.slice(0, QUESTS_PER_ROUND))
    setQi(0)
    setScore(0)
    setCombo(0)
    setMaxCombo(0)
    setPerfect(0)
    setGood(0)
    setSkipped(0)
    setAcc({ answered: 0, correct: 0, firstHit: 0, listens: 0, usedMs: 0 })
    setElapsed(0)
    setStartAt(Date.now())
    setAnalysis(null)
    setTodayQuote(sents[Math.floor(Math.random() * sents.length)])
    setPhase('play')
  }

  // 进入下一题
  const loadQuestion = useCallback((idx) => {
    const s = round[idx]
    if (!s) return
    const ws = s.russian.trim().split(/\s+/).filter(Boolean)
    setWords(ws)
    setShuffled(shuffle(ws))
    setPicked([])
    setDone(false)
    setCorrectSeq(false)
    setAnalysis(analysisCache.current[s.id] || null)
    setAnalysing(false)
  }, [round])

  useEffect(() => {
    if (phase === 'play' && round.length) loadQuestion(qi)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, phase])

  // 计时
  useEffect(() => {
    if (phase !== 'play') return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startAt) / 1000)), 1000)
    return () => clearInterval(t)
  }, [phase, startAt])

  // 播放发音
  const playSound = useCallback((text) => {
    if (!text) return
    if (!audioRef.current) audioRef.current = new Audio()
    const a = audioRef.current
    a.pause()
    a.src = (API_BASE || '') + '/api/tts?text=' + encodeURIComponent(text) + '&_=' + Date.now()
    a.play().catch(() => toast('发音播放失败，请检查后端服务'))
    setAcc(p => ({ ...p, listens: p.listens + 1 }))
  }, [])

  // AI 拆解（逐词：词性 + 中文 + 整句翻译）
  const fetchAnalysis = useCallback(async (s) => {
    if (!s) return
    if (analysisCache.current[s.id]) { setAnalysis(analysisCache.current[s.id]); return }
    setAnalysing(true)
    try {
      const content = await callAI([
        { role: 'system', content: '你是俄语老师。把用户给的俄语句子逐词拆解，严格只输出 JSON，不要任何解释。JSON 格式：{"words":[{"word":"原词","stress":"带重音的规范词形(用\'\u0301\'标在重音元音上,如 moma)","pos":"词性(中文)","zh":"中文释义"}],"zh":"整句中文翻译"}' },
        { role: 'user', content: s.russian },
      ])
      let t = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
      const a = t.indexOf('{'), b = t.lastIndexOf('}')
      if (a >= 0 && b > a) t = t.slice(a, b + 1)
      const parsed = JSON.parse(t)
      if (parsed && parsed.words) {
        analysisCache.current[s.id] = parsed
        setAnalysis(parsed)
      } else {
        throw new Error('格式错误')
      }
    } catch (e) {
      setAnalysis({ words: null, zh: s.chinese || '', err: true })
    } finally {
      setAnalysing(false)
    }
  }, [])

  // 点击词块 / 键盘输入
  const pick = (w) => {
    if (done) return
    const next = [...picked, w]
    setPicked(next)
    const okSeq = words.every((ow, i) => norm(cleanWord(next[i])) === norm(cleanWord(ow)))
    if (next.length === words.length) {
      // 全部填完
      if (okSeq) {
        setDone(true)
        setCorrectSeq(true)
        const first = next.length > 0 && picked.length === 0
        setCombo(c => { const nc = c + 1; setMaxCombo(m => Math.max(m, nc)); return nc })
        const gained = SCORE_PERFECT + Math.min(500, combo * 50)
        setScore(s => s + gained)
        setPerfect(p => p + 1)
        setAcc(a => ({ ...a, answered: a.answered + 1, correct: a.correct + 1, firstHit: a.firstHit + (first ? 1 : 0), usedMs: a.usedMs + 800 }))
        playSound(cur.russian)
        fetchAnalysis(cur)
      } else {
        // 顺序错误：连击清零，标记错误，仍可继续点击改正（从末尾撤销）
        setCombo(0)
        setAcc(a => ({ ...a, answered: a.answered + 1, usedMs: a.usedMs + 1500 }))
        // 显示错误提示：把最后一个错误的词标红并移除
        toast('顺序不对，再试试')
        setPicked(next.slice(0, -1))
      }
    }
  }

  // 撤销最后一个
  const undo = () => setPicked(p => p.slice(0, -1))

  // 跳过本题
  const skip = () => {
    if (done) return
    setDone(true)
    setSkipped(s => s + 1)
    setCombo(0)
    setAcc(a => ({ ...a, answered: a.answered + 1 }))
    setCorrectSeq(false)
    fetchAnalysis(cur)
  }

  // 下一题
  const next = () => {
    if (qi + 1 >= round.length) {
      setPhase('result')
      return
    }
    setQi(q => q + 1)
  }

  // 再来一次（本题）
  const replay = () => { loadQuestion(qi) }

  // 掌握 / 生词
  const toggleMastered = () => {
    if (!cur) return
    const id = cur.id + '_' + qi
    const nm = mastered.includes(id) ? mastered.filter(x => x !== id) : [...mastered, id]
    setMastered(nm)
    localStorage.setItem('rlearn_quest_mastered', JSON.stringify(nm))
    toast(mastered.includes(id) ? '已取消掌握' : '已标记掌握')
  }
  const addVocab = () => {
    if (!cur) return
    const id = cur.id + '_' + qi
    const nv = vocabNote.includes(id) ? vocabNote.filter(x => x !== id) : [...vocabNote, id]
    setVocabNote(nv)
    localStorage.setItem('rlearn_quest_vocab', JSON.stringify(nv))
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
      if (e.key === 'Enter' && !e.ctrlKey) {
        e.preventDefault()
        if (done) next()
        else if (picked.length === words.length) {}
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cur, done, picked, round, qi])

  // —— 结算数据 ——
  const result = useMemo(() => {
    const total = round.length
    const correct = acc.correct
    const firstRate = correct ? Math.round((acc.firstHit / Math.max(1, acc.answered)) * 100) : 0
    const correctRate = correct ? Math.round((correct / Math.max(1, acc.answered)) * 100) : 0
    const avgMs = acc.answered ? Math.round(acc.usedMs / acc.answered) : 0
    const rating = ratingOf({ correct, answered: Math.max(1, acc.answered) })
    return { total, correct, firstRate, correctRate, avgMs, rating, listenCount: acc.listens }
  }, [acc, round])

  const fmtTime = (s) => {
    const m = Math.floor(s / 60), ss = s % 60
    return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss
  }

  // ================= 渲染 =================
  // —— 难度选择 ——
  if (phase === 'level') {
    return (
      <div className="quest-page">
        <style>{`
          .quest-page{min-height:100vh;background:linear-gradient(160deg,#12100E 0%,#1C1814 55%,#241E18 100%);color:#F5EDE2;font-family:'Segoe UI',system-ui,sans-serif;padding:24px 16px 48px}
          .quest-hero{text-align:center;padding:28px 0 8px}
          .quest-hero .q-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,215,94,.12);border:1px solid rgba(255,215,94,.35);color:#FFD75E;font-size:13px;padding:6px 14px;border-radius:999px;letter-spacing:.4px}
          .quest-hero .q-badge .dot{width:6px;height:6px;border-radius:50%;background:#FFD75E;animation:pulse 1.6s infinite}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
          .quest-hero h1{font-size:clamp(28px,5vw,44px);margin:18px 0 6px;font-weight:800;letter-spacing:-.5px}
          .quest-hero h1 em{font-style:normal;color:#FFD75E}
          .quest-hero p{color:#B9AC9B;margin:0;font-size:15px}
          .quest-stats{display:flex;gap:10px;justify-content:center;margin:22px 0 30px;flex-wrap:wrap}
          .qstat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:10px 20px;text-align:center}
          .qstat b{display:block;font-size:22px;color:#FFD75E}
          .qstat span{font-size:12px;color:#A99C8B}
          .quest-levels{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;max-width:760px;margin:0 auto}
          .qlevel{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:22px 18px;text-align:left;cursor:pointer;transition:.18s}
          .qlevel:hover{background:rgba(255,215,94,.1);border-color:rgba(255,215,94,.45);transform:translateY(-2px)}
          .qlevel .lv{font-size:22px;font-weight:800;color:#FFD75E}
          .qlevel .desc{font-size:12px;color:#A99C8B;margin-top:6px}
          .quest-back{margin:28px auto 0;display:block;background:transparent;border:1px solid rgba(255,255,255,.18);color:#C9BCAB;padding:8px 22px;border-radius:999px;cursor:pointer;font-size:14px}
          .quest-back:hover{border-color:#FFD75E;color:#FFD75E}
        `}</style>
        <div className="quest-hero">
          <span className="q-badge"><span className="dot" />像玩游戏一样，用句子学俄语</span>
          <h1>Русский <em>Квест</em></h1>
          <p>谨慎体验 · 小心上瘾 —— 选择难度，先玩一把</p>
          <div className="quest-stats">
            <div className="qstat"><b>{LEVELS.length}</b><span>难度等级</span></div>
            <div className="qstat"><b>∞</b><span>俄语句子</span></div>
            <div className="qstat"><b>SSS</b><span>最高评分</span></div>
          </div>
        </div>
        <div className="quest-levels">
          {LEVELS.map(lv => (
            <div key={lv} className="qlevel" onClick={() => { setLevel(lv); startRound(lv) }}>
              <div className="lv">{lv}</div>
              <div className="desc">{lv === 'A1' ? '零基础 · 日常短句' : lv === 'A2' ? '初级 · 生活场景' : lv === 'B1' ? '中级 · 表达观点' : '中高级 · 抽象话题'}</div>
            </div>
          ))}
        </div>
        <button className="quest-back" onClick={() => navigate('/')}>← 返回首页</button>
      </div>
    )
  }

  // —— 结算页 ——
  if (phase === 'result') {
    const r = result
    const share = () => {
      const txt = `我在「Русский Квест」俄语闯关拿到 ${r.rating.label} 评级 · ${score} 分！一次命中率 ${r.firstRate}%，最大连击 ${maxCombo}。来挑战我！`
      if (navigator.share) navigator.share({ text: txt }).catch(() => {})
      else { navigator.clipboard?.writeText(txt); toast('战绩已复制，可粘贴分享') }
    }
    return (
      <div className="quest-page">
        <style>{`
          .qr-wrap{max-width:640px;margin:0 auto}
          .qr-top{display:flex;align-items:center;gap:10px;padding:6px 0 18px;font-size:14px;color:#A99C8B}
          .qr-top button{background:transparent;border:1px solid rgba(255,255,255,.15);color:#C9BCAB;padding:5px 14px;border-radius:999px;cursor:pointer;font-size:13px}
          .qr-top button:hover{border-color:#FFD75E;color:#FFD75E}
          .qr-hero{text-align:center;padding:8px 0 16px}
          .qr-grade{font-size:64px;font-weight:900;color:${r.rating.color};text-shadow:0 0 30px ${r.rating.color}55}
          .qr-score{font-size:34px;font-weight:800;color:#F5EDE2;margin-top:2px}
          .qr-perf{display:flex;gap:26px;justify-content:center;margin-top:14px;color:#C9BCAB;font-size:14px}
          .qr-perf b{font-size:20px;color:#FFD75E;display:block}
          .qr-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}
          .qr-stat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;text-align:center}
          .qr-stat b{display:block;font-size:18px;color:#F5EDE2}
          .qr-stat span{font-size:11px;color:#A99C8B}
          .qr-ana{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px 18px;margin:16px 0}
          .qr-ana h3{font-size:14px;color:#A99C8B;margin:0 0 12px;font-weight:600}
          .qr-ana-row{display:flex;gap:12px;flex-wrap:wrap}
          .qr-ana-item{flex:1;min-width:96px;background:rgba(255,255,255,.04);border-radius:10px;padding:10px;text-align:center}
          .qr-ana-item b{display:block;font-size:20px;color:#FFD75E}
          .qr-ana-item span{font-size:11px;color:#A99C8B}
          .qr-quote{background:linear-gradient(135deg,rgba(255,215,94,.1),rgba(255,255,255,.03));border:1px solid rgba(255,215,94,.25);border-radius:14px;padding:16px 18px;margin:16px 0}
          .qr-quote .t{font-size:13px;color:#FFD75E;margin-bottom:6px}
          .qr-quote .ru{font-size:16px;color:#F5EDE2}
          .qr-quote .zh{font-size:13px;color:#A99C8B;margin-top:4px}
          .qr-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:22px}
          .qr-actions button{padding:11px 22px;border-radius:999px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#F5EDE2;cursor:pointer;font-size:14px;transition:.15s}
          .qr-actions button:hover{border-color:#FFD75E}
          .qr-actions .primary{background:linear-gradient(135deg,#FFD75E,#F5B942);color:#1C1814;font-weight:700;border:none}
        `}</style>
        <div className="qr-wrap">
          <div className="qr-top">
            <button onClick={() => navigate('/')}>回到首页</button>
            <button onClick={() => navigate('/course')}>课程列表</button>
            <button onClick={() => navigate('/profile')}>学习分析</button>
          </div>
          <div className="qr-hero">
            <div className="qr-grade">{r.rating.label}</div>
            <div className="qr-score">{score.toLocaleString()}</div>
            <div className="qr-perf">
              <div><b>{perfect}</b>完美</div>
              <div><b>{good}</b>很好</div>
              <div><b>{skipped}</b>跳过</div>
            </div>
          </div>
          <div className="qr-stats">
            <div className="qr-stat"><b>{fmtTime(elapsed)}</b><span>练习时长</span></div>
            <div className="qr-stat"><b>{round.length}</b><span>答题数</span></div>
            <div className="qr-stat"><b>{maxCombo}</b><span>最大连击</span></div>
          </div>
          <div className="qr-ana">
            <h3>数据分析</h3>
            <div className="qr-ana-row">
              <div className="qr-ana-item"><b>{r.firstRate}%</b><span>一次命中率</span></div>
              <div className="qr-ana-item"><b>{r.correctRate}%</b><span>正确率</span></div>
              <div className="qr-ana-item"><b>0%</b><span>查看答案</span></div>
              <div className="qr-ana-item"><b>{r.listenCount}</b><span>重听次数</span></div>
              <div className="qr-ana-item"><b>{r.avgMs / 1000}s</b><span>平均用时</span></div>
            </div>
          </div>
          {todayQuote && (
            <div className="qr-quote">
              <div className="t">今日金句</div>
              <div className="ru">"{todayQuote.russian}"</div>
              <div className="zh">{todayQuote.chinese}</div>
            </div>
          )}
          <div className="qr-actions">
            <button onClick={share}>炫耀战绩</button>
            <button onClick={() => { setQi(Math.max(0, qi - 1)); setPhase('play'); loadQuestion(Math.max(0, qi - 1)) }}>{'<'} 上一课</button>
            <button className="primary" onClick={() => startRound(level)}>再来一次</button>
            <button onClick={() => { setLevel(level); setPhase('level') }}>换难度</button>
          </div>
        </div>
      </div>
    )
  }

  // —— 游戏页 ——
  const progressPct = round.length ? Math.round(((qi + (done ? 1 : 0)) / round.length) * 100) : 0
  const okSeq = words.length && picked.length === words.length && words.every((ow, i) => norm(cleanWord(picked[i])) === norm(cleanWord(ow)))
  return (
    <div className="quest-page">
      <style>{`
        .q-game{max-width:880px;margin:0 auto}
        .q-top{display:flex;align-items:center;gap:10px;font-size:13px;color:#A99C8B;padding:4px 0 10px}
        .q-top .lv-tag{background:rgba(255,215,94,.12);color:#FFD75E;border:1px solid rgba(255,215,94,.3);padding:3px 10px;border-radius:999px;font-weight:700}
        .q-top .prog{flex:1;text-align:center}
        .q-top .prog-bar{height:5px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden;margin-top:4px}
        .q-top .prog-bar i{display:block;height:100%;background:linear-gradient(90deg,#FFD75E,#F5B942);transition:width .3s}
        .q-top .score{color:#FFD75E;font-weight:800;font-size:18px}
        .q-top .time{font-variant-numeric:tabular-nums}
        .q-combo{text-align:center;font-size:30px;font-weight:900;color:#FFD75E;min-height:44px;margin:4px 0 2px;text-shadow:0 0 18px rgba(255,215,94,.4)}
        .q-zh{text-align:center;font-size:clamp(18px,3.2vw,24px);color:#F5EDE2;font-weight:600;margin:2px 0 6px}
        .q-hint{text-align:center;font-size:12px;color:#8C7F6E;margin-bottom:14px}
        .q-stage{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:18px;padding:22px 18px;min-height:150px;position:relative}
        .q-picked{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;min-height:44px;margin-bottom:14px;align-items:center}
        .q-picked.empty::after{content:'按顺序点下面的单词，或直接输入俄语后回车';color:#6E6355;font-size:13px}
        .q-word{border-radius:10px;padding:7px 14px;font-size:18px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:#F5EDE2;cursor:pointer;transition:.15s;user-select:none}
        .q-word:hover{border-color:#FFD75E}
        .q-word.picked{background:rgba(255,215,94,.15);border-color:#FFD75E;color:#FFD75E}
        .q-word.wrong{border-color:#E5484D;color:#FF6B6B;animation:shake .3s}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
        .q-input-row{display:flex;gap:8px;justify-content:center;margin-top:6px}
        .q-input-row input{background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);color:#F5EDE2;border-radius:10px;padding:9px 14px;font-size:17px;outline:none;width:min(320px,60%)}
        .q-input-row input:focus{border-color:#FFD75E}
        .q-input-row button{background:rgba(255,215,94,.14);border:1px solid rgba(255,215,94,.4);color:#FFD75E;border-radius:10px;padding:9px 16px;font-size:14px;cursor:pointer}
        .q-done-msg{text-align:center;font-size:16px;font-weight:700;margin-top:10px}
        .q-done-msg.ok{color:#4ADE80}
        .q-done-msg.bad{color:#FF6B6B}
        .q-analysis{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.07);border-radius:14px;margin-top:12px;padding:14px 16px}
        .q-analysis h4{font-size:12px;color:#8C7F6E;margin:0 0 10px;font-weight:600}
        .q-awords{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}
        .q-aword{text-align:center;min-width:52px}
        .q-aword .w{font-size:17px;color:#F5EDE2;font-weight:600}
        .q-aword .stress{font-size:11px;color:#FFD75E}
        .q-aword .pos{font-size:11px;color:#7ED6A5;margin-top:2px}
        .q-aword .zh{font-size:12px;color:#B9AC9B;margin-top:2px}
        .q-azh{text-align:center;color:#F5EDE2;font-size:15px;margin-top:12px;padding-top:10px;border-top:1px dashed rgba(255,255,255,.1)}
        .q-keyhints{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:18px}
        .kh{display:flex;align-items:center;gap:6px;font-size:12px;color:#8C7F6E}
        .kh kbd{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:5px;padding:2px 7px;font-size:11px;color:#C9BCAB}
        .q-actions{display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap}
        .q-actions button{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#F5EDE2;border-radius:999px;padding:9px 20px;cursor:pointer;font-size:14px;transition:.15s}
        .q-actions button:hover{border-color:#FFD75E;color:#FFD75E}
        .q-actions .primary{background:linear-gradient(135deg,#FFD75E,#F5B942);color:#1C1814;font-weight:700;border:none}
      `}</style>
      <div className="q-game">
        <div className="q-top">
          <span className="lv-tag">{level}</span>
          <span>第 {qi + 1} 题 ({qi + (done ? 1 : 0)}/{round.length})</span>
          <div className="prog">
            <div className="prog-bar"><i style={{ width: progressPct + '%' }} /></div>
          </div>
          <span className="score">{score.toLocaleString()}</span>
          <span className="time">{fmtTime(elapsed)}</span>
        </div>

        {combo >= 2 && <div className="q-combo">Perfect × {combo}</div>}
        <div className="q-zh">{curZh || cur?.chinese || '…'}</div>
        <div className="q-hint">{done ? '已作答 · 看拆解后进入下一题' : '连词成句 · 点单词按正确顺序排列'}</div>

        <div className="q-stage">
          <div className={'q-picked' + (picked.length === 0 ? ' empty' : '')}>
            {picked.map((w, i) => (
              <span key={i} className={'q-word picked'} onClick={undo}>{stripStress(w)}</span>
            ))}
          </div>
          {!done && (
            <>
              <div className="q-input-row">
                <input
                  ref={inputRef}
                  placeholder="输入单词后回车（或点击下方词块）"
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
                  <span key={i} className="q-word" onClick={() => pick(w)}>{stripStress(w)}</span>
                ))}
              </div>
            </>
          )}
          {done && (
            <div className={'q-done-msg ' + (okSeq ? 'ok' : 'bad')}>
              {okSeq ? '✓ 完全正确！' : '正确答案已展示，看拆解理解后继续'}
            </div>
          )}
          {done && analysis && analysis.words && (
            <div className="q-analysis">
              <h4>单词拆解 · 语法解析</h4>
              <div className="q-awords">
                {analysis.words.map((aw, i) => (
                  <div key={i} className="q-aword">
                    <div className="w">{stripStress(aw.word)}</div>
                    <div className="stress">{aw.stress || aw.word}</div>
                    <div className="pos">{aw.pos || ''}</div>
                    <div className="zh">{aw.zh || ''}</div>
                  </div>
                ))}
              </div>
              <div className="q-azh">{analysis.zh || cur?.chinese}</div>
            </div>
          )}
          {done && analysing && <div className="q-done-msg">AI 拆解生成中…</div>}
          {done && analysis && analysis.err && (
            <div className="q-analysis">
              <h4>单词拆解</h4>
              <div className="q-awords">
                {words.map((w, i) => (
                  <div key={i} className="q-aword"><div className="w">{stripStress(w)}</div></div>
                ))}
              </div>
              <div className="q-azh">{analysis.zh || cur?.chinese}</div>
            </div>
          )}
        </div>

        <div className="q-actions">
          {!done ? (
            <>
              <button onClick={() => playSound(cur?.russian)}>播放发音</button>
              <button onClick={undo}>撤销</button>
              <button onClick={skip}>跳过</button>
            </>
          ) : (
            <>
              <button onClick={() => playSound(cur?.russian)}>再听一遍</button>
              <button onClick={toggleMastered}>{mastered.includes(cur.id + '_' + qi) ? '✓ 已掌握' : '掌握'}</button>
              <button onClick={addVocab}>{vocabNote.includes(cur.id + '_' + qi) ? '✓ 已加生词' : '加生词'}</button>
              <button className="primary" onClick={next}>{qi + 1 >= round.length ? '查看结算' : '下一题'}</button>
            </>
          )}
        </div>

        <div className="q-keyhints">
          {KEY_HINTS.map((h, i) => (
            <span key={i} className="kh"><kbd>{h.k}</kbd>{h.v}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
