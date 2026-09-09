import React from 'react'

// 错误边界组件，防止组件崩溃导致整个应用白屏
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('应用渲染错误:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#F5F0EB',
          color: '#3D332C',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📖</div>
          <h1 style={{ fontSize: '20px', margin: '0 0 12px', fontWeight: 600 }}>页面加载遇到问题</h1>
          <p style={{ fontSize: '14px', color: '#86796D', margin: '0 0 20px', lineHeight: 1.6 }}>
            请尝试刷新页面，如果问题持续存在，请清除浏览器缓存后重试。
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              background: '#9B7B5E',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
          {this.state.error && (
            <details style={{ marginTop: '20px', fontSize: '12px', color: '#86796D', maxWidth: '100%', textAlign: 'left' }}>
              <summary>错误详情</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: '8px', padding: '12px', background: '#fff', borderRadius: '8px', overflow: 'auto', maxHeight: '200px' }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
