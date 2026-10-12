import { useEffect, useState } from 'react'
import { CalendarDays, Clock, X } from 'lucide-react'
import Popover from '../../common/Popover'
import { today } from '../../../utils/date'
import { DEFAULT_DURATION, timeAfter } from './calendarUtils'

export interface AddInitial {
  dueDate: string
  dueTime: string | null
  endTime: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  anchor?: HTMLElement | null
  position?: { x: number; y: number } | null
  initial: AddInitial
  onSubmit: (v: { title: string; dueDate: string | null; dueTime: string | null; endTime: string | null }) => void
}

/** 日历内的轻量新建任务浮层：标题 + 日期 + 可选时间段 */
export default function AddTaskPopover({ open, onClose, anchor, position, initial, onSubmit }: Props) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(initial.dueDate)
  const [dueTime, setDueTime] = useState<string | null>(initial.dueTime)
  const [endTime, setEndTime] = useState<string | null>(initial.endTime)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setDueDate(initial.dueDate || today())
    setDueTime(initial.dueTime)
    setEndTime(initial.endTime)
  }, [open, initial.dueDate, initial.dueTime, initial.endTime])

  const submit = () => {
    const t = title.trim()
    if (!t) return
    onSubmit({ title: t, dueDate: dueDate || null, dueTime, endTime: dueTime ? endTime : null })
    onClose()
  }

  return (
    <Popover open={open} onClose={onClose} anchor={anchor} position={position} className="cal-add" placement="bottom">
      <input
        className="input"
        autoFocus
        placeholder="添加任务，按 Enter 保存"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
      />
      <div className="cal-add-row">
        <CalendarDays size={14} />
        <input type="date" className="cal-add-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        {dueTime ? (
          <>
            <Clock size={14} />
            <input
              type="time"
              className="cal-add-input"
              value={dueTime}
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                setDueTime(v)
                if (!endTime || endTime <= v) setEndTime(timeAfter(v, DEFAULT_DURATION))
              }}
            />
            <span className="cal-add-dash">-</span>
            <input type="time" className="cal-add-input" value={endTime ?? ''} onChange={(e) => e.target.value && setEndTime(e.target.value)} />
            <button
              className="icon-btn sm"
              title="改为全天"
              onClick={() => {
                setDueTime(null)
                setEndTime(null)
              }}
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            className="cal-add-link"
            onClick={() => {
              setDueTime('09:00')
              setEndTime('10:00')
            }}
          >
            全天 · 添加时间
          </button>
        )}
      </div>
      <div className="cal-add-foot">
        <span className="hint">Enter 保存 · Esc 取消</span>
        <button className="btn primary sm" onClick={submit} disabled={!title.trim()}>
          添加
        </button>
      </div>
    </Popover>
  )
}
