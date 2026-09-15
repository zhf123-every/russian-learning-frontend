# Earthworm 页面级组件复刻规格

> 来源：`earthworm-main/apps/client/` 下的源码逐行读取整理。
> 技术栈：Nuxt 3 + Vue 3 (`<script setup lang="ts">`) + Tailwind CSS（含 `dark:` 暗色模式）+ Nuxt UI（`UToast`/`UAvatar`/`UTooltip` 等）。
> 本文档只覆盖：首页（Home / Landing）、课程包列表页、课程包详情页，以及它们直接依赖的卡片/热力图/全局布局组件。

---

## 0. 全局布局（layouts/default.vue + app.vue）

### 0.1 应用根 `app.vue`
- 最外层包 `HttpErrorProvider`。
- 启动阶段 `useAsyncData("initApplication")` 拉 `fetchCurrentUser()`；`status==='pending'` 时全屏 `Loading`，否则渲染 `<NuxtLayout><NuxtPage/></NuxtLayout>`。
- 全局挂载：`<UModals />`、`<Toaster />`（vue-sonner，`position="top-center"`，主题色紫色系：亮色 `#f3e8ff` 底/`#6b21a8` 字；暗色 `#c084fc` 底/`#000` 字）。
- 启动时 `initDarkMode()`。

### 0.2 默认布局 `layouts/default.vue`
整页结构（垂直 flex，居中）：
```
<div h-full w-full bg-white text-slate-600 dark:bg-theme-dark dark:text-slate-300>
  <div m-auto flex h-fit min-h-screen flex-col items-center>
    <Navbar />
    <FoundingMemberNotice />
    <div flex w-full flex-1 px-5>
      <div mx-auto flex w-full max-w-screen-xl flex-1>
        <NuxtPage />
      </div>
    </div>
    <Footer />
  </div>
</div>
<UserMenu />   <!-- 全屏外，作为悬浮用户菜单 -->
```
要点：
- 页面内容最大宽度 `max-w-screen-xl`，左右 `px-5`，与 Navbar 对齐。
- 无 Sidebar；导航只在顶部 Navbar。
- 页脚 Footer 高度固定 `h-12`。

### 0.3 Navbar（`components/Navbar.vue`）
- 顶部 `<header>`：`w-full px-5 font-customFont transition-all duration-300 ease-linear`。
- 行为：
  - `isStickyNavBar` 仅在路由名为 `index`、`User-Setting`、`mastered-elements` 时为 `true`（即首页/设置页/掌握词页吸顶）。
  - 吸顶且滚动超过 `SCROLL_THRESHOLD = 8px`（`useWindowScroll`）时，追加 `glass bg-gradient-to-r from-transparent via-white/10 to-transparent shadow-md`。
- 内部：`mx-auto max-w-screen-xl` → `flex h-16 items-center justify-between`。
  - 左：`<NuxtLink to="/">` 包 logo 区：
    - `<img src="/logo.png" width=48 height=48 class="mr-6 hidden rounded-md md:block">`（移动端隐藏 logo 图）。
    - `<h1 text-2xl font-extrabold>Earthworm</h1>`。
  - 右二导航（仅 `route.path === '/' && !isAuthenticated()` 时显示，`hidden md:block`）：`<ul flex items-center text-base>`，每项 `px-4`，hover 紫色。`HEADER_OPTIONS`：
    - 文档 → `runtimeConfig.public.helpDocsURL`（新窗口）
    - 功能 → `#features`
    - 问题 → `#faq`
    - 联系我们 → `#contact`
  - 最右侧：
    - 已登录：圆形头像 `h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-700`，`hover:scale-125 hover:opacity-90`，内嵌 `<UAvatar>`，点击 `openUserMenu`。
    - 未登录：紫色按钮 `btn btn-sm bg-purple-500 text-white shadow-md hover:bg-purple-600`，文案"登录"，点击 `signIn()`。

