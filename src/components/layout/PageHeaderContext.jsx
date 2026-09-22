import { createContext, useContext } from 'react'

// 页眉插槽：页面可通过 usePageHeader() 注入自己的内容到 AppShell 的页眉那一行。
//   setTitleOverride(node) — 接管页眉标题（如"解锁游戏▾"可点击下拉）
//   setHeaderRight(node)   — 注入标题右侧的工具栏（分类标签/搜索框等，紧贴标题）
// 用法：
//   const { setTitleOverride, setHeaderRight } = usePageHeader()
//   useEffect(() => {
//     setTitleOverride(<details>...</details>)
//     setHeaderRight(<div className="flex items-center ...">...</div>)
//     return () => { setTitleOverride(null); setHeaderRight(null) }
//   }, [])
export const PageHeaderCtx = createContext(null)
export const usePageHeader = () => useContext(PageHeaderCtx)
