import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Task } from '../../../store/types'
import { DATE_FMT, dayjs, monthGrid, today, WEEKDAYS_MIN } from '../../../utils/date'
import { PriorityIcon } from '../../common/PriorityPicker'
import { DEFAULT_DURATION, dragState } from './calendarUtils'

interface Props {
  cursor: string
  weekStart: 0 | 1 | 6
  datesWithTasks: Set<string>
  unscheduled: Task[]
  selectedTaskId: string | null
  onPick: (date: string) => void
  onSelectTask: (id: string) => void
}

/** 左侧栏：迷你月历 + 未安排日期的任务（可拖到日历上） */
export default function SidePanel({ cursor, weekStart, datesWithTasks, unscheduled, selectedTaskId, onPick, onSelectTask }: Props) {
  const [month, setMonth] = useState(cursor.slice(0, 7))
  const base = dayjs(`${month}-01`)
  const cells = monthGrid(base, weekStart)
  const todayStr = today()
  const dow = Array.from({ length: 7 }, (_, i) => WEEKDAYS_MIN[(weekStart + i) % 7])

  return (
    <aside className="cal-side">
      <div className="cal-mini">
        <div className="cal-mini-nav">
          <span className="cal-mini-title">{base.format('YYYY年M月')}</span>
          <span className="grow" />
          <button className="icon-btn sm" onClick={() => setMonth(base.subtract(1, 'month').format('YYYY-MM'))}>
            <ChevronLeft size={16} />
          </button>
          <button className="icon-btn sm" onClick={() => setMonth(base.add(1, 'month').format('YYYY-MM'))}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="cal-mini-grid">
          {dow.map((w) => (
            <div key={w} className="cal-mini-dow">
              {w}
            </div>
          ))}
          {cells.map((d) => {
            const ds = d.format(DATE_FMT)
            return (
              <button
                key={ds}
                className={`cal-mini-day ${ds.slice(0, 7) !== month ? 'other' : ''} ${ds === todayStr ? 'today' : ''} ${ds === cursor ? 'selected' : ''}`}
                onClick={() => onPick(ds)}
              >
                {d.date()}
                {datesWithTasks.has(ds) && <span className="cal-mini-dot" />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="cal-side-title">
        未安排 <span className="count">{unscheduled.length}</span>
      </div>
      <div className="cal-side-list">
        {unscheduled.length === 0 && <div className="cal-side-empty">没有待安排的任务</div>}
        {unscheduled.map((t) => (
          <div
            key={t.id}
            className={`cal-side-item ${selectedTaskId === t.id ? 'selected' : ''}`}
            draggable
            onDragStart={(e) => {
              dragState.current = { id: t.id, grabOffset: 0, duration: DEFAULT_DURATION, allDay: true }
              e.dataTransfer.setData('text/plain', t.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={() => (dragState.current = null)}
            onClick={() => onSelectTask(t.id)}
            title="拖到日历上以安排日期"
          >
            <PriorityIcon priority={t.priority} size={14} />
            <span className="cal-side-item-title">{t.title || '无标题'}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}
