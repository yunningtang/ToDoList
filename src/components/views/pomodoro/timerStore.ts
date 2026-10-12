import { create } from 'zustand'
import { useStore } from '../../../store/useStore'
import { setNoise, stopNoise } from '../../../services/noise'
import { beep, clockText, notify } from './helpers'

export type TimerMode = 'pomo' | 'stopwatch'
export type TimerPhase = 'focus' | 'shortBreak' | 'longBreak'
export type TimerStatus = 'idle' | 'running' | 'paused'

export interface TimerState {
  mode: TimerMode
  phase: TimerPhase
  status: TimerStatus
  /** 本段计时（专注或休息）第一次开始的时间戳 */
  sessionStart: number | null
  /** 暂停前已累计的毫秒数 */
  accumulated: number
  /** 最近一次开始/继续的时间戳；暂停时为 null */
  resumedAt: number | null
  /** 倒计时目标毫秒数；正计时为 0 */
  durationMs: number
  /** 本轮已完成的番茄数（用于判断长休息） */
  cyclePomos: number
  taskId: string | null
  title: string
  /** 每次 tick 更新，用于驱动渲染 */
  now: number

  setMode: (m: TimerMode) => boolean
  setTask: (taskId: string | null, title: string) => void
  start: () => void
  pause: () => void
  resume: () => void
  /** 提前结束当前专注；keep 为 true 时保存记录 */
  stop: (keep: boolean) => void
  skipBreak: () => void
}

export function elapsedOf(s: Pick<TimerState, 'accumulated' | 'resumedAt'>, now: number): number {
  return s.accumulated + (s.resumedAt ? Math.max(0, now - s.resumedAt) : 0)
}

function pomoSettings() {
  return useStore.getState().settings.pomodoro
}

const IDLE = { status: 'idle' as const, sessionStart: null, accumulated: 0, resumedAt: null }

export const useTimerStore = create<TimerState>()((set, get) => ({
  mode: 'pomo',
  phase: 'focus',
  status: 'idle',
  sessionStart: null,
  accumulated: 0,
  resumedAt: null,
  durationMs: 0,
  cyclePomos: 0,
  taskId: null,
  title: '专注',
  now: Date.now(),

  setMode: (mode) => {
    if (get().status !== 'idle') return false
    set({ mode, phase: 'focus', durationMs: 0, ...IDLE })
    return true
  },
  setTask: (taskId, title) => set({ taskId, title: title.trim() || '专注' }),
  start: () => {
    const s = get()
    if (s.status !== 'idle') return
    const p = pomoSettings()
    const now = Date.now()
    let durationMs = 0
    let phase = s.phase
    if (s.mode === 'stopwatch') {
      phase = 'focus'
    } else if (phase === 'focus') {
      durationMs = p.pomoMinutes * 60000
    } else {
      durationMs = (phase === 'longBreak' ? p.longBreak : p.shortBreak) * 60000
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined)
    }
    set({ phase, durationMs, status: 'running', sessionStart: now, accumulated: 0, resumedAt: now, now })
  },
  pause: () => {
    const s = get()
    if (s.status !== 'running') return
    const now = Date.now()
    set({ status: 'paused', accumulated: elapsedOf(s, now), resumedAt: null, now })
  },
  resume: () => {
    const s = get()
    if (s.status !== 'paused') return
    const now = Date.now()
    set({ status: 'running', resumedAt: now, now })
  },
  stop: (keep) => {
    const s = get()
    if (s.status === 'idle') return
    const now = Date.now()
    if (s.phase === 'focus') {
      if (keep) saveRecord(s, now, Math.round(elapsedOf(s, now) / 60000))
      set({ phase: 'focus', durationMs: 0, ...IDLE, now })
    } else {
      // 休息中结束：直接回到专注
      enterFocus(set, false, now)
    }
  },
  skipBreak: () => {
    const s = get()
    if (s.phase === 'focus') return
    enterFocus(set, false, Date.now())
  },
}))

type Setter = (partial: Partial<TimerState>) => void

function saveRecord(s: TimerState, end: number, minutes: number) {
  if (minutes < 1 || !s.sessionStart) return
  useStore.getState().addFocusRecord({
    start: new Date(s.sessionStart).toISOString(),
    end: new Date(end).toISOString(),
    minutes,
    mode: s.mode,
    taskId: s.taskId,
    title: s.title,
    note: '',
  })
}

