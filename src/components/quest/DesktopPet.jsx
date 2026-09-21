import { useState, useEffect, useRef, useCallback } from 'react'

// ================= 桌面宠物组件 =================
// 可爱的学习伙伴宠物，支持互动（点击/拖拽）、状态变化、随机台词
// 对齐官方桌面宠物的趣味交互体验

const PET_MOODS = {
  happy: { emoji: '😊', label: '开心', color: '#FFD75E' },
  excited: { emoji: '🤩', label: '兴奋', color: '#FF8A5C' },
  thinking: { emoji: '🤔', label: '思考', color: '#6FB7FF' },
  sleepy: { emoji: '😴', label: '困倦', color: '#B7A8E8' },
  love: { emoji: '🥰', label: '喜爱', color: '#FF6B9D' },
  cool: { emoji: '😎', label: '酷', color: '#7ED6A5' },
  cheer: { emoji: '🎉', label: '欢呼', color: 'oklch(23.27% 0.0249 284.3)' },
}

// 随机台词库（按场景分类）
const PET_LINES = {
  idle: [
    '今天也要加油学俄语哦！',
    '俄语其实很有趣的，对吧？',
    '要不要来一局连词成句？',
    '我在这里陪着你学习~',
    '休息一下也没关系，但别太久哦！',
    '你知道吗？俄语有6个格呢！',
    '颤音Р练会了吗？',
    '学习使我快乐！',
  ],
  correct: [
    '太棒了！答对了！',
    'Молодец! 真厉害！',
    '继续保持这个状态！',
    '你越来越棒了！',
    '这题答得真漂亮！',
  ],
  wrong: [
    '没关系，再来一次！',
    '错误是学习的一部分~',
    '别灰心，我相信你！',
    '仔细看看哪里错了？',
    '失败乃成功之母！',
  ],
  checkin: [
    '签到成功！你真棒！',
    '又坚持了一天，太厉害了！',
    '连续打卡的你闪闪发光！',
  ],
  pet: [
    '摸摸头~ 好舒服！',
    '嘿嘿，被你发现了！',
    '再摸一下嘛~',
    '你是最棒的学习者！',
    '我会一直陪着你的！',
  ],
}

function pickLine(category) {
  const lines = PET_LINES[category] || PET_LINES.idle
  return lines[Math.floor(Math.random() * lines.length)]
}

function pickMood() {
  const moods = Object.keys(PET_MOODS)
  return moods[Math.floor(Math.random() * moods.length)]
}

