import { useNavigate } from 'react-router-dom'
import CaseRadarChart from './CaseRadarChart'

// 语法能力地图：六格雷达 + 六格进度条 + 最弱格“处方”
export default function GrammarAbilitySection({ abilities }) {
  const navigate = useNavigate()
  const weakest = abilities.reduce((a, b) => (b.value < a.value ? b : a), abilities[0])

  return (
    <div className="db-card">
      <div className="pad">
        <div className="db-sec-title">
          语法能力地图
          <span className="db-placeholder-tag">示例数据</span>
        </div>
        <div className="db-sec-cap">六个格的掌握度 · 由最弱项生成下一步专项</div>

        <div className="db-ability">
          <div className="db-radar-wrap">
            <CaseRadarChart data={abilities} />
          </div>
          <div className="db-bars">
            {abilities.map((d) => (
              <div className="db-bar-row" key={d.label}>
                <span className="lb">{d.label}</span>
                <span className="db-bar"><i className={d.value <= 35 ? 'weak' : ''} style={{ width: d.value + '%' }} /></span>
                <span className="vl">{d.value}%</span>
              </div>
            ))}
            <div className="db-presc">
              <span>🎯 最弱：<b>{weakest.label}</b> · 建议专项强化</span>
              <span className="go2" onClick={() => navigate('/quest-store')}>开始 →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
