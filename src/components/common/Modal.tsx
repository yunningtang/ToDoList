import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number | string
  /** 不渲染标题栏（自定义布局） */
  bare?: boolean
  className?: string
  style?: React.CSSProperties
}

export default function Modal({ open, onClose, title, children, footer, width, bare, className = '', style }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${className}`} style={{ width, ...style }}>
        {!bare && (
          <div className="modal-header">
            <span>{title}</span>
            <button className="icon-btn" onClick={onClose} aria-label="关闭">
              <X size={20} />
            </button>
          </div>
        )}
        {bare ? children : <div className="modal-body">{children}</div>}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** 简单确认框 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  text,
  danger,
  confirmText = '确定',
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  text?: string
  danger?: boolean
  confirmText?: string
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={400}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className={`btn primary ${danger ? '' : ''}`}
            style={danger ? { background: 'var(--danger)', borderColor: 'var(--danger)' } : undefined}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmText}
          </button>
        </>
      }
    >
      {text && <div style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{text}</div>}
    </Modal>
  )
}
