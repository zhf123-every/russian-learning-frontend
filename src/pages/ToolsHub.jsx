import HubPage from '../components/layout/HubPage'
import { TOOLS_CARDS } from '../constants/navConfig'

export default function ToolsHub() {
  return <HubPage title="工具" subtitle="生词、词典与学习数据工具" cards={TOOLS_CARDS} />
}
