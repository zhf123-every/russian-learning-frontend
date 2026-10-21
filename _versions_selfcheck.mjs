// 版本管理逻辑自测（node 直跑；先 polyfill localStorage）
const store = {}
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v) },
  removeItem: (k) => { delete store[k] },
}

const { saveCourseVersion, listCourseVersions, getCourseVersion, clearCourseVersions, rollbackCourse } = await import('./src/utils/courseVersions.js')
const { saveCourses, getCourses } = await import('./src/utils/storage.js')
let ok = 0, fail = 0
const check = (name, cond, extra = '') => { if (cond) { ok++; console.log('  ✓', name) } else { fail++; console.log('  ✗', name, extra) } }

const mk = (units) => ({ id: 'c1', title: '测试课', status: 'published', units })

// 0) 先往课程库写入初始课程（回滚依赖）
saveCourses([mk([{ id: 'u0', title: '初始课' }])])
check('课程库已写入', getCourses().length === 1)

// 1) 首次保存 → 1 个版本
check('首次保存生成版本', saveCourseVersion(mk([{ id: 'u1', title: '第一课', sentences: [{ ru: 'Я читаю', zh: '我读' }] }]), '课时内容保存') === true)

// 2) 相同内容不重复存
const same = mk([{ id: 'u1', title: '第一课', sentences: [{ ru: 'Я читаю', zh: '我读' }] }])
check('相同内容不重复存', saveCourseVersion(same, '课时内容保存') === false)

// 3) 内容变化 → 新版本
const v2 = mk([{ id: 'u1', title: '第一课', sentences: [{ ru: 'Я читаю книгу', zh: '我读书' }] }, { id: 'u2', title: '第二课' }])
check('内容变化生成新版本', saveCourseVersion(v2, '课时内容保存') === true)

// 4) 列表 2 条，新在前
const list = listCourseVersions('c1')
check('列表 2 条', list.length === 2)
check('新版本在前', list[0].unitCount === 2 && list[1].unitCount === 1)
check('列表不含 units 大字段', list.every(v => !('units' in v)))

// 5) 回滚到旧版（1 课时）
const ver = getCourseVersion('c1', list[1].ts)
check('取旧版成功', ver && ver.units.length === 1)
const rolled = rollbackCourse('c1', list[1].ts)
check('回滚成功', rolled && rolled.units.length === 1 && rolled.units[0].title === '第一课')
check('回滚后 lessons 同步', rolled.lessons === 1)
// 回滚本身也留版本 → 现在 3 条
check('回滚留痕', listCourseVersions('c1').length === 3)
check('回滚后可再回滚', rollbackCourse('c1', listCourseVersions('c1')[1].ts).units.length === 2)

// 6) 上限 20
for (let i = 0; i < 30; i++) {
  saveCourseVersion(mk([{ id: 'u' + i, title: '课' + i, n: i }]), '批量' + i)
}
check('截断上限 20', listCourseVersions('c1').length === 20)

// 7) 清理
clearCourseVersions('c1')
check('删除课程清版本', listCourseVersions('c1').length === 0)
check('不存在课程回滚返回 null', rollbackCourse('nope', 123) === null)

console.log('== 结果: %d 通过 / %d 失败 ==', ok, fail)
process.exit(fail ? 1 : 0)
