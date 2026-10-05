# 路线B：句乐部式 6 列表格 —— 接口契约与数据格式（P1 版）

> 适用范围：`jlTableEngine.js`（前端模板引擎）+ `server.py` 的 `table-fill` 增量。
> 设计原则：**模板决定步数与顺序，AI 只填词/分组/翻译，机器拼装 + 硬校验 → 结构错误率趋近 0。**

## 1. 6 列结构（与飞书模板逐字一致，禁止改名）

| 列 | 字段（JSON） | 取值说明 |
| :--- | :--- | :--- |
| 序号 | `seq` | 1..N 连续，无跳号 |
| 卡片类型 | `cardType` | `积木` / `完整句`（**唯一两值**，禁 `segment_type` 等第二套命名） |
| 俄语内容 | `ru` | 俄语文本（数字须俄语化，如 `500`→`пятьсот`） |
| 中文翻译 | `zh` | 该行中文；完整句行=整句翻译，积木行=该零件翻译 |
| 语法标签 | `tag` | 中文 3-10 字（如 主语 / 动词变位 / 名词宾格 / 否定句） |
| 组ID | `groupId` | `G_` + 两位序号（核心句链 `G_01`..`G_22`；短链 `G_01`..`G_05`） |

## 2. 核心算法（前后端必须一致，改任一侧须双侧同步）

### sentence_hash
```
sentence_hash = sha256( normalizeSentence(原句) ).hex() 前 16 位
```
- 输入是**俄语化后**的原句字符串（数字转俄语词），**不是** token 数组 —— tokenizer 升级不会导致缓存失效。
- 前端 `segmentEngine.sentenceHash(text, difficulty)` 与后端实现逐字节一致（UTF-8 bytes）。

### normalizeSentence / splitTokens
- `normalizeSentence`：trim + 压缩空白 + 数字俄语化。
- `splitTokens`：按空白分词，标点随词（`еду.` 整体一个 token）。
- 前端 `segmentEngine.js` 与后端 Python 版必须**逐字符一致**（比对脚本守护，`scripts/_seg_compare_*`）。

## 3. review_status 合法值（全链路唯一命名）

| 值 | 含义 | 谁写入 | 前端表现 |
| :--- | :--- | :--- | :--- |
| `ok` | AI 生成且前端 verifyTable 通过 | 前端 aiFillTable | 正常显示 |
| `pending` | AI 失败 → 机械兜底（结构对、zh 可能空），或后端 fallback | 前端 aiFillTable | 显示 + 提示"待人工校对" |
| `generating` | 后端异步生成中（占位行） | 后端 | 显示占位，等补跑 |

- 数据库/接口列名全程 `review_status`；对前端响应可用 `status` 字段，但必须在 handler 显式映射，**禁止两套命名并存**。

## 4. 接口契约

### POST /api/admin/segments/table-fill（P1 新增）
生成单个句子的 6 列表格（短链或核心长链）。

**入参**：
```json
{
  "sentence_hash": "sha256(俄语化原句) 前16位",
  "russian_text": "俄语化原句",
  "tokens": ["Я", "люблю", "еду"],
  "difficulty": "easy|medium|hard",
  "intents": "[意图序列（前端模板引擎生成）]",
  "pool": "可选；课级词池 {negation,time,place,degree,evaluation,predicates,objects,preposition,connector}"
}
```

**意图（intent）格式**（机器生成，AI 零结构决策）：
- 骨架占位行：`{kind:'full', cardType:'完整句', template:'skeleton', compose:[], groupId:'G_01'}` —— 后端检测到 skeleton full 行缺 tokensRef 时，自行做 **LLM-1 分组决策**（AI 返回二维索引数组 `[[0,1],[2]]`）→ 机器校验（不重不漏/组内连续/界内）→ 机器生成完整骨架段替换。
- 骨架 part 行：`{kind:'part', cardType:'积木', source:'core', tokensRef:[s,e], role, groupId}` —— 文本由机器 `tokens.slice(s,e+1).join(' ')` 截取，**拼接天然 == 原句**。
- 其余模板行：`{kind:'part'|'full', cardType, role, source:'template'|'pool'|'reuse', templateText?, poolKey?, poolIndex?, template?, hint?, groupId}`。
- `hint`（可选，5c 新增）：优先于自动提示传给 LLM-2（复习行等需要明确语义时使用）。

**两步 LLM**：
1. LLM-1（仅骨架缺分组时）：喂 token 编号列表 + 原句 + 难度 → `{groups:[{indexes,role}]}` → 机器校验 + 机器截取生成骨架。
2. LLM-2：逐行喂 AI —— fixed 行（机械可定：core 截取 / 模板固定词 / 不需变形的 pool 词：negation/time/place/degree/evaluation/preposition/connector）禁止改俄语只填 zh/tag；未定行（predicates/objects/组合/完整句/复用块）填 ru/zh/tag。

