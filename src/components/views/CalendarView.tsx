import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, PanelLeft, Plus } from 'lucide-react'
import Popover, { MenuDivider, MenuItem, MenuTitle, usePopover } from '../common/Popover'
import Toggle from '../common/Toggle'
import TaskDetail from '../common/TaskDetail'
import TaskItem from '../common/TaskItem'
import { useStore } from '../../store/useStore'
import type { CalendarMode, Task } from '../../store/types'
import { DATE_FMT, dayjs, today, weekDays, WEEKDAYS_SHORT } from '../../utils/date'
import { lunarText } from '../../utils/lunar'
import TimeGrid from './calendar/TimeGrid'
import type { PendingSlot } from './calendar/TimeGrid'
import MonthGrid from './calendar/MonthGrid'
import SidePanel from './calendar/SidePanel'
import AddTaskPopover from './calendar/AddTaskPopover'
import type { AddInitial } from './calendar/AddTaskPopover'
import BlockMenu from './calendar/BlockMenu'
import MenuRow from './calendar/MenuRow'
import { DEFAULT_DURATION, groupByDate, splitDay, toTime } from './calendar/calendarUtils'
import '../../styles/calendar.css'

const MODE_LABEL: Record<CalendarMode, string> = { day: '日', week: '周', month: '月' }
const WEEK_START_LABEL: Record<0 | 1 | 6, string> = { 1: '周一', 0: '周日', 6: '周六' }

