import type { Filter, GroupKey, Priority, Settings, SortKey, Tag, Task, TaskList } from '../store/types'
import type { TaskSelection } from '../store/useStore'
import { addDays, dayjs, humanDate, isOverdue, isToday, isWithinDays, startOfWeek, today, WEEKDAYS_SHORT } from './date'

export const PRIORITY_META: Record<Priority, { label: string; short: string; color: string }> = {
  5: { label: '高优先级', short: '高', color: '#F5523C' },
  3: { label: '中优先级', short: '中', color: '#FFB400' },
  1: { label: '低优先级', short: '低', color: '#4772FA' },
  0: { label: '无优先级', short: '无', color: '#C3C7CF' },
}
export const PRIORITIES: Priority[] = [5, 3, 1, 0]

export const LIST_COLORS = ['#4772FA', '#F5523C', '#FFB400', '#2DCA8C', '#39C2E3', '#9B6CF6', '#F569A1', '#FF8A3D', '#8C8C8C', '#1E2A4A']

export function activeTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.deleted)
}

export function listName(lists: TaskList[], id: string): string {
  if (id === 'inbox') return '收集箱'
  return lists.find((l) => l.id === id)?.name ?? '收集箱'
}

export function matchesFilter(t: Task, f: Filter): boolean {
  const r = f.rule
  if (r.listIds.length && !r.listIds.includes(t.listId)) return false
  if (r.priorities.length && !r.priorities.includes(t.priority)) return false
  if (r.tags.length && !r.tags.some((n) => t.tags.includes(n))) return false
  if (r.keyword && !t.title.toLowerCase().includes(r.keyword.toLowerCase())) return false
  switch (r.date) {
    case 'today':
      return isToday(t.dueDate)
    case 'tomorrow':
      return t.dueDate === addDays(today(), 1)
    case '7days':
      return isWithinDays(t.dueDate, 7)
    case 'overdue':
      return isOverdue(t.dueDate) && !t.completed
    case 'nodate':
      return !t.dueDate
    case 'thisWeek': {
      if (!t.dueDate) return false
      const s = startOfWeek(today())
      return t.dueDate >= s.format('YYYY-MM-DD') && t.dueDate <= s.add(6, 'day').format('YYYY-MM-DD')
    }
    case 'thisMonth':
      return !!t.dueDate && t.dueDate.slice(0, 7) === today().slice(0, 7)
    default:
      return true
  }
}

/** 根据左侧选择返回任务（包含已完成，不包含已删除，除非是垃圾桶） */
export function tasksForSelection(
  tasks: Task[],
  selection: TaskSelection,
  tags: Tag[],
  filters: Filter[],
): Task[] {
  if (selection.type === 'smart' && selection.id === 'trash') return tasks.filter((t) => t.deleted)
  const live = activeTasks(tasks)
  switch (selection.type) {
    case 'smart':
      switch (selection.id) {
        case 'all':
          return live
        case 'today':
          return live.filter((t) => isToday(t.dueDate) || (isOverdue(t.dueDate) && !t.completed))
        case 'tomorrow':
          return live.filter((t) => t.dueDate === addDays(today(), 1))
        case 'next7':
          return live.filter((t) => isWithinDays(t.dueDate, 7) || (isOverdue(t.dueDate) && !t.completed))
        case 'inbox':
          return live.filter((t) => t.listId === 'inbox')
        case 'completed':
          return live.filter((t) => t.completed)
        default:
          return live
      }
    case 'list':
      return live.filter((t) => t.listId === selection.id)
    case 'tag': {
      const tag = tags.find((x) => x.id === selection.id)
      return tag ? live.filter((t) => t.tags.includes(tag.name)) : []
    }
    case 'filter': {
      const f = filters.find((x) => x.id === selection.id)
      return f ? live.filter((t) => matchesFilter(t, f)) : []
    }
  }
}

export function selectionTitle(selection: TaskSelection, lists: TaskList[], tags: Tag[], filters: Filter[]): string {
  switch (selection.type) {
    case 'smart':
      return { all: '所有', today: '今天', tomorrow: '明天', next7: '最近7天', inbox: '收集箱', completed: '已完成', trash: '垃圾桶' }[selection.id]
    case 'list':
      return listName(lists, selection.id)
    case 'tag':
      return tags.find((t) => t.id === selection.id)?.name ?? '标签'
    case 'filter':
      return filters.find((f) => f.id === selection.id)?.name ?? '过滤器'
  }
}

/** 未完成的待办数量（用于侧栏计数） */
export function pendingCount(tasks: Task[]): number {
  return tasks.filter((t) => !t.completed && !t.deleted).length
}

export function quadrantOf(t: Task, rules: Settings['quadrantRules']): 1 | 2 | 3 | 4 {
  for (const q of ['1', '2', '3', '4'] as const) {
    if (rules[q].priorities.includes(t.priority)) return Number(q) as 1 | 2 | 3 | 4
  }
  return 4
}

const PRIORITY_RANK: Record<Priority, number> = { 5: 0, 3: 1, 1: 2, 0: 3 }

export function sortTasks(tasks: Task[], sort: SortKey): Task[] {
  const arr = [...tasks]
  const pinFirst = (a: Task, b: Task) => Number(b.pinned) - Number(a.pinned)
  switch (sort) {
    case 'date':
      return arr.sort((a, b) => pinFirst(a, b) || cmpDate(a, b) || a.order - b.order)
    case 'priority':
      return arr.sort((a, b) => pinFirst(a, b) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || cmpDate(a, b) || a.order - b.order)
    case 'title':
      return arr.sort((a, b) => pinFirst(a, b) || a.title.localeCompare(b.title, 'zh-CN'))
    default:
      return arr.sort((a, b) => pinFirst(a, b) || a.order - b.order)
  }
}
function cmpDate(a: Task, b: Task): number {
  const ad = a.dueDate ? `${a.dueDate} ${a.dueTime ?? '99:99'}` : '9999'
  const bd = b.dueDate ? `${b.dueDate} ${b.dueTime ?? '99:99'}` : '9999'
  return ad < bd ? -1 : ad > bd ? 1 : 0
}

