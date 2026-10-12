import { useMemo, useState } from 'react'
import { Archive, BarChart3, CalendarHeart, Check, ChevronDown, Clock3, Flame, MoreHorizontal, Plus } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Habit } from '../../store/types'
import Popover, { MenuDivider, MenuItem, usePopover } from '../common/Popover'
import Toggle from '../common/Toggle'
import EmptyState from '../common/EmptyState'
import { DATE_FMT, WEEKDAYS_SHORT, today, weekDays } from '../../utils/date'
import HabitModal from './habit/HabitModal'
import HabitStatsModal from './habit/HabitStatsModal'
import { countBetween, currentStreak } from './habit/helpers'
import '../../styles/habit.css'

export default function HabitView() {
  const { habits, toggleHabitCheckin, updateHabit, setView, toast } = useStore()
  const weekStart = useStore((s) => s.settings.dateTime.weekStart)
  const t = today()
  const [showArchived, setShowArchived] = useState(true)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [stats, setStats] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; editing: Habit | null; seq: number }>({ open: false, editing: null, seq: 0 })

  const titleMenu = usePopover()
  const moreMenu = usePopover()

  const week = useMemo(() => weekDays(t, weekStart), [t, weekStart])
  const weekKeys = week.map((d) => d.format(DATE_FMT))
  const weekFrom = weekKeys[0]
  const weekTo = weekKeys[6]

  const active = habits.filter((h) => !h.archived)
  const archived = habits.filter((h) => h.archived)

  const openNew = () => setModal((m) => ({ open: true, editing: null, seq: m.seq + 1 }))
  const openEdit = (h: Habit) => setModal((m) => ({ open: true, editing: h, seq: m.seq + 1 }))
  const closeModal = () => setModal((m) => ({ ...m, open: false }))

  const renderCard = (h: Habit) => {
    const weekCount = countBetween(h, weekFrom, weekTo)
    const streak = currentStreak(h.checkins, t)
    const todayOn = h.checkins.includes(t)
    const pct = Math.min(100, Math.round((weekCount / Math.max(1, h.goalPerWeek)) * 100))
    const reached = weekCount >= h.goalPerWeek
    return (
      <div key={h.id} className={`hb-card ${h.archived ? 'archived' : ''}`} style={{ ['--hc' as any]: h.color } as React.CSSProperties}>
        <div className="hb-icon">{h.icon}</div>
        <div className="hb-main">
          <span className="hb-name" onClick={() => openEdit(h)} title="点击编辑">
            {h.name}
          </span>
          <div className="hb-meta">
            <span className={reached ? 'done' : ''}>
              本周 {weekCount}/{h.goalPerWeek}
              {reached && ' · 已达成'}
            </span>
            {streak > 0 && (
              <span className="streak">
                <Flame size={13} />
                连续 {streak} 天
              </span>
            )}
          </div>
          <div className="hb-bar">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
        {h.archived ? (
          <button className="hb-restore" onClick={() => { updateHabit(h.id, { archived: false }); toast('已恢复') }}>
            恢复
          </button>
        ) : (
          <>
            <div className="hb-days">
              {week.map((d, i) => {
                const key = weekKeys[i]
                const on = h.checkins.includes(key)
                const future = key > t
                return (
                  <button
                    key={key}
                    type="button"
                    className={`hb-day ${on ? 'on' : ''} ${key === t ? 'today' : ''}`}
                    disabled={future}
                    title={`${d.format('M月D日')}${on ? ' · 已打卡' : future ? '' : ' · 点击打卡'}`}
                    onClick={() => toggleHabitCheckin(h.id, key)}
                  >
                    {on ? <Check size={13} strokeWidth={3} /> : d.date()}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className={`hb-check ${todayOn ? 'on' : ''}`}
              title={todayOn ? '取消今日打卡' : '今日打卡'}
              onClick={() => {
                toggleHabitCheckin(h.id, t)
                if (!todayOn) toast(`${h.icon} ${h.name} 打卡成功`)
              }}
            >
              <Check size={22} strokeWidth={3} />
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">
          <button className="hb-title-btn" onClick={titleMenu.show}>
            习惯
            <ChevronDown size={20} className="chev" />
          </button>
        </h1>
        <div className="header-actions">
          <button className="icon-btn" title="添加习惯" onClick={openNew}>
            <Plus size={22} />
          </button>
          <button className="icon-btn" title="更多" onClick={moreMenu.show}>
            <MoreHorizontal size={22} />
          </button>
        </div>
      </div>

      <div className="hb-body">
        {/* 本周日期条 */}
        <div className="hb-week">
          {week.map((d, i) => {
            const key = weekKeys[i]
            const done = active.filter((h) => h.checkins.includes(key)).length
            const future = key > t
            return (
              <div key={key} className={`day ${key === t ? 'today' : ''} ${future ? 'future' : ''}`}>
                <span className="dow">{key === t ? '今天' : WEEKDAYS_SHORT[d.day()]}</span>
                <span className="num">{d.date()}</span>
                <span className={`cnt ${active.length > 0 && done === active.length ? 'full' : ''}`}>
                  {!future && active.length > 0 ? `${done}/${active.length}` : ''}
                </span>
              </div>
            )
          })}
        </div>

        {active.length === 0 ? (
          <EmptyState kind="tasks" text="暂无习惯，点击右上角 + 添加" />
        ) : (
          <div className="hb-list">{active.map(renderCard)}</div>
        )}

        {showArchived && archived.length > 0 && (
          <>
            <div className={`hb-section ${archivedOpen ? '' : 'collapsed'}`} onClick={() => setArchivedOpen((v) => !v)}>
              <ChevronDown size={16} className="chev" />
              已归档
              <span className="count">{archived.length}</span>
            </div>
            {archivedOpen && <div className="hb-list" style={{ paddingTop: 6 }}>{archived.map(renderCard)}</div>}
          </>
        )}
      </div>

      {/* 标题下拉：切换习惯 / 倒数纪念日 */}
      <Popover open={titleMenu.open} onClose={titleMenu.hide} anchor={titleMenu.anchor} closeOnClick>
        <MenuItem icon={<Clock3 size={16} />} label="习惯" active />
        <MenuItem icon={<CalendarHeart size={16} />} label="倒数纪念日" onClick={() => setView('countdown')} />
      </Popover>

      {/* 更多 */}
      <Popover open={moreMenu.open} onClose={moreMenu.hide} anchor={moreMenu.anchor} align="end" style={{ width: 200 }}>
        <MenuItem
          icon={<Archive size={16} />}
          label="显示已归档"
          onClick={() => setShowArchived((v) => !v)}
          right={<span onClick={(e) => e.stopPropagation()}><Toggle on={showArchived} onChange={setShowArchived} /></span>}
        />
        <MenuDivider />
        <MenuItem icon={<BarChart3 size={16} />} label="统计" onClick={() => { moreMenu.hide(); setStats(true) }} />
      </Popover>

      {modal.open && <HabitModal key={modal.seq} open onClose={closeModal} editing={modal.editing} />}
      <HabitStatsModal open={stats} onClose={() => setStats(false)} />
    </div>
  )
}