/** 每分钟刷新一次的当前时间 */
function useNow() {
  const [now, setNow] = useState(() => dayjs())
  useEffect(() => {
    let timer = 0
    const schedule = () => {
      timer = window.setTimeout(() => {
        setNow(dayjs())
        schedule()
      }, 60000 - (Date.now() % 60000) + 50)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [])
  return now
}

interface AddState {
  key: number
  anchor: HTMLElement | null
  position: { x: number; y: number } | null
  initial: AddInitial
  /** 网格中的占位块 */
  pending: PendingSlot | null
}

export default function CalendarView() {
  const settings = useStore((s) => s.settings)
  const tasks = useStore((s) => s.tasks)
  const lists = useStore((s) => s.lists)
  const countdowns = useStore((s) => s.countdowns)
  const selectedTaskId = useStore((s) => s.selectedTaskId)
  const { addTask, updateTask, selectTask, updateSettings, toast } = useStore()

  const [mode, setMode] = useState<CalendarMode>(settings.calendar.defaultMode)
  const [cursor, setCursor] = useState(today())
  const [showSide, setShowSide] = useState(false)
  const [adding, setAdding] = useState<AddState | null>(null)
  const [ctx, setCtx] = useState<{ taskId: string; position: { x: number; y: number } } | null>(null)
  const [more, setMore] = useState<{ date: string; anchor: HTMLElement } | null>(null)
  const now = useNow()
  const modeMenu = usePopover()
  const moreMenu = usePopover()

  const weekStart = settings.dateTime.weekStart
  const { showCompleted, showCountdowns } = settings.calendar

  const visibleTasks = useMemo(
    () => tasks.filter((t) => !t.deleted && !!t.dueDate && (showCompleted || !t.completed)),
    [tasks, showCompleted],
  )
  const tasksByDate = useMemo(() => groupByDate(visibleTasks), [visibleTasks])
  const datesWithTasks = useMemo(() => new Set(tasksByDate.keys()), [tasksByDate])
  const unscheduled = useMemo(() => tasks.filter((t) => !t.deleted && !t.completed && !t.dueDate).sort((a, b) => a.order - b.order), [tasks])
  const cds = showCountdowns ? countdowns : []

  const days = useMemo(() => (mode === 'day' ? [dayjs(cursor)] : weekDays(cursor, weekStart)), [mode, cursor, weekStart])
  const title =
    mode === 'day'
      ? `${dayjs(cursor).format('YYYY年M月D日')} ${WEEKDAYS_SHORT[dayjs(cursor).day()]}${settings.dateTime.showLunar ? ` · ${lunarText(cursor)}` : ''}`
      : dayjs(cursor).format('YYYY年M月')

  const shift = (n: number) => {
    const unit = mode === 'day' ? 'day' : mode === 'week' ? 'week' : 'month'
    setCursor(dayjs(cursor).add(n, unit).format(DATE_FMT))
  }

  const changeMode = (m: CalendarMode) => {
    setMode(m)
    setAdding(null)
  }

  // ---- 新建 ----
  const openAdd = (initial: AddInitial, at: { anchor?: HTMLElement; position?: { x: number; y: number } }, pending: PendingSlot | null) =>
    setAdding({ key: Date.now(), anchor: at.anchor ?? null, position: at.position ?? null, initial, pending })

  const onSlotClick = (date: string, start: number | null, e: React.MouseEvent) => {
    const timed = start !== null
    openAdd(
      { dueDate: date, dueTime: timed ? toTime(start) : null, endTime: timed ? toTime(start + DEFAULT_DURATION) : null },
      { position: { x: e.clientX + 8, y: e.clientY + 8 } },
      { date, start, end: timed ? start + DEFAULT_DURATION : null },
    )
  }
  const onMonthCellClick = (date: string, e: React.MouseEvent) =>
    openAdd({ dueDate: date, dueTime: null, endTime: null }, { position: { x: e.clientX + 8, y: e.clientY + 8 } }, { date, start: null, end: null })

  const submitAdd = (v: { title: string; dueDate: string | null; dueTime: string | null; endTime: string | null }) => {
    addTask({ title: v.title, dueDate: v.dueDate, dueTime: v.dueTime, endTime: v.endTime, listId: 'inbox' })
    toast('已添加任务')
  }

  // ---- 任务交互 ----
  const onBlockClick = (id: string) => selectTask(selectedTaskId === id ? null : id)
  const onBlockContext = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCtx({ taskId: id, position: { x: e.clientX, y: e.clientY } })
  }
  const onMove = (id: string, patch: Partial<Task>) => updateTask(id, patch)
  const goDay = (date: string) => {
    setCursor(date)
    changeMode('day')
  }

  const moreTasks = more ? [...(tasksByDate.get(more.date) ?? [])] : []
  const moreSplit = splitDay(moreTasks)

  return (
    <>
      <div className="page cal-page">
        <div className="page-header">
          <h1 className="page-title">
            <button className={`icon-btn ${showSide ? 'active' : ''}`} title="侧栏" onClick={() => setShowSide((v) => !v)}>
              <PanelLeft size={22} />
            </button>
            <span>{title}</span>
          </h1>
          <div className="header-actions cal-actions">
            <button
              className="cal-sq-btn"
              title="添加任务"
              onClick={(e) =>
                openAdd({ dueDate: today(), dueTime: null, endTime: null }, { anchor: e.currentTarget }, null)
              }
            >
              <Plus size={18} />
            </button>
            <button className="cal-sq-btn wide" onClick={modeMenu.show}>
              {MODE_LABEL[mode]}
              <ChevronDown size={14} className="chev" />
            </button>
            <div className="cal-nav">
              <button onClick={() => shift(-1)} title="上一个">
                <ChevronLeft size={18} />
              </button>
              <button className="today" onClick={() => setCursor(today())}>
                今天
              </button>
              <button onClick={() => shift(1)} title="下一个">
                <ChevronRight size={18} />
              </button>
            </div>
            <button className="icon-btn" onClick={moreMenu.show} title="更多">
              <MoreHorizontal size={20} />
            </button>
          </div>
        </div>

        <div className="cal-wrap">
          {showSide && (
            <SidePanel
              cursor={cursor}
              weekStart={weekStart}
              datesWithTasks={datesWithTasks}
              unscheduled={unscheduled}
              selectedTaskId={selectedTaskId}
              onPick={(d) => setCursor(d)}
              onSelectTask={(id) => selectTask(id)}
            />
          )}
          <div className="cal-sheet">
            {mode === 'month' ? (
              <MonthGrid
                cursor={cursor}
                weekStart={weekStart}
                showWeekNumber={settings.dateTime.showWeekNumber}
                tasksByDate={tasksByDate}
                countdowns={cds}
                lists={lists}
                selectedTaskId={selectedTaskId}
                pendingDate={adding?.pending?.date ?? null}
                onCellClick={onMonthCellClick}
                onBlockClick={onBlockClick}
                onBlockContext={onBlockContext}
                onMore={(date, anchor) => setMore({ date, anchor })}
                onDayClick={goDay}
                onMove={onMove}
              />
            ) : (
              <TimeGrid
                key={mode}
                days={days}
                tasksByDate={tasksByDate}
                countdowns={cds}
                lists={lists}
                now={now}
                selectedTaskId={selectedTaskId}
                pending={adding?.pending ?? null}
                onSlotClick={onSlotClick}
                onBlockClick={onBlockClick}
                onBlockContext={onBlockContext}
                onDayClick={goDay}
                onMove={onMove}
              />
            )}
          </div>
        </div>
      </div>

      {selectedTaskId && <TaskDetail taskId={selectedTaskId} onClose={() => selectTask(null)} />}

      {/* 视图模式 */}
      <Popover open={modeMenu.open} onClose={modeMenu.hide} anchor={modeMenu.anchor} align="end" closeOnClick style={{ minWidth: 120 }}>
        {(['day', 'week', 'month'] as CalendarMode[]).map((m) => (
          <MenuItem key={m} label={MODE_LABEL[m]} active={mode === m} right={mode === m ? <Check size={14} /> : undefined} onClick={() => changeMode(m)} />
        ))}
      </Popover>

      {/* 更多菜单 */}
      <Popover open={moreMenu.open} onClose={moreMenu.hide} anchor={moreMenu.anchor} align="end" style={{ width: 240 }}>
        <MenuRow label="显示已完成" right={<Toggle on={showCompleted} onChange={(v) => updateSettings({ calendar: { showCompleted: v } })} />} />
        <MenuRow label="显示倒数日" right={<Toggle on={showCountdowns} onChange={(v) => updateSettings({ calendar: { showCountdowns: v } })} />} />
        <MenuDivider />
        <MenuTitle>周起始</MenuTitle>
        {([1, 0, 6] as const).map((w) => (
          <MenuItem
            key={w}
            label={WEEK_START_LABEL[w]}
            active={weekStart === w}
            right={weekStart === w ? <Check size={14} /> : undefined}
            onClick={() => updateSettings({ dateTime: { weekStart: w } })}
          />
        ))}
        <MenuDivider />
        <MenuTitle>跳转到日期</MenuTitle>
        <div className="cal-jump">
          <input
            type="date"
            className="input"
            value={cursor}
            onChange={(e) => {
              if (!e.target.value) return
              setCursor(e.target.value)
              moreMenu.hide()
            }}
          />
        </div>
      </Popover>

      {/* 新建任务 */}
      {adding && (
        <AddTaskPopover
          key={adding.key}
          open
          onClose={() => setAdding(null)}
          anchor={adding.anchor}
          position={adding.position}
          initial={adding.initial}
          onSubmit={submitAdd}
        />
      )}

      {/* 右键菜单 */}
      <BlockMenu taskId={ctx?.taskId ?? null} position={ctx?.position ?? null} onClose={() => setCtx(null)} />

      {/* 月视图「更多」 */}
      <Popover open={!!more} onClose={() => setMore(null)} anchor={more?.anchor} style={{ width: 340, padding: '8px 6px' }}>
        {more && (
          <>
            <MenuTitle>
              {dayjs(more.date).format('M月D日')} {WEEKDAYS_SHORT[dayjs(more.date).day()]} · {moreTasks.length} 项
            </MenuTitle>
            <div className="cal-more-list">
              {[...moreSplit.allDay, ...moreSplit.timed].map((t) => (
                <TaskItem key={t.id} task={t} selected={selectedTaskId === t.id} onSelect={(id) => selectTask(id)} showDate={!!t.dueTime} />
              ))}
            </div>
          </>
        )}
      </Popover>
    </>
  )
}
