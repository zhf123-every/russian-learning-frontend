# -*- coding: utf-8 -*-
# 本地复现：复用后端真实类方法（prefill/machine_comb/build_full/ctx_update）跑 4.5 步 + 6) 组装，
# 定位 v9 下 dup_full 的具体重复行。零 DB、零 LLM（跳过 need_group / fill / retry）。
import importlib.util, sys, json, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, r'C:\Users\张宏飞\Desktop\website_source\backend_live')
spec = importlib.util.spec_from_file_location('server', r'C:\Users\张宏飞\Desktop\website_source\backend_live\server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)
h = object.__new__(server.Handler)

data = json.load(open(r'C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\_intents_v9.json', encoding='utf-8'))
intents, tokens, pool, russian_text = data['intents'], data['tokens'], data['pool'], data['sentence']
print('intents=%d tokens=%r' % (len(intents), tokens))

# 模拟后端 need_group 分组（LLM-1 机器骨架）：把 G_01 skeleton 占位替换为 5 条骨架行
SKEL = [
    {"kind": "part", "cardType": "积木", "role": "主语", "source": "core", "tokensRef": [0, 0], "groupId": "G_01"},
    {"kind": "part", "cardType": "积木", "role": "谓语", "source": "core", "tokensRef": [1, 1], "groupId": "G_01"},
    {"kind": "part", "cardType": "积木", "role": "组合", "source": "core", "tokensRef": [0, 1], "groupId": "G_01"},
    {"kind": "part", "cardType": "积木", "role": "补语", "source": "core", "tokensRef": [2, 3], "groupId": "G_01"},
    {"kind": "full", "cardType": "完整句", "template": "skeleton", "compose": [{"source": "core", "tokensRef": [0, 3]}], "groupId": "G_01"},
]
intents = SKEL + [st for st in intents if st.get("template") != "skeleton"]

# 4) 机械预填
prefilled = h._slot_table_prefill(intents, tokens, pool)

# 4.5) 机器预拼第一遍（拷贝自 server.py 5201-5253）
mctx = {"sub": (tokens[0] if tokens else ""), "pred": "", "obj": "", "neg": "", "neg_comb": "", "inf": "",
        "time_adv": "", "place": "", "eval": "", "deg": "", "ext": "", "conn": "", "nominal_pred": False,
        "last_full": "", "last_full_zh": "", "last_neg": "", "last_affirm": "", "last_eval": "", "full_by_template": {},
        "tokens": tokens, "last_comb": "", "pred_zh": ""}
for _r in prefilled:
    _mru = _r.get("fixed") or ""
    _tpl = _r.get("template") or ""
    if not _mru and _r.get("comb"):
        _mru = h._slot_table_machine_comb(_r.get("role"), mctx)
    if not _mru and _r.get("kind") == "part" and not _r.get("source"):
        _role = _r.get("role") or ""
        if _role == "不定式":
            _mru = "делать"
        elif _role == "宾语":
            _mru = "это"
    if not _mru and _r.get("kind") == "part" and _r.get("role") == "补语" and _r.get("source") == "reuse":
        _mru = mctx.get("obj") or ""
    if not _mru and _r.get("kind") == "full":
        if _tpl == "review":
            _m = server.re.search(r"复习[:：]\s*([a-z_]+)", _r.get("hint") or "")
            _src_tpl = _m.group(1) if _m else ""
            _src = mctx.get("full_by_template", {}).get(_src_tpl)
            if _src:
                _mru = _src["ru"]
            elif mctx.get("last_full"):
                _mru = mctx["last_full"]
        elif _tpl == "skeleton":
            _comp = _r.get("compose") or []
            if _comp and isinstance(_comp[0].get("tokensRef"), list) and len(_comp[0]["tokensRef"]) == 2:
                _s0, _e0 = _comp[0]["tokensRef"]
                if 0 <= _s0 <= _e0 < len(tokens):
                    _mru = " ".join(tokens[_s0:_e0 + 1])
        else:
            _mru = h._slot_table_build_full(_tpl, mctx)
    if not _mru and _tpl not in ("if", "so"):
        print('!! machine_gap at tpl=%s role=%s' % (_tpl or '?', _r.get("role") or '?'))
    if _mru:
        _r["fixed"] = _mru
    if _r.get("kind") == "part":
        h._slot_table_ctx_update(mctx, _r.get("role"), _mru, _r.get("source"), _r.get("poolKey"), _r.get("tokensRef"))
    elif _r.get("kind") == "full" and _mru and _tpl != "review":
        mctx["last_full"] = _mru
        mctx["full_by_template"][_tpl] = {"ru": _mru}
        if _tpl in h._SLOT_TABLE_NEG_TEMPLATES:
            mctx["last_neg"] = _mru
            if _tpl in ("negation", "object_neg", "predicate_neg"):
                mctx["last_neg_base"] = _mru
        else:
            mctx["last_affirm"] = _mru
            if _tpl in ("skeleton", "object_pos", "predicate_pos"):
                mctx["last_base"] = _mru
        if _tpl in ("evaluation", "degree", "evaluation_ext", "not"):
            mctx["last_eval"] = _mru

# 6) 组装（拷贝自 server.py 5308-5371 核心）
out_rows = []
ctx = {"sub": (tokens[0] if tokens else ""), "pred": "", "obj": "", "neg": "", "neg_comb": "", "inf": "",
       "time_adv": "", "place": "", "eval": "", "deg": "", "ext": "", "conn": "", "nominal_pred": False,
       "last_full": "", "last_full_zh": "", "last_neg": "", "last_affirm": "", "last_eval": "", "full_by_template": {},
       "tokens": tokens, "last_comb": "", "pred_zh": ""}
for i, r in enumerate(prefilled):
    tpl = r.get("template") or ""
    ru = r.get("fixed") or ""
    zh, tag = "", ""
    if ru:
        if r.get("kind") == "full":
            if tpl == "skeleton":
                comp = r.get("compose") or []
                if comp and isinstance(comp[0].get("tokensRef"), list) and len(comp[0]["tokensRef"]) == 2:
                    s0, e0 = comp[0]["tokensRef"]
                    if 0 <= s0 <= e0 < len(tokens):
                        ru = " ".join(tokens[s0:e0 + 1])
    else:
        if r.get("kind") == "full":
            if tpl == "skeleton":
                ru = " ".join(tokens)
            elif tpl in ("if", "so"):
                ru = ""  # 保持空，AI 填（本地无 LLM → 空）
            else:
                ru = h._slot_table_build_full(tpl, ctx)
        elif r.get("comb"):
            ru = h._slot_table_machine_comb(r.get("role"), ctx)
    if r.get("kind") == "part":
        h._slot_table_ctx_update(ctx, r.get("role"), ru, r.get("source"), r.get("poolKey"), r.get("tokensRef"))
    elif r.get("kind") == "full":
        tpl2 = r.get("template") or ""
        if tpl2 == "review":
            _m = server.re.search(r"复习[:：]\s*([a-z_]+)", r.get("hint") or "")
            src_tpl = _m.group(1) if _m else ""
            src = ctx.get("full_by_template", {}).get(src_tpl)
            if src:
                ru = src["ru"]
            elif ctx.get("last_full"):
                ru = ctx["last_full"]
        else:
            if ru:
                ctx["last_full"] = ru
                ctx["full_by_template"][tpl2] = {"ru": ru}
                if tpl2 in h._SLOT_TABLE_NEG_TEMPLATES:
                    ctx["last_neg"] = ru
                    if tpl2 in ("negation", "object_neg", "predicate_neg"):
                        ctx["last_neg_base"] = ru
                else:
                    ctx["last_affirm"] = ru
                    if tpl2 in ("skeleton", "object_pos", "predicate_pos"):
                        ctx["last_base"] = ru
                if tpl2 in ("evaluation", "degree", "evaluation_ext", "not"):
                    ctx["last_eval"] = ru
    out_rows.append({"seq": i + 1, "cardType": r["cardType"], "ru": ru, "groupId": r["groupId"], "tpl": r.get("template") or "", "hint": r.get("hint") or ""})

print('\n--- 本地拼装全表（%d 行）---' % len(out_rows))
for x in out_rows:
    print('%02d [%s] %-6s tpl=%-14s %s' % (x['seq'], x['groupId'], x['cardType'], (x['tpl'] or 'part'), x['ru']))

# 6.6 同组完整句检测（与后端同逻辑）
seen_in_group = {}
dup_idx = []
first_full_seen = False
for i, row in enumerate(out_rows):
    if row['cardType'] != '完整句':
        continue
    if not first_full_seen:
        first_full_seen = True
        s = seen_in_group.setdefault(row['groupId'], set())
        s.add(row['ru'])
        continue
    s = seen_in_group.setdefault(row['groupId'], set())
    if row['ru'] in s or row['ru'] == russian_text:
        dup_idx.append(i)
    s.add(row['ru'])
print('\nDUP idx=' + json.dumps(dup_idx))
for _di in dup_idx:
    _row = out_rows[_di]
    _same = [o['ru'] for o in out_rows if o['cardType'] == '完整句' and o['groupId'] == _row['groupId']]
    print('  DUP %02d g=%s tpl=%s ru=%r | 组内=%s' % (_di, _row['groupId'], _row['tpl'], _row['ru'], json.dumps(_same, ensure_ascii=False)))
if not dup_idx:
    print('  (无重复)')
