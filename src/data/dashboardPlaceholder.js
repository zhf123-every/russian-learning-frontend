// 仪表盘静态占位数据
// 说明：后端目前只有课程包/单元/步骤数据，尚无“六格掌握度 / 连胜 / 热力 / 最近学习”统计 API。
// 第一批先用以下占位保证视觉完整；待后端新增 /api/dashboard/stats 后由 useDashboardData 替换。

// 六格掌握度（占位，0-100）
export const CASE_ABILITIES = [
  { label: '一格', value: 85 },
  { label: '二格', value: 70 },
  { label: '三格', value: 45 },
  { label: '四格', value: 60 },
  { label: '五格', value: 30 },
  { label: '六格', value: 55 },
]

// 连胜 / 今日目标（占位）
export const STREAK_DAYS = 12
export const TODAY_GOAL = { done: 3, total: 5 }

// 本周打卡（占位：done=已完成，today=今天）
export const WEEK_CHECK = [
  { day: '一', state: 'done' },
  { day: '二', state: 'done' },
  { day: '三', state: 'done' },
  { day: '四', state: 'done' },
  { day: '五', state: 'today' },
  { day: '六', state: '' },
  { day: '日', state: '' },
]

// 热力图（占位，确定性图案，0=空 1-4=靛蓝四阶）
export const HEAT_PATTERN = [
  0,0,1,2,0,0,1, 0,1,2,3,1,0,1, 1,2,3,2,1,0,0,
  0,1,2,3,3,2,1, 1,2,3,2,1,0,1, 0,0,1,2,1,0,0,
]

// 最近学习（占位）
export const RECENT_ACTIVITY = [
  { thumb: 'У3', thumbTone: 'brand', title: 'Урок 3 · 家族 2 第 5 步', time: '今天 09:20' },
  { thumb: '🎧', thumbTone: 'brandSoft', title: '精听《A Glass of Water》', time: '昨天 21:05' },
  { thumb: 'У2', thumbTone: 'brand', title: '完成 Урок 2 全部 3 个家族', time: '3 天前' },
]

// 六维语言能力雷达（占位，0-100）：词汇/听力/阅读/语法/口语/写作
export const SKILL_ABILITIES = [
  { label: '词汇', value: 78 },
  { label: '听力', value: 62 },
  { label: '阅读', value: 70 },
  { label: '语法', value: 55 },
  { label: '口语', value: 40 },
  { label: '写作', value: 48 },
]
