import { useRef, useState } from 'react'
import { CalendarPlus, FileSpreadsheet, Link2, Unlink } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import { dayjs } from '../../../utils/date'
import { Card, PageHeader, Row } from './shared'

const THIRD_PARTY = [
  { key: 'wechat', name: '微信', desc: '关联后可通过微信服务号快速添加任务并接收提醒。', color: '#07c160', short: '微' },
  { key: 'outlook', name: 'Outlook', desc: '将任务同步到 Outlook 日历与待办。', color: '#0f6cbd', short: 'O' },
  { key: 'google', name: 'Google', desc: '与 Google 日历双向同步日程。', color: '#ea4335', short: 'G' },
]

export default function ImportPage() {
  const { addTask, toast } = useStore()
  const csvRef = useRef<HTMLInputElement>(null)
  const [calUrl, setCalUrl] = useState('')
  const [linked, setLinked] = useState<Record<string, boolean>>({})

  const onCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    let txt = ''
    try {
      txt = await f.text()
    } catch {
      toast('无法读取文件')
      return
    }
    const lines = txt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    let n = 0
    lines.forEach((line, i) => {
      const cells = line.split(',').map((s) => s.trim().replace(/^"(.*)"$/, '$1'))
      const title = cells[0] ?? ''
      const date = cells[1] ?? ''
      if (!title) return
      if (i === 0 && /^(title|标题|任务)$/i.test(title)) return
      let dueDate: string | null = null
      if (date) {
        const d = dayjs(date, ['YYYY-MM-DD', 'YYYY/M/D', 'YYYY-M-D', 'YYYY/MM/DD', 'M/D/YYYY'], true)
        if (d.isValid()) dueDate = d.format('YYYY-MM-DD')
      }
      addTask({ title, dueDate })
      n++
    })
    toast(n ? `已从 CSV 导入 ${n} 个任务` : '未找到可导入的任务')
  }

  const subscribe = () => {
    const u = calUrl.trim()
    if (!/^(https?|webcal):\/\//i.test(u)) {
      toast('请输入有效的日历订阅地址（http / https / webcal）')
      return
    }
    toast('已添加日历订阅（演示：不会实际拉取数据）')
    setCalUrl('')
  }

  return (
    <>
      <PageHeader title="关联与导入" desc="从其他工具导入任务，或关联第三方服务与日历。" />
      <Card title="导入">
        <div className="import-grid">
          <div className="import-card">
            <div className="ic-logo" style={{ background: '#e44332' }}>
              T
            </div>
            <div className="ic-name">Todoist</div>
            <div className="ic-desc">登录 Todoist 账号，导入全部项目与任务。</div>
            <button className="btn sm" onClick={() => toast('Todoist 导入即将上线')}>
              导入
            </button>
          </div>
          <div className="import-card">
            <div className="ic-logo" style={{ background: '#2d7ef7' }}>
              W
            </div>
            <div className="ic-name">Wunderlist</div>
            <div className="ic-desc">导入 Wunderlist 导出的备份文件。</div>
            <button className="btn sm" onClick={() => toast('Wunderlist 导入即将上线')}>
              导入
            </button>
          </div>
          <div className="import-card">
            <div className="ic-logo" style={{ background: '#2dca8c' }}>
              <FileSpreadsheet size={22} />
            </div>
            <div className="ic-name">CSV 文件</div>
            <div className="ic-desc">每行一个任务，格式：标题,日期（日期可留空，如 2026-10-15）。</div>
            <button className="btn sm" onClick={() => csvRef.current?.click()}>
              选择文件
            </button>
            <input ref={csvRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={onCsv} />
          </div>
        </div>
      </Card>

      <Card title="日历订阅">
        <Row label="订阅地址" desc="输入 iCal / webcal 订阅链接，将外部日程显示在日历中。" column>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="input"
              style={{ flex: 1, width: 'auto' }}
              value={calUrl}
              placeholder="https://example.com/calendar.ics"
              onChange={(e) => setCalUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && subscribe()}
            />
            <button className="btn primary" onClick={subscribe}>
              <CalendarPlus size={15} /> 订阅
            </button>
          </div>
        </Row>
      </Card>

      <Card title="第三方关联">
        {THIRD_PARTY.map((p) => {
          const on = !!linked[p.key]
          return (
            <div key={p.key} className="link-row">
              <div className="lr-logo" style={{ background: p.color }}>
                {p.short}
              </div>
              <div className="lr-main">
                <div className="lr-name">
                  {p.name} {on && <span className="st-tag">已关联</span>}
                </div>
                <div className="lr-desc">{p.desc}</div>
              </div>
              <button
                className={`btn sm ${on ? '' : 'primary'}`}
                onClick={() => {
                  setLinked((s) => ({ ...s, [p.key]: !on }))
                  toast(on ? `已解除 ${p.name} 关联` : `已关联 ${p.name}（演示）`)
                }}
              >
                {on ? <Unlink size={14} /> : <Link2 size={14} />} {on ? '解除关联' : '关联'}
              </button>
            </div>
          )
        })}
      </Card>
    </>
  )
}
