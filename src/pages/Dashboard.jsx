import { Link } from 'react-router-dom'
import '../styles/dashboard.css'

// 1:1 对标「我的主页」：结构 / 卡片 / 任务数 / 徽章完全对齐，内容替换为俄语学习语境。
const WEEK = [
  { d: '周一', s: '' },
  { d: '周二', s: 'done' },
  { d: '周三', s: 'done' },
  { d: '周四', s: 'done' },
  { d: '周五', s: 'done' },
  { d: '周六', s: '' },
  { d: '周日', s: 'today' },
]

function TaskRow({ icon, tint, title, badge, desc, action = '去完成 →' }) {
  return (
    <div className="htask">
      <div className={'htask-ic ' + tint}>{icon}</div>
      <div className="htask-body">
        <div className="htask-title">{title} <span className="hbadge">{badge}</span></div>
        {desc && <div className="htask-desc">{desc}</div>}
      </div>
      <div className="htask-go">{action}</div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <div className="db-page">
      <div className="db-container">

        {/* 顶栏 */}
        <div className="mhome-top">
          <div className="mhome-top-l"><span className="mhome-ic">▦</span> 我的主页</div>
          <div className="mhome-avatar">学</div>
        </div>

        <div className="mhome-grid">

          {/* ===== 左列 ===== */}
          <div className="mhome-col">
            <div className="db-card">
              <div className="pad">
                <div className="mhome-card-head">
                  每日打卡
                  <span className="mhome-head-ic">?</span>
                  <span className="mhome-head-ic">⚙</span>
                </div>
                <div className="mhome-stat2">
                  <div><div className="cap">连胜</div><div className="big">4<span>天</span></div></div>
                  <div className="right"><div className="cap">累计打卡</div><div className="big">4<span>天</span></div></div>
                </div>
                <div className="mhome-goal"><span>今日目标</span><span>1/5</span></div>
                <div className="mhome-bar"><i style={{ width: '20%' }} /></div>
                <div className="mhome-week-label">本周打卡记录</div>
                <div className="mhome-week">
                  {WEEK.map((w) => (
                    <div className="mhome-w" key={w.d}>
                      <span>{w.d}</span>
                      <div className={'dot ' + (w.s === 'done' ? 'done' : w.s === 'today' ? 'today' : '')}>
                        {w.s === 'done' && '✓'}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mhome-gift">
                  <span>🎁</span>
                  <span className="g-txt">分享学习战绩带邀请码，好友注册付费双方都有奖励哦</span>
                  <span className="g-more">了解 →</span>
                  <span className="g-x">×</span>
                </div>
                <div className="mhome-cbtns">
                  <button className="db-btn db-btn-ghost">🗓 打卡日历</button>
                  <button className="db-btn db-btn-primary">✧ 炫耀战绩</button>
                </div>
              </div>
            </div>

            <div className="mhome-minirow">
              <div className="db-card mhome-mini">
                <div className="mhome-mini-ic yellow">📕</div>
                <div className="mhome-mini-body">
                  <div className="mhome-mini-t">复习本<span className="mhome-mini-r"><b>30</b>今日推荐</span></div>
                  <div className="mhome-mini-d">智能复习，巩固学习内容</div>
                  <div className="mhome-mini-d2">今日进度 0 / 30</div>
                </div>
              </div>
              <div className="db-card mhome-mini">
                <div className="mhome-mini-ic purple">📖</div>
                <div className="mhome-mini-body">
                  <div className="mhome-mini-t">生词本</div>
                  <div className="mhome-mini-d">记录学习中遇到的生词</div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== 中列 ===== */}
          <div className="mhome-col">
            <div className="db-card">
              <div className="pad">
                <div className="mhome-card-head">每日任务</div>
                <div className="mhome-tasks">
                  <TaskRow icon="🗓" tint="blue" title="今日打卡" badge="+30" />
                  <TaskRow icon="文A" tint="pink" title="五步精听一段" badge="+15"
                    desc="每天花几分钟，听一段真实俄语视频——自己听懂、跟读出来的句子，才是你真正能脱口而出的。盲听、听写、精读、跟读、复述，五步走完；听不懂也没关系。" />
                  <TaskRow icon="📅" tint="amber" title="完成今日复习" badge="+20" desc="完成一次复习练习" />
                  <div className="mhome-subhead">特别任务</div>
                  <TaskRow icon="◎" tint="purple" title="测测你的俄语水平" badge="+50" />
                </div>
              </div>
            </div>
          </div>

          {/* ===== 右列 ===== */}
          <div className="mhome-col">
            {/* 学习热力图 */}
            <div className="db-card">
              <div className="pad">
                <div className="mhome-card-head">学习热力图 <span className="mhome-month">‹ 2026年9月 ›</span></div>
                <div className="mhome-heat">
                  <div className="hh">{['一','二','三','四','五','六','日'].map((w) => <span key={w}>{w}</span>)}</div>
                  {[
                    [0,0,0,0,1,1,1],
                    [0,0,0,0,1,1,1],
                    [0,0,0,0,1,1,1],
                    [0,0,0,0,1,1,1],
                    [0,0,0,0,0,0,0],
                  ].map((row, i) => (
                    <div className="hr" key={i}>{row.map((v, j) => <i key={j} className={v ? 'g' : ''} />)}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* 最近学习 */}
            <div className="db-card">
              <div className="pad">
                <div className="mhome-card-head">最近学习</div>
                {[
                  { th: 'У1', t: 'Привет, Россия! A1', s: 'Урок 1 · 问候与初识', tm: '大约 2 小时前' },
                  { th: '🎧', t: '精听 · 在超市购物', s: '常用对话 · 五步精听', tm: '大约 9 小时前' },
                  { th: 'У3', t: '句子闯关', s: '家族 2 · 第 5 步', tm: '1 天前' },
                ].map((r, i) => (
                  <div className="mhome-recent" key={i}>
                    <div className="mr-thumb">{r.th}</div>
                    <div className="mr-body">
                      <div className="mr-t">{r.t}</div>
                      <div className="mr-s">{r.s}</div>
                      <div className="mr-tm">{r.tm}</div>
                    </div>
                  </div>
                ))}
                <div className="mhome-more">查看更多</div>
              </div>
            </div>

            {/* 邀请有礼 */}
            <div className="mhome-invite">
              <div className="mi-t">🎁 邀请有礼</div>
              <div className="mi-d">邀请好友加入，双方都能获得会员时长</div>
              <button className="mi-btn">邀请好友</button>
            </div>
          </div>
        </div>

        {/* ===== 底部：我的课程 ===== */}
        <div className="mhome-course">
          <div className="mhome-course-head">
            <h2>我的课程</h2>
            <Link to="/quest-store" className="db-btn db-btn-ghost">🛒 课程包商城</Link>
          </div>
          <div className="mhome-empty">
            <div className="mhome-plus">＋</div>
            <div className="mhome-empty-txt">将常用课程包添加到主页，让您的学习更便捷高效</div>
          </div>
        </div>

      </div>
    </div>
  )
}
