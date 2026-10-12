// ---- 核心数据类型 ----
// 优先级：0 无、1 低、3 中、5 高（与滴答清单一致）
export type Priority = 0 | 1 | 3 | 5

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface Task {
  id: string
  title: string
  content: string
  listId: string // 'inbox' 或清单 id
  dueDate: string | null // 'YYYY-MM-DD'
  dueTime: string | null // 'HH:mm'，为 null 表示全天
  endTime: string | null // 'HH:mm'，日历中的结束时间
  priority: Priority
  tags: string[] // 标签名
  completed: boolean
  completedAt: string | null // ISO
  deleted: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  order: number
  reminder: string | null // 'HH:mm' 或 null
  repeat: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  subtasks: Subtask[]
  pinned: boolean
}

export interface TaskList {
  id: string
  name: string
  color: string
  order: number
  emoji: string
}

export interface Tag {
  id: string
  name: string
  color: string
}

export type DateRule = 'any' | 'today' | 'tomorrow' | '7days' | 'overdue' | 'nodate' | 'thisWeek' | 'thisMonth'

export interface Filter {
  id: string
  name: string
  rule: {
    listIds: string[] // 为空表示所有清单
    priorities: Priority[] // 为空表示所有优先级
    tags: string[] // 为空表示所有标签
    date: DateRule
    keyword: string
  }
}

export interface FocusRecord {
  id: string
  start: string // ISO
  end: string // ISO
  minutes: number // 实际专注分钟数
  mode: 'pomo' | 'stopwatch'
  taskId: string | null
  title: string
  note: string
}

export type CountdownKind = 'anniversary' | 'countdown' | 'holiday'

export interface Countdown {
  id: string
  title: string
  date: string // 'YYYY-MM-DD'
  kind: CountdownKind
  icon: string // emoji
  color: string // 卡片主题色，'white' 表示白底
  yearly: boolean // 每年重复
  showInCalendar: boolean
  createdAt: string
}

export interface Habit {
  id: string
  name: string
  icon: string
  color: string
  goalPerWeek: number // 每周目标次数
  checkins: string[] // 'YYYY-MM-DD'
  createdAt: string
  archived: boolean
}

export type ViewKey = 'quadrant' | 'tasks' | 'calendar' | 'pomodoro' | 'habit' | 'countdown'
export type ListViewMode = 'list' | 'kanban' | 'timeline'
export type CalendarMode = 'day' | 'week' | 'month'
export type SortKey = 'manual' | 'date' | 'priority' | 'title'
export type GroupKey = 'none' | 'date' | 'priority' | 'tag' | 'list'

export interface QuadrantRule {
  priorities: Priority[]
}

export interface Settings {
  account: {
    name: string
    email: string
    premium: boolean
    avatar: string
    /** 数据后端：'local' 仅本机；'http' 连接 NOTE4C / NOTE OS 后端 */
    backend: 'local' | 'http'
    serverUrl: string
    token: string
  }
  modules: Record<ViewKey, boolean>
  smartLists: {
    all: boolean
    today: boolean
    tomorrow: boolean
    next7: boolean
    inbox: boolean
    completed: boolean
    trash: boolean
  }
  reminders: {
    enabled: boolean
    sound: boolean
    dailyReview: boolean
    dailyReviewTime: string
    defaultReminder: 'none' | 'onTime' | '30m' | '1h' | '1d'
  }
  dateTime: { weekStart: 0 | 1 | 6; timeFormat: '12h' | '24h'; showLunar: boolean; showWeekNumber: boolean }
  appearance: {
    theme: 'light' | 'dark' | 'auto'
    accent: string
    compact: boolean
    sidebarCount: boolean
    fontSize: 'small' | 'normal' | 'large'
  }
  ai: {
    enabled: boolean
    smartParse: boolean
    summary: boolean
    /** 大模型接口（用户自己的 key，仅保存在本机） */
    provider: 'anthropic' | 'openai-compatible'
    apiKey: string
    baseUrl: string
    model: string
    /** 语音识别：浏览器内置 Web Speech，或 Whisper 兼容接口 */
    speech: 'web' | 'whisper'
    whisperUrl: string
    whisperKey: string
    speechLang: string
  }
  more: {
    confirmDelete: boolean
    launchOnStartup: boolean
    quickAddShortcut: string
    language: 'zh-CN' | 'en'
  }
  pomodoro: {
    pomoMinutes: number
    shortBreak: number
    longBreak: number
    longBreakEvery: number
    autoStartBreak: boolean
    autoStartPomo: boolean
    sound: boolean
    dailyGoal: number
    /** 白噪音 */
    noise: 'none' | 'white' | 'pink' | 'brown' | 'rain'
    noiseVolume: number // 0-100
  }
  sticky: {
    defaultColor: string
    opacity: number
    fontSize: 'small' | 'normal' | 'large'
    alwaysOnTop: boolean
    hideFromTaskbar: boolean
    restoreSizeOnArrange: boolean
    gap: 'small' | 'normal' | 'large' | 'xlarge'
  }
  widgets: { todayWidget: boolean; calendarWidget: boolean; pomoWidget: boolean }
  shortcuts: Record<string, string>
  quadrantRules: Record<'1' | '2' | '3' | '4', QuadrantRule>
  quadrantGroupBy: 'none' | 'list' | 'date'
  calendar: { showCompleted: boolean; showCountdowns: boolean; defaultMode: CalendarMode }
}

export interface ListUIPref {
  mode: ListViewMode
  sort: SortKey
  showCompleted: boolean
  groupBy: GroupKey
}
