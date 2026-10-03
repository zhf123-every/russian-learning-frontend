# 语块（segments）契约文档 v1

> P1「语块化」主线的接口/数据契约。配套实现：
> 前端 `src/lib/segmentEngine.js`（纯函数 + 单次调用 + 批量组合，35/35 单测）
> 后端 `server.py` `_seg_*` 系列 handler 与两张表（sentence_segment_cache / sentence_segments）
>
> 核心设计：**AI 只做分组决策（返回索引），不输出文本**。文本一律由 splitTokens 机械截取，
> 拼接天然等于原句，杜绝 AI 幻觉改词。

---

## 1. sentence_hash 算法（前后端严格一致）

```
sentence_hash = sha256(normalizeSentence(text)).hexdigest() 的前 16 位
```

- 输入：`normalizeSentence(text)` = trim + 数字俄语化（`500` → `пятьсот`）后的字符串
- 编码：UTF-8 bytes（Python `hashlib` / JS `TextEncoder` 一致；禁止按 UTF-16 charCode 哈希）
- **难度不参与 hash**；cache 键 = `(sentence_hash, difficulty)` 两列联合
- 表列 `VARCHAR(64)`，存 16 位 hex

| 原句 | normalized | sentence_hash |
|---|---|---|
| `Я люблю книгу.` | `Я люблю книгу.` | `b186482aedd7d79f` |
| `Он читает книгу в школе.` | `Он читает книгу в школе.` | `d86fc1fd48059f32` |
| `Этому городу уже 500 лет.` | `Этому городу уже пятьсот лет.` | `212de783976473ae` |

---

## 2. review_status 语义（库列）与对外 status 字段

| review_status（库列） | 对外 status（接口字段） | 含义 | 前端行为 |
|---|---|---|---|
| `ok` | `ok` | AI 切块通过硬校验 | 正常渲染语块 |
| `pending` | `pending` | AI 失败 → 机械兜底（每 3 词一组），待后台人工校对 | 用户端不提供补跑；后台 /admin/segments 可筛 `pending` |
| `generating` | `generating` | 占位在途（未生成） | 降级读原句整句，不报错不卡住 |

硬约束：**库列统一 `review_status`，对外可返回 `status` 但须显式映射**；前端/SQL/接口文档三处禁止两套命名。

---

## 3. 接口契约

### 3.1 `POST /api/admin/segments/check`（批量查缓存命中）

- 入参：`{ "sentences": [{ "sentence_hash": "...", "difficulty": "easy" }, ...] }`
- 出参：`{ ok: true, cached: [{ "sentence_hash", "difficulty", "cache_id", "status" }] }`
- 只查缓存表，不调 LLM。50 句 = 1 次请求（批量）。

### 3.2 `POST /api/admin/segments/llm-segment`（AI 切块，后端持 key）

- 入参：`{ "sentence_hash", "russian_text"（= normalized 原句）, "tokens"（= splitTokens(normalized)）, "difficulty" }`
- 幂等三分支：
  1. 缓存命中且 `review_status='ok'` → `{ ok: true, cached: true, segments: [入库格式], translation }`，**不调 LLM**
  2. 命中但 `review_status='generating'` → `{ ok: false, pending: true }`（前端保持占位行，等补跑）
  3. 未命中 / cache pending → 调 LLM → `_seg_verify_indexes`（并集不重不漏 + 组内连续 + 首索引升序）→
     机械截取拼接 `== russian_text` 硬校验 → 写 cache（ok）→ `{ ok: true, segments: [索引组], translation }`
- 校验失败 / LLM 失败 → `{ ok: false, fallback: true }`（前端重试 1 次 → 机械兜底 + pending）

### 3.3 `POST /api/admin/segments/save`（写语块，upsert 不做整课时 DELETE）

- 入参：`{ "course_id", "unit_id", "items": [{ "sentence_hash", "sentence"（= normalized 原句，写 cache.sentence 溯源）, "difficulty", "status", "segments": [{ "sort_order", "text", "type", "chinese" }], "translation" }] }`
- 逻辑：
  - 有 segments：全局 cache upsert（幂等；translation 仅传入非空覆盖）→ 引用行逐块 ON DUPLICATE KEY UPDATE → 组尾部裁剪（只清 sort_order >= 新组数）
  - 无 segments 且 cache 命中：纯引用（从 cache 取语块写引用行）
  - 无 segments 且无 cache：占位行（cache_id=NULL, text='', type='pending_placeholder', review_status='generating'）
