/**
 * AuthSyncModal.jsx —— 学习者登录 / 注册弹窗（用于云端进度同步）。
 * 复用后端 /api/auth/login、/api/auth/register 与 adminStore 的 JWT 登录态。
 * 登录或注册成功后自动拉取云端数据合并、再上报本地整包（syncOnLogin）。
 */
import { useState } from 'react'
import { useAdminStore } from '../store/adminStore'
import { syncOnLogin } from '../lib/userDataSync'

export default function AuthSyncModal({ open, onClose }) {
  const loginPassword = useAdminStore(s => s.loginPassword)
  const register = useAdminStore(s => s.register)
  const [tab, setTab] = useState('login') // login | register
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setMsg('')
    const res = tab === 'login'
      ? await loginPassword(username, password)
      : await register(username, password, nickname)
    if (!res.ok) {
      setBusy(false)
      setMsg(res.error || '操作失败')
      return
    }
    // 登录成功：先合并云端，再上报本地；完成后关闭弹窗
    setMsg('登录成功，正在同步云端数据…')
    await syncOnLogin()
    setBusy(false)
    onClose && onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,12,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 20, padding: 26, boxShadow: '0 20px 50px rgba(26,26,30,.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1512' }}>账号同步</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, color: '#9A90B0', cursor: 'pointer', lineHeight: 1 }} aria-label="关闭">×</button>
        </div>
        <p style={{ fontSize: 12.5, color: '#7A6A60', marginTop: 6, marginBottom: 16 }}>
          登录后，学习进度、生词本、错题本等会自动在手机与电脑之间同步。
        </p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: '#F2EEE9', borderRadius: 12, padding: 4 }}>
          {['login', 'register'].map(k => (
            <button
              key={k}
              onClick={() => { setTab(k); setMsg('') }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 13.5, fontWeight: 700,
                background: tab === k ? '#fff' : 'transparent',
                color: tab === k ? '#1F1B2E' : '#7A6A60',
                boxShadow: tab === k ? '0 1px 4px rgba(26,26,30,.12)' : 'none',
              }}
            >
              {k === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            placeholder="用户名"
            value={username}
            onChange={e => setUsername(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="密码（至少 6 位）"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />
          {tab === 'register' && (
            <input
              placeholder="昵称（可选）"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              style={inputStyle}
            />
          )}
          <button
            onClick={submit}
            disabled={busy}
            style={{
              padding: '11px 0', border: 'none', borderRadius: 12, cursor: busy ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg,oklch(23.27% 0.0249 284.3),oklch(18% 0.0249 284.3))',
              color: '#fff', fontWeight: 700, fontSize: 14.5, opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? '处理中…' : (tab === 'login' ? '登录并同步' : '注册并登录')}
          </button>
          {msg && <div style={{ fontSize: 12.5, color: msg.includes('成功') ? '#047857' : '#ef4444' }}>{msg}</div>}
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  padding: '10px 12px', borderRadius: 12, border: '1px solid #E9E0D8', background: '#FBFAF8',
  fontSize: 14, color: '#1F1B2E', outline: 'none',
}
