# Earthworm `QuestionInput` 模块复刻规格

> 来源：`apps/client/components/main/QuestionInput/` 全量源码 + 状态机依赖 `apps/client/composables/main/question.ts` + `components/main/AnswerTip.vue`
> 框架：Vue 3 `<script setup lang="ts">` + Pinia(`useCourseStore`) + Tailwind CSS + daisyUI(`btn`/`card`)
> 本文档为**只读探查**结果，未修改任何源文件。

---

## 0. 文件清单与职责

| 文件 | 职责 |
|---|---|
| `QuestionInput.vue` | 视图层：单词槽渲染、透明 input、移动端操作区、键盘事件分发 |
| `questionInputHelper.ts` | 共享 input DOM ref / `focusing` 状态；`getWordWidth()` 字符宽度表 |
| `useWrapperQuestionInput.ts` | 业务编排层：把状态机与音效/计时/自动下一题/空格提交等用户设置粘合 |
| `useAnswerError.ts` | 错误计数、错误音、连续错 3 次自动弹答案提示 |
| `useTypingSound.ts` | 打字音（Web Audio API）+ 正确/错误提示音（HTMLAudio） |
| `useAnswer.ts` | 全部做完后进入总结页、否则切下一句 |
| `composables/main/question.ts` | **核心状态机**：`useInput`、`isWord`、三种 Mode、单词槽数据结构 |
| `AnswerTip.vue` | 错题时的整句答案弹层 |

---

## 1. 完整模板结构（QuestionInput.vue，逐元素）

```
<div class="text-center">                                          ← 根容器，文本居中
  <div class="relative flex flex-wrap justify-center gap-2 transition-all">
      └─ v-for="(w, i) in courseStore.words" :key="i"
         │
         ├─ <div v-if="isWord(w)">                                ← 单词槽（可输入）
         │     class="h-[4rem] rounded-[2px] border-b-2 border-solid
         │            text-[3em] leading-none transition-all"
         │     :class="getWordsClassNames(i)"
         │     :style="{ minWidth: `${inputWidth(w)}ch` }"
         │   >{{ findWordById(i)!.userInput }}</div>
         │
         └─ <div v-else>                                          ← 标点/分隔符（纯展示）
               class="h-[4rem] rounded-[2px] text-[3em] leading-none transition-all"
             >{{ w }}</div>

  <input
      lang="en"
      ref="inputEl"
      type="text"
      v-model="inputValue"
      autoFocus
      class="absolute h-full w-full opacity-0"     ← 透明、绝对定位铺满容器，负责真实输入
      @keydown="handleKeydown"
      @focus="focusInput"
      @blur="blurInput"
      @dblclick.prevent
      @mousedown="preventCursorMove"
      @compositionstart="handleCompositionStart"
      @compositionend="handleCompositionEnd" />

  <div class="mt-12 flex flex-col items-center justify-center gap-4 md:hidden">   ← 仅移动端（<md）
      <button class="btn btn-outline btn-sm" @click="handleSubmitAnswer">提交</button>
      <div class="flex gap-4">
          <button class="btn btn-outline btn-sm" @click="handleShowAnswerTip">
              {{ isAnswerTip() ? "隐藏" : "显示" }}答案
          </button>
          <button class="btn btn-outline btn-sm" @click="handlePlaySound">播放声音</button>
      </div>
      <MainMasteredBtn />
  </div>
</div>
```

要点：
- `courseStore.words` 是当前英文句按空格切分后的 token 数组；`isWord(w)` 判定该 token 是否含 `[a-zA-Z0-9]`，含则渲染成可输入槽，否则原样渲染标点/符号。
- 所有可见输入位其实是 **div**；真正的 `<input>` 透明（`opacity-0`）并绝对铺满外层 `relative` 容器，承接全部键盘事件与光标。
- `input` 上 `@mousedown="preventCursorMove"` + `@dblclick.prevent`：禁止用户用鼠标移动光标/双击，只允许聚焦。

---

## 2. 精确样式值（Tailwind class → CSS）

