/**
 * WordDetailCard.jsx —— 答题页点击单词弹出的单词卡（生词本收录入口）
 * 设计：简约大气有质感 —— 无渐变装饰，细边框 + 柔和阴影 + 克制的单一强调色，跟随全局主题
 */
import { useState } from 'react'
import { addVocabWord, isInVocab } from '../../lib/vocabBook'
import { toast } from '../../lib/toast'

export default function WordDetailCard({ word = {}, example = '', course = '', lesson = '', onSpeak, onClose }) {
  const [added, setAdded] = useState(() => isInVocab(word.plain || word.form || word.lemma || ''))
  const display = word.plain || word.form || word.lemma || word.word || ''
  const chinese = word.chinese || word.zh || word.meaning || word.translation || ''

  const addToBook = () => {
    addVocabWord({
      word: display,
      pos: word.posLabel || word.pos || '',
      chinese,
      reading: word.reading || '',
      example,
      course,
      lesson,
    })
    setAdded(true)
    toast('已加入生词本')
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm"
      style={{ animation: 'wd-fadeIn .18s ease' }}
      onClick={onClose}
    >
      <style>{`
        @keyframes wd-fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes wd-popIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        className="w-[440px] max-w-[94vw] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,.14)] dark:border-white/10 dark:bg-[#151519] dark:shadow-[0_16px_50px_rgba(0,0,0,.5)]"
        style={{ animation: 'wd-popIn .22s ease' }}
      >
        <div className="px-7 pb-6 pt-7">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-base leading-none text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-300"
          >×</button>

          {/* 单词 */}
          <div className="font-['PT_Serif',Georgia,serif] text-[40px] font-bold leading-tight tracking-tight text-gray-900 dark:text-white">
            {display}
          </div>
          {(word.reading || word.form) && (
            <div className="mt-1.5 text-[15px] italic text-gray-400 dark:text-gray-500">{word.reading || word.form}</div>
          )}

          {/* 词性 / 语法标签 */}
          {(word.posLabel || word.grammarLabel) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {word.posLabel && (
                <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">{word.posLabel}</span>
              )}
              {word.grammarLabel && (
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">{word.grammarLabel}</span>
              )}
              {word.syntacticRole && word.syntacticRole !== 'default' && (
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">{word.syntacticRole}</span>
              )}
            </div>
          )}

          {/* 释义 */}
          <div className="mt-4 text-lg font-medium leading-relaxed text-gray-800 dark:text-gray-100">
            {chinese || '暂无释义'}
          </div>

          {/* 例句 */}
          {example && (
            <div className="mt-4 border-l-2 border-gray-200 pl-3 dark:border-white/15">
              <div className="mb-0.5 text-xs text-gray-400 dark:text-gray-500">例句</div>
              <div className="font-['PT_Serif',Georgia,serif] text-[15px] text-gray-700 dark:text-gray-200">{example}</div>
            </div>
          )}

          {/* 操作 */}
          <div className="mt-6 flex gap-2.5">
            <button
              onClick={() => onSpeak?.(display)}
              className="flex-1 cursor-pointer rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
            >🔊 播放发音</button>
            <button
              onClick={addToBook}
              disabled={added}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                added
                  ? 'cursor-default bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : 'cursor-pointer bg-violet-600 text-white hover:bg-violet-700'
              }`}
            >{added ? '✓ 已在生词本' : '添加到生词本'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
