# 俄语学习项目 vs Earthworm 原版 — 精确差异清单

> 生成时间：2026-09-16
> 对比对象：
> - **当前实现**：`russian-learning-frontend-main`（React 18 + react-router-dom v6 + zustand + Vite，纯 CSS + 内联样式）
> - **Earthworm 原版**：`earthworm-main/apps/client`（Nuxt 3 / Vue 3 + Pinia + Tailwind CSS 3 + daisyUI + shadcn CSS 变量 + @iconify 图标）
>
> 说明：跨框架对比（React ↔ Vue），下列"目标值"引用 Earthworm 对应 `.vue` 文件的 Tailwind class 或 CSS 变量；"当前值"引用 `RuQuest.jsx` 内联 `styles` 对象或 `styles.css`。
> 优先级：**P0**=核心体验/视觉一致性必须改；**P1**=明显差异建议改；**P2**=锦上添花。

---

## 1. RuQuest.jsx 答题主页

### 1.1 QuestionInput 单词槽样式

| 项 | 当前值（RuQuest.jsx） | Earthworm 目标值（QuestionInput.vue） | 优先级 | 难度 |
|---|---|---|---|---|
| 槽容器 | `slotRow`: `flex flex-wrap gap:10px justify-center items-baseline minHeight:66px maxWidth:680px position:relative padding:10px 4px` | `relative flex flex-wrap justify-center gap-2 transition-all`（gap-2=8px，无固定 minHeight/maxWidth，宽度自适应居中） | P1 | 简单 |
| 词槽高度 | `slotBox`: `minHeight:1.5em`（中字号20px≈30px），`lineHeight:1.35`，`padding:2px 7px 5px` | `h-[4rem]`（=64px 固定高度）+ `leading-none` | **P0** | 简单 |
| 词槽字号 | `S_WORD[size]`：小16 / 中20 / 大26（px） | `text-[3em]`（相对题干的 3em，固定不分级） | P1 | 中等 |
| 词槽圆角 | `borderRadius:2` | `rounded-[2px]`（一致） | — | — |
| 下划线 | `borderBottom:2px solid`（2px） | `border-b-2 border-solid`（一致） | — | — |
| 默认字色 | `col:#20202099`，`bcol:#D1D5DB` | `text-[#20202099] border-b-gray-300`（`#D1D5DB`≈gray-300，一致）；暗色 `dark:text-gray-300 dark:border-b-gray-400` | P2 | 简单 |
| 激活词色 | `#E879F9`（fuchsia-500 偏粉） | `text-fuchsia-500 border-b-fuchsia-500`（Tailwind fuchsia-500 = `#d946ef`） | P1 | 简单（改色值） |
| 错误词色 | `#EF4444`（=red-500，一致） | `text-red-500 border-b-red-500`（一致） | — | — |
| 错误词抖动 | `animation:ruqShake .3s ease`（错误即抖） | `animate-shake` **仅当 fix 模式**才加（Tailwind shake 0.5s） | P1 | 简单 |
| 槽宽度算法 | `minWidth:(word.length+0.8)ch`（按词长动态，最小2.4ch） | `minWidth:${inputWidth(w)}ch`，`inputWidth` 默认固定 **4ch**（`isShowWordsWidth()` 关时），开时用 `getWordWidth` | P1 | 中等 |
| 标点块 | `slotPunct`：`minHeight:1.5em`，无下划线，`padding:0 3px` | `h-[4rem] rounded-[2px] text-[3em] leading-none`（无 border-b，高度同词槽 4rem） | P1 | 简单 |
| isWord 判定 | `/[a-zA-Zа-яА-ЯёЁ0-9]/`（已扩展西里尔，正确适配） | `/[a-zA-Z0-9]/`（仅拉丁） | — | 当前为合理扩展，无需改 |
| 透明输入框 | `slotInput`：`absolute inset:0 w-full h-full opacity:0`，`fontSize:16` | `absolute h-full w-full opacity-0`（一致） | — | — |
| 词槽字重 | `fontWeight:600` | 无显式 font-weight（继承 normal） | P2 | 简单 |