export interface TaskGroup {
  key: string
  label: string
  tasks: Task[]
  color?: string
}

export function groupTasks(tasks: Task[], groupBy: GroupKey, lists: TaskList[], tags: Tag[]): TaskGroup[] {
  if (groupBy === 'none') return [{ key: 'all', label: '', tasks }]
  const map = new Map<string, TaskGroup>()
  const push = (key: string, label: string, t: Task, color?: string) => {
    if (!map.has(key)) map.set(key, { key, label, tasks: [], color })
    map.get(key)!.tasks.push(t)
  }
  for (const t of tasks) {
    switch (groupBy) {
      case 'list':
        push(t.listId, listName(lists, t.listId), t, lists.find((l) => l.id === t.listId)?.color)
        break
      case 'priority':
        push(String(t.priority), PRIORITY_META[t.priority].label, t, PRIORITY_META[t.priority].color)
        break
      case 'tag':
        if (t.tags.length === 0) push('_none', '无标签', t)
        else for (const n of t.tags) push(n, n, t, tags.find((x) => x.name === n)?.color)
        break
      case 'date': {
        if (!t.dueDate) push('9_none', '无日期', t)
        else if (isOverdue(t.dueDate)) push('0_overdue', '已过期', t, '#F5523C')
        else if (isToday(t.dueDate)) push('1_today', '今天', t)
        else if (t.dueDate === addDays(today(), 1)) push('2_tomorrow', '明天', t)
        else if (isWithinDays(t.dueDate, 7)) push('3_week', '最近7天', t)
        else push('4_later', '更晚', t)
        break
      }
    }
  }
  const groups = [...map.values()]
  if (groupBy === 'priority') groups.sort((a, b) => PRIORITY_RANK[Number(a.key) as Priority] - PRIORITY_RANK[Number(b.key) as Priority])
  else if (groupBy === 'date') groups.sort((a, b) => a.key.localeCompare(b.key))
  else if (groupBy === 'list') groups.sort((a, b) => (lists.findIndex((l) => l.id === a.key)) - (lists.findIndex((l) => l.id === b.key)))
  return groups
}

export function dateLabel(t: Task): { text: string; overdue: boolean } {
  return { text: humanDate(t.dueDate, t.dueTime), overdue: isOverdue(t.dueDate) && !t.completed }
}

/** 快速添加的智能解析：支持 今天/明天/后天/下周x/周x、M月D日、HH:mm、#标签、!高/!中/!低、~清单名 */
export interface ParsedQuickAdd {
  title: string
  dueDate: string | null
  dueTime: string | null
  priority: Priority | null
  tags: string[]
  listId: string | null
}
export function parseQuickAdd(text: string, lists: TaskList[]): ParsedQuickAdd {
  let title = text
  const out: ParsedQuickAdd = { title: text.trim(), dueDate: null, dueTime: null, priority: null, tags: [], listId: null }
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = title.match(re)
    if (m) {
      fn(m)
      title = title.replace(m[0], ' ')
    }
  }
  take(/(^|\s)!(高|中|低|[123])(?=\s|$)/, (m) => {
    const v = m[2]
    out.priority = v === '高' || v === '1' ? 5 : v === '中' || v === '2' ? 3 : 1
  })
  const tagRe = /(^|\s)#([^\s#]+)/g
  let tm: RegExpExecArray | null
  while ((tm = tagRe.exec(title))) out.tags.push(tm[2])
  title = title.replace(tagRe, ' ')
  take(/(^|\s)~([^\s~]+)/, (m) => {
    const l = lists.find((x) => x.name === m[2])
    if (l) out.listId = l.id
  })
  const t0 = today()
  take(/(^|\s)(今天|明天|后天|大后天)(?=\s|$|\d)/, (m) => {
    out.dueDate = addDays(t0, { 今天: 0, 明天: 1, 后天: 2, 大后天: 3 }[m[2]]!)
  })
  take(/(^|\s)(下?)(周|星期)([一二三四五六日天])(?=\s|$|\d)/, (m) => {
    const dow = '日一二三四五六'.indexOf(m[4] === '天' ? '日' : m[4])
    let d = dayjs(t0)
    const cur = d.day()
    let delta = (dow - cur + 7) % 7
    if (delta === 0 && !m[2]) delta = 7
    if (m[2]) delta += delta === 0 ? 7 : 7 - (delta > 0 ? 0 : 0)
    d = d.add(delta, 'day')
    out.dueDate = d.format('YYYY-MM-DD')
  })
  take(/(^|\s)(\d{1,2})月(\d{1,2})[日号]?(?=\s|$)/, (m) => {
    let d = dayjs(`${dayjs().year()}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`)
    if (d.isValid()) {
      if (d.format('YYYY-MM-DD') < t0) d = d.add(1, 'year')
      out.dueDate = d.format('YYYY-MM-DD')
    }
  })
  take(/(^|\s)(\d{1,2}):(\d{2})(?=\s|$)/, (m) => {
    const h = Number(m[2])
    const mi = Number(m[3])
    if (h < 24 && mi < 60) {
      out.dueTime = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
      if (!out.dueDate) out.dueDate = t0
    }
  })
  out.title = title.replace(/\s+/g, ' ').trim()
  return out
}

export function weekdayName(d: string): string {
  return WEEKDAYS_SHORT[dayjs(d).day()]
}
