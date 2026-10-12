import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/zh-cn'
import isoWeek from 'dayjs/plugin/isoWeek'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import isBetween from 'dayjs/plugin/isBetween'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(isoWeek)
dayjs.extend(weekOfYear)
dayjs.extend(isBetween)
dayjs.extend(customParseFormat)
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export { dayjs }
export type { Dayjs }

export const DATE_FMT = 'YYYY-MM-DD'

/** 全局时间格式（由 App 根据设置写入），humanDate / formatClock 据此输出 12h 或 24h */
let TIME_FORMAT: '12h' | '24h' = '24h'
export function setTimeFormat(f: '12h' | '24h') {
  TIME_FORMAT = f
}
export function getTimeFormat() {
  return TIME_FORMAT
}
/** 'HH:mm' → 按设置显示，如 '14:30' 或 '下午2:30' */
export function formatClock(t: string | null | undefined): string {
  if (!t) return ''
  if (TIME_FORMAT === '24h') return t
  const [h, m] = t.split(':').map(Number)
  const period = h < 12 ? '上午' : '下午'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${period}${hh}:${String(m ?? 0).padStart(2, '0')}`
}
export const WEEKDAYS_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export const WEEKDAYS_MIN = ['日', '一', '二', '三', '四', '五', '六']

export function today(): string {
  return dayjs().format(DATE_FMT)
}
export function fmt(d: Dayjs | Date | string, f = DATE_FMT): string {
  return dayjs(d).format(f)
}
export function addDays(d: string, n: number): string {
  return dayjs(d).add(n, 'day').format(DATE_FMT)
}
export function isToday(d: string | null): boolean {
  return !!d && d === today()
}
export function isOverdue(d: string | null): boolean {
  return !!d && d < today()
}
export function isWithinDays(d: string | null, n: number): boolean {
  if (!d) return false
  const t = today()
  return d >= t && d <= addDays(t, n - 1)
}
export function diffDays(a: string, b: string): number {
  return dayjs(a).startOf('day').diff(dayjs(b).startOf('day'), 'day')
}
/** 周起始：根据 weekStart (0=周日,1=周一,6=周六) 取当周第一天 */
export function startOfWeek(d: string | Dayjs, weekStart: 0 | 1 | 6 = 1): Dayjs {
  const x = dayjs(d)
  const dow = x.day()
  const delta = (dow - weekStart + 7) % 7
  return x.subtract(delta, 'day').startOf('day')
}
export function weekDays(d: string | Dayjs, weekStart: 0 | 1 | 6 = 1): Dayjs[] {
  const s = startOfWeek(d, weekStart)
  return Array.from({ length: 7 }, (_, i) => s.add(i, 'day'))
}
/** 月视图网格：补齐前后，总是 6 行 */
export function monthGrid(d: string | Dayjs, weekStart: 0 | 1 | 6 = 1): Dayjs[] {
  const first = dayjs(d).startOf('month')
  const start = startOfWeek(first, weekStart)
  return Array.from({ length: 42 }, (_, i) => start.add(i, 'day'))
}

/** 任务日期的友好显示（今天 / 明天 / 周三 / 10月15日 / 2025年1月1日） */
export function humanDate(d: string | null, time?: string | null): string {
  if (!d) return ''
  const t = dayjs(d)
  const n = dayjs()
  let label: string
  const dd = diffDays(d, today())
  if (dd === 0) label = '今天'
  else if (dd === 1) label = '明天'
  else if (dd === -1) label = '昨天'
  else if (dd > 1 && dd < 7) label = WEEKDAYS_SHORT[t.day()]
  else if (t.year() === n.year()) label = t.format('M月D日')
  else label = t.format('YYYY年M月D日')
  return time ? `${label} ${formatClock(time)}` : label
}

export function minutesToText(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${m}m`
}
export function secondsToClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}
export function minutesToTime(m: number): string {
  const mm = ((m % 1440) + 1440) % 1440
  return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`
}
