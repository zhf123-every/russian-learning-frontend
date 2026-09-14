import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { analyzeSentence, pronunciationScore, ttsUrl } from '../lib/ai'
import { toast } from '../lib/toast'

// —— 工具函数 ——
// 组合附加符号区间（含俄语重音 U+0301），切词时必须保留在单词内，避免 Здра́вствуйте 被拆碎
const WORD_RE_G = /[А-Яа-яЁё\u0300-\u036f\-]+/g
const TOKEN_RE_G = /[А-Яа-яЁё\u0300-\u036f\-]+|[^А-Яа-яЁё\u0300-\u036f\s]/g
const WORD_TEST = /[А-Яа-яЁё\u0300-\u036f\-]/
// 去掉重音等组合符号（键盘输入不含重音，长度/比对/答案一律用去重音后的纯词）
const stripStress = (w) => (w || '').replace(/[\u0300-\u036f]/g, '')
// 规范化单词：去重音、小写、ё→е，用于容错比对
const normWord = (w) => stripStress(w || '').toLowerCase().replace(/ё/g, 'е').trim()
const wordCorrect = (target, input) => normWord(target) === normWord(input)
// 句子拆 token：俄语单词（含重音）+ 独立标点（标点不占默写格）
const tokenize = (text) => (text || '').match(TOKEN_RE_G) || []
const SCORE_COLORS = { 100: '#3E8E5A', 95: '#3E8E5A', 90: '#6E9A4F', 85: '#C08133', 80: '#C0563B' }
const STATUS_LABEL = { correct: '正确', misread: '读错', omitted: '漏读', extra: '多读' }

/**
 * 默写 + 口语评测全屏面板（尚雯婕学习法 · 阶段2 检查正确后进入）
 *
 * Props:
 *   sentences        — [{ russian, chinese, id }] 当前素材的句子数组
 *   startIdx         — 起始句索引
 *   onClose          — 关闭面板
 *   ttsMode          — true=分级课程（组件内 /api/tts 播放，可切男女声）；
 *                      false=自定义素材（调 playOriginal 播放视频片段原声，只出声不显画面）
 *   playOriginal(i)  — ttsMode=false 时，由父组件播放第 i 句视频原声
 *   onSentenceChange(i) — 面板内切换句子时同步父组件学习进度
 */
