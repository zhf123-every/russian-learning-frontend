# Earthworm 学习主界面复刻规格 —— Answer / Tool / Game 及相关子组件

> 来源：`earthworm-main/apps/client/components/main/`
> 范围：Game.vue（页面壳）、Tool.vue（顶栏工具栏）、Answer.vue（答案展示态），以及 LearningTimer / Tips / Share / StudyVideoLink / MasteredBtn / PrevAndNextBtn / Summary 七个直接相关子组件。
> 本规格只描述源码中可见的模板、样式、事件与数据流，不含未读到的 composable / store 内部实现（只标注其对外契约）。

---

## 0. 组件树与整体关系

```
Game.vue  (页面壳 / 模式路由)
├── ModeDictationMode            (v-if isDictationMode，未读文件)
├── ModeChineseToEnglishMode     (v-else-if isChineseToEnglishMode，未读文件)
│     └── 内部渲染 QuestionInput / Answer / Tips 等
├── MainLearningTimer            (v-if isAuthenticated，悬浮计时器)
├── MainTips                     (快捷键提示条 + 上一题/下一题悬浮按钮)
│     └── MainPrevAndNextBtn     (绝对定位左右翻页箭头)
├── MainSummary                   (完成课程结算弹窗 + 彩带动画 canvas)
├── MainShare                    (分享打卡图弹窗)
├── GamePauseModal               (v-if isAuthenticated，暂停弹窗)
└── MainGameSettingModal         (听写模式游戏设置弹窗)
```

Answer.vue 在「答题 → 提交 → 展示答案」流程中，是当前 Statement 处于 **answer 态**时由模式组件渲染的内容区；Tool.vue 是页面底部/顶部固定的工具条（含进度条）。三者通过 store（`useCourseStore` / `useGameStore`）与 composables（`useGameMode`、`useAnswer`、`useMastered` 等）解耦，**组件间不直接传 props**，主要靠 provide/store 与事件注册。

---

## 1. Game.vue —— 页面壳

### 1.1 完整模板结构

```vue
<template>
  <template v-if="isDictationMode()">
    <ModeDictationMode />
  </template>
  <template v-else-if="isChineseToEnglishMode()">
    <ModeChineseToEnglishMode />
  </template>

  <MainLearningTimer v-if="isAuthenticated()"></MainLearningTimer>
  <MainTips />
  <MainSummary />
  <MainShare />
  <GamePauseModal v-if="isAuthenticated()"></GamePauseModal>
  <MainGameSettingModal />
</template>
```

### 1.2 模式切换逻辑

- 两个布尔函数来自 `useGamePlayMode()`：`isDictationMode()`、`isChineseToEnglishMode()`。
- 二者互斥（`v-if` / `v-else-if`），决定渲染哪种学习模式主区。
- 悬浮/弹窗类组件（Timer、Tips、Summary、Share、GamePauseModal、GameSettingModal）**与模式无关**，始终挂载（除 Auth 守卫外）。

### 1.3 生命周期

- `onMounted`：
  - `courseTimer.reset()` —— 重置课程计时器。
  - `gameStore.startGame()` —— 进入游戏状态。
- `onUnmounted`：
  - `gameStore.exitGame()` —— 退出游戏。

### 1.4 样式

Game.vue 自身无 `<style scoped>`，无布局 class，纯编排组件。

---

## 2. Tool.vue —— 工具栏（含进度条）

### 2.1 完整模板结构

