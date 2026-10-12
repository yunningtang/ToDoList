import { create } from 'zustand'
import type {
  Countdown,
  Filter,
  FocusRecord,
  Habit,
  ListUIPref,
  Settings,
  Tag,
  Task,
  TaskList,
  ViewKey,
} from './types'
import {
  DEFAULT_SETTINGS,
  SEED_COUNTDOWNS,
  SEED_FOCUS,
  SEED_FOCUS_BASE,
  SEED_HABITS,
  SEED_LISTS,
  SEED_TAGS,
  SEED_TASKS,
} from './seed'
import { uid } from '../utils/id'
import { dayjs } from '../utils/date'
import { createAdapter } from '../data'
import type { Collection, DataAdapter, DataSnapshot, Op } from '../data'

/** 任务视图左侧的当前选择 */
export type TaskSelection =
  | { type: 'smart'; id: 'all' | 'today' | 'tomorrow' | 'next7' | 'inbox' | 'completed' | 'trash' }
  | { type: 'list'; id: string }
  | { type: 'tag'; id: string }
  | { type: 'filter'; id: string }

export type SettingsPage =
  | 'account'
  | 'premium'
  | 'modules'
  | 'smartLists'
  | 'reminders'
  | 'dateTime'
  | 'appearance'
  | 'ai'
  | 'more'
  | 'import'
  | 'share'
  | 'sticky'
  | 'widgets'
  | 'shortcuts'
  | 'about'

export interface Toast {
  id: string
  text: string
  action?: { label: string; onClick: () => void }
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

type DataFields = Pick<DataSnapshot, 'tasks' | 'lists' | 'tags' | 'filters' | 'focusRecords' | 'focusBase' | 'countdowns' | 'habits' | 'settings' | 'listPrefs'>

export interface AppState extends DataFields {
  // ---- UI 状态（view/selection 会随快照保存）----
  view: ViewKey
  selection: TaskSelection
  selectedTaskId: string | null
  searchOpen: boolean
  settingsOpen: boolean
  settingsPage: SettingsPage
  notificationsOpen: boolean
  toasts: Toast[]
  lastSyncAt: string | null
  syncing: boolean
  pendingSync: number
  hydrated: boolean
  /** 等待确认删除的任务（settings.more.confirmDelete 开启时） */
  confirmDeleteId: string | null
  /** 快速添加输入框请求聚焦（全局快捷键触发） */
  quickAddFocusTick: number

