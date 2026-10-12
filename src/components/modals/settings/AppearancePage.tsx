import { Check } from 'lucide-react'
import Toggle from '../../common/Toggle'
import { useStore } from '../../../store/useStore'
import type { Settings } from '../../../store/types'
import { Card, PageHeader, Row, Seg } from './shared'

type Theme = Settings['appearance']['theme']
const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'auto', label: '跟随系统' },
]
const ACCENTS = ['#4772FA', '#F5523C', '#FFB400', '#2DCA8C', '#39C2E3', '#9B6CF6', '#F569A1', '#FF8A3D']

export default function AppearancePage() {
  const { settings, updateSettings } = useStore()
  const ap = settings.appearance
  return (
    <>
      <PageHeader title="外观" desc="选择主题、主题色与字号，打造你喜欢的界面风格。" />
      <Card>
        <Row label="主题" column>
          <div className="theme-cards">
            {THEMES.map((t) => (
              <div key={t.value} className={`theme-card ${ap.theme === t.value ? 'selected' : ''}`} onClick={() => updateSettings({ appearance: { theme: t.value } })}>
                <div className={`prev ${t.value}`}>
                  <div className="p-rail" />
                  <div className="p-body">
                    <div className="p-line short" />
                    <div className="p-line" />
                    <div className="p-line" />
                    <div className="p-line short" />
                  </div>
                </div>
                {t.label}
              </div>
            ))}
          </div>
        </Row>
        <Row label="主题色" column>
          <div className="accent-swatches">
            {ACCENTS.map((c) => {
              const sel = ap.accent.toLowerCase() === c.toLowerCase()
              return (
                <div key={c} className={`accent-swatch ${sel ? 'selected' : ''}`} style={{ background: c }} title={c} onClick={() => updateSettings({ appearance: { accent: c } })}>
                  {sel && (
                    <span className="chk">
                      <Check size={18} strokeWidth={3} />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </Row>
        <Row label="字体大小">
          <Seg
            options={[
              { value: 'small', label: '小' },
              { value: 'normal', label: '正常' },
              { value: 'large', label: '大' },
            ]}
            value={ap.fontSize}
            onChange={(v) => updateSettings({ appearance: { fontSize: v } })}
          />
        </Row>
      </Card>
      <Card>
        <Row label="紧凑模式" desc="缩小任务行高与间距，在同一屏幕中显示更多内容。">
          <Toggle on={ap.compact} onChange={(v) => updateSettings({ appearance: { compact: v } })} />
        </Row>
        <Row label="侧栏显示任务数量" desc="在清单与智能清单右侧显示未完成任务数。">
          <Toggle on={ap.sidebarCount} onChange={(v) => updateSettings({ appearance: { sidebarCount: v } })} />
        </Row>
      </Card>
    </>
  )
}
