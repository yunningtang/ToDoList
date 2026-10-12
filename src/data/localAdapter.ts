import type { DataAdapter, DataSnapshot, Op, SyncResult } from './types'

export const STORAGE_KEY = 'dida-data-v2'
const LEGACY_KEY = 'dida-clone-v1' // 旧版 zustand persist 格式 { state, version }

/** 仅本机：localStorage 全量快照，写入做 150ms 防抖 */
export class LocalAdapter implements DataAdapter {
  readonly kind = 'local' as const
  private timer: number | null = null
  private pending: DataSnapshot | null = null

  async load(): Promise<Partial<DataSnapshot> | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as Partial<DataSnapshot>
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy) {
        const parsed = JSON.parse(legacy)
        const s = parsed?.state ?? parsed
        if (s && typeof s === 'object') {
          const snap: Partial<DataSnapshot> = { ...s, ui: s.view || s.selection ? { view: s.view, selection: s.selection } : undefined }
          return snap
        }
      }
    } catch (e) {
      console.warn('[LocalAdapter] load failed', e)
    }
    return null
  }

  async commit(_ops: Op[], snapshot: DataSnapshot): Promise<void> {
    this.pending = snapshot
    if (this.timer !== null) return
    this.timer = window.setTimeout(() => {
      this.timer = null
      this.flush()
    }, 150)
  }

  flush() {
    if (!this.pending) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.pending))
    } catch (e) {
      console.warn('[LocalAdapter] save failed', e)
    }
    this.pending = null
  }

  async sync(snapshot: DataSnapshot): Promise<SyncResult> {
    this.pending = snapshot
    this.flush()
    return { pushed: 0, pulled: 0 }
  }

  pendingCount() {
    return 0
  }

  dispose() {
    if (this.timer !== null) window.clearTimeout(this.timer)
    this.flush()
  }
}