```vue
<template>
  <!-- 工具条主行：左/右两组按钮，顶部分隔线 -->
  <div class="relative flex items-center justify-between
              border-t border-solid border-gray-300 pb-3 pt-4 text-base
              dark:border-gray-600">
    <!-- 左侧组 -->
    <div class="flex items-center">
      <NuxtLink
        class="clickable-item flex items-center justify-center"
        :href="`/course-pack/${courseStore.currentCourse?.coursePackId}`"
      >
        <UTooltip text="课程列表">
          <IconsExpand class="h-7 w-7" />
        </UTooltip>
      </NuxtLink>

      <div class="clickable-item ml-4" @click="openCourseContents">
        <UTooltip text="课程题目列表">
          {{ currentCourseInfo }}
        </UTooltip>
      </div>

      <MainStudyVideoLink :video="courseStore.currentCourse?.video" />
    </div>

    <!-- 右侧组 -->
    <div class="flex items-center gap-4">
      <!-- 游戏设置（仅听写模式） -->
      <div @click="openGameSettingModal" v-if="isDictationMode()">
        <UTooltip text="游戏设置">
          <UIcon name="i-ph-gear" class="clickable-item h-6 w-6" />
        </UTooltip>
      </div>

      <!-- 暂停（仅登录） -->
      <div v-if="isAuthenticated()" @click="pauseGame">
        <UTooltip text="暂停游戏" :shortcuts="parseShortcut(shortcutKeys.pause)">
          <UIcon name="i-ph-pause" class="clickable-item h-6 w-6" />
        </UTooltip>
      </div>

      <!-- 重置当前课程进度 -->
      <div @click="handleDoAgain">
        <UTooltip text="重置当前课程进度">
          <UIcon name="i-ph-arrow-counter-clockwise" class="clickable-item h-6 w-6" />
        </UTooltip>
      </div>

      <!-- 排行榜 -->
      <div @click="rankingStore.showRankModal">
        <UTooltip text="排行榜">
          <UIcon name="i-ph-ranking" class="clickable-item h-6 w-6" />
        </UTooltip>
      </div>
    </div>

    <!-- 课程题目列表抽屉（v-model 双向控制开关） -->
    <MainCourseContents v-model:isOpen="isOpenCourseContents"></MainCourseContents>
  </div>

  <!-- 进度条（兄弟节点，在工具条下方） -->
  <CommonProgressBar class="h-6 p-[2px]" :percentage="currentPercentage" />
  <RankRankingBoard />
</template>
```

### 2.2 精确样式值

工具条主容器：
- `position: relative`；display flex；`align-items: center`；`justify-content: space-between`
- `border-top: 1px solid; border-style: solid`；颜色 light=`#d1d5db`（gray-300），dark=`#4b5563`（gray-600）
- `padding-bottom: 0.75rem (12px)`；`padding-top: 1rem (16px)`；`font-size: 1rem (16px)`

左侧组：`display:flex; align-items:center`。
- 课程列表 NuxtLink：`clickable-item flex items-center justify-center`。
- 课程题目列表：`clickable-item margin-left:1rem (16px)`。
- IconsExpand 图标：`height:1.75rem(28px); width:1.75rem(28px)`。

右侧组：`display:flex; align-items:center; gap:1rem(16px)`。
- 三个 UIcon 均为 `clickable-item` + `height:1.5rem(24px); width:1.5rem(24px)`。

`clickable-item`（scoped style，用 `@apply`）：
- `cursor: pointer`；`user-select: none`
- hover 时 `color: #d946ef`（fuchsia-500）

进度条 CommonProgressBar：`height:1.5rem(24px); padding:2px`，`:percentage` 为数值。

### 2.3 交互逻辑

| 元素 | 事件 | 行为 |
|---|---|---|
| 课程列表图标 | 路由跳转 | `/course-pack/{currentCourse.coursePackId}` |
| 课程题目列表文字 | `@click="openCourseContents"` | 打开 MainCourseContents 抽屉（`isOpenCourseContents` ref） |
| B 站视频图标 | `:href="video"` target=_blank | 新窗口打开视频，tooltip「边看边练」 |
| 齿轮（听写模式才显示） | `@click="openGameSettingModal"` | 打开游戏设置弹窗 |
| 暂停（登录才显示） | `@click="pauseGame"` | 暂停游戏；tooltip 带快捷键 `shortcutKeys.pause` |
| 重置环形箭头 | `@click="handleDoAgain"` | 弹确认 Dialog「重置进度 / 是否确认重置当前课程进度？」 |
| 排行榜图标 | `@click="rankingStore.showRankModal"` | 打开排行榜弹窗 |

