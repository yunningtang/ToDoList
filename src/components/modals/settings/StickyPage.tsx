import { Check, ChevronDown, ChevronUp, Crown, LayoutGrid, Shuffle } from 'lucide-react'
import Toggle from '../../common/Toggle'
import { useStore } from '../../../store/useStore'
import type { Settings } from '../../../store/types'
import { Card, PageHeader, Row } from './shared'

const COLORS = ['#fff3b0', '#ffd6c4', '#ffb3b3', '#cdeefc', '#c9dbff', '#d9ccff', '#b9e8c6', '#ffffff', '#efefef', '#3a3a3a', '#1e2a44', '#111111']
const RANDOM = 'random'

type FontSize = Settings['sticky']['fontSize']
type Gap = Settings['sticky']['gap']
const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'small', label: '小' },
  { value: 'normal', label: '正常' },
  { value: 'large', label: '大' },
]
const GAPS: { value: Gap; label: string; px: number }[] = [
  { value: 'small', label: '小', px: 4 },
  { value: 'normal', label: '正常', px: 12 },
  { value: 'large', label: '大', px: 20 },
  { value: 'xlarge', label: '超大', px: 30 },
]

export default function StickyPage() {
  const { settings, updateSettings, toast } = useStore()
  const s = settings.sticky
  const premium = settings.account.premium
  const fsIdx = Math.max(0, FONT_SIZES.findIndex((f) => f.value === s.fontSize))
  const pct = Math.round(((s.opacity - 20) / 80) * 100)

  /** 改便签设置：写入设置，并让已打开的便签窗口立即生效（主进程应用到全部便签；字号等由便签重新读取设置） */
  const applySticky = (patch: Partial<Settings['sticky']>, winOpts?: { alwaysOnTop?: boolean; opacity?: number; skipTaskbar?: boolean }) => {
    updateSettings({ sticky: patch })
    const d = window.desktop
    if (!d) return
    if (winOpts) void d.setStickyOptions(winOpts)
    // 等本地写入（150ms 防抖）落盘后再通知其他窗口重新读取
    window.setTimeout(() => d.broadcastDataChanged(), 300)
  }
  const pickColor = (c: string, needsPremium: boolean) => {
    if (needsPremium && !premium) {
      toast('该颜色为高级会员专属')
      return
    }
    applySticky({ defaultColor: c })
  }
  const stepFont = (delta: number) => {
    const next = FONT_SIZES[Math.max(0, Math.min(FONT_SIZES.length - 1, fsIdx + delta))]
    if (next) applySticky({ fontSize: next.value })
  }
  const arrange = () => {
    const d = window.desktop
    if (!d) {
      toast('排列便签需要在桌面版中使用')
      return
    }
    void d.arrangeStickies(s.restoreSizeOnArrange, s.gap)
  }

  return (
    <>
      <PageHeader
        title="便签"
        desc={
          <>
            将任务以便签的形式贴在桌面上，随时记录你的想法。(右键任务选择"打开便签"){' '}
            <a onClick={() => window.open('https://help.dida365.com', '_blank')}>了解详情</a>
          </>
        }
      />
      <Card>
        <Row label="默认颜色" column>
          <div className="sticky-swatches">
            {[...COLORS, RANDOM].map((c, i) => {
              const sel = s.defaultColor.toLowerCase() === c.toLowerCase()
              const needsPremium = i > 0
              const isRandom = c === RANDOM
              return (
                <div key={c} className={`sticky-swatch ${isRandom ? 'random' : ''}`} title={isRandom ? '随机颜色' : c} onClick={() => pickColor(c, needsPremium)}>
                  <div className="inner" style={isRandom ? undefined : { background: c }}>
                    {isRandom && <Shuffle size={18} />}
                    {needsPremium && (
                      <span className="crown-badge">
                        <Crown size={9} strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                  {sel && (
                    <span className="sel-chk">
                      <Check size={13} strokeWidth={3} />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </Row>
        <Row label="不透明度">
          <span style={{ fontSize: 13, color: 'var(--text-3)', width: 40, textAlign: 'right' }}>{s.opacity}%</span>
          <input
            type="range"
            className="slider"
            min={20}
            max={100}
            step={5}
            value={s.opacity}
            style={{ ['--pct' as any]: `${pct}%` } as React.CSSProperties}
            onChange={(e) => applySticky({ opacity: Number(e.target.value) }, { opacity: Number(e.target.value) })}
          />
        </Row>
        <Row label="字体大小">
          <div className="st-stepper">
            <span>{FONT_SIZES[fsIdx]?.label ?? '正常'}</span>
            <div className="arrows">
              <button onClick={() => stepFont(1)} disabled={fsIdx >= FONT_SIZES.length - 1} aria-label="增大">
                <ChevronUp size={13} />
              </button>
              <button onClick={() => stepFont(-1)} disabled={fsIdx <= 0} aria-label="减小">
                <ChevronDown size={13} />
              </button>
            </div>
          </div>
        </Row>
      </Card>

      <Card>
        <Row label="默认置顶">
          <Toggle on={s.alwaysOnTop} onChange={(v) => applySticky({ alwaysOnTop: v }, { alwaysOnTop: v })} />
        </Row>
        <Row label="不在任务栏显示" desc="启用后，便签将不在系统任务栏中显示，你可以通过 Win+Tab 快捷键查看所有已打开的便签。">
          <Toggle on={s.hideFromTaskbar} onChange={(v) => applySticky({ hideFromTaskbar: v }, { skipTaskbar: v })} />
        </Row>
        <Row label="排列便签" desc="将所有已打开的便签按默认间距整齐排列在主显示器上。">
          <button className="btn" onClick={arrange} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <LayoutGrid size={15} />
            排列便签
          </button>
        </Row>
        <Row label="排列恢复默认大小" desc="启用后，排列时便签将恢复为默认大小。">
          <Toggle on={s.restoreSizeOnArrange} onChange={(v) => updateSettings({ sticky: { restoreSizeOnArrange: v } })} />
        </Row>
        <Row label="默认便签间距" column>
          <div className="gap-tiles">
            {GAPS.map((g) => (
              <div key={g.value} className={`gap-tile ${s.gap === g.value ? 'selected' : ''}`} onClick={() => updateSettings({ sticky: { gap: g.value } })}>
                <div className="box">
                  <div className="note" />
                  <div className="conn" style={{ width: g.px }} />
                  <div className="note" />
                  {s.gap === g.value && (
                    <span className="sel-chk">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </div>
                {g.label}
              </div>
            ))}
          </div>
        </Row>
      </Card>
    </>
  )
}
