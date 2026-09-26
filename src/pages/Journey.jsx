// 通关之路 · 俄语大陆 RPG 冒险页
// 路由：/journey（侧边栏「通关之路」入口）
// 世界观：学习时长=经验值(EXP) / 答题=打怪输出(每题+10 EXP) / 语法掌握=天赋树
// 全部数据真实来源：
//   · 打卡/在线/日均/连击  → rlearn_learning_stats + rlearn_quest_stats(dailyExp)
//   · 战利品/词汇卡/词组卡  → 云端课程数据（units.words / units.sentences 总量）
//   · 游戏数据/通关关卡    → 学习课程数 + rlearn_unit_done
//   · 巅峰战绩             → rlearn_quest_stats.peaks
//   · 经验获取曲线         → rlearn_quest_stats.dailyExp（按模式筛选）
//   · 变格天赋树           → rlearn_quest_stats.caseStats（六格答题正确率）
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageHeader } from '../components/layout/PageHeaderContext'
import { getCourseStats, fmtDuration } from '../lib/learningStats'
import { getUnitDoneMap } from '../lib/lessonProgress'
import { getPeaks, getDailyExp, getExpSummary, getStudyDays, getStreakDays, getCaseStats, getGlobalAccuracy } from '../lib/questStats'
import { apiFetch } from '../lib/api'

const LEARNING_KEY = 'rlearn_learning_stats'
const CLOUD_CACHE = 'rlearn_cloud_list_cache'

// ---------- 数据源：本地统计 ----------
function readLocalLearning() {
  try { return JSON.parse(localStorage.getItem(LEARNING_KEY) || '{}') } catch { return {} }
}
function loadCloudCourses() {
  try {
    const j = JSON.parse(localStorage.getItem(CLOUD_CACHE) || 'null')
    return Array.isArray(j) ? j : (Array.isArray(j && j.list) ? j.list : [])
  } catch { return [] }
}

function StatCard({ item }) {
  return (
    <div className="rpg-stat">
      <div className="stat-label">
        {item.label}
        {item.fire && <span className="fire"> 🔥</span>}
      </div>
      <div className="stat-value">
        {item.value}
        {item.unit && <span className="stat-unit">{item.unit}</span>}
      </div>
      {item.note && <div className="stat-note">{item.note}</div>}
    </div>
  )
}

function SectionHead({ emoji, title, sub, right }) {
  return (
    <div className="section-head">
      <h2 className="section-title">
        {emoji} {title}
      </h2>
      {sub && <p className="section-sub">{sub}</p>}
      {right}
    </div>
  )
}