`handleDoAgain` 确认后：
1. `courseStore.doAgain()`
2. `clearQuestionInput()`
3. `showQuestion()`
4. `courseTimer.reset()`
5. `setTimeout(focusInput, 300)`（等 200ms dialog 关闭动画后再聚焦输入框）

`handleDoAgain` 取消时：同样 `setTimeout(focusInput, 300)`。

### 2.4 Tooltip 实现

- 统一用 Nuxt UI 的 `<UTooltip text="..." />`，部分带 `:shortcuts="parseShortcut(shortcutKeys.xxx)"` 用于在 tooltip 内展示快捷键。
- 暂停按钮 tooltip 显式传入 `:shortcuts`；其余按钮只传 `text`。

### 2.5 派生状态（computed）

- `currentCourseInfo`：`"{title}（{currentSchedule}/{visibleStatementsCount}）"`
- `currentSchedule`：`visibleStatementIndex + 1`
- `currentPercentage`：
  - 若 `courseStore.isAllDone()` → `100`
  - 否则 → `(visibleStatementIndex / visibleStatementsCount * 100).toFixed(2)`（字符串）

### 2.6 引用的外部子组件 / composable 契约

- `UTooltip`、`UIcon`、`NuxtLink`、`IconsExpand`、`MainCourseContents`、`MainStudyVideoLink`、`CommonProgressBar`、`RankRankingBoard`
- `useModal()` 打开 `~/components/common/Dialog.vue`
- composables：`useQuestionInput`、`courseTimer`、`useGameMode`、`clearQuestionInput`、`useCourseContents`、`useGamePause`、`useGameSetting`、`useRanking`、`useGamePlayMode`、`useShortcutKeyMode`、`isAuthenticated`、`useCourseStore`

---

## 3. Answer.vue —— 答案展示态

### 3.1 完整模板结构

```vue
<template>
  <div class="text-center">
    <!-- 英文单词逐词渲染 + 喇叭图标 -->
    <div class="ml-8 inline-flex flex-wrap items-center justify-center gap-1 text-5xl">
      <span
        v-for="word in words"
        :key="word"
        class="cursor-pointer p-1 hover:text-fuchsia-500"
        @click="handlePlayWordSound(word)"
      >{{ word }}</span>
      <UIcon
        name="i-ph-speaker-simple-high"
        class="ml-1 inline-block h-7 w-7 cursor-pointer text-gray-500 hover:text-fuchsia-500"
        @click="handlePlayEnglishSound"
      ></UIcon>
    </div>

    <!-- 音标 -->
    <div class="my-6 text-xl text-gray-500">
      {{ courseStore.currentStatement?.soundmark }}
    </div>

    <!-- 中文释义 -->
    <div class="my-6 text-xl text-gray-500">
      {{ courseStore.currentStatement?.chinese }}
    </div>

    <!-- 操作按钮区 -->
    <div class="space-y-3">
      <div>
        <button class="btn btn-outline btn-sm" @click="showQuestion">再来一次</button>
        <button class="btn btn-outline btn-sm ml-6" @click="goToNextQuestion">下一题</button>
      </div>
      <div class="md:hidden">
        <MainMasteredBtn></MainMasteredBtn>
      </div>
    </div>
  </div>
</template>
```

### 3.2 精确样式值

外层：`text-align:center`。

英文行：
- `margin-left:2rem(32px)`；`display:inline-flex`；`flex-wrap:wrap`；`align-items:center`；`justify-content:center`；`gap:0.25rem(4px)`；`font-size:3rem(48px)`
- 每个 `<span>`：`cursor:pointer`；`padding:0.25rem(4px)`；hover `color:#d946ef`（fuchsia-500）
- 喇叭 UIcon：`margin-left:0.25rem(4px)`；`display:inline-block`；`height:1.75rem(28px)`；`width:1.75rem(28px)`；`cursor:pointer`；`color:#6b7280`（gray-500）；hover `#d946ef`

音标 / 中文行：`margin-top:1.5rem(24px); margin-bottom:1.5rem(24px)`；`font-size:1.25rem(20px)`；`color:#6b7280`（gray-500）。

