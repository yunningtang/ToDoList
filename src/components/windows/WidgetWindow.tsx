import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Pause, Play, Plus, Square, X } from 'lucide-react'
import Checkbox from '../common/Checkbox'
import { useStore } from '../../store/useStore'
import type { Task } from '../../store/types'
import { dayjs, humanDate, monthGrid, today, WEEKDAYS_MIN } from '../../utils/date'
import { formatClock } from '../../utils/date'
import { activeTasks, parseQuickAdd } from '../../utils/task'
import { elapsedOf, useTimerStore } from '../views/pomodoro/timerStore'
import { clockText } from '../views/pomodoro/helpers'
import { notifyDataChanged, useRehydrateOnFocus } from './StickyBody'
import '../../styles/windows.css'

type Kind = 'today' | 'calendar' | 'pomo'
const TITLES: Record<Kind, string> = { today: '今日任务', calendar: '月历', pomo: '番茄计时' }

/** Electron 桌面小部件窗口：?window=widget&kind=today|calendar|pomo */
export default function WidgetWindow({ kind }: { kind: Kind }) {
  useRehydrateOnFocus()
  useEffect(() => {
    document.title = TITLES[kind]
  }, [kind])
  return (
    <div className={`widget widget-${kind}`}>
      <div className="widget-head">
        <span className="widget-head-title">{TITLES[kind]}</span>
        <div className="widget-head-btns">
          <button title="打开主窗口" onClick={() => void window.desktop?.showMainWindow()}>
            <ExternalLink size={14} />
          </button>
          <button title="关闭" onClick={() => void window.desktop?.closeSelf()}>
            <X size={15} />
          </button>
        </div>
      </div>
      {kind === 'today' && <TodayWidget />}
      {kind === 'calendar' && <CalendarWidget />}
      {kind === 'pomo' && <PomoWidget />}
    </div>
  )
}

function sortByTime(a: Task, b: Task) {
  const ad = `${a.dueDate ?? ''} ${a.dueTime ?? '99'}`
  const bd = `${b.dueDate ?? ''} ${b.dueTime ?? '99'}`
  return ad < bd ? -1 : ad > bd ? 1 : b.priority - a.priority
}

function TaskRow({ t, showDate }: { t: Task; showDate?: boolean }) {
  const toggleComplete = useStore((s) => s.toggleComplete)
  const t0 = today()
  const overdue = !!t.dueDate && t.dueDate < t0 && !t.completed
  return (
    <div className={`widget-task ${t.completed ? 'done' : ''}`}>
      <Checkbox
        checked={t.completed}
        priority={t.priority}
        size="sm"
        onChange={() => {
          toggleComplete(t.id)
          notifyDataChanged()
        }}
      />
      <span className="widget-task-title">{t.title || '无标题'}</span>
      {(showDate || t.dueTime) && (
        <span className={`widget-task-time ${overdue ? 'overdue' : ''}`}>{showDate ? humanDate(t.dueDate, t.dueTime) : formatClock(t.dueTime)}</span>
      )}
    </div>
  )
}

// ---------- 今日任务 ----------
function TodayWidget() {
  const tasks = useStore((s) => s.tasks)
  const lists = useStore((s) => s.lists)
  const addTask = useStore((s) => s.addTask)
  const [text, setText] = useState('')
  const t0 = today()
  const { overdue, todays } = useMemo(() => {
    const pending = activeTasks(tasks).filter((t) => !t.completed && t.dueDate)
    return {
      overdue: pending.filter((t) => t.dueDate! < t0).sort(sortByTime),
      todays: pending.filter((t) => t.dueDate === t0).sort(sortByTime),
    }
  }, [tasks, t0])
  const submit = () => {
    const v = text.trim()
    if (!v) return
    const p = parseQuickAdd(v, lists)
    addTask({
      title: p.title || v,
      dueDate: p.dueDate ?? t0,
      dueTime: p.dueTime,
      priority: p.priority ?? 0,
      tags: p.tags,
      listId: p.listId ?? 'inbox',
    })
    notifyDataChanged()
    setText('')
  }
  const d = dayjs()
  return (
    <>
      <div className="widget-date">
        <span className="widget-date-day">{d.format('D')}</span>
        <span className="widget-date-rest">
          {d.format('M月')} · {d.format('dddd')}
        </span>
        <span className="widget-count">{overdue.length + todays.length} 项待办</span>
      </div>
      <div className="widget-quick">
        <Plus size={15} />
        <input
          value={text}
          placeholder="添加今天的任务…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
      </div>
      <div className="widget-list">
        {overdue.length > 0 && <div className="widget-group overdue">已过期 {overdue.length}</div>}
        {overdue.map((t) => (
          <TaskRow key={t.id} t={t} showDate />
        ))}
        {overdue.length > 0 && todays.length > 0 && <div className="widget-group">今天 {todays.length}</div>}
        {todays.map((t) => (
          <TaskRow key={t.id} t={t} />
        ))}
        {!overdue.length && !todays.length && <div className="widget-empty">今天没有待办，休息一下吧</div>}
      </div>
    </>
  )
}

