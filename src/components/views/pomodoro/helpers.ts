import type { FocusRecord, Task, TaskList } from '../../../store/types'
import { useStore } from '../../../store/useStore'
import { dayjs, formatClock, getTimeFormat, secondsToClock, setTimeFormat, today } from '../../../utils/date'

/** 订阅全局 12/24 小时制并在渲染期同步到 utils/date（保证 formatClock 同帧生效） */
export function useClockFormat(): '12h' | '24h' {
  const tf = useStore((s) => s.settings.dateTime.timeFormat)
  if (getTimeFormat() !== tf) setTimeFormat(tf)
  return tf
}

/** 超过一小时显示 H:MM:SS，否则 MM:SS */
export function clockText(sec: number): string {
  if (sec >= 3600) return `${Math.floor(sec / 3600)}:${secondsToClock(sec % 3600)}`
  return secondsToClock(sec)
}

/** 469h17m → [{num:'469',unit:'h'},{num:'17',unit:'m'}]；不足 1 小时 → [{num:'0',unit:'m'}] */
export function hmParts(min: number): { num: string; unit: string }[] {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return [{ num: String(m), unit: 'm' }]
  return [
    { num: String(h), unit: 'h' },
    { num: String(m), unit: 'm' },
  ]
}

export function hmText(min: number): string {
  return hmParts(min)
    .map((p) => `${p.num} ${p.unit}`)
    .join(' ')
}

/** 记录分组标题：今天 / 昨天 / M月D日 / YYYY年M月D日 */
export function dayLabel(day: string): string {
  const t = today()
  if (day === t) return '今天'
  if (day === dayjs(t).subtract(1, 'day').format('YYYY-MM-DD')) return '昨天'
  const d = dayjs(day)
  return d.year() === dayjs().year() ? d.format('M月D日') : d.format('YYYY年M月D日')
}

export function dayOf(iso: string): string {
  return dayjs(iso).format('YYYY-MM-DD')
}

/** 'H:mm - H:mm'（24h）或 '上午9:00 - 上午9:25'（12h） */
export function timeRange(r: FocusRecord): string {
  const a = dayjs(r.start)
  const b = dayjs(r.end)
  if (getTimeFormat() === '24h') return `${a.format('H:mm')} - ${b.format('H:mm')}`
  return `${formatClock(a.format('HH:mm'))} - ${formatClock(b.format('HH:mm'))}`
}

export interface RecordGroup {
  day: string
  label: string
  minutes: number
  records: FocusRecord[]
}

/** 按日期倒序分组（组内按开始时间倒序） */
export function groupRecords(records: FocusRecord[]): RecordGroup[] {
  const sorted = [...records].sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0))
  const groups: RecordGroup[] = []
  for (const r of sorted) {
    const day = dayOf(r.start)
    const last = groups[groups.length - 1]
    if (last && last.day === day) {
      last.records.push(r)
      last.minutes += r.minutes
    } else groups.push({ day, label: dayLabel(day), minutes: r.minutes, records: [r] })
  }
  return groups
}

export interface PendingTask {
  task: Task
  listName: string
}

export function pendingTasks(tasks: Task[], lists: TaskList[]): PendingTask[] {
  const names = new Map(lists.map((l) => [l.id, l.name]))
  return tasks
    .filter((t) => !t.deleted && !t.completed)
    .sort((a, b) => a.order - b.order)
    .map((task) => ({ task, listName: task.listId === 'inbox' ? '收集箱' : names.get(task.listId) ?? '清单' }))
}

export function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** WebAudio 短提示音 */
export function beep(freq = 880) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const play = (at: number, f: number) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(0.25, at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.45)
      o.start(at)
      o.stop(at + 0.5)
    }
    const t = ctx.currentTime
    play(t, freq)
    play(t + 0.3, freq * 1.25)
    setTimeout(() => ctx.close().catch(() => undefined), 1200)
  } catch {
    /* 忽略音频错误 */
  }
}

export function notify(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const n = new Notification(title, { body, silent: true })
    setTimeout(() => n.close(), 6000)
  } catch {
    /* 忽略通知错误 */
  }
}

export function clampInt(v: string | number, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}