// 六维战力雷达（动态：真实六格掌握度，≥80 金光 / <40 红色警告）
function RadarChart({ talents }) {
  const pts = [
    { key: '主格', cx: 130, cy: 15 },
    { key: '属格', cx: 226, cy: 72.5 },
    { key: '与格', cx: 226, cy: 187.5 },
    { key: '宾格', cx: 130, cy: 245 },
    { key: '工具格', cx: 34, cy: 187.5 },
    { key: '前置格', cx: 34, cy: 72.5 },
  ]
  const map = {}
  talents.forEach((t) => { map[t.name] = t.pct })
  const poly = pts.map((p) => {
    const v = map[p.key] || 0
    const cx = 130 + (p.cx - 130) * (v / 100)
    const cy = 130 + (p.cy - 130) * (v / 100)
    return { ...p, cx, cy, v }
  })
  return (
    <div className="radar-wrap">
      <svg viewBox="0 0 260 268" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <polygon points="130,15 226,72.5 226,187.5 130,245 34,187.5 34,72.5" fill="none" stroke="#e5e7eb" strokeWidth="1" />
        <polygon points="130,48 202,88 202,172 130,212 58,172 58,88" fill="none" stroke="#eee" strokeWidth="1" />
        <polygon points="130,81 178,103.5 178,156.5 130,179 82,156.5 82,103.5" fill="none" stroke="#eee" strokeWidth="1" />
        <polygon points="130,114 154,119 154,141 130,146 106,141 106,119" fill="none" stroke="#eee" strokeWidth="1" />
        <line x1="130" y1="15" x2="130" y2="245" stroke="#eee" strokeWidth="1" />
        <line x1="34" y1="72.5" x2="226" y2="187.5" stroke="#eee" strokeWidth="1" />
        <line x1="226" y1="72.5" x2="34" y2="187.5" stroke="#eee" strokeWidth="1" />
        <polygon className="radar-fill" points={poly.map((p) => `${p.cx},${p.cy}`).join(' ')} />
        {poly.map((p) => (
          <g key={p.key}>
            {p.v >= 80 && <circle cx={p.cx} cy={p.cy} r="7" className="glow-gold" />}
            {p.v < 40 && p.v > 0 && (
              <g className="warn-red">
                <circle cx={p.cx} cy={p.cy} r="6" />
                <line x1={p.cx - 4} y1={p.cy - 4} x2={p.cx + 4} y2={p.cy + 4} strokeWidth="2" />
                <line x1={p.cx + 4} y1={p.cy - 4} x2={p.cx - 4} y2={p.cy + 4} strokeWidth="2" />
              </g>
            )}
          </g>
        ))}
        <text x="130" y="10" textAnchor="middle" className="talent-label">主格·起源之力</text>
        <text x="238" y="70" className="talent-label">属格·剥夺之网</text>
        <text x="238" y="196" className="talent-label">与格·赋权之赐</text>
        <text x="130" y="262" textAnchor="middle" className="talent-label">宾格·直击之矛</text>
        <text x="22" y="196" textAnchor="end" className="talent-label">工具格·创造之锤</text>
        <text x="22" y="70" textAnchor="end" className="talent-label">前置格·空间之钥</text>
      </svg>
      <div className="radar-name">六维战力雷达</div>
    </div>
  )
}

// 觉醒度进度条（经验条光泽感，动态）
function TalentBars({ talents }) {
  return (
    <div className="talent-bars">
      {talents.map((t) => (
        <div className="bar-group" key={t.name}>
          <div className="bar-head">
            <span>{t.name}</span>
            <span className={t.low ? 'low-num' : ''}>{t.pct}%</span>
          </div>
          <div className="xp-track">
            <div className={'xp-fill' + (t.low ? ' xp-fill-low' : '')} style={{ width: t.pct + '%' }} />
          </div>
        </div>
      ))}
      <div className="awaken-note">觉醒度：六维战力越均衡，天赋树越闪耀</div>
    </div>
  )
}

