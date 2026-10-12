import { Flag } from 'lucide-react'
import Popover, { MenuItem } from './Popover'
import type { Priority } from '../../store/types'
import { PRIORITIES, PRIORITY_META } from '../../utils/task'

interface Props {
  open: boolean
  onClose: () => void
  anchor?: HTMLElement | null
  position?: { x: number; y: number } | null
  value: Priority
  onChange: (p: Priority) => void
}

export function PriorityIcon({ priority, size = 16 }: { priority: Priority; size?: number }) {
  const c = PRIORITY_META[priority].color
  return <Flag size={size} color={c} fill={priority ? c : 'none'} />
}

export default function PriorityPicker({ open, onClose, anchor, position, value, onChange }: Props) {
  return (
    <Popover open={open} onClose={onClose} anchor={anchor} position={position} closeOnClick>
      {PRIORITIES.map((p) => (
        <MenuItem
          key={p}
          icon={<PriorityIcon priority={p} />}
          label={PRIORITY_META[p].label}
          active={value === p}
          onClick={() => onChange(p)}
        />
      ))}
    </Popover>
  )
}