### 0.4 Footer（`components/Footer.vue`）
- `flex h-12 shrink-0 flex-col items-center justify-center text-xs opacity-65`。
- 仅一行版权：`Copyright © 2023-2024, Earthworm. All rights reserved.`
- 无 ICP 备案（已注释）。

---

## 1. 首页路由 `pages/index.vue`

```vue
<template>
  <Home v-if="isAuthenticated()"></Home>
  <Landing v-else></Landing>
</template>
```
- 已登录 → `components/Home/index.vue`
- 未登录 → `components/Landing/index.vue`

---

## 2. 已登录首页 `components/Home/index.vue`

### 2.1 整体布局
根：`<div class="mt-8 flex w-full justify-between">`

**左侧头像区**（`hidden w-72 md:block`，即 <md 隐藏；与右侧间距 `mr-16`）：
- 头像：`mx-auto h-56 w-56 overflow-hidden rounded-full border-2 border-gray-300 bg-gray-300 dark:border-gray-700 dark:bg-gray-700`，内部 `<img class="h-full object-cover" :src="userStore.user?.avatar">`。图片加载失败时显示圆形灰色底。
- 用户名区 `mt-4 truncate`：
  - 一行：`<div text-3xl font-medium>{{ username }}</div>` + `<MembershipBadge />`（横向 `flex gap-2`）。
  - 下行：`<div text-md text-gray-400>{{ userStore.user?.name }}</div>`。
- 分割线 `<hr my-5 dark:border-gray-700>`。
- 勋章区已注释掉（预留：`grid grid-cols-4 gap-2`，6 个 `h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700` 占位圆）。

**右侧内容区**（`min-w-0 flex-1`）：
1. 区块标题栏：`mb-4 flex justify-between border-b pb-2 dark:border-gray-700`
   - 左：`<div text-xl font-medium>最近使用的课程包</div>`
   - 右：`<NuxtLink href="/course-pack" class="link text-blue-500 no-underline hover:opacity-75">更多课程包</NuxtLink>`
2. `<HomeRecentCoursePack />`（即 `RecentCoursePack.vue`，见 §4）。
3. `<HomeCalendarGraph class="mt-10" :data="learningDailyTimeList" :totalLearningTime="learningDailyTotalTime" @toggleYear="toggleYear" />`（见 §3）。

### 2.2 脚本逻辑
- `useUserStore()` 读用户。
- `useLearningDailyTime()` 返回 `{ learningDailyTimeList, learningDailyTotalTime, setupLearningDailyTime }`。
- 内部本地 hook `useCalendarGraph()`：
  - `data = ref<CalendarDataItem[]>([])`，`totalLearningTime = ref(0)`。
  - `toggleYear(year?)`：TODO 多年份切换，目前直接调 `setupLearningDailyTime()`。
- `useAsyncData` 同步今日学习总时长：`useLearningTimeTracker().setupLearningTime(await fetchTodayLearningTime())`。

---

## 3. 年度热力图 `components/Home/CalendarGraph.vue`

### 3.1 Props / Emits
```ts
props: { data: CalendarDataItem[]; totalLearningTime: number }
emits: EmitsType（含 toggleYear）
```

### 3.2 布局
根：`<div class="flex justify-between">`

**左侧打卡图**（`min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-4 text-xs dark:border-gray-700`）：
- 外层 `w-full overflow-x-auto`（ref=`tableContainer`），内部 `<table class="mx-auto mb-2" ref="calendarTable">`。
- `<thead>`：首空列 + 多个 `<th :colspan="colSpan">{{ month }}</th>`（月份从 `useCalendarGraph` 取出，`pb-1 text-left font-normal`）。
- `<tbody>`：按周行渲染。
  - 首列：`<td class="relative hidden w-8 md:block">`，`<span class="absolute">{{ i % 2 !== 0 ? weeksZh[i] : "" }}</span>`（隔行显示中文周几，移动端隐藏）。
  - 其余列：`<UTooltip :text="cell?.tips"><div class="cell block" :class="cell?.bg"></div></UTooltip>`。
