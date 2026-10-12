import type { Countdown, Task, TaskList } from '../../../store/types'
import { useStore } from '../../../store/useStore'
import { dayjs, formatClock, getTimeFormat, minutesToTime, setTimeFormat, timeToMinutes } from '../../../utils/date'
import type { Dayjs } from '../../../utils/date'

/**
 * 订阅全局时间格式设置并同步到 utils/date（App 的 effect 在子组件渲染之后才执行，
 * 这里在渲染期同步一次，保证 formatClock 在同一帧内就使用新格式）。
 */
export function useClockFormat(): '12h' | '24h' {
  const tf = useStore((s) => s.settings.dateTime.timeFormat)
  if (getTimeFormat() !== tf) setTimeFormat(tf)
  return tf
}

/** 每小时像素高度 */
export const HOUR_H = 84
/** 左侧时间栏宽度 */
export const GUTTER_W = 64
/** 拖拽 / 调整时长的吸附粒度（分钟） */
export const SNAP = 15
/** 新建任务默认时长（分钟） */
export const DEFAULT_DURATION = 60

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
export function snap(min: number, step = SNAP): number {
  return Math.round(min / step) * step
}
/** 分钟 → 'HH:mm'，1440 以 23:59 表示，避免跨天 */
export function toTime(min: number): string {
  const m = clamp(Math.round(min), 0, 1440)
  return m >= 1440 ? '23:59' : minutesToTime(m)
}

export interface TimedBlock {
  task: Task
  start: number
  end: number
  col: number
  cols: number
}

/** 任务的开始/结束分钟（结束缺省为开始 + 60） */
export function taskRange(t: Task): { start: number; end: number } {
  const start = clamp(timeToMinutes(t.dueTime ?? '00:00'), 0, 1439)
  let end = t.endTime ? timeToMinutes(t.endTime) : start + DEFAULT_DURATION
  if (end <= start) end = start + DEFAULT_DURATION
  return { start, end: Math.min(end, 1440) }
}

/** 同一天的定时任务排版：重叠的块按列并排 */
export function layoutTimed(tasks: Task[]): TimedBlock[] {
  const items = tasks
    .map((task) => ({ task, ...taskRange(task) }))
    .sort((a, b) => a.start - b.start || b.end - a.end || a.task.order - b.task.order)
  const out: TimedBlock[] = []
  let cluster: typeof items = []
  let clusterEnd = -1
  const visualEnd = (it: { start: number; end: number }) => Math.max(it.end, it.start + 30)
  const flush = () => {
    if (!cluster.length) return
    const colEnds: number[] = []
    const placed = cluster.map((it) => {
      let col = colEnds.findIndex((e) => e <= it.start)
      if (col === -1) {
        col = colEnds.length
        colEnds.push(visualEnd(it))
      } else colEnds[col] = visualEnd(it)
      return { ...it, col, cols: 0 }
    })
    for (const p of placed) out.push({ ...p, cols: colEnds.length })
    cluster = []
    clusterEnd = -1
  }
  for (const it of items) {
    if (cluster.length && it.start >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, visualEnd(it))
  }
  flush()
  return out
}

/** 指定日期要显示在日历中的倒数日 */
export function countdownsOn(cds: Countdown[], date: string): Countdown[] {
  return cds.filter((c) => c.showInCalendar && (c.date === date || (c.yearly && c.date.slice(5) === date.slice(5))))
}

export function countdownColor(c: Countdown): string {
  return c.color === 'white' ? '#9aa3b5' : c.color
}

export function listColor(lists: TaskList[], listId: string): string {
  return lists.find((l) => l.id === listId)?.color ?? 'var(--accent)'
}

/** 周数标签：取本周中间一天的 ISO 周数，避免周起始不同导致偏差 */
export function weekLabel(days: Dayjs[]): string {
  const mid = days[Math.min(3, days.length - 1)] ?? dayjs()
  return `${mid.isoWeek()}周`
}

export function isWeekend(d: Dayjs): boolean {
  const w = d.day()
  return w === 0 || w === 6
}

/** 按日期归类（含已过滤的任务） */
export function groupByDate(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!t.dueDate) continue
    if (!map.has(t.dueDate)) map.set(t.dueDate, [])
    map.get(t.dueDate)!.push(t)
  }
  return map
}

/** 全天与定时任务拆分，并按时间排序 */
export function splitDay(tasks: Task[]): { allDay: Task[]; timed: Task[] } {
  const allDay = tasks.filter((t) => !t.dueTime).sort((a, b) => a.order - b.order)
  const timed = tasks.filter((t) => !!t.dueTime).sort((a, b) => timeToMinutes(a.dueTime!) - timeToMinutes(b.dueTime!) || a.order - b.order)
  return { allDay, timed }
}

/** 跨组件共享的拖拽信息（HTML5 DnD 的 dragover 阶段读不到 dataTransfer 内容） */
export interface DragInfo {
  id: string
  /** 鼠标按下点距块顶部的分钟数 */
  grabOffset: number
  /** 时长（分钟） */
  duration: number
  /** 原本是否为全天 / 无日期任务 */
  allDay: boolean
}
export const dragState: { current: DragInfo | null } = { current: null }

/** 时间栏小时标签：24h → '09:00'；12h → '上午9:00' / '下午1:00'；12 点恒为「正午」 */
export function hourLabel(h: number): string {
  if (h === 12) return '正午'
  return formatClock(`${String(h).padStart(2, '0')}:00`)
}

/** 'HH:mm - HH:mm' 时间段，按全局 12/24 小时制显示 */
export function clockRange(start: string, end: string): string {
  return `${formatClock(start)} - ${formatClock(end)}`
}

/** 'HH:mm' 加上 n 分钟（不跨天，封顶 23:59） */
export function timeAfter(t: string, n: number): string {
  return toTime(timeToMinutes(t) + n)
}