### 2.1 单词槽 / 展示槽（两者共有）

| class | 计算值 |
|---|---|
| `h-[4rem]` | height: 64px |
| `rounded-[2px]` | border-radius: 2px |
| `text-[3em]` | font-size: 3em（若根字号 16px → 48px） |
| `leading-none` | line-height: 1 |
| `transition-all` | transition: all（颜色/宽度变化平滑过渡） |

### 2.2 单词槽独有：下划线

| class | 计算值 |
|---|---|
| `border-b-2` | border-bottom-width: 2px |
| `border-solid` | border-style: solid |

### 2.3 三档动态 class（`getWordsClassNames(i)` 返回）

| 状态 | class | 颜色计算值 |
|---|---|---|
| **激活词**（`isActive && focusing`） | `text-fuchsia-500 border-b-fuchsia-500` | 文字 `#d946ef`，下划线 `#d946ef` |
| **错误词**（`incorrect && focusing`） | `text-red-500 border-b-red-500`（Fix 模式追加 `animate-shake`） | 文字 `#ef4444`，下划线 `#ef4444` |
| **默认/未聚焦** | `text-[#20202099] border-b-gray-300 dark:text-gray-300 dark:border-b-gray-400` | 文字 `rgba(32,32,32,0.6)`，下划线 `#d1d5db`；dark 模式文字 `#d1d5db`、下划线 `#9ca3af` |

> 注意：错误词的红色仅在 **focusing 为 true** 时显示；失去焦点时错误词回落默认灰色（因为第二条 `if` 也要求 `focusing.value`）。

### 2.4 布局容器

| class | 计算值 |
|---|---|
| `gap-2`（词槽行） | gap: 0.5rem = 8px |
| `flex flex-wrap justify-center` | 自动换行、水平居中 |
| `mt-12`（移动操作区） | margin-top: 3rem = 48px |
| `gap-4` | gap: 1rem = 16px |
| `md:hidden` | ≥768px 时 `display:none`（PC 端不显示按钮区） |
| 透明 input `opacity-0` | opacity: 0；`absolute h-full w-full` 铺满外层 |

### 2.5 动画

- `animate-shake`：自定义抖动动画（Tailwind 配置中的 keyframes），仅在 **错误词 + Fix 模式 + 聚焦** 三者同时成立时叠加。复刻时需自行实现一个水平左右抖动 keyframes（如 `translateX` ±5px、约 0.4s）。

---

## 3. 状态机逻辑（Input / Fix / Fix_Input）

```ts
enum Mode {
  Input = "input",      // 正常输入
  Fix   = "fix",        // 刚提交、发现有错，等待用户按任意键进入修复
  Fix_Input = "fix-input", // 正在修复某个错误词
}
```

### 3.1 状态切换条件

| 当前态 | 触发动作 | 下一态 | 行为 |
|---|---|---|---|
| Input | 提交答案全部正确 | Input | `playRightSound`，清空 `inputValue`，自动下一题/显示答案 |
| Input | 提交答案有错误 | **Fix** | `playErrorSound`，错误词标红，不进入下一题 |
| Fix | 按下**任意键**（空格/退格会被 preventDefault） | **Fix_Input** | 定位到**第一个错误词**、清空其 `userInput`、光标移到该词 `start` |
| Fix_Input | 再按空格（当前词非最后一个错误词） | Fix_Input | 跳到**下一个错误词**并清空 |
| Fix_Input | 在**最后一个错误词**按空格 → 触发空格提交 | Input/Fix | 重新走一次 `submitAnswer` 判定 |
| Fix_Input | 当前编辑词为空时按退格 | Fix_Input | 光标回退到**上一个错误词**末尾 |
| 任意 | `submitAnswer()` 在 Fix 态被调用 | — | 直接 `return`（Fix 态禁止重复提交） |

### 3.2 每个状态下的渲染差异

