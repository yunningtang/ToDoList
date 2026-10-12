import type { Countdown, CountdownKind } from '../../../store/types'
import { DATE_FMT, dayjs, diffDays, today } from '../../../utils/date'

export const KIND_LABELS: Record<CountdownKind, string> = {
  anniversary: '纪念日',
  countdown: '倒数日',
  holiday: '节日',
}

/** 卡片背景色：'white' 为白底，其余为浅色主题色（深色文字可读） */
export const COUNTDOWN_COLORS = ['white', '#8ea6fa', '#f5a65b', '#f58c8c', '#7fd1ae', '#9b8cf5', '#f5c86b', '#6ec6f0', '#f09bc8']

export interface CountdownInfo {
  /** 实际计算用的目标日期（每年重复时为下一次） */
  target: string
  /** 目标日期 - 今天（>0 未来，<0 过去） */
  diff: number
  /** 大号展示内容 */
  number: string
  /** 是否为文字（如「今天」），用较小字号 */
  isText: boolean
  caption: string
}

export function computeCountdown(c: Countdown, t: string = today()): CountdownInfo {
  const d = dayjs(c.date)
  if (c.yearly) {
    let next = d.year(dayjs(t).year())
    if (next.format(DATE_FMT) < t) next = next.add(1, 'year')
    const target = next.format(DATE_FMT)
    const diff = diffDays(target, t)
    if (diff === 0) return { target, diff, number: '今天', isText: true, caption: `${d.format('M月D日')} · 每年` }
    return { target, diff, number: String(diff), isText: false, caption: `距离 ${next.format('YYYY年M月D日')} 还有` }
  }
  const label = d.format('YYYY年M月D日')
  const diff = diffDays(c.date, t)
  if (diff === 0) return { target: c.date, diff, number: '今天', isText: true, caption: `${label} 就是今天` }
  if (diff > 0) return { target: c.date, diff, number: String(diff), isText: false, caption: `距离 ${label} 还有` }
  return { target: c.date, diff, number: String(-diff), isText: false, caption: `距离 ${label} 已经` }
}

/** 排序：未来的按临近程度在前，然后是过去的按临近程度 */
export function compareByDate(a: CountdownInfo, b: CountdownInfo): number {
  const fa = a.diff >= 0
  const fb = b.diff >= 0
  if (fa !== fb) return fa ? -1 : 1
  return fa ? a.diff - b.diff : b.diff - a.diff
}
