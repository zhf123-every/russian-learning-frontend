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
import { annotateWords } from "../../lib/wordAnnotate";
import { inferRoles } from "../../lib/roleRules";
import { UI_DEFAULT, posColorOf, posStyleOf, BG_STYLE } from "../../hooks/useQuestSettings";

import { playGlobalAudio, stopGlobalAudio } from "../../utils/audioService";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
// 内存缓存：text -> audio_url，避免重复请求
const ttsCache = new Map();

// 句法角色 → 颜色映射（对齐句乐部实测：边框/标签用角色色，主语橙/谓语红/宾语蓝）
// 虚词角色（否定/前置词/连接词/语气词/感叹词/数词）补专属色，与词性色区分，避免边框=下划线同色
const ROLE_COLORS = {
  subject: "#B45309",
  predicate: "#BE123C",
  object: "#2563EB",
  adverbial: "#F59E0B",
  attribute: "#C026D3",    // 定语 - 品红紫（区别于形容词词性紫 #A855F7，避免边框=下划线）
  predicative: "#14B8A6",
  complement: "#BE185D",   // 补语 - 玫红（区别于连词词性粉 #EC4899，避免边框=下划线）
  negation: "#374151",      // 否定 - 深石板灰（与 default 浅灰区分）
  preposition: "#0EA5E9",   // 前置词 - 天蓝（区别于介词词性深靛蓝/宾语蓝）
  conjunction: "#D97706",   // 连接词 - 暗金黄（区别于连词词性粉/副词黄）
  particle: "#7C3AED",      // 语气词 - 深紫罗兰（区别于助词词性青）
  interjection: "#DB2777",  // 感叹词 - 洋红（区别于感叹词词性橙）
  numeral: "#16A34A",       // 数词 - 深绿（区别于数词词性紫/动词绿）
  default: "#9CA3AF",
};

