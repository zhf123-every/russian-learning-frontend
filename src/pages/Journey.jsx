// 通关之路 · 俄语大陆 RPG 冒险页
// 路由：/journey（侧边栏「通关之路」入口）
// 世界观：学习时长=经验值(EXP) / 答题=打怪输出 / 语法掌握=天赋树
// 布局对标：句乐部「成长分析」页（5 个模块）
import { usePageHeader } from '../components/layout/PageHeaderContext'

// ---------- 静态演示数据（后端就绪后替换） ----------
const ROLE_STATS = [
  { label: '打卡天数', value: '4', unit: '天' },
  { label: '在线时长', value: '49', unit: '分钟' },
  { label: '日均活跃度', value: '12', unit: '分钟' },
  { label: '连击天数', value: '4', unit: '天', fire: true },
]
const LOOT_LEFT = [
  { label: '累计发现', value: '39' },
  { label: '收集词汇卡', value: '39' },
  { label: '收集词组卡', value: '0' },
]
const LOOT_RIGHT = [
  { label: '游戏数据', value: '1' },
  { label: '通关关卡', value: '1', unit: '关' },
]
const PEAK_STATS = [
  { label: '最高连斩', value: '1', unit: '题', note: '连续答对' },
  { label: '单局最高输出', value: '3100', unit: 'EXP' },
  { label: '单局最高命中率', value: '100', unit: '%' },
]
const EXP_FILTERS = ['全部', '中译俄', '听写', '听力', '口语评测', '视频']
// 周一~周日 EXP（数据点坐标对应 viewBox 0 0 860 220）
const WEEK_EXP = [
  { day: '周一', x: 120, y: 140 },
  { day: '周二', x: 240, y: 152 },
  { day: '周三', x: 360, y: 112 },
  { day: '周四', x: 480, y: 88 },
  { day: '周五', x: 600, y: 148 },
  { day: '周六', x: 720, y: 72 },
  { day: '周日', x: 840, y: 40, peak: true },
]
const TALENTS = [
  { name: '主格·起源之力', value: 85, low: false },
  { name: '属格·剥夺之网', value: 70, low: false },
  { name: '与格·赋权之赐', value: 45, low: false },
  { name: '宾格·直击之矛', value: 60, low: false },
  { name: '工具格·创造之锤', value: 30, low: true },
  { name: '前置格·空间之钥', value: 55, low: false },
]

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

