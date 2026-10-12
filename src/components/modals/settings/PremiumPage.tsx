import { Check, Crown, Gift } from 'lucide-react'
import Toggle from '../../common/Toggle'
import { useStore } from '../../../store/useStore'
import { dayjs } from '../../../utils/date'
import { Card, PageHeader, Row } from './shared'

const FEATURES: [string, string][] = [
  ['日历视图与时间线', '按日 / 周 / 月查看任务安排，拖拽调整时间'],
  ['便签与桌面小部件', '把任务贴在桌面上，随时查看与记录'],
  ['自定义过滤器', '按清单、优先级、标签、日期组合筛选任务'],
  ['番茄专注统计', '查看专注时长趋势与历史记录'],
  ['AI 智能解析', '自动识别日期、标签与优先级'],
  ['习惯打卡与倒数日', '培养好习惯，记录每一个重要日子'],
  ['主题与个性化', '深色模式、主题色与字号自由搭配'],
  ['多端同步', '桌面、手机、网页数据实时同步'],
]

export default function PremiumPage() {
  const { settings, updateSettings, toast } = useStore()
  const premium = settings.account.premium
  const expire = dayjs().add(1, 'year').format('YYYY年M月D日')

  return (
    <>
      <PageHeader title="高级会员" desc="解锁全部高级功能，让效率更进一步。" />
      <div className="premium-card">
        <div className="pc-head">
          <Crown size={26} fill="#ffc53d" />
          滴答清单 高级会员
        </div>
        <div className="pc-status">
          <span>
            状态：<b>{premium ? '已开通' : '未开通'}</b>
          </span>
          {premium && (
            <>
              <span>
                套餐：<b>年度会员</b>
              </span>
              <span>
                到期日：<b>{expire}</b>
              </span>
            </>
          )}
        </div>
        <div className="pc-foot">
          <button className="btn gold" onClick={() => toast(premium ? '续费成功，已延长一年（演示）' : '开通成功（演示）')}>
            <Crown size={15} /> {premium ? '续费会员' : '立即开通'}
          </button>
          <button className="btn outline" onClick={() => toast('兑换码功能即将上线')}>
            <Gift size={15} /> 兑换码
          </button>
        </div>
      </div>

      <Card title="会员权益">
        <div className="premium-features">
          {FEATURES.map(([t, d]) => (
            <div key={t} className="premium-feature">
              <span className="chk">
                <Check size={12} strokeWidth={3} />
              </span>
              <div>
                <div>{t}</div>
                <div className="sub">{d}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="演示选项">
        <Row label="模拟会员状态" desc="切换当前账号的会员状态，用于预览会员与免费版的界面差异。">
          <Toggle on={premium} onChange={(v) => updateSettings({ account: { premium: v } })} />
        </Row>
      </Card>
    </>
  )
}
