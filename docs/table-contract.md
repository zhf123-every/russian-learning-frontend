# 路线B：句乐部式 6 列表格 —— 接口契约与数据格式（P1 收尾版）

> 适用范围：`jlTableEngine.js`（前端模板引擎）+ `server.py` 的 `table-fill` 增量。
> 设计原则：**模板决定步数与顺序，AI 只填词/分组/翻译，机器拼装 + 硬校验 → 结构错误率趋近 0。**
> 本版相对 P1 初版契约的变更：AI 不再整句重写（改为机器拼装状态机）、verifyTable 升级为 8 项、填词拆批并行、分组重试、组合块 zh 机器兜底。

## 1. 6 列结构（与飞书模板逐字一致，禁止改名）

| 列 | 字段（JSON） | 取值说明 |
| :--- | :--- | :--- |
| 序号 | `seq` | 1..N 连续，无跳号 |
| 卡片类型 | `cardType` | `积木` / `完整句`（**唯一两值**，禁 `segment_type` 等第二套命名） |
| 俄语内容 | `ru` | 俄语文本（数字须俄语化，如 `500`→`пятьсот`） |
| 中文翻译 | `zh` | 该行中文；完整句行=整句翻译，积木行=该零件翻译 |
| 语法标签 | `tag` | 中文 3-10 字（如 主语 / 动词变位 / 名词宾格 / 否定句）；组合块 tag 机器固定为 `组合块` |
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
  - **分组 prompt 铁律**：谓语必须单独成组，禁止与宾语/补语合并；role=谓语 的多词意群由机器拆分（首词=谓语，其余→补语），保证否定组合可机器拼出 `не + 谓语`。
- 骨架 part 行：`{kind:'part', cardType:'积木', source:'core', tokensRef:[s,e], role, groupId}` —— 文本由机器 `tokens.slice(s,e+1).join(' ')` 截取，**拼接天然 == 原句**。
- 其余模板行：`{kind:'part'|'full', cardType, role, source:'template'|'pool'|'reuse', templateText?, poolKey?, poolIndex?, template?, hint?, groupId}`。
- `hint`：优先于自动提示传给 LLM-2（复习行等需要明确语义时使用）。复习行 hint 用模板名（如 `复习：object_pos`），后端据此从 `full_by_template` 复制整行。

**两步 LLM**：
1. LLM-1（仅骨架缺分组时）：喂 token 编号列表 + 原句 + 难度 → `{groups:[{indexes,role}]}` → 机器校验 + 机器截取生成骨架。**空响应重试 1 次**。
2. LLM-2：逐行喂 AI —— fixed 行（机械可定：core 截取 / 模板固定词 / 不需变形的 pool 词：negation/time/place/degree/evaluation/preposition/connector）禁止改俄语只填 zh/tag；未定行（predicates/objects/组合/if/so）填 ru/zh/tag。**行数 > 28 时拆批并行（≤28 行/批）**，规避 Render 免费层 60s 网关超时。

**机器拼装状态机（后端 `_slot_table_ctx_update`，AI 零结构决策的核心）**：
- ctx 关键字段：`tokens / sub / pred / pred_zh / obj / neg / inf / time_adv / place / eval / deg / ext / conn / nominal_pred / last_full / last_full_zh / last_neg / last_eval / full_by_template / last_comb`。
- `nominal_pred`（нужно/надо/можно/нельзя）→ 完整句用 `Мне` 句式。
- `full_by_template`：记录各模板最近完整句，供 review 行复制。
- 组合块机器拼 `_slot_table_machine_comb`：не+谓语 / 不定式+宾语 / 不定式+地点 / 主语+谓语 / 谓语+宾语；comb 行 tokensRef 反推 pred。
- 完整句机器拼 `_slot_table_build_full`：negation/object_pos/predicate_pos/object_neg/predicate_neg/time_pos/time_neg/place_pos/place_neg/evaluation/degree/evaluation_ext/not 全机器拼；if/so/review/skeleton 例外（AI 整句）。
- **组合块 zh 机器兜底**：`не X` 组合块若 AI zh 不以"不"开头 → `zh = "不" + ctx.pred_zh`（禁止"爱食物"这类带宾语误译）。
- review 行：hint 正则 `复习[:：]\s*([a-z_]+)` 取模板名 → 从 `full_by_template` 复制整行（ru/zh/tag=复习回顾）；无匹配复 `last_full`。

