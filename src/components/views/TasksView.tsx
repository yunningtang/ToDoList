import { useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, Check, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pencil, Trash2 } from 'lucide-react'
import Popover, { MenuDivider, MenuItem, MenuTitle, usePopover } from '../common/Popover'
import Toggle from '../common/Toggle'
import QuickAdd from '../common/QuickAdd'
import TaskDetail from '../common/TaskDetail'
import { ConfirmModal } from '../common/Modal'
import { getListPref, useStore } from '../../store/useStore'
import type { GroupKey, ListViewMode, SortKey, Task } from '../../store/types'
import { selectionTitle, tasksForSelection } from '../../utils/task'
import { addDays, today } from '../../utils/date'
import Sidebar from './tasks/Sidebar'
import ListMode from './tasks/ListMode'
import KanbanMode from './tasks/KanbanMode'
import TimelineMode from './tasks/TimelineMode'
import { ListModal } from './tasks/EditModals'
import { isTyping, prefKey } from './tasks/helpers'
import '../../styles/tasks.css'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'manual', label: '手动' },
  { key: 'date', label: '日期' },
  { key: 'priority', label: '优先级' },
  { key: 'title', label: '标题' },
]
const MODES: { key: ListViewMode; label: string }[] = [
  { key: 'list', label: '列表视图' },
  { key: 'kanban', label: '看板视图' },
  { key: 'timeline', label: '时间线视图' },
]
const GROUPS: { key: GroupKey; label: string }[] = [
  { key: 'none', label: '无' },
  { key: 'date', label: '日期' },
  { key: 'priority', label: '优先级' },
  { key: 'tag', label: '标签' },
  { key: 'list', label: '清单' },
]

