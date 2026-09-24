import { useState, useMemo, useEffect } from 'react'
import Header from '../components/Header'
import { usePageHeader } from '../components/layout/PageHeaderContext'
import { COURSES } from '../data/gameMallData'

// ===== 游戏商城页面（第一步：筛选区 + 卡片占位） =====
export default function GameMall() {
  // 把导航+搜索注入全局页眉"游戏商城"右侧（headerRight 插槽）
  const { setHeaderRight } = usePageHeader()
  useEffect(() => {
    setHeaderRight(<Header />)
    return () => setHeaderRight(null)
  }, [setHeaderRight])

  // ① 排序状态（年级/版本已去掉：由投稿时 AI 自动生成，仅作卡片标签展示）
  const [currentSort, setCurrentSort] = useState('推荐')         // 排序：推荐 / 最热

  // ② 计算属性：排序（推荐 = 默认顺序；最热 = 学习人数降序）
  const filteredCourses = useMemo(() => {
    if (currentSort === '最热') {
      return [...COURSES].sort((a, b) => b.students - a.students)
    }
    return COURSES
  }, [currentSort])


  return (
    <main className="px-6 py-7 bg-base-100 min-h-full">
      <div className="max-w-[1200px] mx-auto">

        {/* ===== 工具行：共 X 个课程包 + 排序下拉（年级/版本筛选已去除，AI 投稿自动打标） ===== */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="text-sm text-gray-400">
            共 <span className="font-semibold text-gray-700">{filteredCourses.length}</span> 个课程包
          </div>
          <select
            value={currentSort}
            onChange={(e) => setCurrentSort(e.target.value)}
            className="select select-sm select-bordered text-sm"
          >
            <option value="推荐">推荐排序</option>
            <option value="最热">最热排序</option>
          </select>
        </div>

        {/* ===== 卡片列表（对标句乐部：封面框 + 封面图 + 底部信息区） ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredCourses.map((c) => (
            <div
              key={c.id}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              {/* 封面框：主题色渐变背景 + 大号标题 + 副标题 + 角标 */}
              <div className="relative bg-gradient-to-br from-violet-100 via-purple-100 to-purple-200 px-3 pt-5 pb-3">
                {c.badge && (
                  <span className="absolute top-2 left-2 z-10 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                    {c.badge}
                  </span>
                )}
                <div className="text-base font-extrabold leading-snug text-purple-900 line-clamp-2">{c.title}</div>
                <div className="mt-1 text-xs font-bold text-purple-700/80 line-clamp-1">{c.subtitle}</div>
              </div>
              {/* 封面图展示区 */}
              <div className="px-3 pt-3">
                <div
                  className="h-24 rounded-lg bg-gray-100 bg-cover bg-center transition-transform duration-200 group-hover:scale-[1.02]"
                  style={{ backgroundImage: `url(${c.cover})` }}
                />
              </div>
              {/* 底部信息区：分隔线 + 标题 + 作者信息 + 标签 */}
              <div className="mt-2 flex flex-1 flex-col border-t border-gray-100 px-3 pb-3 pt-2.5">
                <div className="text-sm font-bold text-gray-900 line-clamp-1">{c.title}</div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
                  {/* 首字母彩色圆形头像 */}
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {(c.author || '管').slice(0, 1)}
                  </span>
                  <span className="truncate">
                    {c.author} · {c.lessons} 课 · {c.students >= 10000 ? (c.students / 10000).toFixed(1) + '万' : c.students} 人在学
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-gray-300">{c.grade} · {c.textbook}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 空态 */}
        {filteredCourses.length === 0 && (
          <div className="py-16 text-center text-gray-400 text-sm">
            该筛选条件下暂无课程包，试试切换年级或版本
          </div>
        )}
      </div>
    </main>
  )
}
