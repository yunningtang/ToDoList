import { useState } from 'react'
import type { Countdown, Task, TaskList } from '../../../store/types'
import { useStore } from '../../../store/useStore'
import { DATE_FMT, formatClock, monthGrid, today, WEEKDAYS_SHORT } from '../../../utils/date'
import type { Dayjs } from '../../../utils/date'
import { lunarCellLabel } from '../../../utils/lunar'
import { countdownColor, countdownsOn, DEFAULT_DURATION, dragState, isWeekend, listColor, splitDay, useClockFormat } from './calendarUtils'

interface Props {
  cursor: string
  weekStart: 0 | 1 | 6
  showWeekNumber: boolean
  tasksByDate: Map<string, Task[]>
  countdowns: Countdown[]
  lists: TaskList[]
  selectedTaskId: string | null
  pendingDate: string | null
  onCellClick: (date: string, e: React.MouseEvent) => void
  onBlockClick: (id: string) => void
  onBlockContext: (id: string, e: React.MouseEvent) => void
  onMore: (date: string, anchor: HTMLElement) => void
  onDayClick: (date: string) => void
  onMove: (id: string, patch: Partial<Task>) => void
}

const MAX_ITEMS = 4

/** 月视图：6 行网格 */
export default function MonthGrid({
  cursor,
  weekStart,
  showWeekNumber,
  tasksByDate,
  countdowns,
  lists,
  selectedTaskId,
  pendingDate,
  onCellClick,
  onBlockClick,
  onBlockContext,
  onMore,
  onDayClick,
  onMove,
}: Props) {
  const cells = monthGrid(cursor, weekStart)
  const month = cursor.slice(0, 7)
  const todayStr = today()
  const [over, setOver] = useState<string | null>(null)
  const showLunar = useStore((s) => s.settings.dateTime.showLunar)
  useClockFormat()
  const dowOrder = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7)
  const rows = Array.from({ length: 6 }, (_, r) => cells.slice(r * 7, r * 7 + 7))
  const cols = `${showWeekNumber ? '44px ' : ''}repeat(7, minmax(0, 1fr))`

  const startDrag = (e: React.DragEvent, t: Task) => {
    e.stopPropagation()
    dragState.current = { id: t.id, grabOffset: 0, duration: DEFAULT_DURATION, allDay: !t.dueTime }
    e.dataTransfer.setData('text/plain', t.id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const endDrag = () => {
    dragState.current = null
    setOver(null)
  }

  const renderCell = (d: Dayjs) => {
    const ds = d.format(DATE_FMT)
    const isToday = ds === todayStr
    const other = !ds.startsWith(month)
    const { allDay, timed } = splitDay(tasksByDate.get(ds) ?? [])
    const cds = countdownsOn(countdowns, ds)
    const total = cds.length + allDay.length + timed.length
    const limit = total > MAX_ITEMS ? MAX_ITEMS - 1 : MAX_ITEMS
    const items: React.ReactNode[] = []
    for (const c of cds) {
      if (items.length >= limit) break
      items.push(
        <div key={c.id} className="cal-pill cd sm" style={{ background: countdownColor(c) }} title={c.title}>
          <span className="cal-pill-icon">{c.icon}</span>
          <span className="cal-pill-text">{c.title || '纪念日'}</span>
        </div>,
      )
    }
    for (const t of allDay) {
      if (items.length >= limit) break
      items.push(
        <div
          key={t.id}
          className={`cal-pill task sm ${t.completed ? 'done' : ''} ${selectedTaskId === t.id ? 'selected' : ''}`}
          style={{ background: listColor(lists, t.listId) }}
          draggable
          onDragStart={(e) => startDrag(e, t)}
          onDragEnd={endDrag}
          onClick={(e) => {
            e.stopPropagation()
            onBlockClick(t.id)
          }}
          onContextMenu={(e) => onBlockContext(t.id, e)}
          title={t.title}
        >
          <span className="cal-pill-text">{t.title || '无标题'}</span>
        </div>,
      )
    }
    for (const t of timed) {
      if (items.length >= limit) break
      items.push(
        <div
          key={t.id}
          className={`cal-mitem ${t.completed ? 'done' : ''} ${selectedTaskId === t.id ? 'selected' : ''}`}
          draggable
          onDragStart={(e) => startDrag(e, t)}
          onDragEnd={endDrag}
          onClick={(e) => {
            e.stopPropagation()
            onBlockClick(t.id)
          }}
          onContextMenu={(e) => onBlockContext(t.id, e)}
          title={`${formatClock(t.dueTime)} ${t.title}`}
        >
          <span className="cal-mitem-dot" style={{ background: listColor(lists, t.listId) }} />
          <span className="cal-mitem-time">{formatClock(t.dueTime)}</span>
          <span className="cal-mitem-title">{t.title || '无标题'}</span>
        </div>,
      )
    }
    const rest = total - items.length
    const lunar = showLunar ? lunarCellLabel(d) : null

    return (
      <div
        key={ds}
        className={`cal-mcell ${other ? 'other' : ''} ${isWeekend(d) ? 'weekend' : ''} ${isToday ? 'today' : ''} ${over === ds ? 'over' : ''} ${pendingDate === ds ? 'pending' : ''}`}
        onClick={(e) => onCellClick(ds, e)}
        onDragOver={(e) => {
          if (!dragState.current) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          if (over !== ds) setOver(ds)
        }}
        onDragLeave={(e) => {
          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver((v) => (v === ds ? null : v))
        }}
        onDrop={(e) => {
          e.preventDefault()
          const dr = dragState.current
          if (dr) onMove(dr.id, { dueDate: ds })
          endDrag()
        }}
      >
        <div className="cal-mcell-head">
          <button
            className={`cal-daynum sm ${isToday ? 'today' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onDayClick(ds)
            }}
          >
            {d.date() === 1 && !isToday ? d.format('M月D日') : d.date()}
          </button>
          {lunar && <span className={`cal-lunar sm ${lunar.accent ? 'accent' : ''}`}>{lunar.text}</span>}
        </div>
        <div className="cal-mcell-items">
          {items}
          {pendingDate === ds && <div className="cal-pill pending sm">新任务</div>}
          {rest > 0 && (
            <button
              className="cal-more"
              onClick={(e) => {
                e.stopPropagation()
                onMore(ds, e.currentTarget)
              }}
            >
              +{rest} 更多
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="cal-month">
      <div className="cal-month-head" style={{ gridTemplateColumns: cols }}>
        {showWeekNumber && <div className="cal-wk" />}
        {dowOrder.map((w) => (
          <div key={w} className="cal-dow">
            {WEEKDAYS_SHORT[w]}
          </div>
        ))}
      </div>
      <div className="cal-month-body">
        {rows.map((row, r) => (
          <div key={r} className="cal-month-row" style={{ gridTemplateColumns: cols }}>
            {showWeekNumber && <div className="cal-wk">{row[3].isoWeek()}周</div>}
            {row.map(renderCell)}
          </div>
        ))}
      </div>
    </div>
  )
}
