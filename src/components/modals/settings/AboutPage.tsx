import { Check, ExternalLink, RefreshCw } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import { dayjs } from '../../../utils/date'
import { Card, PageHeader, Row } from './shared'

const OSS: [string, string][] = [
  ['React', 'MIT'],
  ['Zustand', 'MIT'],
  ['Day.js', 'MIT'],
  ['Lucide Icons', 'ISC'],
  ['Vite', 'MIT'],
  ['TypeScript', 'Apache-2.0'],
  ['Electron', 'MIT'],
]

export default function AboutPage() {
  const { toast } = useStore()
  return (
    <>
      <PageHeader title="关于" />
      <Card>
        <div className="about-head">
          <div className="about-logo">
            <Check size={44} strokeWidth={3.5} />
          </div>
          <div>
            <div className="name">滴答清单 (桌面版)</div>
            <div className="ver">版本 1.0.0 · 构建 {dayjs().format('YYYYMMDD')}</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn" onClick={() => toast('当前已是最新版本')}>
              <RefreshCw size={15} /> 检查更新
            </button>
          </div>
        </div>
        <Row label="用户协议">
          <button className="btn sm ghost" onClick={() => window.open('https://dida365.com/about/tos', '_blank')}>
            查看 <ExternalLink size={13} />
          </button>
        </Row>
        <Row label="隐私政策">
          <button className="btn sm ghost" onClick={() => window.open('https://dida365.com/about/privacy', '_blank')}>
            查看 <ExternalLink size={13} />
          </button>
        </Row>
        <Row label="帮助中心">
          <button className="btn sm ghost" onClick={() => window.open('https://help.dida365.com', '_blank')}>
            前往 <ExternalLink size={13} />
          </button>
        </Row>
      </Card>
      <Card title="开源组件">
        <div className="oss-list">
          {OSS.map(([n, l]) => (
            <div key={n} className="oss-item">
              <span>{n}</span>
              <span className="lic">{l}</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="st-note">© {dayjs().year()} 滴答清单风格练习项目。本应用为学习用途的仿制品，与官方产品无关。</div>
    </>
  )
}