- **Input**：词槽按默认灰；激活词品红 `#d946ef`；无红色、无抖动。
- **Fix**：所有 `incorrect` 词在聚焦时显示红色 `#ef4444`，**且**叠加 `animate-shake` 抖动；用户尚未开始改，按任意键才清空第一个错词。
- **Fix_Input**：红色保留，抖动消失（`isFixMode()` 为 false）；当前被清空的错误词成为激活词（品红），光标落在其 `start`。

### 3.3 正确性判定（`markIncorrectWord`）

1. 仅对**最后一个词**做：若 `userInput` 以 `.` 结尾，删掉结尾句号。
2. `formatInputText`：`toLocaleLowerCase()`，并把 `‘ ’ “ ” "` 全部替换为 `'`（模糊匹配弯引号/直引号）。
3. 与标准答案 `word.text.toLocaleLowerCase()` 比较，不等 → `incorrect = true`。
4. `checkWordCorrect()`：所有词 `incorrect` 均为 false 才算对。

---

## 4. 单词槽计算逻辑

### 4.1 槽位搭建（`setupUserInputWords`，watchEffect）

- 监听 `source()`（当前句英文），按空格 `" "` split。
- 对每个 token：`isWord(text)`（含字母/数字）才创建一个 `reactive<Word>`：
  ```ts
  { text, isActive:false, userInput:"", incorrect:false, start:0, end:0, position:0, id }
  ```
- 第一个词默认 `isActive = true`。
- 每次新句子：`mode = Input`、`inputValue = ""`、清空数组后重建。

### 4.2 光标同步（`inputSyncUserInputWords`）

把 `inputValue` 按空格 split，依次回填每个词：
- `word.userInput = 片段`
- `word.start = position`，`word.end = position + 片段长度`
- `position += 片段长度 + 1`（+1 为词后空格）

`updateActiveWord(position)`：清空所有 `isActive`，找第一个满足 `start ≤ position ≤ end` 的词置激活。

### 4.3 槽宽 `minWidth` 计算

模板：`:style="{ minWidth: \`${inputWidth(w)}ch\` }"`

```ts
function inputWidth(word) {
  if (!isShowWordsWidth()) return 4;   // 用户关闭“显示词宽”：固定 4ch
  return getWordWidth(word);
}
```

`getWordWidth(word)` —— 按字符累加（小写化后查表，表外字符记 1），最后 **+1（左右留白）**：

| 字符 | 宽度系数 |
|---|---|
| w, m | 1.5 |
| s | 0.8 |
| t, r, f | 0.7 |
| j | 0.6 |
| i, l, ' | 0.5 |
| u, o, p, q, n, h, g, d, b | 1.1 |
| z, y, x, v, c | 0.9 |
| 其他字母/数字/符号 | 1.0 |

**单测已验证的值**：`"i"→1.5`、`"w"→2.5`、`"hi"→2.6`、`"wow"→5.1`、大写等价（`"WOW"→5.1`）、`"123"→4`、`"!@#"→4`。

### 4.4 三档样式切换条件（汇总）

```
激活词：  word.isActive && focusing === true  → 品红 #d946ef
错误词：  word.incorrect && focusing === true → 红 #ef4444（Fix 态再 + animate-shake）
其他：    默认灰（含未聚焦时的激活/错误词）
```

---

## 5. 键盘交互

### 5.1 `handleKeydown`（QuestionInput.vue 顶层，先于状态机）

| 条件 | 行为 |
|---|---|
| `e.code === "Backspace" && e.ctrlKey && isWindows()` | `preventDefault()` → `deletePreviousWordOnWin()`，`return`（Win 下 Ctrl+Backspace 删上一个词） |
| `e.ctrlKey`（其余 Ctrl 组合） | `preventDefault()`，`return`（防止中文输入法把预输入字符上屏） |
| `e.code === "Enter" && !isComposing` | `stopPropagation()` → `submitAnswer()`，`return` |
| 其他 | 交给状态机 `handleKeyboardInput(e)` |

