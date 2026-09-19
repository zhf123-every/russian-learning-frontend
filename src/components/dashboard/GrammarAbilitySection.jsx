import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CaseRadarChart from './CaseRadarChart'

// 六维能力雷达（Pro）：词汇/听力/阅读/语法/口语/写作
// 非 Pro 用户：图表正常展示，点击弹升级引导，不阉割内容。
export default function GrammarAbilitySection({ abilities }) {
  const navigate = useNavigate()
  const [showProTip, setShowProTip] = useState(false)
  const list = abilities || []
  const weakest = list.length ? list.reduce((a, b) => (b.value < a.value ? b : a), list[0]) : null

  return (
    <>
      <div className="db-card db-pro-card">
        <div className="pad">
          <div className="db-sec-title" style={{ display: 'flex', alignItems: 'center' }}>
            六维能力雷达
            <span className="pro-badge">Pro</span>
            <span style={{ flex: 1 }} />
            <button className="db-pro-unlock" onClick={() => setShowProTip(true)}>解锁完整分析</button>
          </div>
          <div className="db-sec-cap">词汇 · 听力 · 阅读 · 语法 · 口语 · 写作（示例数据）</div>

          <div className="db-ability">
            <div className="db-radar-wrap">
              <CaseRadarChart data={list} />
            </div>
            <div className="db-bars">
              {list.map((d) => (
                <div className="db-bar-row" key={d.label}>
                  <span className="lb">{d.label}</span>
                  <span className="db-bar"><i className={d.value <= 45 ? 'weak' : ''} style={{ width: d.value + '%' }} /></span>
                  <span className="vl">{d.value}%</span>
                </div>
              ))}
              {weakest && (
                <div className="db-presc">
                  <span>🎯 最弱：<b>{weakest.label}</b> · 建议专项强化</span>
                  <span className="go2" onClick={() => navigate('/quest-store')}>开始 →</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showProTip && (
        <div className="modal-mask" onClick={() => setShowProTip(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h2 style={{ marginTop: 0 }}>六维能力雷达 <span className="pro-badge">Pro</span></h2>
            <p className="db-sec-cap">
              完整能力分析会基于你的练习数据，定位每一项的薄弱点，生成专属训练路径与复习计划。
            </p>
            <ul style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--db-text-2)', paddingLeft: 18 }}>
              <li>按真实练习记录动态计算六维掌握度</li>
              <li>最弱维度自动生成专项强化练习</li>
              <li>月度能力成长报告与趋势对比</li>
            </ul>
            <div className="mfoot">
              <button className="btn" onClick={() => setShowProTip(false)}>稍后再说</button>
              <button className="btn primary" onClick={() => { setShowProTip(false); navigate('/quest-store') }}>查看 Pro 方案</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
