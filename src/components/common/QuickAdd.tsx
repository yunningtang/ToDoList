import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Mic, Plus, X } from 'lucide-react'
import DatePicker from './DatePicker'
import VoiceTaskModal from '../ai/VoiceTaskModal'
import PriorityPicker, { PriorityIcon } from './PriorityPicker'
import { usePopover } from './Popover'
import { useStore } from '../../store/useStore'
import type { Priority, Task } from '../../store/types'
import { humanDate } from '../../utils/date'
import { parseQuickAdd } from '../../utils/task'

interface Props {
  placeholder?: string
  defaults?: Partial<Task>
  onAdded?: (id: string) => void
  autoFocus?: boolean
}

/** 快速添加输入框：支持智能解析（今天/明天/周x/#标签/!高/~清单/HH:mm） */
export default function QuickAdd({ placeholder = '添加任务', defaults = {}, onAdded, autoFocus }: Props) {
  const { addTask, addTag, lists, settings } = useStore()
  const [text, setText] = useState('')
  const [date, setDate] = useState<{ dueDate: string | null; dueTime: string | null; reminder: string | null; repeat: Task['repeat'] }>({
    dueDate: null,
    dueTime: null,
    reminder: null,
    repeat: 'none',
  })
  const [priority, setPriority] = useState<Priority | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const dateBtn = usePopover()
  const priBtn = usePopover()
  const inputRef = useRef<HTMLInputElement>(null)
  const focusTick = useStore((s) => s.quickAddFocusTick)
  useEffect(() => {
    if (focusTick > 0) inputRef.current?.focus()
  }, [focusTick])

  const parsed = settings.ai.smartParse ? parseQuickAdd(text, lists) : { title: text, dueDate: null, dueTime: null, priority: null, tags: [], listId: null }

  const submit = () => {
    const title = (settings.ai.smartParse ? parsed.title : text).trim()
    if (!title) return
    for (const t of parsed.tags) addTag({ name: t })
    const id = addTask({
      ...defaults,
      title,
      dueDate: date.dueDate ?? parsed.dueDate ?? defaults.dueDate ?? null,
      dueTime: date.dueTime ?? parsed.dueTime ?? defaults.dueTime ?? null,
      reminder: date.reminder,
      repeat: date.repeat,
      priority: priority ?? parsed.priority ?? defaults.priority ?? 0,
      tags: [...(defaults.tags ?? []), ...parsed.tags],
      listId: parsed.listId ?? defaults.listId ?? 'inbox',
    })
    setText('')
    setDate({ dueDate: null, dueTime: null, reminder: null, repeat: 'none' })
    setPriority(null)
    onAdded?.(id)
  }

  const effDate = date.dueDate ?? parsed.dueDate
  const effTime = date.dueTime ?? parsed.dueTime
  const effPri = priority ?? parsed.priority ?? 0

  return (
    <div className="quick-add">
      <Plus size={18} color="var(--text-3)" />
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') setText('')
        }}
      />
      {effDate && (
        <span className="chip" onClick={dateBtn.show} style={{ cursor: 'pointer' }}>
          <CalendarDays size={12} />
          {humanDate(effDate, effTime)}
          <X
            size={12}
            onClick={(e) => {
              e.stopPropagation()
              setDate({ dueDate: null, dueTime: null, reminder: null, repeat: 'none' })
              if (parsed.dueDate) setText(parsed.title)
            }}
          />
        </span>
      )}
      {parsed.tags.map((t) => (
        <span key={t} className="chip">
          #{t}
        </span>
      ))}
      {!effDate && (
        <button className="icon-btn sm" title="设置日期" onClick={dateBtn.show}>
          <CalendarDays size={16} />
        </button>
      )}
      <button className="icon-btn sm" title="优先级" onClick={priBtn.show}>
        <PriorityIcon priority={effPri} size={16} />
      </button>
      {settings.ai.enabled && (
        <button className="icon-btn sm" title="语音添加任务" onClick={() => setVoiceOpen(true)}>
          <Mic size={16} />
        </button>
      )}
      <DatePicker open={dateBtn.open} onClose={dateBtn.hide} anchor={dateBtn.anchor} value={date} onChange={setDate} />
      <PriorityPicker open={priBtn.open} onClose={priBtn.hide} anchor={priBtn.anchor} value={effPri} onChange={setPriority} />
      <VoiceTaskModal open={voiceOpen} onClose={() => setVoiceOpen(false)} defaults={defaults} onAdded={(ids) => ids.forEach((id) => onAdded?.(id))} />
    </div>
  )
}
