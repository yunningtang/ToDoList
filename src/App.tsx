import { useEffect, useMemo } from 'react'
import Rail from './components/Rail'
import QuadrantView from './components/views/QuadrantView'
import TasksView from './components/views/TasksView'
import CalendarView from './components/views/CalendarView'
import PomodoroView from './components/views/PomodoroView'
import HabitView from './components/views/HabitView'
import CountdownView from './components/views/CountdownView'
import SearchModal from './components/modals/SearchModal'
import SettingsModal from './components/modals/SettingsModal'
import StickyWindow from './components/windows/StickyWindow'
import WidgetWindow from './components/windows/WidgetWindow'
import StickyLayer from './components/windows/StickyLayer'
import { setTimeFormat } from './utils/date'
import { ConfirmModal } from './components/common/Modal'
import { useStore } from './store/useStore'
import type { ViewKey } from './store/types'
import { startReminderService } from './services/reminders'

const VIEW_ORDER: ViewKey[] = ['quadrant', 'tasks', 'calendar', 'pomodoro', 'habit', 'countdown']

/** 窗口类型：主窗口 / 便签 / 小部件（Electron 通过 URL 参数区分） */
function useWindowRoute() {
  return useMemo(() => {
    const q = new URLSearchParams(window.location.search)
    const w = q.get('window')
    if (w === 'sticky' && q.get('task')) return { kind: 'sticky' as const, taskId: q.get('task')! }
    if (w === 'widget') return { kind: 'widget' as const, widget: (q.get('kind') ?? 'today') as 'today' | 'calendar' | 'pomo' }
    return { kind: 'main' as const }
  }, [])
}

export default function App() {
  const route = useWindowRoute()
  const hydrated = useStore((s) => s.hydrated)
  const hydrate = useStore((s) => s.hydrate)
  const theme = useStore((s) => s.settings.appearance.theme)
  const accent = useStore((s) => s.settings.appearance.accent)
  const fontSize = useStore((s) => s.settings.appearance.fontSize)
  const compact = useStore((s) => s.settings.appearance.compact)
  const timeFormat = useStore((s) => s.settings.dateTime.timeFormat)

  useEffect(() => {
    void hydrate()
  }, [hydrate])
  useEffect(() => {
    setTimeFormat(timeFormat)
  }, [timeFormat])

  // 其他窗口（便签 / 小部件）改了数据 → 重新读取
  useEffect(() => {
    const off = window.desktop?.on('data-changed', () => void hydrate())
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'dida-data-v2' && document.visibilityState !== 'visible') void hydrate()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      off?.()
      window.removeEventListener('storage', onStorage)
    }
  }, [hydrate])

  // 主题 / 字号 / 主题色 / 紧凑
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.setAttribute('data-theme', dark ? 'dark' : 'light')
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
  useEffect(() => {
    document.documentElement.setAttribute('data-font', fontSize)
    document.documentElement.toggleAttribute('data-compact', compact)
  }, [fontSize, compact])
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
    document.documentElement.style.setProperty('--rail-bg', accent)
  }, [accent])

  if (!hydrated) return <div className="app" style={{ background: 'var(--bg)' }} />
  if (route.kind === 'sticky') return <StickyWindow taskId={route.taskId} />
  if (route.kind === 'widget') return <WidgetWindow kind={route.widget} />
  return <MainWindow />
}

function MainWindow() {
  const view = useStore((s) => s.view)
  const modules = useStore((s) => s.settings.modules)
  const toasts = useStore((s) => s.toasts)
  const confirmDeleteId = useStore((s) => s.confirmDeleteId)
  const tasks = useStore((s) => s.tasks)
  const { setView, openSearch, openSettings, dismissToast, deleteTask, setConfirmDeleteId, focusQuickAdd, restoreTask, toast } = useStore()
  const shortcuts = useStore((s) => s.settings.shortcuts)
  const quickAddShortcut = useStore((s) => s.settings.more.quickAddShortcut)
  const launchOnStartup = useStore((s) => s.settings.more.launchOnStartup)

  // 当前模块被关闭时回退
  useEffect(() => {
    if (!modules[view]) setView(VIEW_ORDER.find((v) => modules[v]) ?? 'tasks')
  }, [modules, view, setView])

  // 到期提醒服务
  useEffect(() => startReminderService(), [])

  // 桌面端：全局快捷键 / 开机自启 / 主进程事件
  useEffect(() => {
    const d = window.desktop
    if (!d) return
    void d.setGlobalShortcuts({ quickAdd: quickAddShortcut, toggleWindow: shortcuts['显示或隐藏窗口'] ?? 'Ctrl+Shift+E' })
  }, [quickAddShortcut, shortcuts])
  useEffect(() => {
    void window.desktop?.setLaunchOnStartup(launchOnStartup)
  }, [launchOnStartup])
  // 启动时按设置恢复桌面小部件
  const widgets = useStore((s) => s.settings.widgets)
  useEffect(() => {
    const d = window.desktop
    if (!d) return
    if (widgets.todayWidget) void d.openWidget('today')
    if (widgets.calendarWidget) void d.openWidget('calendar')
    if (widgets.pomoWidget) void d.openWidget('pomo')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const off = window.desktop?.on('quick-add', () => {
      setView('tasks')
      focusQuickAdd()
    })
    return () => off?.()
  }, [setView, focusQuickAdd])

  // 全局快捷键（窗口内）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        openSearch(true)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        openSettings(true)
        return
      }
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setView('tasks')
        focusQuickAdd()
        return
      }
      if ((e.ctrlKey || e.metaKey) && /^[1-6]$/.test(e.key) && !typing) {
        const v = VIEW_ORDER[Number(e.key) - 1]
        if (v && modules[v]) {
          e.preventDefault()
          setView(v)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modules, openSearch, openSettings, setView, focusQuickAdd])

  const pendingDelete = confirmDeleteId ? tasks.find((t) => t.id === confirmDeleteId) : null

  return (
    <div className="app">
      <Rail />
      <div className="main">
        {view === 'quadrant' && <QuadrantView />}
        {view === 'tasks' && <TasksView />}
        {view === 'calendar' && <CalendarView />}
        {view === 'pomodoro' && <PomodoroView />}
        {view === 'habit' && <HabitView />}
        {view === 'countdown' && <CountdownView />}
      </div>
      <SearchModal />
      <SettingsModal />
      <StickyLayer />
      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          const id = pendingDelete.id
          deleteTask(id)
          toast('已移至垃圾桶', { label: '撤销', onClick: () => restoreTask(id) })
        }}
        title="删除任务"
        text={pendingDelete ? `确定删除「${pendingDelete.title || '无标题'}」？可在垃圾桶中恢复。` : ''}
        confirmText="删除"
        danger
      />
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick()
                  dismissToast(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
