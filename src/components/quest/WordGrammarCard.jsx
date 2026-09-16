/**
 * WordGrammarCard.jsx —— 单词语法拆解卡片
 *
 * 展示每个单词的：
 *  - 单词原形（带重音，颜色 = 词性颜色）
 *  - 词性（灰色小字）
 *  - 语法标注（灰色小字，如"现在时·1人称"）
 *  - 句法角色（灰色极小字，底部，如"谓语"）
 *  - 彩色下划线（词性颜色）
 *
 * 点击单词可发音
 */

import { getPosColor, getPosLabel, buildGrammarLabel, ROLE_LABELS } from "../../constants/posColors";

export default function WordGrammarCard({
  word = {},       // 单词对象：{ form, lemma, pos, grammaticalCase, number, gender, person, tense, aspect, syntacticRole }
  onPlaySound,     // 点击发音回调
}) {
  const color = getPosColor(word.pos);
  const posLabel = getPosLabel(word.pos);
  const grammarLabel = buildGrammarLabel(word);
  const roleLabel = word.syntacticRole ? (ROLE_LABELS[word.syntacticRole] || word.syntacticRole) : "";

  // 显示的单词：优先用 form（带重音），其次 lemma
  const displayWord = word.form || word.lemma || "";

  return (
    <div
      className="word-grammar-card"
      onClick={() => onPlaySound?.(displayWord || word.form)}
      title={`${posLabel}${grammarLabel ? " · " + grammarLabel : ""}${roleLabel ? " · " + roleLabel : ""}（点击发音）`}
    >
      <style>{`
        .word-grammar-card {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          padding: 10px 12px 8px;
          min-width: 72px;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
          border-radius: 8px;
        }
        .word-grammar-card:hover {
          transform: translateY(-2px);
          background: #F9FAFB;
        }
        .wgc-word {
          font-family: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 1.25rem;
          font-weight: 700;
          line-height: 1.3;
          margin-bottom: 2px;
          transition: opacity 0.15s ease;
        }
        .word-grammar-card:hover .wgc-word {
          opacity: 0.8;
        }
        .wgc-underline {
          width: 100%;
          height: 3px;
          border-radius: 2px;
          margin-bottom: 6px;
          min-width: 40px;
        }
        .wgc-pos {
          font-size: 11px;
          color: #6B7280;
          font-weight: 500;
          margin-bottom: 2px;
        }
        .wgc-grammar {
          font-size: 10px;
          color: #9CA3AF;
          line-height: 1.4;
          text-align: center;
          margin-bottom: 4px;
          min-height: 14px;
        }
        .wgc-role {
          font-size: 9px;
          color: #D1D5DB;
          font-weight: 500;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        @media (max-width: 640px) {
          .word-grammar-card {
            min-width: 60px;
            padding: 8px 8px 6px;
          }
          .wgc-word {
            font-size: 1.1rem;
          }
        }
      `}</style>

      {/* 单词（词性颜色） */}
      <span className="wgc-word" style={{ color }}>
        {displayWord}
      </span>

      {/* 彩色下划线（词性颜色） */}
      <span className="wgc-underline" style={{ background: color }} />

      {/* 词性 */}
      <span className="wgc-pos">{posLabel}</span>

      {/* 语法标注 */}
      <span className="wgc-grammar">{grammarLabel}</span>

      {/* 句法角色（底部极小字） */}
      {roleLabel && <span className="wgc-role">{roleLabel}</span>}
    </div>
  );
}