按钮区：`display:flex; flex-direction:column; gap:0.75rem(12px)`。
- 按钮：Nuxt UI 的 `btn btn-outline btn-sm`（outline 风格、sm 尺寸）；第二个按钮 `margin-left:1.5rem(24px)`。
- 掌握按钮容器：`display:none` 在 ≥768px（`md:`）以下才显示 —— 即移动端/小屏才出现「掌握」按钮（桌面端由 Tips 栏提供快捷键）。

### 3.3 单词点击发音逻辑

- `words = computed(() => courseStore.currentStatement?.english.split(" "))`
- 每个单词 `<span @click="handlePlayWordSound(word)">` → 来自 `usePlayWordSound()`，按单词文本朗读。
- 右侧喇叭 `@click="handlePlayEnglishSound"` → 来自 `useCurrentStatementEnglishSound()`，朗读整句英文。
- 自动发音：`onMounted` 时若 `isAutoPlaySound()` 为真则自动 `playSound()` 一次。

### 3.4 快捷键

`registerShortcutKeyForNextQuestion()`：
- `onMounted` 注册：
  - `" "`（空格） → `handleKeydown`
  - `"enter"` → `handleKeydown`
- `handleKeydown`：`e.preventDefault()`（阻止空格滚动/前进）后调用 `goToNextQuestion()`。
- `onUnmounted`：cancel 两个快捷键。

### 3.5 按钮行为

- 「再来一次」：`showQuestion()`（来自 `useGameMode`，回到题目态）。
- 「下一题」：`goToNextQuestion()`（来自 `./QuestionInput/useAnswer`）。
- 「掌握」（仅小屏）：嵌入 `<MainMasteredBtn>`。

---

## 4. LearningTimer.vue —— 悬浮计时器

### 4.1 模板

```vue
<div class="flex items-center font-sans text-gray-300 dark:text-gray-500">
  <div ref="clockIcon" class="mr-1 flex items-center justify-center">
    <UIcon name="i-ph-alarm-bold" class="h-8 w-8"></UIcon>
  </div>
  <p class="text-lg font-bold">{{ formattedTime }}</p>
</div>
```

- 颜色：light `#d1d5db`（gray-300）；dark `#6b7280`（gray-500）。
- 闹钟图标：`height:2rem(32px); width:2rem(32px)`；`margin-right:0.25rem(4px)`。
- 时间文本：`font-size:1.125rem(18px); font-weight:700`。

### 4.2 时间格式化

`formattedTime`：`HH:MM:SS`，每段 `padStart(2,"0")`，基于 `totalSeconds`（来自 `useLearningTimeTracker`）。

### 4.3 动画

`animateClock()` 用 `$anime` 在每分钟整（`totalSeconds % 60 === 0 && !== 0`）触发：
- `translateY`：-4 → 4 → -4 → 4 → 0，各段 100/200/200/200/100ms，easing `easeInOutQuad`
- `rotate`：-5° → 5° → -5° → 5° → 0°，同上时序
- `scale`：1.1 → 1，各 400ms
- 总 `duration:800`，`loop:1`

### 4.4 页面隐藏自动暂停

- `visibilitychange`：若未暂停且 `document.hidden` → `stopTracking()` + `pauseGame()`。
- `beforeunload`：若未暂停 → `stopTracking()`。
- mount 时 `enableAutoPauseCheck()`，unmount 时 `disableAutoPauseCheck()`。

---

## 5. Tips.vue —— 底部快捷键提示条 + 翻页按钮容器

### 5.1 模板

```vue
<div class="relative flex h-32 items-center justify-center">
  <!-- 快捷键按钮组（≥780px 才显示） -->
  <div class="z-10 hidden items-center justify-center min-[780px]:flex">
    <button v-for="keybinding in keybindings" @click="keybinding.eventFn"
            class="btn btn-ghost">
      <div class="flex items-center gap-0.5">
        <UKbd v-for="keyStr in parseShortcutKeys(keybinding.keys)">{{ keyStr }}</UKbd>
      </div>
      <span>{{ keybinding.text }}</span>
    </button>
  </div>

  <MainPrevAndNextBtn />
</div>
```

