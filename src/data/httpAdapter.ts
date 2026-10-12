import type { DataAdapter, DataSnapshot, Op, SyncResult } from './types'
import { LocalAdapter } from './localAdapter'
import type { Priority, Task } from '../store/types'
import { uid } from '../utils/id'
import { dayjs } from '../utils/date'

/**
 * NOTE OS 后端适配器（对应 NOTE4C/docs/02-API规范：/v1/sync/changes、/v1/sync/mutations）。
 * - 本机 localStorage 仍作为缓存与离线数据源（复用 LocalAdapter）。
 * - 任务变更进入 outbox，sync() 时批量 POST /v1/sync/mutations；再 GET /v1/sync/changes?since=cursor 拉远端变更。
 * - 规范目前只定义了 task / note / calendar_event，清单、专注记录、倒数日、习惯暂时只存本机。
 */

const OUTBOX_KEY = 'dida-outbox-v1'
const CURSOR_KEY = 'dida-sync-cursor-v1'
const CLIENT_ID_KEY = 'dida-client-id'

/** 本应用优先级(0/1/3/5) ↔ NOTE OS priority(1..4，1 = 今天的青蛙) */
const TO_REMOTE_PRIORITY: Record<Priority, number> = { 5: 1, 3: 2, 1: 3, 0: 4 }
const FROM_REMOTE_PRIORITY: Record<number, Priority> = { 1: 5, 2: 3, 3: 1, 4: 0 }

interface RemoteTask {
  id: string
  title: string
  notes?: string | null
  done?: boolean
  completed_at?: string | null
  priority?: number
  due_at?: string | null
  due_date?: string | null
  timezone?: string
  tags?: string[]
  version?: number
  created_at?: string
  updated_at?: string
}

interface Mutation {
  client_mutation_id: string
  type: 'task'
  op: 'upsert' | 'patch' | 'delete'
  id: string
  base_version: number
  data?: Record<string, unknown>
}

export function taskToRemote(t: Task): Record<string, unknown> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const dueAt = t.dueDate ? dayjs(`${t.dueDate} ${t.dueTime ?? '00:00'}`).toISOString() : null
  return {
    id: t.id,
    title: t.title,
    notes: t.content || null,
    done: t.completed,
    completed_at: t.completedAt,
    priority: TO_REMOTE_PRIORITY[t.priority],
    due_at: dueAt,
    due_date: t.dueDate,
    timezone: tz,
    tags: t.tags,
    // 规范外字段（后端可忽略；本地往返时保留）
    x_list_id: t.listId,
    x_due_time: t.dueTime,
    x_end_time: t.endTime,
    x_subtasks: t.subtasks,
    x_repeat: t.repeat,
    x_reminder: t.reminder,
    x_pinned: t.pinned,
    x_order: t.order,
  }
}

export function taskFromRemote(r: RemoteTask & Record<string, any>, existing?: Task): Task {
  const dueDate = r.due_date ?? (r.due_at ? dayjs(r.due_at).format('YYYY-MM-DD') : null)
  const dueTime = r.x_due_time ?? (r.due_at && !r.due_date ? dayjs(r.due_at).format('HH:mm') : existing?.dueTime ?? null)
  return {
    id: r.id,
    title: r.title ?? existing?.title ?? '',
    content: r.notes ?? existing?.content ?? '',
    listId: r.x_list_id ?? existing?.listId ?? 'inbox',
    dueDate,
    dueTime,
    endTime: r.x_end_time ?? existing?.endTime ?? null,
    priority: r.priority != null ? FROM_REMOTE_PRIORITY[r.priority] ?? 0 : existing?.priority ?? 0,
    tags: r.tags ?? existing?.tags ?? [],
    completed: r.done ?? existing?.completed ?? false,
    completedAt: r.completed_at ?? existing?.completedAt ?? null,
    deleted: false,
    deletedAt: null,
    createdAt: r.created_at ?? existing?.createdAt ?? dayjs().toISOString(),
    updatedAt: r.updated_at ?? dayjs().toISOString(),
    order: r.x_order ?? existing?.order ?? 0,
    reminder: r.x_reminder ?? existing?.reminder ?? null,
    repeat: r.x_repeat ?? existing?.repeat ?? 'none',
    subtasks: r.x_subtasks ?? existing?.subtasks ?? [],
    pinned: r.x_pinned ?? existing?.pinned ?? false,
  }
}

export class HttpAdapter implements DataAdapter {
  readonly kind = 'http' as const
  private local = new LocalAdapter()
  private outbox: Mutation[] = []
  private versions: Record<string, number> = {}
  private clientId: string

