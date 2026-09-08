import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { toast } from '../lib/toast'

const QUIZ_TYPES = [
  { type: 'vocab_mcq', count: 5, label: '词汇选择' },
  { type: 'grammar_fill', count: 5, label: '语法填空' },
  { type: 'grammar_mcq', count: 5, label: '语法选择' },
  { type: 'ru_to_cn', count: 5, label: '俄译中' },
  { type: 'cn_to_ru', count: 5, label: '中译俄' },
  { type: 'sentence_creation', count: 3, label: '自主造句' },
  { type: 'reading_comprehension', count: 2, label: '阅读理解' },
]

const TYPE_LABEL_MAP = QUIZ_TYPES.reduce((acc, t) => {
  acc[t.type] = t.label
  return acc
}, {})

const MCQ_TYPES = ['vocab_mcq', 'grammar_fill', 'grammar_mcq']

export default function AIQuiz({ sentences, videoId, videoTitle, onClose }) {
  const [phase, setPhase] = useState('generating') // generating | answering | grading | result | error
  const [quiz, setQuiz] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userAnswers, setUserAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [expandedDetails, setExpandedDetails] = useState({})
  const [genError, setGenError] = useState(null)

  // 生成测验
  const generateQuiz = useCallback(async () => {
    setPhase('generating')
    setGenError(null)
    setQuiz([])
    setUserAnswers({})
    setResult(null)
    setCurrentIdx(0)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const r = await apiFetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentences: (sentences || []).map(s => ({ russian: s.russian, chinese: s.chinese })),
          title: videoTitle || '',
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || '生成题目失败')
      if (!Array.isArray(j.quiz) || j.quiz.length === 0) throw new Error('返回题目为空')
      setQuiz(j.quiz)
      setPhase('answering')
    } catch (e) {
      clearTimeout(timeoutId)
      const msg = e.name === 'AbortError' ? '生成超时（30秒），请重试' : (e.message || '生成题目失败')
      setGenError(msg)
      setPhase('error')
    }
  }, [sentences, videoTitle])

  useEffect(() => {
    generateQuiz()
  }, [generateQuiz])

  // 提交评分
  const submitQuiz = useCallback(async () => {
    const unanswered = quiz.filter(q => userAnswers[q.id] == null || userAnswers[q.id] === '').length
    if (unanswered > 0) {
      if (!window.confirm(`还有 ${unanswered} 道题未作答，确定提交吗？`)) return
    }
    setPhase('grading')
    try {
      const r = await apiFetch('/api/grade-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quiz,
          userAnswers,
          sentences: (sentences || []).map(s => ({ russian: s.russian, chinese: s.chinese })),
        }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || '评分失败')
      setResult(j.result)
      setPhase('result')
      // 保存到 localStorage
      try {
        const all = JSON.parse(localStorage.getItem('rlearn_quiz_results') || '{}')
        all[videoId] = {
          score: j.result.score,
          pass: j.result.pass,
          date: Date.now(),
          breakdown: j.result.breakdown,
        }
        localStorage.setItem('rlearn_quiz_results', JSON.stringify(all))
      } catch (e) { /* localStorage 写入失败忽略 */ }
    } catch (e) {
      toast('评分失败：' + e.message)
      setPhase('answering')
    }
  }, [quiz, userAnswers, sentences, videoId])

  // 渲染题目
  const renderQuestion = (q) => {
    const isMCQ = MCQ_TYPES.includes(q.type)
    if (isMCQ) {
      return (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15, lineHeight: 1.6, color: '#3D332C' }}>
            {q.question}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(q.options || []).map((opt, i) => {
              const selected = userAnswers[q.id] === i
              return (
                <button
                  key={i}
                  className="btn sm"
                  onClick={() => setUserAnswers(prev => ({ ...prev, [q.id]: i }))}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    background: selected ? 'var(--accent, #8B735F)' : '#FFFCF7',
                    color: selected ? '#fff' : '#5C4A3A',
                    border: selected ? '1px solid var(--accent, #8B735F)' : '1px solid var(--border2, #E8E1D9)',
                    borderRadius: 10,
                    fontSize: 14,
                    lineHeight: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontWeight: 600, marginRight: 6 }}>{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      )
    }
    // 主观题
    return (
      <div>
        <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15, lineHeight: 1.6, color: '#3D332C' }}>
          {q.question}
        </div>
        <textarea
          value={userAnswers[q.id] || ''}
          onChange={e => setUserAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
          placeholder="输入你的答案..."
          style={{
            width: '100%',
            minHeight: 100,
            padding: '10px 12px',
            border: '1px solid var(--border2, #E8E1D9)',
            borderRadius: 10,
            fontSize: 14,
            fontFamily: 'inherit',
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            background: '#FFFCF7',
            color: '#3D332C',
          }}
        />
      </div>
    )
  }

  // 通过状态
  const getPassInfo = (res) => {
    if (res.score >= 80) return { label: '✅ 通过', color: '#6E8F7E' }
    if (res.score >= 60) return { label: '⚠️ 勉强通过', color: '#B08A5A' }
    return { label: '❌ 未通过', color: '#A86454' }
  }

  // 切换详情展开
  const toggleDetail = (id) => {
    setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const curQ = quiz[currentIdx]
  const answeredCount = quiz.filter(q => userAnswers[q.id] != null && userAnswers[q.id] !== '').length

  // ========== 渲染 ==========
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(60, 45, 30, 0.55)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFFCF7',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(60,45,30,0.35)',
          width: '100%',
          maxWidth: 700,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border2, #E8E1D9)',
        }}
      >
        {/* 顶部标题栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border2, #E8E1D9)',
            background: 'var(--soft, #F5F0E8)',
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 16, color: '#3D332C' }}>
            📝 AI 测验
            {videoTitle && <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--muted, #86796D)', fontWeight: 400 }}>— {videoTitle}</span>}
          </div>
          <button className="btn sm" onClick={onClose} style={{ fontSize: 12 }}>✕ 关闭</button>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* 生成中 */}
          {phase === 'generating' && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
              <div style={{ fontSize: 16, color: '#3D332C', fontWeight: 500, marginBottom: 8 }}>
                正在生成测验题目…
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted, #86796D)' }}>
                AI 正在根据文章内容生成 30 道题，请稍候（约 10-30 秒）
              </div>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--accent, #8B735F)',
                      animation: `pulse 1.2s ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 生成错误 */}
          {phase === 'error' && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <div style={{ fontSize: 16, color: '#A86454', fontWeight: 500, marginBottom: 8 }}>
                题目生成失败
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted, #86796D)', marginBottom: 20 }}>
                {genError || '未知错误'}
              </div>
              <button className="btn sm primary" onClick={generateQuiz}>🔄 重新生成</button>
            </div>
          )}

          {/* 答题阶段 */}
          {phase === 'answering' && curQ && (
            <div>
              {/* 进度条 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#3D332C' }}>
                    第 {currentIdx + 1} 题 / 共 {quiz.length} 题
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      padding: '3px 10px',
                      borderRadius: 12,
                      background: 'var(--accent-soft, #F2EDE8)',
                      color: 'var(--accent, #8B735F)',
                      fontWeight: 500,
                    }}
                  >
                    {TYPE_LABEL_MAP[curQ.type] || curQ.type}
                  </span>
                </div>
                {/* 进度条 */}
                <div style={{ height: 4, background: 'var(--border2, #E8E1D9)', borderRadius: 2, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${((currentIdx + 1) / quiz.length) * 100}%`,
                      background: 'var(--accent, #8B735F)',
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              </div>

              {/* 题号圆点 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 20 }}>
                {quiz.map((q, i) => {
                  const answered = userAnswers[q.id] != null && userAnswers[q.id] !== ''
                  const isCur = i === currentIdx
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIdx(i)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        border: 'none',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: isCur
                          ? 'var(--accent, #8B735F)'
                          : answered
                            ? '#6E8F7E'
                            : 'var(--border2, #E8E1D9)',
                        color: isCur || answered ? '#fff' : 'var(--muted, #86796D)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>

              {/* 题目内容 */}
              <div style={{ minHeight: 200 }}>
                {renderQuestion(curQ)}
              </div>

              {/* 导航按钮 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border2, #E8E1D9)' }}>
                <button
                  className="btn sm"
                  onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                  disabled={currentIdx === 0}
                >
                  ← 上一题
                </button>
                <span style={{ fontSize: 12, color: 'var(--muted, #86796D)', alignSelf: 'center' }}>
                  已答 {answeredCount}/{quiz.length}
                </span>
                {currentIdx < quiz.length - 1 ? (
                  <button
                    className="btn sm primary"
                    onClick={() => setCurrentIdx(i => Math.min(quiz.length - 1, i + 1))}
                  >
                    下一题 →
                  </button>
                ) : (
                  <button className="btn sm primary" onClick={submitQuiz}>
                    📤 提交测验
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 评分中 */}
          {phase === 'grading' && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
              <div style={{ fontSize: 16, color: '#3D332C', fontWeight: 500, marginBottom: 8 }}>
                正在评分…
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted, #86796D)' }}>
                AI 正在批改你的答案，请稍候
              </div>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--accent, #8B735F)',
                      animation: `pulse 1.2s ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 结果阶段 */}
          {phase === 'result' && result && (
            <div>
              {/* 总分 */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 56, fontWeight: 700, color: 'var(--accent, #8B735F)', lineHeight: 1 }}>
                  {result.score}
                </div>
                <div style={{ fontSize: 14, color: 'var(--muted, #86796D)', marginTop: 4 }}>分（百分制）</div>
                <div
                  style={{
                    display: 'inline-block',
                    marginTop: 10,
                    padding: '5px 16px',
                    borderRadius: 16,
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#fff',
                    background: getPassInfo(result).color,
                  }}
                >
                  {getPassInfo(result).label}
                </div>
              </div>

              {/* 各题型得分 */}
              {result.breakdown && Object.keys(result.breakdown).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: '#3D332C' }}>📊 各题型得分</div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 8,
                  }}>
                    {Object.entries(result.breakdown).map(([type, val]) => (
                      <div
                        key={type}
                        style={{
                          padding: '8px 12px',
                          background: '#fff',
                          border: '1px solid var(--border2, #E8E1D9)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ color: 'var(--muted, #86796D)' }}>{TYPE_LABEL_MAP[type] || type}</div>
                        <div style={{ fontWeight: 600, color: '#3D332C', marginTop: 2 }}>{String(val)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 复习建议 */}
              {result.suggestion && (
                <div style={{
                  marginBottom: 20,
                  padding: '12px 16px',
                  background: 'var(--soft, #F5F0E8)',
                  border: '1px solid var(--border2, #E8E1D9)',
                  borderRadius: 10,
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: '#3D332C',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>💡 针对性复习建议</div>
                  {result.suggestion}
                </div>
              )}

              {/* 每题详情 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: '#3D332C' }}>📋 答题详情</div>
                {result.details && result.details.map((d, i) => {
                  const q = quiz.find(qq => qq.id === d.id)
                  const isOpen = expandedDetails[d.id]
                  const isCorrect = d.score != null ? d.score > 0 : null
                  return (
                    <div
                      key={d.id}
                      style={{
                        marginBottom: 8,
                        border: '1px solid var(--border2, #E8E1D9)',
                        borderRadius: 10,
                        overflow: 'hidden',
                        background: '#fff',
                      }}
                    >
                      <button
                        onClick={() => toggleDetail(d.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 14px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: 13,
                        }}
                      >
                        <span style={{
                          flexShrink: 0,
                          width: 22, height: 22, borderRadius: '50%',
                          background: isCorrect === true ? '#6E8F7E' : isCorrect === false ? '#A86454' : 'var(--border2, #E8E1D9)',
                          color: '#fff',
                          fontSize: 11, fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {i + 1}
                        </span>
                        <span style={{ flex: 1, color: '#3D332C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q?.question || `第${i + 1}题`}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted, #86796D)', flexShrink: 0 }}>
                          {TYPE_LABEL_MAP[q?.type] || ''}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted, #86796D)', flexShrink: 0 }}>
                          {isOpen ? '▲' : '▼'}
                        </span>
                      </button>
                      {isOpen && (
                        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border2, #E8E1D9)', fontSize: 13, lineHeight: 1.7 }}>
                          {q?.question && (
                            <div style={{ marginTop: 10, color: '#3D332C' }}>
                              <strong>题目：</strong>{q.question}
                            </div>
                          )}
                          {q?.options && q.options.length > 0 && (
                            <div style={{ marginTop: 6, color: '#5C4A3A' }}>
                              <strong>选项：</strong>
                              <div style={{ marginTop: 4, paddingLeft: 8 }}>
                                {q.options.map((opt, oi) => (
                                  <div key={oi} style={{
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    background: oi === q.answer ? 'rgba(110,143,126,0.12)' : 'transparent',
                                    color: oi === q.answer ? '#6E8F7E' : '#5C4A3A',
                                    fontWeight: oi === q.answer ? 600 : 400,
                                  }}>
                                    {String.fromCharCode(65 + oi)}. {opt}
                                    {oi === q.answer && ' ✓'}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div style={{ marginTop: 8, color: '#A86454' }}>
                            <strong>你的答案：</strong>
                            {d.userAnswer != null && d.userAnswer !== ''
                              ? (typeof d.userAnswer === 'number' && q?.options
                                  ? `${String.fromCharCode(65 + d.userAnswer)}. ${q.options[d.userAnswer]}`
                                  : String(d.userAnswer))
                              : <span style={{ color: 'var(--muted, #86796D)' }}>（未作答）</span>}
                          </div>
                          {d.correctAnswer != null && d.correctAnswer !== '' && (
                            <div style={{ marginTop: 4, color: '#6E8F7E' }}>
                              <strong>正确答案：</strong>
                              {typeof d.correctAnswer === 'number' && q?.options
                                ? `${String.fromCharCode(65 + d.correctAnswer)}. ${q.options[d.correctAnswer]}`
                                : String(d.correctAnswer)}
                            </div>
                          )}
                          {d.explanation && (
                            <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--soft, #F5F0E8)', borderRadius: 6, color: '#5C4A3A' }}>
                              <strong>解析：</strong>{d.explanation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 底部按钮 */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', paddingTop: 16, borderTop: '1px solid var(--border2, #E8E1D9)' }}>
                <button className="btn sm" onClick={onClose}>关闭</button>
                <button className="btn sm primary" onClick={generateQuiz}>🔄 重新测验</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
