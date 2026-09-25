import { createContext, useContext } from 'react'

// 页眉插槽：页面可通过 usePageHeader() 注入自己的内容到 AppShell 的页眉那一行。
//   setHeaderLeft(node)     — 接管页眉左侧按钮（默认是"收起侧边栏"◧；详情页可换成返回箭头）
//   setTitleOverride(node) — 接管页眉标题（如"游戏商城▾"可点击下拉）
//   setHeaderRight(node)   — 注入标题右侧的工具栏（分类标签/搜索框等，紧贴标题）
// 用法：
//   const { setHeaderLeft, setTitleOverride, setHeaderRight } = usePageHeader()
//   useEffect(() => {
//     setHeaderLeft(<button ...>←</button>)
//     setTitleOverride(<details>...</details>)
//     setHeaderRight(<div className="flex items-center ...">...</div>)
//     return () => { setHeaderLeft(null); setTitleOverride(null); setHeaderRight(null) }
//   }, [])
export const PageHeaderCtx = createContext(null)
export const usePageHeader = () => useContext(PageHeaderCtx)