export default function Journey() {
  usePageHeader() // 页眉标题由 AppShell 按路由自动匹配「通关之路」
  const navigate = useNavigate()

  // ---- 本地统计（每次进入实时读取） ----
  const stats = useMemo(() => {
    const learning = readLocalLearning()
    const courseIds = Object.keys(learning).filter((k) => learning[k] && (learning[k].totalMs || learning[k].lastAt))
    const totalMs = courseIds.reduce((s, k) => s + (Number(learning[k].totalMs) || 0), 0)
    const studyDays = getStudyDays()
    const dailyAvg = studyDays > 0 ? Math.round(totalMs / 60000 / studyDays) : 0
    return {
      courseCount: courseIds.length,
      totalMs,
      studyDays,
      dailyAvg,
      streak: getStreakDays(),
      unitDone: Object.keys(getUnitDoneMap()).length,
      peaks: getPeaks(),
      globalAcc: getGlobalAccuracy(),
    }
  }, [])

  // ---- 云端课程词句总量（战利品背包） ----
  const [cloud, setCloud] = useState(() => {
    const courses = loadCloudCourses().filter((c) => c && c.kind === 'course')
    return {
      words: courses.reduce((s, c) => s + (c.units || []).reduce((a, u) => a + ((u.words && u.words.length) || 0), 0), 0),
      sentences: courses.reduce((s, c) => s + (c.units || []).reduce((a, u) => a + ((u.sentences && u.sentences.length) || 0), 0), 0),
    }
  })
  useEffect(() => {
    let alive = true
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    apiFetch('/api/videos/list')
      .then((r) => r.json())
      .then((d) => {
        if (alive && d && d.ok && Array.isArray(d.videos)) {
          const courses = d.videos.filter((c) => c && c.kind === 'course')
          const words = courses.reduce((s, c) => s + (c.units || []).reduce((a, u) => a + ((u.words && u.words.length) || 0), 0), 0)
          const sentences = courses.reduce((s, c) => s + (c.units || []).reduce((a, u) => a + ((u.sentences && u.sentences.length) || 0), 0), 0)
          setCloud({ words, sentences })
          try { localStorage.setItem(CLOUD_CACHE, JSON.stringify({ list: d.videos, savedAt: Date.now() })) } catch { /* ignore */ }
        }
      })
      .catch(() => { /* 后端不可达时保留缓存 */ })
      .finally(() => clearTimeout(timer))
    return () => { alive = false; clearTimeout(timer); ctrl.abort() }
  }, [])

  // ---- 经验曲线筛选（全部 / 中译俄 / 听写） ----
  const [expMode, setExpMode] = useState('全部')
  const EXP_FILTERS = ['全部', '中译俄', '听写']
  const expRows = getDailyExp(7, expMode)
  const expSummary = getExpSummary(7, expMode)
  const expMax = Math.max(1, ...expRows.map((r) => r.exp))

  // ---- 巅峰战绩 ----
  const roleStats = [
    { label: '打卡天数', value: String(stats.studyDays), unit: '天' },
    { label: '在线时长', value: stats.totalMs > 0 ? fmtDuration(stats.totalMs) : '0', unit: stats.totalMs > 0 ? '' : '分钟' },
    { label: '日均活跃度', value: String(stats.dailyAvg), unit: '分钟' },
    { label: '连击天数', value: String(stats.streak), unit: '天', fire: true },
  ]
  const lootLeft = [
    { label: '累计发现', value: String(cloud.words + cloud.sentences) },
    { label: '收集词汇卡', value: String(cloud.words) },
    { label: '收集词组卡', value: String(cloud.sentences) },
  ]
  const lootRight = [
    { label: '游戏数据', value: String(stats.courseCount) },
    { label: '通关关卡', value: String(stats.unitDone), unit: '关' },
  ]
  const peakStats = [
    { label: '最高连斩', value: String(stats.peaks.maxCombo), unit: '题', note: '连续答对' },
    { label: '单局最高输出', value: String(stats.peaks.maxScore), unit: 'EXP' },
    { label: '单局最高命中率', value: stats.peaks.maxAccuracy ? String(stats.peaks.maxAccuracy) : '—', unit: stats.peaks.maxAccuracy ? '%' : '' },
  ]
  const talents = getCaseStats().map((t) => ({ name: t.name, pct: t.pct, low: t.pct < 40 }))

  return (
    <div className="journey-page">
      {/* ═══════ 模块一：角色状态 ═══════ */}
      <section className="journey-section">
        <SectionHead emoji="⚔️" title="角色状态" sub="记录在线时长与连续打卡战绩" />
        <div className="stat-grid-4">
          {roleStats.map((s) => <StatCard key={s.label} item={s} />)}
        </div>
      </section>

      {/* ═══════ 模块二：冒险日志 ═══════ */}
      <section className="journey-section">
        <SectionHead emoji="📜" title="冒险日志" sub="探索成果与战利品盘点" />
        <div className="loot-grid">
          <div className="rpg-card">
            <div className="rpg-card-head">
              <span className="rpg-card-title">🎒 战利品背包</span>
              <span className="rpg-card-link" role="button" onClick={() => navigate('/unlocked-games')}>去查看 →</span>
            </div>
            <div className="loot-stats">
              {lootLeft.map((it) => (
                <div className="loot-item" key={it.label}>
                  <div className="stat-label">{it.label}</div>
                  <div className="stat-value">{it.value}{it.unit && <span className="stat-unit">{it.unit}</span>}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rpg-card">
            <div className="rpg-card-head">
              <span className="rpg-card-title">🗡️ 副本通关</span>
              <span className="rpg-card-link" role="button" onClick={() => navigate('/unlocked-games')}>去练习 →</span>
            </div>
            <div className="loot-stats">
              {lootRight.map((it) => (
                <div className="loot-item" key={it.label}>
                  <div className="stat-label">{it.label}</div>
                  <div className="stat-value">{it.value}{it.unit && <span className="stat-unit">{it.unit}</span>}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 模块三：巅峰战绩 ═══════ */}
      <section className="journey-section">
        <SectionHead emoji="🏆" title="巅峰战绩" sub="你的最强 Combo 与输出记录" />
        <div className="stat-grid-3">
          {peakStats.map((s) => <StatCard key={s.label} item={s} />)}
        </div>
      </section>

      {/* ═══════ 模块四：经验获取曲线 ═══════ */}
      <section className="journey-section">
        <div className="exp-card">
          <SectionHead emoji="📈" title="经验获取曲线" sub="每日经验值（EXP）入账记录 · 学习 1 分钟 = 1 EXP · 答题每题 +10 EXP" />
          <div className="exp-filters">
            {EXP_FILTERS.map((t) => (
              <button key={t} className={'exp-tab' + (t === expMode ? ' active' : '')} onClick={() => setExpMode(t)}>{t}</button>
            ))}
          </div>
          <div className="exp-chart">
            <svg viewBox="0 0 860 220" style={{ width: '100%', height: 'auto', display: 'block' }}>
              {[40, 80, 120, 160].map((y) => (
                <line key={'h' + y} x1="60" y1={y} x2="840" y2={y} stroke="#f0edf7" strokeWidth="1" />
              ))}
              {expRows.map((d) => (
                <line key={'v' + d.date} x1={120 + expRows.indexOf(d) * 120} y1="40" x2={120 + expRows.indexOf(d) * 120} y2="160" stroke="#f0edf7" strokeWidth="1" />
              ))}
              {[['60', 44], ['40', 84], ['20', 124], ['0', 164]].map(([t, y]) => (
                <text key={t} x="45" y={y} className="axis">{t}</text>
              ))}
              <polyline
                className="exp-line"
                points={expRows.map((d, i) => {
                  const x = 120 + i * 120
                  const y = 164 - Math.min(d.exp, 60) * 2
                  return `${x},${y}`
                }).join(' ')}
              />
              {expRows.map((d, i) => {
                const x = 120 + i * 120
                const y = 164 - Math.min(d.exp, 60) * 2
                const peak = d.exp === expMax && d.exp > 0
                return (
                  <g key={'c' + d.date}>
                    <circle cx={x} cy={y} r={peak ? 6 : 5} className={peak ? 'dot dot-high' : 'dot'} />
                    {peak && (
                      <>
                        <text x={x - 14} y="26" className="peak">峰值</text>
                        <text x={x - 14} y="46" className="peak-num">{d.exp} EXP</text>
                      </>
                    )}
                  </g>
                )
              })}
              {expRows.map((d, i) => (
                <text key={'x' + d.date} x={120 + i * 120} y="200" textAnchor="middle" className="axis-x">{d.label}</text>
              ))}
            </svg>
            <div className="chart-foot">
              <span className="chart-unit">单位：EXP</span>
              <span className="chart-total">累计获得 {expSummary.total} EXP · 日均获取 {expSummary.avg} EXP</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 模块五：变格天赋树 ═══════ */}
      <section className="journey-section">
        <SectionHead
          emoji="🌳"
          title="变格天赋树"
          right={<span className="awaken-badge">觉醒</span>}
        />
        <div className="talent-layout">
          <RadarChart talents={talents} />
          <TalentBars talents={talents} />
        </div>
      </section>
    </div>
  )
}
