import { useEffect, useState } from 'react'
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Clock, Repeat, Sun, Sunrise, CalendarRange } from 'lucide-react'
import Popover from './Popover'
import { addDays, dayjs, monthGrid, today, WEEKDAYS_MIN } from '../../utils/date'
import { useStore } from '../../store/useStore'
import type { Task } from '../../store/types'

export interface DateValue {
  dueDate: string | null
  dueTime: string | null
  reminder: string | null
  repeat: Task['repeat']
}

interface Props {
  open: boolean
  onClose: () => void
  anchor?: HTMLElement | null
  position?: { x: number; y: number } | null
  value: DateValue
  onChange: (v: DateValue) => void
}

const REPEAT_LABEL: Record<Task['repeat'], string> = { none: '不重复', daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' }

/** 日期选择浮层：快捷项 + 月历 + 时间/提醒/重复 */
export default function DatePicker({ open, onClose, anchor, position, value, onChange }: Props) {
  const weekStart = useStore((s) => s.settings.dateTime.weekStart)
  const [draft, setDraft] = useState<DateValue>(value)
  const [month, setMonth] = useState(dayjs(value.dueDate ?? today()).startOf('month'))

  useEffect(() => {
    if (open) {
      setDraft(value)
      setMonth(dayjs(value.dueDate ?? today()).startOf('month'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const commit = (v: DateValue, close = false) => {
    setDraft(v)
    onChange(v)
    if (close) onClose()
  }

  const t0 = today()
  const nextMonday = (() => {
    const d = dayjs(t0)
    const delta = ((1 - d.day() + 7) % 7) || 7
    return d.add(delta, 'day').format('YYYY-MM-DD')
  })()
  const dows = Array.from({ length: 7 }, (_, i) => WEEKDAYS_MIN[(weekStart + i) % 7])
  const grid = monthGrid(month, weekStart)

  return (
    <Popover open={open} onClose={onClose} anchor={anchor} position={position} className="datepicker">
      <div className="quick">
        <button onClick={() => commit({ ...draft, dueDate: t0 }, true)}>
          <Sun size={18} />
          今天
        </button>
        <button onClick={() => commit({ ...draft, dueDate: addDays(t0, 1) }, true)}>
          <Sunrise size={18} />
          明天
        </button>
        <button onClick={() => commit({ ...draft, dueDate: nextMonday }, true)}>
          <CalendarRange size={18} />
          下周一
        </button>
        <button onClick={() => commit({ ...draft, dueDate: addDays(t0, 7) }, true)}>
          <CalendarDays size={18} />
          7天后
        </button>
      </div>
      <div className="nav">
        <button className="icon-btn sm" onClick={() => setMonth(month.subtract(1, 'month'))}>
          <ChevronLeft size={16} />
        </button>
        <span>{month.format('YYYY年M月')}</span>
        <button className="icon-btn sm" onClick={() => setMonth(month.add(1, 'month'))}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid">
        {dows.map((d) => (
          <div key={d} className="dow">
            {d}
          </div>
        ))}
        {grid.map((d) => {
          const ds = d.format('YYYY-MM-DD')
          return (
            <button
              key={ds}
              className={`day ${d.month() !== month.month() ? 'other' : ''} ${ds === t0 ? 'today' : ''} ${ds === draft.dueDate ? 'selected' : ''}`}
              onClick={() => commit({ ...draft, dueDate: ds })}
            >
              {d.date()}
            </button>
          )
        })}
      </div>
      <div className="opts">
        <label className="opt-row">
          <Clock size={16} color="var(--text-3)" />
          <span className="grow">时间</span>
          <input
            type="time"
            value={draft.dueTime ?? ''}
            onChange={(e) => commit({ ...draft, dueTime: e.target.value || null, dueDate: draft.dueDate ?? t0 })}
          />
        </label>
        <label className="opt-row">
          <Bell size={16} color="var(--text-3)" />
          <span className="grow">提醒</span>
          <select
            value={draft.reminder ?? ''}
            onChange={(e) => commit({ ...draft, reminder: e.target.value || null, dueDate: draft.dueDate ?? t0 })}
          >
            <option value="">无</option>
            <option value="onTime">准时</option>
            <option value="09:00">当天 09:00</option>
            <option value="-30m">提前 30 分钟</option>
            <option value="-1h">提前 1 小时</option>
            <option value="-1d">提前 1 天</option>
          </select>
        </label>
        <label className="opt-row">
          <Repeat size={16} color="var(--text-3)" />
          <span className="grow">重复</span>
          <select
            value={draft.repeat}
            onChange={(e) => commit({ ...draft, repeat: e.target.value as Task['repeat'], dueDate: draft.dueDate ?? t0 })}
          >
            {(Object.keys(REPEAT_LABEL) as Task['repeat'][]).map((k) => (
              <option key={k} value={k}>
                {REPEAT_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="footer">
        <button className="btn sm ghost" onClick={() => commit({ dueDate: null, dueTime: null, reminder: null, repeat: 'none' }, true)}>
          清除
        </button>
        <button className="btn sm primary" onClick={onClose}>
          确定
        </button>
      </div>
    </Popover>
  )
}

export { REPEAT_LABEL }
