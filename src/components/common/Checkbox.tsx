import { Check } from 'lucide-react'
import type { Priority } from '../../store/types'
import { PRIORITY_META } from '../../utils/task'

interface Props {
  checked: boolean
  priority?: Priority
  onChange?: (checked: boolean) => void
  size?: 'sm' | 'md'
  round?: boolean
  color?: string
  className?: string
  title?: string
}

/** 优先级着色的复选框（与滴答清单一致：高红、中黄、低蓝、无灰） */
export default function Checkbox({ checked, priority = 0, onChange, size = 'md', round, color, className = '', title }: Props) {
  const c = color ?? (priority ? PRIORITY_META[priority].color : undefined)
  return (
    <button
      type="button"
      className={`cb ${checked ? 'checked' : ''} ${size === 'sm' ? 'sm' : ''} ${round ? 'round' : ''} ${className}`}
      style={c ? ({ ['--cb-color' as any]: c } as React.CSSProperties) : undefined}
      onClick={(e) => {
        e.stopPropagation()
        onChange?.(!checked)
      }}
      title={title}
      aria-checked={checked}
      role="checkbox"
    >
      {checked && <Check size={size === 'sm' ? 11 : 14} strokeWidth={3} />}
    </button>
  )
}
