import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch, authBody } from '../lib/api'

function CoursePreviewPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const courseId = searchParams.get('course_id') || ''
  const unitId = searchParams.get('unit_id') || ''
  
  const [steps, setSteps] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')  // all / 积木 / 完整句

  useEffect(() => {
    // 从后端拉取任务结果
    const fetchResult = async () => {
      try {
        const resp = await apiFetch('/api/admin/course/task-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(authBody({ task_id: taskId })),
        })
        const data = await resp.json()
        
        if (data.ok && data.status === 'done') {
          const result = data.result || {}
          setSteps(result.steps || [])
          setStats({
            total_layers: result.total_layers || 0,
            total_groups: result.total_groups || 0,
            total_steps: result.total_steps || 0
          })
        } else {
          alert('任务未完成或已过期')
          navigate('/admin')
        }
      } catch (e) {
        alert('加载失败: ' + (e.message || ''))
        navigate('/admin')
      }
      setLoading(false)
    }
    fetchResult()
  }, [taskId, navigate])

  // 编辑单元格
  function handleCellChange(seq, field, value) {
    setSteps(prev => prev.map(s => 
      s.seq === seq ? { ...s, [field]: value } : s
    ))
  }

  // 保存（3d 再实现真保存）
  async function handleSave() {
    setSaving(true)
    alert('保存功能待实现（子任务3d）')
    setSaving(false)
    // navigate('/admin')
  }

  // 筛选
  const filteredSteps = filter === 'all' 
    ? steps 
    : steps.filter(s => s.type === filter)

  if (loading) {
    return <div className="p-8 text-center">加载中...</div>
  }

  return (
    <div className="min-h-full bg-base-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">📊 课程预览（可编辑）</h1>
            <div className="text-sm text-gray-500 mt-1">
              共 <b>{stats?.total_layers || 0}</b> 层、
              <b>{stats?.total_groups || 0}</b> 组、
              <b>{stats?.total_steps || 0}</b> 步
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')}>
            ← 返回后台
          </button>
        </div>

        {/* 筛选按钮 */}
        <div className="flex gap-2 mb-4">
          <button 
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('all')}
          >
            全部
          </button>
          <button 
            className={`btn btn-sm ${filter === '积木' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('积木')}
          >
            只看积木
          </button>
          <button 
            className={`btn btn-sm ${filter === '完整句' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('完整句')}
          >
            只看完整句
          </button>
        </div>

        {/* 可编辑表格 */}
        <div className="card bg-base-100 shadow-sm" style={{ borderRadius: 12 }}>
          <div className="overflow-x-auto" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <table className="table table-sm w-full">
              <thead className="sticky top-0 bg-gray-100">
                <tr>
                  <th className="w-12">序号</th>
                  <th className="w-20">类型</th>
                  <th>俄语内容</th>
                  <th>中文翻译</th>
                  <th className="w-32">语法标签</th>
                  <th className="w-20">组ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredSteps.map(step => (
                  <tr key={step.seq} className={step.type === '完整句' ? 'bg-blue-50' : ''}>
                    <td>{step.seq}</td>
                    <td>
                      <span 
                        className={`inline-block px-2 py-0.5 rounded text-xs ${
                          step.type === '完整句' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {step.type}
                      </span>
                    </td>
                    <td>
                      <input 
                        className="input input-bordered input-sm w-full font-mono"
                        value={step.ru} 
                        onChange={e => handleCellChange(step.seq, 'ru', e.target.value)}
                      />
                    </td>
                    <td>
                      <input 
                        className="input input-bordered input-sm w-full"
                        value={step.zh} 
                        onChange={e => handleCellChange(step.seq, 'zh', e.target.value)}
                      />
                    </td>
                    <td>
                      <input 
                        className="input input-bordered input-sm w-full text-xs"
                        value={step.tag || ''} 
                        onChange={e => handleCellChange(step.seq, 'tag', e.target.value)}
                      />
                    </td>
                    <td className="text-xs text-gray-500">{step.gid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 mt-4">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')}>
            返回
          </button>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '✅ 保存到数据库'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CoursePreviewPage
