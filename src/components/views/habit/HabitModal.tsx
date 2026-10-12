import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import type { Habit } from '../../../store/types'
import Modal, { ConfirmModal } from '../../common/Modal'
import Toggle from '../../common/Toggle'
import { ColorSwatches, EmojiGrid } from '../countdown/pickers'
import { HABIT_COLORS } from './helpers'

interface Props {
  open: boolean
  onClose: () => void
  editing: Habit | null
}

/** 添加 / 编辑习惯（每次打开由父组件重新挂载） */
export default function HabitModal({ open, onClose, editing }: Props) {
  const { addHabit, updateHabit, deleteHabit, toast } = useStore()
  const [name, setName] = useState(editing?.name ?? '')
  const [icon, setIcon] = useState(editing?.icon ?? '📖')
  const [color, setColor] = useState(editing?.color ?? HABIT_COLORS[0])
  const [goal, setGoal] = useState(editing?.goalPerWeek ?? 7)
  const [archived, setArchived] = useState(editing?.archived ?? false)
  const [confirmDel, setConfirmDel] = useState(false)
  const valid = name.trim().length > 0

  const save = () => {
    if (!valid) return
    if (editing) {
      updateHabit(editing.id, { name: name.trim(), icon, color, goalPerWeek: goal, archived })
      toast(archived && !editing.archived ? '已归档' : '已保存')
    } else {
      addHabit({ name: name.trim(), icon, color, goalPerWeek: goal })
      toast('已添加习惯')
    }
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editing ? '编辑习惯' : '添加习惯'}
        width={500}
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
        <div className="hb-form">
          <div className="preview" style={{ ['--hc' as any]: color } as React.CSSProperties}>
            <div className="hb-icon">{icon}</div>
            <input placeholder="习惯名称，如：阅读、早睡" value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
          <div className="row">
            <label>图标</label>
            <EmojiGrid value={icon} onChange={setIcon} />
          </div>
          <div className="row">
            <label>颜色</label>
            <ColorSwatches colors={HABIT_COLORS} value={color} onChange={setColor} />
          </div>
          <div className="row">
            <label>每周目标（次）</label>
            <div className="hb-goal">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button key={n} type="button" className={goal === n ? 'active' : ''} onClick={() => setGoal(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          {editing && (
            <div className="field-row">
              <div>
                <div className="label">归档</div>
                <div className="desc">归档后不再出现在打卡列表中，打卡记录会保留</div>
              </div>
              <Toggle on={archived} onChange={setArchived} />
            </div>
          )}
        </div>
      </Modal>
      <ConfirmModal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="删除习惯"
        text={`确定删除「${editing?.name ?? ''}」吗？所有打卡记录将一并删除，无法撤销。`}
        danger
        confirmText="删除"
        onConfirm={() => {
          if (editing) {
            deleteHabit(editing.id)
            toast('已删除')
          }
          onClose()
        }}
      />
    </>
  )
}