- `status` 合法值 `ok/pending/generating`，非法回退 `ok`。

### 3.4 公开读 `GET /api/segments?course_id=&unit_id=`

- 按 (sentence_hash, difficulty, sort_order) 分组返回；`status` 为对外映射；translation 来自 cache LEFT JOIN。

---

## 4. 前端 segmentEngine.js 关键函数

| 函数 | 职责 |
|---|---|
| `normalizeSentence` | trim + 数字俄语化（`numberToRussian`） |
| `sentenceHash` | `sha256(normalize).hex().slice(0,16)`，难度不参与 |
| `splitTokens` | 空格拆分 + 标点附着前词（与 snowballEngine 逐字符一致） |
| `verifyIndexes` | 纯索引校验：并集覆盖 0..n-1 不重不漏 + 组内连续 + 整数；按首索引升序重排返回，非法 null（不接触文本） |
| `verifySegments` | 纯文本校验：按索引机械截取重建，charCodeAt 逐字符 == 俄语化原句；调用方必须先跑 verifyIndexes |
| `buildMachineFallback` | 每 3 词一组兜底（末组按实际），打标 pending |
| `buildHardSegments` | 整句一组（type='sentence'），chinese=translation 或 '' |
| `aiSegment` | normalize → hash → splitTokens → POST llm-segment → verifyIndexes → verifySegments；业务 fallback 重试 1 次；`{pending:true}` → generating 不重试 |
| `checkCache` | 批量 GET /api/segments → Map（key=`${hash}::${difficulty}`） |
| `saveSegments` | POST save（不裁剪，items 已入库格式） |
| `generateUnitSegmentsAsync` | 分批并发（BATCH=3，上限≤5）；HTTP/JSON 异常向上抛进 failed；pending 句经 save 回写 status='pending'；返回 `{done, failed, pending}` |

内部结构：`aiSegment` 返回 `{ segments（索引组）, translation, reviewStatus, tokens, sentenceHash }`；
`reviewStatus='pending'` 时 segments 已是入库格式（sort_order/text），整体写回不走二次转换。

进程内缓存 `aiCache`（Map）只缓存 ok 结果、只优化单会话；**权威源是后端 cache 表**；不参与 reviewStatus 判定。

---

## 5. 失败模式清单（前端展示）

| 场景 | 前端表现 |
|---|---|
| `status='generating'`（占位在途） | 降级读原句整句输入，不报错不卡住；等后台补跑 |
| `status='pending'`（AI 失败机械兜底） | 正常渲染（机械组块）；后台可筛人工校对；用户端无补跑入口 |
| `fallback:true`（LLM 侧失败） | 前端重试 1 次 → 机械兜底 + pending 写库；verifySegments 失败必须 console.error + 上报，禁止静默兜底 |
| 无 segments（空） | 与 generating 相同：降级读原句整句 |
| 后端首请求 403（TiDB Serverless 连接冷启动） | 属已知环境现象（服务重启后首个请求偶发），前端按 HTTP 异常进 failed，用户重试即恢复；非鉴权缺陷 |

---

## 6. 已知实现细节 / 防回归

- `call_llm` 在 user_prompt 为空时补 `{"role":"user","content":"请开始。"}`（DeepSeek 要求 messages 至少一条 user，否则 1214 非法）——与 /api/ai 同款兼容修复，冒烟中实际触发的 bug。
- 数字句 tokens：`splitTokens(normalize(s))` 输出俄语数字（`пятьсот`）；未俄语化 tokens 传入会被 verifySegments 拦截（保护性，不是 bug）。
- 前后端 `verifyIndexes` 逻辑逐条等价（并集/连续/整数/升序），不会出现"后端放行前端拦截"触发无意义重试。
- 冒烟复现：`backend_live/_seg_smoke.py`（双端）、`_seg_smoke_local.py`（本地）、`scripts/_seg_smoke_payload.mjs`（前端算法生成 payload）。
