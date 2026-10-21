// 定时上架/下架逻辑自测（node 直跑纯函数）
import { isCourseVisible, courseStatus, tsToLocalInput, localInputToTs } from './src/utils/courseSchedule.js'
let ok = 0, fail = 0
const check = (name, cond) => { if (cond) { ok++; console.log('  ✓', name) } else { fail++; console.log('  ✗', name) } }

const now = Date.parse('2026-10-04T12:00:00')
check('无字段 published 可见', isCourseVisible({ status: 'published' }, now) === true)
check('无字段旧数据(null) 可见', isCourseVisible({ status: null }, now) === true)
check('无 status 可见', isCourseVisible({ id: 'x' }, now) === true)
check('draft 不可见', isCourseVisible({ status: 'draft' }, now) === false)

const futurePub = now + 3600e3
const pastUnpub = now - 3600e3
check('定时上架未到 → 不可见', isCourseVisible({ status: 'published', scheduledPublishAt: futurePub }, now) === false)
check('定时上架已到 → 可见', isCourseVisible({ status: 'published', scheduledPublishAt: now - 1 }, now) === true)
check('已下架 → 不可见', isCourseVisible({ status: 'published', scheduledUnpublishAt: pastUnpub }, now) === false)
check('未到下架 → 可见', isCourseVisible({ status: 'published', scheduledUnpublishAt: futurePub }, now) === true)
check('上架+下架窗口内 → 可见', isCourseVisible({ status: 'published', scheduledPublishAt: now - 1, scheduledUnpublishAt: futurePub }, now) === true)
check('下架早于上架 → 不可见', isCourseVisible({ status: 'published', scheduledPublishAt: now - 1, scheduledUnpublishAt: now - 1 }, now) === false)

check('status scheduled', courseStatus({ status: 'published', scheduledPublishAt: futurePub }, now) === 'scheduled')
check('status expired', courseStatus({ status: 'published', scheduledUnpublishAt: pastUnpub }, now) === 'expired')
check('status published', courseStatus({ status: 'published' }, now) === 'published')
check('status draft', courseStatus({ status: 'draft' }, now) === 'draft')

const str = tsToLocalInput(now)
check('ts→datetime-local 往返', localInputToTs(str) === now, String(str))
check('空字符串→undefined', localInputToTs('') === undefined)
check('非法→undefined', localInputToTs('abc') === undefined)
check('无效 ts→空串', tsToLocalInput(0) === '')

console.log('== 结果: %d 通过 / %d 失败 ==', ok, fail)
process.exit(fail ? 1 : 0)