- 容器：`position:relative; display:flex; align-items:center; justify-content:center; height:8rem(128px)`。
- 快捷键组：`z-index:10`；默认 `display:none`；`min-[780px]:flex` 时才显示（即 <780px 隐藏）。
- 每个快捷键按钮：`btn btn-ghost`；内部 Kbd 序列 `gap:2px`。

### 5.2 keybindings 计算逻辑

`isQuestion()` 为真（题目态）时：
1. `Enter` → 「提交」→ `submitAnswer()`
2. `shortcutKeys.answer` → 文字动态为「显示答案 / 隐藏答案」→ `toggleAnswerTip()`

`isQuestion()` 为假（答案态）时：
1. `Enter` → 「下一题」→ `goToNextQuestion()`
2. `shortcutKeys.answer` → 「再来一次」→ `showQuestion()`

始终追加的通用项：
- `shortcutKeys.sound` → 「播放发音」→ `playSound`（整句英文发音）
- `shortcutKeys.mastered` → 「掌握」→ `handleMastered()` → `markStatementAsMastered()`

### 5.3 快捷键注册（mount/unmount 配对）

- `useMasteredShortcut`：注册/注销 `shortcutKeys.mastered`。
- `usePlaySound(key)`：注册/注销发音快捷键；回调里 `e.preventDefault()` 后 `playSound()`。
- `useShowAnswer(key)`：注册/注销答案快捷键；回调：
  - `e.preventDefault()`
  - 若 `useSummary().showModal.value` 为真则 return（结算弹窗打开时不响应）
  - 若 `isAnswer()` 为真 → `showQuestion()`
  - 否则 → `toggleAnswerTip()`
  - 注释说明：`registerShortcut` 会记住注册时的面板状态，所以每次回调都重新调 `useSummary()` / `useGameMode()` 获取最新状态。

---

## 6. PrevAndNextBtn.vue —— 左右翻页悬浮箭头

### 6.1 模板

```vue
<div class="absolute flex w-full items-center justify-between">
  <!-- 左箭头 -->
  <div class="h-12 w-12">
    <button v-show="courseStore.visibleStatementIndex !== 0"
            class="arrow-btn" @click="goToPreviousQuestion">
      <UTooltip text="上一题" :shortcuts="parseShortcut(shortcutKeys.previous)">
        <UIcon name="i-ph-caret-left" class="h-12 w-12"></UIcon>
      </UTooltip>
    </button>
  </div>

  <!-- 右箭头 -->
  <div class="h-12 w-12">
    <button v-show="courseStore.visibleStatementIndex + 1 !== courseStore.visibleStatementsCount"
            class="arrow-btn" @click="goToNextQuestion">
      <UTooltip text="下一题" :shortcuts="parseShortcut(shortcutKeys.skip)">
        <UIcon name="i-ph-caret-right" class="h-12 w-12"></UIcon>
      </UTooltip>
    </button>
  </div>
</div>
```

- 外层：`position:absolute; display:flex; width:100%; align-items:center; justify-content:space-between`（悬浮在 Tips 容器内）。
- 每个按钮占位：`height:3rem(48px); width:3rem(48px)`。
- 图标：`h-12 w-12`（48px）。
- 边界隐藏：第一题时隐藏左箭头；最后一题时隐藏右箭头（用 `v-show`，保留布局占位）。

### 6.2 箭头颜色与动效（scoped）

```css
.arrow-btn {
  color: #475569;            /* slate-600 */
  transition: transform 150ms ease-in-out;
}
.arrow-btn:hover { color: #d946ef; }
.arrow-btn:active { transform: scale(0.95); }
/* dark */
.dark .arrow-btn { color: #cbd5e1; }  /* slate-300 */
.dark .arrow-btn:hover { color: #d946ef; }
```

### 6.3 行为

- 上一题：`courseStore.toPreviousStatement()` + `showQuestion()`。
- 下一题：`courseStore.toNextStatement()` + `showQuestion()`。
- 快捷键：mount 注册 `shortcutKeys.previous` → 上一题；`shortcutKeys.skip` → 下一题；unmount 注销。
- Tooltip 文本带快捷键解析（`parseShortcut`）。

