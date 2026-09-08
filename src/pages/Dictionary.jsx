import { useState, useEffect } from 'react'
import { callAI } from '../lib/ai'
import { toast } from '../lib/toast'
import { mdToHtml } from '../lib/md'

const DICT_SYSTEM = '你是俄语词典专家。用户输入俄语单词，你需要给出：1. 单词原形和重音标注 2. 词性（名词/动词/形容词/副词/介词/连词/代词/感叹词）3. 中文释义（多个义项编号列出）4. 变格/变位（名词给出单复数各格变化，动词给出各人称变位，形容词给出性数格变化）5. 常用搭配和短语 6. 例句（2-3个俄语例句配中文翻译）。用简洁中文回答，适当用Markdown格式。如果输入的不是俄语单词或查不到，请明确告知。'

const GRAMMAR_SYSTEM = '你是俄语语法专家。用户输入俄语语法点名称，你需要给出：1. 语法点的定义和概述 2. 构成规则/变化规则（详细列出变化形式，用表格或列表）3. 用法说明（什么时候用、常见场景）4. 常见错误和注意事项 5. 例句（3-5个俄语例句配中文翻译）。用简洁中文回答，适当用Markdown格式。如果输入的不是俄语语法点或查不到，请明确告知。'

const HISTORY_KEYS = {
  dict: 'rlearn_dict_history',
  grammar: 'rlearn_grammar_history',
}

const TAB_META = {
  dict: { title: '📖 俄语词典', placeholder: '输入俄语单词，如：говорить', system: DICT_SYSTEM },
  grammar: { title: '📚 语法词典', placeholder: '输入语法点，如：名词第二格、动词过去时、形容词短尾', system: GRAMMAR_SYSTEM },
}

function loadHistory(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

function saveHistory(key, list) {
  localStorage.setItem(key, JSON.stringify(list))
}

export default function Dictionary() {
  const [activeTab, setActiveTab] = useState('dict')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultHtml, setResultHtml] = useState('')
  const [history, setHistory] = useState([])

  const meta = TAB_META[activeTab]
  const historyKey = HISTORY_KEYS[activeTab]

  // 切换 tab 时加载对应历史、清空输入和结果
  useEffect(() => {
    setHistory(loadHistory(historyKey))
    setQuery('')
    setResultHtml('')
    setLoading(false)
  }, [activeTab, historyKey])

  const handleSearch = async (word) => {
    const q = (word ?? query).trim()
    if (!q) {
      toast('请输入查询内容')
      return
    }
    if (loading) return
    setQuery(q)
    setLoading(true)
    setResultHtml('')
    try {
      const text = await callAI([
        { role: 'system', content: meta.system },
        { role: 'user', content: q },
      ])
      setResultHtml(mdToHtml(text))
      // 更新历史记录：去重、最新在前、最多10条
      const next = [q, ...history.filter(w => w !== q)].slice(0, 10)
      setHistory(next)
      saveHistory(historyKey, next)
    } catch (e) {
      toast(e.message || '查询失败')
    } finally {
      setLoading(false)
    }
  }

  const clearHistory = () => {
    setHistory([])
    saveHistory(historyKey, [])
  }

  const switchTab = (tab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
  }

  return (
    <div className="main" style={{ display: 'block', maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
      {/* 查询卡片 */}
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 14 }}>{meta.title}</div>

        {/* Tab 切换 */}
        <div className="row" style={{ marginBottom: 14 }}>
          <button
            className={'btn sm' + (activeTab === 'dict' ? ' primary' : '')}
            onClick={() => switchTab('dict')}
          >
            📖 俄语词典
          </button>
          <button
            className={'btn sm' + (activeTab === 'grammar' ? ' primary' : '')}
            onClick={() => switchTab('grammar')}
          >
            📚 语法词典
          </button>
        </div>

        {/* 输入框 + 查询按钮 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
            placeholder={meta.placeholder}
            style={{
              flex: 1,
              padding: '9px 14px',
              border: '1px solid var(--border2)',
              borderRadius: 12,
              fontSize: 15,
              fontFamily: 'inherit',
              background: '#fff',
              color: 'var(--text)',
              outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border2)' }}
          />
          <button
            className="btn sm primary"
            onClick={() => handleSearch()}
            disabled={loading}
            style={{ minWidth: 72 }}
          >
            {loading ? '查询中…' : '查询'}
          </button>
        </div>

        {/* 历史记录 */}
        {history.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 4 }}>最近查询：</span>
            {history.map(w => (
              <button
                key={w}
                className="btn sm"
                onClick={() => handleSearch(w)}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                {w}
              </button>
            ))}
            <button
              className="btn sm"
              onClick={clearHistory}
              style={{ padding: '4px 10px', fontSize: 12, color: 'var(--danger)', marginLeft: 'auto' }}
            >
              清除历史
            </button>
          </div>
        )}
      </div>

      {/* 结果卡片 */}
      {(loading || resultHtml) && (
        <div className="card" style={{ marginTop: 16 }}>
          {loading && (
            <div style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: 14 }}>正在查询，请稍候…</div>
          )}
          {!loading && resultHtml && (
            <div className="translation" dangerouslySetInnerHTML={{ __html: resultHtml }} />
          )}
        </div>
      )}
    </div>
  )
}
