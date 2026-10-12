/**
 * WordDetailCard.jsx —— 答题页点击单词弹出的单词卡（生词/陌生关卡收录入口）
 * 设计：跟随全局主题（白天/深夜自动切换），质感来自排版层次、渐变点缀、柔和阴影与微动效
 */
import { useState } from 'react'
import { markWordUnknown, isInUnknown } from '../../lib/wordStats'
import { toast } from '../../lib/toast'

export default function WordDetailCard({ word = {}, example = '', course = '', lesson = '', onSpeak, onClose }) {
  const [added, setAdded] = useState(() => isInUnknown(word.plain || word.form || word.lemma || ''))
  const display = word.plain || word.form || word.lemma || word.word || ''
  const chinese = word.chinese || word.zh || word.meaning || word.translation || ''

  const addToBook = () => {
    markWordUnknown({
      word: display,
      pos: word.posLabel || word.pos || '',
      chinese,
      reading: word.reading || '',
    })
    setAdded(true)
    toast('已加入生词本（陌生关卡）')
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm"
      style={{ animation: 'wd-fadeIn .18s ease' }}
      onClick={onClose}
    >
      <style>{`
        @keyframes wd-fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes wd-popIn { from { opacity: 0; transform: translateY(14px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        className="w-[440px] max-w-[94vw] overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-[0_24px_70px_rgba(15,23,42,.16)] transition-shadow dark:border-white/10 dark:bg-[#151519] dark:shadow-[0_24px_70px_rgba(0,0,0,.55)]"
        style={{ animation: 'wd-popIn .22s cubic-bezier(.2,.9,.3,1.2)' }}
      >
        {/* 顶部渐变光带 */}
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400" />
        <div className="relative px-7 pb-6 pt-7">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-base leading-none text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-300"
          >×</button>

          {/* 单词 */}
          <div className="font-['PT_Serif',Georgia,serif] text-[42px] font-bold leading-tight tracking-tight text-gray-900 dark:text-white">
            {display}
          </div>
          {(word.reading || word.form) && (
            <div className="mt-1.5 text-[15px] italic text-gray-400 dark:text-gray-500">{word.reading || word.form}</div>
          )}

          {/* 词性 / 语法标签 */}
          {(word.posLabel || word.grammarLabel) && (
            <div className="mt-3.5 flex flex-wrap gap-2">
              {word.posLabel && (
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-600 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300">
                  {word.posLabel}
                </span>
              )}
              {word.grammarLabel && (
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                  {word.grammarLabel}
                </span>
              )}
              {word.syntacticRole && word.syntacticRole !== 'default' && (
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                  {word.syntacticRole}
                </span>
              )}
            </div>
          )}

          {/* 释义 */}
          <div className="mt-4 text-lg font-semibold leading-relaxed text-gray-800 dark:text-gray-100">
            {chinese || '暂无释义'}
          </div>

          {/* 例句 */}
          {example && (
            <div className="mt-3.5 rounded-xl border border-violet-100 bg-violet-50/50 p-3 dark:border-violet-500/20 dark:bg-violet-500/10">
              <div className="mb-1 text-xs text-gray-400 dark:text-gray-500">例句</div>
              <div className="font-['PT_Serif',Georgia,serif] text-[15px] text-gray-800 dark:text-gray-100">{example}</div>
            </div>
          )}

          {/* 操作 */}
          <div className="mt-5 flex gap-2.5">
            <button
              onClick={() => onSpeak?.(display)}
              className="flex-1 cursor-pointer rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:-translate-y-px hover:border-gray-300 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
            >🔊 播放发音</button>
            <button
              onClick={addToBook}
              disabled={added}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
                added
                  ? 'cursor-default bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : 'cursor-pointer bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/25 hover:-translate-y-px hover:shadow-violet-600/35'
              }`}
            >{added ? '✓ 已在生词本' : '加入陌生关卡'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
