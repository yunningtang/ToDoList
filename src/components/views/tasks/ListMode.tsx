import { useMemo, useState } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import TaskItem from '../../common/TaskItem'
import EmptyState from '../../common/EmptyState'
import { ConfirmModal } from '../../common/Modal'
import { useStore } from '../../../store/useStore'
import type { TaskSelection } from '../../../store/useStore'
import type { GroupKey, SortKey, Task } from '../../../store/types'
import { groupTasks, sortTasks } from '../../../utils/task'
import { dayjs, today } from '../../../utils/date'

interface Props {
  selection: TaskSelection
  tasks: Task[]
  title: string
  sort: SortKey
  groupBy: GroupKey
  showCompleted: boolean
}

function GroupHeader({ label, count, color, collapsed, onToggle }: { label: string; count: number; color?: string; collapsed: boolean; onToggle: () => void }) {
  return (
    <div className={`task-group-title ${collapsed ? 'collapsed' : ''}`} onClick={onToggle}>
      <ChevronDown size={16} className="chev" />
      {color && <span className="color-dot" style={{ background: color }} />}
      <span>{label}</span>
      <span className="count">{count}</span>
    </div>
  )
}

export default function ListMode({ selection, tasks, title, sort, groupBy, showCompleted }: Props) {
  const { selectedTaskId, selectTask, reorderTasks, emptyTrash, toast } = useStore()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overAfter, setOverAfter] = useState(false)
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  const toggle = (k: string) =>
    setCollapsed((s) => {
      const n = new Set(s)
      n.has(k) ? n.delete(k) : n.add(k)
      return n
    })

  const isTrash = selection.type === 'smart' && selection.id === 'trash'
  const isCompletedView = selection.type === 'smart' && selection.id === 'completed'

  // ---------- 垃圾桶 ----------
  if (isTrash) {
    const items = sortTasks(tasks, 'date').sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''))
    return (
      <div className="tk-list">
        {items.length === 0 ? (
          <EmptyState text="垃圾桶是空的" kind="tasks" />
        ) : (
          <>
            <div className="tk-trash-bar">
              <span className="tk-muted">共 {items.length} 个任务，删除后 30 天自动清除</span>
              <button className="btn sm danger" onClick={() => setConfirmEmpty(true)}>
                <Trash2 size={14} />
                清空垃圾桶
              </button>
            </div>
            {items.map((t) => (
              <TaskItem key={t.id} task={t} selected={t.id === selectedTaskId} onSelect={selectTask} showList />
            ))}
          </>
        )}
        <ConfirmModal
          open={confirmEmpty}
          onClose={() => setConfirmEmpty(false)}
          onConfirm={() => {
            emptyTrash()
            toast('垃圾桶已清空')
          }}
          title="清空垃圾桶"
          text="垃圾桶中的所有任务将被永久删除，无法恢复。"
          danger
          confirmText="清空"
        />
      </div>
    )
  }

  // ---------- 已完成：按完成日期分组 ----------
  if (isCompletedView) {
    const t0 = today()
    const y0 = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    const buckets: { key: string; label: string; tasks: Task[] }[] = [
      { key: 'today', label: '今天', tasks: [] },
      { key: 'yesterday', label: '昨天', tasks: [] },
      { key: 'earlier', label: '更早', tasks: [] },
    ]
    for (const t of [...tasks].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))) {
      const d = t.completedAt ? dayjs(t.completedAt).format('YYYY-MM-DD') : ''
      ;(d === t0 ? buckets[0] : d === y0 ? buckets[1] : buckets[2]).tasks.push(t)
    }
    const visible = buckets.filter((b) => b.tasks.length)
    if (visible.length === 0) return <EmptyState text="还没有已完成的任务" kind="tasks" />
    return (
      <div className="tk-list">
        {visible.map((b) => (
          <div key={b.key}>
            <GroupHeader label={b.label} count={b.tasks.length} collapsed={collapsed.has(b.key)} onToggle={() => toggle(b.key)} />
            {!collapsed.has(b.key) && b.tasks.map((t) => <TaskItem key={t.id} task={t} selected={t.id === selectedTaskId} onSelect={selectTask} showList />)}
          </div>
        ))}
      </div>
    )
  }

  // ---------- 普通列表 ----------
  return <NormalList tasks={tasks} title={title} sort={sort} groupBy={groupBy} showCompleted={showCompleted} selection={selection} collapsed={collapsed} toggle={toggle} drag={{ dragId, setDragId, overId, setOverId, overAfter, setOverAfter }} reorderTasks={reorderTasks} />
}

