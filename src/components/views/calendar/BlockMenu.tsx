import { Check, Flag, PanelRightOpen, RotateCcw, Trash2 } from 'lucide-react'
import Popover, { MenuDivider, MenuItem } from '../../common/Popover'
import { PriorityIcon } from '../../common/PriorityPicker'
import MenuRow from './MenuRow'
import { useStore } from '../../../store/useStore'
import { PRIORITIES, PRIORITY_META } from '../../../utils/task'

interface Props {
  taskId: string | null
  position: { x: number; y: number } | null
  onClose: () => void
}

/** 日历块右键菜单：完成 / 优先级 / 详情 / 删除 */
export default function BlockMenu({ taskId, position, onClose }: Props) {
  const task = useStore((s) => (taskId ? s.tasks.find((t) => t.id === taskId) : undefined))
  const { toggleComplete, updateTask, requestDeleteTask, selectTask, toast } = useStore()
  const open = !!task && !!position
  if (!task) return null
  return (
    <Popover open={open} onClose={onClose} position={position}>
      <MenuItem
        icon={task.completed ? <RotateCcw size={16} /> : <Check size={16} />}
        label={task.completed ? '取消完成' : '完成'}
        onClick={() => {
          toggleComplete(task.id)
          onClose()
        }}
      />
      <MenuRow
        icon={<Flag size={16} />}
        label="优先级"
        right={
          <span className="cal-pri-row">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                className={`cal-pri-btn ${task.priority === p ? 'active' : ''}`}
                title={PRIORITY_META[p].label}
                onClick={() => {
                  updateTask(task.id, { priority: p })
                  onClose()
                }}
              >
                <PriorityIcon priority={p} size={15} />
              </button>
            ))}
          </span>
        }
      />
      <MenuItem
        icon={<PanelRightOpen size={16} />}
        label="查看详情"
        onClick={() => {
          selectTask(task.id)
          onClose()
        }}
      />
      <MenuDivider />
      <MenuItem
        icon={<Trash2 size={16} />}
        label="删除"
        danger
        onClick={() => {
          requestDeleteTask(task.id)
          onClose()
        }}
      />
    </Popover>
  )
}
