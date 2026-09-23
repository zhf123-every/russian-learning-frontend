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

import { useEffect, useCallback, useState, useRef } from "react";
import { getPosLabel, buildGrammarLabel } from "../../constants/posColors";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
// 内存缓存：text -> audio_url，避免重复请求
const ttsCache = new Map();

// 句法角色 → 颜色映射
const ROLE_COLORS = {
  subject: "#EF4444",
  predicate: "#22C55E",
  object: "#3B82F6",
  adverbial: "#F59E0B",
  attribute: "#A855F7",
  predicative: "#14B8A6",
  complement: "#EC4899",
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
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play().catch((e) => console.warn("播放失败:", e));
      }
    } catch (e) {
      console.warn("发音失败:", e);
    }
  }, []);

  // 进入页面自动播放整句发音（Yandex 真人发音）
  useEffect(() => {
    if (statement?.russian) {
      const timer = setTimeout(() => {
        speakRussian(statement.russian, statement.audio_url, statement.id, "statement");
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [statement?.russian, statement?.audio_url, statement?.id, speakRussian]);

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

  if (!statement) return null;

  const words = statement.words || [];

  return (
    <div style={styles.wrapper}>
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
            {words.map((w, i) => {
              // 颜色：优先数据给定的词性色（新 build-steps），否则按句法角色（旧数据/听写页）
              const color = w.posColor || getRoleColor(w.syntacticRole);
              const roleLabel = w.roleLabel || getRoleLabel(w.syntacticRole);
              // 显示带重音符的词形：优先 form（带重音），其次 stress_marked / lemma
              const displayWord = w.form || w.stress_marked || w.lemma || "";
              const posLabel = getPosLabel(w.pos);
              // 语法标注：优先数据预组装的中文（新 build-steps），否则按英文枚举构建（旧数据）
              const grammarLabel = w.grammarLabel || buildGrammarLabel(w);
              const chinese = w.chinese || w.meaning || w.translation || "";

              return (
                <div
                  key={i}
                  className="word-card"
                  style={{
                    ...styles.wordCard,
                    borderColor: `${color}60`,
                  }}
                  onClick={() => speakRussian(displayWord, w.audio_url, w.id, "word")}
                  title="点击发音"
                >
                  {/* 顶部：句法角色标签 */}
                  {roleLabel && (
                    <span style={{ ...styles.roleTag, background: color }}>
                      {roleLabel}
                    </span>
                  )}

                  {/* 重音符（灰色小字） */}
                  <div style={styles.phonetic}>{displayWord}</div>

                  {/* 大字单词 */}
                  <div className="word-card-bigword" style={styles.bigWord}>
                    {displayWord}
                  </div>

                  {/* 彩色下划线 */}
                  <div style={{ ...styles.underline, background: color }} />

                  {/* 中文释义 */}
                  {chinese && <div style={styles.chinese}>{chinese}</div>}

                  {/* 语法标注（性数格） */}
                  {grammarLabel && <div style={{ ...styles.pos, fontSize: "10px", color: "#9CA3AF", marginTop: "2px" }}>{grammarLabel}</div>}

                  {/* 词性 */}
                  {posLabel && <div style={styles.pos}>{posLabel}</div>}
                </div>
              );
            })}
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
    background: "#FFFFFF",
    backgroundImage: "none",
    minHeight: "calc(100vh - 80px)",
  },
  card: {
    width: "100%",
    maxWidth: 960,
    background: "#fff",
    borderRadius: 16,
    padding: "48px 24px 32px",
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
  wordCard: {
    position: "relative",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px 16px 14px",
    minWidth: 100,
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    background: "#fff",
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
    color: "#9CA3AF",
    marginBottom: 4,
    marginTop: 4,
    fontFamily: '"PT Serif", Georgia, serif',
    minHeight: 18,
  },
  bigWord: {
    fontFamily: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: "2.5rem",
    fontWeight: 700,
    color: "#1F2937",
    lineHeight: 1.2,
    marginBottom: 6,
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
    color: "#4B5563",
    fontWeight: 500,
    marginBottom: 2,
  },
  pos: {
    fontSize: 12,
    color: "#9CA3AF",
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
    color: "#1F2937",
  },
  sentenceChinese: {
    fontSize: "1.75rem",
    color: "#374151",
    fontWeight: 600,
    marginBottom: 48,
    lineHeight: 1.4,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  copyIcon: {
    cursor: "pointer",
    color: "#9CA3AF",
    display: "inline-flex",
    alignItems: "center",
    transition: "color 0.15s",
  },
};
