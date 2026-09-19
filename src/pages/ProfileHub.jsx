import HubPage from '../components/layout/HubPage'
import { ME_CARDS } from '../constants/navConfig'

export default function ProfileHub() {
  return <HubPage title="我的" subtitle="学习档案、打卡记录与设置（建设中）" cards={ME_CARDS} />
}