**防线**：
- fixed 行 AI 篡改 → 覆盖回机器值。
- 骨架完整句 ≠ 原句 → 防御回写。
- 分组非法 → `fallback`（`group_ai_none` / `group_invalid` / `fill_failed`）。
- 填词失败 → 重试 1 次。

**幂等**：缓存表 `sentence_slot_tables`，键 `(sentence_hash, difficulty, intents_fp)`；`intents_fp = md5(intents JSON)`、`prompt_v = SLOT_TABLE_PROMPT_V`（意图变或 prompt 升级 → 缓存自动失效重建）。命中且 prompt_v 匹配 → 直接返回缓存 rows，不调 LLM。

**出参**：
```json
{ "ok": true, "rows": [{ "seq": 1, "cardType": "积木", "ru": "Я", "zh": "我", "tag": "主语", "groupId": "G_01" }, ...] }
{ "fallback": true, "reason": "group_ai_none|group_invalid|fill_failed" }
```

### 前端 aiFillTable 失败分支（用户钉死，禁止静默兜底）
| 后端返回 | 前端行为 |
| :--- | :--- |
| `{pending:true}` | 不重试，直接返回 pending |
| `{fallback:true}` / 网络错误 | 重试 1 次 |
| 重试仍失败 | `buildMachineFallbackTable` 机械兜底（逐词累积 + 完整句，zh 留空）+ pending |
| 后端 ok 但前端 `verifyTable` 未过 | `console.error(sentenceHash/difficulty/errors/rows)` + 兜底 + pending |

### verifyTable 硬校验 7 项（前端写入前防御，机器校验）
1. 序号连续 1..N
2. `cardType ∈ {积木, 完整句}`
3. 每行 ru/zh 非空
4. 骨架完整句（第一个 完整句 行）`normalizeSentence` 后逐字符 `charCodeAt` == 原句（数字俄语化后比较；拦截零宽字符等隐蔽差异）
5. 零件全覆盖：`splitTokens(积木行 ru 拼接)` 的 Set 必须精确含原句每个 token（按词匹配，禁止 `еду ⊂ едушки` 子串误放行）
6. 变体完整句 ≠ 原句
7. 变体完整句 zh ≠ originalZh

## 5. 链结构（方案 A，用户已拍板）

| 链 | 适用 | 组成 | 规模 |
| :--- | :--- | :--- | :--- |
| 核心长链 `buildCoreChainIntent` | 每课第 1 句（`units[0]`，或 `core:true` 显式） | 20 类模板全开：骨架→否定→不定式→时间→地点→换谓语→换谓语+时间→换宾语→every day→all the day→need→have to→新宾语→something→It is 基础→for me→不定式评价→形容词轮换×3→连句(if/so/not)→复习×4 | ~190 意图，G_01..G_22 |
| 短链 `buildShortChainIntent` | 其余句子 | 骨架 + 否定 + 时间 + 地点 + 频率 | ~20 意图，G_01..G_05 |

词池消费：`predicates` 按出现次序递增（хочу/нужно/должен → 0/1/2）；`evaluation` 0/1/2/3（важно/хорошо/невозможно/возможно）；time/place/degree/objects/connector 固定 idx=0（复用首词，对齐句乐部同批词复用）。

## 6. 前端页面契约（学生端，P1 后生效）
- 学生端**不显示序号/组ID/列表**。
- 只按 `rows[].seq` 顺序展示：**给中文（zh）→ 用户打字输入俄语（ru）** → 机器逐字符比对。
- `rows` 为空或 `review_status='generating'` → 降级读原句整句输入，不报错不卡住（补跑入口只在后台 `/admin/segments`，用户端不提供）。

## 7. 失败模式清单（前端展示）
| 场景 | 展示 |
| :--- | :--- |
| 全部 ok | 正常学习 |
| 部分 pending（机械兜底） | 该句显示"此句待人工校对，暂用整句模式"，zh 空处显示原句翻译 |
| 网络错误 | toast"网络异常，已重试"，重试仍失败进待生成列表，下次打开自动补跑 |
| 后端 generating | 占位行，打开页面时检测并补跑 |

## 8. 冒烟复现
- `scripts/_table_fill_smoke.mjs`（前端 repo）：生成意图 → HS256 签 JWT → 真调生产 `table-fill` → `verifyTable` 双保险。用法 `node scripts/_table_fill_smoke.mjs ["句子"] ["中文"]`，`CORE=1` 跑核心长链。
