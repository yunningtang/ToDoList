import { Check } from 'lucide-react'

/** 常用表情（倒数日 / 习惯共用） */
export const EMOJIS = [
  '🎂', '❤️', '🖤', '💍', '🎉', '🎊', '🎁', '🎈',
  '✈️', '🏠', '🎓', '💼', '📚', '📖', '💧', '🏃',
  '🧘', '💪', '🍎', '☕', '🌙', '☀️', '🌈', '⭐',
  '🔥', '🎵', '🎮', '📷', '🐱', '🐶', '🌸', '🎄',
  '🧧', '🏖️', '⏰', '✅', '💰', '🚗', '🏆', '🍀',
]

export function EmojiGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const list = value && !EMOJIS.includes(value) ? [value, ...EMOJIS] : EMOJIS
  return (
    <div className="emoji-grid">
      {list.map((e) => (
        <button key={e} type="button" className={e === value ? 'selected' : ''} onClick={() => onChange(e)} title={e}>
          {e}
        </button>
      ))}
    </div>
  )
}

export function ColorSwatches({ colors, value, onChange }: { colors: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="color-swatches">
      {colors.map((c) => {
        const white = c === 'white'
        return (
          <button
            key={c}
            type="button"
            className={`swatch ${c === value ? 'selected' : ''}`}
            style={white ? { background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--border)' } : { background: c }}
            onClick={() => onChange(c)}
            title={white ? '白色' : c}
          >
            {c === value && (
              <span className="chk">
                <Check size={10} strokeWidth={3} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
