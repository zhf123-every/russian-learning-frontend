# RuQuest — 俄语连词成句学习游戏

基于句乐部（Earthworm）源码改造的俄语沉浸式学习网站，核心机制是"基于意群的连词成句"和"键盘优先"，支持中译俄和听写两种学习模式。

## 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | React 18 + Vite + React Router |
| 样式 | 原生 CSS（奶咖燕麦轻奢风，主色调 #9B7B5E） |
| 后端 | Python 3 + 原生 http.server + psycopg2 |
| 数据库 | PostgreSQL 16 |
| 判题引擎 | Python 自研（基于语法标注的结构化诊断） |
| 发音 | Web Speech API（ru-RU） |
| 部署 | 前端 Cloudflare Pages / 后端 Render |

## 目录结构

```
russian-learning-frontend-main/     # 前端项目（React + Vite）
├── src/
│   ├── components/quest/           # 答题相关组件
│   │   ├── QuestionInput.jsx       # 单词卡片输入组件（隐藏input+覆盖层）
│   │   ├── AnswerPanel.jsx         # 答对详情页（逐词发音+释义+语法）
│   │   ├── SummaryPanel.jsx        # 结算页（评级+撒花+数据上报）
│   │   └── ModeTabs.jsx            # 模式切换Tab（中译俄/听写）
│   ├── hooks/
│   │   ├── useQuestionInput.js     # 三态状态机（Input/Fix/Fix_Input）
│   │   ├── useKeyboardShortcuts.js # 全局快捷键（输入法防误提交）
│   │   └── useGameStats.js         # 游戏化统计（Combo+评级+正确率）
│   ├── pages/
│   │   ├── QuestPractice.jsx       # 中译俄模式答题页
│   │   ├── QuestDictation.jsx      # 听写模式答题页
│   │   └── TestPractice.jsx        # 闭环测试页
│   └── App.jsx                      # 路由配置
├── public/                           # 静态资源
└── package.json

russian-learning/                    # 后端项目（Python + PostgreSQL）
├── server.py                        # HTTP服务器 + API路由 + 数据库初始化
├── answer_engine.py                 # 判题引擎（结构化诊断+灵活语序）
├── seed_quest.py                    # 种子数据脚本（16道A1句子）
├── test_answer_engine.py            # 判题引擎单元测试
└── .env                             # 数据库连接配置
```

## 本地启动

### 1. 数据库（PostgreSQL 16）

```bash
# 启动 PostgreSQL（ZIP免安装版示例）
D:\pgsql\bin\pg_ctl -D D:\pgsql\data -l D:\pgsql\logfile start

# 默认连接：postgresql://postgres:123456@localhost:5432/russian
```

### 2. 后端

```bash
cd C:\Users\张宏飞\russian-learning

# 安装依赖
pip install psycopg2-binary

# 配置 .env
echo DATABASE_URL="postgresql://postgres:123456@localhost:5432/russian" > .env

# 注入种子数据（16道A1句子）
python seed_quest.py

# 启动后端（端口 8000）
python server.py
```

### 3. 前端

```bash
cd C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main

# 安装依赖
npm install

# 启动开发服务器（端口 5173）
npm run dev

# 生产构建
npm run build
npm run preview
```

### 4. 访问

- 中译俄模式：http://localhost:5173/quest-practice
- 听写模式：http://localhost:5173/quest-dictation
- 模式切换：点击顶部 Tab 或按 `Ctrl+Shift+M`

## 核心功能

### 答题模式
- **中译俄**：显示中文释义，用户输入俄语句子
- **听写**：播放俄语发音，用户凭听力输入（支持 Space 重播、Ctrl+; 模糊字幕）

### 三态状态机
- **Input**：正常输入模式
- **Fix**：答错后等待修正
- **Fix_Input**：逐词修正模式（空格跳下一个错词，Backspace 回退）

### 判题引擎（后端）
- **灵活语序**：不按位置匹配，基于 lemma + 句法角色集合匹配
- **词形变体接受**：通过 acceptableAnswers.wordVariants 允许变体
- **语法错误诊断**：基于 words 表语法标注的结构化对比
  - `case_error`：变格错误（应使用第四格却用了第一格）
  - `conjugation_error`：变位错误（人称/数不符）
  - `spelling_error`：拼写错误（lemma 正确但拼错）
  - `word_choice_error`：用词错误（lemma 不对）

### 游戏化
- **Combo 连击**：答对 +1，答错清零，5/10/20 连击触发屏幕光效
- **评级系统**：SSS（金色）/ SS（柔紫）/ S（灰蓝）/ A（墨绿）/ B（暖橙）/ C（灰褐）
- **结算撒花**：Canvas 粒子动画
- **数据持久化**：练习记录自动存入 quest_learning_records 表

### 键盘优先
- `Enter`：提交答案
- `Space`：输入空格 / 听写模式重播发音
- `Ctrl+'`：播放发音
- `Ctrl+;`：查看模糊字幕（听写模式）
- `Ctrl+Shift+M`：切换学习模式
- `Ctrl+Z`：撤销
- `Ctrl+Backspace`：删除整词
- 方向键禁用（防止光标错乱）
- 输入法组合状态防 Enter 误提交

## API 文档

### 获取课程句子
```
GET /api/courses/:courseId/statements
```
返回课程信息 + 全部句子 + words 语法标注 + acceptableAnswers。

### 提交答案
```
POST /api/answer/submit
Content-Type: application/json

{
  "statementId": "xxx",
  "userInput": "Я тебя люблю"
}
```
返回判题结果：`{ correct, errors, acceptedVariants, wordAnalysis }`

### 保存练习记录
```
POST /api/course/complete
Content-Type: application/json

{
  "course_id": "xxx",
  "completion_time": 120,
  "correct_count": 14,
  "total_count": 16,
  "max_combo": 10,
  "rating": "S"
}
```

## 数据库表结构

| 表名 | 说明 |
|---|---|
| quest_course_packs | 课程包 |
| quest_courses | 课程 |
| quest_statements | 句子（含中文、俄语、重音标注、语法要点） |
| quest_words | 单词级语法标注（lemma、form、pos、格、数、性、人称、时态、体、句法角色） |
| quest_acceptable_answers | 可接受答案（支持多语序和词形变体） |
| quest_learning_records | 学习记录（用时、正确率、最大连击、评级） |

## 种子数据（16道A1句子）

覆盖语法点：
- **名词六格**：第一格（Это мой друг）/ 第二格（У меня есть）/ 第三格（Я даю другу）/ 第四格（Я люблю тебя）/ 第五格（Я пишу ручкой）/ 第六格（в школе）
- **动词时态**：现在时（читаю/говорит）/ 过去时（читал/купила/пришёл）/ 将来时（буду читать）
- **形容词一致**：阴性（красивая девушка）/ 阳性第六格（большом городе）/ 阴性第四格（новую машину）
- **前置词**：в（六格）/ на（六格）/ с（五格）/ у（二格）

## 部署

### 前端（Cloudflare Pages）
- 构建命令：`npm run build`
- 输出目录：`dist`
- API 地址通过环境变量配置（当前硬编码为 `http://localhost:8000`，部署前需改为后端域名）

### 后端（Render / Railway）
- 构建命令：`pip install -r requirements.txt`
- 启动命令：`python server.py`
- 环境变量：`DATABASE_URL`（PostgreSQL 连接串）
- 端口：`$PORT`（Render 动态分配，当前硬编码为 8000，需适配）

## 许可证

MIT