### 1.2 Answer 答案页样式

| 项 | 当前值（RuQuest.jsx） | Earthworm 目标值（Answer.vue） | 优先级 | 难度 |
|---|---|---|---|---|
| 展示方式 | **浮层遮罩**：`answerMask` = `fixed inset:0 bg rgba(10,8,20,.45) backdrop-blur(2px) zIndex:40` + `answerCard`(宽560,padding30,圆角20) | **原地替换**：答案在题目居中区内直接渲染，**无全屏遮罩、无卡片**（`flex h-full items-center justify-center` 内 MainAnswer） | **P0** | 复杂 |
| 答案词行 | `answerWords`：`flex flex-wrap center gap:6px fontSize:40 fontWeight:600` | `ml-8 inline-flex flex-wrap items-center justify-center gap-1 text-5xl`（gap-1=4px，text-5xl=48px） | P1 | 简单 |
| 单词点击 | `answerWord`：`cursor-pointer padding:0 3px`，hover `.ruq-aw:hover{color:#E879F9}` | `cursor-pointer p-1 hover:text-fuchsia-500` | P2 | 简单 |
| 整句喇叭 | `answerSpeaker`：`marginLeft:8 fontSize:24 color:#9CA3AF`，用 emoji 🔊 | `UIcon i-ph-speaker-simple-high h-7 w-7 text-gray-500 hover:text-fuchsia-500` | P1 | 简单（换图标） |
| 音标行 | `answerSoundmark`：`fontSize:20 margin:10px 0 6px` | `my-6 text-xl text-gray-500`（text-xl=20px，my-6=24px 上下） | P2 | 简单 |
| 中文行 | `answerZhLine`：`fontSize:20 margin:6px 0 20px` | `my-6 text-xl text-gray-500` | P2 | 简单 |
| 再来一次按钮 | `answerBtn`：`borderRadius:8 border:1px solid #D1D5DB` | `btn btn-outline btn-sm`（daisyUI） | P2 | 简单 |
| 下一题按钮 | `answerBtnMain`：`bg:#8B5CF6 borderRadius:8` | `btn btn-outline btn-sm ml-6`（与"再来一次"同为 outline，间隔 ml-6=24px） | P1 | 简单 |
| 答对提示 | 多了 `answerOk` "√ Perfect! 完全正确"（绿色） | Earthworm 无此文案 | P2 | 简单（删/保留） |
| AI 拆解 | 保留 `rolesRow`（主谓宾定状分组逐词拆解） | Earthworm Answer **无 AI 逐词语法拆解**（当前为俄语扩展功能） | — | 当前为增强项，保留 |
| 内嵌模式 | 有 `answerMode:'inline'` 紧凑内嵌模式 | Earthworm 无此开关（仅一种答案展示） | P2 | 简单 |

### 1.3 Tool 工具栏结构

| 项 | 当前值（RuQuest.jsx） | Earthworm 目标值（Tool.vue） | 优先级 | 难度 |
|---|---|---|---|---|
| 工具栏容器 | `topBar`：`flex justify-between items-center padding:14px 26px gap:12 borderBottom:1px solid` | `relative flex items-center justify-between border-t border-solid border-gray-300 pb-3 pt-4 text-base dark:border-gray-600`（**border-t 顶部分隔线**） | P1 | 简单 |
| 左侧 | 课程名 +（hover 展开才显示）📖本课内容按钮 | 返回课程列表图标 `Expand h-7 w-7` + 当前课程信息 `课程名（x/y）` + `StudyVideoLink`，**常驻显示** | P1 | 中等 |
| 右侧按钮数 | 展开后 ~10 个文字按钮（模式/暂停/重置/全屏/Aa/游戏设置/错题本/宠物/设置） | **4 个图标**：游戏设置(仅听写) / 暂停 / 重置 / 排行榜，`gap-4`，均为 `UTooltip` 图标 | **P0** | 复杂 |
| 进度条 | `progressTrack`：`width:120 height:7 borderRadius:4` 小横条 | `CommonProgressBar h-6 p-[2px]`（整条通宽，h-6=24px）位于工具栏下方 | P1 | 简单 |
| 分数显示 | `topScore` 显示累计分（金色） | Earthworm 工具栏**无分数**（积分仅内部记录） | P2 | 简单 |
| 计时器 | `LearningTimer` 紧凑 ⏱ | `MainLearningTimer`（仅登录用户） | — | 已对齐 |
| 底部快捷键栏 | `bottomBar`：`fixed bottom:0 right:300`，一排 kbd 按钮（课表/播放/掌握/生词/撤销/提交/答案/上下题） | **Earthworm 无底部快捷键栏**；快捷键纯键盘绑定（registerShortcut），移动端按钮在 QuestionInput 内 `md:hidden` | **P0** | 复杂 |
| 排行榜 | 无 | `RankRankingBoard` + 排行榜图标入口 | P2 | 复杂（依赖后端） |

