import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import Popover, { MenuItem, usePopover } from '../../common/Popover'
import Checkbox from '../../common/Checkbox'
import { useStore } from '../../../store/useStore'
import type { SortKey, Task } from '../../../store/types'
import { sortTasks } from '../../../utils/task'
import { dayjs, formatClock, getTimeFormat, setTimeFormat, today, WEEKDAYS_MIN } from '../../../utils/date'
import { DRAG_TASK, taskColor } from './helpers'

type Scale = 'day' | 'week' | 'month'
const SCALE_WIDTH: Record<Scale, number> = { day: 160, week: 80, month: 40 }
const SCALE_LABEL: Record<Scale, string> = { day: '日', week: '周', month: '月' }
const RANGE = 30 // 今天前后各 30 天
const ROW_H = 36
const ROW_GAP = 6
const TOP_PAD = 12

interface Props {
  tasks: Task[]
  sort: SortKey
  showCompleted: boolean
}

export default function TimelineMode({ tasks, sort, showCompleted }: Props) {
  const { lists, selectedTaskId, selectTask, updateTask, toggleComplete } = useStore()
  // 订阅 12/24 小时制并在渲染期同步，保证条上的时间同帧更新
  const timeFormat = useStore((s) => s.settings.dateTime.timeFormat)
  if (getTimeFormat() !== timeFormat) setTimeFormat(timeFormat)
  const [scale, setScale] = useState<Scale>('day')
  const [monthLabel, setMonthLabel] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overDay, setOverDay] = useState<string | null>(null)
  const [now, setNow] = useState(dayjs())
  const scrollRef = useRef<HTMLDivElement>(null)
  const scaleMenu = usePopover()
  const w = SCALE_WIDTH[scale]

  const days = useMemo(() => {
    const t0 = dayjs(today())
    return Array.from({ length: RANGE * 2 + 1 }, (_, i) => t0.add(i - RANGE, 'day'))
  }, [])
  const dayKeys = useMemo(() => days.map((d) => d.format('YYYY-MM-DD')), [days])
  const todayIdx = RANGE

  // 每分钟刷新"现在"线
  useEffect(() => {
    const id = setInterval(() => setNow(dayjs()), 60_000)
    return () => clearInterval(id)
  }, [])

  const visible = useMemo(() => sortTasks(showCompleted ? tasks : tasks.filter((t) => !t.completed), sort), [tasks, showCompleted, sort])
  const unscheduled = useMemo(() => visible.filter((t) => !t.dueDate), [visible])

  // 日程条：按日期列堆叠
  const { bars, rows } = useMemo(() => {
    const perDay = new Map<number, number>()
    const out: { task: Task; col: number; row: number }[] = []
    for (const t of visible) {
      if (!t.dueDate) continue
      const col = dayKeys.indexOf(t.dueDate)
      if (col < 0) continue
      const row = perDay.get(col) ?? 0
      perDay.set(col, row + 1)
      out.push({ task: t, col, row })
    }
    return { bars: out, rows: Math.max(0, ...perDay.values()) }
  }, [visible, dayKeys])

  const updateMonth = () => {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.min(days.length - 1, Math.max(0, Math.floor((el.scrollLeft + 8) / w)))
    const d = days[idx]
    setMonthLabel(d.year() === now.year() ? d.format('M月') : d.format('YYYY年M月'))
  }

  const scrollToToday = (smooth = false) => {
    const el = scrollRef.current
    if (!el) return
    const left = todayIdx * w - Math.min(2 * w, Math.floor(el.clientWidth / 3))
    if (smooth) el.scrollTo({ left, behavior: 'smooth' })
    else el.scrollLeft = left
  }

  useEffect(() => {
    scrollToToday()
    updateMonth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale])

  const scrollBy = (n: number) => scrollRef.current?.scrollBy({ left: n * w, behavior: 'smooth' })

  const gridHeight = Math.max(rows, 1) * (ROW_H + ROW_GAP) + TOP_PAD * 2
  const nowLeft = todayIdx * w + ((now.hour() * 60 + now.minute()) / 1440) * w

  const dropOn = (e: React.DragEvent, date: string) => {
    e.preventDefault()
    const id = dragId ?? e.dataTransfer.getData(DRAG_TASK)
    if (id) updateTask(id, { dueDate: date })
    setDragId(null)
    setOverDay(null)
  }
  const dragProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragId(id)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData(DRAG_TASK, id)
    },
    onDragEnd: () => {
      setDragId(null)
      setOverDay(null)
    },
  })

  return (
    <div className="tk-timeline">
      <div className="tk-tl-toolbar">
        <span className="tk-tl-month">{monthLabel}</span>
        <span className="grow" />
        <button className="btn sm pill" onClick={() => scrollToToday(true)}>
          今天
        </button>
        <button className="btn sm pill" onClick={scaleMenu.show}>
          {SCALE_LABEL[scale]}
          <ChevronDown size={14} color="var(--text-3)" />
        </button>
        <Popover open={scaleMenu.open} onClose={scaleMenu.hide} anchor={scaleMenu.anchor} align="end" closeOnClick style={{ minWidth: 120 }}>
          {(Object.keys(SCALE_LABEL) as Scale[]).map((s) => (
            <MenuItem key={s} label={SCALE_LABEL[s]} active={scale === s} onClick={() => setScale(s)} />
          ))}
        </Popover>
      </div>

      <div className="tk-tl-body">
        <div className="tk-tl-wrap">
          <button className="tk-tl-nav prev" onClick={() => scrollBy(-7)} title="前一周">
            <ChevronLeft size={16} />
          </button>
          <button className="tk-tl-nav next" onClick={() => scrollBy(7)} title="后一周">
            <ChevronRight size={16} />
          </button>
          <div className="tk-tl-scroll" ref={scrollRef} onScroll={updateMonth}>
            <div className="tk-tl-head" style={{ width: days.length * w }}>
              {days.map((d, i) => {
                const key = dayKeys[i]
                const isToday = i === todayIdx
                const weekend = d.day() === 0 || d.day() === 6
                return (
                  <div key={key} className={`tk-tl-day ${isToday ? 'today' : ''} ${weekend ? 'weekend' : ''}`} style={{ width: w }}>
                    <span className="tk-tl-daynum">{d.date() === 1 && scale !== 'month' ? d.format('M月D日') : d.date()}</span>
                    {scale !== 'month' && <span className="tk-tl-dow">周{WEEKDAYS_MIN[d.day()]}</span>}
                  </div>
                )
              })}
            </div>
            <div className="tk-tl-grid" style={{ width: days.length * w, minHeight: 'calc(100% - 44px)', height: gridHeight }}>
              {days.map((d, i) => {
                const key = dayKeys[i]
                const weekend = d.day() === 0 || d.day() === 6
                return (
                  <div
                    key={key}
                    className={`tk-tl-col ${weekend ? 'weekend' : ''} ${i === todayIdx ? 'today' : ''} ${overDay === key ? 'over' : ''}`}
                    style={{ left: i * w, width: w }}
                    onDragOver={(e) => {
                      if (!dragId) return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (overDay !== key) setOverDay(key)
                    }}
                    onDrop={(e) => dropOn(e, key)}
                  />
                )
              })}
              <div className="tk-tl-now" style={{ left: nowLeft }} />
              {bars.map(({ task, col, row }) => {
                const color = taskColor(task, lists)
                return (
                  <div
                    key={task.id}
                    className={`tk-tl-bar ${task.completed ? 'done' : ''} ${selectedTaskId === task.id ? 'selected' : ''} ${dragId === task.id ? 'dragging' : ''}`}
                    style={{ left: col * w + 4, width: w - 8, top: TOP_PAD + row * (ROW_H + ROW_GAP), height: ROW_H, ['--bar' as string]: color } as React.CSSProperties}
                    title={task.title}
                    onClick={(e) => {
                      e.stopPropagation()
                      selectTask(task.id)
                    }}
                    {...dragProps(task.id)}
                  >
                    {scale !== 'month' && <Checkbox size="sm" checked={task.completed} priority={task.priority} onChange={() => toggleComplete(task.id)} />}
                    <span className="tk-tl-bar-title">{task.title || '无标题'}</span>
                    {scale === 'day' && task.dueTime && <span className="tk-tl-bar-time">{formatClock(task.dueTime)}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <aside className="tk-tl-side">
          <div className="tk-tl-side-head">
            未安排 <span className="tk-col-count">{unscheduled.length}</span>
          </div>
          <div className="tk-tl-side-hint">拖动任务到左侧日期即可安排</div>
          <div className="tk-tl-side-body">
            {unscheduled.length === 0 && <div className="tk-muted" style={{ padding: '12px 6px' }}>没有未安排的任务</div>}
            {unscheduled.map((t) => (
              <div
                key={t.id}
                className={`tk-tl-item ${t.completed ? 'done' : ''} ${selectedTaskId === t.id ? 'selected' : ''} ${dragId === t.id ? 'dragging' : ''}`}
                onClick={() => selectTask(t.id)}
                {...dragProps(t.id)}
              >
                <Checkbox size="sm" checked={t.completed} priority={t.priority} onChange={() => toggleComplete(t.id)} />
                <span className="tk-tl-bar-title">{t.title || '无标题'}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
