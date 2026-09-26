/**
 * useQuestSettings.js —— 答题页设置打通（与 SettingsModal 同 key 实时同步）
 *
 * 数据源（与设置弹窗完全一致）：
 *  - rlearn_quest_ui     → 界面/答题/听力/口语/外观 配置（UI_DEFAULT）
 *  - rlearn_quest_sfx    → 声音/游戏特效 配置（SFX_DEFAULT）
 *  - LS.settings(zustand)→ 发音源/倍速/音量 等（settingsStore）
 *
 * 页面用法：
 *   const { ui, sfx, settings, refreshSettings } = useQuestSettings()
 *   主容器背景：style={{ ...BG_STYLE(ui), ... }}
 *   设置弹窗关闭时：onClose={() => { setShowSettings(false); refreshSettings(); }}
 */
import { useState, useEffect, useCallback } from 'react'
import { useSettingsStore } from '../store/settingsStore'

export const UI_DEFAULT = {
  font: 'system', qSize: '中', sSize: '中', theme: 'light', inputStyle: 'dynamic', answerMode: 'float',
  posMark: true, autoSpeak: true, speakTimes: 2, speakSpeed: 1, speakGap: 1, answerSpeak: true,
  autoNext: false, ignoreCase: true, showImage: true, imgPos: 'center', imgSize: 'mid',
  autoReveal: '3', wrongRec: '3', learnDefault: '初级',
  showProgress: true, showStruct: true, structStyle: 'outline', showWordTrans: true, skipNames: true,
  showPos: true, posStyle: 'color_text',
  posColors: {
    '名词': '#3b82f6', '动词': '#22c55e', '形容词': '#8b5cf6', '副词': '#eab308',
    '代词': '#ef4444', '介词': '#1e40af', '并列连词': '#f43f5e', '从属连词': '#f43f5e',
    '感叹词': '#f97316', '限定词': '#14b8a6', '助动词': '#22c55e', '专有名词': '#3b82f6',
    '人名': '#3b82f6', '数词': '#8b5cf6', '助词': '#9ca3af',
  },
  posVis: {
    '名词': true, '动词': true, '形容词': true, '副词': true, '代词': true, '介词': true,
    '并列连词': true, '从属连词': true, '感叹词': true, '限定词': true, '助动词': true,
    '专有名词': true, '人名': true, '数词': true, '助词': true,
  },
  listenBlind: true, listenBlindTimes: 2, listenBlindSpeed: 1,
  listenSlow: true, listenSlowTimes: 2, listenSlowSpeed: 0.7,
  listenAns: true, listenAnsTimes: 1, listenAnsSpeed: 1,
  listenShowEn: true, listenShowZh: true, listenShowIpa: true,
  stageBtns: true, autoNextS: false, loopPlay: false, autoNextL: false, phaseGap: 2,
  speakMode: 'en', speakAutoPlay: true,
  videoPos: 'center', videoCover: false,
  showScore: true, petShow: true, petHelp: true, petHint: '3',
  themeMode: 'auto', bgColor: 'default', bgImage: null,
}

export const SFX_DEFAULT = {
  enabled: true, vol: 0.7, keyOn: true, keyType: 'soft', keyVol: 1,
  answerOn: true, answerVol: 1, combo: true, comboAnim: true, comboFx: true, sceneOn: true,
}

export const loadUi = () => {
  try {
    const raw = JSON.parse(localStorage.getItem('rlearn_quest_ui') || '{}') || {}
    return { ...UI_DEFAULT, ...raw }
  } catch { return { ...UI_DEFAULT } }
}
export const saveUi = (patch) => {
  const n = { ...loadUi(), ...patch }
  try { localStorage.setItem('rlearn_quest_ui', JSON.stringify(n)) } catch (e) { /* 忽略 */ }
  return n
}
export const loadSfx = () => {
  try { return { ...SFX_DEFAULT, ...(JSON.parse(localStorage.getItem('rlearn_quest_sfx') || '{}') || {}) } }
  catch { return { ...SFX_DEFAULT } }
}
export const saveSfx = (patch) => {
  const n = { ...loadSfx(), ...patch }
  try { localStorage.setItem('rlearn_quest_sfx', JSON.stringify(n)) } catch (e) { /* 忽略 */ }
  return n
}

// 全页主题（顶栏/内容区/底部/词卡统一同步背景 + 深夜模式）
export const THEME_OF = (ui) => {
  const themeMode = ui?.themeMode || 'auto'
  const dark =
    themeMode === 'dark' ||
    (themeMode === 'auto' &&
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-color-scheme: dark)')?.matches)
  const bgColor = ui?.bgColor || 'default'
  if (dark) {
    return {
      dark: true,
      bg: '#0f172a',
      surface: '#111827',
      surface2: '#1f2937',
      text: '#f1f5f9',
      sub: '#a8b2c1',
      border: '#64748b',
      active: '#E2E8F0',
      vars: {
        '--qs-bg': '#0f172a', '--qs-surface': '#111827', '--qs-surface2': '#1f2937',
        '--qs-text': '#f1f5f9', '--qs-sub': '#a8b2c1', '--qs-border': '#64748b', '--qs-active': '#E2E8F0',
      },
    }
  }
  const bg = bgColor === 'warm' ? '#faf3e7' : bgColor === 'green' ? '#eaf4ea' : '#ffffff'
  const surface2 = bgColor === 'warm' ? '#f3ecd9' : bgColor === 'green' ? '#dfeee2' : '#f9fafb'
  const border = bgColor === 'warm' ? '#e7ddc8' : bgColor === 'green' ? '#cfe0d3' : '#e5e7eb'
  return {
    dark: false,
    bg, surface: bg, surface2, text: '#111827', sub: '#6b7280', border, active: '#5B21B6',
    vars: {
      '--qs-bg': bg, '--qs-surface': bg, '--qs-surface2': surface2,
      '--qs-text': '#111827', '--qs-sub': '#6b7280', '--qs-border': border, '--qs-active': '#5B21B6',
    },
  }
}

// 主容器背景（外观面板：背景色/背景图 + 深夜模式）
export const BG_STYLE = (ui) => {
  if (ui?.bgImage) {
    return {
      background: `url(${ui.bgImage}) center / cover no-repeat fixed`,
      backgroundColor: THEME_OF(ui).bg,
    }
  }
  return { background: THEME_OF(ui).bg }
}

// 词性下划线色（学习面板：posColors/posVis/posStyle）
export const posColorOf = (ui, pos) => {
  if (!ui) return ''
  const vis = ui.posVis || UI_DEFAULT.posVis
  if (pos && vis[pos] === false) return ''
  return (ui.posColors || UI_DEFAULT.posColors)[pos] || ''
}
// 词性显示方式：color_text=颜色+文字 / color=仅颜色 / text=仅文字
export const posStyleOf = (ui) => (ui && ui.posStyle) || 'color_text'

export function useQuestSettings() {
  const [ui, setUi] = useState(() => loadUi())
  const [sfx, setSfx] = useState(() => loadSfx())
  const settings = useSettingsStore((s) => s.settings)

  // 跨标签页/其他页保存 rlearn_quest_ui 后即时刷新
  useEffect(() => {
    const h = () => { setUi(loadUi()); setSfx(loadSfx()) }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  const refreshSettings = useCallback(() => { setUi(loadUi()); setSfx(loadSfx()) }, [])
  return { ui, sfx, settings, refreshSettings }
}