  // ---- 任务 ----
  addTask: (patch: Partial<Task> & { title: string }) => string
  updateTask: (id: string, patch: Partial<Task>) => void
  toggleComplete: (id: string) => void
  deleteTask: (id: string) => void
  /** 按“删除前确认”设置决定直接删除还是弹确认框 */
  requestDeleteTask: (id: string) => void
  restoreTask: (id: string) => void
  purgeTask: (id: string) => void
  emptyTrash: () => void
  duplicateTask: (id: string) => void
  reorderTasks: (orderedIds: string[]) => void
  // ---- 清单 / 标签 / 过滤器 ----
  addList: (patch: Partial<TaskList> & { name: string }) => string
  updateList: (id: string, patch: Partial<TaskList>) => void
  deleteList: (id: string) => void
  addTag: (patch: Partial<Tag> & { name: string }) => string
  updateTag: (id: string, patch: Partial<Tag>) => void
  deleteTag: (id: string) => void
  addFilter: (patch: Partial<Filter> & { name: string }) => string
  updateFilter: (id: string, patch: Partial<Filter>) => void
  deleteFilter: (id: string) => void
  setListPref: (key: string, patch: Partial<ListUIPref>) => void
  // ---- 专注 ----
  addFocusRecord: (r: Omit<FocusRecord, 'id'>) => string
  updateFocusRecord: (id: string, patch: Partial<FocusRecord>) => void
  deleteFocusRecord: (id: string) => void
  // ---- 倒数日 ----
  addCountdown: (c: Omit<Countdown, 'id' | 'createdAt'>) => string
  updateCountdown: (id: string, patch: Partial<Countdown>) => void
  deleteCountdown: (id: string) => void
  // ---- 习惯 ----
  addHabit: (h: Omit<Habit, 'id' | 'createdAt' | 'checkins' | 'archived'>) => string
  updateHabit: (id: string, patch: Partial<Habit>) => void
  deleteHabit: (id: string) => void
  toggleHabitCheckin: (id: string, date: string) => void
  // ---- 设置 ----
  updateSettings: (patch: DeepPartial<Settings>) => void
  resetSettings: () => void
  // ---- UI ----
  setView: (v: ViewKey) => void
  setSelection: (s: TaskSelection) => void
  selectTask: (id: string | null) => void
  openSearch: (open: boolean) => void
  openSettings: (open: boolean, page?: SettingsPage) => void
  openNotifications: (open: boolean) => void
  setConfirmDeleteId: (id: string | null) => void
  focusQuickAdd: () => void
  toast: (text: string, action?: Toast['action']) => void
  dismissToast: (id: string) => void
  // ---- 数据层 ----
  hydrate: () => Promise<void>
  sync: () => Promise<void>
  importData: (json: string) => boolean
  exportData: () => string
  resetAll: () => void
}

const DEFAULT_LIST_PREF: ListUIPref = { mode: 'list', sort: 'manual', showCompleted: true, groupBy: 'none' }
const COLLECTIONS: Collection[] = ['tasks', 'lists', 'tags', 'filters', 'focusRecords', 'countdowns', 'habits']

function nowISO() {
  return dayjs().toISOString()
}

export function deepMerge<T>(base: T, patch: any): T {
  if (patch === undefined || patch === null) return base
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return patch as T
  const out: any = { ...base }
  for (const k of Object.keys(patch)) {
    const bv = (base as any)[k]
    const pv = patch[k]
    out[k] = typeof bv === 'object' && bv !== null && !Array.isArray(bv) && typeof pv === 'object' && pv !== null ? deepMerge(bv, pv) : pv
  }
  return out
}

function seedData(): DataFields {
  return {
    tasks: SEED_TASKS,
    lists: SEED_LISTS,
    tags: SEED_TAGS,
    filters: [],
    focusRecords: SEED_FOCUS,
    focusBase: SEED_FOCUS_BASE,
    countdowns: SEED_COUNTDOWNS,
    habits: SEED_HABITS,
    settings: DEFAULT_SETTINGS,
    listPrefs: {},
  }
}

// ---------- 数据适配器（模块级单例，可随设置切换） ----------
let adapter: DataAdapter = createAdapter(DEFAULT_SETTINGS.account)

function snapshotOf(s: AppState): DataSnapshot {
  return {
    tasks: s.tasks,
    lists: s.lists,
    tags: s.tags,
    filters: s.filters,
    focusRecords: s.focusRecords,
    focusBase: s.focusBase,
    countdowns: s.countdowns,
    habits: s.habits,
    settings: s.settings,
    listPrefs: s.listPrefs,
    ui: { view: s.view, selection: s.selection },
  }
}

/** 按引用比较集合，生成增量操作 */
function diffOps(prev: AppState, next: AppState): Op[] {
  const ops: Op[] = []
  const ts = nowISO()
  for (const c of COLLECTIONS) {
    const a = prev[c] as { id: string }[]
    const b = next[c] as { id: string }[]
    if (a === b) continue
    const am = new Map(a.map((x) => [x.id, x]))
    const bm = new Map(b.map((x) => [x.id, x]))
    for (const [id, item] of bm) if (am.get(id) !== item) ops.push({ id: uid('op'), collection: c, type: 'upsert', itemId: id, data: item, ts })
    for (const id of am.keys()) if (!bm.has(id)) ops.push({ id: uid('op'), collection: c, type: 'delete', itemId: id, ts })
  }
  return ops
}

export const useStore = create<AppState>()((set, get) => {
  /** 变更数据并持久化（所有数据写操作都经过这里） */
  const commit = (updater: (s: AppState) => Partial<AppState>) => {
    const prev = get()
    const patch = updater(prev)
    set(patch)
    const next = get()
    if (!next.hydrated) return
    const ops = diffOps(prev, next)
    void adapter.commit(ops, snapshotOf(next)).then(() => {
      const p = adapter.pendingCount()
      if (p !== get().pendingSync) set({ pendingSync: p })
    })
  }

  return {
    ...seedData(),

    view: 'quadrant',
    selection: { type: 'list', id: 'list_week' },
    selectedTaskId: null,
    searchOpen: false,
    settingsOpen: false,
    settingsPage: 'account',
    notificationsOpen: false,
    toasts: [],
    lastSyncAt: null,
    syncing: false,
    pendingSync: 0,
    hydrated: false,
    confirmDeleteId: null,
    quickAddFocusTick: 0,

    // ---------- 任务 ----------
    addTask: (patch) => {
      const id = uid('task')
      const ts = nowISO()
      commit((s) => {
        const order = Math.min(0, ...s.tasks.map((t) => t.order)) - 1
        const task: Task = {
          id,
          content: '',
          listId: 'inbox',
          dueDate: null,
          dueTime: null,
          endTime: null,
          priority: 0,
          tags: [],
          completed: false,
          completedAt: null,
          deleted: false,
          deletedAt: null,
          createdAt: ts,
          updatedAt: ts,
          order,
          reminder: null,
          repeat: 'none',
          subtasks: [],
          pinned: false,
          ...patch,
        }
        // 默认提醒：有具体时间且未设置提醒时，按设置补上
        if (task.dueTime && task.reminder == null) {
          const d = s.settings.reminders.defaultReminder
          task.reminder = d === 'none' ? null : d === 'onTime' ? 'onTime' : d === '30m' ? '-30m' : d === '1h' ? '-1h' : '-1d'
        }
        return { tasks: [task, ...s.tasks] }
      })
      return id
    },
    updateTask: (id, patch) =>
      commit((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: nowISO() } : t)) })),
    toggleComplete: (id) =>
      commit((s) => {
        const extra: Task[] = []
        const tasks = s.tasks.map((t) => {
          if (t.id !== id) return t
          const completed = !t.completed
          if (completed && t.repeat !== 'none' && t.dueDate) {
            const unit = t.repeat === 'daily' ? 'day' : t.repeat === 'weekly' ? 'week' : t.repeat === 'monthly' ? 'month' : 'year'
            extra.push({
              ...t,
              id: uid('task'),
              dueDate: dayjs(t.dueDate).add(1, unit).format('YYYY-MM-DD'),
              completed: false,
              completedAt: null,
              createdAt: nowISO(),
              updatedAt: nowISO(),
              subtasks: t.subtasks.map((st) => ({ ...st, completed: false })),
            })
          }
          return { ...t, completed, completedAt: completed ? nowISO() : null, updatedAt: nowISO() }
        })
        return { tasks: [...extra, ...tasks] }
      }),
    deleteTask: (id) =>
      commit((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, deleted: true, deletedAt: nowISO() } : t)),
        selectedTaskId: s.selectedTaskId === id ? null : s.selectedTaskId,
        confirmDeleteId: null,
      })),
    requestDeleteTask: (id) => {
      if (get().settings.more.confirmDelete) set({ confirmDeleteId: id })
      else {
        get().deleteTask(id)
        get().toast('已移至垃圾桶', { label: '撤销', onClick: () => get().restoreTask(id) })
      }
    },
    restoreTask: (id) => commit((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, deleted: false, deletedAt: null } : t)) })),
    purgeTask: (id) => commit((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
    emptyTrash: () => commit((s) => ({ tasks: s.tasks.filter((t) => !t.deleted) })),
    duplicateTask: (id) => {
      const t = get().tasks.find((x) => x.id === id)
      if (!t) return
      const copy: Task = { ...t, id: uid('task'), createdAt: nowISO(), updatedAt: nowISO(), completed: false, completedAt: null, order: t.order - 0.5 }
      commit((s) => ({ tasks: [copy, ...s.tasks] }))
    },
    reorderTasks: (orderedIds) =>
      commit((s) => {
        const idx = new Map(orderedIds.map((id, i) => [id, i]))
        return { tasks: s.tasks.map((t) => (idx.has(t.id) ? { ...t, order: idx.get(t.id)! } : t)) }
      }),

    // ---------- 清单 / 标签 / 过滤器 ----------
    addList: (patch) => {
      const id = uid('list')
      commit((s) => ({
        lists: [...s.lists, { id, name: patch.name, color: patch.color ?? '#4772FA', emoji: patch.emoji ?? '', order: s.lists.length }],
      }))
      return id
    },
    updateList: (id, patch) => commit((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
    deleteList: (id) =>
      commit((s) => ({
        lists: s.lists.filter((l) => l.id !== id),
        tasks: s.tasks.map((t) => (t.listId === id ? { ...t, deleted: true, deletedAt: nowISO() } : t)),
        selection: s.selection.type === 'list' && s.selection.id === id ? { type: 'smart', id: 'inbox' } : s.selection,
      })),
    addTag: (patch) => {
      const existing = get().tags.find((t) => t.name === patch.name)
      if (existing) return existing.id
      const id = uid('tag')
      commit((s) => ({ tags: [...s.tags, { id, name: patch.name, color: patch.color ?? '#8c9aff' }] }))
      return id
    },
    updateTag: (id, patch) =>
      commit((s) => {
        const old = s.tags.find((t) => t.id === id)
        const tags = s.tags.map((t) => (t.id === id ? { ...t, ...patch } : t))
        let tasks = s.tasks
        if (old && patch.name && patch.name !== old.name) {
          tasks = s.tasks.map((t) => (t.tags.includes(old.name) ? { ...t, tags: t.tags.map((n) => (n === old.name ? patch.name! : n)) } : t))
        }
        return { tags, tasks }
      }),
    deleteTag: (id) =>
      commit((s) => {
        const old = s.tags.find((t) => t.id === id)
        return {
          tags: s.tags.filter((t) => t.id !== id),
          tasks: old ? s.tasks.map((t) => (t.tags.includes(old.name) ? { ...t, tags: t.tags.filter((n) => n !== old.name) } : t)) : s.tasks,
          selection: s.selection.type === 'tag' && s.selection.id === id ? { type: 'smart', id: 'inbox' } : s.selection,
        }
      }),
    addFilter: (patch) => {
      const id = uid('filter')
      commit((s) => ({
        filters: [...s.filters, { id, name: patch.name, rule: { listIds: [], priorities: [], tags: [], date: 'any', keyword: '', ...(patch.rule ?? {}) } }],
      }))
      return id
    },
    updateFilter: (id, patch) => commit((s) => ({ filters: s.filters.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
    deleteFilter: (id) =>
      commit((s) => ({
        filters: s.filters.filter((f) => f.id !== id),
        selection: s.selection.type === 'filter' && s.selection.id === id ? { type: 'smart', id: 'inbox' } : s.selection,
      })),
    setListPref: (key, patch) =>
      commit((s) => ({ listPrefs: { ...s.listPrefs, [key]: { ...DEFAULT_LIST_PREF, ...(s.listPrefs[key] ?? {}), ...patch } } })),

    // ---------- 专注 ----------
    addFocusRecord: (r) => {
      const id = uid('focus')
      commit((s) => ({ focusRecords: [{ ...r, id }, ...s.focusRecords] }))
      return id
    },
    updateFocusRecord: (id, patch) => commit((s) => ({ focusRecords: s.focusRecords.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
    deleteFocusRecord: (id) => commit((s) => ({ focusRecords: s.focusRecords.filter((r) => r.id !== id) })),

    // ---------- 倒数日 ----------
    addCountdown: (c) => {
      const id = uid('cd')
      commit((s) => ({ countdowns: [...s.countdowns, { ...c, id, createdAt: nowISO() }] }))
      return id
    },
    updateCountdown: (id, patch) => commit((s) => ({ countdowns: s.countdowns.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    deleteCountdown: (id) => commit((s) => ({ countdowns: s.countdowns.filter((c) => c.id !== id) })),

    // ---------- 习惯 ----------
    addHabit: (h) => {
      const id = uid('habit')
      commit((s) => ({ habits: [...s.habits, { ...h, id, checkins: [], archived: false, createdAt: nowISO() }] }))
      return id
    },
    updateHabit: (id, patch) => commit((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
    deleteHabit: (id) => commit((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),
    toggleHabitCheckin: (id, date) =>
      commit((s) => ({
        habits: s.habits.map((h) =>
          h.id === id ? { ...h, checkins: h.checkins.includes(date) ? h.checkins.filter((d) => d !== date) : [...h.checkins, date] } : h,
        ),
      })),

    // ---------- 设置 ----------
    updateSettings: (patch) => {
      const before = get().settings.account
      commit((s) => ({ settings: deepMerge(s.settings, patch) }))
      const after = get().settings.account
      if (before.backend !== after.backend || before.serverUrl !== after.serverUrl || before.token !== after.token) {
        adapter.dispose?.()
        adapter = createAdapter(after)
        set({ pendingSync: adapter.pendingCount() })
      }
    },
    resetSettings: () => commit(() => ({ settings: DEFAULT_SETTINGS })),

    // ---------- UI ----------
    setView: (v) => commit(() => ({ view: v, selectedTaskId: null })),
    setSelection: (sel) => commit(() => ({ selection: sel, selectedTaskId: null })),
    selectTask: (id) => set({ selectedTaskId: id }),
    openSearch: (open) => set({ searchOpen: open }),
    openSettings: (open, page) => set((s) => ({ settingsOpen: open, settingsPage: page ?? s.settingsPage })),
    openNotifications: (open) => set({ notificationsOpen: open }),
    setConfirmDeleteId: (id) => set({ confirmDeleteId: id }),
    focusQuickAdd: () => set((s) => ({ quickAddFocusTick: s.quickAddFocusTick + 1 })),
    toast: (text, action) => {
      const id = uid('toast')
      set((s) => ({ toasts: [...s.toasts, { id, text, action }] }))
      setTimeout(() => get().dismissToast(id), 3500)
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    // ---------- 数据层 ----------
    hydrate: async () => {
      const snap = await adapter.load()
      const patch: Partial<AppState> = {}
      if (snap) {
        for (const c of COLLECTIONS) if (Array.isArray((snap as any)[c])) (patch as any)[c] = (snap as any)[c]
        if (snap.focusBase) patch.focusBase = snap.focusBase
        if (snap.listPrefs) patch.listPrefs = snap.listPrefs
        patch.settings = deepMerge(DEFAULT_SETTINGS, snap.settings ?? {})
        if (snap.ui?.view) patch.view = snap.ui.view
        if (snap.ui?.selection) patch.selection = snap.ui.selection
      }
      set({ ...patch, hydrated: true })
      const acct = get().settings.account
      if (acct.backend !== adapter.kind || (acct.backend === 'http' && acct.serverUrl)) {
        adapter.dispose?.()
        adapter = createAdapter(acct)
      }
      set({ pendingSync: adapter.pendingCount() })
      // 首次启动（无快照）或从旧格式迁移时，立即写一份新格式快照
      void adapter.commit([], snapshotOf(get()))
    },
    sync: async () => {
      if (get().syncing) return
      set({ syncing: true })
      const result = await adapter.sync(snapshotOf(get()))
      if (result.remote?.tasks) commit(() => ({ tasks: result.remote!.tasks! }))
      set({ syncing: false, lastSyncAt: nowISO(), pendingSync: adapter.pendingCount() })
      if (result.error) get().toast(`同步失败：${result.error}`)
      else if (adapter.kind === 'local') get().toast('已保存到本机（未配置服务器）')
      else get().toast(`同步完成：推送 ${result.pushed}，拉取 ${result.pulled}`)
    },
    importData: (json) => {
      try {
        const data = JSON.parse(json)
        if (!data || typeof data !== 'object') return false
        commit((s) => ({
          tasks: Array.isArray(data.tasks) ? data.tasks : s.tasks,
          lists: Array.isArray(data.lists) ? data.lists : s.lists,
          tags: Array.isArray(data.tags) ? data.tags : s.tags,
          filters: Array.isArray(data.filters) ? data.filters : s.filters,
          focusRecords: Array.isArray(data.focusRecords) ? data.focusRecords : s.focusRecords,
          focusBase: data.focusBase ?? s.focusBase,
          countdowns: Array.isArray(data.countdowns) ? data.countdowns : s.countdowns,
          habits: Array.isArray(data.habits) ? data.habits : s.habits,
          settings: data.settings ? deepMerge(DEFAULT_SETTINGS, data.settings) : s.settings,
        }))
        return true
      } catch {
        return false
      }
    },
    exportData: () => {
      const s = get()
      return JSON.stringify({ version: 2, exportedAt: nowISO(), ...snapshotOf(s) }, null, 2)
    },
    resetAll: () =>
      commit(() => ({
        ...seedData(),
        selection: { type: 'list', id: 'list_week' },
        selectedTaskId: null,
      })),
  }
})

export function getListPref(prefs: Record<string, ListUIPref>, key: string): ListUIPref {
  return { ...DEFAULT_LIST_PREF, ...(prefs[key] ?? {}) }
}

/** 当前数据适配器（供设置页显示状态） */
export function currentAdapterKind() {
  return adapter.kind
}

// 页面关闭前把防抖中的写入刷到磁盘
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => adapter.dispose?.())
}
