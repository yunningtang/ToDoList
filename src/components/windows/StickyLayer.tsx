import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { FONT_PX, resolveStickyColor, StickyBody, StickyFrame } from './StickyBody'
import '../../styles/windows.css'

interface Card {
  taskId: string
  x: number
  y: number
  color: string
  z: number
}

/** 浏览器内的浮动便签层（Electron 中不使用，由独立窗口代替）：监听 dida:open-sticky */
export default function StickyLayer() {
  const [cards, setCards] = useState<Card[]>([])
  const zRef = useRef(1)
  const defaultColor = useStore((s) => s.settings.sticky.defaultColor)
  const fontSize = useStore((s) => s.settings.sticky.fontSize)

  useEffect(() => {
    if (window.desktop) return
    const onOpen = (e: Event) => {
      const taskId = (e as CustomEvent<{ taskId: string }>).detail?.taskId
      if (!taskId) return
      setCards((cs) => {
        const z = ++zRef.current
        const i = cs.findIndex((c) => c.taskId === taskId)
        if (i >= 0) return cs.map((c) => (c.taskId === taskId ? { ...c, z } : c))
        const n = cs.length
        const x = Math.min(window.innerWidth - 320, 120 + (n % 6) * 36)
        const y = Math.min(window.innerHeight - 340, 90 + (n % 6) * 32)
        return [...cs, { taskId, x, y, color: resolveStickyColor(defaultColor), z }]
      })
    }
    window.addEventListener('dida:open-sticky', onOpen)
    return () => window.removeEventListener('dida:open-sticky', onOpen)
  }, [defaultColor])

  const update = useCallback((taskId: string, patch: Partial<Card>) => {
    setCards((cs) => cs.map((c) => (c.taskId === taskId ? { ...c, ...patch } : c)))
  }, [])
  const close = useCallback((taskId: string) => setCards((cs) => cs.filter((c) => c.taskId !== taskId)), [])
  const raise = useCallback((taskId: string) => update(taskId, { z: ++zRef.current }), [update])

  if (!cards.length) return null
  return (
    <>
      {cards.map((c) => (
        <FloatingSticky key={c.taskId} card={c} fontPx={FONT_PX[fontSize] ?? 15} onMove={update} onClose={close} onRaise={raise} />
      ))}
    </>
  )
}

function FloatingSticky({
  card,
  fontPx,
  onMove,
  onClose,
  onRaise,
}: {
  card: Card
  fontPx: number
  onMove: (id: string, patch: Partial<Card>) => void
  onClose: (id: string) => void
  onRaise: (id: string) => void
}) {
  const task = useStore((s) => s.tasks.find((t) => t.id === card.taskId))

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    onRaise(card.taskId)
    const startX = e.clientX
    const startY = e.clientY
    const ox = card.x
    const oy = card.y
    const move = (ev: MouseEvent) => {
      const x = Math.max(0, Math.min(window.innerWidth - 80, ox + ev.clientX - startX))
      const y = Math.max(0, Math.min(window.innerHeight - 40, oy + ev.clientY - startY))
      onMove(card.taskId, { x, y })
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  return (
    <StickyFrame
      className="sticky-floating"
      style={{ left: card.x, top: card.y, zIndex: 800 + card.z }}
      color={card.color}
      fontPx={fontPx}
      title={task?.title ?? '便签'}
      onColor={(c) => onMove(card.taskId, { color: c })}
      onClose={() => onClose(card.taskId)}
      onHeaderMouseDown={onHeaderMouseDown}
    >
      <div onMouseDown={() => onRaise(card.taskId)} style={{ display: 'contents' }}>
        <StickyBody taskId={card.taskId} />
      </div>
    </StickyFrame>
  )
}
