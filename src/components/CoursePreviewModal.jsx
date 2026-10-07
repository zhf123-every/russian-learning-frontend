import { useState, useMemo, useEffect } from 'react'

function CoursePreviewModal({ isOpen, steps, stats, onCancel, onSave }) {
  const [filter, setFilter] = useState('all')  // all / 积木 / 完整句

  // 按 gid 分组
  const grouped = useMemo(() => {
    const groups = {}
    steps.forEach(step => {
      const gid = step.gid || 'G_000'
      if (!groups[gid]) groups[gid] = []
      groups[gid].push(step)
    })
    return groups
  }, [steps])

  // 筛选后的 steps
  const filteredSteps = useMemo(() => {
    if (filter === 'all') return steps
    return steps.filter(s => s.type === filter)
  }, [steps, filter])

  // 筛选后的分组
  const filteredGrouped = useMemo(() => {
    const groups = {}
    filteredSteps.forEach(step => {
      const gid = step.gid || 'G_000'
      if (!groups[gid]) groups[gid] = []
      groups[gid].push(step)
    })
    return groups
  }, [filteredSteps])

  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onCancel()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onCancel}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-[90%] max-w-5xl flex flex-col"
        style={{ height: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">📊 课程生成预览</h2>
          <button 
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        {/* 统计 + 筛选 */}
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-700 mb-2">
            共 <b>{stats?.total_layers || 0}</b> 层、
            <b>{stats?.total_groups || 0}</b> 组、
            <b>{stats?.total_steps || 0}</b> 步
          </div>
          <div className="flex gap-2">
            <button 
              className={`btn btn-xs ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter('all')}
            >
              全部
            </button>
            <button 
              className={`btn btn-xs ${filter === '积木' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter('积木')}
            >
              只看积木
            </button>
            <button 
              className={`btn btn-xs ${filter === '完整句' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter('完整句')}
            >
              只看完整句
            </button>
          </div>
        </div>

        {/* 表格区域 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {Object.entries(filteredGrouped).map(([gid, groupSteps]) => (
            <div key={gid} className="mb-4">
              {/* GID 分隔线 */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 border-t border-gray-300"></div>
                <div className="text-xs font-bold text-gray-500">{gid}</div>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>

              {/* 表格行 */}
              <table className="w-full text-sm">
                <tbody>
                  {groupSteps.map((step, idx) => (
                    <tr 
                      key={step.seq}
                      className={`border-b border-gray-100 ${
                        step.type === '完整句' ? 'bg-blue-50' : 'bg-gray-50'
                      }`}
                    >
                      <td className="py-1 px-2 text-gray-500 w-12">{step.seq}</td>
                      <td className="py-1 px-2 w-20">
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
                      <td className="py-1 px-2 font-mono text-gray-800">{step.ru}</td>
                      <td className="py-1 px-2 text-gray-600">{step.zh}</td>
                      <td className="py-1 px-2 text-gray-500 text-xs w-24">{step.tag}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>取消</button>
          <button className="btn btn-primary btn-sm" onClick={onSave}>✅ 保存到数据库</button>
        </div>
      </div>
    </div>
  )
}

export default CoursePreviewModal
