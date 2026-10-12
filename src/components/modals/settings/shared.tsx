import type { ReactNode } from 'react'

/** 页面标题 + 描述 */
export function PageHeader({ title, desc }: { title: string; desc?: ReactNode }) {
  return (
    <>
      <h2 className="st-page-title">{title}</h2>
      {desc && <div className="st-page-desc">{desc}</div>}
    </>
  )
}

/** 浅灰圆角卡片 */
export function Card({ title, children, className = '' }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`st-card ${className}`}>
      {title && <div className="st-card-title">{title}</div>}
      {children}
    </div>
  )
}

/** 设置行：左侧标题/描述，右侧控件；column 模式下控件独占一行 */
export function Row({ label, desc, children, column }: { label: ReactNode; desc?: ReactNode; children?: ReactNode; column?: boolean }) {
  return (
    <div className={`st-row ${column ? 'column' : ''}`}>
      <div className="st-main">
        <div className="st-label">{label}</div>
        {desc && <div className="st-desc">{desc}</div>}
      </div>
      {children !== undefined && children !== null && <div className="st-ctrl">{children}</div>}
    </div>
  )
}

/** 分段选择器 */
export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; disabled?: boolean }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="st-seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'active' : ''} disabled={o.disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 数字输入 */
export function NumberInput({ value, onChange, min, max, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="number"
      className="input"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const n = Number(e.target.value)
        if (Number.isNaN(n)) return
        const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n))
        onChange(clamped)
      }}
    />
  )
}
