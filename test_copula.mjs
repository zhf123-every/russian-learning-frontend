// 测试判断句检测和链切换
import { buildCoreChainIntent } from './src/lib/jlTableEngine.js'

// 测试句子
const tests = [
  { ru: 'Это мама и папа.', tokens: ['Это', 'мама', 'и', 'папа'], expectCopula: true },
  { ru: 'Я очень хорошо знаю Анну.', tokens: ['Я', 'очень', 'хорошо', 'знаю', 'Анну'], expectCopula: false },
  { ru: 'Анна и Иван дома.', tokens: ['Анна', 'и', 'Иван', 'дома'], expectCopula: true },
  { ru: 'Да, Анна дома.', tokens: ['Да', 'Анна', 'дома'], expectCopula: true },
]

const pool = {
  negation: [{ru:'не',zh:'不'}],
  time: [{ru:'сегодня',zh:'今天'},{ru:'завтра',zh:'明天'}],
  predicates: [{ru:'знаю',zh:'知道'},{ru:'хочу',zh:'想'}],
  objects: [{ru:'маму',zh:'妈妈'},{ru:'папу',zh:'爸爸'}],
  evaluation: [{ru:'хорошо',zh:'好'}],
  degree: [{ru:'очень',zh:'非常'}],
  preposition: [{ru:'у',zh:'在'}],
  connector: [{ru:'и',zh:'和'}],
  place: [{ru:'здесь',zh:'这里'},{ru:'дома',zh:'在家'}],
}

console.log('='.repeat(60))
console.log('核心句链测试 - 判断句跳过换谓语/换宾语')
console.log('='.repeat(60))

for (const t of tests) {
  const intents = buildCoreChainIntent({
    sentence: t.ru, tokens: t.tokens, pool, zh: '',
    difficulty: 'easy', chainIndex: 0, poolSeed: 'test'
  })
  const sections = [...new Set(intents.map(i => i.groupId))]
  const hasInfinitive = intents.some(i => i.template === 'object_pos')
  const hasPredicateSwap = intents.some(i => i.template === 'predicate_pos')
  console.log(`\n${t.ru}`)
  console.log(`  总行数: ${intents.length}`)
  console.log(`  组数: ${sections.join(', ')}`)
  console.log(`  含换宾语(object_pos): ${hasInfinitive}`)
  console.log(`  含换谓语(predicate_pos): ${hasPredicateSwap}`)
  if (t.expectCopula) {
    console.log(`  ✅ 判断句 - 应无换谓语/换宾语: ${!hasInfinitive && !hasPredicateSwap ? '正确' : '错误!'}`)
  } else {
    console.log(`  ✅ 动词句 - 应有换谓语/换宾语: ${hasInfinitive && hasPredicateSwap ? '正确' : '错误!'}`)
  }
}
