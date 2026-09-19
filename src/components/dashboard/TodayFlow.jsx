import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVocabStore } from '../../store/vocabStore'
import { useSquareStore } from '../../store/squareStore'
import { useShangStore } from '../../store/shangStore'
import { isDue } from '../../lib/fsrs'
import { squareItems } from '../../data/squareLibrary'
import {
  STEP_IDS, loadDone, markStep, clearStep, effectiveDone,
  isAllDone, doneCount, bumpStreak,
} from '../../lib/todayFlow'

// 今日训练进度环
function ProgressRing({ value, total }) {
  const r = 25
  const c = 2 * Math.PI * r
  const pct = total ? value / total : 0
  return (
    <svg className="tf-ring" width="66" height="66" viewBox="0 0 66 66">
      <circle cx="33" cy="33" r={r} fill="none" stroke="#E9E9EE" strokeWidth="6" />
      <circle
        cx="33" cy="33" r={r} fill="none" stroke="#4F46E5" strokeWidth="6"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        transform="rotate(-90 33 33)"
      />
      <text x="33" y="39" textAnchor="middle" fontSize="15" fontWeight="800" fill="#18181B">
        {value}/{total}
      </text>
    </svg>
  )
}

// 今日训练流：热身复习 → 精听输入 → 闯关内化 → 口语输出
export default function TodayFlow({ pack, target, loading }) {
  const navigate = useNavigate()
  const [done, setDone] = useState(() => loadDone())

  // 真实数据：到期生词
  const cards = useVocabStore((s) => s.cards)
  const dueCount = useMemo(
    () => cards.filter((c) => isDue(c.fsrs, Date.now())).length,
    [cards],
  )

  // 真实数据：精听素材（服务端 + 本地 + 内置），优先推荐有字幕且未完成五步的
  const serverItems = useSquareStore((s) => s.serverItems)
  const userItems = useSquareStore((s) => s.userItems)
  const fetchServer = useSquareStore((s) => s.fetchServer)
  const progress = useShangStore((s) => s.progress)
  useEffect(() => { fetchServer() }, [fetchServer])

  const recListen = useMemo(() => {
    const seen = new Set()
    const all = []
    for (const x of [...serverItems, ...userItems, ...squareItems]) {
      if (!seen.has(x.id)) { seen.add(x.id); all.push(x) }
    }
    const withSubs = all.filter((it) => Array.isArray(it.sentences) && it.sentences.length > 0)
    return withSubs.find((it) => !progress[it.id]?.finished) || withSubs[0] || null
  }, [serverItems, userItems, progress])

  const packId = pack?.id || 'privet_rossiya_a1'
  const questTo = target
    ? `/quest-practice/${target.id}?pack=${encodeURIComponent(packId)}`
    : '/quest-store'

  const steps = [
    {
      id: 'review', icon: '📒', kicker: '热身', tone: 'amber',
      title: '复习到期生词',
      sub: dueCount > 0 ? `${dueCount} 个待复习 · SRS 间隔重复` : '生词已全部巩固，无需复习',
      to: '/vocab',
    },
    {
      id: 'listen', icon: '🎧', kicker: '输入', tone: 'brand',
      title: '五步精听一段',
      sub: recListen ? `推荐：${recListen.title}` : '去视频广场选一段真实俄语',
      to: recListen ? `/square/${recListen.id}` : '/square',
    },
    {
      id: 'quest', icon: '🎯', kicker: '内化', tone: 'brand',
      title: '闯关练当前课',
      sub: loading
        ? '正在准备你的课程…'
        : target ? `继续 ${target.title}${target.subtitle ? ' · ' + target.subtitle : ''}` : '句子闯关 · 中译俄 / 听写',
      to: questTo,
    },
    {
      id: 'speak', icon: '🗣️', kicker: '输出', tone: 'ok',
      title: 'AI 对话说 3 句',
      sub: '俄语外教实时纠错，把今天学的说出来',
      to: '/tutor',
    },
  ]

  // 复习步无到期生词时自动视为完成（真实，不写入）
  const eff = effectiveDone(done, { review: dueCount === 0 })
  const count = doneCount(eff)
  const all = isAllDone(eff)
  useEffect(() => {
    if (all) {
      bumpStreak()
      window.dispatchEvent(new Event('rlearn:flow-changed'))
    }
  }, [all])

  const firstUndone = STEP_IDS.find((id) => !eff[id])
  const firstStep = steps.find((s) => s.id === firstUndone)

  const go = (to) => navigate(to)
  const toggle = (e, id) => {
    e.stopPropagation()
    setDone(eff[id] ? clearStep(id) : markStep(id))
    window.dispatchEvent(new Event('rlearn:flow-changed'))
  }

  return (
    <section className="tf-card db-card">
      <div className="tf-head">
        <div>
          <div className="tf-title">今日训练</div>
          <div className="tf-sub">复习热身 → 精听输入 → 闯关内化 → 口语输出，约 15 分钟完成闭环</div>
        </div>
        <ProgressRing value={count} total={STEP_IDS.length} />
      </div>

      <div className="tf-list">
        {steps.map((s, i) => {
          const isDone = !!eff[s.id]
          return (
            <div
              key={s.id}
              className={'tf-step' + (isDone ? ' done' : '') + (i === steps.length - 1 ? ' last' : '')}
              onClick={() => go(s.to)}
            >
              <button
                type="button"
                className={'tf-check tf-' + s.tone + (isDone ? ' on' : '')}
                onClick={(e) => toggle(e, s.id)}
                aria-label={isDone ? '取消完成标记' : '标记为已完成'}
                title={isDone ? '取消完成' : '做完后点这里打卡'}
              >
                {isDone ? '✓' : s.icon}
              </button>
              <div className="tf-body">
                <span className={'tf-kicker k-' + s.tone}>{s.kicker}</span>
                <span className="tf-name">{s.title}</span>
                <span className="tf-desc">{s.sub}</span>
              </div>
              <div className="tf-right">
                {isDone
                  ? <span className="tf-done-tag">已完成</span>
                  : <span className="tf-go-btn">去完成 <b>→</b></span>}
              </div>
            </div>
          )
        })}
      </div>

      {all ? (
        <div className="tf-celebrate">
          <span>🎉 今日训练全部完成，连胜保持中！</span>
          <button className="tf-extra" onClick={() => go('/square')}>再精听一段 →</button>
        </div>
      ) : (
        <button className="tf-cta" onClick={() => firstStep && go(firstStep.to)}>
          {count === 0 ? '一键开始今日训练' : `继续训练 · ${firstStep ? firstStep.title : ''}`}
          <b>→</b>
        </button>
      )}
    </section>
  )
}
