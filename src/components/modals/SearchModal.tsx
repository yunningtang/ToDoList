import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Clock3, Hash, Inbox, Search, X, XCircle } from 'lucide-react'
import Modal from '../common/Modal'
import TaskItem from '../common/TaskItem'
import EmptyState from '../common/EmptyState'
import { useStore } from '../../store/useStore'
import type { Task } from '../../store/types'
import '../../styles/search.css'

const RECENT_KEY = 'dida-recent-searches'
const RECENT_MAX = 8

function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
function saveRecent(arr: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

type Item = { kind: 'task'; id: string } | { kind: 'list'; id: string } | { kind: 'tag'; id: string }

/** 高亮匹配子串 */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const lower = text.toLowerCase()
  const ql = q.toLowerCase()
  const parts: ReactNode[] = []
  let i = 0
  let idx = lower.indexOf(ql, i)
  while (idx !== -1) {
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(
      <mark key={idx} className="hl">
        {text.slice(idx, idx + q.length)}
      </mark>,
    )
    i = idx + q.length
    idx = lower.indexOf(ql, i)
  }
  if (i < text.length) parts.push(text.slice(i))
  return <>{parts}</>
}

/** 内容片段：截取匹配位置附近的文本 */
function snippet(content: string, q: string): string {
  const idx = content.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return ''
  const start = Math.max(0, idx - 20)
  const end = Math.min(content.length, idx + q.length + 40)
  return (start > 0 ? '…' : '') + content.slice(start, end).replace(/\s+/g, ' ') + (end < content.length ? '…' : '')
}

