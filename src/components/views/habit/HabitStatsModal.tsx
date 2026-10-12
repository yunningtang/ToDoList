import { useMemo } from 'react'
import { useStore } from '../../../store/useStore'
import Modal from '../../common/Modal'
import { DATE_FMT, WEEKDAYS_MIN, dayjs, monthGrid, today } from '../../../utils/date'
import { currentStreak } from './helpers'

interface Props {
  open: boolean
  onClose: () => void
}

/** 统计：每个习惯的总打卡 / 本月打卡 / 连续天数 + 本月点阵 */
export default function HabitStatsModal({ open, onClose }: Props) {
  const habits = useStore((s) => s.habits)
  const weekStart = useStore((s) => s.settings.dateTime.weekStart)
  const t = today()
  const now = dayjs(t)
  const monthStart = now.startOf('month').format(DATE_FMT)
  const monthEnd = now.endOf('month').format(DATE_FMT)
  const grid = useMemo(() => monthGrid(t, weekStart), [t, weekStart])
  const dows = Array.from({ length: 7 }, (_, i) => WEEKDAYS_MIN[(weekStart + i) % 7])
  const ordered = [...habits.filter((h) => !h.archived), ...habits.filter((h) => h.archived)]

  return (
    <Modal open={open} onClose={onClose} title={`统计 · ${now.format('YYYY年M月')}`} width={560}>
      {ordered.length === 0 ? (
        <div className="hb-stats-empty">还没有习惯，先去添加一个吧</div>
      ) : (
        <div className="hb-stats">
          {ordered.map((h) => {
            const set = new Set(h.checkins)
            const monthCount = h.checkins.filter((d) => d >= monthStart && d <= monthEnd).length
            return (
              <div key={h.id} className="hb-stat" style={{ ['--hc' as any]: h.color } as React.CSSProperties}>
                <div className="hb-icon">{h.icon}</div>
                <div className="info">
                  <div className="nm">
                    {h.name}
                    {h.archived && <span className="tag">已归档</span>}
                  </div>
                  <div className="nums">
                    <span>
                      <b>{h.checkins.length}</b>总打卡
                    </span>
                    <span>
                      <b>{monthCount}</b>本月
                    </span>
                    <span>
                      <b>{currentStreak(h.checkins, t)}</b>连续
                    </span>
                  </div>
                </div>
                <div className="hb-month" title="本月打卡">
                  {dows.map((d) => (
                    <span key={d} className="dow">
                      {d}
                    </span>
                  ))}
                  {grid.map((d) => {
                    const key = d.format(DATE_FMT)
                    const other = d.month() !== now.month()
                    return (
                      <span
                        key={key}
                        className={`d ${other ? 'other' : ''} ${set.has(key) ? 'on' : ''} ${key === t ? 'today' : ''}`}
                        title={`${d.format('M月D日')}${set.has(key) ? ' · 已打卡' : ''}`}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
