import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import {
  Bell,
  Clock,
  Crown,
  Filter,
  Info,
  Keyboard,
  LayoutGrid,
  LayoutPanelTop,
  Link,
  Palette,
  SlidersHorizontal,
  Sparkles,
  StickyNote,
  User,
  Users,
  X,
} from 'lucide-react'
import Modal from '../common/Modal'
import { useStore } from '../../store/useStore'
import type { SettingsPage } from '../../store/useStore'
import AccountPage from './settings/AccountPage'
import PremiumPage from './settings/PremiumPage'
import ModulesPage from './settings/ModulesPage'
import SmartListsPage from './settings/SmartListsPage'
import RemindersPage from './settings/RemindersPage'
import DateTimePage from './settings/DateTimePage'
import AppearancePage from './settings/AppearancePage'
import AiPage from './settings/AiPage'
import MorePage from './settings/MorePage'
import ImportPage from './settings/ImportPage'
import SharePage from './settings/SharePage'
import StickyPage from './settings/StickyPage'
import WidgetsPage from './settings/WidgetsPage'
import ShortcutsPage from './settings/ShortcutsPage'
import AboutPage from './settings/AboutPage'
import '../../styles/settings.css'

const NAV: { key: SettingsPage; label: string; icon: ReactNode }[][] = [
  [
    { key: 'account', label: '账号', icon: <User size={22} /> },
    { key: 'premium', label: '高级会员', icon: <Crown size={22} /> },
  ],
  [
    { key: 'modules', label: '功能模块', icon: <LayoutGrid size={22} /> },
    { key: 'smartLists', label: '智能清单', icon: <Filter size={22} /> },
    { key: 'reminders', label: '提醒与通知', icon: <Bell size={22} /> },
    { key: 'dateTime', label: '日期与时间', icon: <Clock size={22} /> },
    { key: 'appearance', label: '外观', icon: <Palette size={22} /> },
    { key: 'ai', label: 'AI 功能', icon: <Sparkles size={22} /> },
    { key: 'more', label: '更多设置', icon: <SlidersHorizontal size={22} /> },
  ],
  [
    { key: 'import', label: '关联与导入', icon: <Link size={22} /> },
    { key: 'share', label: '共享协作', icon: <Users size={22} /> },
    { key: 'sticky', label: '便签', icon: <StickyNote size={22} /> },
    { key: 'widgets', label: '桌面小部件', icon: <LayoutPanelTop size={22} /> },
    { key: 'shortcuts', label: '快捷键', icon: <Keyboard size={22} /> },
  ],
  [{ key: 'about', label: '关于', icon: <Info size={22} /> }],
]

const PAGES: Record<SettingsPage, () => JSX.Element> = {
  account: AccountPage,
  premium: PremiumPage,
  modules: ModulesPage,
  smartLists: SmartListsPage,
  reminders: RemindersPage,
  dateTime: DateTimePage,
  appearance: AppearancePage,
  ai: AiPage,
  more: MorePage,
  import: ImportPage,
  share: SharePage,
  sticky: StickyPage,
  widgets: WidgetsPage,
  shortcuts: ShortcutsPage,
  about: AboutPage,
}

export default function SettingsModal() {
  const settingsOpen = useStore((s) => s.settingsOpen)
  const settingsPage = useStore((s) => s.settingsPage)
  const openSettings = useStore((s) => s.openSettings)
  const contentRef = useRef<HTMLDivElement>(null)
  const Page = PAGES[settingsPage] ?? AccountPage

  // 切换页面时回到顶部
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [settingsPage, settingsOpen])

  const close = () => openSettings(false)

  return (
    <Modal open={settingsOpen} onClose={close} bare className="settings-modal">
      <button className="icon-btn st-close" onClick={close} aria-label="关闭">
        <X size={22} />
      </button>
      <nav className="st-nav">
        <div className="st-nav-title">设置</div>
        {NAV.map((group, gi) => (
          <div key={gi} className="st-nav-group">
            {group.map((it) => (
              <button key={it.key} className={`st-nav-item ${settingsPage === it.key ? 'active' : ''}`} onClick={() => openSettings(true, it.key)}>
                {it.icon}
                {it.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="st-content" ref={contentRef} key={settingsPage}>
        <Page />
      </div>
    </Modal>
  )
}