// 六维战力雷达（SVG，85% 金光 / 30% 红色警告）
function RadarChart() {
  return (
    <div className="radar-wrap">
      <svg viewBox="0 0 260 268" style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* 网格：六边形 5 层 */}
        <polygon points="130,15 226,72.5 226,187.5 130,245 34,187.5 34,72.5" fill="none" stroke="#e5e7eb" strokeWidth="1" />
        <polygon points="130,48 202,88 202,172 130,212 58,172 58,88" fill="none" stroke="#eee" strokeWidth="1" />
        <polygon points="130,81 178,103.5 178,156.5 130,179 82,156.5 82,103.5" fill="none" stroke="#eee" strokeWidth="1" />
        <polygon points="130,114 154,119 154,141 130,146 106,141 106,119" fill="none" stroke="#eee" strokeWidth="1" />
        {/* 轴线 */}
        <line x1="130" y1="15" x2="130" y2="245" stroke="#eee" strokeWidth="1" />
        <line x1="34" y1="72.5" x2="226" y2="187.5" stroke="#eee" strokeWidth="1" />
        <line x1="226" y1="72.5" x2="34" y2="187.5" stroke="#eee" strokeWidth="1" />
        {/* 战力数据（85/70/45/60/30/55） */}
        <polygon className="radar-fill" points="130,40.75 193.7,93.3 170.9,153.6 130,193 102.7,145.8 80,101.1" />
        {/* 高掌握度第一格：金光 + 燃烧 */}
        <circle cx="130" cy="40.75" r="7" className="glow-gold" />
        {/* 低掌握度第五格：红色警告 + 破碎叉 */}
        <circle cx="102.7" cy="145.8" r="6" className="warn-red" />
        <line x1="98" y1="141" x2="107" y2="150" stroke="#dc2626" strokeWidth="2" className="warn-red" />
        <line x1="107" y1="141" x2="98" y2="150" stroke="#dc2626" strokeWidth="2" className="warn-red" />
        {/* 顶点标签 */}
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

// 觉醒度进度条（经验条光泽感）
function TalentBars() {
  return (
    <div className="talent-bars">
      {TALENTS.map((t) => (
        <div className="bar-group" key={t.name}>
          <div className="bar-head">
            <span>{t.name}</span>
            <span className={t.low ? 'low-num' : ''}>{t.value}%</span>
          </div>
          <div className="xp-track">
            <div className={'xp-fill' + (t.low ? ' xp-fill-low' : '')} style={{ width: t.value + '%' }} />
          </div>
        </div>
      ))}
      <div className="awaken-note">觉醒度：六维战力越均衡，天赋树越闪耀</div>
    </div>
  )
}

export default function Journey() {
  usePageHeader() // 页眉标题由 AppShell 按路由自动匹配「通关之路」

  return (
    <div className="journey-page">
      {/* ═══════ 模块一：角色状态 ═══════ */}
      <section className="journey-section">
        <SectionHead emoji="⚔️" title="角色状态" sub="记录在线时长与连续打卡战绩" />
        <div className="stat-grid-4">
          {ROLE_STATS.map((s) => <StatCard key={s.label} item={s} />)}
        </div>
      </section>

      {/* ═══════ 模块二：冒险日志 ═══════ */}
      <section className="journey-section">
        <SectionHead emoji="📜" title="冒险日志" sub="探索成果与战利品盘点" />
        <div className="loot-grid">
          {/* 战利品背包 */}
          <div className="rpg-card">
            <div className="rpg-card-head">
              <span className="rpg-card-title">🎒 战利品背包</span>
              <span className="rpg-card-link">去查看 →</span>
            </div>
            <div className="loot-stats">
              {LOOT_LEFT.map((it) => (
                <div className="loot-item" key={it.label}>
                  <div className="stat-label">{it.label}</div>
                  <div className="stat-value">{it.value}{it.unit && <span className="stat-unit">{it.unit}</span>}</div>
                </div>
              ))}
            </div>
          </div>
          {/* 副本通关 */}
          <div className="rpg-card">
            <div className="rpg-card-head">
              <span className="rpg-card-title">🗡️ 副本通关</span>
              <span className="rpg-card-link">去练习 →</span>
            </div>
            <div className="loot-stats">
              {LOOT_RIGHT.map((it) => (
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
          {PEAK_STATS.map((s) => <StatCard key={s.label} item={s} />)}
        </div>
      </section>

      {/* ═══════ 模块四：经验获取曲线 ═══════ */}
      <section className="journey-section">
        <div className="exp-card">
          <SectionHead emoji="📈" title="经验获取曲线" sub="每日经验值（EXP）入账记录" />
          {/* 筛选标签 */}
          <div className="exp-filters">
            {EXP_FILTERS.map((t, i) => (
              <button key={t} className={'exp-tab' + (i === 0 ? ' active' : '')}>{t}</button>
            ))}
          </div>
          {/* 曲线图（内框）：网格 + 节点对齐周期 */}
          <div className="exp-chart">
            <svg viewBox="0 0 860 220" style={{ width: '100%', height: 'auto', display: 'block' }}>
              {/* 完整网格：横线 + 竖线 */}
              {[40, 80, 120, 160].map((y) => (
                <line key={'h' + y} x1="60" y1={y} x2="840" y2={y} stroke="#f0edf7" strokeWidth="1" />
              ))}
              {WEEK_EXP.map((d) => (
                <line key={'v' + d.x} x1={d.x} y1="40" x2={d.x} y2="160" stroke="#f0edf7" strokeWidth="1" />
              ))}
              {/* Y 轴刻度 */}
              {[['60', 44], ['40', 84], ['20', 124], ['0', 164]].map(([t, y]) => (
                <text key={t} x="45" y={y} className="axis">{t}</text>
              ))}
              {/* 折线 */}
              <polyline className="exp-line" points={WEEK_EXP.map((d) => `${d.x},${d.y}`).join(' ')} />
              {/* 数据节点 */}
              {WEEK_EXP.map((d) => (
                <circle key={'c' + d.x} cx={d.x} cy={d.y} r={d.peak ? 6 : 5} className={d.peak ? 'dot dot-high' : 'dot'} />
              ))}
              {/* 周日峰值标注 */}
              <text x="808" y="26" className="peak">周日</text>
              <text x="808" y="46" className="peak-num">60 EXP</text>
              {/* X 轴周期 */}
              {WEEK_EXP.map((d) => (
                <text key={'x' + d.x} x={d.x} y="200" textAnchor="middle" className="axis-x">{d.day}</text>
              ))}
            </svg>
            <div className="chart-foot">
              <span className="chart-unit">单位：EXP</span>
              <span className="chart-total">累计获得 90 EXP · 日均获取 22 EXP</span>
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
          <RadarChart />
          <TalentBars />
        </div>
      </section>
    </div>
  )
}