- `isComposing`：`compositionstart/end` 维护，中文输入法组词期间 `true`，Enter 不提交。
- `deletePreviousWordOnWin()`：读 `selectionStart/End`；`end===0` 直接返回；先回退跳过连续空格；`newEnd = substring(0,start).lastIndexOf(" ")+1 || 0`；截断 `inputValue` 并把光标设到 `newEnd`。
- `preventCursorMove`（mousedown）：`preventDefault()` 阻止光标跳变，只调 `focusInput()`。

### 5.2 状态机 `handleKeyboardInput`（顺序敏感）

1. **方向键** `ArrowUp/Down/Left/Right` → `preventDefault()`，禁止移动光标。
2. **空格 + 非 Fix 态 + 最后一个词激活** → 若用户开启"空格提交"，`preventDefault + stopPropagation` 并提交。
3. **Fix 态任意键**：空格/退格 `preventDefault()`，调 `fixFirstIncorrectWord()`（进入 Fix_Input、清空第一个错词、光标定位），触发音效回调，返回。
4. **Fix_Input + 空格 + 当前是最后一个错误词** → 空格提交。
5. **Fix_Input + Backspace + 当前编辑词为空** → 光标回退到上一个错误词末尾。
6. **非 Input 态 + 空格** → `fixIncorrectWord()`（Fix→清第一个错词；Fix_Input→清下一个错词）。
7. 其余按键 → 仅触发 `inputChangedCallback`（音效判定）。

### 5.3 快捷键映射汇总

| 按键 | 效果 |
|---|---|
| Enter | 提交答案（非输入法组词中） |
| Space（可选设置） | 在末词/末错词处提交答案；修复态用于跳转下一个错词 |
| Backspace | 正常退格；Fix_Input 空词时回上一个错词 |
| Ctrl+Backspace（仅 Windows） | 删除上一个词 |
| 任意 Ctrl 组合键 | 屏蔽（防输入法上屏） |
| 方向键 | 全部禁用 |
| Fix 态任意可见字符键 | 直接开始修第一个错误词 |

---

## 6. 音效逻辑（useTypingSound.ts）

- **提示音**（HTMLAudio，模块级单例）：
  - 正确：`new Audio("~/assets/sounds/right.mp3")` → `playRightSound()`
  - 错误：`new Audio("~/assets/sounds/error.mp3")` → `playErrorSound()`
  - 触发时机：答案正确 → `handleAnswerRight()` 播 right；答案错误 → `handleAnswerError()` 播 error。
- **打字音**（Web Audio API，模块级单例 `AudioContext` + `AudioBuffer`）：
  - 源文件：`~/assets/sounds/typing.mp3`，首次调用时 `fetch` → `decodeAudioData`。
  - 节流：`PLAY_INTERVAL_TIME = 60ms`，`Date.now() - lastPlayTime < 60` 直接丢弃。
  - 播放：`createBufferSource()` → 接 `destination` → `start()`；`onended` 时 `disconnect()` 释放。
  - 触发条件（`checkPlayTypingSound(e)`，且用户开启"键盘音效"）：
    - `altKey/ctrlKey/metaKey` 任一为真 → 不播；
    - `e.key` 匹配 `/^[a-zA-Z0-9]$/` 或属于 `["Backspace"," ","'"]` → 播。

---

## 7. 错误处理（useAnswerError.ts）

- 模块级计数 `wrongTimes = 0`。
- `handleAnswerError()`：
  1. `playErrorSound()`；
  2. `wrongTimes++`；
  3. 若用户开启了错误提示（`isShowErrorTip()`）**且** `wrongTimes >= 3` → 自动 `showAnswerTip()` 弹出答案提示层。
- `resetCloseTip()`：`wrongTimes = 0` 且 `hiddenAnswerTip()`。
  - 调用时机：组件 `onMounted`、`courseStore.statementIndex` 变化（切新句）时。
- **抖动动画**：不在本文件，而在 `getWordsClassNames`——`word.incorrect && focusing && isFixMode()` 三者同时成立时给红色词槽加 `animate-shake`。

---

## 8. 移动端布局（`md:hidden` 块）

