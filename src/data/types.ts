import type { Countdown, Filter, FocusRecord, Habit, ListUIPref, Settings, Tag, Task, TaskList, ViewKey } from '../store/types'
import type { TaskSelection } from '../store/useStore'

/** 可同步的数据集合 */
export type Collection = 'tasks' | 'lists' | 'tags' | 'filters' | 'focusRecords' | 'countdowns' | 'habits'

/** 一条变更操作（本地乐观写入后排队推送到后端） */
export interface Op {
  id: string // 变更自身的 id（幂等键）
  collection: Collection
  type: 'upsert' | 'delete'
  itemId: string
  data?: unknown
  ts: string // ISO
}

/** 全量数据快照（本地持久化的内容） */
export interface DataSnapshot {
  tasks: Task[]
  lists: TaskList[]
  tags: Tag[]
  filters: Filter[]
  focusRecords: FocusRecord[]
  focusBase: { pomos: number; minutes: number }
  countdowns: Countdown[]
  habits: Habit[]
  settings: Settings
  listPrefs: Record<string, ListUIPref>
  ui: { view: ViewKey; selection: TaskSelection }
}

export interface SyncResult {
  pushed: number
  pulled: number
  /** 拉回的远端变更（已合并到快照后由 store 应用） */
  remote?: Partial<Pick<DataSnapshot, 'tasks'>>
  error?: string
}

/**
 * 数据适配器接口。
 * - LocalAdapter：只写本机 localStorage。
 * - HttpAdapter：本机缓存 + 推送变更到 NOTE OS 后端（/v1/sync/*）。
 * 以后换后端只需实现这个接口，store 不用改。
 */
export interface DataAdapter {
  readonly kind: 'local' | 'http'
  /** 启动时读取本地快照；返回 null 表示无数据（用种子） */
  load(): Promise<Partial<DataSnapshot> | null>
  /** 每次状态变更后调用：ops 为增量，snapshot 为完整状态 */
  commit(ops: Op[], snapshot: DataSnapshot): Promise<void>
  /** 手动 / 定时同步 */
  sync(snapshot: DataSnapshot): Promise<SyncResult>
  /** 待推送的变更数（用于 UI 显示） */
  pendingCount(): number
  dispose?(): void
}
