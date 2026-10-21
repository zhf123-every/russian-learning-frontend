import { buildCoreChainIntent } from '../src/lib/jlTableEngine.js'
import { DEFAULT_SLOT_POOL } from '../src/lib/slotTablesTrigger.js'
const pool = DEFAULT_SLOT_POOL
for (const d of ['easy', 'medium', 'hard']) {
  const ins = buildCoreChainIntent({ sentence: 'Я люблю читать книгу', tokens: ['Я', 'люблю', 'читать', 'книгу'], pool, zh: '', difficulty: d })
  console.log('===', d, '总数', ins.length)
  for (const st of ins) {
    if (st.source === 'pool' || (st.groupId && ['G_06', 'G_07'].includes(st.groupId))) {
      console.log(' ', st.groupId, st.role || st.template, 'src=' + st.source, 'poolKey=' + (st.poolKey || ''), 'idx=' + (st.poolIndex ?? ''), st.hidden ? 'HIDDEN' : 'vis')
    }
  }
}
