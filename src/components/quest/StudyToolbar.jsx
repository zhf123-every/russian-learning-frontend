// 句乐部式学习工具栏（适配俄语站白底+紫色主题）
// 顶部 9 个图标：设置/课文/列表/手柄/重置/暂停播放/循环/帮助/全屏 + 进度条
// 所有交互通过 props 回调绑定 VideoStudy 的播放器逻辑
import { useState } from 'react'
import SettingsModal from '../SettingsModal'

// ---- 图标（stroke 线条风格，与页面现有箭头一致） ----
const S = {
  w: 20, h: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24',
}
export const Icon = {
  gear: (<svg {...S}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>),
  book: (<svg {...S}><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>),
  list: (<svg {...S}><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>),
  gamepad: (<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17 4H7C4.243 4 2 6.243 2 9v6c0 2.757 2.243 5 5 5 1.2 0 2.4-.45 3.33-1.27l1.67-1.48 1.67 1.48C14.6 19.55 15.8 20 17 20c2.757 0 5-2.243 5-5V9c0-2.757-2.243-5-5-5zm-6 4h-2v2H7v2h2v2h2v-2h2v-2h-2V8zm6.5 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm-2-3.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" /></svg>),
  refresh: (<svg {...S}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>),
  play: (<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>),
  pause: (<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>),
  repeat: (<svg {...S}><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>),
  help: (<svg {...S}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>),
  fullscreen: (<svg {...S}><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>),
  volOn: (<svg {...S}><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>),
  volOff: (<svg {...S}><path d="M11 5 6 9H2v6h4l5 4z" /><path d="m23 9-6 6" /><path d="m17 9 6 6" /></svg>),
  prev: (<svg {...S}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>),
  next: (<svg {...S}><path d="m12 5 7 7-7 7" /><path d="M5 12h14" /></svg>),
}

// 统一图标按钮样式
const iconBtn = (active = false) => ({
  width: 36, height: 36, borderRadius: 10, border: active ? '1px solid #6d28d9' : '1px solid #e5e7eb',
  background: active ? '#f5f3ff' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: active ? '#6d28d9' : '#555', transition: 'all .15s', flexShrink: 0,
})

// 弹窗外壳
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(24,24,27,0.55)', zIndex: 10001,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}
const sheet = {
  background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(24,24,27,0.35)',
  padding: '24px 28px', maxWidth: 440, width: '100%', maxHeight: '78vh', overflowY: 'auto',
  border: '1px solid var(--border2, #E8E1D9)',
}

export default function StudyToolbar({
  title, stepLabel, stepIdx, stepTotal,
  curIdx, total, paused, loopMode, muted, speed,
  sentences = [], videoType,
  onBack, onTogglePlay, onPrev, onNext,
  onOpenMode, onReset, onSetSpeed, onToggleLoop, onToggleMute, onFullscreen,
  onOpenFullText, onJump, onSettingsClose,
}) {
  const [showSettings, setShowSettings] = useState(false)
  const [showList, setShowList] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [tip, setTip] = useState('')
  const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5]

  // 悬停提示（句乐部式 UTooltip）
  const Tip = (text) => (tip === text ? (
    <div style={{
      position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap',
      background: '#18181b', color: '#fff', fontSize: 12, padding: '5px 10px', borderRadius: 8, zIndex: 30,
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    }}>
      {text}
      <div style={{ position: 'absolute', top: -5, left: '50%', marginLeft: -5, width: 10, height: 10, background: '#18181b', transform: 'rotate(45deg)' }} />
    </div>
  ) : null)

  const TBtn = ({ t, onClick, children, active, extra }) => (
    <div
      style={{ position: 'relative', display: 'flex' }}
      onMouseEnter={() => setTip(t)}
      onMouseLeave={() => setTip('')}
    >
      <button type="button" onClick={onClick} aria-label={t} style={iconBtn(active)} {...extra}>{children}</button>
      {Tip(t)}
    </div>
  )

  const pct = total > 0 ? Math.min(100, Math.round(((curIdx + 1) / total) * 100)) : 0

  return (
    <>
      {/* ===== 顶部工具栏（sticky） ===== */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20, height: 56, flexShrink: 0,
        display: 'flex', alignItems: 'center', padding: '0 12px',
        borderBottom: '1px solid #eee', background: '#fff', gap: 6,
      }}>
        {/* 返回 */}
        <button type="button" onClick={onBack} aria-label="返回" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#555', display: 'flex', alignItems: 'center', padding: 4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>

        {/* 标题 + 步骤 + 进度（对应句乐部「第1课 (2/218)」） */}
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
            {title || '视频学习'}
          </span>
          <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600, flexShrink: 0 }}>{stepLabel} · {curIdx + 1}/{Math.max(total, 1)} 句</span>
        </div>

        {/* 右侧图标组：顶部分类标签（设置/课文/列表/手柄/重置/帮助/全屏） */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <TBtn t="设置" onClick={() => setShowSettings(true)}>{Icon.gear}</TBtn>
          <TBtn t="课文全文" onClick={onOpenFullText}>{Icon.book}</TBtn>
          <TBtn t="句子列表" onClick={() => setShowList(true)}>{Icon.list}</TBtn>
          <TBtn t="切换游戏模式" onClick={onOpenMode}>{Icon.gamepad}</TBtn>
          <TBtn t="重置当前课程进度" onClick={() => setShowReset(true)}>{Icon.refresh}</TBtn>
          <TBtn t="快捷键帮助" onClick={() => setShowHelp(true)}>{Icon.help}</TBtn>
          <TBtn t="全屏" onClick={onFullscreen}>{Icon.fullscreen}</TBtn>
        </div>
      </div>

      {/* ===== 进度条（对应句乐部顶部进度条） ===== */}
      <div style={{ height: 3, background: '#f0f0f0', flexShrink: 0, position: 'relative' }}>
        <div style={{ height: '100%', width: pct + '%', background: '#6d28d9', transition: 'width .25s' }} />
      </div>

            {/* ===== 设置弹窗（完整复刻句乐部：声音/播放/答题/学习/听力/口语/视频/游戏特效/宠物/外观/快捷键 10 分类） ===== */}
      {showSettings && <SettingsModal onClose={() => { setShowSettings(false); onSettingsClose && onSettingsClose() }} defaultTab="声音" />}
{/* ===== 句子列表弹窗 ===== */}
      {showList && (
        <div style={overlay} onClick={() => setShowList(false)}>
          <div style={sheet} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#18181b' }}>句子列表（{total} 句）</div>
              <button type="button" onClick={() => setShowList(false)} aria-label="关闭" style={{ border: 'none', background: '#f5f5f5', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#666' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '56vh', overflowY: 'auto' }}>
              {sentences.length === 0 && (
                <div style={{ fontSize: 13, color: '#aaa', padding: '24px 0', textAlign: 'center' }}>暂无字幕断句，请先在右上角「生成字幕」</div>
              )}
              {sentences.map((s, i) => (
                <button
                  key={s.id ?? i}
                  type="button"
                  onClick={() => { onJump(i); setShowList(false) }}
                  style={{
                    textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: i === curIdx ? '#f5f3ff' : 'transparent', fontSize: 13, color: '#333',
                    display: 'flex', gap: 10, alignItems: 'baseline',
                  }}
                >
                  <span style={{ color: i === curIdx ? '#6d28d9' : '#9ca3af', fontWeight: i === curIdx ? 700 : 500, fontSize: 12, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ lineHeight: 1.6, color: i === curIdx ? '#6d28d9' : '#444' }}>{s.russian || s.text || ''}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== 快捷键帮助弹窗 ===== */}
      {showHelp && (
        <div style={overlay} onClick={() => setShowHelp(false)}>
          <div style={sheet} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#18181b' }}>快捷键</div>
              <button type="button" onClick={() => setShowHelp(false)} aria-label="关闭" style={{ border: 'none', background: '#f5f5f5', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#666' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#444' }}>
              {[
                ['空格', '播放 / 暂停（不按就一直播）'],
                ['← →', '上一句 / 下一句'],
                ['Enter', '听写时提交答案'],
                ['鼠标悬停单词', '查看生词释义'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <kbd style={{ minWidth: 74, padding: '5px 10px', background: '#f5f5f5', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, fontWeight: 700, textAlign: 'center', color: '#333' }}>{k}</kbd>
                  <span style={{ color: '#666' }}>{v}</span>
                </div>
              ))}
              {videoType === 'iframe' && (
                <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>注：当前为内嵌播放器，全屏请用播放器自带的 ⛶ 按钮</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== 重置确认弹窗 ===== */}
      {showReset && (
        <div style={overlay} onClick={() => setShowReset(false)}>
          <div style={{ ...sheet, maxWidth: 360, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, marginBottom: 10 }}>🔄</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#18181b', marginBottom: 8 }}>重置当前课程进度？</div>
            <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 20 }}>将回到第 1 句，并清空听写进度、评分记录。</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button type="button" onClick={() => setShowReset(false)} style={{ padding: '8px 20px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#555', fontSize: 14, cursor: 'pointer' }}>取消</button>
              <button type="button" onClick={() => { setShowReset(false); onReset() }} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: '#6d28d9', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>确认重置</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
