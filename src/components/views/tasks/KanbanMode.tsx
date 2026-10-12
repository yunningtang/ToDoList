import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import Checkbox from '../../common/Checkbox'
import { PriorityIcon } from '../../common/PriorityPicker'
import { useStore } from '../../../store/useStore'
import type { TaskSelection } from '../../../store/useStore'
import type { GroupKey, Priority, Task } from '../../../store/types'
import { groupTasks, listName, PRIORITIES, PRIORITY_META, sortTasks, dateLabel } from '../../../utils/task'
import type { SortKey } from '../../../store/types'
import { addDays, today } from '../../../utils/date'
import { DRAG_TASK } from './helpers'

interface Props {
  selection: TaskSelection
  tasks: Task[]
  sort: SortKey
  groupBy: GroupKey
  showCompleted: boolean
  quickDefaults: Partial<Task>
}

interface Column {
  key: string
  label: string
  color?: string
  tasks: Task[]
}

export default function KanbanMode({ selection, tasks, sort, groupBy, showCompleted, quickDefaults }: Props) {
  const { lists, tags, selectedTaskId, selectTask, updateTask, toggleComplete, addTask, addTag } = useStore()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragFrom, setDragFrom] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const [adding, setAdding] = useState<Record<string, string>>({})

  // 分组为"无"时：智能清单按清单分列，否则按优先级分列
  const effGroup: Exclude<GroupKey, 'none'> = groupBy !== 'none' ? groupBy : selection.type === 'smart' ? 'list' : 'priority'

  const columns = useMemo<Column[]>(() => {
    const pending = sortTasks(tasks.filter((t) => !t.completed), sort)
    const done = showCompleted ? tasks.filter((t) => t.completed) : []
    const groups = groupTasks([...pending, ...done], effGroup, lists, tags)
    const byKey = new Map(groups.map((g) => [g.key, g]))
    let base: Column[]
    switch (effGroup) {
      case 'priority':
        base = PRIORITIES.map((p) => ({ key: String(p), label: PRIORITY_META[p].label, color: PRIORITY_META[p].color, tasks: [] }))
        break
      case 'list':
        base = [{ key: 'inbox', label: '收集箱', color: '#8C8C8C', tasks: [] }, ...[...lists].sort((a, b) => a.order - b.order).map((l) => ({ key: l.id, label: l.name, color: l.color, tasks: [] }))]
        break
      case 'tag':
        base = [...tags.map((t) => ({ key: t.name, label: t.name, color: t.color, tasks: [] })), { key: '_none', label: '无标签', tasks: [] }]
        break
      default:
        base = [
          { key: '0_overdue', label: '已过期', color: '#F5523C', tasks: [] },
          { key: '1_today', label: '今天', tasks: [] },
          { key: '2_tomorrow', label: '明天', tasks: [] },
          { key: '3_week', label: '最近7天', tasks: [] },
          { key: '4_later', label: '更晚', tasks: [] },
          { key: '9_none', label: '无日期', tasks: [] },
        ]
    }
    return base.map((c) => ({ ...c, tasks: byKey.get(c.key)?.tasks ?? [] }))
  }, [tasks, sort, showCompleted, effGroup, lists, tags])

  /** 拖到某列：根据分组维度更新任务 */
  const dropTo = (task: Task, key: string) => {
    switch (effGroup) {
      case 'priority':
        updateTask(task.id, { priority: Number(key) as Priority })
        break
      case 'list':
        updateTask(task.id, { listId: key })
        break
      case 'tag': {
        let next = task.tags.filter((n) => n !== dragFrom)
        if (key !== '_none' && !next.includes(key)) next = [...next, key]
        if (key === '_none') next = []
        updateTask(task.id, { tags: next })
        break
      }
      default: {
        const t0 = today()
        const map: Record<string, string | null> = {
          '0_overdue': addDays(t0, -1),
          '1_today': t0,
          '2_tomorrow': addDays(t0, 1),
          '3_week': addDays(t0, 2),
          '4_later': addDays(t0, 7),
          '9_none': null,
        }
        updateTask(task.id, { dueDate: map[key] ?? null })
      }
    }
  }

  /** 列内添加任务时的默认值 */
  const defaultsFor = (key: string): Partial<Task> => {
    const d: Partial<Task> = { ...quickDefaults }
    switch (effGroup) {
      case 'priority':
        d.priority = Number(key) as Priority
        break
      case 'list':
        d.listId = key
        break
      case 'tag':
        if (key !== '_none') d.tags = [...(d.tags ?? []), key]
        break
      default: {
        const t0 = today()
        const map: Record<string, string | null> = { '0_overdue': addDays(t0, -1), '1_today': t0, '2_tomorrow': addDays(t0, 1), '3_week': addDays(t0, 2), '4_later': addDays(t0, 7), '9_none': null }
        d.dueDate = map[key] ?? null
      }
    }
    return d
  }

  const submitAdd = (key: string) => {
    const title = (adding[key] ?? '').trim()
    if (!title) return
    const d = defaultsFor(key)
    for (const n of d.tags ?? []) addTag({ name: n })
    addTask({ ...d, title })
    setAdding((s) => ({ ...s, [key]: '' }))
  }

  return (
    <div className="tk-kanban">
      {columns.map((col) => (
        <div
          key={col.key}
          className={`tk-col ${overKey === col.key ? 'over' : ''}`}
          onDragOver={(e) => {
            if (!dragId) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            if (overKey !== col.key) setOverKey(col.key)
          }}
          onDragLeave={(e) => {
            if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOverKey(null)
          }}
          onDrop={(e) => {
            e.preventDefault()
            const id = dragId ?? e.dataTransfer.getData(DRAG_TASK)
            const t = tasks.find((x) => x.id === id)
            if (t) dropTo(t, col.key)
            setDragId(null)
            setOverKey(null)
          }}
        >
          <div className="tk-col-head">
            {col.color && <span className="color-dot" style={{ background: col.color }} />}
            <span className="tk-col-title">{col.label}</span>
            <span className="tk-col-count">{col.tasks.filter((t) => !t.completed).length}</span>
          </div>
          <div className="tk-col-body">
            {col.tasks.map((t) => {
              const { text, overdue } = dateLabel(t)
              return (
                <div
                  key={t.id}
                  className={`tk-card ${t.completed ? 'done' : ''} ${selectedTaskId === t.id ? 'selected' : ''} ${dragId === t.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    setDragId(t.id)
                    setDragFrom(col.key)
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData(DRAG_TASK, t.id)
                  }}
                  onDragEnd={() => {
                    setDragId(null)
                    setOverKey(null)
                  }}
                  onClick={() => selectTask(t.id)}
                >
                  <div className="tk-card-row">
                    <Checkbox size="sm" checked={t.completed} priority={t.priority} onChange={() => toggleComplete(t.id)} />
                    <span className="tk-card-title">{t.title || '无标题'}</span>
                  </div>
                  {(t.dueDate || t.tags.length > 0 || t.priority > 0 || (effGroup !== 'list' && selection.type !== 'list')) && (
                    <div className="tk-card-meta">
                      {t.dueDate && <span className={`tk-card-date ${overdue ? 'overdue' : t.dueDate === today() ? 'today' : ''}`}>{text}</span>}
                      {t.tags.map((n) => (
                        <span key={n} className="tag-chip">
                          #{n}
                        </span>
                      ))}
                      <span className="grow" />
                      {effGroup !== 'list' && selection.type !== 'list' && <span className="tk-card-list">{listName(lists, t.listId)}</span>}
                      {t.priority > 0 && <PriorityIcon priority={t.priority} size={13} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="tk-col-add">
            <Plus size={15} />
            <input
              placeholder="添加任务"
              value={adding[col.key] ?? ''}
              onChange={(e) => setAdding((s) => ({ ...s, [col.key]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitAdd(col.key)
                if (e.key === 'Escape') setAdding((s) => ({ ...s, [col.key]: '' }))
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
