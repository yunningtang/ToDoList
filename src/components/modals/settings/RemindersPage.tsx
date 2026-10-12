import { BellRing } from 'lucide-react'
import Toggle from '../../common/Toggle'
import { useStore } from '../../../store/useStore'
import type { Settings } from '../../../store/types'
import { Card, PageHeader, Row } from './shared'

type DefaultReminder = Settings['reminders']['defaultReminder']

const REMINDER_OPTIONS: { value: DefaultReminder; label: string }[] = [
  { value: 'none', label: '不提醒' },
  { value: 'onTime', label: '准时' },
  { value: '30m', label: '提前 30 分钟' },
  { value: '1h', label: '提前 1 小时' },
  { value: '1d', label: '提前 1 天' },
]

export default function RemindersPage() {
  const { settings, updateSettings, toast } = useStore()
  const r = settings.reminders

  const testNotification = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast('当前环境不支持系统通知')
      return
    }
    try {
      let perm = Notification.permission
      if (perm === 'default') perm = await Notification.requestPermission()
      if (perm === 'granted') {
        new Notification('滴答清单', { body: '这是一条测试通知，提醒功能工作正常。' })
        toast('已发送测试通知')
      } else {
        toast('通知权限未开启，请在系统设置中允许通知')
      }
    } catch {
      toast('无法发送通知')
    }
  }

  return (
    <>
      <PageHeader title="提醒与通知" desc="设置任务提醒方式以及每日回顾。" />
      <Card>
        <Row label="开启提醒" desc="到达任务提醒时间时弹出系统通知。">
          <Toggle on={r.enabled} onChange={(v) => updateSettings({ reminders: { enabled: v } })} />
        </Row>
        <Row label="提醒声音" desc="提醒时播放提示音。">
          <Toggle on={r.sound} disabled={!r.enabled} onChange={(v) => updateSettings({ reminders: { sound: v } })} />
        </Row>
        <Row label="默认提醒时间" desc="新建带日期的任务时默认使用的提醒设置。">
          <select className="select" value={r.defaultReminder} onChange={(e) => updateSettings({ reminders: { defaultReminder: e.target.value as DefaultReminder } })}>
            {REMINDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="测试通知" desc="发送一条测试通知，检查系统通知权限是否正常。">
          <button className="btn sm" onClick={testNotification}>
            <BellRing size={14} /> 测试通知
          </button>
        </Row>
      </Card>

      <Card title="每日回顾">
        <Row label="开启每日回顾" desc="每天在固定时间提醒你回顾今天的任务安排。">
          <Toggle on={r.dailyReview} onChange={(v) => updateSettings({ reminders: { dailyReview: v } })} />
        </Row>
        <Row label="回顾时间">
          <input
            type="time"
            className="input"
            value={r.dailyReviewTime}
            disabled={!r.dailyReview}
            onChange={(e) => e.target.value && updateSettings({ reminders: { dailyReviewTime: e.target.value } })}
          />
        </Row>
      </Card>
    </>
  )
}
