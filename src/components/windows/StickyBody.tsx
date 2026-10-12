import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Palette, Pin, PinOff, Plus, X } from 'lucide-react'
import Checkbox from '../common/Checkbox'
import { useStore } from '../../store/useStore'
import type { Settings } from '../../store/types'
import { humanDate, isOverdue } from '../../utils/date'
import { listName } from '../../utils/task'
import { uid } from '../../utils/id'

/** 便签可选颜色（与设置页一致） */
export const STICKY_COLORS = ['#fff3b0', '#ffd6c4', '#ffb3b3', '#cdeefc', '#c9dbff', '#d9ccff', '#b9e8c6', '#ffffff', '#efefef', '#3a3a3a', '#1e2a44', '#111111']

export const FONT_PX: Record<Settings['sticky']['fontSize'], number> = { small: 13, normal: 15, large: 18 }

/** 'random' / 非法值 → 随机或默认颜色 */
export function resolveStickyColor(pref: string | null | undefined): string {
  if (pref && /^#[0-9a-f]{6}$/i.test(pref)) return pref
  if (pref === 'random') return STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)]!
  return STICKY_COLORS[0]!
}

export function isDarkColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return false
  const n = parseInt(m[1]!, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 < 140
}

/** 本窗口改了数据 → 等本地写入（150ms 防抖）落盘后再通知其他窗口 */
let notifyTimer: number | null = null
export function notifyDataChanged() {
  if (!window.desktop) return
  if (notifyTimer !== null) window.clearTimeout(notifyTimer)
  notifyTimer = window.setTimeout(() => {
    notifyTimer = null
    window.desktop?.broadcastDataChanged()
  }, 300)
}

/** 便签 / 小部件窗口获得焦点时重新读取数据，避免用旧快照覆盖主窗口的修改 */
export function useRehydrateOnFocus() {
  const hydrate = useStore((s) => s.hydrate)
  useEffect(() => {
    if (!window.desktop) return
    const h = () => void hydrate()
    window.addEventListener('focus', h)
    return () => window.removeEventListener('focus', h)
  }, [hydrate])
}

// ---------- 外框：色带标题 + 按钮 ----------
interface FrameProps {
  color: string
  fontPx: number
  title: string
  pinned?: boolean
  onPin?: (v: boolean) => void
  onColor: (c: string) => void
  onClose: () => void
  /** Electron 无边框窗口：标题区用 -webkit-app-region 拖动 */
  nativeDrag?: boolean
  onHeaderMouseDown?: (e: React.MouseEvent) => void
  className?: string
  style?: React.CSSProperties
  children: ReactNode
}
export function StickyFrame({ color, fontPx, title, pinned, onPin, onColor, onClose, nativeDrag, onHeaderMouseDown, className = '', style, children }: FrameProps) {
  const dark = isDarkColor(color)
  const [palette, setPalette] = useState(false)
  const paletteRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!palette) return
    const onDown = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) setPalette(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [palette])

  return (
    <div
      className={`sticky ${dark ? 'dark' : 'light'} ${className}`}
      style={{ ['--sticky-bg' as any]: color, ['--sticky-font' as any]: `${fontPx}px`, ...style } as React.CSSProperties}
    >
      <div className={`sticky-head ${nativeDrag ? 'native-drag' : ''}`} onMouseDown={onHeaderMouseDown}>
        <span className="sticky-head-title" title={title}>
          {title || '无标题'}
        </span>
        <div className="sticky-head-btns">
          {onPin && (
            <button className={pinned ? 'active' : ''} title={pinned ? '取消置顶' : '置顶'} onClick={() => onPin(!pinned)}>
              {pinned ? <Pin size={14} /> : <PinOff size={14} />}
            </button>
          )}
          <div className="sticky-palette-wrap" ref={paletteRef}>
            <button title="颜色" className={palette ? 'active' : ''} onClick={() => setPalette((v) => !v)}>
              <Palette size={14} />
            </button>
            {palette && (
              <div className="sticky-palette">
                {STICKY_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`sticky-palette-dot ${c === color ? 'sel' : ''}`}
                    style={{ background: c }}
                    title={c}
                    onClick={() => {
                      onColor(c)
                      setPalette(false)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <button title="关闭" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

// ---------- 正文：标题 / 描述 / 子任务 / 日期 ----------
export function StickyBody({ taskId }: { taskId: string }) {
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId))
  const lists = useStore((s) => s.lists)
  const { updateTask, toggleComplete } = useStore()
  const [newSub, setNewSub] = useState('')

  if (!task || task.deleted) return <div className="sticky-empty">任务不存在或已删除</div>

  const change = (patch: Parameters<typeof updateTask>[1]) => {
    updateTask(task.id, patch)
    notifyDataChanged()
  }
  const toggleSub = (id: string) => change({ subtasks: task.subtasks.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s)) })
  const renameSub = (id: string, title: string) => change({ subtasks: task.subtasks.map((s) => (s.id === id ? { ...s, title } : s)) })
  const removeSub = (id: string) => change({ subtasks: task.subtasks.filter((s) => s.id !== id) })
  const addSub = () => {
    const t = newSub.trim()
    if (!t) return
    change({ subtasks: [...task.subtasks, { id: uid('sub'), title: t, completed: false }] })
    setNewSub('')
  }
  const overdue = isOverdue(task.dueDate) && !task.completed
  const done = task.subtasks.filter((s) => s.completed).length

  return (
    <div className="sticky-body">
      <div className="sticky-title-row">
        <Checkbox
          checked={task.completed}
          priority={task.priority}
          onChange={() => {
            toggleComplete(task.id)
            notifyDataChanged()
          }}
        />
        <input
          className={`sticky-title ${task.completed ? 'done' : ''}`}
          value={task.title}
          placeholder="无标题"
          onChange={(e) => change({ title: e.target.value })}
        />
      </div>
      <textarea className="sticky-content" value={task.content} placeholder="添加描述…" onChange={(e) => change({ content: e.target.value })} />
      {
        <div className="sticky-subtasks">
          {task.subtasks.length > 0 && (
            <div className="sticky-sub-head">
              子任务 {done}/{task.subtasks.length}
            </div>
          )}
          {task.subtasks.map((s) => (
            <div key={s.id} className={`sticky-sub ${s.completed ? 'done' : ''}`}>
              <Checkbox checked={s.completed} size="sm" onChange={() => toggleSub(s.id)} />
              <input
                value={s.title}
                onChange={(e) => renameSub(s.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !s.title) {
                    e.preventDefault()
                    removeSub(s.id)
                  }
                }}
              />
              <button className="sticky-sub-del" title="删除子任务" onClick={() => removeSub(s.id)}>
                <X size={12} />
              </button>
            </div>
          ))}
          <div className="sticky-sub add">
            <Plus size={14} />
            <input
              value={newSub}
              placeholder="添加子任务"
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSub()
                }
              }}
              onBlur={addSub}
            />
          </div>
        </div>
      }
      <div className="sticky-foot">
        <span className={overdue ? 'overdue' : ''}>{task.dueDate ? humanDate(task.dueDate, task.dueTime) : '无日期'}</span>
        <span className="sticky-foot-list">{listName(lists, task.listId)}</span>
      </div>
    </div>
  )
}
