interface Props {
  on: boolean
  onChange: (on: boolean) => void
  disabled?: boolean
}

export default function Toggle({ on, onChange, disabled }: Props) {
  return (
    <button
      type="button"
      className={`toggle ${on ? 'on' : ''}`}
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
    />
  )
}
