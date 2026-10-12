import type { Habit } from '../../../store/types'
import { addDays, today } from '../../../utils/date'

export const HABIT_COLORS = ['#4772FA', '#39c2e3', '#2dca8c', '#ffb400', '#f5523c', '#9b6cf5', '#f06ca8', '#ff8a3d']

/** 当前连续打卡天数：从今天（若今天未打卡则从昨天）往前数 */
export function currentStreak(checkins: string[], t: string = today()): number {
  const set = new Set(checkins)
  let cur = set.has(t) ? t : addDays(t, -1)
  let n = 0
  while (set.has(cur)) {
    n++
    cur = addDays(cur, -1)
  }
  return n
}

/** 某个日期区间（含两端）的打卡次数 */
export function countBetween(h: Habit, from: string, to: string): number {
  return h.checkins.filter((d) => d >= from && d <= to).length
}