---

## 7. MasteredBtn.vue —— 掌握按钮

```vue
<button class="btn btn-outline btn-sm" @click="markStatementAsMastered">掌握</button>
```

- Nuxt UI `btn btn-outline btn-sm`。
- 行为：`useMastered().markStatementAsMastered()`。
- 在 Answer.vue 中仅在小屏（<md）渲染；桌面端通过 Tips 栏的快捷键按钮触发同一逻辑。

---

## 8. StudyVideoLink.vue —— B 站视频外链

```vue
<NuxtLink v-if="video" target="_blank"
  class="flex cursor-pointer items-center fill-current text-xl hover:text-fuchsia-500"
  :href="video">
  <UTooltip text="边看边练">
    <UIcon name="i-simple-icons-bilibili" class="h-5 w-5" />
  </UTooltip>
</NuxtLink>
```

- Props：`video?: string`；为空时整个 link 不渲染。
- 图标：20×20；`font-size:1.25rem(20px)`；`fill:currentColor`；hover `#d946ef`。
- 在 Tool.vue 左侧组内渲染，紧跟课程题目列表文字。

---

## 9. Share.vue —— 分享打卡图弹窗

### 9.1 模板

```vue
<UModal v-model="shareModalVisible" prevent-close>
  <UCard :ui="{ base: 'w-full sm:w-[400px] md:w-[448px] lg:w-[496px] flex flex-col items-center' }">
    <div class="flex flex-col sm:flex-row">
      <!-- 左侧缩略图画廊 -->
      <div class="gallery mr-2 flex py-2 sm:flex-col">
        <div v-for="(imgItem, index) in galleryImgs" :key="imgItem.src"
             :class="[
               'gallery-item sm:h-18 sm:w-18 mb-2 mr-2 h-14 w-14 cursor-pointer ' +
               'overflow-hidden rounded-sm border-2 border-transparent',
               { '!border-primary': currImageIndex === index, skeleton: !imgItem.src }
             ]"
             @click="handleSelectImage(index)">
          <img v-show="imgItem.src" :src="imgItem.src" :alt="`Card ${index}`"
               class="h-full w-full object-cover" />
        </div>
      </div>

      <!-- 右侧预览大图 -->
      <div :class="['mt-4 flex-1 sm:mt-0', { skeleton: !shareImageSrc }]" ref="imageContainer">
        <img v-show="shareImageSrc" :src="shareImageSrc" alt="Selected Share Image"
             class="h-auto max-h-[600px] w-full rounded-md" />
      </div>
    </div>

    <template #footer>
      <div class="mt-4 space-x-4">
        <button class="btn btn-primary" @click="copyAndClose">复制并关闭</button>
        <button class="btn" @click="hideShareModal">关闭</button>
      </div>
    </template>
  </UCard>
</UModal>
```

### 9.2 尺寸细节

- UCard 宽度：`100%` → ≥640px 时 `400px` → ≥768px 时 `448px` → ≥1024px 时 `496px`。
- 缩略图：默认 `h-14 w-14`（56px）；≥640px 时 `h-18 w-18`（72px，注意：tailwind 默认无 h-18/w-18，应为自定义/扩展值，按 4.5rem 复刻）。
- 缩略图圆角：`rounded-sm`（2px）；`border:2px solid transparent`；选中时 `!border-primary`。
- 预览图：`max-height:600px; width:100%; height:auto; border-radius:6px (rounded-md)`。

### 9.3 交互

- `watch(shareModalVisible)`：打开时用课程包标题、课程标题、用户名、今日日期（`yyyy/mm/dd`）、总题数、总时长（`formatSecondsToTime`）调用 `generateGalleryImage(...)`；关闭时 `clearShareImageSrc()`。
- 「复制并关闭」：`copyShareImage(currImageIndex)` → `hideShareModal()`。
- 「关闭」：`hideShareModal()`。
- 弹窗 `prevent-close`（不允许点遮罩关闭）。

---

## 10. Summary.vue —— 完成结算弹窗

### 10.1 模板