// 句法角色 → 中文标签（兼容各种写法）
const ROLE_LABELS_MAP = {
  subject: "主语",
  predicate: "谓语",
  object: "宾语",
  attribute: "定语",
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

  // ---- 俄语发音（Yandex 真人发音）----
  const audioRef = useRef(null);

  const speakRussian = useCallback(async (text, audioUrl = null, itemId = null, itemType = null) => {
    if (!text) return;
    try {
      // 停止当前播放
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      let url = audioUrl;

      // 没有缓存的 audio_url，调用后端 TTS 合成
      if (!url) {
        // 先查内存缓存
        if (ttsCache.has(text)) {
          url = ttsCache.get(text);
        } else {
          const res = await fetch(`${API_BASE}/api/tts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voice: "alena", id: itemId, type: itemType }),
          });
          const data = await res.json();
          if (data.ok && data.audio_url) {
            url = data.audio_url.startsWith("http") ? data.audio_url : `${API_BASE}${data.audio_url}`;
            ttsCache.set(text, url);
          }
        }
      } else if (!url.startsWith("http")) {
        url = `${API_BASE}${url}`;
      }

      if (url) {
        // 全局唯一音频控制器：暂停旧 → 复位 → 赋新 src → play（杜绝与答题页发音重叠）
        playGlobalAudio(url, { rate: ui?.rate || 1 });
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

  // 本地即时标注：词典（重音/词性/性数格）+ 形态规则引擎（句子成分）整句同步推断
  // 覆盖课程数据里残留的无效标签（default 等），答对瞬间成分/重音即完整，无闪烁无延迟
  const words = useMemo(() => {
    const raw = statement?.words || [];
    const needRules = raw.some((w) => !w.pos || w.pos === "default" || !w.roleLabel || w.roleLabel === "default" || !w.syntacticRole || w.syntacticRole === "default");
    if (needRules && statement?.russian) {
      const dictWords = annotateWords(statement.russian);
      if (dictWords.length) {
        const roleWords = inferRoles(statement.russian, dictWords);
        return raw.map((w, i) => {
          const rw = roleWords[i] || {};
          // 词典未命中词再逐词兜底
          const single = !rw.pos ? (annotateWords(w.lemma || w.word || w.ru || w.text || "")[0] || {}) : {};
          return {
            ...w, ...rw, ...single,
            order: i,
            roleLabel: rw.roleLabel || "",
            syntacticRole: rw.syntacticRole || "default",
          };
        });
      }
    }
    return raw.map((w) => {
      if (w.form && w.pos) return w; // 已有完整标注直接复用
      const single = annotateWords(w.lemma || w.word || w.ru || w.text || "")[0] || {};
      if (!single.form && !single.pos) return w;
      return {
        ...w,
        form: w.form || single.form,
        lemma: w.lemma || single.lemma || "",
        pos: w.pos || single.pos || "",
        posColor: w.posColor || single.posColor || "",
        gender: w.gender || single.gender || "",
        grammarCase: w.grammarCase || single.grammarCase || "",
        number: w.number || single.number || "",
        chinese: w.chinese || single.chinese || "",
      };
    });
  }, [statement?.words, statement?.russian]);

  // 原句标点对齐：第 i 个词后是否跟标点（逗号/句号/感叹号…），词卡之间原样显示
  const punctMap = useMemo(() => {
    const map = {};
    const toks = String(statement?.russian || "").match(/[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)?|[.,!?;:…—–]/g) || [];
    let wi = 0;
    toks.forEach((t) => {
      if (/[.,!?;:…—–]/.test(t)) {
        if (wi > 0) map[wi - 1] = (map[wi - 1] || "") + t;
      } else { wi++; }
    });
    return map;
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

      <div style={{ ...styles.card, animation: "answer-fadeIn 0.4s ease" }}>
        {/* 单词卡片行 */}
        {words.length > 0 ? (
          <div style={styles.cardsRow}>
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
                    const gBorder = (gRole && gRole !== "default" && ROLE_COLORS[gRole]) ? gRoleColor : null;
                    const isGroup = g.items.length > 1;
                    const gLabel = (gRole && gRole !== "default" && gRole !== "待确认") ? (getRoleLabel(gRole) || gRole) : "";
                    const lastIdx = g.items[g.items.length - 1].i;
                    return (
                      <Fragment key={gi}>
                        <div className="word-cell" style={styles.wordCell}>
                        <div
                          className="word-card"
                          style={isGroup
                            ? { ...styles.wordCard, borderColor: gBorder ? `${gBorder}60` : "var(--qs-border, #E5E7EB)", padding: "20px 6px 14px", display: "flex", flexDirection: "row", alignItems: "stretch", gap: 0 }
                            : { ...styles.wordCard, borderColor: gBorder ? `${gBorder}60` : "var(--qs-border, #E5E7EB)" }}
                        >
                          {gLabel && <span style={{ ...styles.roleTag, background: gBorder || "#9CA3AF" }}>{gLabel}</span>}
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
                            const chinese = w.chinese || w.zh || w.meaning || w.translation || "";
                            const cellStyle = {
                              display: "flex", flexDirection: "column", alignItems: "center",
                              padding: "0 14px", minWidth: 100, minHeight: 190, justifyContent: "flex-start",
                              cursor: "pointer",
                              borderRight: (isGroup && j < g.items.length - 1) ? ("1px dashed " + (gBorder ? `${gBorder}40` : "var(--qs-border, #E5E7EB)")) : "none",
                            };
                            return (
                              <Fragment key={i}>
                                <div
                                  style={cellStyle}
                                  onClick={() => speakRussian(displayWord, w.audio_url, w.id, "word")}
                                  title="点击发音"
                                >
                                  {/* 重音符（灰色小字） */}
                                  <div style={styles.phonetic}>{displayWord}</div>
                                  {/* 大字单词（不带重音） */}
                                  <div className="word-card-bigword" style={{ ...styles.bigWord, color: "var(--qs-text, #1F2937)" }}>
                                    {plainWord}
                                  </div>
                                  {/* 彩色下划线（词性色） */}
                                  <div style={{ ...styles.underline, background: effColor }} />
                                  {/* 中文释义 */}
                                  {uiCfg.showWordTrans !== false && chinese && <div style={styles.chinese}>{chinese}</div>}
                                  {/* 语法标注（性数格） */}
                                  {grammarLabel && <div style={{ ...styles.pos, fontSize: "10px", color: "var(--qs-sub, #9CA3AF)", marginTop: "2px" }}>{grammarLabel}</div>}
                                  {/* 词性（词性色） */}
                                  {uiCfg.showPos !== false && posLabel && <div style={{ ...styles.pos, color: effColor }}>{posLabel}</div>}
                                </div>
                              </Fragment>
                            );
                          })}
                        </div>
                        {/* 末尾标点：显示在词卡框外右侧（word-cell 内不换行，垂直居中），不再被挤到词卡下方 */}
                        {punctMap[lastIdx] && <span style={{ ...styles.stmtPunct, marginTop: 0, alignSelf: "center" }}>{punctMap[lastIdx]}</span>}
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
          <div style={styles.sentenceChinese}>
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
    minHeight: 190, // 统一卡片高度：有无角色标签/词性/性数格的词卡等高
    justifyContent: "flex-start",
    border: "1px solid var(--qs-border, #E5E7EB)",
    borderRadius: 12,
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
    color: "#fff",
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