interface DragState {
  dragId: string | null
  setDragId: (v: string | null) => void
  overId: string | null
  setOverId: (v: string | null) => void
  overAfter: boolean
  setOverAfter: (v: boolean) => void
}

function NormalList({
  tasks,
  title,
  sort,
  groupBy,
  showCompleted,
  selection,
  collapsed,
  toggle,
  drag,
  reorderTasks,
}: Props & { collapsed: Set<string>; toggle: (k: string) => void; drag: DragState; reorderTasks: (ids: string[]) => void }) {
  const { selectedTaskId, selectTask, lists, tags } = useStore()
  const pending = useMemo(() => sortTasks(tasks.filter((t) => !t.completed), sort), [tasks, sort])
  const done = useMemo(() => [...tasks.filter((t) => t.completed)].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')), [tasks])
  const groups = useMemo(() => groupTasks(pending, groupBy, lists, tags), [pending, groupBy, lists, tags])
  const manual = sort === 'manual'
  const showList = selection.type !== 'list'

  const showDone = showCompleted && done.length > 0
  if (pending.length === 0 && !showDone) return <EmptyState text="没有任务" kind="tasks" />

  // ---------- 拖拽排序 ----------
  const onDragStart = (e: React.DragEvent, id: string) => {
    drag.setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
  const onDragOver = (e: React.DragEvent, id: string) => {
    if (!drag.dragId || drag.dragId === id) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const after = e.clientY - r.top > r.height / 2
    if (drag.overId !== id) drag.setOverId(id)
    if (drag.overAfter !== after) drag.setOverAfter(after)
  }
  const onDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    const from = drag.dragId
    if (!from || from === id) return
    const ids = pending.map((t) => t.id).filter((x) => x !== from)
    const idx = ids.indexOf(id)
    ids.splice(idx + (drag.overAfter ? 1 : 0), 0, from)
    reorderTasks(ids)
    onDragEnd()
  }
  const onDragEnd = () => {
    drag.setDragId(null)
    drag.setOverId(null)
  }

  const renderTask = (t: Task) => (
    <TaskItem
      key={t.id}
      task={t}
      selected={t.id === selectedTaskId}
      onSelect={selectTask}
      showList={showList}
      draggable={manual}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`${drag.dragId === t.id ? 'dragging' : ''} ${drag.overId === t.id ? (drag.overAfter ? 'drop-after' : 'drop-before') : ''}`}
    />
  )

  return (
    <div className="tk-list">
      {groups.map((g) => {
        const key = g.key
        const label = groupBy === 'none' ? title : g.label
        const isCollapsed = collapsed.has(key)
        return (
          <div key={key} className="tk-group">
            <GroupHeader label={label} count={g.tasks.length} color={groupBy === 'none' ? undefined : g.color} collapsed={isCollapsed} onToggle={() => toggle(key)} />
            {!isCollapsed && g.tasks.map(renderTask)}
          </div>
        )
      })}
      {showDone && (
        <div className="tk-group tk-done">
          <GroupHeader label="已完成" count={done.length} collapsed={collapsed.has('__done')} onToggle={() => toggle('__done')} />
          {!collapsed.has('__done') && done.map((t) => <TaskItem key={t.id} task={t} selected={t.id === selectedTaskId} onSelect={selectTask} showList={showList} />)}
        </div>
      )}
    </div>
  )
}