```vue
<UModal v-model="showModal" prevent-close>
  <UContainer :ui="{ base: 'w-[90vw]', constrained: 'max-w-[780px]' }">
    <!-- 标题 + 朗读喇叭 -->
    <div class="flex justify-between">
      <h3 className="font-bold text-lg mb-4">🎉 恭喜!</h3>
      <button tabindex="0"
              class="btn btn-ghost btn-sm mx-1 h-7 w-7 rounded-md p-0"
              @click="soundSentence">
        <UIcon name="i-ph-speaker-simple-high" class="h-full w-full" />
      </button>
    </div>

    <!-- 每日一句：英文 + 中文，两侧大引号 -->
    <div class="flex flex-col">
      <div class="flex">
        <span class="text-3xl font-bold sm:text-4xl lg:text-6xl">"</span>
        <div class="flex-1 text-center text-sm leading-loose sm:text-base lg:text-xl">{{ enSentence }}</div>
        <span class="invisible text-3xl font-bold sm:text-4xl lg:text-6xl">"</span>
      </div>
      <div class="flex">
        <span class="invisible text-3xl font-bold sm:text-4xl lg:text-6xl">"</span>
        <div class="flex-1 text-center text-sm leading-loose sm:text-base lg:text-xl">{{ zhSentence }}</div>
        <span class="text-3xl font-bold sm:text-4xl lg:text-6xl">"</span>
      </div>
      <p class="text-right text-xs text-gray-200 sm:text-sm">—— 金山词霸「每日一句」</p>

      <!-- 本次学习统计 -->
      <p class="pl-2 text-xs leading-loose text-gray-600 sm:pl-4 sm:text-sm lg:pl-14 lg:text-base">
        恭喜您一共完成 {{ courseTimer.totalRecordNumber() }} 道题，用时
        {{ formatSecondsToTime(courseTimer.calculateTotalTime()) }}
      </p>

      <!-- 今日学习时长（仅登录） -->
      <p v-if="isAuthenticated()"
         class="pl-2 text-xs leading-loose text-gray-400 sm:pl-4 sm:text-sm lg:pl-14 lg:text-base">
        今天一共学习 <span class="text-purple-500">{{ formattedMinutes }}分钟</span> 啦！
        <span v-if="totalMinutes >= 30">太强了，给自己来点掌声 😄</span>
      </p>
    </div>

    <!-- 底部操作按钮 -->
    <div className="modal-action flex flex-col sm:flex-row gap-2 justify-center sm:justify-end">
      <button class="btn btn-primary w-full sm:w-auto" @click="toShare">生成打卡图</button>
      <button class="btn w-full sm:w-auto" @click="handleDoAgain">再来一次</button>
      <button class="btn w-full sm:w-auto" @click="handleGoToCourseList">课程列表</button>
      <button class="btn w-full sm:w-auto" @click="goToNextCourse">
        下一课 <UKbd> ↵ </UKbd>
      </button>
    </div>
  </UContainer>
</UModal>

<!-- 彩带 canvas 全屏覆盖 -->
<canvas ref="confettiCanvasRef"
        class="pointer-events-none absolute left-0 top-0 z-[1000] h-full w-full" />
```

### 10.2 关键样式

- UContainer：宽度 `90vw`，`max-width:780px`。
- 大引号：`font-weight:700`；字号 `text-3xl(30px)` → `sm:text-4xl(36px)` → `lg:text-6xl(60px)`；一侧用 `invisible` 占位以保持视觉对称。
- 句子正文：居中；`leading-loose(2)`；`text-sm(14px)` → `sm:text-base(16px)` → `lg:text-xl(20px)`。
- 署名：右对齐；`text-gray-200(#e5e7eb)`。
- 统计行：`pl-2(8px)` → `sm:pl-4(16px)` → `lg:pl-14(56px)`；颜色 `text-gray-600(#4b5563)`。
- 今日学习时长行：`text-gray-400(#9ca3af)`；高亮分钟数 `text-purple-500(#a855f7)`。
- 按钮区：纵向堆叠在小屏，≥640px 横向排列；`gap:0.5rem(8px)`；小屏居中、大屏右对齐；按钮小屏占满宽、大屏 auto 宽。
- 彩带 canvas：`position:absolute; left:0; top:0; z-index:1000; width/height:100%; pointer-events:none`。

