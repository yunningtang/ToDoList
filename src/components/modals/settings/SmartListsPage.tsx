import { CalendarDays, CalendarRange, CheckCircle2, Inbox, Layers, Sun, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import Toggle from '../../common/Toggle'
import { useStore } from '../../../store/useStore'
import type { Settings } from '../../../store/types'
import { Card, PageHeader, Row } from './shared'

type Key = keyof Settings['smartLists']

const ITEMS: { key: Key; label: string; desc: string; icon: ReactNode }[] = [
  { key: 'all', label: '所有', desc: '显示所有未删除的任务。', icon: <Layers size={18} /> },
  { key: 'today', label: '今天', desc: '今天到期以及已过期的任务。', icon: <Sun size={18} /> },
  { key: 'tomorrow', label: '明天', desc: '明天到期的任务。', icon: <CalendarDays size={18} /> },
  { key: 'next7', label: '最近7天', desc: '未来 7 天内到期的任务。', icon: <CalendarRange size={18} /> },
  { key: 'inbox', label: '收集箱', desc: '未归入任何清单的任务。', icon: <Inbox size={18} /> },
  { key: 'completed', label: '已完成', desc: '所有已完成的任务。', icon: <CheckCircle2 size={18} /> },
  { key: 'trash', label: '垃圾桶', desc: '已删除的任务，可恢复或永久删除。', icon: <Trash2 size={18} /> },
]

export default function SmartListsPage() {
  const { settings, updateSettings } = useStore()
  const sl = settings.smartLists
  return (
    <>
      <PageHeader title="智能清单" desc="智能清单会根据日期与状态自动汇总任务，选择在任务侧栏中显示哪些智能清单。" />
      <Card>
        {ITEMS.map((it) => (
          <Row
            key={it.key}
            label={
              <>
                <span style={{ color: 'var(--text-2)', display: 'inline-flex' }}>{it.icon}</span>
                {it.label}
              </>
            }
            desc={it.desc}
          >
            <Toggle on={sl[it.key]} onChange={(v) => updateSettings({ smartLists: { [it.key]: v } })} />
          </Row>
        ))}
      </Card>
    </>
  )
}
