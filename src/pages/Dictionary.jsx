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
  dict: { title: '📖 俄语词典', placeholder: '输入单个俄语单词，如：говорить', system: DICT_SYSTEM },
  grammar: { title: '📚 语法词典', placeholder: '输入语法点，如：名词第二格', system: GRAMMAR_SYSTEM },
}

// 常用语法点预设（A1-A2 级别核心语法，按分类组织）
const GRAMMAR_PRESETS = [
  {
    category: '名词变格',
    items: [
      { name: '名词第一格（主格）', desc: '主语形式，词典原形', example: 'Студент учится. — 学生在学习。' },
      { name: '名词第二格（属格）', desc: '表示所属、"没有"、数量', example: 'У меня нет книги. — 我没有书。' },
      { name: '名词第三格（与格）', desc: '表示给予对象、"……岁"', example: 'Я пишу другу письмо. — 我给朋友写信。' },
      { name: '名词第四格（宾格）', desc: '及物动词的直接宾语', example: 'Я читаю книгу. — 我读一本书。' },
      { name: '名词第五格（工具格）', desc: '表示工具、方式、"是……"', example: 'Я пишу ручкой. — 我用钢笔写字。' },
      { name: '名词第六格（前置格）', desc: '与 о/в/на 连用，表示"关于/在……里"', example: 'Я говорю о книге. — 我谈论一本书。' },
      { name: '名词复数', desc: '复数形式及各格变化', example: 'Студенты учатся. — 学生们在学习。' },
    ],
  },
  {
    category: '动词变位',
    items: [
      { name: '动词现在时', desc: '第一变位法和第二变位法', example: 'Я читаю книгу. — 我在读一本书。' },
      { name: '动词过去时', desc: '按性数变化，不分人称', example: 'Я читал книгу. — 我读了一本书。' },
      { name: '动词将来时', desc: 'быть + 不定式（复合）或完成体动词（简单）', example: 'Я буду читать книгу. — 我将读一本书。' },
      { name: '动词命令式', desc: '第二人称祈使形式', example: 'Читайте книгу! — 请读书！' },
      { name: '动词体（完成体/未完成体）', desc: '体的对立与用法选择', example: 'Я читал / прочитал книгу. — 我读了书。' },
    ],
  },
  {
    category: '形容词',
    items: [
      { name: '形容词性数格变化', desc: '与名词保持性数格一致', example: 'Новая книга интересная. — 新书很有趣。' },
      { name: '形容词长尾', desc: '作定语或谓语的完整形式', example: 'У меня есть интересная книга. — 我有一本有趣的书。' },
      { name: '形容词短尾', desc: '只作谓语，表特征/状态', example: 'Книга интересна. — 这本书很有趣。' },
      { name: '形容词比较级', desc: '表示"更……"，单一式/复合式', example: 'Эта книга интереснее той. — 这本书比那本有趣。' },
      { name: '形容词最高级', desc: '表示"最……"', example: 'Это самая интересная книга. — 这是最有趣的书。' },
    ],
  },
  {
    category: '代词',
    items: [
      { name: '人称代词', desc: 'я/ты/он/она/оно/мы/вы/они 及变格', example: 'Я люблю русский язык. — 我爱俄语。' },
      { name: '物主代词', desc: 'мой/твой/его/её/наш/ваш/их', example: 'Это моя книга. — 这是我的书。' },
      { name: '指示代词', desc: 'этот/тот 及性数格变化', example: 'Эта книга интересная. — 这本书很有趣。' },
      { name: '疑问代词', desc: 'кто/что/какой/чей/который', example: 'Какая это книга? — 这是什么书？' },
      { name: '限定代词', desc: 'весь/каждый/сам/самый', example: 'Каждый студент учится. — 每个学生都学习。' },
    ],
  },
  {
    category: '数词',
    items: [
      { name: '基数词', desc: 'один/два/три/… 及与名词连用规则', example: 'У меня две книги. — 我有两本书。' },
      { name: '序数词', desc: 'первый/второй/третий/…', example: 'Это первый урок. — 这是第一课。' },
      { name: '年龄表达', desc: 'Мне … лет / год / года', example: 'Мне двадцать лет. — 我二十岁。' },
      { name: '数量数词与名词搭配', desc: 'один+单数一格、два-три-четыре+单数二格、五以上+复数二格', example: 'Сколько у тебя книг? — 你有多少本书？' },
      { name: '集合数词', desc: 'двое/трое/четверо/… 与人称代词连用', example: 'Нас трое. — 我们三个人。' },
    ],
  },
  {
    category: '前置词',
    items: [
      { name: '前置词 в / на', desc: '表地点（六格）与方向（四格）', example: 'Я живу в Москве. Книга на столе. — 我住在莫斯科。书在桌上。' },
      { name: '前置词 с', desc: '表"和……一起"（五格）或"从……"（二格）', example: 'Я иду с другом. — 我和朋友一起走。' },
      { name: '前置词 по', desc: '表"沿着"（三格）或"在……方面"（三格）', example: 'Я иду по улице. — 我沿着街道走。' },
      { name: '前置词 о / об', desc: '表"关于"（六格）', example: 'Я думаю о доме. — 我想家。' },
      { name: '前置词 у', desc: '表"在……旁边"或"有"（二格）', example: 'У меня есть книга. — 我有一本书。' },
      { name: '前置词 для', desc: '表"为了……"（二格）', example: 'Это подарок для друга. — 这是给朋友的礼物。' },
    ],
  },
  {
    category: '句型与句式',
    items: [
      { name: '疑问句', desc: '语调疑问或疑问词开头', example: 'Ты читаешь книгу? — 你在读书吗？' },
      { name: '否定句', desc: 'не + 动词 / нет + 二格', example: 'Я не читаю эту книгу. — 我不读这本书。' },
      { name: '存在句', desc: 'есть / нет 表示"有/没有"', example: 'В комнате есть стол. — 房间里有一张桌子。' },
      { name: '无人称句', desc: '没有主语，谓语用无人称形式', example: 'Мне холодно. — 我冷。' },
      { name: '比较句', desc: 'чем + 一格 / 比较级 + 二格', example: 'Он выше меня. — 他比我高。' },
    ],
  },
  {
    category: '副词与其他',
    items: [
      { name: '副词', desc: '说明动作或特征，不变格', example: 'Он говорит по-русски хорошо. — 他俄语说得好。' },
      { name: '时间表达', desc: 'в + 四格 / на + 四格 / с … до …', example: 'Я встаю в семь часов. — 我七点起床。' },
      { name: '地点表达', desc: 'где / куда / откуда 与前置词搭配', example: 'Книга лежит на столе. — 书放在桌子上。' },
      { name: '原因表达', desc: 'потому что / из-за / благодаря', example: 'Он устал, потому что много работал. — 他累了，因为工作很多。' },
      { name: '目的表达', desc: 'чтобы / для + 二格 / за + 五格', example: 'Я иду в магазин за хлебом. — 我去商店买面包。' },
    ],
  },
]

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

    // 词典 tab：检测多词输入，区分句子与短语
    if (activeTab === 'dict') {
      const ruWords = q.split(/\s+/).filter(w => /[а-яёА-ЯЁ]/.test(w))
      const hasEndPunct = /[.!?。？！]/.test(q)
      if (ruWords.length > 3 || hasEndPunct) {
        toast('词典功能请输入单个单词。句子解析请使用学习页面的AI解析功能。')
        return
      }
      if (ruWords.length > 1) {
        toast('建议输入单个单词以获得更精准的释义')
        // 短语仍继续执行查询
      }
    }

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

        {/* 输入提示 */}
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
          {activeTab === 'dict'
            ? '💡 提示：请输入单个俄语单词，如：говорить、студент、большой。完整句子解析请前往学习页面使用AI解析。'
            : '💡 提示：输入语法点名称，如：名词第二格、动词过去时、形容词短尾。也可点击下方常用语法点直接查看。'}
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

      {/* 语法预设列表：仅 grammar tab 且无查询结果时显示 */}
      {activeTab === 'grammar' && !loading && !resultHtml && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 12, color: '#5C4A3A' }}>
            📚 常用语法点（点击直接查询）
          </div>
          {GRAMMAR_PRESETS.map(group => (
            <div key={group.category} className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10, color: 'var(--accent)' }}>
                {group.category}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 8,
              }}>
                {group.items.map(item => (
                  <div
                    key={item.name}
                    onClick={() => handleSearch(item.name)}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid var(--border2)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: '#FFFCF7',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.background = '#FBF6EC'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border2)'
                      e.currentTarget.style.background = '#FFFCF7'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{item.desc}</div>
                    <div style={{ fontSize: 11, color: '#7A6B5A', fontStyle: 'italic' }}>{item.example}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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