- 底部图例区 `mt-2 flex justify-between px-1`：
  - 左：`totalLearningTime > 0 ? "一共学习" : "还没有开始学习"`；有值时 `<span class="font-semibold text-purple-500">{{ formatLearningTime(...) }}</span>`。
  - 右：渐变图例 `更少 ▢▢▢▢▢ 更多`（5 个 `.cell` 样块：默认 / `.low` / `.moderate` / `.high` / `.higher`）。

**右侧年份选项**（`v-for="year in yearOptions"`，`ml-6 hidden pr-7 xl:flex`，按钮样式 `btn btn-sm tw-btn-blue`）——目前写死只有 2024，多年份切换 TODO。

### 3.3 活动等级阈值（`getActivityLevel`）
按"分钟"分级（秒→分钟 `Math.floor(second/60)`）：
- `<10 分钟` → `low`
- `<30 分钟` → `moderate`
- `<60 分钟` → `high`
- `≥60 分钟` → `higher`
- 空/0 → 空 class（灰色默认）。

### 3.4 Tooltip 文案（`tipFormatter`）
- duration=0：`"{date} 没有学习"`
- 分钟 <1：`"{date} 学习不足 1 分钟"`
- 否则：`"{date} 学习 {minutes} 分钟"`

### 3.5 样式（scoped）
- `.cell`：`h-[12px] w-[12px] rounded-sm border-gray-200 bg-gray-200 hover:scale-125 hover:border hover:border-blue-400 dark:bg-gray-700 dark:hover:border-gray-50`。
- `.low`：亮 `#9be9a8` / 暗 `#0e4429`
- `.moderate`：亮 `#40c463` / 暗 `#006d32`
- `.high`：亮 `#30a14e` / 暗 `#26a641`
- `.higher`：亮 `#216e39` / 暗 `#39d353`
- 挂载后 `initTable()` 并 `scrollAutoToRight()`（`scrollLeft = scrollWidth`，默认滚到最近一周）。
- `watchEffect`：`tbody.value = renderBody(props.data)`。

### 3.6 时长格式化 `formatLearningTime(totalSeconds)`
- 有小时：`"{h}小时{m}分钟"`
- 无小时且分钟=0：`"不足 1 分钟"`
- 否则：`"{m}分钟"`

---

## 4. 最近课程包 `components/Home/RecentCoursePack.vue`

### 4.1 布局
根：`<div class="flex min-h-[350px]">`
- Loading 态：`flex flex-1 items-center justify-center`，圆点 `<span class="loading loading-dots loading-md">`。
- 有数据：
  - 网格：`grid w-full grid-cols-1 gap-4 min-[500px]:grid-cols-2 md:grid-cols-1 min-[850px]:grid-cols-2 xl:grid-cols-3`
    - 注意：<md 时被压缩回 1 列（因为左侧头像区在 md 以上才显示）。
  - 每项渲染 `<CoursePackCard :coursePack="{ id: coursePack.coursePackId, title, description, cover, isFree }">`，并通过具名插槽 `#actions` 注入两个按钮：
    - "课程列表"：`btn btn-sm tw-btn-blue`，`@click.stop="gotoCourseList(coursePack.coursePackId)"`
    - "继续游戏"：`btn btn-success btn-sm text-white`，`@click.stop="gotoGame(coursePack.coursePackId, coursePack.courseId)"`
    - 容器：`mt-2 flex justify-between`。
- 空态：`flex h-full w-full flex-1 items-center justify-center text-slate-500`，文案"暂无记录，<NuxtLink href="/course-pack" class="link text-blue-500 no-underline hover:opacity-75">先学习一课，</NuxtLink>再来看看吧~"。

