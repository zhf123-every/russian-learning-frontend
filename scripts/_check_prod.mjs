const r = await fetch('https://russian-learning-frontend.pages.dev/')
const h = await r.text()
const ms = [...h.matchAll(/src="([^"]+\.js)"/g)]
const paths = ms.map(m => m[1])
console.log('scripts=' + JSON.stringify(paths))
if (!paths.length) { console.log('NO_JS'); process.exit(1) }
const main = paths.find(p => p.includes('index-')) || paths[0]
const url = main.startsWith('http') ? main : ('https://russian-learning-frontend.pages.dev' + main)
const b = await (await fetch(url)).text()
const i = b.indexOf('table-fill')
console.log('main=' + main, 'len=' + b.length, 'has_table_fill=' + (i >= 0))
// 修复特征：aiFillTable 里 typeof res.json === 'function' 兼容（minify 后可能形如 "function"==typeof e.json 或 res.json&&）
const j = b.indexOf('.json()')
console.log('has_json_call=' + (j >= 0))
// 找 table-fill 周边 300 字符
if (i >= 0) console.log('ctx=' + b.slice(Math.max(0, i - 150), i + 250).replace(/\n/g, ' '))
