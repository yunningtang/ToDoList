import { useEffect, useMemo, useState } from 'react'
import Modal from '../../common/Modal'
import Toggle from '../../common/Toggle'
import { useStore } from '../../../store/useStore'
import type { FocusRecord } from '../../../store/types'
import { dayjs, formatClock, minutesToText, today } from '../../../utils/date'
import { clampInt, hmText, pendingTasks, timeRange, useClockFormat } from './helpers'

// ---------------- 添加专注记录 ----------------
export function AddRecordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tasks = useStore((s) => s.tasks)
  const lists = useStore((s) => s.lists)
  const addFocusRecord = useStore((s) => s.addFocusRecord)
  const toast = useStore((s) => s.toast)
  const pending = useMemo(() => pendingTasks(tasks, lists), [tasks, lists])

  const [date, setDate] = useState(today())
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('09:25')
  const [mode, setMode] = useState<FocusRecord['mode']>('pomo')
  const [taskId, setTaskId] = useState('')
  const [title, setTitle] = useState('专注')
  const [note, setNote] = useState('')
  useClockFormat()

  useEffect(() => {
    if (!open) return
    const now = dayjs()
    setDate(now.format('YYYY-MM-DD'))
    setStart(now.subtract(25, 'minute').format('HH:mm'))
    setEnd(now.format('HH:mm'))
    setMode('pomo')
    setTaskId('')
    setTitle('专注')
    setNote('')
  }, [open])

  const startAt = dayjs(`${date} ${start}`)
  let endAt = dayjs(`${date} ${end}`)
  if (endAt.isBefore(startAt)) endAt = endAt.add(1, 'day')
  const minutes = startAt.isValid() && endAt.isValid() ? endAt.diff(startAt, 'minute') : 0

  const submit = () => {
    if (!startAt.isValid() || !endAt.isValid() || minutes < 1) {
      toast('请填写有效的开始与结束时间')
      return
    }
    addFocusRecord({
      start: startAt.toISOString(),
      end: endAt.toISOString(),
      minutes,
      mode,
      taskId: taskId || null,
      title: title.trim() || '专注',
      note: note.trim(),
    })
    toast('已添加专注记录')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="添加专注记录"
      width={480}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" onClick={submit}>
            添加
          </button>
        </>
      }
    >
      <div className="pomo-form">
        <label className="pomo-form-row">
          <span>日期</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="pomo-form-row">
          <span>时间</span>
          <div className="pomo-form-inline">
            <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            <span className="pomo-form-sep">至</span>
            <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="pomo-form-row">
          <span>时长</span>
          <div className="pomo-form-static">
            {minutes > 0 ? `${formatClock(start)} - ${formatClock(end)} · ${minutesToText(minutes)}` : '—'}
          </div>
        </div>
        <label className="pomo-form-row">
          <span>类型</span>
          <select className="select" value={mode} onChange={(e) => setMode(e.target.value as FocusRecord['mode'])}>
            <option value="pomo">番茄</option>
            <option value="stopwatch">正计时</option>
          </select>
        </label>
        <label className="pomo-form-row">
          <span>任务</span>
          <select
            className="select"
            value={taskId}
            onChange={(e) => {
              const id = e.target.value
              setTaskId(id)
              const found = pending.find((p) => p.task.id === id)
              if (found) setTitle(found.task.title)
              else if (!id) setTitle('专注')
            }}
          >
            <option value="">无</option>
            {pending.map(({ task, listName }) => (
              <option key={task.id} value={task.id}>
                {task.title} · {listName}
              </option>
            ))}
          </select>
        </label>
        <label className="pomo-form-row">
          <span>标题</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="专注" />
        </label>
        <label className="pomo-form-row top">
          <span>备注</span>
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="记录一下这段专注…" />
        </label>
      </div>
    </Modal>
  )
}

// ---------------- 编辑专注记录 ----------------
export function EditRecordModal({ record, onClose }: { record: FocusRecord | null; onClose: () => void }) {
  const updateFocusRecord = useStore((s) => s.updateFocusRecord)
  const toast = useStore((s) => s.toast)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  useClockFormat()
  useEffect(() => {
    if (record) {
      setTitle(record.title)
      setNote(record.note)
    }
  }, [record])
  if (!record) return null
  return (
    <Modal
      open={!!record}
      onClose={onClose}
      title="编辑专注记录"
      width={460}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            onClick={() => {
              updateFocusRecord(record.id, { title: title.trim() || '专注', note: note.trim() })
              toast('已保存')
              onClose()
            }}
          >
            保存
          </button>
        </>
      }
    >
      <div className="pomo-form">
        <div className="pomo-form-row">
          <span>时间</span>
          <div className="pomo-form-static">
            {dayjs(record.start).format('M月D日')} {timeRange(record)} · {minutesToText(record.minutes)} · {record.mode === 'pomo' ? '番茄' : '正计时'}
          </div>
        </div>
        <label className="pomo-form-row">
          <span>标题</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <label className="pomo-form-row top">
          <span>备注</span>
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="记录一下这段专注…" />
        </label>
      </div>
    </Modal>
  )
}