### 1.4 状态机实现差异

| 项 | 当前值 | Earthworm 目标值（composables/main/question.ts） | 优先级 | 难度 |
|---|---|---|---|---|
| 模式枚举 | `fixMode: 'input'/'fix'/'fix_input'`（字符串） | `enum Mode { Input, Fix, Fix_Input }`（值 `input`/`fix`/`fix-input`，**连字符**） | P2 | 简单 |
| 词数据结构 | `slotState={incorrect:[],active:-1}`（扁平数组 + 下标） | 每个词一个 `reactive Word{text,isActive,userInput,incorrect,start,end,id}` 对象 | P2 | 中等 |
| 判错规则 | `expectWordsOf` 去重音+小写归一，逐词 `normFor` 对比 | `markIncorrectWord`：`formatInputText`（小写+智能引号→直引号）对比 `word.text.toLowerCase()`，**不去重音** | — | 俄语适配差异，保留当前 |
| 提交成功后 | `setDone(true)`（题目级 done 标志），停在答案页 | `mode=Input` + `inputValue=""`，由 `useGameMode` 切换 isQuestion/isAnswer | P2 | 中等 |
| 空格提交 | **不支持**（空格仅分词，Enter 提交） | **空格在最后一词时提交**（`useSpaceSubmitAnswer`，lastWordIsActive） | **P0** | 中等 |
| 撤销栈 | 自实现 `undoStack`（Ctrl+Z，栈深50） | Earthworm 无撤销栈 | — | 当前增强项 |
| 自动揭示阈值 | `autoReveal`(错3次自动显答案) + `wrongRec` 错题阈值 | Earthworm 无（靠 `useAnswerError` 的 Tip 弹窗） | P2 | 简单 |

### 1.5 键盘交互差异

| 项 | 当前值 | Earthworm 目标值 | 优先级 | 难度 |
|---|---|---|---|---|
| 提交键 | Enter 提交（`!composing` 时） | Enter 提交 + 空格（末词）提交 | **P0** | 中等 |
| Ctrl+Z | 撤销上一步输入（当前扩展） | 无 | — | 当前增强 |
| Ctrl+Backspace | 删除上一词（Windows，已移植） | 同（已对齐） | — | — |
| Ctrl 拦截 | 全部 Ctrl `preventDefault` | 同（已对齐） | — | — |
| 方向键 | 输入框内全禁；**全局 ArrowLeft/Right 切题**（输入未聚焦时） | 输入框内全禁；**无全局左右切题**（切题靠底部按钮/键盘快捷键） | P2 | 简单 |
| Esc | 让输入框失焦 blur | Earthworm 无 | P2 | 简单 |
| 答案页快捷键 | Space/Enter → 下一题 | Space/Enter → 下一题（已对齐） | — | — |
| 可配置热键 | `SettingsModal` 可改键位，存 localStorage | `shortcutKey.ts` 自定义快捷键 + `CustomShortcutDialog` | P2 | 复杂 |
| IME 组合 | `composing.current` 防护（已对齐） | `isComposing`（已对齐） | — | — |
| mousedown/dblclick | `preventDefault` 仅聚焦（已对齐） | `preventCursorMove`（已对齐） | — | — |