  constructor(
    private serverUrl: string,
    private token: string,
  ) {
    this.serverUrl = serverUrl.replace(/\/+$/, '')
    try {
      this.outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]')
      this.versions = JSON.parse(localStorage.getItem(OUTBOX_KEY + '-versions') ?? '{}')
    } catch {
      this.outbox = []
    }
    let cid = localStorage.getItem(CLIENT_ID_KEY)
    if (!cid) {
      cid = 'app_desktop_' + uid()
      localStorage.setItem(CLIENT_ID_KEY, cid)
    }
    this.clientId = cid
  }

  load() {
    return this.local.load()
  }

  async commit(ops: Op[], snapshot: DataSnapshot) {
    await this.local.commit(ops, snapshot)
    for (const op of ops) {
      if (op.collection !== 'tasks') continue
      const task = op.data as Task | undefined
      // 本应用的“删除”是进垃圾桶（deleted=true），对远端等价于 delete
      const isDelete = op.type === 'delete' || (task && task.deleted)
      // 同一任务合并为一条待推送变更
      this.outbox = this.outbox.filter((m) => m.id !== op.itemId)
      this.outbox.push({
        client_mutation_id: op.id,
        type: 'task',
        op: isDelete ? 'delete' : 'upsert',
        id: op.itemId,
        base_version: this.versions[op.itemId] ?? 0,
        data: isDelete || !task ? undefined : taskToRemote(task),
      })
    }
    this.persistOutbox()
  }

  pendingCount() {
    return this.outbox.length
  }

  private persistOutbox() {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(this.outbox))
    localStorage.setItem(OUTBOX_KEY + '-versions', JSON.stringify(this.versions))
  }

  private async request(path: string, init: RequestInit = {}) {
    const res = await fetch(this.serverUrl + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        'X-Request-Id': uid('req'),
        ...(init.headers ?? {}),
      },
    })
    if (!res.ok) {
      let detail = ''
      try {
        const j = await res.json()
        detail = j?.error?.code ?? j?.message ?? ''
      } catch {
        /* ignore */
      }
      throw new Error(`${res.status} ${detail}`.trim())
    }
    return res.status === 204 ? null : res.json()
  }

  async sync(snapshot: DataSnapshot): Promise<SyncResult> {
    await this.local.sync(snapshot)
    if (!this.serverUrl) return { pushed: 0, pulled: 0, error: '未配置服务器地址' }
    let pushed = 0
    let pulled = 0
    try {
      // 1. 推送 outbox
      if (this.outbox.length) {
        const batch = this.outbox.slice(0, 200)
        const r = await this.request('/v1/sync/mutations', {
          method: 'POST',
          headers: { 'Idempotency-Key': uid('idem') },
          body: JSON.stringify({ client_id: this.clientId, mutations: batch }),
        })
        const results: { client_mutation_id: string; status: string; id: string; version?: number }[] = r?.results ?? []
        const done = new Set<string>()
        for (const x of results) {
          if (x.status === 'applied' || x.status === 'merged' || x.status === 'duplicated') {
            done.add(x.client_mutation_id)
            if (x.version != null) this.versions[x.id] = x.version
          }
        }
        pushed = done.size
        this.outbox = this.outbox.filter((m) => !done.has(m.client_mutation_id))
        this.persistOutbox()
      }
      // 2. 拉取远端变更
      const cursor = localStorage.getItem(CURSOR_KEY)
      const byId = new Map(snapshot.tasks.map((t) => [t.id, t]))
      let since = cursor
      let hasMore = true
      let guard = 0
      const merged = new Map<string, Task | null>()
      while (hasMore && guard++ < 20) {
        const q = new URLSearchParams({ limit: '200', types: 'task' })
        if (since) q.set('since', since)
        const r = await this.request(`/v1/sync/changes?${q}`)
        for (const c of r?.changes ?? []) {
          if (c.type !== 'task') continue
          if (c.op === 'delete') merged.set(c.id, null)
          else {
            merged.set(c.id, taskFromRemote(c.data, byId.get(c.id)))
            if (c.version != null) this.versions[c.id] = c.version
          }
          pulled++
        }
        since = r?.cursor ?? since
        hasMore = !!r?.has_more
      }
      if (since) localStorage.setItem(CURSOR_KEY, since)
      this.persistOutbox()
      // 组装远端结果：被远端删除的标记进垃圾桶，其余覆盖
      const tasks = snapshot.tasks.map((t) => {
        if (!merged.has(t.id)) return t
        const m = merged.get(t.id) as Task | null
        return m === null ? { ...t, deleted: true, deletedAt: dayjs().toISOString() } : m
      })
      for (const [id, m] of merged) if (m && !byId.has(id)) tasks.push(m)
      return { pushed, pulled, remote: pulled ? { tasks } : undefined }
    } catch (e: any) {
      return { pushed, pulled, error: e?.message ?? String(e) }
    }
  }

  dispose() {
    this.local.dispose()
  }
}