// ---------------- 专注设置 ----------------
function NumberField({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return (
    <div className="field-row">
      <div className="label">{label}</div>
      <div className="pomo-form-inline">
        <input
          className="input pomo-num"
          type="number"
          min={min}
          max={max}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => onChange(clampInt(text, min, max, value))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className="pomo-form-sep">{unit}</span>
      </div>
    </div>
  )
}

export function FocusSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = useStore((s) => s.settings.pomodoro)
  const updateSettings = useStore((s) => s.updateSettings)
  const set = (patch: Partial<typeof p>) => updateSettings({ pomodoro: patch })
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="专注设置"
      width={480}
      footer={
        <button className="btn primary" onClick={onClose}>
          完成
        </button>
      }
    >
      <NumberField label="番茄时长" value={p.pomoMinutes} min={1} max={180} unit="分钟" onChange={(n) => set({ pomoMinutes: n })} />
      <NumberField label="短休息" value={p.shortBreak} min={0} max={60} unit="分钟" onChange={(n) => set({ shortBreak: n })} />
      <NumberField label="长休息" value={p.longBreak} min={0} max={120} unit="分钟" onChange={(n) => set({ longBreak: n })} />
      <NumberField label="长休息间隔" value={p.longBreakEvery} min={1} max={12} unit="个番茄" onChange={(n) => set({ longBreakEvery: n })} />
      <NumberField label="每日目标" value={p.dailyGoal} min={1} max={30} unit="个番茄" onChange={(n) => set({ dailyGoal: n })} />
      <div className="field-row">
        <div>
          <div className="label">自动开始休息</div>
          <div className="desc">番茄结束后立即开始休息倒计时</div>
        </div>
        <Toggle on={p.autoStartBreak} onChange={(v) => set({ autoStartBreak: v })} />
      </div>
      <div className="field-row">
        <div>
          <div className="label">自动开始下一个番茄</div>
          <div className="desc">休息结束后立即开始下一个番茄</div>
        </div>
        <Toggle on={p.autoStartPomo} onChange={(v) => set({ autoStartPomo: v })} />
      </div>
      <div className="field-row">
        <div>
          <div className="label">提示音</div>
          <div className="desc">番茄或休息结束时播放提示音</div>
        </div>
        <Toggle on={p.sound} onChange={(v) => set({ sound: v })} />
      </div>
    </Modal>
  )
}

// ---------------- 专注统计 ----------------
export function StatsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const records = useStore((s) => s.focusRecords)
  const dailyGoal = useStore((s) => s.settings.pomodoro.dailyGoal)
  const days = useMemo(() => {
    const t = dayjs().startOf('day')
    return Array.from({ length: 7 }, (_, i) => {
      const d = t.subtract(6 - i, 'day')
      const key = d.format('YYYY-MM-DD')
      let minutes = 0
      let pomos = 0
      for (const r of records) {
        if (dayjs(r.start).format('YYYY-MM-DD') !== key) continue
        minutes += r.minutes
        if (r.mode === 'pomo') pomos++
      }
      return { key, label: i === 6 ? '今天' : d.format('M/D'), minutes, pomos }
    })
  }, [records])
  const max = Math.max(1, ...days.map((d) => d.minutes))
  const total = days.reduce((a, d) => a + d.minutes, 0)
  const totalPomos = days.reduce((a, d) => a + d.pomos, 0)
  const todayPomos = days[6]?.pomos ?? 0
  return (
    <Modal open={open} onClose={onClose} title="专注统计" width={560}>
      <div className="pomo-stats-summary">
        <div>
          <div className="pomo-stats-label">近 7 天专注</div>
          <div className="pomo-stats-value">{hmText(total)}</div>
        </div>
        <div>
          <div className="pomo-stats-label">近 7 天番茄</div>
          <div className="pomo-stats-value">{totalPomos}</div>
        </div>
        <div>
          <div className="pomo-stats-label">今日目标</div>
          <div className="pomo-stats-value">
            {todayPomos} <span className="pomo-stats-unit">/ {dailyGoal}</span>
          </div>
        </div>
      </div>
      <div className="pomo-chart">
        {days.map((d) => (
          <div key={d.key} className="pomo-chart-col" title={`${d.label}：${hmText(d.minutes)} · ${d.pomos} 个番茄`}>
            <div className="pomo-chart-val">{d.minutes > 0 ? minutesToText(d.minutes) : ''}</div>
            <div className="pomo-chart-bar-wrap">
              <div className={`pomo-chart-bar ${d.label === '今天' ? 'today' : ''}`} style={{ height: `${d.minutes > 0 ? Math.max(4, (d.minutes / max) * 100) : 0}%` }} />
            </div>
            <div className={`pomo-chart-day ${d.label === '今天' ? 'today' : ''}`}>{d.label}</div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
