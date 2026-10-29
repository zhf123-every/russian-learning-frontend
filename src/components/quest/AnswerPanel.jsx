/**
 * AnswerPanel.jsx —— 答对详情页（句乐部完整复刻版）
 *
 * 布局：
 *  - 单词卡片行（顶部标签→重音符→大字→彩色下划线→中文→词性）
 *  - 整句中文释义 + 复制图标
 *  - 底部快捷键提示栏（无按钮，空格/Enter直接下一题）
 *
 * 颜色规则（按句法角色 syntacticRole）：
 *  - subject 主语 → 红 #EF4444
 *  - predicate 谓语 → 绿 #22C55E
 *  - object 宾语 → 蓝 #3B82F6
 *  - adverbial 状语 → 橙 #F59E0B
 *  - attribute 定语 → 紫 #A855F7
 *  - predicative 表语 → 青 #14B8A6
 *  - complement 补语 → 粉 #EC4899
 *
 * 发音：Yandex SpeechKit 真人俄语发音（后端 TTS），优先 audio_url 缓存
 */

import { useEffect, useCallback, useState, useRef, useMemo, Fragment } from "react";
import { getPosLabel, getPosColor, buildGrammarLabel } from "../../constants/posColors";
import { annotateWords, ensureDictFull, ensureDictZh, zhOf } from "../../lib/wordAnnotate";
import { inferRoles, roleKeyFromZh } from "../../lib/roleRules";
import { getCachedAnnotation } from "../../lib/annotateCache";
import { UI_DEFAULT, posColorOf, posStyleOf, BG_STYLE } from "../../hooks/useQuestSettings";

import { playGlobalAudio, stopGlobalAudio } from "../../utils/audioService";
import { speakText } from "../../lib/tts";
import { useSettingsStore } from "../../store/settingsStore";
import ShortcutTips from "./ShortcutTips";
import WordDetailCard from "./WordDetailCard";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
// 内存缓存：音色::text -> audio_url，避免重复请求（切换音色后自动命中新 key，旧缓存作废）
const ttsCache = new Map();

// 句法角色 → 颜色映射（边框/标签用角色色，与词性下划线色按"色相反差"拉开）
// 词性下划线色：名词蓝#3B82F6(217°)、动词绿#22C55E(142°)、形容词紫#A855F7(269°)、
// 副词黄#EAB308(45°)、代词红#EF4444(0°)、前置词靛蓝#818CF8(239°)、连词粉#EC4899(330°)、
// 感叹词橙#F97316(25°)、助词青#06B6D4(186°)、数词紫#A855F7(269°)、默认灰#9CA3AF
// 每个角色边框色与其最常见搭配词性下划线色的色相差 ≥76°，保证同卡强烈反差：
//   定语金黄↔形容词紫141°、宾语粉紫↔名词蓝85°、主语亮绿↔名词蓝82°/代词红135°、
//   谓语浅橙↔动词绿114°、状语天蓝↔副词黄154°、前置词青柠↔靛蓝158°等
// 同屏高频组合（主语/谓语/前置词/宾语/表语/定语 同句出现）色相两两拉开（≥46°）
const ROLE_COLORS = {
  subject: "#4ADE80",      // 主语 - 亮绿（vs 名词蓝82°/代词红135°，恒同屏组合互异）
  predicate: "#FB923C",    // 谓语 - 浅橙（vs 动词绿114°，与主语/宾语/前置词同屏拉开）
  object: "#E879F9",       // 宾语 - 粉紫（vs 名词蓝85°，与谓语浅橙同屏86°）
  adverbial: "#38BDF8",    // 状语 - 天蓝（vs 副词黄154°）
  attribute: "#FACC15",    // 定语 - 金黄（vs 形容词紫141°，截图冲突修复）
  predicative: "#F43F5E",  // 表语 - 玫红（vs 名词蓝133°/形容词紫81°）
  complement: "#DB2777",   // 补语 - 深粉红（vs 表语玫红 亮度拉开）
  negation: "#94A3B8",     // 否定 - 灰蓝（避开默认灰）
  preposition: "#84CC16",  // 前置词 - 青柠（vs 前置词靛蓝158°，与谓语/状语同屏拉开）
  conjunction: "#0369A1",  // 连接词 - 深青蓝（vs 状语天蓝 亮度拉开，修复"连接词/状语边框相近"）
  particle: "#A78BFA",     // 语气词 - 淡紫罗兰（vs 助词青76°）
  interjection: "#0F766E", // 感叹词 - 深青绿（vs 状语天蓝/连接词深青蓝 亮度拉开）
  numeral: "#B45309",      // 数词 - 暗金棕（vs 定语金黄 亮度拉开）
  default: "#9CA3AF",
};

