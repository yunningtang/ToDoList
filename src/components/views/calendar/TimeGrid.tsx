import { useEffect, useRef, useState } from 'react'
import type { Countdown, Task, TaskList } from '../../../store/types'
import { useStore } from '../../../store/useStore'
import { dayjs, DATE_FMT, formatClock, today, WEEKDAYS_SHORT } from '../../../utils/date'
import type { Dayjs } from '../../../utils/date'
import { lunarCellLabel } from '../../../utils/lunar'
import {
  clamp,
  clockRange,
  countdownColor,
  countdownsOn,
  DEFAULT_DURATION,
  dragState,
  GUTTER_W,
  HOUR_H,
  hourLabel,
  isWeekend,
  layoutTimed,
  listColor,
  snap,
  splitDay,
  taskRange,
  toTime,
  useClockFormat,
  weekLabel,
} from './calendarUtils'
import type { TimedBlock } from './calendarUtils'

export interface PendingSlot {
  date: string
  /** null 表示全天 */
  start: number | null
  end: number | null
}

interface Props {
  days: Dayjs[]
  tasksByDate: Map<string, Task[]>
  countdowns: Countdown[]
  lists: TaskList[]
  now: Dayjs
  selectedTaskId: string | null
  pending: PendingSlot | null
  onSlotClick: (date: string, start: number | null, e: React.MouseEvent) => void
  onBlockClick: (id: string) => void
  onBlockContext: (id: string, e: React.MouseEvent) => void
  onDayClick: (date: string) => void
  onMove: (id: string, patch: Partial<Task>) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

/** 周 / 日视图：全天区 + 0:00–24:00 时间网格 */
export default function TimeGrid({
  days,
  tasksByDate,
  countdowns,
  lists,
  now,
  selectedTaskId,
  pending,
  onSlotClick,
  onBlockClick,
  onBlockContext,
  onDayClick,
  onMove,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<{ date: string; start: number; end: number } | null>(null)
  const previewRef = useRef<{ date: string; start: number; end: number } | null>(null)
  const [allDayOver, setAllDayOver] = useState<string | null>(null)
  const [resizing, setResizing] = useState<{ id: string; end: number } | null>(null)
  const suppressClick = useRef(false)
  const showLunar = useStore((s) => s.settings.dateTime.showLunar)
  const h12 = useClockFormat() === '12h'

  const todayStr = today()
  const nowMin = now.hour() * 60 + now.minute()
  const todayVisible = days.some((d) => d.format(DATE_FMT) === todayStr)
  const nowTop = (nowMin / 60) * HOUR_H

  // 首次挂载：滚动到当前时间附近
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const m = dayjs().hour() * 60 + dayjs().minute()
    el.scrollTop = Math.max(0, (m / 60) * HOUR_H - el.clientHeight * 0.35)
  }, [])

  const minutesAt = (e: { clientY: number; currentTarget: EventTarget & Element }) => {
    const r = e.currentTarget.getBoundingClientRect()
    return ((e.clientY - r.top) / HOUR_H) * 60
  }

  const setPreviewIfChanged = (p: { date: string; start: number; end: number } | null) => {
    const prev = previewRef.current
    if (p && prev && p.date === prev.date && p.start === prev.start && p.end === prev.end) return
    if (!p && !prev) return
    previewRef.current = p
    setPreview(p)
  }

  const endDrag = () => {
    dragState.current = null
    setPreviewIfChanged(null)
    setAllDayOver(null)
  }