### 1.6 布局结构差异

| 项 | 当前值 | Earthworm 目标值 | 优先级 | 难度 |
|---|---|---|---|---|
| 根容器 | `gameRoot`：`minHeight:100vh paddingBottom:110`，背景 `T.grad`（light=线性渐变 #F7F6FB→#FFF；fallback 深色 radial） | 页面级 `bg-white text-slate-600 dark:bg-theme-dark(#05051d)`，组件级无渐变 | P1 | 简单 |
| 主轴方向 | `gameMain`：`flex flex-col minHeight:calc(100vh-60px) paddingRight:300`（**为 AI 侧栏预留 300px**） | `flex w-full flex-col pt-2` → Tool + Game，**无侧栏预留** | **P0** | 复杂 |
| 居中区 | `center`：`flex flex-col items-center justify-center padding:0 30px` | 题目区 `flex h-full items-center justify-center`（一致思路） | — | — |
| 背景色 | 4 套 THEME（light/dark/warm/green）内联渐变 | Tailwind 暗色 class + 纯白，仅 light/dark 两态 | P2 | 中等 |
| AI 侧栏 | `aiPanel` 固定右侧 300px + 悬浮 💬 FAB | **无 AI 侧栏**（当前为扩展功能） | — | 当前增强 |

---

## 2. HomePage.jsx 首页

| 项 | 当前值 | Earthworm 目标值 | 优先级 | 难度 |
|---|---|---|---|---|
| 整体布局 | 居中单列：hero 区（Изучаем русский / RussianLearning 标题 / АБВГДЕЁЖ 装饰字母）+ 4 张功能卡片网格 | 登录后 `mt-8 flex justify-between`：**左列头像卡(头像+用户名+MembershipBadge)** + **右列(最近课程包 + CalendarGraph)** | P1 | 复杂 |
| 头像区 | 无 | 左列 `hidden w-72 md:block`，圆形头像 `h-56 w-56 rounded-full` + 用户名 `text-3xl` + 会员徽章 | P2 | 中等 |
| 最近课程包 | 无（首页是功能入口卡） | `HomeRecentCoursePack` + "更多课程包"链接 | P1 | 复杂（依赖后端课程包数据） |
| 学习热力图 | 有 `CalendarGraph` 组件但**未挂到首页** | `HomeCalendarGraph` 直接展示在首页右列 | P1 | 中等 |
| 顶部导航 | 简单 topbar：📖 Russian learning + 首页/生词本/词典/统计 | `Navbar` 全局导航 + `UserMenu` 下拉 + `Footer` 页脚 | P2 | 中等 |
| 营销落地页 | 无 | 未登录时 Landing：Banner/Features/Comments/Contact/PayCard/Questions/Introduce/NoticeBar | P2 | 复杂 |
| 字体 | 系统无衬线 | Nunito（CustomFont）圆润字体 | P2 | 简单 |

---

## 3. quest 组件逐个对比

### 3.1 LearningTimer.jsx
- **当前**：传入 `elapsed/paused/active/theme`，紧凑(⏱ mm:ss)与展开(当前用时 + 今日累计分钟)两态，按日 localStorage 持久化。
- **Earthworm**：`LearningTimer.vue` + `courseTimer`/`learningTimeTracker` composable，仅登录用户显示。
- **差异**：功能已对齐；当前多了"今日累计分钟"展示（Earthworm 今日时长在 Summary 弹窗内）。**优先级 P2 / 难度简单**。

### 3.2 GamePauseModal.jsx
- **当前**：暂停图标呼吸动画 + 计时/进度信息 + 随机鼓励语 + 返回课表/继续游戏 + Esc/空格快捷键提示。
- **Earthworm**：`GamePauseModal.vue`，随机鼓励语 + 继续游戏。
- **差异**：结构基本对齐；当前 UI 更重（大图标+呼吸动画）。**优先级 P2 / 难度简单**。

