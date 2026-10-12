import { Bell, Calendar, CheckSquare, CircleHelp, Clock3, Crown, LayoutGrid, RefreshCw, Search, Target, CalendarHeart, Keyboard, MessageSquare, BookOpen, Info, Settings as SettingsIcon, LogOut, User } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { ViewKey } from '../store/types'
import Popover, { MenuDivider, MenuItem, MenuTitle, usePopover } from './common/Popover'
import { humanDate, isOverdue, isToday, dayjs } from '../utils/date'

const VIEWS: { key: ViewKey; label: string; icon: React.ReactNode }[] = [
  { key: 'quadrant', label: '四象限', icon: <LayoutGrid size={26} /> },
  { key: 'tasks', label: '任务', icon: <CheckSquare size={26} /> },
  { key: 'calendar', label: '日历', icon: <Calendar size={26} /> },
  { key: 'pomodoro', label: '番茄专注', icon: <Target size={26} /> },
  { key: 'habit', label: '习惯', icon: <Clock3 size={26} /> },
  { key: 'countdown', label: '倒数纪念日', icon: <CalendarHeart size={26} /> },
]

/** 最左侧蓝色导航栏 */
export default function Rail() {
  const { view, setView, openSearch, openSettings, settings, sync, syncing, pendingSync, lastSyncAt, tasks, toast, resetAll } = useStore()
  const helpMenu = usePopover()
  const syncTitle = [
    syncing ? '同步中…' : '同步',
    lastSyncAt ? `上次同步 ${humanDate(dayjs(lastSyncAt).format('YYYY-MM-DD'), dayjs(lastSyncAt).format('HH:mm'))}` : '尚未同步',
    pendingSync > 0 ? `待同步 ${pendingSync} 条` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const notif = usePopover()
  const acct = usePopover()
  const live = tasks.filter((t) => !t.deleted && !t.completed)
  const reminders = live.filter((t) => isToday(t.dueDate) || isOverdue(t.dueDate)).slice(0, 8)
  const initials = settings.account.name.slice(0, 1).toUpperCase() || 'U'

  return (
    <aside className="rail">
      <div className="avatar-wrap" onClick={acct.show} title={settings.account.name}>
        <div className="avatar">{settings.account.avatar ? <img src={settings.account.avatar} alt="" /> : initials}</div>
        {settings.account.premium && (
          <span className="crown">
            <Crown size={11} fill="#ffe08a" />
          </span>
        )}
      </div>
      {VIEWS.filter((v) => settings.modules[v.key]).map((v) => (
        <button key={v.key} className={`rail-btn ${view === v.key ? 'active' : ''}`} title={v.label} onClick={() => setView(v.key)}>
          {v.icon}
        </button>
      ))}
      <button className="rail-btn" title="搜索 (Ctrl+F)" onClick={() => openSearch(true)}>
        <Search size={26} />
      </button>
      <div className="spacer" />
      <button className="rail-btn" title={syncTitle} onClick={() => void sync()}>
        <RefreshCw size={24} className={syncing ? 'spin' : ''} />
        {pendingSync > 0 && (
          <span
            className="badge"
            style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, fontSize: 10, padding: '0 4px', border: '2px solid var(--rail-bg)', boxSizing: 'content-box' }}
          >
            {pendingSync > 99 ? '99+' : pendingSync}
          </span>
        )}
      </button>
      <button className="rail-btn" title="通知" onClick={notif.show}>
        <Bell size={24} />
        {reminders.length > 0 && <span className="dot" />}
      </button>
      <button className="rail-btn" title="帮助" onClick={helpMenu.show}>
        <CircleHelp size={24} />
        <span className="dot" />
      </button>

      {/* 账号菜单 */}
      <Popover open={acct.open} onClose={acct.hide} anchor={acct.anchor} placement="right" closeOnClick>
        <div style={{ padding: '8px 10px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar" style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{settings.account.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{settings.account.email}</div>
          </div>
        </div>
        <MenuDivider />
        <MenuItem icon={<User size={16} />} label="账号与设置" onClick={() => openSettings(true, 'account')} />
        <MenuItem icon={<Crown size={16} />} label={settings.account.premium ? '高级会员 · 已开通' : '升级高级会员'} onClick={() => openSettings(true, 'premium')} />
        <MenuItem icon={<SettingsIcon size={16} />} label="设置" onClick={() => openSettings(true)} />
        <MenuDivider />
        <MenuItem icon={<LogOut size={16} />} label="退出登录（重置数据）" danger onClick={() => { if (confirm('将清空本地数据并恢复示例内容，确定？')) { resetAll(); toast('已重置') } }} />
      </Popover>

      {/* 通知 */}
      <Popover open={notif.open} onClose={notif.hide} anchor={notif.anchor} placement="right" align="end" style={{ width: 320 }}>
        <MenuTitle>通知 · 今日与过期任务</MenuTitle>
        {reminders.length === 0 && <div style={{ padding: '16px 10px', color: 'var(--text-3)', fontSize: 14 }}>暂无通知</div>}
        {reminders.map((t) => (
          <MenuItem
            key={t.id}
            icon={<span className="color-dot" style={{ background: isOverdue(t.dueDate) ? 'var(--danger)' : 'var(--accent)' }} />}
            label={t.title}
            hint={humanDate(t.dueDate, t.dueTime)}
            onClick={() => {
              notif.hide()
              setView('tasks')
              useStore.getState().setSelection({ type: 'smart', id: 'today' })
              useStore.getState().selectTask(t.id)
            }}
          />
        ))}
        <MenuDivider />
        <MenuItem icon={<Bell size={16} />} label="提醒设置" onClick={() => { notif.hide(); openSettings(true, 'reminders') }} />
      </Popover>

      {/* 帮助 */}
      <Popover open={helpMenu.open} onClose={helpMenu.hide} anchor={helpMenu.anchor} placement="right" align="end" closeOnClick>
        <MenuItem icon={<BookOpen size={16} />} label="帮助中心" onClick={() => window.open('https://help.dida365.com', '_blank')} />
        <MenuItem icon={<Keyboard size={16} />} label="快捷键" onClick={() => openSettings(true, 'shortcuts')} />
        <MenuItem icon={<MessageSquare size={16} />} label="意见反馈" onClick={() => toast('感谢反馈！')} />
        <MenuDivider />
        <MenuItem icon={<Info size={16} />} label="新功能介绍" hint={<span className="badge">1</span>} onClick={() => openSettings(true, 'about')} />
        <MenuItem icon={<Info size={16} />} label={`关于 · ${dayjs().format('YYYY')} 版`} onClick={() => openSettings(true, 'about')} />
      </Popover>
    </aside>
  )
}