### 4.2 数据来源
- `useRecentCoursePack()`（`./helper.ts`）：模块级 `coursePacks = ref<UserRecentCoursePack[]>([])`，`fetchCoursePacks()` 调 `fetchUserRecentCoursePacks()`。
- 首次进入若空则拉取；非空则每次也重新拉取刷新。

---

## 5. 课程包卡片 `components/courses/CoursePackCard.vue`

### 5.1 Props / Emits
```ts
interface Props {
  coursePack: { id: string; title: string; description: string; cover: string; isFree: boolean }
}
emits: (e: "cardClick", coursePack: any) => void
```
- 具名插槽 `actions`：可选，渲染在 card-body 底部。

### 5.2 模板结构
```
<div class="course-pack-card" @click="$emit('cardClick', coursePack)">
  <figure class="relative aspect-video overflow-hidden">
    <NuxtImg :src="coursePack.cover" :placeholder="[288,180]" width="288" height="180"
             class="inset-0 h-full w-full object-cover" />
  </figure>
  <div class="card-body">
    <h2 class="card-title truncate">{{ title }}</h2>
    <p class="description-text" :title="description">{{ description }}</p>
    <slot name="actions"></slot>
  </div>
</div>
```

### 5.3 样式（精确）
- 卡片本体 `.course-pack-card`：
  - `flex cursor-pointer flex-col overflow-hidden rounded-md rounded-t-xl border bg-white transition-all duration-300 dark:border-gray-700 dark:bg-gray-900`
  - hover：`hover:text-purple-500 hover:shadow-even-lg hover:shadow-gray-300 hover:dark:text-purple-400 dark:hover:shadow-gray-500`
  - `width:100%; max-width:100%; height:100%`。
  - 注意：圆角上大下小（`rounded-t-xl` 顶部 0.75rem，`rounded-md` 其余 0.375rem）。
- `.card-body`：`padding:1rem; display:flex; flex-direction:column; flex-grow:1`。
- `.card-title`：`text-lg font-semibold; flex-grow:0`。
- `.description-text`：
  - `my-2 line-clamp-2 text-sm text-gray-500; flex-grow:1; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical`。
  - hover 时显示 `title` 气泡：`@media (hover:hover)` 下 `::after` 绝对定位在 `top:100%`，白底 `#fff`/暗底 `#1a202c`，`max-width:300px`，`box-shadow:0 2px 5px rgba(0,0,0,.2)`。
- 移动端（`max-width:640px`）：
  - `.card-body` 内边距降到 `0.75rem`。
  - `.card-title` 降为 `text-base`。
  - `.description-text` 降为 `text-xs`。

---

## 6. 课程包列表页 `pages/course-pack/index.vue`

### 6.1 模板
```
<div class="flex w-full flex-col">
  <h2 class="mb-4 text-center text-3xl dark:border-gray-600">课程包列表</h2>
  <Loading v-if="isLoading" />
  <template v-else>
    <div class="h-[79vh] overflow-y-auto overflow-x-hidden scrollbar-hide">
      <div class="grid auto-rows-fr grid-cols-1 gap-4 px-4 sm:grid-cols-2 sm:px-0 md:grid-cols-3 lg:grid-cols-4">
        <CoursePackCard v-for="coursePack in coursePackStore.coursePacks"
          :coursePack="{ id, title, description, cover, isFree }"
          @cardClick="handleGoToCoursePack" />
      </div>
    </div>
  </template>
</div>
```

### 6.2 网格响应式断点
| 断点 | 列数 | 备注 |
|---|---|---|
| 默认（<sm） | 1 列 | 容器 `px-4` |
| `sm` (≥640px) | 2 列 | 容器 `px-0` |
| `md` (≥768px) | 3 列 | |
| `lg` (≥1024px) | 4 列 | |

- 行高 `auto-rows-fr`（等高）；间距 `gap-4`。
- 滚动区固定高度 `h-[79vh]`，隐藏横向滚动，`scrollbar-hide`（隐藏滚动条）。