### 3.3 GameSettingModal.jsx
- **当前**：播放倍速(0.5~2x)/次数(1~4)/间隔(1~10s)，存 `rlearn_quest_toolbar`。
- **Earthworm**：`GameSettingModal.vue`（听写模式设置）。
- **差异**：功能对齐。**优先级 — / 难度 —**。

### 3.4 SummaryModal.jsx
- **当前**：SSS~C 评级徽章 + 3 张 SVG 环形图(准确率/一次答对/错误率) + canvas 撒花 + 俄语每日一句 + 6 按钮(打卡图/错题/再来一次/再来一组/课程列表/下一课)。
- **Earthworm**：`Summary.vue` 为 UModal，"🎉 恭喜" + 金山词霸每日一句(英中对照) + 总题数/用时 + 今日学习分钟 + 按钮(生成打卡图/再来一次/课程列表)。
- **差异**：
  - 当前评级/环形图/撒花为自绘增强；Earthworm 更简洁。**P2 / 中等**
  - **打卡分享图**：当前 `onShare` 仅 `toast('开发中')` 占位；Earthworm 用 `satori`+`canvas-confetti` 真实生成打卡图。**P1 / 复杂**。

### 3.5 CourseContentsModal.jsx
- **当前**：本课目录(全部/已掌握/未掌握筛选) + 句子列表 + 发音按钮 + 跳转 + 当前高亮。
- **Earthworm**：`CourseContents.vue`（课程题目列表 + 跳转）。
- **差异**：功能对齐，当前多了筛选与掌握标记。**优先级 —**。

### 3.6 DictationControls.jsx
- **当前**：盲听(正常速)/慢听(0.5x)/显示提示 三按钮 + 播放参数指示。
- **Earthworm**：`dictation/DictationMode.vue` + `AnswerTip.vue`（`absolute left-1/2 top-36 w-3/4` 卡片浮层显示英文答案）。
- **差异**：当前答案提示是答题区内联浮卡；Earthworm AnswerTip 是绝对定位 `top-36` 悬浮卡。**P2 / 简单**。

### 3.7 WrongBookModal.jsx
- **当前**：独立错题本（查看/按原因筛选/搜索/删除/发音/标记掌握），存 `rlearn_quest_wrongbook`。
- **Earthworm**：**无对应组件**（Earthworm 用 `/mastered-elements` 页面管理已掌握元素，无"错题本"概念）。
- **差异**：当前为俄语扩展功能。**优先级 —**。

### 3.8 DesktopPet.jsx
- **当前**：可拖拽桌面宠物（7 种 mood + 随机台词 + 答对/答错互动）。
- **Earthworm**：**无对应组件**。
- **差异**：当前扩展功能。**优先级 —**。

### 3.9 CalendarGraph.jsx
- **当前**：GitHub 风格 52 周热力图，读 `rlearn_learning_time_*`，紫色系。
- **Earthworm**：`Home/CalendarGraph.vue`，读后端 `user-learning-activity`。
- **差异**：当前用 localStorage 自绘；Earthworm 接后端接口。**P2 / 复杂**（数据来源差异）。

### 3.10 CheckInPanel.jsx
- **当前**：每日签到 + 连续奖励里程碑(3/7/14/30/100天)。
- **Earthworm**：**无对应组件**。
- **差异**：当前扩展功能。**优先级 —**。

---

## 4. 全局样式

