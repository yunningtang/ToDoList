import { useStore } from '../store/useStore'
import { dayjs, today, timeToMinutes } from '../utils/date'
import type { Task } from '../store/types'

/**
 * 到期提醒调度：每 30 秒检查一次，对今天到期且设置了时间 / 提醒的任务，在提醒时刻触发
 * 系统通知 + 应用内提示 + 可选提示音。每个任务每天只提醒一次（记录在 localStorage）。
 * 另支持“每日回顾”定时通知。
 */

const FIRED_KEY = 'dida-reminders-fired'

function firedSet(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}')
    if (raw.date !== today()) return new Set()
    return new Set<string>(raw.ids ?? [])
  } catch {
    return new Set()
  }
}
function markFired(set: Set<string>) {
  localStorage.setItem(FIRED_KEY, JSON.stringify({ date: today(), ids: [...set] }))
}

/** 计算任务的提醒时刻（当天分钟数），无提醒返回 null */
export function reminderMinutes(t: Task): number | null {
  if (!t.dueDate || t.completed || t.deleted) return null
  const due = t.dueTime ? timeToMinutes(t.dueTime) : null
  const r = t.reminder
  if (!r) return null
  if (r === 'onTime') return due
  if (r.startsWith('-')) {
    if (due == null) return null
    const m = r.endsWith('m') ? Number(r.slice(1, -1)) : r.endsWith('h') ? Number(r.slice(1, -1)) * 60 : Number(r.slice(1, -1)) * 1440
    return due - m
  }
  if (/^\d{2}:\d{2}$/.test(r)) return timeToMinutes(r)
  return due
}

export function beep(freq = 880, ms = 160) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = freq
    o.connect(g)
    g.connect(ctx.destination)
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000)
    o.start()
    o.stop(ctx.currentTime + ms / 1000 + 0.05)
  } catch {
    /* ignore */
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const r = await Notification.requestPermission()
  return r === 'granted'
}

export function notify(title: string, body: string, onClick?: () => void) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const n = new Notification(title, { body, icon: './favicon.svg', tag: title + body })
    if (onClick) n.onclick = () => { window.focus(); onClick(); n.close() }
  }
}

function tick() {
  const s = useStore.getState()
  const cfg = s.settings.reminders
  if (!cfg.enabled) return
  const nowMin = dayjs().hour() * 60 + dayjs().minute()
  const fired = firedSet()
  let changed = false

  // 任务提醒：到达提醒时刻后 10 分钟内有效，避免错过
  for (const t of s.tasks) {
    if (t.dueDate !== today()) continue
    const m = reminderMinutes(t)
    if (m == null) continue
    if (nowMin >= m && nowMin - m <= 10 && !fired.has(t.id)) {
      fired.add(t.id)
      changed = true
      const body = t.dueTime ? `今天 ${t.dueTime}` : '今天'
      notify(t.title, body, () => {
        s.setView('tasks')
        s.setSelection({ type: 'smart', id: 'today' })
        s.selectTask(t.id)
      })
      s.toast(`⏰ ${t.title} · ${body}`, {
        label: '查看',
        onClick: () => {
          s.setView('tasks')
          s.setSelection({ type: 'smart', id: 'today' })
          s.selectTask(t.id)
        },
      })
      if (cfg.sound) beep()
    }
  }

  // 每日回顾
  if (cfg.dailyReview && cfg.dailyReviewTime) {
    const m = timeToMinutes(cfg.dailyReviewTime)
    if (nowMin >= m && nowMin - m <= 10 && !fired.has('__daily')) {
      fired.add('__daily')
      changed = true
      const todays = s.tasks.filter((t) => !t.deleted && !t.completed && t.dueDate === today())
      const overdue = s.tasks.filter((t) => !t.deleted && !t.completed && t.dueDate && t.dueDate < today())
      const body = `今天 ${todays.length} 项待办${overdue.length ? `，${overdue.length} 项已过期` : ''}`
      notify('每日回顾', body, () => {
        s.setView('tasks')
        s.setSelection({ type: 'smart', id: 'today' })
      })
      s.toast(`📋 每日回顾：${body}`)
      if (cfg.sound) beep(660)
    }
  }
  if (changed) markFired(fired)
}

let timer: number | null = null
export function startReminderService() {
  if (timer !== null) return () => {}
  void ensureNotificationPermission()
  tick()
  timer = window.setInterval(tick, 30_000)
  return () => {
    if (timer !== null) window.clearInterval(timer)
    timer = null
  }
}