### 6.3 数据与逻辑
- `useCoursePackStore()` → `coursePackStore.coursePacks`。
- `setup()`：若 store 为空，`isLoading=true` → `await coursePackStore.setupCoursePacks()` → 结束。注释说明"课程包不会更新，初始化只拉一次"。
- 点击 `handleGoToCoursePack(coursePack)`：
  - `isFree === true` → `gotoCourseList(coursePack.id)`（进入课程列表/详情）。
  - 否则 → TODO：会员校验（当前仅 `console.log("需要是会员")`）。
- **无筛选/排序 UI**——当前页面只有纯网格，没有搜索框、下拉排序、分类标签。

---

## 7. 课程包详情页 `pages/course-pack/[id].vue`

### 7.1 模板
```
<div class="flex w-full flex-col">
  <Loading v-if="isLoading" />
  <template v-else>
    <h2 class="mb-4 text-center text-3xl dark:border-gray-600">
      {{ coursePackStore.currentCoursePack?.title }}
    </h2>
    <div class="h-full scrollbar-hide">
      <div class="grid h-[79vh] grid-cols-1 justify-start gap-8 overflow-y-auto overflow-x-hidden
                  pb-96 pl-0 pr-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <CoursesCourseCard v-for="course in coursePackStore.currentCoursePack?.courses" :key="course.id"
          :title="course.title" :description="course.description" :id="course.id"
          :count="course.completionCount" :coursePackId="course.coursePackId"
          @click="handleChangeCourse(course.id)" />
      </div>
    </div>
  </template>
</div>
```

### 7.2 网格响应式断点
| 断点 | 列数 |
|---|---|
| 默认 | 1 列 |
| `md` (≥768px) | 2 列 |
| `lg` (≥1024px) | 3 列 |
| `xl` (≥1280px) | 4 列 |

- 间距 `gap-8`（比列表页大）。
- 容器 `h-[79vh]`，`overflow-y-auto overflow-x-hidden`，`pb-96`（底部大留白，避免遮挡），`pl-0 pr-4`。
- `justify-start`（左对齐，不拉伸）。

### 7.3 数据与逻辑
- 路由参数 `coursePackId = route.params.id`。
- `setup()`：`isLoading=true` → `await coursePackStore.setupCoursePack(coursePackId)`。
- 点击课程 `handleChangeCourse(courseId)`：
  1. `updateActiveCourseMap(coursePackId, courseId)`（记录"当前进行中课程"，用于 CourseCard 高亮）。
  2. `navigateTo(`/game/${coursePackId}/${courseId}`)` —— 进入游戏页。
- 课程数据来自 `currentCoursePack.courses`，每项字段：`id, title, description, completionCount, coursePackId`。

---

## 8. 课程卡片 `components/courses/CourseCard.vue`

### 8.1 Props / Emits
```ts
props: {
  title: string;
  id: string;
  count: number | undefined;   // 完成次数；>0 表示已完成
  coursePackId: string;
  description: string;
}
emits: 无显式 emits，父级用 @click 绑定
```

### 8.2 模板
```
<div :ref="isActiveCourse ? 'activeCourseRef' : undefined" :class="[...]">
  <h3 class="text-base font-bold">{{ title }}</h3>
  <p class="mt-4 line-clamp-3 text-sm text-gray-500 dark:text-gray-400" :title="description">
    {{ description }}
  </p>
  <div v-if="hasFinished" class="absolute bottom-1.5 right-2 h-5 w-7 rounded-md
         text-center text-xs leading-5 text-white"
       :class="hasFinished ? 'bg-emerald-600' : 'bg-purple-600'">
    <UTooltip :text="dataTip">{{ count }}</UTooltip>
  </div>
</div>
```