// 边框色（与 ROLE_COLORS 同步：标签/边框同色；1px 细边框 + e6 半透明 90%）
const ROLE_BORDER_COLORS = {
  subject: "#4ADE80",      // 主语 - 亮绿
  predicate: "#FB923C",    // 谓语 - 浅橙
  object: "#E879F9",       // 宾语 - 粉紫
  adverbial: "#38BDF8",    // 状语 - 天蓝
  attribute: "#FACC15",    // 定语 - 金黄
  attributive: "#FACC15",  // 定语（兼容 attributive 写法，修复"定语灰色边框"）
  predicative: "#F43F5E",  // 表语 - 玫红
  complement: "#DB2777",   // 补语 - 深粉红
  negation: "#94A3B8",     // 否定 - 灰蓝
  preposition: "#84CC16",  // 前置词 - 青柠
  conjunction: "#0369A1",  // 连接词 - 深青蓝（vs 状语天蓝区分）
  particle: "#A78BFA",     // 语气词 - 淡紫罗兰
  interjection: "#0F766E", // 感叹词 - 深青绿
  numeral: "#B45309",      // 数词 - 暗金棕
  default: "#9CA3AF",
};

// 句法角色 → 中文标签（兼容各种写法）
const ROLE_LABELS_MAP = {
  subject: "主语",
  predicate: "谓语",
  object: "宾语",
  attribute: "定语",
  attributive: "定语", // ROLE_ZH_TO_KEY 映射用的是 attributive，需兼容
  adverbial: "状语",
  predicative: "表语",
  complement: "补语",
  negation: "否定",
  // 兼容带后缀的写法
  predicate_noun: "表语",
  predicate_adjective: "表语",
  predicate_verb: "谓语",
  direct_object: "宾语",
  indirect_object: "宾语",
  prepositional_object: "宾语",
  preposition: "前置词",
  conjunction: "连接词",
  particle: "语气词",
  interjection: "感叹词",
  numeral: "数词",
};

function getRoleColor(role) {
  if (!role) return ROLE_COLORS.default;
  // 先精确匹配，再尝试去掉后缀
  if (ROLE_COLORS[role]) return ROLE_COLORS[role];
  const base = role.split("_")[0];
  return ROLE_COLORS[base] || ROLE_COLORS.default;
}

function getRoleLabel(role) {
  if (!role) return "";
  if (ROLE_LABELS_MAP[role]) return ROLE_LABELS_MAP[role];
  const base = role.split("_")[0];
  return ROLE_LABELS_MAP[base] || role;
}