function enterFocus(set: Setter, autoStart: boolean, now: number) {
  const p = pomoSettings()
  const durationMs = p.pomoMinutes * 60000
  if (autoStart) set({ phase: 'focus', durationMs, status: 'running', sessionStart: now, accumulated: 0, resumedAt: now, now })
  else set({ phase: 'focus', durationMs, ...IDLE, now })
}

function enterBreak(set: Setter, cyclePomos: number, now: number) {
  const p = pomoSettings()
  const long = p.longBreakEvery > 0 && cyclePomos % p.longBreakEvery === 0
  const minutes = long ? p.longBreak : p.shortBreak
  if (minutes <= 0) {
    enterFocus(set, p.autoStartPomo, now)
    return
  }
  const phase: TimerPhase = long ? 'longBreak' : 'shortBreak'
  const durationMs = minutes * 60000
  if (p.autoStartBreak) set({ phase, durationMs, status: 'running', sessionStart: now, accumulated: 0, resumedAt: now, cyclePomos, now })
  else set({ phase, durationMs, ...IDLE, cyclePomos, now })
}

/** 倒计时自然结束 */
function onComplete(s: TimerState, now: number) {
  const p = pomoSettings()
  const app = useStore.getState()
  if (s.phase === 'focus') {
    const minutes = Math.min(Math.round(elapsedOf(s, now) / 60000), Math.round(s.durationMs / 60000))
    saveRecord(s, now, minutes)
    app.toast('番茄完成 🍅')
    if (p.sound) beep()
    notify('番茄完成 🍅', `${s.title} · ${minutes} 分钟`)
    enterBreak(useTimerStore.setState, s.cyclePomos + 1, now)
  } else {
    app.toast('休息结束，开始下一个番茄吧')
    if (p.sound) beep(660)
    notify('休息结束', '开始下一个番茄吧')
    enterFocus(useTimerStore.setState, p.autoStartPomo, now)
  }
}

// ---------- 模块级 tick：切换视图不影响计时 ----------
let interval: number | null = null
const baseTitle = typeof document !== 'undefined' ? document.title : ''
let lastDocTitle = ''

function tick() {
  const s = useTimerStore.getState()
  if (s.status !== 'running') return
  const now = Date.now()
  if (s.mode === 'pomo' && s.durationMs > 0 && elapsedOf(s, now) >= s.durationMs) onComplete(s, now)
  else useTimerStore.setState({ now })
}

function syncDocTitle(s: TimerState) {
  let title = baseTitle
  if (s.status !== 'idle') {
    const elapsed = elapsedOf(s, s.status === 'running' ? s.now : Date.now())
    const sec = s.durationMs > 0 ? Math.max(0, Math.ceil((s.durationMs - elapsed) / 1000)) : Math.floor(elapsed / 1000)
    const label = s.phase === 'focus' ? (s.status === 'paused' ? '已暂停' : s.title) : '休息'
    title = `${clockText(sec)} · ${label}${baseTitle ? ` - ${baseTitle}` : ''}`
  }
  if (title !== lastDocTitle) {
    lastDocTitle = title
    document.title = title
  }
}

useTimerStore.subscribe((s) => {
  if (s.status === 'running' && interval === null) interval = window.setInterval(tick, 250)
  else if (s.status !== 'running' && interval !== null) {
    window.clearInterval(interval)
    interval = null
  }
  syncDocTitle(s)
  syncNoise(s)
})

// ---------- 白噪音：专注计时进行中播放，暂停 / 结束 / 休息时停止 ----------
/** 是否应当播放白噪音：专注阶段且计时进行中 */
export function noiseShouldPlay(s: Pick<TimerState, 'status' | 'phase'>): boolean {
  return s.status === 'running' && s.phase === 'focus'
}

let noiseKey = ''
function syncNoise(s: TimerState) {
  const p = pomoSettings()
  const want = noiseShouldPlay(s) && p.noise !== 'none'
  const key = want ? `${p.noise}:${p.noiseVolume}` : ''
  if (key === noiseKey) return
  noiseKey = key
  if (want) setNoise(p.noise, p.noiseVolume)
  else stopNoise()
}

// 设置中的噪音类型 / 音量变化时，计时中立即生效
let lastNoiseSetting = ''
useStore.subscribe((app) => {
  const p = app.settings.pomodoro
  const sig = `${p.noise}:${p.noiseVolume}`
  if (sig === lastNoiseSetting) return
  lastNoiseSetting = sig
  syncNoise(useTimerStore.getState())
})
