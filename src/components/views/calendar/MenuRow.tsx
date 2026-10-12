import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  label: ReactNode
  right?: ReactNode
  onClick?: () => void
}

/** 与 .menu-item 同样式的 div 行：右侧可放开关 / 按钮组而不产生 button 嵌套 */
export default function MenuRow({ icon, label, right, onClick }: Props) {
  return (
    <div className="menu-item cal-menu-row" onClick={onClick} role={onClick ? 'button' : undefined}>
      {icon && <span style={{ display: 'inline-flex', width: 18, justifyContent: 'center', flex: 'none' }}>{icon}</span>}
      <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
      {right}
    </div>
  )
}