### 8.3 样式（精确）
- 基础：`relative h-[160px] w-full cursor-pointer rounded-xl border border-gray-400 p-4 pb-6 transition-all duration-300 dark:text-gray-100`。
- hover：`hover:text-purple-500 hover:shadow-lg hover:shadow-gray-300 hover:dark:text-purple-400 dark:hover:shadow-gray-500`。
- **已完成态**（`hasFinished = !!count`）：
  - `border-2 border-emerald-500 hover:text-emerald-500 hover:shadow-emerald-200 hover:dark:text-emerald-300 dark:hover:shadow-emerald-700`
  - 右下角徽标：`bg-emerald-600`。
- **进行中态**（`isActiveCourse = activeCourseMap[coursePackId] === id`）：
  - `border-2 border-purple-500 hover:text-purple-500 hover:shadow-purple-200 hover:dark:text-purple-300 dark:hover:shadow-purple-700`
  - 右下角徽标：`bg-purple-600`（注意：`v-if="hasFinished"` 才渲染徽标，所以进行中但未完成时不显示角标）。
- 角标 tooltip：`dataTip = "恭喜您，当前课程已完成 {count} 次 🎉"`。
- 挂载后若为 active 课程：`activeCourseRef.value?.scrollIntoView({ behavior:'smooth', block:'start' })`（自动滚动到进行中课程）。

### 8.4 状态汇总
| 状态 | 边框 | 文字 hover | 阴影 | 角标 |
|---|---|---|---|---|
| 未完成、非进行中 | 1px gray-400 | purple-500 | gray-300 | 无 |
| 已完成（count>0） | 2px emerald-500 | emerald-500 | emerald-200 | 右下 emerald 角标显示次数 |
| 进行中（active） | 2px purple-500 | purple-500 | purple-200 | 无（除非同时已完成） |

---

## 9. 未登录 Landing 页 `components/Landing/index.vue`

### 9.1 整体结构
```
<div class="font-customFont">
  <LandingBanner @start-earthworm="startEarthworm" />
  <LandingFeatures />
  <LandingComments />
  <LandingQuestions />
  <LandingContact />
  <CommonBackTop class="sticky bottom-28 ml-auto flex justify-end sm:block" />
</div>
```
- 快捷键：Enter 触发 `startEarthworm()`；未登录时 `router.push('/course-pack')`。挂载时 `registerShortcut("enter", ...)`，卸载时 `cancelShortcut`。

### 9.2 子区块概览
| 组件 | id/作用 | 关键样式 |
|---|---|---|
| `Banner.vue` | `#home` 首屏 | `pt-28 text-gray-500`；渐变标题 `from-purple-600 to-gray-200 bg-clip-text`；主 CTA 按钮带星空/光晕动画（`#stars`/`#glow` 关键帧）；GitHub Star 按钮横向滑动图标；下方 `home-page-preview.png` 预览图 `w-4/5 lg:w-3/4`；底部 `CommonDivider` |
| `Features.vue` | `#features` 功能特性 | `pt-24`；标题 `CommonTitle`；网格 `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12`；每项 `flex items-start gap-4`，图标框 `rounded-lg border border-gray-300 bg-white p-2 text-purple-400 dark:bg-[#121229]`；共 6 项（实时反馈/情境学习/提高表达/词汇保留/常用搭配/键盘音效） |
| `Comments.vue` | 用户反馈 | 瀑布流 `sm:columns-2 lg:columns-3 gap-6/8`，每条 `mb-8 sm:break-inside-avoid`；卡片 `rounded-lg bg-white shadow-lg hover:shadow-2xl hover:shadow-purple-500/50 dark:bg-[#111128]`；圆形头像 `h-12 w-12 lg:h-14 lg:w-14 border-2 border-purple-400`；Twitter 图标；数据来自 `~/assets/comments.json` |
| `Questions.vue` | `#faq` 常见问题 | `pt-24`；`<details>` 列表 `divide-y divide-gray-100 dark:divide-gray-800`，默认展开第 0 项；箭头 `i-ph-caret-right-bold` 展开时旋转 90°；内容 `max-height` 过渡 0.5s |
| `Contact.vue` | `#contact` 页脚 | `max-w-screen-xl px-4 py-16 lg:py-16`；`grid grid-cols-1 lg:grid-cols-3`；左列 logo + 打字机动画文案（`@keyframes typing`）+ 社交图标（X/Telegram/GitHub）；右列 4 列链接区（Earthworm/团队） |
| `PayCard.vue` | `#pricing` 定价（当前 Landing/index.vue 未引用，作为独立组件存在） | 两栏卡片 `w-96 max-w-sm p-8 shadow-xl`；免费 `$0` / 终身 `$19`；紫色渐变按钮；hover 上浮 + 紫色光晕动画 |
| `Introduce.vue` | `#what` 介绍（当前未引用） | 左右两个 `h-[360px] w-[45%]` 深色卡片（`bg-[#111128]` 外框，`bg-[#17172e]` 内卡），分别讲"快速上手"和"学习原理" |
| `NoticeBar.vue` | 顶部公告条（当前未引用） | `rounded-md bg-purple-200 px-4 py-1.5 dark:bg-gray-800`，右侧白底按钮 |

