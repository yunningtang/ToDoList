import { Calendar, CalendarHeart, CheckSquare, Clock3, LayoutGrid, Target } from 'lucide-react'
import type { ReactNode } from 'react'
import Toggle from '../../common/Toggle'
import { useStore } from '../../../store/useStore'
import type { CalendarMode, Priority, QuadrantRule, ViewKey } from '../../../store/types'
import { PRIORITIES, PRIORITY_META } from '../../../utils/task'
import { Card, NumberInput, PageHeader, Row, Seg } from './shared'

const MODULES: { key: ViewKey; label: string; desc: string; icon: ReactNode }[] = [
  { key: 'quadrant', label: '四象限', desc: '按重要与紧急程度将任务分到四个象限，专注当下最重要的事。', icon: <LayoutGrid size={18} /> },
  { key: 'tasks', label: '任务', desc: '核心的任务与清单管理，无法关闭。', icon: <CheckSquare size={18} /> },
  { key: 'calendar', label: '日历', desc: '以日 / 周 / 月视图安排任务与日程。', icon: <Calendar size={18} /> },
  { key: 'pomodoro', label: '番茄专注', desc: '番茄计时与正计时，记录每一次专注。', icon: <Target size={18} /> },
  { key: 'habit', label: '习惯', desc: '培养好习惯，每日打卡并查看坚持进度。', icon: <Clock3 size={18} /> },
  { key: 'countdown', label: '倒数纪念日', desc: '记录纪念日、倒数日与节日。', icon: <CalendarHeart size={18} /> },
]

const QUADRANT_NAMES: Record<'1' | '2' | '3' | '4', string> = {
  '1': '第一象限 · 重要且紧急',
  '2': '第二象限 · 重要不紧急',
  '3': '第三象限 · 紧急不重要',
  '4': '第四象限 · 不重要不紧急',
}

export default function ModulesPage() {
  const { settings, updateSettings } = useStore()
  const { modules, quadrantRules, quadrantGroupBy, calendar, pomodoro } = settings

  const setQuadrant = (q: '1' | '2' | '3' | '4', p: Priority) => {
    const cur = quadrantRules[q].priorities
    const priorities = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]
    const patch: Partial<Record<'1' | '2' | '3' | '4', QuadrantRule>> = {}
    patch[q] = { priorities }
    updateSettings({ quadrantRules: patch })
  }

  return (
    <>
      <PageHeader title="功能模块" desc="选择在左侧导航栏中显示的功能模块，关闭的模块不会删除其数据。" />
      <Card>
        {MODULES.map((m) => (
          <Row
            key={m.key}
            label={
              <>
                <span style={{ color: 'var(--text-2)', display: 'inline-flex' }}>{m.icon}</span>
                {m.label}
                {m.key === 'tasks' && <span className="st-tag grey">必选</span>}
              </>
            }
            desc={m.desc}
          >
            <Toggle on={modules[m.key]} disabled={m.key === 'tasks'} onChange={(v) => updateSettings({ modules: { [m.key]: v } })} />
          </Row>
        ))}
      </Card>

      {modules.quadrant && (
        <Card title="四象限">
          {(['1', '2', '3', '4'] as const).map((q) => (
            <Row key={q} label={QUADRANT_NAMES[q]} desc="点击优先级以切换归属该象限的任务">
              <div className="pri-pills">
                {PRIORITIES.map((p) => {
                  const on = quadrantRules[q].priorities.includes(p)
                  return (
                    <button
                      key={p}
                      className={`pri-pill ${on ? 'on' : ''}`}
                      style={{ ['--pc' as any]: PRIORITY_META[p].color } as React.CSSProperties}
                      onClick={() => setQuadrant(q, p)}
                    >
                      {PRIORITY_META[p].short}
                    </button>
                  )
                })}
              </div>
            </Row>
          ))}
          <Row label="象限内分组">
            <Seg
              options={[
                { value: 'none', label: '不分组' },
                { value: 'list', label: '按清单' },
                { value: 'date', label: '按日期' },
              ]}
              value={quadrantGroupBy}
              onChange={(v) => updateSettings({ quadrantGroupBy: v })}
            />
          </Row>
        </Card>
      )}

      {modules.calendar && (
        <Card title="日历">
          <Row label="默认视图">
            <Seg<CalendarMode>
              options={[
                { value: 'day', label: '日' },
                { value: 'week', label: '周' },
                { value: 'month', label: '月' },
              ]}
              value={calendar.defaultMode}
              onChange={(v) => updateSettings({ calendar: { defaultMode: v } })}
            />
          </Row>
          <Row label="显示已完成任务">
            <Toggle on={calendar.showCompleted} onChange={(v) => updateSettings({ calendar: { showCompleted: v } })} />
          </Row>
          <Row label="显示倒数纪念日" desc="在日历中显示设置了「在日历中显示」的倒数日。">
            <Toggle on={calendar.showCountdowns} onChange={(v) => updateSettings({ calendar: { showCountdowns: v } })} />
          </Row>
        </Card>
      )}

      {modules.pomodoro && (
        <Card title="番茄专注">
          <Row label="番茄时长（分钟）">
            <NumberInput value={pomodoro.pomoMinutes} min={1} max={180} onChange={(v) => updateSettings({ pomodoro: { pomoMinutes: v } })} />
          </Row>
          <Row label="短休息（分钟）">
            <NumberInput value={pomodoro.shortBreak} min={1} max={60} onChange={(v) => updateSettings({ pomodoro: { shortBreak: v } })} />
          </Row>
          <Row label="长休息（分钟）">
            <NumberInput value={pomodoro.longBreak} min={1} max={120} onChange={(v) => updateSettings({ pomodoro: { longBreak: v } })} />
          </Row>
          <Row label="长休息间隔" desc="每完成多少个番茄后进入长休息。">
            <NumberInput value={pomodoro.longBreakEvery} min={1} max={12} onChange={(v) => updateSettings({ pomodoro: { longBreakEvery: v } })} />
          </Row>
          <Row label="每日目标（番茄数）">
            <NumberInput value={pomodoro.dailyGoal} min={1} max={50} onChange={(v) => updateSettings({ pomodoro: { dailyGoal: v } })} />
          </Row>
          <Row label="自动开始休息">
            <Toggle on={pomodoro.autoStartBreak} onChange={(v) => updateSettings({ pomodoro: { autoStartBreak: v } })} />
          </Row>
          <Row label="休息后自动开始下一个番茄">
            <Toggle on={pomodoro.autoStartPomo} onChange={(v) => updateSettings({ pomodoro: { autoStartPomo: v } })} />
          </Row>
          <Row label="结束提示音">
            <Toggle on={pomodoro.sound} onChange={(v) => updateSettings({ pomodoro: { sound: v } })} />
          </Row>
        </Card>
      )}
    </>
  )
}