**防线（按序）**：
- fixed 行 AI 篡改 → 覆盖回机器值。
- 骨架完整句 ≠ 原句 → 防御回写。
- 分组非法 → 重试后仍失败 → `fallback`（`group_ai_none` / `group_invalid` / `fill_failed`）。
- 填词失败 → 重试 1 次（含拆批后任一批失败）。
- **同组完整句防重** `_slot_table_retry_dup`：同组完整句互相重复 / 变体还原成原句 → LLM 重填 1 次 → 仍重复/非法 → `fallback {reason:'dup_full'}`（跨组同 ru 放行）。

**幂等**：缓存表 `sentence_slot_tables`，键 `(sentence_hash, difficulty, intents_fp, prompt_v)`；`intents_fp = md5(intents JSON)`、`prompt_v = SLOT_TABLE_PROMPT_V`（意图变或 prompt 升级 → 缓存自动失效重建）。命中且 prompt_v 匹配 → 直接返回缓存 rows，不调 LLM。**⚠️ 任何 prompt/逻辑变更必须 bump `SLOT_TABLE_PROMPT_V`，否则幂等缓存返回旧结果。**

**出参**：
```json
{ "ok": true, "rows": [{ "seq": 1, "cardType": "积木", "ru": "Я", "zh": "我", "tag": "主语", "groupId": "G_01" }, ...] }
{ "fallback": true, "reason": "group_ai_none|group_invalid|fill_failed|dup_full" }
```

### 前端 aiFillTable 失败分支（用户钉死，禁止静默兜底）
| 后端返回 | 前端行为 |
| :--- | :--- |
| `{pending:true}` | 不重试，直接返回 pending |
| `{fallback:true}` / 网络错误 | 重试 1 次 |
| 重试仍失败 | `buildMachineFallbackTable` 机械兜底（逐词累积 + 完整句，zh 留空）+ pending |
| 后端 ok 但前端 `verifyTable` 未过 | `console.error(sentenceHash/difficulty/errors/rows)` + 兜底 + pending |

### verifyTable 硬校验 8 项（前端写入前防御，机器校验）
1. 序号连续 1..N
2. `cardType ∈ {积木, 完整句}`
3. 每行 ru/zh 非空
4. 骨架完整句（第一个 完整句 行）`normalizeSentence` 后逐字符 `charCodeAt` == 原句（数字俄语化后比较；拦截零宽字符等隐蔽差异）
5. 零件全覆盖：`splitTokens(积木行 ru 拼接)` 的 Set 必须精确含原句每个 token（按词匹配，禁止 `еду ⊂ едушки` 子串误放行）
6. 变体完整句 ≠ 原句
7. 变体完整句 zh ≠ originalZh
8. **同组完整句防重**：同 groupId 内完整句 ru 不得重复（跨组同 ru 放行）

## 5. 链结构（方案 A，用户已拍板；2026-09 核心链压缩至 ~40 步）

| 链 | 适用 | 组成 | 规模 |
| :--- | :--- | :--- | :--- |
| 核心长链 `buildCoreChainIntent` | 每课第 1 句（`units[0]`，或 `core:true` 显式） | 模板子集：骨架→否定→不定式→时间→地点→换谓语→换宾语→频率→复习×4 | ~34 意图 / ~40 步，G_01..G_09 |
| 短链 `buildShortChainIntent` | 其余句子 | 骨架 + 否定 + 时间 + 地点 + 频率 | ~20 意图，G_01..G_05 |

> 核心链已砍掉的深层模板（曾属 190 步版）：something/it_is/for_me/to_do_eval/adj_rotate/clause/need/have_to。意图结构变更 → `intents_fp` 自动失效 → 已入库旧长链由补跑按新结构重生成（无需动后端）。predicates 词池只消费 idx=0（хочу）。

词池消费（短链/核心链现状）：`predicates` 固定 idx=0（хочу）；time/place/degree/objects/connector 固定 idx=0（复用首词，对齐句乐部同批词复用）。

## 6. 前端页面契约（学生端）
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
| 后端 fallback `dup_full` | 该句降级整句模式 + 提示"该句变体与骨架重复，已跳过变体生成" |

