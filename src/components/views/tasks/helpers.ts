import type { Task, TaskList } from '../../../store/types'
import type { TaskSelection } from '../../../store/useStore'
import { PRIORITY_META } from '../../../utils/task'

/** listPrefs 的键：selection.type + ':' + selection.id */
export function prefKey(sel: TaskSelection): string {
  return `${sel.type}:${sel.id}`
}

export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable
}

/** 任务在时间线/看板中的主题色：清单颜色优先，其次优先级颜色 */
export function taskColor(t: Task, lists: TaskList[]): string {
  if (t.priority) return PRIORITY_META[t.priority].color
  const l = lists.find((x) => x.id === t.listId)
  return l?.color ?? '#4772FA'
}

export const EMOJIS = [
  '📝', '📌', '⭐', '🎯', '💼', '🏠', '📚', '🛒',
  '💡', '🎉', '❤️', '🔥', '🌱', '🍀', '🎵', '🏃',
  '✈️', '🍔', '💰', '🧘', '🎮', '📷', '🐱', '☕',
]

export const DATE_RULE_LABEL: Record<string, string> = {
  any: '不限',
  today: '今天',
  tomorrow: '明天',
  '7days': '最近7天',
  overdue: '已过期',
  nodate: '无日期',
  thisWeek: '本周',
  thisMonth: '本月',
}

export const DRAG_TASK = 'application/x-task-id'