> 说明：当前 Landing/index.vue 实际只挂载了 **Banner / Features / Comments / Questions / Contact** 五个子组件 + BackTop；`PayCard`、`Introduce`、`NoticeBar` 已实现但未挂到 Landing 主链上。

---

## 10. 复刻要点速查（给前端实现者）

### 10.1 颜色与主题
- 主色：`purple-500/600`（品牌色），hover 文字 `text-purple-500` / 暗色 `text-purple-400`。
- 成功/完成：`emerald-500/600`。
- 进行中：`purple-500`。
- 页面背景：亮 `bg-white`，暗 `dark:bg-theme-dark`。
- 卡片背景：亮 `bg-white`，暗 `dark:bg-gray-900`。
- 文字：亮 `text-slate-600` / 灰 `text-gray-500`，暗 `dark:text-slate-300`。

### 10.2 卡片圆角与阴影
- `CoursePackCard`：顶部 `rounded-t-xl`(12px) + 其余 `rounded-md`(6px)，hover `shadow-even-lg shadow-gray-300`。
- `CourseCard`：统一 `rounded-xl`(12px)，hover `shadow-lg`，完成/进行中换色阴影。

### 10.3 关键尺寸
- 头像：`h-56 w-56`（224px）圆形。
- 头像区宽：`w-72`(288px)，与右侧间距 `mr-16`(64px)。
- 内容最大宽：`max-w-screen-xl`(1280px)。
- 滚动容器高：`h-[79vh]`。
- 热力图格子：`12×12px`。
- 课程卡片高：固定 `h-[160px]`。

### 10.4 响应式断点（汇总）
| 断点 | 用途 |
|---|---|
| `<500px` | RecentCoursePack 单列 |
| `sm 640px` | 列表 2 列 / Landing 评论 2 列 |
| `md 768px` | 首页左侧头像区显示 / 列表 3 列 / 详情 2 列 / Landing 功能 2 列 |
| `lg 1024px` | 列表 4 列 / 详情 3 列 / Landing 功能 3 列、评论 3 列 |
| `xl 1280px` | 详情 4 列 / RecentCoursePack 3 列 / 热力图年份按钮显示 |

### 10.5 交互
- 课程包卡片整卡点击 → 免费包进入详情；付费包需会员（TODO）。
- 课程卡片点击 → 更新 active 课程映射 → 路由跳转 `/game/{coursePackId}/{courseId}`。
- 已完成课程右下角角标 hover 显示"恭喜…完成 N 次 🎉"。
- 进行中课程挂载后自动 `scrollIntoView`。
- 未登录 Landing 按 Enter 直达 `/course-pack`。

---

*文档生成基于 earthworm-main/apps/client 源码逐行读取，未做任何源码修改。*
