import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Copy, ListPlus, MoreHorizontal, Pin, PinOff, Plus, Sparkles, StickyNote, Trash2, X } from 'lucide-react'
import Checkbox from './Checkbox'
import BreakdownModal from '../ai/BreakdownModal'
import Popover, { MenuDivider, MenuItem, usePopover } from './Popover'
import DatePicker from './DatePicker'
import PriorityPicker, { PriorityIcon } from './PriorityPicker'
import { useStore } from '../../store/useStore'
import { humanDate, isOverdue, dayjs } from '../../utils/date'
import { listName, PRIORITY_META } from '../../utils/task'
import { uid } from '../../utils/id'
import { openSticky } from '../../services/sticky'

interface Props {
  taskId: string
  onClose: () => void
  /** 作为嵌入面板（无外边距） */
  embedded?: boolean
}

/** 任务详情面板（右侧） */
export default function TaskDetail({ taskId, onClose, embedded }: Props) {
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId))
  const { updateTask, toggleComplete, requestDeleteTask, duplicateTask, lists, tags, addTag, toast } = useStore()
  const dateBtn = usePopover()
  const priBtn = usePopover()
  const listBtn = usePopover()
  const moreBtn = usePopover()
  const [tagInput, setTagInput] = useState('')
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const [newSub, setNewSub] = useState('')
  const [breakdownOpen, setBreakdownOpen] = useState(false)

  useEffect(() => {
    const el = titleRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [task?.title, taskId])

  if (!task) return null

  const dateText = task.dueDate ? humanDate(task.dueDate, task.dueTime) : '设置日期'
  const overdue = isOverdue(task.dueDate) && !task.completed

  const addTagToTask = (name: string) => {
    const n = name.trim().replace(/^#/, '')
    if (!n) return
    addTag({ name: n })
    if (!task.tags.includes(n)) updateTask(task.id, { tags: [...task.tags, n] })
    setTagInput('')
  }

  const suggestions = tags.filter((t) => !task.tags.includes(t.name) && (!tagInput || t.name.includes(tagInput))).slice(0, 6)

  return (
    <div className={`task-detail ${embedded ? 'embedded' : ''}`} style={embedded ? { margin: 0, width: '100%', borderRadius: 0 } : undefined}>
      <div className="td-head">
        <Checkbox checked={task.completed} priority={task.priority} onChange={() => toggleComplete(task.id)} />
        <button className={`date-btn ${task.dueDate ? 'set' : ''} ${overdue ? 'overdue' : ''}`} onClick={dateBtn.show}>
          <CalendarDays size={16} />
          {dateText}
          {task.repeat !== 'none' && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>· 重复</span>}
        </button>
        <span style={{ flex: 1 }} />
        <button className="icon-btn" title="AI 拆解步骤" onClick={() => setBreakdownOpen(true)}>
          <Sparkles size={18} />
        </button>
        <button className="icon-btn" title={PRIORITY_META[task.priority].label} onClick={priBtn.show}>
          <PriorityIcon priority={task.priority} size={18} />
        </button>
        <button className="icon-btn" onClick={moreBtn.show}>
          <MoreHorizontal size={18} />
        </button>
        <button className="icon-btn" onClick={onClose} title="关闭">
          <X size={18} />
        </button>
      </div>

      <div className="td-body">
        <textarea
          ref={titleRef}
          className={`td-title ${task.completed ? 'done' : ''}`}
          value={task.title}
          rows={1}
          placeholder="无标题"
          onChange={(e) => updateTask(task.id, { title: e.target.value.replace(/\n/g, '') })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.currentTarget.nextElementSibling as HTMLElement)?.focus()
            }
          }}
        />
        <textarea
          className="td-content"
          value={task.content}
          placeholder="描述"
          onChange={(e) => updateTask(task.id, { content: e.target.value })}
        />

        {/* 子任务 */}
        <div style={{ marginTop: 6 }}>
          {task.subtasks.map((st) => (
            <div key={st.id} className={`subtask ${st.completed ? 'done' : ''}`}>
              <Checkbox
                size="sm"
                checked={st.completed}
                onChange={() => updateTask(task.id, { subtasks: task.subtasks.map((x) => (x.id === st.id ? { ...x, completed: !x.completed } : x)) })}
              />
              <input
                value={st.title}
                onChange={(e) => updateTask(task.id, { subtasks: task.subtasks.map((x) => (x.id === st.id ? { ...x, title: e.target.value } : x)) })}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !st.title) {
                    e.preventDefault()
                    updateTask(task.id, { subtasks: task.subtasks.filter((x) => x.id !== st.id) })
                  }
                }}
              />
              <button className="icon-btn sm rm" onClick={() => updateTask(task.id, { subtasks: task.subtasks.filter((x) => x.id !== st.id) })}>
                <X size={14} />
              </button>
            </div>
          ))}
          <div className="add-sub">
            <Plus size={16} />
            <input
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14 }}
              placeholder="添加子任务"
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSub.trim()) {
                  updateTask(task.id, { subtasks: [...task.subtasks, { id: uid('sub'), title: newSub.trim(), completed: false }] })
                  setNewSub('')
                }
              }}
            />
          </div>
        </div>

        {/* 标签 */}
        <div className="tag-row">
          {task.tags.map((t) => (
            <span key={t} className="tag" style={{ background: (tags.find((x) => x.name === t)?.color ?? 'var(--accent)') + '22', color: tags.find((x) => x.name === t)?.color ?? 'var(--accent)' }}>
              #{t}
              <button onClick={() => updateTask(task.id, { tags: task.tags.filter((x) => x !== t) })}>
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            placeholder="添加标签"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTagToTask(tagInput)
              if (e.key === 'Backspace' && !tagInput && task.tags.length) updateTask(task.id, { tags: task.tags.slice(0, -1) })
            }}
          />
        </div>
        {tagInput && suggestions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {suggestions.map((t) => (
              <button key={t.id} className="btn sm pill" onClick={() => addTagToTask(t.name)}>
                #{t.name}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 24, fontSize: 12, color: 'var(--text-3)' }}>
          创建于 {dayjs(task.createdAt).format('YYYY年M月D日 HH:mm')}
          {task.completedAt && ` · 完成于 ${dayjs(task.completedAt).format('M月D日 HH:mm')}`}
        </div>
      </div>

      <div className="td-foot">
        <button className="list-btn" onClick={listBtn.show}>
          <span className="color-dot" style={{ background: lists.find((l) => l.id === task.listId)?.color ?? 'var(--text-3)' }} />
          {listName(lists, task.listId)}
        </button>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="icon-btn" title="打开便签" onClick={() => openSticky(task.id)}>
            <StickyNote size={17} />
          </button>
          <button className="icon-btn" title="删除" onClick={() => { requestDeleteTask(task.id); onClose() }}>
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      <DatePicker
        open={dateBtn.open}
        onClose={dateBtn.hide}
        anchor={dateBtn.anchor}
        value={{ dueDate: task.dueDate, dueTime: task.dueTime, reminder: task.reminder, repeat: task.repeat }}
        onChange={(v) => updateTask(task.id, v)}
      />
      <PriorityPicker open={priBtn.open} onClose={priBtn.hide} anchor={priBtn.anchor} value={task.priority} onChange={(p) => updateTask(task.id, { priority: p })} />
      <Popover open={listBtn.open} onClose={listBtn.hide} anchor={listBtn.anchor} placement="top" closeOnClick>
        <MenuItem icon={<span className="color-dot" style={{ background: 'var(--text-3)' }} />} label="收集箱" active={task.listId === 'inbox'} onClick={() => updateTask(task.id, { listId: 'inbox' })} />
        {lists.map((l) => (
          <MenuItem key={l.id} icon={<span className="color-dot" style={{ background: l.color }} />} label={l.name} active={task.listId === l.id} onClick={() => updateTask(task.id, { listId: l.id })} />
        ))}
      </Popover>
      <Popover open={moreBtn.open} onClose={moreBtn.hide} anchor={moreBtn.anchor} align="end" closeOnClick>
        <MenuItem icon={task.pinned ? <PinOff size={16} /> : <Pin size={16} />} label={task.pinned ? '取消置顶' : '置顶'} onClick={() => updateTask(task.id, { pinned: !task.pinned })} />
        <MenuItem icon={<ListPlus size={16} />} label="添加子任务" onClick={() => updateTask(task.id, { subtasks: [...task.subtasks, { id: uid('sub'), title: '', completed: false }] })} />
        <MenuItem icon={<Copy size={16} />} label="创建副本" onClick={() => { duplicateTask(task.id); toast('已创建副本') }} />
        <MenuDivider />
        <MenuItem icon={<Trash2 size={16} />} label="删除" danger onClick={() => { requestDeleteTask(task.id); onClose() }} />
      </Popover>
      <BreakdownModal open={breakdownOpen} onClose={() => setBreakdownOpen(false)} taskId={task.id} />
    </div>
  )
}
