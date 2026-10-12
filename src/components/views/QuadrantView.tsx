import { useMemo, useState } from 'react'
import { ChevronDown, Eye, EyeOff, Layers, MoreHorizontal, Plus, Settings2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Priority, Task } from '../../store/types'
import { activeTasks, groupTasks, PRIORITIES, PRIORITY_META, quadrantOf, sortTasks } from '../../utils/task'
import TaskItem from '../common/TaskItem'
import TaskDetail from '../common/TaskDetail'
import QuickAdd from '../common/QuickAdd'
import Popover, { MenuDivider, MenuItem, MenuTitle, usePopover } from '../common/Popover'
import Modal from '../common/Modal'
import { PriorityIcon } from '../common/PriorityPicker'
import '../../styles/quadrant.css'

type Q = 1 | 2 | 3 | 4
const QUADS: { q: Q; roman: string; title: string; color: string }[] = [
  { q: 1, roman: 'I', title: '重要且紧急', color: '#F5523C' },
  { q: 2, roman: 'II', title: '重要不紧急', color: '#FFB400' },
  { q: 3, roman: 'III', title: '不重要但紧急', color: '#4772FA' },
  { q: 4, roman: 'IV', title: '不重要不紧急', color: '#2DCA8C' },
]

/** 四象限视图 */
export default function QuadrantView() {
  const { tasks, lists, tags, settings, updateSettings, selectedTaskId, selectTask, updateTask } = useStore()
  const [showCompleted, setShowCompleted] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [dropQ, setDropQ] = useState<Q | null>(null)
  const pageMenu = usePopover()

  const byQuadrant = useMemo(() => {
    const live = activeTasks(tasks).filter((t) => showCompleted || !t.completed)
    const map: Record<Q, Task[]> = { 1: [], 2: [], 3: [], 4: [] }
    for (const t of sortTasks(live, 'date')) map[quadrantOf(t, settings.quadrantRules)].push(t)
    return map
  }, [tasks, settings.quadrantRules, showCompleted])

  const groupBy = settings.quadrantGroupBy

  const onDropTo = (q: Q, e: React.DragEvent) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/task-id')
    setDropQ(null)
    if (!id) return
    const p = settings.quadrantRules[String(q) as '1'].priorities[0]
    if (p !== undefined) updateTask(id, { priority: p })
  }

  return (
    <>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">四象限</h1>
          <div className="header-actions">
            <button className="icon-btn" onClick={pageMenu.show}>
              <MoreHorizontal size={20} />
            </button>
          </div>
        </div>
        <div className="quad-grid">
          {QUADS.map((qd) => (
            <QuadrantCard
              key={qd.q}
              meta={qd}
              tasks={byQuadrant[qd.q]}
              groupBy={groupBy}
              lists={lists}
              tags={tags}
              selectedTaskId={selectedTaskId}
              onSelect={selectTask}
              dropping={dropQ === qd.q}
              onDragOver={(e) => {
                e.preventDefault()
                if (dropQ !== qd.q) setDropQ(qd.q)
              }}
              onDragLeave={() => setDropQ(null)}
              onDrop={(e) => onDropTo(qd.q, e)}
              priority={settings.quadrantRules[String(qd.q) as '1'].priorities[0] ?? 0}
              onOpenRules={() => setRulesOpen(true)}
            />
          ))}
        </div>
      </div>
      {selectedTaskId && tasks.some((t) => t.id === selectedTaskId && !t.deleted) && (
        <TaskDetail taskId={selectedTaskId} onClose={() => selectTask(null)} />
      )}

      <Popover open={pageMenu.open} onClose={pageMenu.hide} anchor={pageMenu.anchor} align="end">
        <MenuTitle>分组方式</MenuTitle>
        {(
          [
            ['none', '不分组'],
            ['list', '按清单'],
            ['date', '按日期'],
          ] as const
        ).map(([k, l]) => (
          <MenuItem key={k} icon={<Layers size={16} />} label={l} active={groupBy === k} onClick={() => { updateSettings({ quadrantGroupBy: k }); pageMenu.hide() }} />
        ))}
        <MenuDivider />
        <MenuItem
          icon={showCompleted ? <EyeOff size={16} /> : <Eye size={16} />}
          label={showCompleted ? '隐藏已完成' : '显示已完成'}
          onClick={() => { setShowCompleted(!showCompleted); pageMenu.hide() }}
        />
        <MenuItem icon={<Settings2 size={16} />} label="象限规则" onClick={() => { setRulesOpen(true); pageMenu.hide() }} />
      </Popover>

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </>
  )
}

