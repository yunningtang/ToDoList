import { useMemo, useState } from 'react'
import { ChevronRight, Check, Volume2 } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import Popover, { MenuDivider, MenuItem, MenuTitle, usePopover } from '../../common/Popover'
import Modal from '../../common/Modal'
import { NOISE_LABELS } from '../../../services/noise'
import { elapsedOf, noiseShouldPlay, useTimerStore } from './timerStore'
import { clockText, pendingTasks } from './helpers'

const RING = 465
const STROKE = 8
const R = (RING - STROKE) / 2
const CIRC = 2 * Math.PI * R

/** 左侧：任务选择、圆环、控制按钮 */
export default function TimerPanel() {
  const t = useTimerStore()
  const pomo = useStore((s) => s.settings.pomodoro)
  const tasks = useStore((s) => s.tasks)
  const lists = useStore((s) => s.lists)
  const toast = useStore((s) => s.toast)
  const taskPop = usePopover()
  const [custom, setCustom] = useState('')
  const [endAsk, setEndAsk] = useState(false)

  const pending = useMemo(() => pendingTasks(tasks, lists), [tasks, lists])

  const isBreak = t.phase !== 'focus'
  const running = t.status === 'running'
  const idle = t.status === 'idle'
  const elapsed = idle ? 0 : elapsedOf(t, running ? t.now : Date.now())

  // 当前显示的总时长（空闲时取设置值）
  let durationMs = t.durationMs
  if (idle) {
    if (t.mode === 'stopwatch') durationMs = 0
    else if (t.phase === 'focus') durationMs = pomo.pomoMinutes * 60000
    else durationMs = (t.phase === 'longBreak' ? pomo.longBreak : pomo.shortBreak) * 60000
  }
  const countdown = durationMs > 0
  const seconds = countdown ? Math.max(0, Math.ceil((durationMs - elapsed) / 1000)) : Math.floor(elapsed / 1000)
  const progress = countdown ? Math.min(1, elapsed / durationMs) : (elapsed % 60000) / 60000
  const dashOffset = CIRC * (1 - (idle ? 0 : progress))

  const elapsedMin = Math.round(elapsed / 60000)

  const endFocus = () => {
    if (elapsed >= 60000) setEndAsk(true)
    else {
      t.stop(false)
      toast('专注不足 1 分钟，未保存记录')
    }
  }

  // 按钮配置
  let primaryLabel = '开始'
  let primaryAction: () => void = t.start
  let secondary: { label: string; action: () => void } | null = null
  if (idle) {
    primaryLabel = isBreak ? '开始休息' : '开始'
    primaryAction = t.start
    if (isBreak) secondary = { label: '跳过休息', action: t.skipBreak }
  } else if (isBreak) {
    primaryLabel = running ? '暂停' : '继续'
    primaryAction = running ? t.pause : t.resume
    secondary = { label: '跳过休息', action: t.skipBreak }
  } else if (t.mode === 'stopwatch') {
    primaryLabel = running ? '结束' : '继续'
    primaryAction = running ? endFocus : t.resume
    secondary = running ? { label: '暂停', action: t.pause } : { label: '结束', action: endFocus }
  } else {
    primaryLabel = running ? '暂停' : '继续'
    primaryAction = running ? t.pause : t.resume
    secondary = { label: '结束', action: endFocus }
  }

  const noiseOn = pomo.noise !== 'none' && noiseShouldPlay(t)
  const phaseText = t.phase === 'focus' ? null : t.phase === 'longBreak' ? '长休息' : '短休息'
  const cycleText = t.mode === 'pomo' && t.cyclePomos > 0 ? `本轮已完成 ${t.cyclePomos} 个番茄` : null

  return (
    <div className="pomo-body">
      <button className="pomo-task-btn" onClick={taskPop.show} title="选择要专注的任务">
        <span className="pomo-task-name">{t.title}</span>
        <ChevronRight size={16} />
      </button>

      <div className={`pomo-ring ${isBreak ? 'break' : ''}`}>
        <svg viewBox={`0 0 ${RING} ${RING}`} className="pomo-ring-svg">
          <circle cx={RING / 2} cy={RING / 2} r={R} className="pomo-ring-track" strokeWidth={STROKE} fill="none" />
          <circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            className="pomo-ring-progress"
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </svg>
        <div className="pomo-ring-inner">
          {phaseText && <div className="pomo-phase">{phaseText}</div>}
          <div className={`pomo-clock ${t.status === 'paused' ? 'paused' : ''}`}>{clockText(seconds)}</div>
          {cycleText && <div className="pomo-cycle">{cycleText}</div>}
        </div>
        {noiseOn && (
          <div className="pomo-noise-badge" title={`正在播放：${NOISE_LABELS[pomo.noise]} · 音量 ${pomo.noiseVolume}%`}>
            <Volume2 size={14} />
            <span>{NOISE_LABELS[pomo.noise]}</span>
          </div>
        )}
      </div>

      <div className="pomo-controls">
        <button className="pomo-primary" onClick={primaryAction}>
          {primaryLabel}
        </button>
        {secondary && (
          <button className="pomo-secondary" onClick={secondary.action}>
            {secondary.label}
          </button>
        )}
      </div>

      {/* 任务选择 */}
      <Popover open={taskPop.open} onClose={taskPop.hide} anchor={taskPop.anchor} placement="bottom" align="center" style={{ width: 320 }}>
        <div className="pomo-task-input">
          <input
            className="input plain"
            placeholder="输入专注内容，回车确认"
            value={custom}
            autoFocus
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && custom.trim()) {
                t.setTask(null, custom.trim())
                setCustom('')
                taskPop.hide()
              }
            }}
          />
        </div>
        <MenuItem
          label="无（默认「专注」）"
          active={!t.taskId && t.title === '专注'}
          right={!t.taskId && t.title === '专注' ? <Check size={14} /> : undefined}
          onClick={() => {
            t.setTask(null, '专注')
            taskPop.hide()
          }}
        />
        <MenuDivider />
        <MenuTitle>待办任务</MenuTitle>
        <div className="pomo-task-list">
          {pending.length === 0 && <div className="pomo-task-empty">暂无待办任务</div>}
          {pending.map(({ task, listName }) => (
            <MenuItem
              key={task.id}
              label={task.title}
              hint={listName}
              active={t.taskId === task.id}
              onClick={() => {
                t.setTask(task.id, task.title)
                taskPop.hide()
              }}
            />
          ))}
        </div>
      </Popover>

      {/* 提前结束确认 */}
      <Modal
        open={endAsk}
        onClose={() => setEndAsk(false)}
        title="结束专注"
        width={420}
        footer={
          <>
            <button className="btn" onClick={() => setEndAsk(false)}>
              取消
            </button>
            <button
              className="btn danger"
              onClick={() => {
                setEndAsk(false)
                t.stop(false)
              }}
            >
              不保留
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setEndAsk(false)
                t.stop(true)
                toast('已保存专注记录')
              }}
            >
              保留记录
            </button>
          </>
        }
      >
        <div style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
          本次已专注 {elapsedMin} 分钟，尚未完成。是否保留这段专注记录？
        </div>
      </Modal>
    </div>
  )
}
