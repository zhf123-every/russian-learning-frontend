function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// 检测是否是表格分隔行（|---|---|）
function isTableSeparator(line) {
  return /^\s*\|?[\s:|-]+\|[\s:|-]+\|?\s*$/.test(line) && line.includes('---')
}

// 检测是否是表格行（包含|且不是分隔行）
function isTableRow(line) {
  const trimmed = line.trim()
  return trimmed.startsWith('|') && trimmed.endsWith('|') && !isTableSeparator(trimmed)
}

// 解析表格行，返回单元格数组
function parseTableRow(line) {
  let trimmed = line.trim()
  // 去掉首尾的|
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1)
  return trimmed.split('|').map(cell => cell.trim())
}

// 简易、安全的 markdown → HTML（AI 解析结果用）。
// 支持：标题（# / ## / ###）、代码块（``` ... ```）、**加粗**、行内 `code`、列表（- 或 *）、有序列表（1. 2.）、引用（>）、表格（| ... |）
export function mdToHtml(md) {
  if (md == null) return ''
  const src = String(md).split('\n')
  const out = []
  let inCodeBlock = false
  let codeBuffer = []
  let tableBuffer = [] // 表格行缓存

  const flushTable = () => {
    if (tableBuffer.length < 2) {
      // 不是有效表格，按普通文本输出
      tableBuffer.forEach(line => out.push(formatInline(escapeHtml(line))))
      tableBuffer = []
      return
    }
    // 第一行是表头，第二行是分隔行，后面是数据行
    const headerCells = parseTableRow(tableBuffer[0])
    const dataRows = tableBuffer.slice(2).map(parseTableRow)
    let html = '<div class="md-table-wrapper"><table class="md-table">'
    html += '<thead><tr>'
    headerCells.forEach(cell => {
      html += `<th>${formatInline(escapeHtml(cell))}</th>`
    })
    html += '</tr></thead><tbody>'
    dataRows.forEach(row => {
      html += '<tr>'
      row.forEach(cell => {
        html += `<td>${formatInline(escapeHtml(cell))}</td>`
      })
      html += '</tr>'
    })
    html += '</tbody></table></div>'
    out.push(html)
    tableBuffer = []
  }

  for (let i = 0; i < src.length; i++) {
    const raw = src[i]
    const trimmed = raw.trim()

    // 代码块开始/结束
    if (trimmed.startsWith('```')) {
      if (tableBuffer.length) flushTable()
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBuffer = []
      } else {
        out.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`)
        inCodeBlock = false
        codeBuffer = []
      }
      continue
    }
    if (inCodeBlock) {
      codeBuffer.push(raw)
      continue
    }

    // 表格处理
    if (isTableRow(trimmed)) {
      tableBuffer.push(trimmed)
      continue
    } else if (isTableSeparator(trimmed) && tableBuffer.length === 1) {
      tableBuffer.push(trimmed)
      continue
    } else if (tableBuffer.length) {
      flushTable()
    }

    // 空行
    if (trimmed === '') {
      out.push('')
      continue
    }

    // 标题
    if (/^###\s/.test(trimmed)) {
      out.push(`<h3>${formatInline(escapeHtml(trimmed.slice(4)))}</h3>`)
      continue
    }
    if (/^##\s/.test(trimmed)) {
      out.push(`<h2>${formatInline(escapeHtml(trimmed.slice(3)))}</h2>`)
      continue
    }
    if (/^#\s/.test(trimmed)) {
      out.push(`<h1>${formatInline(escapeHtml(trimmed.slice(2)))}</h1>`)
      continue
    }

    // 引用
    if (/^>\s/.test(trimmed)) {
      out.push(`<blockquote>${formatInline(escapeHtml(trimmed.slice(2)))}</blockquote>`)
      continue
    }

    // 有序列表
    if (/^\d+\.\s/.test(trimmed)) {
      out.push(`<ol><li>${formatInline(escapeHtml(trimmed.replace(/^\d+\.\s/, '')))}</li></ol>`)
      continue
    }

    // 无序列表（含缩进嵌套）
    const indentMatch = raw.match(/^(\s*)[-*]\s(.+)$/)
    if (indentMatch) {
      const indent = indentMatch[1].length
      const content = formatInline(escapeHtml(indentMatch[2]))
      const style = indent ? ` style="margin-left:${indent * 2}em"` : ''
      out.push(`<ul><li${style}>${content}</li></ul>`)
      continue
    }

    // 普通文本
    out.push(formatInline(escapeHtml(raw)))
  }

  // 行尾漏闭合的代码块也输出
  if (inCodeBlock && codeBuffer.length) {
    out.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`)
  }
  // 行尾漏闭合的表格也输出
  if (tableBuffer.length) flushTable()

  return out.join('<br>')
}

// 内联格式化：代码、加粗、斜体
function formatInline(s) {
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  s = s.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<i>$2</i>$3')
  return s
}