// ---------- 月历 ----------
function CalendarWidget() {
  const tasks = useStore((s) => s.tasks)
  const weekStart = useStore((s) => s.settings.dateTime.weekStart)
  const [month, setMonth] = useState(() => dayjs().startOf('month'))
  const [sel, setSel] = useState(today())
  const grid = useMemo(() => monthGrid(month, weekStart), [month, weekStart])
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of activeTasks(tasks)) {
      if (!t.dueDate) continue
      const arr = m.get(t.dueDate) ?? []
      arr.push(t)
      m.set(t.dueDate, arr)
    }
    for (const arr of m.values()) arr.sort(sortByTime)
    return m
  }, [tasks])
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => WEEKDAYS_MIN[(weekStart + i) % 7]), [weekStart])
  const t0 = today()
  const selTasks = byDay.get(sel) ?? []
  return (
    <>
      <div className="widget-cal-nav">
        <button onClick={() => setMonth((m) => m.subtract(1, 'month'))} title="上个月">
          <ChevronLeft size={15} />
        </button>
        <span
          className="widget-cal-month"
          onClick={() => {
            setMonth(dayjs().startOf('month'))
            setSel(t0)
          }}
        >
          {month.format('YYYY年M月')}
        </span>
        <button onClick={() => setMonth((m) => m.add(1, 'month'))} title="下个月">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="widget-cal-grid">
        {weekdays.map((w) => (
          <span key={w} className="widget-cal-wd">
            {w}
          </span>
        ))}
        {grid.map((d) => {
          const key = d.format('YYYY-MM-DD')
          const list = byDay.get(key)
          const pending = list?.some((t) => !t.completed)
          return (
            <button
              key={key}
              className={`widget-cal-cell ${d.month() !== month.month() ? 'other' : ''} ${key === t0 ? 'today' : ''} ${key === sel ? 'sel' : ''}`}
              onClick={() => setSel(key)}
            >
              {d.date()}
              {list && list.length > 0 && <i className={`dot ${pending ? '' : 'done'}`} />}
            </button>
          )
        })}
      </div>
      <div className="widget-list">
        <div className="widget-group">
          {humanDate(sel)} · {selTasks.length} 项
        </div>
        {selTasks.map((t) => (
          <TaskRow key={t.id} t={t} />
        ))}
        {!selTasks.length && <div className="widget-empty">这一天没有任务</div>}
      </div>
    </>
  )
}

// ---------- 番茄计时 ----------
function PomoWidget() {
  const s = useTimerStore()
  const pomoMinutes = useStore((st) => st.settings.pomodoro.pomoMinutes)
  const now = s.status === 'running' ? s.now : Date.now()
  const elapsed = elapsedOf(s, now)
  const total = s.status === 'idle' ? pomoMinutes * 60000 : s.durationMs || elapsed
  const remain = s.durationMs > 0 ? Math.max(0, s.durationMs - elapsed) : elapsed
  const sec = Math.ceil(remain / 1000)
  const progress = s.durationMs > 0 ? Math.min(1, elapsed / s.durationMs) : 0
  const r = 52
  const circ = 2 * Math.PI * r
  const label = s.status === 'idle' ? '准备专注' : s.phase === 'focus' ? (s.status === 'paused' ? '已暂停' : s.title) : s.phase === 'longBreak' ? '长休息' : '短休息'
  const main = () => {
    if (s.status === 'idle') s.start()
    else if (s.status === 'running') s.pause()
    else s.resume()
  }
  return (
    <div className="widget-pomo">
      <div className="widget-ring">
        <svg width={128} height={128} viewBox="0 0 128 128">
          <circle cx={64} cy={64} r={r} className="ring-bg" />
          <circle
            cx={64}
            cy={64}
            r={r}
            className={`ring-fg ${s.phase !== 'focus' ? 'break' : ''}`}
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - progress)}
            transform="rotate(-90 64 64)"
          />
        </svg>
        <div className="widget-ring-text">
          <span className="widget-clock">{clockText(s.status === 'idle' ? Math.round(total / 1000) : sec)}</span>
          <span className="widget-ring-label">{label}</span>
        </div>
      </div>
      <div className="widget-pomo-btns">
        <button className="primary" onClick={main} title={s.status === 'running' ? '暂停' : '开始'}>
          {s.status === 'running' ? <Pause size={16} /> : <Play size={16} />}
        </button>
        {s.status !== 'idle' && (
          <button onClick={() => s.stop(true)} title="结束">
            <Square size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
