import React, { useState, useEffect, useMemo } from 'react'
import { splitSentenceToChunks } from '../lib/chunking'
import { getKnowledge, readKnowledgeCache } from '../lib/knowledge'

// 学习内容弹窗 —— 对标句乐部「查看课程学习内容 Ctrl+1」
// 左栏：chunking 渐进块列表（Это → дом → Это дом.）
// 右栏：知识点解析（主句/中文翻译/俄语释义/单词短语注解/语法分析/文化与实用知识/功能和使用场景/相关例句）
// 数据：全部内容由 AI 按完整句生成（缓存 localStorage），不依赖词典兜底

// 音频播放（后端 /api/tts；相对路径音频：dev 走 vite 代理，生产拼线上后端）
function playTTS(text) {
  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
    .then((r) => r.json())
    .then((d) => {
      let u = d && d.audio_url;
      if (!u) return;
      if (!u.startsWith('http')) {
        const host = window.location.hostname;
        u = (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0')
          ? u
          : 'https://russian-learning-jetq.onrender.com' + u;
      }
      new Audio(u).play().catch(() => {})
    })
    .catch(() => {})
}

export default function LearningContentModal({ title, sentences, unitId = '', onClose, onPractice }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [k, setK] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 左栏 chunking 渐进块（每句拆块，显示累积文本）
  const chunkItems = useMemo(() => {
    const items = []
    ;(Array.isArray(sentences) ? sentences : []).forEach((s) => {
      if (!s || !s.ru) return
      const chunks = splitSentenceToChunks(s.ru)
      let acc = ''
      chunks.forEach((c, k) => {
        acc = k === 0 ? c : acc + ' ' + c
        items.push({ sentence: s, text: acc, chunkKey: k, isFinal: k === chunks.length - 1 })
      })
    })
    return items
  }, [sentences])

  const item = chunkItems[activeIdx] || null
  const s = item?.sentence || null
  const isFinal = !!item?.isFinal
  const blockWords = (item?.text || '').match(/[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)?/g) || []

  // 整课缓存（用于左栏块中文副标题）
  const cacheMap = useMemo(() => readKnowledgeCache(unitId), [unitId, k])

  // 选中块变化 → 加载该句 AI 知识点
  useEffect(() => {
    if (!s) { setK(null); return }
    const ru = s.ru
    let alive = true
    setLoading(true)
    setError('')
    // 先查缓存，未命中走 AI 生成
    const cached = readKnowledgeCache(unitId)[ru]
    if (cached && cached._ru) {
      setK(cached)
      setLoading(false)
      return () => { alive = false }
    }
    getKnowledge(unitId, ru)
      .then((kk) => { if (alive) { setK(kk); setLoading(false) } })
      .catch((e) => { if (alive) { setError(String((e && e.message) || e)); setLoading(false) } })
    return () => { alive = false }
  }, [s && s.ru, unitId, activeIdx])

  // 当前块内词的注解（AI words 过滤块内词；未命中用整句 words）
  const kWords = useMemo(() => {
    if (!k || !Array.isArray(k.words) || k.words.length === 0) return null
    const filtered = k.words.filter((w) =>
      blockWords.some((bw) => bw.toLowerCase() === (w.word || '').toLowerCase())
    )
    return filtered.length ? filtered : k.words
  }, [k, item])

  const displayWords = kWords

  // 左栏块的 AI 中文副标题（块内词中文拼接；缓存有 AI 词条才显示）
  const chunkSubZh = (it) => {
    const cw = cacheMap[it.sentence.ru]
    if (!cw || !Array.isArray(cw.words) || cw.words.length === 0) return ''
    const ws = (it.text || '').match(/[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)?/g) || []
    const zhs = ws.map((w) => {
      const hit = cw.words.find((x) => (x.word || '').toLowerCase() === w.toLowerCase())
      return hit ? hit.chinese : ''
    }).filter(Boolean)
    return zhs.join(' ')
  }

  // 块中文（渐进块 = 块内词中文拼接；完整句 = 句翻译）
  const blockZh = useMemo(() => {
    if (!item) return ''
    if (isFinal) return s?.zh || ''
    if (displayWords) {
      const zh = displayWords.map((w) => w.chinese || w.word).filter(Boolean).join(' ')
      return zh
    }
    return ''
  }, [item, isFinal, s, displayWords])

  const retry = () => {
    if (!s) return
    setLoading(true)
    setError('')
    getKnowledge(unitId, s.ru)
      .then((kk) => { setK(kk); setLoading(false) })
      .catch((e) => { setError(String((e && e.message) || e)); setLoading(false) })
  }

  // 句子播放
  const speakSentence = () => { if (item) playTTS(item.text) }
  const speakWord = (w) => { if (w) playTTS(w.word) }

  // 样式常量（俄语学习主题：紫色强调）
  const card = 'rounded-xl border border-gray-200 bg-white p-4 space-y-3'
  const h4 = 'text-xs font-semibold text-gray-400 uppercase tracking-wider'
  const pill = (cls) => `rounded-full px-2 py-0.5 text-xs font-medium ${cls}`

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/45"
      style={{ zIndex: 110, padding: 24 }}
      onClick={onClose}
    >
      <div
        role="dialog"
        data-state="open"
        className="relative flex flex-col overflow-hidden rounded-[22px] bg-white text-sm shadow-2xl"
        style={{ width: 'calc(100vw - 2rem)', maxWidth: 1024, height: '85vh', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 页眉 */}
        <div className="flex flex-col gap-y-1 px-5 pt-4 pb-2 text-left shrink-0">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900">{title || '学习内容'}</h2>
          <p className="text-xs text-gray-400">查看课程中每个句子的详细学习内容和知识点</p>
        </div>

        {/* 主体：左右分栏 */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 divide-x divide-gray-100">
            {/* 左栏：chunking 渐进块列表（始终显示，仅极窄手机隐藏） */}
            <div className="block w-[300px] lg:w-[350px] shrink-0 overflow-y-auto p-3 space-y-1.5 bg-gray-50/60 max-[479px]:hidden">
              {chunkItems.length === 0 && (
                <p className="p-4 text-center text-xs text-gray-400">暂无句子</p>
              )}
              {chunkItems.map((it, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={
                    'group relative flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all select-none cursor-pointer w-full ' +
                    (i === activeIdx
                      ? 'border-purple-400 bg-purple-50 text-purple-700 font-medium shadow-sm'
                      : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/40 text-gray-800')
                  }
                >
                  <span className="font-mono text-xs text-gray-400 pt-0.5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs sm:text-sm leading-relaxed line-clamp-2">{it.text}</span>
                    {(() => {
                      const z = chunkSubZh(it)
                      return z ? <span className="block truncate text-[11px] text-gray-400">{z}</span> : null
                    })()}
                  </span>
                </button>
              ))}
            </div>

            {/* 右栏：知识点解析 */}
            <div className="flex-1 min-w-0 h-full overflow-y-auto bg-white">
              <div className="h-full overflow-y-auto p-5 sm:p-6 space-y-5">
                {!item ? (
                  <p className="pt-16 text-center text-sm text-gray-400">选择左侧句子查看知识点解析</p>
                ) : (
                  <>
                    {/* 顶部行：知识点解析 + 练习此句 */}
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button className="flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 md:hidden" onClick={() => {}}>
                          <span className="text-base">←</span>
                        </button>
                        <h3 className="text-sm font-semibold text-gray-900">知识点解析</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onPractice && onPractice(s)}
                          className="inline-flex h-7 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-purple-50 hover:text-purple-600 active:scale-95 cursor-pointer"
                        >
                          练习此句
                        </button>
                      </div>
                    </div>

                    {/* 主句卡片 */}
                    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-base font-medium text-gray-900 leading-relaxed font-serif">{item.text}</p>
                        <button
                          onClick={speakSentence}
                          title="播放句子发音"
                          className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                        >
                          🔊
                        </button>
                      </div>
                    </div>

                    {/* 中文翻译 */}
                    <div className={card}>
                      <h4 className={h4}>中文翻译</h4>
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {blockZh || (loading ? 'AI 生成中…' : s?.zh || '—')}
                      </p>
                    </div>

                    {/* 俄语释义（选中完整句→整句释义；选中单词块→该词的俄语释义） */}
                    <div className={card}>
                      <h4 className={h4}>俄语释义</h4>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {loading && !k ? (
                          'AI 生成中…'
                        ) : isFinal ? (
                          (k?.ru_def || '暂无')
                        ) : (() => {
                          const defs = blockWords.map((bw) => {
                            const hit = (k?.words || []).find((x) => (x.word || '').toLowerCase() === bw.toLowerCase())
                            return hit && hit.ru_def ? hit.ru_def : ''
                          }).filter(Boolean)
                          return defs.length ? defs.join('；') : (k ? '暂无' : 'AI 生成中…')
                        })()}
                      </p>
                    </div>

                    {/* 单词短语注解（全 AI 生成） */}
                    <div className={card}>
                      <h4 className={h4}>单词短语注解</h4>
                      {loading && !displayWords ? (
                        <p className="text-xs text-gray-400">AI 正在生成词条注解…</p>
                      ) : (displayWords || []).length === 0 ? (
                        <p className="text-xs text-gray-400">{error ? '生成失败，请重试' : '暂无词条'}</p>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {(displayWords || []).map((w, wi) => (
                            <div key={wi} className="py-3 first:pt-0 last:pb-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{w.stress || w.word}</span>
                                  <button
                                    onClick={() => speakWord(w)}
                                    title="播放发音"
                                    className="flex items-center justify-center rounded p-1 text-gray-400 transition-colors hover:text-purple-600"
                                  >
                                    🔊
                                  </button>
                                  <span className="text-sm text-gray-500">{w.chinese || ''}</span>
                                </div>
                                <span className="text-sm text-purple-600">{w.pos || '—'}</span>
                              </div>
                              {((w.basic && w.basic !== w.chinese) || w.context) && (
                                <div className="mt-2 space-y-2">
                                  {w.basic && <p className="text-sm text-gray-700"><span className="font-medium">基本含义：</span>{w.basic}</p>}
                                  {w.context && <p className="text-sm text-gray-700"><span className="font-medium">上下文含义：</span>{w.context}</p>}
                                </div>
                              )}
                              {(w.synonyms?.length > 0 || w.antonyms?.length > 0) && (
                                <div className="mt-2 flex flex-wrap gap-4">
                                  {w.synonyms?.length > 0 && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-700">同义词：</span>
                                      <div className="flex flex-wrap gap-1">
                                        {w.synonyms.map((x, xi) => (
                                          <span key={xi} className={pill('bg-green-100 text-green-700')}>{x}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {w.antonyms?.length > 0 && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-700">反义词：</span>
                                      <div className="flex flex-wrap gap-1">
                                        {w.antonyms.map((x, xi) => (
                                          <span key={xi} className={pill('bg-red-100 text-red-700')}>{x}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              {w.phrases?.length > 0 && (
                                <div className="mt-2">
                                  <span className="text-sm font-medium text-gray-700">常用短语：</span>
                                  <div className="mt-1 flex flex-wrap gap-2">
                                    {w.phrases.map((x, xi) => (
                                      <span key={xi} className={pill('bg-gray-100 text-gray-700')}>{x}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(w.example || w.memory) && (
                                <div className="mt-2 space-y-2">
                                  {w.example && <p className="text-sm text-gray-700"><span className="font-medium">例句：</span>{w.example}</p>}
                                  {w.memory && <p className="text-sm text-gray-700"><span className="font-medium">记忆技巧：</span>{w.memory}</p>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 语法分析 */}
                    <div className={card}>
                      <h4 className={h4}>语法分析</h4>
                      {loading && !k ? (
                        <p className="text-xs text-gray-400">正在生成语法解析…</p>
                      ) : k?.grammar ? (
                        <div className="space-y-4">
                          {(k.grammar.word_explains || []).length > 0 && (
                            <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
                              {(k.grammar.word_explains || []).map((x, xi) => (
                                <div key={xi} className={xi > 0 ? 'mt-3' : ''}>
                                  <div className="mb-2">
                                    <div className="rounded-lg bg-purple-50 p-3">
                                      <span className="text-base font-medium text-purple-700">{x.word}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <span className="mt-0.5 flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">翻译</span>
                                    <div className="text-sm text-gray-700">{x.translation}</div>
                                  </div>
                                  <div className="mt-2 flex items-start gap-2">
                                    <span className="mt-0.5 flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">解释</span>
                                    <div className="text-sm text-gray-800">{x.explanation}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="rounded-lg bg-gray-50/80 p-4">
                            <div className="grid gap-5 md:grid-cols-2">
                              {[
                                ['句型', k.grammar.pattern],
                                ['时态语气', k.grammar.tense],
                                ['重点语法', k.grammar.key],
                                ['常见错误', k.grammar.mistakes],
                                ['词序', k.grammar.order],
                                ['语法规则应用', k.grammar.rules],
                              ].map(([lab, val]) => (
                                <div key={lab}>
                                  <h5 className="mb-2 text-sm font-medium text-gray-900">{lab}</h5>
                                  <p className="text-sm whitespace-pre-line text-gray-700">{val || '—'}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">{error ? '生成失败' : '暂无'}</p>
                      )}
                    </div>

                    {/* 文化与实用知识 */}
                    <div className={card}>
                      <h4 className={h4}>文化与实用知识</h4>
                      {loading && !k ? (
                        <p className="text-xs text-gray-400">正在生成…</p>
                      ) : k?.culture ? (
                        <div className="space-y-3">
                          {[
                            ['文化元素', k.culture.elements],
                            ['实际应用', k.culture.usage],
                            ['背景信息', k.culture.background],
                          ].map(([lab, val]) => (
                            <div key={lab} className="rounded-lg bg-gray-50/80 p-4">
                              <h5 className="mb-2 text-sm font-medium text-gray-900">{lab}</h5>
                              <p className="text-sm whitespace-pre-line text-gray-700">{val || '—'}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">{error ? '生成失败' : '暂无'}</p>
                      )}
                    </div>

                    {/* 功能和使用场景 */}
                    <div className={card}>
                      <h4 className={h4}>功能和使用场景</h4>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {loading && !k ? '正在生成…' : (k?.function || '暂无')}
                      </p>
                    </div>

                    {/* 相关例句 */}
                    <div className={card}>
                      <h4 className={h4}>相关例句</h4>
                      {loading && !k ? (
                        <p className="text-xs text-gray-400">正在生成…</p>
                      ) : (k?.examples || []).length > 0 ? (
                        <div className="space-y-3">
                          {k.examples.map((e, ei) => (
                            <div key={ei} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                              <p className="font-medium text-gray-900">{e.ru}</p>
                              <p className="mt-1 text-sm text-gray-500">{e.zh}</p>
                              {e.note && <p className="mt-1 text-sm text-gray-700">{e.note}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">{error ? '生成失败' : '暂无'}</p>
                      )}
                    </div>

                    {/* 加载失败重试 */}
                    {error && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
                        <p className="text-xs text-red-500">AI 生成失败：{error}</p>
                        <button
                          onClick={retry}
                          className="mt-2 inline-flex h-7 items-center rounded-lg bg-purple-600 px-3 text-xs font-medium text-white hover:bg-purple-700 cursor-pointer"
                        >
                          重试生成
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 关闭 */}
        <button
          onClick={onClose}
          title="关闭"
          className="absolute right-4 top-3 flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          style={{ zIndex: 2 }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