### 10.3 打开时副作用（`watch(showModal)`）

当 `showModal === true`：
1. `preventSaveStatement()` —— 阻止 statement 自动把进度推进到下一课（避免时间序错乱）。
2. `registerShortcut("enter", goToNextCourse)` —— 回车进入下一课。
3. `completeCourse()` —— 上报完成；登录用户会调 `courseStore.completeCourse()`，更新课程包完成数，记录 `nextCourseId`。
4. `soundSentence()` —— 朗读今日英文句子。
5. `gameStore.completeLevel()` —— 停止计时/游戏状态。
6. `setTimeout(playConfetti, 300)` —— 300ms 后放彩带。

关闭时：
1. `cancelShortcut("enter", goToNextCourse)`。
2. `permitSaveStatement()`。

### 10.4 按钮行为

| 按钮 | 行为 |
|---|---|
| 生成打卡图 | `showShareModal()`（打开 Share.vue） |
| 再来一次 | 若 `courseStore.isAllMastered()` → toast「你已经全部都掌握…」1.5s 后自动跳课程列表；否则 `courseStore.doAgain()` + `hideSummary()` + `showQuestion()` + `courseTimer.reset()` + `gameStore.startGame()` |
| 课程列表 | `hideSummary()` + `gotoCourseList(coursePackId)` |
| 下一课 | 未登录 → 弹注册 Dialog「✨ 解锁更多学习体验」（确认：`resetStatementIndex()` + `showQuestion()` + `signIn()`）；无下一课 → toast 1.5s 后跳课程列表；否则 `hideSummary()` + `gotoGame(coursePackId, nextCourseId)` |

### 10.5 今日学习时长

`totalMinutes = Math.ceil(totalSeconds / 60)`；`formattedMinutes = Math.max(totalMinutes, 1)`。
`totalMinutes >= 30` 时显示鼓励语「太强了，给自己来点掌声 😄」。

---

## 11. 复刻要点速查（给实现侧）

1. **主色调**：hover / primary 强调色统一为 `#d946ef`（fuchsia-500）；primary 按钮用 Nuxt UI 的 `btn-primary`（主题 primary）。
2. **文字灰阶**：副文本 `text-gray-500 #6b7280`；次要说明 `text-gray-400 #9ca3af`；深色模式自动切 gray-600/500。
3. **按钮体系**：Nuxt UI 的 `btn` + `btn-outline` / `btn-ghost` / `btn-primary` + `btn-sm`；快捷键提示用 `UKbd`。
4. **Tooltip**：统一 `UTooltip`，需要快捷键提示时传 `:shortcuts="parseShortcut(...)`。
5. **进度条**：`CommonProgressBar` 高 24px、内边距 2px，百分比来自当前索引/总数。
6. **悬浮层**：PrevAndNextBtn 用 `absolute` + `justify-between` 贴在 Tips 容器左右两侧；箭头在首/末题用 `v-show` 隐藏。
7. **响应式断点**：
   - `md(768px)`：Answer 的「掌握」按钮小屏才显示。
   - `min-[780px]`：Tips 快捷键组才显示。
   - `sm(640px)`：Share 弹窗左右布局切换、Summary 按钮横排。
8. **快捷键**：空格/Enter 在答案态 → 下一题；Enter 在题目态 → 提交；`shortcutKeys.*` 来自用户配置（previous/skip/sound/mastered/answer/pause），需做 mount 注册 / unmount 注销配对。
9. **页面隐藏**：LearningTimer 监听 `visibilitychange`，切后台自动 `stopTracking + pauseGame`，必须配对移除监听。
10. **组件解耦**：Game/Answer/Tool/Tips 之间不直接传 props，全部通过 Pinia store（`useCourseStore`、`useGameStore`、`useRanking`、`useCoursePackStore`、`useUserStore`）与 composables 共享状态；复刻时建议保留这套 store/composable 边界。