export default function DesktopPet({
  theme = 'light',
  position = { x: 20, y: 120 },  // 初始位置（相对于视口）
  onAction,  // (type) => void 宠物触发的动作回调
  visible = true,
}) {
  const [mood, setMood] = useState('happy')
  const [line, setLine] = useState(pickLine('idle'))
  const [showBubble, setShowBubble] = useState(true)
  const [pos, setPos] = useState(position)
  const [dragging, setDragging] = useState(false)
  const [bounce, setBounce] = useState(false)
  const [petSize, setPetSize] = useState(64)
  const dragOffset = useRef({ x: 0, y: 0 })
  const lineTimer = useRef(null)
  const moodTimer = useRef(null)

  const T = theme === 'dark'
    ? { text: '#F5EDE2', sub: '#8B7FA3', border: 'rgba(255,255,255,.15)', bg: 'rgba(27,19,48,.95)', shadow: '0 8px 32px rgba(0,0,0,.4)' }
    : { text: '#1a1a2e', sub: '#666', border: 'rgba(0,0,0,.1)', bg: 'rgba(255,255,255,.95)', shadow: '0 8px 32px rgba(0,0,0,.15)' }

  // 随机切换台词和心情
  useEffect(() => {
    if (!visible) return
    lineTimer.current = setInterval(() => {
      setLine(pickLine('idle'))
      setShowBubble(true)
    }, 15000)

    moodTimer.current = setInterval(() => {
      setMood(pickMood())
    }, 20000)

    // 5秒后自动隐藏气泡
    const hideTimer = setTimeout(() => setShowBubble(false), 8000)

    return () => {
      clearInterval(lineTimer.current)
      clearInterval(moodTimer.current)
      clearTimeout(hideTimer)
    }
  }, [visible])

  // 触发宠物说话
  const speak = useCallback((category = 'idle', duration = 5000) => {
    setLine(pickLine(category))
    setShowBubble(true)
    setMood(category === 'correct' ? 'excited' : category === 'wrong' ? 'thinking' : category === 'checkin' ? 'cheer' : 'happy')
    setTimeout(() => setShowBubble(false), duration)
  }, [])

  // 暴露speak方法给父组件
  useEffect(() => {
    if (onAction) {
      // 通过自定义事件通信
      const handler = (e) => {
        if (e.detail?.type === 'speak') speak(e.detail.category, e.detail.duration)
        if (e.detail?.type === 'mood') setMood(e.detail.mood)
      }
      window.addEventListener('desktop-pet', handler)
      return () => window.removeEventListener('desktop-pet', handler)
    }
  }, [onAction, speak])

  // 点击宠物互动
  const handleClick = () => {
    if (dragging) return
    setBounce(true)
    setTimeout(() => setBounce(false), 500)
    setMood('love')
    speak('pet', 3000)
    onAction && onAction('pet')
  }

  // 拖拽逻辑
  const handleMouseDown = (e) => {
    setDragging(true)
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    }
    e.preventDefault()
  }

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - petSize, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - petSize, e.clientY - dragOffset.current.y)),
      })
    }
    const handleUp = () => setDragging(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging, petSize])

  if (!visible) return null

  const moodInfo = PET_MOODS[mood] || PET_MOODS.happy

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9000,
        userSelect: 'none',
        cursor: dragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
    >
      <style>{`
        @keyframes petBounce { 0%,100%{transform:translateY(0)} 30%{transform:translateY(-12px) scale(1.1)} 60%{transform:translateY(0) scale(.95)} }
        @keyframes petFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes bubbleIn { 0%{opacity:0; transform:translateY(8px) scale(.9)} 100%{opacity:1; transform:translateY(0) scale(1)} }
        .pet-bounce{ animation: petBounce .5s ease; }
        .pet-float{ animation: petFloat 3s ease-in-out infinite; }
      `}</style>

      {/* 对话气泡 */}
      {showBubble && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 8, minWidth: 140, maxWidth: 220,
          background: T.bg, border: '1px solid ' + T.border, borderRadius: 14,
          padding: '10px 14px', boxShadow: T.shadow,
          animation: 'bubbleIn .25s ease',
          backdropFilter: 'blur(8px)',
        }}>
          {/* 气泡小三角 */}
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
            borderTop: `8px solid ${T.border}`,
          }} />
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%) translateY(-2px)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
            borderTop: `6px solid ${T.bg}`,
          }} />
          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5, fontWeight: 500 }}>
            {line}
          </div>
        </div>
      )}

      {/* 宠物主体 */}
      <div
        className={(bounce ? 'pet-bounce ' : '') + (!dragging ? 'pet-float' : '')}
        onClick={handleClick}
        style={{
          width: petSize, height: petSize,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: petSize * 0.6,
          background: `radial-gradient(circle at 30% 30%, ${moodInfo.color}33, ${moodInfo.color}11)`,
          borderRadius: '50%',
          border: `2px solid ${moodInfo.color}66`,
          boxShadow: `0 4px 20px ${moodInfo.color}44`,
          transition: 'all .3s ease',
        }}
        title="点击互动 · 拖拽移动"
      >
        {moodInfo.emoji}
      </div>

      {/* 心情标签 */}
      <div style={{
        position: 'absolute', top: -4, right: -4,
        background: moodInfo.color, color: '#fff',
        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8,
        boxShadow: '0 2px 6px rgba(0,0,0,.2)',
      }}>
        {moodInfo.label}
      </div>
    </div>
  )
}

// 工具函数：触发宠物说话（供其他组件调用）
export function petSpeak(category = 'idle', duration = 5000) {
  window.dispatchEvent(new CustomEvent('desktop-pet', { detail: { type: 'speak', category, duration } }))
}
export function petSetMood(mood) {
  window.dispatchEvent(new CustomEvent('desktop-pet', { detail: { type: 'mood', mood } }))
}
