import { useState } from 'react'
import { CalendarDays, Copy, Flag, FolderInput, GripVertical, Pin, PinOff, StickyNote, Trash2, Repeat, Bell, ListChecks, RotateCcw, XCircle } from 'lucide-react'
import Checkbox from './Checkbox'
import Popover, { MenuDivider, MenuItem, MenuTitle, usePopover } from './Popover'
import DatePicker from './DatePicker'
import { PriorityIcon } from './PriorityPicker'
import { useStore } from '../../store/useStore'
import type { Task } from '../../store/types'
import { addDays, today } from '../../utils/date'
import { dateLabel, listName, PRIORITIES, PRIORITY_META } from '../../utils/task'
import { openSticky } from '../../services/sticky'

interface Props {
  task: Task
  selected?: boolean
  onSelect?: (id: string) => void
  showList?: boolean
  showDate?: boolean
  dense?: boolean
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, id: string) => void
  onDragOver?: (e: React.DragEvent, id: string) => void
  onDrop?: (e: React.DragEvent, id: string) => void
  onDragEnd?: () => void
  className?: string
}

/** 通用任务行：复选框 + 标题 + 元信息，支持右键菜单 */
export default function TaskItem({
  task,
  selected,
  onSelect,
  showList,
  showDate = true,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  className = '',
}: Props) {
  const { toggleComplete, updateTask, requestDeleteTask, duplicateTask, restoreTask, purgeTask, lists, selectTask, toast } = useStore()
  const ctx = usePopover()
  const [dateOpen, setDateOpen] = useState(false)
  const [datePos, setDatePos] = useState<{ x: number; y: number } | null>(null)
  const [priOpen, setPriOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const { text: dateText, overdue } = dateLabel(task)
  const subDone = task.subtasks.filter((s) => s.completed).length

  return (
    <>
      <div
        className={`task-item ${task.completed ? 'done' : ''} ${selected ? 'selected' : ''} ${className}`}
        onClick={() => {
          onSelect ? onSelect(task.id) : selectTask(task.id)
        }}
        onContextMenu={ctx.showContext}
        draggable={draggable}
        onDragStart={(e) => onDragStart?.(e, task.id)}
        onDragOver={(e) => onDragOver?.(e, task.id)}
        onDrop={(e) => onDrop?.(e, task.id)}
        onDragEnd={onDragEnd}
      >
        {draggable && <GripVertical size={14} className="drag" />}
        {task.deleted ? (
          <Checkbox checked={false} priority={task.priority} onChange={() => restoreTask(task.id)} title="恢复" />
        ) : (
          <Checkbox checked={task.completed} priority={task.priority} onChange={() => toggleComplete(task.id)} />
        )}
        <span className="title">{task.title || '无标题'}</span>
        <span className="meta">
          {task.pinned && <Pin size={13} className="pin" />}
          {task.repeat !== 'none' && <Repeat size={13} />}
          {task.reminder && <Bell size={13} />}
          {task.subtasks.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <ListChecks size={13} />
              {subDone}/{task.subtasks.length}
            </span>
          )}
          {task.tags.map((t) => (
            <span key={t} className="tag-chip">
              #{t}
            </span>
          ))}
          {showList && <span>{listName(lists, task.listId)}</span>}
          {showDate && task.dueDate && <span className={`date ${overdue ? 'overdue' : task.dueDate === today() ? 'today' : ''}`}>{dateText}</span>}
        </span>
      </div>

      {/* 右键菜单 */}
      <Popover open={ctx.open} onClose={ctx.hide} position={ctx.position} anchor={ctx.anchor}>
        {task.deleted ? (
          <>
            <MenuItem icon={<RotateCcw size={16} />} label="恢复" onClick={() => { restoreTask(task.id); ctx.hide() }} />
            <MenuItem icon={<XCircle size={16} />} label="永久删除" danger onClick={() => { purgeTask(task.id); ctx.hide() }} />
          </>
        ) : (
          <>
            <MenuTitle>日期</MenuTitle>
            <div style={{ display: 'flex', gap: 4, padding: '0 4px 4px' }}>
              {[
                { l: '今天', d: today() },
                { l: '明天', d: addDays(today(), 1) },
                { l: '下周', d: addDays(today(), 7) },
              ].map((q) => (
                <button
                  key={q.l}
                  className="btn sm ghost"
                  style={{ flex: 1 }}
                  onClick={() => { updateTask(task.id, { dueDate: q.d }); ctx.hide() }}
                >
                  {q.l}
                </button>
              ))}
              <button
                className="btn sm ghost"
                style={{ flex: 1 }}
                onClick={(e) => {
                  setDatePos({ x: e.clientX, y: e.clientY })
                  setDateOpen(true)
                  ctx.hide()
                }}
              >
                <CalendarDays size={14} />
              </button>
            </div>
            <MenuTitle>优先级</MenuTitle>
            <div style={{ display: 'flex', gap: 4, padding: '0 4px 4px' }}>
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  className={`btn sm ghost ${task.priority === p ? 'active' : ''}`}
                  style={{ flex: 1, background: task.priority === p ? 'var(--accent-soft)' : undefined }}
                  title={PRIORITY_META[p].label}
                  onClick={() => { updateTask(task.id, { priority: p }); ctx.hide() }}
                >
                  <PriorityIcon priority={p} />
                </button>
              ))}
            </div>
            <MenuDivider />
            <MenuItem
              icon={task.pinned ? <PinOff size={16} /> : <Pin size={16} />}
              label={task.pinned ? '取消置顶' : '置顶'}
              onClick={() => { updateTask(task.id, { pinned: !task.pinned }); ctx.hide() }}
            />
            <MenuItem
              icon={<FolderInput size={16} />}
              label="移动到"
              hint="›"
              onClick={() => { setMoveOpen(true) }}
            />
            <MenuItem icon={<Copy size={16} />} label="创建副本" onClick={() => { duplicateTask(task.id); ctx.hide(); toast('已创建副本') }} />
            <MenuItem icon={<StickyNote size={16} />} label="打开便签" onClick={() => { ctx.hide(); openSticky(task.id) }} />
            <MenuDivider />
            <MenuItem icon={<Trash2 size={16} />} label="删除" danger onClick={() => { requestDeleteTask(task.id); ctx.hide() }} />
          </>
        )}
      </Popover>

      {/* 移动到清单（二级菜单） */}
      <Popover open={moveOpen} onClose={() => setMoveOpen(false)} position={ctx.position ? { x: ctx.position.x + 190, y: ctx.position.y + 160 } : null} closeOnClick>
        <MenuItem
          icon={<span className="color-dot" style={{ background: 'var(--text-3)' }} />}
          label="收集箱"
          active={task.listId === 'inbox'}
          onClick={() => { updateTask(task.id, { listId: 'inbox' }); ctx.hide() }}
        />
        {lists.map((l) => (
          <MenuItem
            key={l.id}
            icon={<span className="color-dot" style={{ background: l.color }} />}
            label={l.name}
            active={task.listId === l.id}
            onClick={() => { updateTask(task.id, { listId: l.id }); ctx.hide() }}
          />
        ))}
      </Popover>

      <DatePicker
        open={dateOpen}
        onClose={() => setDateOpen(false)}
        position={datePos}
        value={{ dueDate: task.dueDate, dueTime: task.dueTime, reminder: task.reminder, repeat: task.repeat }}
        onChange={(v) => updateTask(task.id, v)}
      />
      <Popover open={priOpen} onClose={() => setPriOpen(false)} position={datePos} closeOnClick>
        {PRIORITIES.map((p) => (
          <MenuItem key={p} icon={<Flag size={16} color={PRIORITY_META[p].color} />} label={PRIORITY_META[p].label} onClick={() => updateTask(task.id, { priority: p })} />
        ))}
      </Popover>
    </>
  )
}
