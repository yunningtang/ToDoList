import { useEffect, useState } from 'react'
import Toggle from '../../common/Toggle'
import { useStore } from '../../../store/useStore'
import { dayjs, formatClock, getTimeFormat, setTimeFormat, WEEKDAYS_SHORT } from '../../../utils/date'
import { lunarText, toLunar } from '../../../utils/lunar'
import { Card, PageHeader, Row, Seg } from './shared'

export default function DateTimePage() {
  const { settings, updateSettings } = useStore()
  const d = settings.dateTime
  // 渲染期同步全局时间格式，保证示例文本随设置即时变化
  if (getTimeFormat() !== d.timeFormat) setTimeFormat(d.timeFormat)

  // 每分钟刷新一次示例时间
  const [now, setNow] = useState(() => dayjs())
  useEffect(() => {
    let timer = 0
    const schedule = () => {
      timer = window.setTimeout(() => {
        setNow(dayjs())
        schedule()
      }, 60000 - (Date.now() % 60000) + 50)
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [])

  const sample = formatClock(now.format('HH:mm'))
  const sampleRange = `${formatClock('09:00')} - ${formatClock('13:30')}`
  const lunar = toLunar(now)
  const lunarDesc = lunar ? `今天：${lunarText(now)} · ${lunar.ganzhiYear}${lunar.zodiac}年${lunar.term ? ` · ${lunar.term}` : ''}${lunar.festival ? ` · ${lunar.festival}` : ''}` : ''

  return (
    <>
      <PageHeader title="日期与时间" desc="设置一周的起始日、时间格式以及日历中显示的附加信息。" />
      <Card>
        <Row label="一周开始于" desc={`本周从 ${WEEKDAYS_SHORT[d.weekStart]} 开始。`}>
          <select className="select" value={d.weekStart} onChange={(e) => updateSettings({ dateTime: { weekStart: Number(e.target.value) as 0 | 1 | 6 } })}>
            <option value={1}>周一</option>
            <option value={0}>周日</option>
            <option value={6}>周六</option>
          </select>
        </Row>
        <Row label="时间格式" desc={`现在是 ${sample}；时间段示例：${sampleRange}。日历、时间线与专注记录均按此显示。`}>
          <Seg
            options={[
              { value: '24h', label: '24 小时制' },
              { value: '12h', label: '12 小时制' },
            ]}
            value={d.timeFormat}
            onChange={(v) => {
              setTimeFormat(v)
              updateSettings({ dateTime: { timeFormat: v } })
            }}
          />
        </Row>
        <Row label="显示农历" desc={d.showLunar && lunarDesc ? `在日历中显示农历日期、节气与传统节日。${lunarDesc}` : '在日历中显示农历日期、节气与传统节日。'}>
          <Toggle on={d.showLunar} onChange={(v) => updateSettings({ dateTime: { showLunar: v } })} />
        </Row>
        <Row label="显示周数" desc={`在日历周视图中显示周序号（当前为第 ${now.isoWeek()} 周）。`}>
          <Toggle on={d.showWeekNumber} onChange={(v) => updateSettings({ dateTime: { showWeekNumber: v } })} />
        </Row>
      </Card>
    </>
  )
}
