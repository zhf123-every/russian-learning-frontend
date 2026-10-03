# -*- coding: utf-8 -*-
# P1 5c: 替换测试文件场景7 的两个用例（3句并发网络错误 / 12句分批并发上限）
import io

P = r'C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\tests\segmentEngine.test.js'
s = io.open(P, encoding='utf-8').read()

old1 = """  test('多句并发生成：全部完成后返回结果，失败句不阻塞队列', async () => {
    const post = makeHttpPost({
      '/api/admin/segments/llm-segment': { ok: true, segments: [{ indexes: [0, 1], type: 'phrase', chinese: '我爱' }, { indexes: [2], type: 'word', chinese: '书。' }], translation: '我爱书。' },
      '/api/admin/segments/save': { ok: true, saved: 3 },
    })
    const r = await generateUnitSegmentsAsync({
      courseId: 'c', unitId: 'u',
      sentences: [{ russian: S1, hash: sentenceHash(S1, 'easy') }, { russian: S2, hash: sentenceHash(S2, 'medium') }],
      difficulties: ['easy', 'medium'],
    }, { httpPost: post })
    assert.equal(r.results.length, 2)
    assert.ok(r.results.every((x) => x.ok))
  })"""

new1 = """  test('3 句并发，中间 1 句 httpPost 抛 Error(network) → done 2 / failed 1 / pending 0', async () => {
    const calls = []
    const post = async (path, body) => {
      calls.push({ path, body })
      if (path === '/api/admin/segments/llm-segment') {
        if (body.russian_text === 'СРЕДНЯЯ СТРОКА.') throw new Error('network')
        const n = body.tokens.length
        return { ok: true, segments: Array.from({ length: n }, (_, i) => ({ indexes: [i] })), translation: '（译文）' }
      }
      if (path === '/api/admin/segments/save') return { ok: true, saved: 1 }
      throw new Error('unknown path: ' + path)
    }
    const r = await generateUnitSegmentsAsync({
      courseId: 'c', unitId: 'u',
      sentences: [{ russian: 'Мой брат читает книгу.' }, { russian: 'СРЕДНЯЯ СТРОКА.' }, { russian: 'Девочка рисует дом.' }],
      difficulties: ['easy'],
    }, { httpPost: post })
    assert.equal(r.done.length, 2)
    assert.equal(r.failed.length, 1)
    assert.equal(r.failed[0].error, 'network')
    assert.equal(r.pending.length, 0)
    // 两成功句各自 save（status=ok）
    assert.equal(calls.filter((c) => c.path === '/api/admin/segments/save' && c.body.items[0].status === 'ok').length, 2)
  })"""

old2 = """  test('并发上限 ≤ 5（单句失败不阻塞，最多 5 个在途请求）', async () => {
    const inFlight = []
    let maxInFlight = 0
    const post = async () => {
      inFlight.push(1)
      maxInFlight = Math.max(maxInFlight, inFlight.length)
      await new Promise((r) => setTimeout(r, 20))
      inFlight.pop()
      return { ok: true, segments: [{ indexes: [0, 1, 2], type: 'sentence', chinese: '我爱书。' }], translation: '我爱书。' }
    }
    const sentences = Array.from({ length: 12 }, (_, i) => ({ russian: S1, hash: sentenceHash(S1 + i, 'easy') }))
    const r = await generateUnitSegmentsAsync({ courseId: 'c', unitId: 'u', sentences, difficulties: ['easy'] }, { httpPost: post })
    assert.ok(maxInFlight <= 5, `并发 ${maxInFlight} > 5`)
    assert.equal(r.results.length, 12)
  })"""

new2 = """  test('并发上限 ≤ 5（BATCH=3 分批，12 句全完成，单句失败不阻塞）', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const post = async (path, body) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 20))
      inFlight--
      if (path === '/api/admin/segments/llm-segment') {
        const n = body.tokens.length
        return { ok: true, segments: Array.from({ length: n }, (_, i) => ({ indexes: [i] })), translation: '（译文）' }
      }
      if (path === '/api/admin/segments/save') return { ok: true, saved: 1 }
      throw new Error('unknown path: ' + path)
    }
    const sentences = Array.from({ length: 12 }, (_, i) => ({ russian: `Урок номер ${i + 1}.` }))
    const r = await generateUnitSegmentsAsync({ courseId: 'c', unitId: 'u', sentences, difficulties: ['easy'] }, { httpPost: post })
    assert.ok(maxInFlight <= 5, `并发 ${maxInFlight} > 5`)
    assert.equal(r.done.length, 12)
    assert.equal(r.failed.length, 0)
    assert.equal(r.pending.length, 0)
  })"""

cnt = 0
for old, new in ((old1, new1), (old2, new2)):
    if old in s:
        s = s.replace(old, new, 1)
        cnt += 1
    else:
        print('NOT_FOUND: ' + old[:40])
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('REPLACED=%d' % cnt)
