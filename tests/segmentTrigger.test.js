// segmentTrigger.test.js —— P2-A：触发层（inFlight 防抖 / no_sentences / failed 写回与清除 / retry 补跑）
// mock 工具与契约：httpPost(path, body) 注入；storage 注入（node 无 localStorage）。
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  triggerUnitSegments,
  retryPendingSegments,
  readPendingSegments,
} from '../src/lib/segmentTrigger.js'
import { sentenceHash } from '../src/lib/segmentEngine.js'

function makeStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    _map: m,
  }
}

// 默认路由：llm-segment 按 body.tokens 全句一组（索引合法）；save 成功。
function makeHttpPost(overrides = {}, calls = []) {
  const routes = {
    '/api/admin/segments/llm-segment': (body) => ({
      ok: true,
      segments: [{ indexes: (body.tokens || []).map((_, i) => i) }],
      translation: '（译）',
    }),
    '/api/admin/segments/save': () => ({ ok: true, saved: 1 }),
    ...overrides,
  }
  return async (path, body) => {
    calls.push({ path, body })
    const fn = routes[path]
    if (fn) return fn(body)
    throw new Error('unknown path ' + path)
  }
}

function deferred() {
  let resolve, reject
  const p = new Promise((res, rej) => { resolve = res; reject = rej })
  return { p, resolve, reject }
}

describe('P2-A triggerUnitSegments', () => {
  test('无句子 → skipped=no_sentences，不调任何接口', async () => {
    const calls = []
    const post = makeHttpPost({}, calls)
    const r = await triggerUnitSegments({ courseId: 'c', unitId: 'u', sentences: [], deps: { httpPost: post, storage: makeStorage() } })
    assert.equal(r.skipped, 'no_sentences')
    assert.equal(calls.length, 0)
  })

  test('2 句 × 三档 → done=6，save 调用 6 次', async () => {
    const calls = []
    const post = makeHttpPost({}, calls)
    const storage = makeStorage()
    const r = await triggerUnitSegments({
      courseId: 'c', unitId: 'u',
      sentences: [{ ru: 'Я люблю книгу.' }, { russian: 'Она читает дома.' }],
      deps: { httpPost: post, storage },
    })
    assert.equal(r.done.length, 6)
    assert.equal(r.failed.length, 0)
    const saves = calls.filter((c) => c.path === '/api/admin/segments/save')
    assert.equal(saves.length, 6)
    assert.equal(readPendingSegments({ courseId: 'c', unitId: 'u' }, { storage }).length, 0)
  })

  test('inFlight 防抖：同页面内第二次触发立即 skipped=in_flight', async () => {
    const d = deferred()
    let first = true
    let pendingBody = null
    const post = async (path, body) => {
      if (path === '/api/admin/segments/llm-segment' && first) {
        first = false
        pendingBody = body
        return d.p
      }
      if (path === '/api/admin/segments/llm-segment') {
        return { ok: true, segments: [{ indexes: (body.tokens || []).map((_, i) => i) }], translation: '（译）' }
      }
      if (path === '/api/admin/segments/save') return { ok: true, saved: 1 }
      throw new Error('unknown path ' + path)
    }
    const storage = makeStorage()
    const args = { courseId: 'c', unitId: 'u', sentences: [{ ru: 'Мама читает газету.' }], deps: { httpPost: post, storage } }
    const p1 = triggerUnitSegments(args)
    const r2 = await triggerUnitSegments(args)
    assert.equal(r2.skipped, 'in_flight')
    d.resolve({ ok: true, segments: [{ indexes: pendingBody.tokens.map((_, i) => i) }], translation: '（译）' })
    const r1 = await p1
    assert.equal(r1.failed.length, 0)
    assert.equal(readPendingSegments({ courseId: 'c', unitId: 'u' }, { storage }).length, 0)
  })

  test('HTTP 失败（easy/medium）→ failed 写入 storage；恢复后重跑 → 全 done 且记录清除', async () => {
    let failMode = true
    const post = async (path, body) => {
      if (path === '/api/admin/segments/llm-segment') {
        if (failMode) throw Object.assign(new Error('network'), { status: 0 })
        return { ok: true, segments: [{ indexes: (body.tokens || []).map((_, i) => i) }], translation: '（译）' }
      }
      if (path === '/api/admin/segments/save') return { ok: true, saved: 1 }
      throw new Error('unknown path ' + path)
    }
    const storage = makeStorage()
    const args = { courseId: 'c', unitId: 'u', sentences: [{ ru: 'Он работает дома.' }], deps: { httpPost: post, storage } }
    const r1 = await triggerUnitSegments(args)
    // hard 档不调 LLM（直构）→ done；easy/medium 网络失败 → failed=2
    assert.equal(r1.failed.length, 2)
    assert.equal(r1.done.length, 1)
    const rec = readPendingSegments({ courseId: 'c', unitId: 'u' }, { storage })
    assert.equal(rec.length, 2)
    assert.ok(rec.every((p) => p.difficulty === 'easy' || p.difficulty === 'medium'))
    // 恢复网络 → 整课时重跑 → 全部 done，记录清除
    failMode = false
    const r2 = await triggerUnitSegments(args)
    assert.equal(r2.failed.length, 0)
    assert.equal(r2.done.length, 3)
    assert.equal(readPendingSegments({ courseId: 'c', unitId: 'u' }, { storage }).length, 0)
  })

  test('retryPendingSegments：无记录 skipped=no_pending；有记录自动整课时重跑', async () => {
    const calls = []
    const storage = makeStorage()
    const post = makeHttpPost({}, calls)
    const r0 = await retryPendingSegments({ courseId: 'c', unitId: 'u', sentences: [{ ru: 'Мы учимся вместе.' }], deps: { httpPost: post, storage } })
    assert.equal(r0.skipped, 'no_pending')
    assert.equal(calls.length, 0)
    // 手动种一条失败记录（真实句子的 hash，模拟上次关页前失败）
    const realHash = sentenceHash('Мы учимся вместе.', 'easy')
    storage.setItem('rb_pending_segments', JSON.stringify({ 'c::u': [{ sentenceHash: realHash, difficulty: 'easy', error: 'network', at: Date.now() }] }))
    const r1 = await retryPendingSegments({ courseId: 'c', unitId: 'u', sentences: [{ ru: 'Мы учимся вместе.' }], deps: { httpPost: post, storage } })
    assert.equal(r1.skipped, undefined)
    assert.equal(r1.done.length, 3)
    assert.ok(calls.some((c) => c.path === '/api/admin/segments/llm-segment'))
    assert.equal(readPendingSegments({ courseId: 'c', unitId: 'u' }, { storage }).length, 0)
  })
})