export default function AnswerPanel({
  statement,
  onRetry,
  onNext,
  isLast = false,
  ui = {},
}) {
  const [copied, setCopied] = useState(false);
  // 点词弹出的单词卡（生词本收录入口）
  const [detailWord, setDetailWord] = useState(null);
  // 完整词典（dict-full.js，25MB 懒加载）就绪标记：就绪后强制重跑整句标注，
  // 保证变位动词（знаю→знать）等只有完整词典才有的词形也能拿到词性/颜色/成分
  const [dictReady, setDictReady] = useState(false);
  // 手机端适配：屏宽 < 640px 时缩小词卡/字号/间距
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---- 俄语发音（Yandex 真人发音）----
  const audioRef = useRef(null);

  const speakRussian = useCallback(async (text, audioUrl = null, itemId = null, itemType = null) => {
    if (!text) return;
    // 发音源/发音类型/音量实时读取（设置弹窗「声音」页）
    const st = useSettingsStore.getState().settings;
    const ttsSource = st.ttsSource || "premium";
    const voice = st.ttsVoice || (ttsSource === "system" ? "female" : "alena");
    const volume = (st.vol ?? 100) / 100;
    try {
      // 停止当前播放
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      let url = audioUrl;
      const cacheKey = `${ttsSource}:${voice}::${text}`;

      // 没有缓存的 audio_url，调用后端 TTS 合成
      // 发音源=系统发音人时 voice=female/male → 微软神经音色（Svetlana/Dmitry）
      if (!url) {
        // 先查内存缓存（按音色隔离）
        if (ttsCache.has(cacheKey)) {
          url = ttsCache.get(cacheKey);
        } else {
          const res = await fetch(`${API_BASE}/api/tts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voice, id: itemId, type: itemType }),
          });
          const data = await res.json();
          if (data.ok && data.audio_url) {
            url = data.audio_url.startsWith("http") ? data.audio_url : `${API_BASE}${data.audio_url}`;
            ttsCache.set(cacheKey, url);
          }
        }
      } else if (!url.startsWith("http")) {
        url = `${API_BASE}${url}`;
      }

      if (url) {
        // 全局唯一音频控制器：暂停旧 → 复位 → 赋新 src → play（杜绝与答题页发音重叠）
        playGlobalAudio(url, { rate: ui?.rate || 1, volume });
      } else if (ttsSource === "system" && ("speechSynthesis" in window)) {
        // 后端不可用 → 系统发音人兜底浏览器语音合成
        speakText(text, { rate: ui?.rate || 1, volume, times: 1, gap: 600 });
      }
    } catch (e) {
      console.warn("发音失败:", e);
    }
  }, []);

  // 组件卸载时立即停止本组件的发音（切题/重试后不再继续播）
  useEffect(() => {
    return () => {
      stopGlobalAudio(); // 组件卸载：立即停止全局音频（切题/重试后不再继续播）
      audioRef.current = null;
    };
  }, []);

  // 空格 / Enter 快捷键 → 下一题
  useEffect(() => {
    const handleKey = (e) => {
      // 弹窗/输入框内打字（AI对话弹窗等）：不触发"空格/Enter 下一题"，避免打字时跳题
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        onNext?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onNext]);

  // 复制整句中文
  const handleCopy = useCallback(() => {
    if (!statement?.chinese) return;
    navigator.clipboard?.writeText(statement.chinese).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [statement?.chinese]);

  // 完整词典懒加载：需要规则标注时先确保 dict-full.js 就绪，加载完成后置 dictReady → 触发 useMemo 整句重标
  // （否则首次进答题页时 25MB 词典未就绪，знаю 等变位动词查不到词性/颜色/成分，且加载完不会自动重跑）
  useEffect(() => {
    const raw = statement?.words || [];
    const needRules = (!raw || raw.length === 0)
      || raw.some((w) => !w.pos || w.pos === "default" || !w.roleLabel || w.roleLabel === "default" || !w.syntacticRole || w.syntacticRole === "default");
    if (!needRules || !statement?.russian) return;
    let alive = true;
    Promise.resolve(ensureDictFull()).then(() => { if (alive) setDictReady(true); }).catch(() => {});
    return () => { alive = false };
  }, [statement?.words, statement?.russian]);

  // 词卡框释义补全补丁表：由下方 useEffect 懒加载 БКРС 词典（dict-zh.js）后写入，
  // 渲染时 chinese 优先走课程数据，缺释义时用补丁表（必须定义在 words useMemo 之后，避免 TDZ）
  const [zhPatch, setZhPatch] = useState({});

  // 本地即时标注：词典（重音/词性/性数格）+ 形态规则引擎（句子成分）整句同步推断
  // 引擎优先：无论课程数据带没带标注，都以 词典标注+规则引擎 的整句结果为准（课程数据仅作词典未命中回退），
  // 杜绝课程数据里残留的错误词性/错误成分原样显示
  const words = useMemo(() => {
    let raw = statement?.words || [];
    // 兜底：如果 words 为空，用 russian 自动 split 并调词典补全（听写页/本地数据无逐词标注时）
    if ((!raw || raw.length === 0) && statement?.russian) {
      const norm = String(statement.russian)
        .replace(/[，。！？；：]/g, (m) => (
          { "，": ",", "。": ".", "！": "!", "？": "?", "；": ";", "：": ":" }[m] || m
        ))
        .replace(/[\u00ad\u200b-\u200f\u2060-\u2064\u206a-\u206f\ufeff]+/g, "")
        .replace(/[\u00a0\u3000\u2009\u2028\u2029\u202f\u205f\t\r\n\f\v]+/g, " ")
        // 词中标点补空格："Нет，это"（全角逗号转半角后无空格）→ "Нет, это"，逗号独立成标点槽
        .replace(/([\u0410-\u044f\u0401\u0451a-zA-Z])([,.;:!?…])(?=[\u0410-\u044f\u0401\u0451a-zA-Z])/g, "$1$2 ");
      const tokens = norm.split(/\s+/).filter(Boolean)
        .map((t) => t.replace(/^[\s.,!?;:…—–，。！？；：、'"()\[\]{}-]+|[\s.,!?;:…—–，。！？；：、'"()\[\]{}-]+$/g, ""))
        .filter(Boolean);
      raw = tokens.map((t) => ({ ru: t, chinese: statement.chinese || "" }));
    }
    if (statement?.russian) {
      // 优先用缓存（预标注过的句子直接用，不用等词典加载）
      let roleWords = getCachedAnnotation(statement.russian);
      if (!roleWords) {
        // 缓存未命中 → 现算
        const dictWords = annotateWords(statement.russian);
        roleWords = inferRoles(statement.russian, dictWords);
      }
        // Excel 上传的逐词句子成分（数量与词数对齐时）为权威标注，直接覆盖引擎推断的角色
        const excelRoles = Array.isArray(statement?.syntactic) ? statement.syntactic : null;
        const excelOk = excelRoles && excelRoles.length === roleWords.length;
        return roleWords.map((rw, i) => {
          const w = raw[i] || {};
          // 词典查不到的词（专有名词等）：回退课程数据的词性/释义
          const enginePos = rw.pos && rw.pos !== "default" ? rw.pos : "";
          const finalPos = enginePos || (w.pos && w.pos !== "default" ? w.pos : "") || "";
          const xl = excelOk ? excelRoles[i] : "";
          const xlKey = xl ? roleKeyFromZh(xl) : "";
          return {
            ...w, ...rw,
            pos: finalPos,
            posColor: enginePos ? rw.posColor : (finalPos ? getPosColor(finalPos) : ""),
            form: rw.form || w.form || w.lemma || w.ru || w.word || "",
            lemma: rw.lemma || w.lemma || w.ru || w.word || "",
            chinese: w.chinese || w.zh || w.meaning || w.translation || rw.chinese || "",
            gender: rw.gender || w.gender || "",
            grammarCase: rw.grammarCase || w.grammarCase || "",
            number: rw.number || w.number || "",
            // 角色：Excel 权威标注 > 引擎 > 课程数据回退（引擎"待确认"时回退课程数据，如专有名词）
            roleLabel: xlKey ? xl : ((rw.roleLabel && rw.roleLabel !== "待确认") ? rw.roleLabel : (w.roleLabel || "")),
            syntacticRole: xlKey ? xlKey : ((rw.syntacticRole && rw.syntacticRole !== "default") ? rw.syntacticRole : (w.syntacticRole || "default")),
            person: rw.person || w.person || "",
            tense: rw.tense || w.tense || "",
            order: i,
          };
        });
    }
    return raw;
  }, [statement?.words, statement?.russian, dictReady]);

  // 词卡框释义直接显示：简版词典没有收录的词（如 преподаватель）懒加载 БКРС 词典（dict-zh.js）补中文，
  // 补全后整句词卡框直接展示释义，不依赖用户点击词卡；dict-zh 未就绪时先加载一次（7.9MB，一次性）
  // 注意：必须放在 words useMemo 之后（useEffect 依赖数组 [words] 渲染时求值，前置引用会 TDZ 报错）
  useEffect(() => {
    if (!words || !words.length) return;
    const missing = words.filter((w) => !(w.chinese || w.zh || w.meaning || w.translation) && (w.lemma || w.ru || w.word || w.form));
    if (!missing.length) return;
    let alive = true;
    ensureDictZh().then((ok) => {
      if (!ok || !alive) return;
      const patch = {};
      for (const w of missing) {
        const form = w.form || w.stress_marked || w.lemma || w.ru || w.word || '';
        const lemma = w.lemma || w.ru || w.word || form || '';
        const zh = zhOf(form, lemma);
        if (zh && String(zh).trim()) {
          const key = w.lemma || w.ru || w.word || form;
          patch[key] = String(zh).split(/[;；\n|]/)[0].trim();
        }
      }
      if (Object.keys(patch).length) setZhPatch((p) => ({ ...p, ...patch }));
    });
    return () => { alive = false };
  }, [words]);

  // 原句标点对齐：第 i 个词后是否跟标点（逗号/句号/感叹号…），词卡之间原样显示。
  // 破折号例外：不粘连前词（避免 "?—" 挤在词卡右侧），改为显示在下一个词卡左侧（"? — Я" 俄语排版）
  const punct = useMemo(() => {
    const map = {};
    const dashMap = {};
    const FULL2 = { "，": ",", "。": ".", "？": "?", "！": "!", "；": ";", "：": ":" };
    const toks = (String(statement?.russian || "").match(/[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)?|[.,!?;:…—–，。？！；：]/g) || [])
      .map((t) => FULL2[t] || t);
    let wi = 0;
    toks.forEach((t) => {
      if (/[.,!?;:…—–]/.test(t)) {
        if (t === "—" || t === "–") {
          dashMap[wi] = (dashMap[wi] || "") + t;
        } else if (wi > 0) {
          map[wi - 1] = (map[wi - 1] || "") + t;
        }
      } else { wi++; }
    });
    return { map, dashMap };
  }, [statement?.russian]);

  if (!statement) return null;

  const uiCfg = { ...UI_DEFAULT, ...(ui || {}) };

  return (
    <div style={{ ...styles.wrapper, ...BG_STYLE(uiCfg) }}>
      <style>{`
        @keyframes answer-fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .word-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          cursor: pointer;
        }
        .word-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        @media (max-width: 640px) {
          .word-card-bigword {
            font-size: 1.8rem !important;
          }
        }
      `}</style>

      <div style={{ ...styles.card, ...(isMobile ? { padding: "20px 8px 16px" } : {}), animation: "answer-fadeIn 0.4s ease" }}>
        {/* 单词卡片行 */}
        {words.length > 0 ? (
          <div style={{ ...styles.cardsRow, ...(isMobile ? { gap: 10, marginBottom: 20, padding: "0 4px" } : {}) }}>
            {(() => {
              // 相邻且句法角色相同（非 default/待确认）的词 → 合并为一个外框（词内部各自保留下划线/释义/语法，不再各自画边框）
              const posVisMap0 = uiCfg.posVis || {};
              const visWords = [];
              words.forEach((w, i) => { if (!(w.pos && posVisMap0[w.pos] === false)) visWords.push({ w, i }); });
              const merged = [];
              for (const item of visWords) {
                const last = merged[merged.length - 1];
                const lastW = last && last.items[last.items.length - 1].w;
                const canMerge = lastW && item.w.syntacticRole && lastW.syntacticRole
                  && item.w.syntacticRole !== "default" && item.w.syntacticRole !== "待确认"
                  && item.w.syntacticRole === lastW.syntacticRole;
                if (canMerge) last.items.push(item);
                else merged.push({ items: [item] });
              }
              return (
                <>
                  {merged.map((g, gi) => {
                    const first = g.items[0].w;
                    const gRole = first.syntacticRole;
                    const gRoleColor = getRoleColor(gRole);
                    const gBorder = (gRole && gRole !== "default" && ROLE_BORDER_COLORS[gRole]) ? ROLE_BORDER_COLORS[gRole] : null;
                    const isGroup = g.items.length > 1;
                    const gLabel = (gRole && gRole !== "default" && gRole !== "待确认") ? (getRoleLabel(gRole) || gRole) : "";
                    const lastIdx = g.items[g.items.length - 1].i;
                    return (
                      <Fragment key={gi}>
                        {/* 破折号：显示在词卡框外左侧（"? — Я" 两侧空格排版） */}
                        {punct.dashMap[g.items[0].i] && <span style={{ ...styles.stmtPunct, marginTop: 0, alignSelf: "center" }}>{punct.dashMap[g.items[0].i]}</span>}
                        <div className="word-cell" style={styles.wordCell}>
                        <div
                          className="word-card"
                          style={isGroup
                            ? { ...styles.wordCard, ...(isMobile ? { padding: "12px 4px 10px", minWidth: 70, minHeight: 90 } : {}), borderWidth: gBorder ? "1px" : "1px", borderColor: gBorder ? `${gBorder}59` : "var(--qs-border, #E5E7EB)", display: "flex", flexDirection: "row", alignItems: "stretch", gap: 0 }
                            : { ...styles.wordCard, ...(isMobile ? { padding: "12px 8px 10px", minWidth: 72, minHeight: 90 } : {}), borderWidth: gBorder ? "1px" : "1px", borderColor: gBorder ? `${gBorder}59` : "var(--qs-border, #E5E7EB)" }}
                        >
                          {gLabel && <span style={{ ...styles.roleTag, ...(isMobile ? { fontSize: 9, padding: "1px 6px", top: -8 } : {}), background: gBorder || "#9CA3AF" }}>{gLabel}</span>}
                          {g.items.map(({ w, i }, j) => {
                            // 颜色：下划线用词性色，边框/标签用句法角色色（两套颜色分离）
                            const customPosColor = posColorOf(uiCfg, w.pos);
                            const underlineColor = customPosColor || w.posColor || getPosColor(w.pos) || "";
                            const roleColor = getRoleColor(w.syntacticRole);
                            const effColor = underlineColor || roleColor || "#9CA3AF";
                            // 显示带重音符的词形：优先 form（带重音），其次 stress_marked / lemma
                            const toStress = (s) => String(s || "").replace(/'/g, "\u0301");
                            const displayWord = toStress(w.form || w.stress_marked || w.lemma || "");
                            const plainWord = displayWord.replace(/\u0301/g, ""); // 大字不带重音，重音只保留在灰色小字
                            const posLabel = getPosLabel(w.pos);
                            const grammarLabel = w.grammarLabel || buildGrammarLabel(w);
                            // 释义清洗：优先用课程上传的逐词中文；词典兜底时只留第一个义项核心中文，
                            // 去掉 разг./в знач./со словами 等俄语语法标注、多余义项、拉丁/西里尔字母
                            // 如果课程"中文"字段是整句释义（包含逗号/句号/较长文本）→ 忽略，走词典兜底
                            let rawChinese = w.chinese || w.zh || w.meaning || w.translation || zhPatch[w.lemma || w.ru || w.word || w.form] || "";
                            // 检测：整句释义特征（包含中文标点、长度 > 10 字符、或包含句子结构词）
                            const isFullSentence = /[，。；！？、]/.test(rawChinese) || rawChinese.length > 15;
                            if (isFullSentence) {
                              // 整句释义 → 忽略，用词典兜底
                              rawChinese = zhPatch[w.lemma || w.ru || w.word || w.form] || "";
                            }
                            const chinese = (() => {
                              let t = String(rawChinese || "").trim();
                              if (!t) return "";
                              // 去掉开头的俄语语体/语法标注（разг. / в знач. частицы / со словами... / книжн. / офиц. / шутл. 等）
                              t = t.replace(/^(разг|в знач[^\n;]*|со словами[^\n;]*|информ|книжн|офиц|шутл|пренебр|брань|выс|спец)[.;,\s]*/gi, "");
                              // 只取第一个分号/竖线/换行前的第一个义项
                              t = t.split(/[;；\n|]/)[0];
                              // 去掉残留拉丁字母和西里尔字母
                              t = t.replace(/[a-zA-Zа-яА-ЯёЁāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+/g, "");
                              t = t.replace(/\s+/g, " ").trim();
                              return t;
                            })();
                            const cellStyle = {
                              display: "flex", flexDirection: "column", alignItems: "center",
                              ...(isMobile ? { padding: "0 6px", minWidth: 64, minHeight: 88 } : { padding: "0 14px", minWidth: 100, minHeight: 120 }),
                              justifyContent: "flex-start",
                              cursor: "pointer",
                              borderRight: (isGroup && j < g.items.length - 1) ? ("1px dashed " + (gBorder ? `${gBorder}80` : "var(--qs-border, #E5E7EB)")) : "none",
                            };
                            return (
                              <Fragment key={i}>
                                <div
                                  style={cellStyle}
                                  onClick={() => {
                                    setDetailWord({ w, example: statement.russian })
                                    // 词卡释义补全：课程逐词数据与简版词典都没有释义时（如 преподаватель），
                                    // 懒加载 БКРС 词典（dict-zh.js）查中文并即时刷新词卡，避免词卡只显示成分/词性没有释义
                                    if (!(w.chinese || w.zh || w.meaning || w.translation)) {
                                      ensureDictZh().then((ok) => {
                                        if (!ok) return
                                        const form = w.form || w.stress_marked || w.lemma || w.ru || w.word || ''
                                        const lemma = w.lemma || w.ru || w.word || form || ''
                                        const zh = zhOf(form, lemma)
                                        if (zh && String(zh).trim()) {
                                          setDetailWord((prev) => (prev ? { ...prev, w: { ...prev.w, chinese: zh } } : prev))
                                        }
                                      })
                                    }
                                  }}
                                  title="点击查看单词并加入生词本"
                                >
                                  {/* 重音符（灰色小字，带重音） */}
                                  <div style={styles.phonetic}>{displayWord}</div>
                                  {/* 大字单词 */}
                                  <div className="word-card-bigword" style={{ ...styles.bigWord, ...(isMobile ? { fontSize: "1.5rem", marginBottom: 4 } : {}), color: "var(--qs-text, #1F2937)" }}>
                                    {plainWord}
                                  </div>
                                  {/* 彩色下划线（词性色） */}
                                  <div style={{ ...styles.underline, background: effColor }} />
                                  {/* 中文释义（直接用课程上传的中文） */}
                                  {uiCfg.showWordTrans !== false && chinese && <div style={styles.chinese}>{chinese}</div>}
                                </div>
                              </Fragment>
                            );
                          })}
                        </div>
                        {/* 末尾标点：显示在词卡框外右侧（word-cell 内不换行，垂直居中），不再被挤到词卡下方 */}
                        {punct.map[lastIdx] && <span style={{ ...styles.stmtPunct, marginTop: 0, alignSelf: "center" }}>{punct.map[lastIdx]}</span>}
                        </div>
                      </Fragment>
                    );
                  })}
                </>
              );
            })()}
          </div>
        ) : (
          <div style={styles.fallbackRow}>
            <span style={styles.fallbackWord}>{statement.russian}</span>
          </div>
        )}

        {/* 整句中文释义 + 复制图标 */}
        {statement.chinese && (
          <div style={{ ...styles.sentenceChinese, ...(isMobile ? { fontSize: "0.95rem", marginBottom: 16 } : {}) }}>
            <span>{statement.chinese}</span>
            <span
              style={styles.copyIcon}
              onClick={handleCopy}
              title="复制"
            >
              {copied ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              )}
            </span>
          </div>
        )}

        {/* 点词弹出单词卡 */}
        {detailWord && (
          <WordDetailCard
            word={{
              ...detailWord.w,
              plain: String(detailWord.w.form || detailWord.w.stress_marked || detailWord.w.lemma || "").replace(/\u0301/g, ""),
              posLabel: getPosLabel(detailWord.w.pos),
            }}
            example={detailWord.example}
            onSpeak={(t) => speakRussian(t, detailWord.w.audio_url, detailWord.w.id, "word")}
            onClose={() => setDetailWord(null)}
          />
        )}

        {/* 底部快捷键提示栏 */}
        <ShortcutTips
          mode="answer"
          onNext={onNext}
          onRetry={onRetry}
          enterText="下一题"
          showAnswerText="再来一次"
        />

      </div>
    </div>
  );
}

// ==========================================================
// 样式
// ==========================================================
const styles = {
  wrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 24px 100px",
    background: "var(--qs-surface, #FFFFFF)",
    backgroundImage: "none",
    minHeight: "calc(100vh - 80px)",
  },
  card: {
    width: "100%",
    maxWidth: 1120,
    background: "transparent",
    borderRadius: 0,
    padding: "40px 24px 32px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  cardsRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 40,
  },
  // 词卡 + 其后标点组成的"不可换行单元"：标点始终在词卡框外右侧，不被挤到下一行
  wordCell: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  wordCard: {
    position: "relative",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px 16px 14px",
    minWidth: 100,
    minHeight: 120, // 统一卡片高度：单词+释义两行，短卡片
    justifyContent: "flex-start",
    border: "1px solid var(--qs-border, #E5E7EB)",
    borderRadius: 20,
    background: "var(--qs-surface2, #fff)",
  },
  roleTag: {
    position: "absolute",
    top: -10,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "2px 10px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    color: "#111827", // 亮色背景上深色文字保证对比度（深夜/白天都清晰）
    whiteSpace: "nowrap",
    letterSpacing: 0.5,
  },
  phonetic: {
    fontSize: 13,
    color: "var(--qs-sub, #9CA3AF)",
    marginBottom: 4,
    marginTop: 4,
    fontFamily: '"PT Serif", Georgia, serif',
    minHeight: 18,
  },
  bigWord: {
    fontFamily: '"PT Serif", "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: "2.5rem",
    fontWeight: 700,
    color: "#1F2937",
    lineHeight: 1.2,
    marginBottom: 6,
  },
  stmtPunct: {
    fontSize: "2rem",
    fontWeight: 700,
    color: "var(--qs-text, #1F2937)",
    marginTop: 34,
    alignSelf: "flex-start",
    lineHeight: 1.2,
  },
  underline: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
    minWidth: 50,
  },
  chinese: {
    fontSize: 14,
    color: "var(--qs-text, #4B5563)",
    fontWeight: 500,
    marginBottom: 2,
  },
  pos: {
    fontSize: 12,
    color: "var(--qs-sub, #9CA3AF)",
  },
  fallbackRow: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 24,
  },
  fallbackWord: {
    fontFamily: '"Nunito", sans-serif',
    fontSize: "2.5rem",
    fontWeight: 700,
    color: "var(--qs-text, #1F2937)",
  },
  sentenceChinese: {
    fontSize: "1.75rem",
    color: "var(--qs-text, #374151)",
    fontWeight: 600,
    marginBottom: 48,
    lineHeight: 1.4,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  copyIcon: {
    cursor: "pointer",
    color: "var(--qs-sub, #9CA3AF)",
    display: "inline-flex",
    alignItems: "center",
    transition: "color 0.15s",
  },
};
