import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

export interface PopoverProps {
  open: boolean
  onClose: () => void
  anchor?: HTMLElement | null
  /** 固定位置（如右键菜单） */
  position?: { x: number; y: number } | null
  placement?: 'bottom' | 'top' | 'right' | 'left'
  align?: 'start' | 'end' | 'center'
  offset?: number
  className?: string
  style?: React.CSSProperties
  children: ReactNode
  /** 点击内部是否自动关闭（菜单为 true） */
  closeOnClick?: boolean
}

/** 通用浮层：锚定到元素或固定坐标，自动限制在视口内，点击外部 / Esc 关闭 */
export default function Popover({
  open,
  onClose,
  anchor,
  position,
  placement = 'bottom',
  align = 'start',
  offset = 6,
  className = '',
  style,
  children,
  closeOnClick,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; visibility: 'hidden' | 'visible' }>({ left: 0, top: 0, visibility: 'hidden' })

  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const el = ref.current
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = 0
    let top = 0
    if (position) {
      left = position.x
      top = position.y
    } else if (anchor) {
      const r = anchor.getBoundingClientRect()
      if (placement === 'bottom' || placement === 'top') {
        top = placement === 'bottom' ? r.bottom + offset : r.top - h - offset
        left = align === 'start' ? r.left : align === 'end' ? r.right - w : r.left + r.width / 2 - w / 2
        if (placement === 'bottom' && top + h > vh - 8 && r.top - h - offset > 8) top = r.top - h - offset
      } else {
        left = placement === 'right' ? r.right + offset : r.left - w - offset
        top = align === 'start' ? r.top : align === 'end' ? r.bottom - h : r.top + r.height / 2 - h / 2
        if (placement === 'right' && left + w > vw - 8) left = r.left - w - offset
      }
    }
    left = Math.max(8, Math.min(left, vw - w - 8))
    top = Math.max(8, Math.min(top, vh - h - 8))
    setPos({ left, top, visibility: 'visible' })
  }, [open, anchor, position, placement, align, offset])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(anchor && anchor.contains(e.target as Node))) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    // 延迟绑定，避免触发它的那次点击立刻关闭
    const id = setTimeout(() => {
      document.addEventListener('mousedown', onDown)
      document.addEventListener('keydown', onKey, true)
    }, 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, onClose, anchor])

  if (!open) return null
  return createPortal(
    <div
      ref={ref}
      className={`popover ${className}`}
      style={{ left: pos.left, top: pos.top, visibility: pos.visibility, ...style }}
      onClick={closeOnClick ? () => onClose() : undefined}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  )
}

/** 便捷 hook：管理浮层开关与锚点 */
export function usePopover() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [open, setOpen] = useState(false)
  const show = (e: React.MouseEvent | HTMLElement) => {
    const el = e instanceof HTMLElement ? e : (e.currentTarget as HTMLElement)
    setAnchor(el)
    setPosition(null)
    setOpen(true)
  }
  const showAt = (x: number, y: number) => {
    setAnchor(null)
    setPosition({ x, y })
    setOpen(true)
  }
  const showContext = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    showAt(e.clientX, e.clientY)
  }
  const hide = () => setOpen(false)
  return { open, anchor, position, show, showAt, showContext, hide, toggle: (e: React.MouseEvent) => (open ? hide() : show(e)) }
}

// ---------- 菜单项 ----------
interface MenuItemProps {
  icon?: ReactNode
  label: ReactNode
  hint?: ReactNode
  onClick?: (e: React.MouseEvent) => void
  danger?: boolean
  active?: boolean
  disabled?: boolean
  right?: ReactNode
}
export function MenuItem({ icon, label, hint, onClick, danger, active, disabled, right }: MenuItemProps) {
  return (
    <button
      type="button"
      className={`menu-item ${danger ? 'danger' : ''} ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
    >
      {icon && <span style={{ display: 'inline-flex', width: 18, justifyContent: 'center', flex: 'none' }}>{icon}</span>}
      <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {hint && <span className="hint">{hint}</span>}
      {right}
    </button>
  )
}
export function MenuDivider() {
  return <div className="menu-divider" />
}
export function MenuTitle({ children }: { children: ReactNode }) {
  return <div className="menu-title">{children}</div>
}