/** 任务视图：左侧清单栏 + 中间任务列表 + 右侧详情 */
export default function TasksView() {
  const { tasks, lists, tags, filters, selection, selectedTaskId, selectTask, listPrefs, setListPref, requestDeleteTask, deleteList, emptyTrash, toast } = useStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const sortMenu = usePopover()
  const moreMenu = usePopover()
  const [editList, setEditList] = useState(false)
  const [confirm, setConfirm] = useState<'deleteList' | 'emptyTrash' | null>(null)

  const key = prefKey(selection)
  const pref = getListPref(listPrefs, key)
  const title = selectionTitle(selection, lists, tags, filters)
  const isTrash = selection.type === 'smart' && selection.id === 'trash'
  const isCompleted = selection.type === 'smart' && selection.id === 'completed'
  const currentList = selection.type === 'list' ? lists.find((l) => l.id === selection.id) ?? null : null
  const canQuickAdd = !isTrash && !isCompleted
  // 已完成 / 垃圾桶 只有列表模式
  const mode: ListViewMode = isTrash || isCompleted ? 'list' : pref.mode

  const selTasks = useMemo(() => tasksForSelection(tasks, selection, tags, filters), [tasks, selection, tags, filters])
  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) : undefined

  // 快速添加默认值
  const quickDefaults = useMemo<Partial<Task>>(() => {
    const d: Partial<Task> = {}
    if (selection.type === 'list') d.listId = selection.id
    if (selection.type === 'smart' && selection.id === 'today') d.dueDate = today()
    if (selection.type === 'smart' && selection.id === 'tomorrow') d.dueDate = addDays(today(), 1)
    if (selection.type === 'tag') {
      const t = tags.find((x) => x.id === selection.id)
      if (t) d.tags = [t.name]
    }
    if (selection.type === 'filter') {
      const f = filters.find((x) => x.id === selection.id)
      if (f) {
        if (f.rule.listIds.length === 1) d.listId = f.rule.listIds[0]
        if (f.rule.tags.length) d.tags = [...f.rule.tags]
        if (f.rule.priorities.length === 1) d.priority = f.rule.priorities[0]
        if (f.rule.date === 'today') d.dueDate = today()
        if (f.rule.date === 'tomorrow') d.dueDate = addDays(today(), 1)
      }
    }
    return d
  }, [selection, tags, filters])

  // 键盘：Delete 删除选中任务，Esc 取消选中
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      if (e.key === 'Escape') {
        if (selectedTaskId) selectTask(null)
        return
      }
      if (e.key === 'Delete') {
        const t = selectedTaskId ? useStore.getState().tasks.find((x) => x.id === selectedTaskId) : undefined
        if (!t || t.deleted) return
        e.preventDefault()
        requestDeleteTask(t.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedTaskId, selectTask, requestDeleteTask, toast])

  const setPref = (patch: Parameters<typeof setListPref>[1]) => setListPref(key, patch)

  return (
    <div className="tk-view">
      {sidebarOpen && <Sidebar />}

      <div className="page tk-page">
        <div className="page-header">
          <h1 className="page-title">
            <button className="icon-btn tk-collapse" title={sidebarOpen ? '收起侧栏' : '展开侧栏'} onClick={() => setSidebarOpen((v) => !v)}>
              {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
            {currentList?.emoji && <span className="tk-title-emoji">{currentList.emoji}</span>}
            {title}
          </h1>
          <div className="header-actions">
            {!isTrash && !isCompleted && (
              <button className="icon-btn" title="排序" onClick={sortMenu.show}>
                <ArrowUpDown size={20} />
              </button>
            )}
            {!isCompleted && (
              <button className="icon-btn" title="更多" onClick={moreMenu.show}>
                <MoreHorizontal size={20} />
              </button>
            )}
          </div>
        </div>

        {canQuickAdd && mode !== 'timeline' && (
          <div className="tk-quick">
            <QuickAdd placeholder={`添加任务至「${title}」`} defaults={quickDefaults} />
          </div>
        )}

        <div className="tk-body">
          {mode === 'list' && <ListMode selection={selection} tasks={selTasks} title={title} sort={pref.sort} groupBy={pref.groupBy} showCompleted={pref.showCompleted} />}
          {mode === 'kanban' && <KanbanMode selection={selection} tasks={selTasks} sort={pref.sort} groupBy={pref.groupBy} showCompleted={pref.showCompleted} quickDefaults={quickDefaults} />}
          {mode === 'timeline' && <TimelineMode tasks={selTasks} sort={pref.sort} showCompleted={pref.showCompleted} />}
        </div>
      </div>

      {selectedTask && <TaskDetail taskId={selectedTask.id} onClose={() => selectTask(null)} />}

      {/* 排序菜单 */}
      <Popover open={sortMenu.open} onClose={sortMenu.hide} anchor={sortMenu.anchor} align="end" closeOnClick>
        <MenuTitle>排序方式</MenuTitle>
        {SORTS.map((s) => (
          <MenuItem key={s.key} label={s.label} active={pref.sort === s.key} right={pref.sort === s.key ? <Check size={15} /> : undefined} onClick={() => setPref({ sort: s.key })} />
        ))}
      </Popover>

      {/* 更多菜单 */}
      <Popover open={moreMenu.open} onClose={moreMenu.hide} anchor={moreMenu.anchor} align="end" style={{ width: 240 }}>
        {!isTrash && !isCompleted && (
          <>
            <MenuTitle>视图</MenuTitle>
            <div className="tk-menu-pills">
              {MODES.map((m) => (
                <button key={m.key} className={pref.mode === m.key ? 'on' : ''} onClick={() => setPref({ mode: m.key })}>
                  {m.label.replace('视图', '')}
                </button>
              ))}
            </div>
            <MenuTitle>分组</MenuTitle>
            <div className="tk-menu-pills">
              {GROUPS.map((g) => (
                <button key={g.key} className={pref.groupBy === g.key ? 'on' : ''} onClick={() => setPref({ groupBy: g.key })}>
                  {g.label}
                </button>
              ))}
            </div>
            <MenuDivider />
            <div className="menu-item tk-menu-row" onClick={() => setPref({ showCompleted: !pref.showCompleted })}>
              <span className="grow">显示已完成</span>
              <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
                <Toggle on={pref.showCompleted} onChange={(on) => setPref({ showCompleted: on })} />
              </span>
            </div>
          </>
        )}
        {currentList && (
          <>
            <MenuDivider />
            <MenuItem
              icon={<Pencil size={16} />}
              label="编辑清单"
              onClick={() => {
                moreMenu.hide()
                setEditList(true)
              }}
            />
            <MenuItem
              icon={<Trash2 size={16} />}
              label="删除清单"
              danger
              onClick={() => {
                moreMenu.hide()
                setConfirm('deleteList')
              }}
            />
          </>
        )}
        {isTrash && (
          <MenuItem
            icon={<Trash2 size={16} />}
            label="清空垃圾桶"
            danger
            onClick={() => {
              moreMenu.hide()
              setConfirm('emptyTrash')
            }}
          />
        )}
      </Popover>

      <ListModal open={editList} list={currentList} onClose={() => setEditList(false)} />
      <ConfirmModal
        open={confirm === 'deleteList'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (currentList) {
            deleteList(currentList.id)
            toast('清单已删除')
          }
        }}
        title="删除清单"
        text={`确定删除清单「${currentList?.name ?? ''}」吗？清单内的任务将移至垃圾桶。`}
        danger
        confirmText="删除"
      />
      <ConfirmModal
        open={confirm === 'emptyTrash'}
        onClose={() => setConfirm(null)}
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