## 8. 生产环境约束（Render 免费层）
- **60s 网关超时**：单请求处理超 60s 会被 Render 网关断连（客户端表现为 `fetch failed` / "连接被意外关闭"）。长链填词已拆批并行（≤28 行/批，4 批并行 ~5s 完成）规避。
- **冷启动**：实例休眠后首个请求可能慢；部署窗口期（push 后 1-3 分钟）请求易失败，重试即可。
- **Windows node 双栈 DNS**：本机跑冒烟脚本可能走无路由 IPv6 导致间歇 `fetch failed`，脚本已强制 `dns.setDefaultResultOrder('ipv4first')` + 3 次网络重试。

## 9. 冒烟复现
- `scripts/_table_fill_smoke.mjs`（前端 repo）：生成意图 → HS256 签 JWT → 真调生产 `table-fill` → `verifyTable` 双保险。用法 `node scripts/_table_fill_smoke.mjs ["句子"] ["中文"]`，`CORE=1` 跑核心长链。
- 退出码：0=verifyTable 过 / 1=HTTP·响应异常 / 2=网络错误（已重试 3 次）/ 3=后端 fallback / 4=结构异常 / 5=verifyTable 未过。
- 绕开 undici 大请求问题时的备用链路：`node scripts/_gen_smoke_body.mjs <句子> <中文>`（CORE=1 长链）生成 `_smoke_body.json` → PowerShell 读文件 + node 生成 JWT 发 POST → `verifyTable` 读响应校验。

## 10. P2 持久化（课时维度落库 + 学生端切换，已部署）
### 新表 `sentence_slot_unit_tables`
- 列：`course_id / unit_id / sentence_hash / sentence / difficulty / intents_fp / rows(JSON,反引号) / review_status / created_at / updated_at`。
- 唯一约束 `uk_slot_unit (course_id, unit_id, sentence_hash, difficulty, intents_fp)`。
- **⚠️ `rows` 是 TiDB 保留字**：CREATE/SELECT/INSERT 三处 SQL 必须反引号（裸写静默失败，表建不出来）。
- 删课时/课程：同事务级联删本表（勿裸同步调）。

### 接口
- `POST /api/admin/slot-tables/save`（admin 鉴权）：body `{course_id, unit_id, items:[{sentence_hash, sentence, difficulty, intents_fp, rows, review_status}]}` → `{ok, saved:N}`。事务内 DELETE 该 unit 旧行 + INSERT 新行（批量 replace）；校验 sentence_hash 非空 / difficulty 三值 / rows 非空列表并过滤非法行；`_log_op` 记日志。
- `GET /api/slot-tables?course_id=&unit_id=&difficulty=&include_pending=0|1`（公开读）：只回 `review_status='ok'` 且有 rows（代码层再兜 status/difficulty 过滤，rows 按 seq 升序）；`include_pending=1` 回全部行（rows 可空，供后台校对比对"未生成"）。

### 前端接线
- `saveUnit` 保存课时成功 → 立即返回 → 后台异步 `generateUnitTableAsync`（表格生成+save）；失败进 `rb_pending_slot_tables` 待生成列表，下次打开课时自动补跑（关闭页面后不保证完成，靠补跑兜底）。
- 新页 `/admin/slot-tables`（AdminSlotTables.jsx）：只读 + 补跑 + 难度/状态筛选 + 表格行预览；不做人工编辑（留后续）。
- **学生端四模式表格优先**（loadSlotTables.js）：中译俄/听力/口语 → `loadSlotTablesForUnit`（slotTablesToSequences）；听写 → `loadSlotTablesItemsForUnit`（slotTablesToItems，每行一步听写）。有 ok 表格 → 出表格题；无 → 降级链（路径 → 语块 → 老路径），失败静默 null 不弹错。
- 转换器单测 `tests/slotTablesToQuestions.test.js` 7/7；引擎单测 `tests/jlTableEngine.test.js` 35/35。
- **学生端展示**：不显示序号/列表，只按 rows[].seq 顺序给中文 → 打字输入俄语。

### P2 端到端冒烟
- `scripts/_slot_save_smoke.mjs <句子> <中文>`：生成短链（真 LLM）→ 生产 save（probe 课时）→ 生产 read → verifyTable 校验回读。退出码 0=全链路通过 / 6=save 失败 / 7=read 回读不符（其余同第 9 节）。
- 生产实测（2026-09 后端 79dac27 + 前端 eaab26d）：生成 22 行 → save 200 saved:1 → read 回读 22 行 seq 1..22 verifyTable 通过；difficulty=easy 过滤与 include_pending=1 均返回 1 item。