function QuadrantCard({
  meta,
  tasks,
  groupBy,
  lists,
  tags,
  selectedTaskId,
  onSelect,
  dropping,
  onDragOver,
  onDragLeave,
  onDrop,
  priority,
  onOpenRules,
}: {
  meta: (typeof QUADS)[number]
  tasks: Task[]
  groupBy: 'none' | 'list' | 'date'
  lists: ReturnType<typeof useStore.getState>['lists']
  tags: ReturnType<typeof useStore.getState>['tags']
  selectedTaskId: string | null
  onSelect: (id: string | null) => void
  dropping: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  priority: Priority
  onOpenRules: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const menu = usePopover()
  const { toggleComplete } = useStore()
  const groups = groupTasks(tasks, groupBy, lists, tags)

  return (
    <section
      className={`quad-card ${dropping ? 'drop-target' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="quad-head">
        <span className="quad-badge" style={{ background: meta.color }}>
          {meta.roman}
        </span>
        <span className="quad-title" style={{ color: meta.color }}>
          {meta.title}
        </span>
        <div className="actions">
          <button className="icon-btn" title="添加任务" onClick={() => setAdding(true)}>
            <Plus size={20} />
          </button>
          <button className="icon-btn" onClick={menu.show}>
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>
      {adding && (
        <div className="quad-add">
          <QuickAdd
            autoFocus
            placeholder={`添加任务至「${meta.title}」`}
            defaults={{ priority }}
            onAdded={() => setAdding(false)}
          />
        </div>
      )}
      <div className="quad-body">
        {tasks.length === 0 && !adding && <div className="quad-empty">没有任务</div>}
        {groups.map((g) => (
          <div key={g.key}>
            {g.label && (
              <div className={`task-group-title ${collapsed[g.key] ? 'collapsed' : ''}`} onClick={() => setCollapsed({ ...collapsed, [g.key]: !collapsed[g.key] })}>
                <ChevronDown size={14} className="chev" />
                {g.label}
                <span className="count">{g.tasks.length}</span>
              </div>
            )}
            {!collapsed[g.key] &&
              g.tasks.map((t, i) => (
                <div key={t.id}>
                  <TaskItem
                    task={t}
                    selected={selectedTaskId === t.id}
                    onSelect={onSelect}
                    showDate={groupBy !== 'date' && !!t.dueDate}
                    showList
                    draggable
                    onDragStart={(e, id) => {
                      e.dataTransfer.setData('text/task-id', id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                  />
                  {i < g.tasks.length - 1 && <div className="task-sep" />}
                </div>
              ))}
          </div>
        ))}
      </div>
      <Popover open={menu.open} onClose={menu.hide} anchor={menu.anchor} align="end" closeOnClick>
        <MenuItem icon={<Plus size={16} />} label="添加任务" onClick={() => setAdding(true)} />
        <MenuItem
          icon={<PriorityIcon priority={priority} />}
          label={`规则：${PRIORITY_META[priority].label}`}
          hint="修改"
          onClick={onOpenRules}
        />
        <MenuDivider />
        <MenuItem
          label="全部完成"
          disabled={tasks.filter((t) => !t.completed).length === 0}
          onClick={() => tasks.filter((t) => !t.completed).forEach((t) => toggleComplete(t.id))}
        />
      </Popover>
    </section>
  )
}

function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings, toast } = useStore()
  const rules = settings.quadrantRules
  const toggle = (q: Q, p: Priority) => {
    const key = String(q) as '1'
    const cur = rules[key].priorities
    const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]
    // 一个优先级只能属于一个象限：从其他象限移除
    const patch: any = { [key]: { priorities: next } }
    for (const k of ['1', '2', '3', '4'] as const) {
      if (k !== key && rules[k].priorities.includes(p)) patch[k] = { priorities: rules[k].priorities.filter((x) => x !== p) }
    }
    updateSettings({ quadrantRules: patch })
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="象限规则"
      width={560}
      footer={
        <>
          <button
            className="btn ghost"
            onClick={() => {
              updateSettings({ quadrantRules: { '1': { priorities: [5] }, '2': { priorities: [3] }, '3': { priorities: [1] }, '4': { priorities: [0] } } })
              toast('已恢复默认规则')
            }}
          >
            恢复默认
          </button>
          <button className="btn primary" onClick={onClose}>
            完成
          </button>
        </>
      }
    >
      <div style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 6 }}>任务按优先级划分到四个象限，每个优先级只能属于一个象限。</div>
      <div className="quad-rules">
        {QUADS.map((qd) => (
          <div className="row" key={qd.q}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="quad-badge" style={{ background: qd.color }}>
                {qd.roman}
              </span>
              <span style={{ fontWeight: 600, color: qd.color }}>{qd.title}</span>
            </div>
            <div className="pri-opts">
              {PRIORITIES.map((p) => (
                <button key={p} className={`pri-opt ${rules[String(qd.q) as '1'].priorities.includes(p) ? 'on' : ''}`} onClick={() => toggle(qd.q, p)}>
                  <PriorityIcon priority={p} size={14} />
                  {PRIORITY_META[p].short}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>提示：拖动任务到其他象限会自动更新其优先级。</div>
    </Modal>
  )
}