export default function DictationExam({
  sentences = [],
  startIdx = 0,
  onClose,
  ttsMode = false,
  playOriginal,
  onSentenceChange,
}) {
  const [idx, setIdx] = useState(startIdx)
  const [phase, setPhase] = useState('dict') // dict | analysis
  const sentence = sentences[idx]
  const tokens = useMemo(() => tokenize(sentence?.russian), [sentence])
  // 去重音后的纯单词序列（用于格子数量、自动跳格长度、比对、答案）
  const targetWords = useMemo(
    () => tokens.filter(t => WORD_TEST.test(t)).map(stripStress),
    [tokens]
  )

  // —— 默写状态 ——
  const [inputs, setInputs] = useState([])
  const [wrongSet, setWrongSet] = useState(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const inputRefs = useRef([])

  // —— 撒花 ——
  const [confetti, setConfetti] = useState(false)
  const confettiPieces = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      dur: 1.4 + Math.random() * 1.1,
      color: ['#B08A5A', '#D9B98C', '#8FA97C', '#C98F6B', '#E3CDA4'][i % 5],
      rot: Math.random() * 360,
    }))
  }, [])

  // —— 句子解析 ——
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const analysisCache = useRef({})

  // —— TTS（ttsMode） ——
  const [voice, setVoice] = useState('female')
  const ttsAudioRef = useRef(null)

  // —— 录音 ——
  const [recording, setRecording] = useState(false)
  const [recUrl, setRecUrl] = useState(null)
  const [recBlob, setRecBlob] = useState(null)
  const mediaRecRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  // —— 评测结果 ——
  const [scoring, setScoring] = useState(false)
  const [scoreResult, setScoreResult] = useState(null)

  // 播放当前/指定句标准音
  const playSentence = useCallback((i, v = voice) => {
    const s = sentences[i]
    if (!s) return
    if (ttsMode) {
      try { ttsAudioRef.current?.pause() } catch (e) { /* ignore */ }
      const audio = ttsAudioRef.current || (ttsAudioRef.current = new Audio())
      audio.src = ttsUrl(s.russian, v)
      audio.play().catch(() => { /* 浏览器自动播放限制，用户可手动点 */ })
    } else {
      playOriginal && playOriginal(i)
    }
  }, [sentences, ttsMode, voice, playOriginal])

  // 切句时重置全部局部状态
  const resetForSentence = useCallback((i, autoplay) => {
    const ws = (sentences[i]?.russian.match(WORD_RE_G) || []).map(stripStress)
    setInputs(new Array(ws.length).fill(''))
    setWrongSet(new Set())
    setSubmitted(false)
    setRevealed(false)
    setPhase('dict')
    setAnalysis(null)
    setScoreResult(null)
    setRecUrl(null)
    setRecBlob(null)
    if (autoplay) setTimeout(() => playSentence(i), 300)
  }, [sentences, playSentence])

  // 挂载：聚焦第一格 + 自动朗读
  useEffect(() => {
    const ws = (sentences[startIdx]?.russian.match(WORD_RE_G) || []).map(stripStress)
    setInputs(new Array(ws.length).fill(''))
    const t1 = setTimeout(() => inputRefs.current[0]?.focus(), 400)
    const t2 = setTimeout(() => playSentence(startIdx), 500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 卸载：停止录音/TTS
  useEffect(() => () => {
    try { mediaRecRef.current?.state !== 'inactive' && mediaRecRef.current?.stop() } catch (e) { /* ignore */ }
    streamRef.current?.getTracks().forEach(t => t.stop())
    try { ttsAudioRef.current?.pause() } catch (e) { /* ignore */ }
  }, [])

  // —— 默写输入：边打边显示，输满单词长度自动跳下一格 ——
  const handleInput = (k, val) => {
    if (revealed) return
    const next = inputs.slice()
    next[k] = val
    setInputs(next)
    if (wrongSet.has(k)) {
      const nw = new Set(wrongSet)
      nw.delete(k)
      setWrongSet(nw)
    }
    // 输满目标单词字母数 → 自动跳下一格里（不用按空格）
    if (!submitted && val.length >= targetWords[k].length && k < targetWords.length - 1) {
      setTimeout(() => inputRefs.current[k + 1]?.focus(), 0)
    }
  }

  const handleKeyDown = (k, e) => {
    if (e.key === 'Backspace' && !inputs[k] && k > 0) {
      inputRefs.current[k - 1]?.focus()
      e.preventDefault()
    } else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0 && k > 0) {
      inputRefs.current[k - 1]?.focus()
      e.preventDefault()
    } else if (e.key === 'ArrowRight' &&
      e.currentTarget.selectionStart === (inputs[k] || '').length && k < targetWords.length - 1) {
      inputRefs.current[k + 1]?.focus()
      e.preventDefault()
    }
  }

  const fireConfetti = () => {
    setConfetti(true)
    setTimeout(() => setConfetti(false), 1800)
  }

  // 加载句子解析（带缓存）
  const loadAnalysis = useCallback(async () => {
    const cacheKey = sentence?.id ?? idx
    if (analysisCache.current[cacheKey]) {
      setAnalysis(analysisCache.current[cacheKey])
      return
    }
    setAnalysisLoading(true)
    try {
      const r = await analyzeSentence(sentence.russian)
      analysisCache.current[cacheKey] = r
      setAnalysis(r)
    } catch (e) {
      const fallback = {
        words: targetWords.map(w => ({ word: w, stressed: w, pos: '', mean: '' })),
        components: [], translation: sentence.chinese || '', grammar: '',
      }
      setAnalysis(fallback)
      toast(e.message || '句子解析失败')
    } finally {
      setAnalysisLoading(false)
    }
  }, [sentence, idx, targetWords])

  // 提交校验：错误格统一变红；全对撒花并进解析面板
  const submitDict = () => {
    const wrong = new Set()
    targetWords.forEach((w, k) => { if (!wordCorrect(w, inputs[k] || '')) wrong.add(k) })
    setWrongSet(wrong)
    setSubmitted(true)
    if (wrong.size === 0) {
      fireConfetti()
      setTimeout(() => { setPhase('analysis'); loadAnalysis() }, 1150)
    } else {
      toast('有 ' + wrong.size + ' 个单词不对（红色格子），可直接修改后重新提交')
      const first = [...wrong][0]
      setTimeout(() => inputRefs.current[first]?.focus(), 50)
    }
  }

  // 实在不会：直接填入正确单词
  const showAnswer = () => {
    setInputs(targetWords.slice())
    setWrongSet(new Set())
    setRevealed(true)
  }

  // 看答案后手动进入解析
  const enterAnalysis = () => {
    setPhase('analysis')
    loadAnalysis()
  }

  // —— 录音 ——
  const startRec = async () => {
    try { ttsAudioRef.current?.pause() } catch (e) { /* ignore */ }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        setRecBlob(blob)
        setRecUrl(URL.createObjectURL(blob))
        setScoreResult(null)
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      mediaRecRef.current = rec
      rec.start()
      setRecording(true)
      setScoreResult(null)
    } catch (e) {
      toast('无法访问麦克风：' + e.message)
    }
  }
  const stopRec = () => {
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') mediaRecRef.current.stop()
    setRecording(false)
  }

  const runScore = async () => {
    if (!recBlob) { toast('请先按住录音朗读'); return }
    setScoring(true)
    try {
      setScoreResult(await pronunciationScore(recBlob, sentence.russian))
    } catch (e) {
      toast(e.message || '评测失败，请重试')
    } finally {
      setScoring(false)
    }
  }

  // 上一句 / 下一句
  const goSentence = (d) => {
    const n = idx + d
    if (n < 0) { toast('已是第一句'); return }
    if (n >= sentences.length) { toast('已是最后一句'); return }
    setIdx(n)
    onSentenceChange && onSentenceChange(n)
    resetForSentence(n, true)
    setTimeout(() => inputRefs.current[0]?.focus(), 450)
  }

  if (!sentence) {
    return (
      <div className="dict-exam-overlay" onClick={onClose}>
        <div className="dict-exam-panel" onClick={e => e.stopPropagation()}>
          <div style={{ padding: 24, textAlign: 'center' }}>该素材没有可练习的句子
            <div style={{ marginTop: 12 }}><button className="btn sm primary" onClick={onClose}>关闭</button></div>
          </div>
        </div>
      </div>
    )
  }

  const allFilled = inputs.length > 0 && inputs.every(v => (v || '').length > 0)

  return (
    <div className="dict-exam-overlay">
      {confetti && (
        <div className="dict-confetti">
          {confettiPieces.map((p, i) => (
            <span key={i} style={{
              left: p.left + '%', background: p.color,
              animationDelay: p.delay + 's', animationDuration: p.dur + 's',
              transform: `rotate(${p.rot}deg)`,
            }} />
          ))}
        </div>
      )}

      <div className="dict-exam-panel" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="dict-exam-header">
          <div className="dict-exam-title">
            默写 · 口语评测
            <span>第 {idx + 1} / {sentences.length} 句</span>
          </div>
          <button className="btn sm" onClick={onClose}>退出练习</button>
        </div>

        {/* 正文滚动区 */}
        <div className="dict-exam-body">
          {/* ========== 阶段 A：逐词默写 ========== */}
          {phase === 'dict' && (
            <div>
              <div className="dict-zh-card">
                <div className="dict-zh-label">中文释义（根据听到的俄语默写）</div>
                <div className="dict-zh-text">{sentence.chinese || '（本句没有中文翻译，请凭听力默写）'}</div>
              </div>

              <div className="dict-cells">
                {tokens.map((tok, ti) => {
                  if (!WORD_TEST.test(tok)) {
                    return <span key={ti} className="dict-punct">{tok}</span>
                  }
                  // 该单词是第 k 个单词
                  let k = -1
                  for (let j = 0; j <= ti; j++) if (WORD_TEST.test(tokens[j])) k++
                  const isWrong = submitted && wrongSet.has(k)
                  const widthCh = Math.max(2, targetWords[k].length * 1.15 + 0.6)
                  return (
                    <input
                      key={ti}
                      ref={el => { inputRefs.current[k] = el }}
                      className={'dict-cell' + (isWrong ? ' wrong' : '') + (revealed ? ' revealed' : '')}
                      value={inputs[k] || ''}
                      onChange={e => handleInput(k, e.target.value)}
                      onKeyDown={e => handleKeyDown(k, e)}
                      onFocus={e => e.target.select()}
                      style={{ width: widthCh + 'ch' }}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      inputMode="text"
                      aria-label={'第' + (k + 1) + '个单词'}
                    />
                  )
                })}
              </div>

              {submitted && wrongSet.size > 0 && (
                <div className="dict-tip-err">红色单词有误，点击格子直接修改，改完重新提交</div>
              )}
              {revealed && (
                <div className="dict-tip-info">已显示正确拼写，确认记牢后进入句子解析</div>
              )}

              <div className="dict-actions">
                <button className="btn sm" onClick={() => playSentence(idx)}>再听一遍</button>
                {!revealed ? (
                  <button className="btn sm primary" disabled={!allFilled} onClick={submitDict}>提交校验</button>
                ) : (
                  <button className="btn sm primary" onClick={enterAnalysis}>进入句子解析</button>
                )}
                {!revealed && <button className="btn sm ghost" onClick={showAnswer}>实在不会 · 看答案</button>}
              </div>
            </div>
          )}

          {/* ========== 阶段 B：句子解析 + 口语评测 ========== */}
          {phase === 'analysis' && (
            <div>
              {analysisLoading && <div className="dict-loading">正在生成逐词解析与语法讲解…</div>}

              {!analysisLoading && analysis && (
                <>
                  {/* 逐词横排：句子成分 + 词性 + 重音单词 + 中文词义（参考图样式） */}
                  {analysis.words && analysis.words.length > 0 && (
                    <div className="dict-wordrow">
                      {analysis.words.map((w, i) => {
                        const comp = (analysis.components && analysis.components.length === analysis.words.length)
                          ? (analysis.components[i]?.role || '')
                          : ''
                        return (
                          <div className="dict-wordcol" key={i}>
                            <div className="dict-wc-pos">{w.pos || '—'}</div>
                            <div className="dict-wc-word">{w.stressed || w.word}</div>
                            <div className="dict-wc-mean">{w.mean || '—'}</div>
                            {comp && <div className="dict-wc-role">{comp}</div>}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* 整句中译（居中） */}
                  {analysis.translation && (
                    <div className="dict-sentence-trans">{analysis.translation}</div>
                  )}

                  {/* 句子成分（未逐词对应时独立展示） */}
                  {analysis.components && analysis.components.length > 0 &&
                    (!analysis.words || analysis.components.length !== analysis.words.length) && (
                      <div className="dict-components">
                        {analysis.components.map((c, i) => (
                          <span className="dict-comp" key={i}>
                            <b>{c.text}</b>
                            {c.role && <em>{c.role}</em>}
                          </span>
                        ))}
                      </div>
                    )}

                  {/* 语法解析 */}
                  <div className="dict-section-title">语法解析</div>
                  <div className="dict-grammar-card">
                    {analysis.grammar
                      ? <div className="dict-grammar-text">{analysis.grammar}</div>
                      : <div className="dict-tip-info">语法解析暂未生成，可稍后重试</div>}
                  </div>

                  {/* 口语评测 */}
                  <div className="dict-section-title">口语评测（跟读原句，严格评分）</div>
                  <div className="dict-speak-card">
                    <div className="dict-speak-row">
                      <button className="btn sm" onClick={() => playSentence(idx)}>播放标准原声</button>
                      {ttsMode && (
                        <div className="dict-voice-switch">
                          <button
                            className={'btn sm' + (voice === 'female' ? ' primary' : '')}
                            onClick={() => { setVoice('female'); setTimeout(() => playSentence(idx, 'female'), 0) }}
                          >女声 Svetlana</button>
                          <button
                            className={'btn sm' + (voice === 'male' ? ' primary' : '')}
                            onClick={() => { setVoice('male'); setTimeout(() => playSentence(idx, 'male'), 0) }}
                          >男声 Dmitry</button>
                        </div>
                      )}
                    </div>

                    <div className="dict-speak-row">
                      {!recording ? (
                        <button className="btn sm primary" onClick={startRec}>开始录音跟读</button>
                      ) : (
                        <button className="btn sm danger" onClick={stopRec}>停止录音</button>
                      )}
                      {recUrl && !recording && (
                        <>
                          <audio src={recUrl} controls className="dict-rec-audio" />
                          <button className="btn sm primary" disabled={scoring} onClick={runScore}>
                            {scoring ? '评测中…' : '提交评测'}
                          </button>
                        </>
                      )}
                    </div>
                    {recording && <div className="dict-rec-hint">正在录音… 朗读完点击「停止录音」</div>}

                    {/* 评测结果 */}
                    {scoreResult && (
                      <div className="dict-score-box">
                        <div className="dict-score-top">
                          <div className="dict-score-num" style={{ color: SCORE_COLORS[scoreResult.score] || '#C0563B' }}>
                            {scoreResult.score}<span>分</span>
                          </div>
                          <div className="dict-score-words">
                            {(scoreResult.words || []).map((w, i) => {
                              const cls = 'dict-sw dict-sw-' + w.status
                              return (
                                <span className={cls} key={i}>
                                  {w.status === 'extra' ? ('多读：' + w.heard) : w.target}
                                  {w.status === 'misread' && w.heard && <i>→ {w.heard}</i>}
                                  {w.status === 'omitted' && <i>漏读</i>}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                        {scoreResult.user_text && (
                          <div className="dict-score-heard">识别到你读的：{scoreResult.user_text}</div>
                        )}
                        {scoreResult.stress && <div className="dict-advice"><b>重音：</b>{scoreResult.stress}</div>}
                        {scoreResult.rhythm && <div className="dict-advice"><b>停顿语调：</b>{scoreResult.rhythm}</div>}
                        {scoreResult.summary && <div className="dict-advice"><b>总评：</b>{scoreResult.summary}</div>}
                        <div className="dict-speak-row" style={{ marginTop: 8 }}>
                          <button className="btn sm" onClick={() => { setScoreResult(null); setRecUrl(null); setRecBlob(null) }}>重新录一次</button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 底部：切换句子 + 朗读（仿参考图操作条） */}
        <div className="dict-exam-footer">
          <button className="btn sm" disabled={idx === 0} onClick={() => goSentence(-1)}>上一句</button>
          <button className="btn sm" onClick={() => playSentence(idx)}>朗读</button>
          <span className="dict-footer-progress">{idx + 1} / {sentences.length}</span>
          <button className="btn sm primary" disabled={idx === sentences.length - 1} onClick={() => goSentence(1)}>下一句</button>
        </div>
      </div>
    </div>
  )
}
