import { useMemo, useState } from 'react'
import { Download, Ellipsis, Eraser, Pencil, Plus, Target, Timer, Trash2 } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import type { FocusRecord } from '../../../store/types'
import Popover, { MenuDivider, MenuItem, usePopover } from '../../common/Popover'
import { ConfirmModal } from '../../common/Modal'
import EmptyState from '../../common/EmptyState'
import { dayjs, minutesToText, today } from '../../../utils/date'
import { dayOf, downloadJSON, groupRecords, hmParts, timeRange, useClockFormat } from './helpers'
import { EditRecordModal } from './PomodoroModals'

function StatTile({ label, value, parts }: { label: string; value?: number; parts?: { num: string; unit: string }[] }) {
  return (
    <div className="pomo-tile">
      <div className="pomo-tile-label">{label}</div>
      <div className="pomo-tile-value">
        {parts
          ? parts.map((p, i) => (
              <span key={i} className="pomo-tile-part">
                <span className="num">{p.num}</span>
                <span className="unit">{p.unit}</span>
              </span>
            ))
          : value}
      </div>
    </div>
  )
}

/** 右侧：概览 + 专注记录 */
export default function RecordsPanel({ onAdd }: { onAdd: () => void }) {
  const records = useStore((s) => s.focusRecords)
  const focusBase = useStore((s) => s.focusBase)
  const deleteFocusRecord = useStore((s) => s.deleteFocusRecord)
  const toast = useStore((s) => s.toast)
  const menu = usePopover()
  const rowMenu = usePopover()
  const [active, setActive] = useState<FocusRecord | null>(null)
  const [editing, setEditing] = useState<FocusRecord | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  useClockFormat()

  const stats = useMemo(() => {
    const t = today()
    let todayPomos = 0
    let todayMin = 0
    let allPomos = 0
    let allMin = 0
    for (const r of records) {
      allMin += r.minutes
      if (r.mode === 'pomo') allPomos++
      if (dayOf(r.start) === t) {
        todayMin += r.minutes
        if (r.mode === 'pomo') todayPomos++
      }
    }
    return { todayPomos, todayMin, totalPomos: focusBase.pomos + allPomos, totalMin: focusBase.minutes + allMin }
  }, [records, focusBase])

  const groups = useMemo(() => groupRecords(records), [records])
  const todayCount = useMemo(() => records.filter((r) => dayOf(r.start) === today()).length, [records])

  const exportRecords = () => {
    downloadJSON(`focus-records-${dayjs().format('YYYYMMDD')}.json`, { exportedAt: dayjs().toISOString(), focusBase, focusRecords: records })
    toast('已导出专注记录')
  }

  return (
    <aside className="pomo-right">
      <h2 className="pomo-section-title">概览</h2>
      <div className="pomo-tiles">
        <StatTile label="今日番茄" value={stats.todayPomos} />
        <StatTile label="今日专注时长" parts={hmParts(stats.todayMin)} />
        <StatTile label="总番茄" value={stats.totalPomos} />
        <StatTile label="总专注时长" parts={hmParts(stats.totalMin)} />
      </div>

      <div className="pomo-section-head">
        <h2 className="pomo-section-title">专注记录</h2>
        <div className="header-actions">
          <button className="icon-btn" title="添加专注记录" onClick={onAdd}>
            <Plus size={22} />
          </button>
          <button className="icon-btn" title="更多" onClick={menu.show}>
            <Ellipsis size={22} />
          </button>
        </div>
      </div>

      {groups.length === 0 && <EmptyState kind="focus" text="还没有专注记录，开始一个番茄吧" size={160} />}
      {groups.map((g) => (
        <div key={g.day} className="pomo-group">
          <div className="pomo-group-head">
            <span>{g.label}</span>
            <span className="pomo-group-sum">{minutesToText(g.minutes)}</span>
          </div>
          {g.records.map((r) => (
            <button
              key={r.id}
              className={`pomo-rec ${active?.id === r.id && rowMenu.open ? 'active' : ''}`}
              onClick={(e) => {
                setActive(r)
                rowMenu.show(e)
              }}
              title={r.note || r.title}
            >
              <span className={`pomo-rec-icon ${r.mode}`}>{r.mode === 'pomo' ? <Target size={15} /> : <Timer size={15} />}</span>
              <span className="pomo-rec-time">{timeRange(r)}</span>
              {r.title && r.title !== '专注' && <span className="pomo-rec-title">{r.title}</span>}
              <span className="pomo-rec-dur">{minutesToText(r.minutes)}</span>
            </button>
          ))}
        </div>
      ))}

      {/* 面板菜单 */}
      <Popover open={menu.open} onClose={menu.hide} anchor={menu.anchor} placement="bottom" align="end" closeOnClick>
        <MenuItem icon={<Plus size={16} />} label="添加专注记录" onClick={onAdd} />
        <MenuItem icon={<Download size={16} />} label="导出记录" onClick={exportRecords} />
        <MenuDivider />
        <MenuItem icon={<Eraser size={16} />} label={`清除今日记录${todayCount ? ` (${todayCount})` : ''}`} danger disabled={todayCount === 0} onClick={() => setConfirmClear(true)} />
      </Popover>

      {/* 单条记录菜单 */}
      <Popover open={rowMenu.open} onClose={rowMenu.hide} anchor={rowMenu.anchor} placement="bottom" align="start" closeOnClick style={{ minWidth: 200 }}>
        {active && (
          <div className="pomo-rec-pop-head">
            <div className="t">{active.title}</div>
            <div className="s">
              {dayjs(active.start).format('M月D日')} {timeRange(active)} · {minutesToText(active.minutes)}
            </div>
            {active.note && <div className="n">{active.note}</div>}
          </div>
        )}
        <MenuDivider />
        <MenuItem icon={<Pencil size={16} />} label="编辑标题 / 备注" onClick={() => setEditing(active)} />
        <MenuItem icon={<Trash2 size={16} />} label="删除记录" danger onClick={() => setConfirmDel(true)} />
      </Popover>

      <EditRecordModal record={editing} onClose={() => setEditing(null)} />
      <ConfirmModal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="删除专注记录"
        text={active ? `删除 ${timeRange(active)} 的这条记录（${minutesToText(active.minutes)}）？此操作不可撤销。` : undefined}
        danger
        confirmText="删除"
        onConfirm={() => {
          if (active) deleteFocusRecord(active.id)
          toast('已删除')
        }}
      />
      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="清除今日记录"
        text={`将删除今天的 ${todayCount} 条专注记录，此操作不可撤销。`}
        danger
        confirmText="清除"
        onConfirm={() => {
          const t = today()
          records.filter((r) => dayOf(r.start) === t).forEach((r) => deleteFocusRecord(r.id))
          toast('已清除今日记录')
        }}
      />
    </aside>
  )
}
