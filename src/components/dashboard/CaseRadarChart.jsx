// 六格能力雷达图（纯 SVG，靛蓝单色；最弱格用琥珀色）
export default function CaseRadarChart({ data }) {
  const N = 6, cx = 110, cy = 102, R = 66
  const pt = (r, i) => {
    const a = (-90 + i * 60) * Math.PI / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  const poly = (r) => Array.from({ length: N }, (_, i) => pt(r, i).join(',')).join(' ')

  return (
    <svg width="210" height="190" viewBox="0 0 220 200" role="img" aria-label="六格掌握度雷达图">
      {[0.33, 0.66, 1].map((k) => (
        <polygon key={k} points={poly(R * k)} fill="none" stroke="#E9E9EE" strokeWidth="1" />
      ))}
      {Array.from({ length: N }, (_, i) => {
        const [x, y] = pt(R, i)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#F0F0F2" strokeWidth="1" />
      })}
      <polygon
        points={data.map((d, i) => pt(R * Math.max(0.04, d.value / 100), i).join(',')).join(' ')}
        fill="rgba(79,70,229,.16)" stroke="#4F46E5" strokeWidth="2"
      />
      {data.map((d, i) => {
        const [x, y] = pt(R * Math.max(0.04, d.value / 100), i)
        const weak = d.value <= 35
        return <circle key={i} cx={x} cy={y} r="2.8" fill={weak ? '#B45309' : '#4F46E5'} />
      })}
      {data.map((d, i) => {
        const [x, y] = pt(R + 15, i)
        return (
          <text key={'t' + i} x={x} y={y + 3.5} textAnchor="middle" fontSize="10.5"
            fill={d.value <= 35 ? '#B45309' : '#71717A'} fontWeight={d.value <= 35 ? 700 : 400}>
            {d.label}
          </text>
        )
      })}
    </svg>
  )
}