```
<div class="mt-12 flex flex-col items-center justify-center gap-4 md:hidden">
  <button class="btn btn-outline btn-sm" @click="handleSubmitAnswer">提交</button>
  <div class="flex gap-4">
    <button class="btn btn-outline btn-sm" @click="handleShowAnswerTip">
      {{ isAnswerTip() ? "隐藏" : "显示" }}答案
    </button>
    <button class="btn btn-outline btn-sm" @click="handlePlaySound">播放声音</button>
  </div>
  <MainMasteredBtn />
</div>
```

- PC（≥768px）靠 Enter/空格 提交、靠点击聚焦，故隐藏此区；移动端无键盘交互，改给三个按钮 + "已掌握"按钮。
- `btn btn-outline btn-sm` 为 daisyUI 按钮（描边风格、小尺寸）。
- "显示/隐藏答案"按钮文案随 `isAnswerTip()` 切换；"播放声音"调 `useCurrentStatementEnglishSound().playSound()`（`preventDefault`）。

---

## 9. AnswerTip.vue（答案提示弹层）

### 9.1 模板

```
<div class="absolute left-1/2 top-36 flex w-3/4 -translate-x-1/2
                    items-center justify-center text-xl dark:text-gray-50">
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body relative">
      <div class="absolute right-2 top-1 mt-0">
        <UButton color="gray" variant="ghost"
                 icon="i-heroicons-x-mark-20-solid"
                 tabindex="-1"
                 :ui="{ color: { gray: { ghost: 'dark:hover:bg-gray-600' } } }"
                 @click="hiddenAnswerTip" />
      </div>
      <div class="text-3xl">{{ courseStore.currentStatement?.english }}</div>
    </div>
  </div>
</div>
```

### 9.2 样式值

| class | 值 |
|---|---|
| `absolute left-1/2` | 绝对定位、水平居中于左 50% |
| `-translate-x-1/2`（源码 `translate-x-[-50%]`） | X 位移 -50%（自身宽一半，完成真居中） |
| `top-36` | top: 9rem = 144px |
| `w-3/4` | 宽度 75% |
| `text-xl` | font-size: 1.25rem = 20px |
| `dark:text-gray-50` | dark 模式文字 `#f9fafb` |
| `card bg-base-100 shadow-xl` | daisyUI 卡片、主题底色、大阴影 |
| `text-3xl` | 答案正文 font-size: 1.875rem = 30px |
| 关闭按钮定位 | `right-2 top-1`（0.5rem/0.25rem） |

- 关闭按钮为 Nuxt UI 的 `UButton`：`color=gray variant=ghost`、图标 `i-heroicons-x-mark-20-solid`、`tabindex=-1`（不抢 Tab 焦点）、dark 模式 hover 灰底。
- 内容：当前句英文整句；关闭走 `useAnswerTip().hiddenAnswerTip()`。

---

## 10. 复刻要点 Checklist

1. 可见层用 div 词槽 + 一层 `opacity-0 absolute` 的真实 input，键盘事件全部挂在 input 上。
2. 词宽 `minWidth: Nch`，N 走字符宽度表 +1 留白；可被用户设置整体降级为 4ch。
3. 三态词槽配色：品红激活 `#d946ef` / 红错误 `#ef4444` / 灰默认 `rgba(32,32,32,.6)`，且都依赖 `focusing`。
4. 状态机 Input→Fix→Fix_Input：提交错进 Fix，任意键进 Fix_Input，空格跳到下一错词，空词退格回上一错词。
5. 键位：Enter 提交（防中文组词）、空格可配置提交、Win 下 Ctrl+Backspace 删词、Ctrl 全屏蔽、方向键全屏蔽。
6. 音效：right/error 用 HTMLAudio，typing 用 Web Audio + 60ms 节流 + 字符白名单。
7. 错误：累计错 3 次（且用户开启错误提示）自动弹 AnswerTip；切句/挂载时重置计数。
8. 移动端 `<md` 才显示"提交/显示答案/播放声音/已掌握"按钮组。