export default function SearchModal() {
  const { searchOpen, openSearch, tasks, lists, tags, setView, setSelection, selectTask } = useStore()
  const [query, setQuery] = useState('')
  const [showTasks, setShowTasks] = useState(true)
  const [showLists, setShowLists] = useState(true)
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // 打开时重置并聚焦
  useEffect(() => {
    if (!searchOpen) return
    setQuery('')
    setActive(0)
    setRecent(loadRecent())
    const id = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(id)
  }, [searchOpen])

  const q = query.trim().toLowerCase()

  const results = useMemo(() => {
    if (!q) return { pending: [] as Task[], done: [] as Task[], inbox: false, lists: [] as typeof lists, tags: [] as typeof tags }
    const hit = (t: Task) =>
      t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q) || t.tags.some((x) => x.toLowerCase().includes(q))
    const taskHits = showTasks ? tasks.filter((t) => !t.deleted && hit(t)) : []
    return {
      pending: taskHits.filter((t) => !t.completed),
      done: taskHits.filter((t) => t.completed),
      inbox: showLists && '收集箱'.includes(q),
      lists: showLists ? lists.filter((l) => l.name.toLowerCase().includes(q)) : [],
      tags: showLists ? tags.filter((t) => t.name.toLowerCase().includes(q)) : [],
    }
  }, [q, tasks, lists, tags, showTasks, showLists])

  // 扁平化的可选项（用于键盘导航）
  const items = useMemo<Item[]>(() => {
    const arr: Item[] = []
    for (const t of results.pending) arr.push({ kind: 'task', id: t.id })
    for (const t of results.done) arr.push({ kind: 'task', id: t.id })
    if (results.inbox) arr.push({ kind: 'list', id: 'inbox' })
    for (const l of results.lists) arr.push({ kind: 'list', id: l.id })
    for (const t of results.tags) arr.push({ kind: 'tag', id: t.id })
    return arr
  }, [results])

  useEffect(() => setActive(0), [q, showTasks, showLists])

  // 活动项滚动到可视区
  useEffect(() => {
    const el = bodyRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  // 使用 CSS Custom Highlight API 高亮 TaskItem 中的标题（不支持时静默跳过）
  useEffect(() => {
    const css = (window as any).CSS
    const HL = (window as any).Highlight
    if (!css?.highlights || typeof HL !== 'function') return
    const root = bodyRef.current
    if (!q || !root) {
      css.highlights.delete('search-hl')
      return
    }
    const ranges: Range[] = []
    root.querySelectorAll('.task-item .title').forEach((el) => {
      const node = el.firstChild
      if (!node || node.nodeType !== Node.TEXT_NODE) return
      const text = (node.textContent ?? '').toLowerCase()
      let i = 0
      let idx = text.indexOf(q, i)
      while (idx !== -1) {
        const r = document.createRange()
        r.setStart(node, idx)
        r.setEnd(node, idx + q.length)
        ranges.push(r)
        i = idx + q.length
        idx = text.indexOf(q, i)
      }
    })
    css.highlights.set('search-hl', new HL(...ranges))
    return () => css.highlights.delete('search-hl')
  }, [q, results, searchOpen])

  const pushRecent = (text: string) => {
    const t = text.trim()
    if (!t) return
    const next = [t, ...recent.filter((x) => x !== t)].slice(0, RECENT_MAX)
    setRecent(next)
    saveRecent(next)
  }
  const clearRecent = () => {
    setRecent([])
    saveRecent([])
  }

  const close = () => openSearch(false)

  const pick = (it: Item) => {
    pushRecent(query)
    close()
    setView('tasks')
    if (it.kind === 'task') {
      const t = tasks.find((x) => x.id === it.id)
      if (!t) return
      if (t.listId === 'inbox') setSelection({ type: 'smart', id: 'inbox' })
      else setSelection({ type: 'list', id: t.listId })
      selectTask(t.id)
    } else if (it.kind === 'list') {
      if (it.id === 'inbox') setSelection({ type: 'smart', id: 'inbox' })
      else setSelection({ type: 'list', id: it.id })
    } else {
      setSelection({ type: 'tag', id: it.id })
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (items.length) setActive((a) => (a + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (items.length) setActive((a) => (a - 1 + items.length) % items.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const it = items[active]
      if (it) pick(it)
      else if (query.trim()) pushRecent(query)
    }
  }

  const pendingCountOf = (listId: string) => tasks.filter((t) => t.listId === listId && !t.completed && !t.deleted).length
  const total = items.length
  const taskCount = results.pending.length + results.done.length
  const listCount = results.lists.length + results.tags.length + (results.inbox ? 1 : 0)

  let idx = -1
  const nextIdx = () => ++idx

  return (
    <Modal open={searchOpen} onClose={close} bare className="search-modal">
      <div className="search-head">
        <div className="search-bar">
          <Search size={24} className="ico" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索"
            spellCheck={false}
            aria-label="搜索"
          />
          {query && (
            <button className="clear" onClick={() => setQuery('')} aria-label="清空" tabIndex={-1}>
              <XCircle size={18} />
            </button>
          )}
        </div>
        <button className="icon-btn close" onClick={close} aria-label="关闭">
          <X size={22} />
        </button>
      </div>

      <div className="search-chips">
        <button className={`chip-outline ${showTasks ? 'active' : ''}`} onClick={() => setShowTasks((v) => !v)}>
          任务{q && showTasks && <span className="cnt">{taskCount}</span>}
        </button>
        <button className={`chip-outline ${showLists ? 'active' : ''}`} onClick={() => setShowLists((v) => !v)}>
          清单{q && showLists && <span className="cnt">{listCount}</span>}
        </button>
      </div>

      {!q && recent.length > 0 && (
        <div className="search-recent">
          <div className="head">
            <span>最近搜索</span>
            <button onClick={clearRecent}>清除</button>
          </div>
          <div className="chips">
            {recent.map((r) => (
              <button key={r} className="recent-chip" onClick={() => setQuery(r)} title={r}>
                <Clock3 size={13} />
                <span>{r}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="search-body" ref={bodyRef}>
        {!q && <EmptyState kind="search" text="输入关键词即可搜索" size={240} />}
        {q && total === 0 && <EmptyState kind="search" text="没有找到相关内容" size={200} />}

        {q && results.pending.length + results.done.length > 0 && (
          <>
            <div className="search-section">
              任务 <span className="cnt">({taskCount})</span>
            </div>
            {results.pending.map((t) => {
              const i = nextIdx()
              const sn = !t.title.toLowerCase().includes(q) ? snippet(t.content, q) : ''
              return (
                <div key={t.id} className="search-task" data-idx={i} onMouseEnter={() => setActive(i)}>
                  <TaskItem task={t} showList selected={active === i} onSelect={() => pick({ kind: 'task', id: t.id })} />
                  {sn && (
                    <div className="snippet">
                      <Highlight text={sn} q={q} />
                    </div>
                  )}
                </div>
              )
            })}
            {results.done.length > 0 && (
              <>
                <div className="search-sub">已完成 ({results.done.length})</div>
                {results.done.map((t) => {
                  const i = nextIdx()
                  return (
                    <div key={t.id} className="search-task" data-idx={i} onMouseEnter={() => setActive(i)}>
                      <TaskItem task={t} showList selected={active === i} onSelect={() => pick({ kind: 'task', id: t.id })} />
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}

        {q && listCount > 0 && (
          <>
            <div className="search-section">
              清单 <span className="cnt">({listCount})</span>
            </div>
            {results.inbox &&
              (() => {
                const i = nextIdx()
                return (
                  <div
                    className={`search-row ${active === i ? 'active' : ''}`}
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick({ kind: 'list', id: 'inbox' })}
                  >
                    <span className="ico">
                      <Inbox size={16} />
                    </span>
                    <span className="name">
                      <Highlight text="收集箱" q={q} />
                    </span>
                    <span className="cnt">{pendingCountOf('inbox')}</span>
                  </div>
                )
              })()}
            {results.lists.map((l) => {
              const i = nextIdx()
              return (
                <div
                  key={l.id}
                  className={`search-row ${active === i ? 'active' : ''}`}
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick({ kind: 'list', id: l.id })}
                >
                  <span className="ico">
                    <span className="color-dot" style={{ background: l.color }} />
                  </span>
                  <span className="name">
                    {l.emoji && <span style={{ marginRight: 6 }}>{l.emoji}</span>}
                    <Highlight text={l.name} q={q} />
                  </span>
                  <span className="cnt">{pendingCountOf(l.id)}</span>
                </div>
              )
            })}
            {results.tags.map((t) => {
              const i = nextIdx()
              const cnt = tasks.filter((x) => !x.deleted && !x.completed && x.tags.includes(t.name)).length
              return (
                <div
                  key={t.id}
                  className={`search-row ${active === i ? 'active' : ''}`}
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick({ kind: 'tag', id: t.id })}
                >
                  <span className="ico" style={{ color: t.color }}>
                    <Hash size={16} />
                  </span>
                  <span className="name">
                    <Highlight text={t.name} q={q} />
                  </span>
                  <span className="cnt">{cnt}</span>
                </div>
              )
            })}
          </>
        )}
      </div>

      <div className="search-foot">
        <span>
          <span className="kbd">↑</span>
          <span className="kbd">↓</span>选择
        </span>
        <span>
          <span className="kbd">Enter</span>打开
        </span>
        <span>
          <span className="kbd">Esc</span>关闭
        </span>
      </div>
    </Modal>
  )
}