| 项 | 当前值 | Earthworm 目标值 | 优先级 | 难度 |
|---|---|---|---|---|
| 样式方案 | 纯 CSS（`styles.css` ~1426 行）+ 组件内 `styles` 对象内联 | Tailwind CSS 3 + daisyUI + shadcn CSS 变量（`globals.css`） | **P0**（架构层，迁移成本高） | 复杂 |
| 非答题页配色 | `styles.css` `:root` 奶咖燕麦：`--bg:#F5F0EB --accent:#9B7B5E`（暖棕） | 白底 `--background:0 0% 100%` + 深色 `#05051d`，中性 slate 灰 | P1 | 复杂 |
| 答题页配色 | RuQuest 内 `THEMES` 对象 4 套（light/dark/warm/green），brand=`#7C5CFC` | 无 THEMES 对象；用 Tailwind 工具类 + fuchsia-500 强调色 | P1 | 中等 |
| 主强调色 | light brand `#7C5CFC`（紫）；暗色按钮 `#8B5CF6`；激活词 `#E879F9` | 激活/hover `fuchsia-500`(#d946ef)；主按钮 daisyUI `btn-primary` | P1 | 简单 |
| 字体 | 系统栈 `-apple-system,Segoe UI,PingFang SC...`；Nunito/Fredoka 仅 Google Fonts 按需加载，**未本地打包** | 本地 `assets/font/Nunito/*.ttf` 注册为 `CustomFont`（`fontFamily.customFont`），还有 SourceHanSerif | P1 | 简单 |
| 按钮风格 | 自绘（`borderRadius:12` + `#8B5CF6` 实心） | daisyUI `.btn .btn-outline .btn-sm .btn-primary` | P2 | 中等 |
| 暗色模式 | `themeMode` 手动切 + bgColor 暖/绿 | `darkMode:"class"`，根 `.dark` CSS 变量切换 | P2 | 中等 |

---

## 5. 缺失组件（Earthworm 有、当前项目没有）

| Earthworm 组件 | 作用 | 当前项目对应 | 优先级 | 难度 |
|---|---|---|---|---|
| `main/MasteredBtn.vue` | 题目/答案区内联"已掌握"按钮 | 无（掌握标记只在底部快捷键 + CourseContents） | P1 | 中等 |
| `main/PrevAndNextBtn.vue` | 上一题/下一题按钮组 | 底部 `‹ ›` 小箭头 | P2 | 简单 |
| `main/Tips.vue` | 答题提示气泡 | 内联 `inputHint`/`wrongTip` | P2 | 简单 |
| `main/Share.vue` + `shareImage/*` | satori 生成打卡分享图 | `onShare` toast 占位 | P1 | 复杂 |
| `main/StudyVideoLink.vue` | 当前课程视频链接 | 无 | P2 | 中等 |
| `main/AnswerTip.vue` | 听写答案浮卡 | 已内联在 RuQuest | P2 | 简单 |
| `main/Tool.vue`（独立组件） | 顶部工具栏 | 内联在 RuQuest topBar | P2 | 中等 |
| `main/Game.vue` | 模式分发容器 | RuQuest 内 `mode==='dictation'` 分支 | P2 | 中等 |
| `rank/RankingBoard.vue` 等 | 排行榜/榜单徽章 | 无 | P2 | 复杂（依赖后端） |
| `Navbar.vue`/`Footer.vue`/`UserMenu.vue` | 全局导航/页脚/用户菜单 | 简单 topbar | P2 | 中等 |
| `Landing/*`（Banner/Features/Comments/PayCard...） | 未登录营销落地页 | 无 | P2 | 复杂 |
| `common/ProgressBar.vue` | 通用进度条 | 自绘 `progressTrack` | P2 | 简单 |
| `common/Dialog.vue` | 通用确认弹窗（重置确认） | `window.confirm` | P2 | 简单 |
| `CustomShortcutDialog.vue` | 自定义快捷键弹窗 | `SettingsModal` 内已含 | — | — |
| `Loading.vue` | 加载页 | 自绘 loadRoot | — | — |
| `mode/dictation/*`、`mode/chineseToEnglish/*` | 模式包装组件 | RuQuest 内分支 | P2 | 中等 |

---

## 6. 路由差异

| 项 | 当前值（App.jsx react-router v6） | Earthworm 目标值（Nuxt 文件路由） | 优先级 | 难度 |
|---|---|---|---|---|
| 路由方式 | 声明式 `<Route>` | 文件式 `pages/*.vue` | — | 框架差异 |
| 首页 | `/` → HomePage | `/` → 已登录 Home / 未登录 Landing | P2 | 中等 |
| 答题页 | `/quest` → RuQuest（单页含课程商城/课表/答题/结算全部 phase） | `/game/[coursePackId]/[id]`（游戏页独立，课程包与课程 ID 在 URL） | P1 | 复杂 |
| 课程包 | 无 `/course-pack` 层级；`/course` 自绘商城 | `/course-pack`（列表）、`/course-pack/[id]`（课表） | P1 | 复杂 |
| 已掌握词 | 无路由（WrongBookModal 内弹窗） | `/mastered-elements` | P2 | 中等 |
| 用户设置 | 无 | `/User/Setting.vue` | P2 | 中等 |
| 登录回调 | 无 | `/callback.vue`（Logto OAuth）+ `middleware/auth.ts` 路由守卫 | P2 | 复杂（依赖 Logto） |
| 其他页 | `/custom` `/method` `/square` `/study` `/vocab` `/dictionary` `/tutor` `/profile` | 无（Earthworm 是纯句子跟读，无这些功能） | — | 当前为俄语扩展 |

---

## 7. 依赖差异（package.json）

| 项 | 当前值 | Earthworm 目标值 | 优先级 | 难度 |
|---|---|---|---|---|
| 框架 | react 18.3 + react-dom + react-router-dom 6 | nuxt 3.9 + vue 3.4 + vue-router | — | 框架差异 |
| 状态管理 | zustand 4.5 | pinia 2.1 | — | 框架差异 |
| 样式 | 无 Tailwind | tailwindcss 3.4 + daisyui 4.6 + @nuxt/ui | P0 | 复杂 |
| 图标 | emoji（🔊⏱⚙） | @iconify-json/ph（@iconify-json/ph） | P1 | 中等 |
| Toast | 自绘 `lib/toast.js` | vue-sonner 1.1 | P2 | 简单 |
| 撒花 | 自绘 canvas | canvas-confetti 1.9 | P2 | 简单 |
| 分享图 | 无 | satori 0.10 | P2 | 复杂 |
| 日期 | 无 | dayjs 1.11 | P2 | 简单 |
| 模糊搜索 | 无 | fuse.js 7 | P2 | 简单 |
| 测试 | vitest + @testing-library/react | vitest + @vue/test-utils + cypress | P2 | — |

---

## 8. 优先级汇总（建议改造顺序）

### P0 — 核心答题体验必须对齐（视觉/手感一致性）
1. **词槽高度**：`minHeight:1.5em` → `h-[4rem]`(64px)，标点块同高。（§1.1）
2. **答案页浮层遮罩**：去 `answerMask` 全屏遮罩，改为答题区原地替换答案。（§1.2）
3. **工具栏结构**：从 10 个文字按钮 + hover 收起 → 4 个常驻图标 + 通宽进度条。（§1.3）
4. **底部快捷键栏**：去掉 `bottomBar` fixed 快捷键排，改为纯键盘 + 移动端按钮。（§1.3）
5. **空格提交**：支持末词空格提交（Earthworm `useSpaceSubmitAnswer`）。（§1.4/§1.5）
6. **为 AI 侧栏预留的 300px 布局**：答题区不预留右侧栏宽度。（§1.6）
7. **样式架构**：Tailwind + daisyUI 引入（长期，可分阶段）。（§4）

### P1 — 明显差异建议对齐
8. 激活词色 `#E879F9` → `fuchsia-500`(#d946ef)。
9. 词槽宽度算法对齐 Earthworm（默认 4ch）。
10. 错误词抖动仅 fix 模式触发。
11. Answer 整句喇叭换 @iconify 图标、字号对齐 text-5xl。
12. 工具栏进度条改通宽 `h-6`。
13. 打卡分享图真实生成（satori）。
14. 首页接最近课程包 + 热力图。
15. 本地打包 Nunito 字体。
16. MasteredBtn 内联到答题区。

### P2 — 锦上添花
17. 顶部 border-t（非 border-b）、暗色两态、Navbar/Footer、排行榜、Landing 营销页、可配置快捷键弹窗等。

---

*备注：本清单为只读分析产出，未对任何源码做修改。"当前为扩展功能"项（AI 侧栏、错题本、桌面宠物、签到、乱序/口语/阅读模式、AI 语法拆解）为俄语项目相对 Earthworm 的增量，按产品决策保留或裁剪。*
