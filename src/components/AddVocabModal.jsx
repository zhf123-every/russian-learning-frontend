import { useState } from 'react'
import { useVocabStore } from '../store/vocabStore'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { toast } from '../lib/toast'

export default function AddVocabModal({ onClose }) {
  const navigate = useNavigate()
  const addVocab = useVocabStore(s => s.add)

  const [word, setWord] = useState('')
  const [chinese, setChinese] = useState('')
  const [reading, setReading] = useState('')
  const [pos, setPos] = useState('')
  const [file, setFile] = useState(null)
  const [autoLoading, setAutoLoading] = useState(false)

  // 自动获取单词释义
  const autoFetch = async () => {
    const w = word.trim()
    if (!w) {
      toast('请先输入俄语单词')
      return
    }
    setAutoLoading(true)
    try {
      const r = await apiFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: '你是俄语词典助手。请解析用户输入的俄语单词，返回JSON格式，包含以下字段：chinese（中文释义，多个释义用逗号分隔）、reading（读音/重音标注，如：сто́л）、pos（词性，如：名词、动词、形容词等）、lemma（原形/不定式）。只输出JSON，不要输出其他文字。'
            },
            { role: 'user', content: w }
          ]
        }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || '获取失败')
      // 解析 AI 返回的内容（可能是纯文本、markdown代码块或JSON）
      let content = (j.content || j.result || '').trim()

      // 1. 去除 markdown 代码块标记
      content = content.replace(/^```(?:json|JSON)?\s*/i, '').replace(/\s*```$/, '').trim()

      // 2. 尝试提取并解析 JSON
      let parsed = null
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0])
        } catch (e) {
          // JSON解析失败，尝试修复常见问题
          try {
            let fixed = jsonMatch[0]
            // 去除尾随逗号
            fixed = fixed.replace(/,\s*([}\]])/g, '$1')
            // 单引号转双引号
            fixed = fixed.replace(/'/g, '"')
            parsed = JSON.parse(fixed)
          } catch (e2) {
            parsed = null
          }
        }
      }

      // 3. 如果JSON解析成功，填充字段
      if (parsed && typeof parsed === 'object') {
        if (parsed.chinese) setChinese(String(parsed.chinese).trim())
        if (parsed.reading) setReading(String(parsed.reading).trim())
        if (parsed.pos) setPos(String(parsed.pos).trim())
        if (!parsed.chinese && parsed.translation) setChinese(String(parsed.translation).trim())
        if (!parsed.chinese && parsed.meaning) setChinese(String(parsed.meaning).trim())
        toast('已自动填充释义，请确认后加入生词本')
      } else {
        // 4. JSON解析失败，尝试用正则提取各个字段
        const chineseMatch = content.match(/"chinese"\s*:\s*"([^"]*)"/) || content.match(/中文[：:]\s*([^\n,，]+)/)
        const readingMatch = content.match(/"reading"\s*:\s*"([^"]*)"/) || content.match(/读音[：:]\s*([^\n,，]+)/)
        const posMatch = content.match(/"pos"\s*:\s*"([^"]*)"/) || content.match(/词性[：:]\s*([^\n,，]+)/)

        if (chineseMatch) setChinese(chineseMatch[1].trim())
        if (readingMatch) setReading(readingMatch[1].trim())
        if (posMatch) setPos(posMatch[1].trim())

        // 5. 如果还是提取不到，用清理后的内容作为中文释义
        if (!chineseMatch && content) {
          // 去除JSON结构，只保留文本
          const cleanText = content
            .replace(/\{[\s\S]*\}/g, '')
            .replace(/["']/g, '')
            .replace(/^[\s,，。.]+|[\s,，。.]+$/g, '')
            .trim()
          if (cleanText) setChinese(cleanText)
        }

        if (chineseMatch || readingMatch || posMatch) {
          toast('已自动填充释义（格式已修复），请确认后加入生词本')
        } else if (content) {
          toast('已获取释义')
        } else {
          toast('AI返回内容为空，请手动填写')
        }
      }
    } catch (e) {
      toast('自动获取失败：' + (e.message || '请手动填写'))
    } finally {
      setAutoLoading(false)
    }
  }

  const loadFromFile = (f) => {
    const r = new FileReader()
    r.onload = () => {
      const text = r.result
      const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'))
      const [first, ...rest] = lines
      if (first) {
        const [w, c] = first.split('\t').map(x => x.trim())
        if (w && c) {
          setWord(w)
          setChinese(c)
        }
      }
      if (rest.length > 0) {
        const content = rest.map(l => {
          const [w, c] = l.split('\t').map(x => x.trim())
          return w && c ? `**${w}** — ${c}` : ''
        }).join('\n')
        const blob = new Blob([content], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'vocab.md'
        a.click()
        URL.revokeObjectURL(url)
        toast('已导出 vocab.md，可替换内容后导入')
      }
    }
    r.readAsText(f)
  }

  const save = () => {
    if (!word.trim()) { toast('请输入俄语单词'); return }
    if (!chinese.trim()) { toast('请输入中文翻译（或点击自动获取）'); return }
    addVocab({ id: word.trim(), word: word.trim(), chinese: chinese.trim(), reading: reading.trim(), pos: pos.trim(), addedAt: Date.now() })
    toast('已加入生词本')
    navigate('/vocab')
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>加入生词</h2>
        <p className="hint">输入俄语单词后点击「自动获取释义」，AI 自动填充中文翻译、词性、读音，确认后加入生词本。</p>

        <div className="field">
          <label>俄语单词</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={word}
              onChange={e => setWord(e.target.value)}
              placeholder="例如：стол"
              style={{ flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') autoFetch() }}
            />
            <button
              className="btn sm"
              onClick={autoFetch}
              disabled={autoLoading || !word.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              {autoLoading ? '获取中...' : '自动获取释义'}
            </button>
          </div>
        </div>

        <div className="field">
          <label>中文翻译</label>
          <input value={chinese} onChange={e => setChinese(e.target.value)} placeholder="自动填充或手动输入，例如：桌子" />
        </div>

        <div className="field">
          <label>拼写/读音（可选）</label>
          <input value={reading} onChange={e => setReading(e.target.value)} placeholder="自动填充，例如：сто́л" />
        </div>

        <div className="field">
          <label>词性（可选）</label>
          <input value={pos} onChange={e => setPos(e.target.value)} placeholder="自动填充，例如：名词" />
        </div>

        <div className="field">
          <label>从文件导入（支持 TSV 格式）</label>
          <input type="file" accept=".txt,.tsv,.md" onChange={e => loadFromFile(e.target.files?.[0])} />
        </div>

        <div className="mfoot">
          <button className="btn" onClick={onClose}>关闭</button>
          <button className="btn primary" onClick={save}>加入生词本</button>
        </div>
      </div>
    </div>
  )
}
