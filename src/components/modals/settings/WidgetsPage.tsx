import Toggle from '../../common/Toggle'
import { useStore } from '../../../store/useStore'
import type { Settings } from '../../../store/types'
import { Card, PageHeader } from './shared'

type WidgetKind = 'today' | 'calendar' | 'pomo'
const KIND_KEY: Record<WidgetKind, keyof Settings['widgets']> = { today: 'todayWidget', calendar: 'calendarWidget', pomo: 'pomoWidget' }

export default function WidgetsPage() {
  const { settings, updateSettings } = useStore()
  const w = settings.widgets
  const desktop = !!window.desktop

  const toggle = (kind: WidgetKind, on: boolean) => {
    updateSettings({ widgets: { [KIND_KEY[kind]]: on } })
    const d = window.desktop
    if (!d) return
    void (on ? d.openWidget(kind) : d.closeWidget(kind))
  }

  return (
    <>
      <PageHeader title="桌面小部件" desc="将任务、日历与番茄计时固定在桌面上，无需打开主窗口即可查看与操作。" />
      {!desktop && <div className="st-note">桌面小部件需要在桌面版中使用，当前在浏览器中仅保存开关状态。</div>}
      <Card>
        <div className="widget-cards">
          <div className="widget-card">
            <div className="wc-head">
              今日任务
              <Toggle on={w.todayWidget} onChange={(v) => toggle('today', v)} />
            </div>
            <div className={`widget-prev ${w.todayWidget ? '' : 'off'}`}>
              <div className="wp-title" />
              <div className="wp-row">
                <span className="wp-cb done" />
                <span className="wp-line" style={{ maxWidth: '70%' }} />
              </div>
              <div className="wp-row">
                <span className="wp-cb" />
                <span className="wp-line" />
              </div>
              <div className="wp-row">
                <span className="wp-cb" />
                <span className="wp-line" style={{ maxWidth: '55%' }} />
              </div>
              <div className="wp-row">
                <span className="wp-cb" />
                <span className="wp-line" style={{ maxWidth: '80%' }} />
              </div>
            </div>
            <div className="wc-desc">显示今天与已过期的任务，可直接勾选完成。</div>
          </div>

          <div className="widget-card">
            <div className="wc-head">
              月历
              <Toggle on={w.calendarWidget} onChange={(v) => toggle('calendar', v)} />
            </div>
            <div className={`widget-prev ${w.calendarWidget ? '' : 'off'}`}>
              <div className="wp-title" style={{ width: '30%' }} />
              <div className="wp-grid">
                {Array.from({ length: 28 }, (_, i) => (
                  <span key={i} className={`wp-cell ${i === 9 ? 'on' : [3, 12, 17, 22].includes(i) ? 'soft' : ''}`} />
                ))}
              </div>
            </div>
            <div className="wc-desc">按月查看日程，有任务的日期会高亮显示。</div>
          </div>

          <div className="widget-card">
            <div className="wc-head">
              番茄计时
              <Toggle on={w.pomoWidget} onChange={(v) => toggle('pomo', v)} />
            </div>
            <div className={`widget-prev ${w.pomoWidget ? '' : 'off'}`}>
              <div className="wp-ring" />
            </div>
            <div className="wc-desc">在桌面上显示当前番茄进度，支持开始与暂停。</div>
          </div>
        </div>
      </Card>
      <div className="st-note">小部件为独立小窗口，不在任务栏显示；拖动顶部标题栏可移动，拖动边缘可调整尺寸，关闭主窗口后小部件仍保留。</div>
    </>
  )
}
