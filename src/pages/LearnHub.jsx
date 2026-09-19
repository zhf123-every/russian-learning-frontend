import HubPage from '../components/layout/HubPage'
import { LEARN_CARDS } from '../constants/navConfig'

export default function LearnHub() {
  return <HubPage title="学习" subtitle="选择一种学习方式，开始今天的俄语训练" cards={LEARN_CARDS} />
}
