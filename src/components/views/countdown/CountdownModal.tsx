import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import type { Countdown, CountdownKind } from '../../../store/types'
import Modal, { ConfirmModal } from '../../common/Modal'
import Toggle from '../../common/Toggle'
import { today } from '../../../utils/date'
import { COUNTDOWN_COLORS, KIND_LABELS, computeCountdown } from './helpers'
import { ColorSwatches, EmojiGrid } from './pickers'

interface Props {
  open: boolean
  onClose: () => void
  /** 为 null 时是新建 */
  editing: Countdown | null
  defaultKind?: CountdownKind
}

/** 添加 / 编辑倒数日（每次打开由父组件重新挂载，state 即为初始值） */
export default function CountdownModal({ open, onClose, editing, defaultKind = 'countdown' }: Props) {
  const { addCountdown, updateCountdown, deleteCountdown, toast } = useStore()
  const [title, setTitle] = useState(editing?.title ?? '')
  const [date, setDate] = useState(editing?.date ?? today())
  const [kind, setKind] = useState<CountdownKind>(editing?.kind ?? defaultKind)
  const [icon, setIcon] = useState(editing?.icon ?? '🎉')
  const [color, setColor] = useState(editing?.color ?? COUNTDOWN_COLORS[1])
  const [yearly, setYearly] = useState(editing?.yearly ?? false)
  const [showInCalendar, setShowInCalendar] = useState(editing?.showInCalendar ?? true)
  const [confirmDel, setConfirmDel] = useState(false)

  const preview = useMemo(
    () =>
      computeCountdown({
        id: 'preview',
        title,
        date: date || today(),
        kind,
        icon,
        color,
        yearly,
        showInCalendar,
        createdAt: '',
      }),
    [title, date, kind, icon, color, yearly, showInCalendar],
  )
  const white = color === 'white'
  const valid = !!date

  const save = () => {
    if (!valid) return
    const patch = { title: title.trim(), date, kind, icon, color, yearly, showInCalendar }
    if (editing) {
      updateCountdown(editing.id, patch)
      toast('已保存')
    } else {
      addCountdown(patch)
      toast('已添加倒数日')
    }
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editing ? '编辑倒数日' : '添加倒数日'}
        width={520}
        footer={
          <>
            {editing && (
              <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => setConfirmDel(true)}>
                <Trash2 size={16} />
                删除
              </button>
            )}
            <button className="btn" onClick={onClose}>
              取消
            </button>
            <button className="btn primary" disabled={!valid} onClick={save}>
              {editing ? '保存' : '添加'}
            </button>
          </>
        }
      >
        <div className="cd-form">
          {/* 预览 */}
          <div className={`cd-preview ${white ? 'white' : 'colored'}`} style={white ? undefined : { background: color }}>
            <div className="cd-head">
              <span className="ico">{icon}</span>
              {title.trim() && <span className="ttl">{title.trim()}</span>}
            </div>
            <div className={`cd-num ${preview.isText ? 'text' : ''}`}>{preview.number}</div>
            <div className="cd-caption">{preview.caption}</div>
          </div>

          <div className="row">
            <label>标题</label>
            <input className="input" placeholder="例如：生日、纪念日、考试…（可留空）" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
          <div className="row inline">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value as CountdownKind)}>
              {(Object.keys(KIND_LABELS) as CountdownKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <label>图标</label>
            <EmojiGrid value={icon} onChange={setIcon} />
          </div>
          <div className="row">
            <label>颜色</label>
            <ColorSwatches colors={COUNTDOWN_COLORS} value={color} onChange={setColor} />
          </div>
          <div className="field-row">
            <div>
              <div className="label">每年重复</div>
              <div className="desc">按每年的下一次日期计算剩余天数</div>
            </div>
            <Toggle on={yearly} onChange={setYearly} />
          </div>
          <div className="field-row">
            <div className="label">在日历中显示</div>
            <Toggle on={showInCalendar} onChange={setShowInCalendar} />
          </div>
        </div>
      </Modal>
      <ConfirmModal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="删除倒数日"
        text={`确定删除「${editing?.title || editing?.icon || ''}」吗？此操作无法撤销。`}
        danger
        confirmText="删除"
        onConfirm={() => {
          if (editing) {
            deleteCountdown(editing.id)
            toast('已删除')
          }
          onClose()
        }}
      />
    </>
  )
}
