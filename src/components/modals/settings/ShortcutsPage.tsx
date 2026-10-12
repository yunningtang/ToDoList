import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import { DEFAULT_SETTINGS } from '../../../store/seed'
import { Card, PageHeader } from './shared'

const MOD_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta'])

function keyName(e: KeyboardEvent): string {
  const k = e.key
  if (k === ' ') return 'Space'
  if (k === 'Escape') return 'Esc'
  if (k.startsWith('Arrow')) return k.slice(5)
  if (/^[a-z]$/i.test(k)) return k.toUpperCase()
  if (e.code.startsWith('Digit')) return e.code.slice(5)
  if (e.code.startsWith('Key')) return e.code.slice(3)
  return k.length === 1 ? k.toUpperCase() : k
}

export default function ShortcutsPage() {
  const { settings, updateSettings, toast } = useStore()
  const shortcuts = settings.shortcuts
  const [recording, setRecording] = useState<string | null>(null)

  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecording(null)
        return
      }
      if (MOD_KEYS.has(e.key)) return
      const parts: string[] = []
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.metaKey) parts.push('Win')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      parts.push(keyName(e))
      const combo = parts.join('+')
      const conflict = Object.entries(shortcuts).find(([a, v]) => a !== recording && v === combo)
      updateSettings({ shortcuts: { [recording]: combo } })
      setRecording(null)
      toast(conflict ? `已设置为 ${combo}（与「${conflict[0]}」冲突）` : `已设置为 ${combo}`)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording, shortcuts, updateSettings, toast])

  const actions = Object.keys({ ...DEFAULT_SETTINGS.shortcuts, ...shortcuts })

  return (
    <>
      <PageHeader title="快捷键" desc="点击右侧按键后直接按下新的组合键即可修改，按 Esc 取消。" />
      <Card>
        <div className="st-table">
          {actions.map((a) => {
            const v = shortcuts[a] ?? ''
            const rec = recording === a
            return (
              <div key={a} className="st-row">
                <div className="st-main">
                  <div className="st-label">{a}</div>
                </div>
                <div className="st-ctrl">
                  <button className={`st-kbd ${rec ? 'recording' : ''}`} onClick={() => setRecording(rec ? null : a)} title="点击修改">
                    {rec ? '请按下快捷键…' : v || '未设置'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
      <div className="st-actions">
        <button
          className="btn"
          onClick={() => {
            updateSettings({ shortcuts: { ...DEFAULT_SETTINGS.shortcuts } })
            toast('快捷键已恢复默认')
          }}
        >
          <RotateCcw size={15} /> 恢复默认
        </button>
      </div>
      <div className="st-note">提示：部分快捷键（如 Ctrl+F 搜索、Ctrl+, 设置、Ctrl+1~6 切换模块）为全局固定快捷键。</div>
    </>
  )
}