  // ---- 块拖拽 ----
  const startBlockDrag = (e: React.DragEvent, t: Task, allDay: boolean) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const { start, end } = allDay ? { start: 0, end: DEFAULT_DURATION } : taskRange(t)
    const grab = allDay ? 0 : snap(((e.clientY - rect.top) / HOUR_H) * 60)
    dragState.current = { id: t.id, grabOffset: clamp(grab, 0, end - start), duration: end - start, allDay }
    e.dataTransfer.setData('text/plain', t.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const dropStart = (e: React.DragEvent) => {
    const d = dragState.current
    if (!d) return null
    const start = clamp(snap(minutesAt(e) - d.grabOffset), 0, 1440 - d.duration)
    return { d, start, end: start + d.duration }
  }

  // ---- 调整时长 ----
  const startResize = (e: React.MouseEvent, b: TimedBlock) => {
    e.preventDefault()
    e.stopPropagation()
    const col = (e.currentTarget as HTMLElement).closest('.cal-col') as HTMLElement | null
    if (!col) return
    const top = col.getBoundingClientRect().top
    const calc = (y: number) => clamp(snap(((y - top) / HOUR_H) * 60), b.start + 15, 1440)
    const move = (ev: MouseEvent) => setResizing({ id: b.task.id, end: calc(ev.clientY) })
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      onMove(b.task.id, { endTime: toTime(calc(ev.clientY)) })
      setResizing(null)
      suppressClick.current = true
      setTimeout(() => (suppressClick.current = false), 0)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const cols = `${GUTTER_W}px repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div className="cal-tg">
      {/* 星期标题 */}
      <div className="cal-tg-head" style={{ gridTemplateColumns: cols }}>
        <div className="cal-wk">{weekLabel(days)}</div>
        {days.map((d) => (
          <div key={d.format(DATE_FMT)} className={`cal-dow ${d.format(DATE_FMT) === todayStr ? 'today' : ''}`}>
            {WEEKDAYS_SHORT[d.day()]}
          </div>
        ))}
      </div>

      {/* 日期数字 + 全天区 */}
      <div className="cal-allday" style={{ gridTemplateColumns: cols }}>
        <div className="cal-allday-gutter" />
        {days.map((d) => {
          const ds = d.format(DATE_FMT)
          const isToday = ds === todayStr
          const { allDay } = splitDay(tasksByDate.get(ds) ?? [])
          const cds = countdownsOn(countdowns, ds)
          return (
            <div
              key={ds}
              className={`cal-allday-cell ${isWeekend(d) ? 'weekend' : ''} ${allDayOver === ds ? 'over' : ''}`}
              onClick={(e) => {
                if (suppressClick.current) return
                onSlotClick(ds, null, e)
              }}
              onDragOver={(e) => {
                if (!dragState.current) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setPreviewIfChanged(null)
                if (allDayOver !== ds) setAllDayOver(ds)
              }}
              onDragLeave={(e) => {
                if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setAllDayOver((v) => (v === ds ? null : v))
              }}
              onDrop={(e) => {
                e.preventDefault()
                const d2 = dragState.current
                if (d2) onMove(d2.id, { dueDate: ds, dueTime: null, endTime: null })
                endDrag()
              }}
            >
              <div className="cal-daynum-row">
                <button
                  className={`cal-daynum ${isToday ? 'today' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDayClick(ds)
                  }}
                  title={d.format('M月D日')}
                >
                  {d.date()}
                </button>
                {showLunar &&
                  (() => {
                    const l = lunarCellLabel(d)
                    return <span className={`cal-lunar ${l.accent ? 'accent' : ''}`}>{l.text}</span>
                  })()}
              </div>
              <div className="cal-allday-items">
                {cds.map((c) => (
                  <div key={c.id} className="cal-pill cd" style={{ background: countdownColor(c) }} title={c.title}>
                    <span className="cal-pill-icon">{c.icon}</span>
                    <span className="cal-pill-text">{c.title || '纪念日'}</span>
                  </div>
                ))}
                {allDay.map((t) => (
                  <div
                    key={t.id}
                    className={`cal-pill task ${t.completed ? 'done' : ''} ${selectedTaskId === t.id ? 'selected' : ''}`}
                    style={{ background: listColor(lists, t.listId) }}
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation()
                      startBlockDrag(e, t, true)
                    }}
                    onDragEnd={endDrag}
                    onClick={(e) => {
                      e.stopPropagation()
                      onBlockClick(t.id)
                    }}
                    onContextMenu={(e) => onBlockContext(t.id, e)}
                    title={t.title}
                  >
                    <span className="cal-pill-text">{t.title || '无标题'}</span>
                  </div>
                ))}
                {pending?.date === ds && pending.start === null && <div className="cal-pill pending">新任务</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* 时间网格 */}
      <div className="cal-tg-scroll" ref={scrollRef}>
        <div className="cal-tg-body" style={{ gridTemplateColumns: cols, height: HOUR_H * 24, ['--hour-h' as string]: `${HOUR_H}px` }}>
          <div className="cal-gutter">
            {HOURS.filter((h) => h > 0).map((h) => {
              const hide = todayVisible && Math.abs(h * 60 - nowMin) < 22
              return (
                <span key={h} className={`cal-hour ${hide ? 'hide' : ''} ${h12 ? 'h12' : ''}`} style={{ top: h * HOUR_H }}>
                  {hourLabel(h)}
                </span>
              )
            })}
            {todayVisible && (
              <span className="cal-now-label" style={{ top: nowTop }}>
                {formatClock(now.format('HH:mm'))}
              </span>
            )}
          </div>

          {days.map((d) => {
            const ds = d.format(DATE_FMT)
            const isToday = ds === todayStr
            const { timed } = splitDay(tasksByDate.get(ds) ?? [])
            const blocks = layoutTimed(timed)
            return (
              <div
                key={ds}
                className={`cal-col ${isWeekend(d) ? 'weekend' : ''} ${isToday ? 'today' : ''}`}
                onClick={(e) => {
                  if (suppressClick.current) return
                  const m = clamp(Math.floor(minutesAt(e) / 30) * 30, 0, 1440 - DEFAULT_DURATION)
                  onSlotClick(ds, m, e)
                }}
                onDragOver={(e) => {
                  const r = dropStart(e)
                  if (!r) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (allDayOver) setAllDayOver(null)
                  setPreviewIfChanged({ date: ds, start: r.start, end: r.end })
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const r = dropStart(e)
                  if (r) onMove(r.d.id, { dueDate: ds, dueTime: toTime(r.start), endTime: toTime(r.end) })
                  endDrag()
                }}
              >
                {blocks.map((b) => {
                  const end = resizing?.id === b.task.id ? resizing.end : b.end
                  const t = b.task
                  const color = listColor(lists, t.listId)
                  const height = Math.max(18, ((end - b.start) / 60) * HOUR_H - 2)
                  const width = 100 / b.cols
                  return (
                    <div
                      key={t.id}
                      className={`cal-block ${t.completed ? 'done' : ''} ${selectedTaskId === t.id ? 'selected' : ''} ${resizing?.id === t.id ? 'resizing' : ''} ${height < 34 ? 'compact' : ''}`}
                      style={{
                        top: (b.start / 60) * HOUR_H + 1,
                        height,
                        left: `calc(${b.col * width}% + 2px)`,
                        width: `calc(${width}% - ${b.col === b.cols - 1 ? 6 : 3}px)`,
                        ['--block-color' as string]: color,
                      }}
                      draggable
                      onDragStart={(e) => startBlockDrag(e, t, false)}
                      onDragEnd={endDrag}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (suppressClick.current) return
                        onBlockClick(t.id)
                      }}
                      onContextMenu={(e) => onBlockContext(t.id, e)}
                      title={`${t.title}  ${clockRange(toTime(b.start), toTime(end))}`}
                    >
                      <div className="cal-block-title">{t.title || '无标题'}</div>
                      <div className="cal-block-time">{clockRange(toTime(b.start), toTime(end))}</div>
                      <div className="cal-block-resize" onMouseDown={(e) => startResize(e, b)} />
                    </div>
                  )
                })}
                {preview?.date === ds && (
                  <div
                    className="cal-block ghost"
                    style={{ top: (preview.start / 60) * HOUR_H + 1, height: Math.max(18, ((preview.end - preview.start) / 60) * HOUR_H - 2) }}
                  >
                    <div className="cal-block-time">{clockRange(toTime(preview.start), toTime(preview.end))}</div>
                  </div>
                )}
                {pending?.date === ds && pending.start !== null && pending.end !== null && (
                  <div
                    className="cal-block pending"
                    style={{ top: (pending.start / 60) * HOUR_H + 1, height: Math.max(18, ((pending.end - pending.start) / 60) * HOUR_H - 2) }}
                  >
                    <div className="cal-block-title">新任务</div>
                    <div className="cal-block-time">{clockRange(toTime(pending.start), toTime(pending.end))}</div>
                  </div>
                )}
                {isToday && <span className="cal-now-dot" style={{ top: nowTop }} />}
              </div>
            )
          })}

          {todayVisible && <div className="cal-now-line" style={{ top: nowTop, left: GUTTER_W }} />}
        </div>
      </div>
    </div>
  )
}
