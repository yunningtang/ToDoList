import { useMemo, useState } from 'react'
import { ArrowDownUp, CalendarHeart, ChevronDown, Clock3, Eye, Maximize2, MoreHorizontal, Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Countdown, CountdownKind } from '../../store/types'
import Popover, { MenuDivider, MenuItem, MenuTitle, usePopover } from '../common/Popover'
import Toggle from '../common/Toggle'
import EmptyState from '../common/EmptyState'
import { ConfirmModal } from '../common/Modal'
import CountdownModal from './countdown/CountdownModal'
import { KIND_LABELS, compareByDate, computeCountdown } from './countdown/helpers'
import '../../styles/countdown.css'

type Tab = 'all' | CountdownKind
type SortMode = 'date' | 'created'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: '所有' },
  { key: 'anniversary', label: '纪念日' },
  { key: 'countdown', label: '倒数日' },
  { key: 'holiday', label: '节日' },
]

export default function CountdownView() {
  const { countdowns, deleteCountdown, setView, toast } = useStore()
  const [tab, setTab] = useState<Tab>('all')
  const [sort, setSort] = useState<SortMode>('date')
  const [showHoliday, setShowHoliday] = useState(true)
  const [pinned, setPinned] = useState<string[]>([])
  const [modal, setModal] = useState<{ open: boolean; editing: Countdown | null; seq: number }>({ open: false, editing: null, seq: 0 })
  const [confirmDel, setConfirmDel] = useState<Countdown | null>(null)
  const [ctxTarget, setCtxTarget] = useState<Countdown | null>(null)

  const titleMenu = usePopover()
  const moreMenu = usePopover()
  const ctxMenu = usePopover()

  const items = useMemo(() => {
    const list = countdowns
      .filter((c) => (tab === 'all' ? true : c.kind === tab))
      .filter((c) => showHoliday || c.kind !== 'holiday')
      .map((c) => ({ c, info: computeCountdown(c) }))
    list.sort((a, b) => {
      const pa = pinned.includes(a.c.id)
      const pb = pinned.includes(b.c.id)
      if (pa !== pb) return pa ? -1 : 1
      if (sort === 'created') return b.c.createdAt.localeCompare(a.c.createdAt)
      return compareByDate(a.info, b.info)
    })
    return list
  }, [countdowns, tab, showHoliday, sort, pinned])

  const openNew = () => setModal((m) => ({ open: true, editing: null, seq: m.seq + 1 }))
  const openEdit = (c: Countdown) => setModal((m) => ({ open: true, editing: c, seq: m.seq + 1 }))
  const closeModal = () => setModal((m) => ({ ...m, open: false }))
  const togglePin = (id: string) => setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">
          <button className="cd-title-btn" onClick={titleMenu.show}>
            倒数纪念日
            <ChevronDown size={20} className="chev" />
          </button>
        </h1>
        <div className="header-actions">
          <button className="icon-btn" title="添加倒数日" onClick={openNew}>
            <Plus size={22} />
          </button>
          <button className="icon-btn" title="更多" onClick={moreMenu.show}>
            <MoreHorizontal size={22} />
          </button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="cd-body">
        {items.length === 0 ? (
          <EmptyState kind="countdown" text="暂无倒数日" />
        ) : (
          <div className="cd-grid">
            {items.map(({ c, info }) => {
              const white = c.color === 'white'
              return (
                <div
                  key={c.id}
                  className={`cd-card ${white ? 'white' : 'colored'}`}
                  style={white ? undefined : { background: c.color }}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(c)}
                  onKeyDown={(e) => e.key === 'Enter' && openEdit(c)}
                  onContextMenu={(e) => {
                    setCtxTarget(c)
                    ctxMenu.showContext(e)
                  }}
                  title={c.title || KIND_LABELS[c.kind]}
                >
                  {tab === 'all' && <span className="cd-kind">{KIND_LABELS[c.kind]}</span>}
                  {pinned.includes(c.id) && (
                    <span className="cd-pin">
                      <Pin size={14} />
                    </span>
                  )}
                  <div className="cd-head">
                    <span className="ico">{c.icon}</span>
                    {c.title && <span className="ttl">{c.title}</span>}
                  </div>
                  <div className={`cd-num ${info.isText ? 'text' : ''}`}>{info.number}</div>
                  <div className="cd-caption">{info.caption}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 标题下拉：切换习惯 / 倒数纪念日 */}
      <Popover open={titleMenu.open} onClose={titleMenu.hide} anchor={titleMenu.anchor} closeOnClick>
        <MenuItem icon={<Clock3 size={16} />} label="习惯" onClick={() => setView('habit')} />
        <MenuItem icon={<CalendarHeart size={16} />} label="倒数纪念日" active />
      </Popover>

      {/* 更多 */}
      <Popover open={moreMenu.open} onClose={moreMenu.hide} anchor={moreMenu.anchor} align="end" style={{ width: 200 }}>
        <MenuTitle>排序</MenuTitle>
        <MenuItem icon={<ArrowDownUp size={16} />} label="按日期" active={sort === 'date'} onClick={() => { setSort('date'); moreMenu.hide() }} />
        <MenuItem icon={<ArrowDownUp size={16} />} label="按创建" active={sort === 'created'} onClick={() => { setSort('created'); moreMenu.hide() }} />
        <MenuDivider />
        <MenuItem
          icon={<Eye size={16} />}
          label="显示节日"
          onClick={() => setShowHoliday((v) => !v)}
          right={<span onClick={(e) => e.stopPropagation()}><Toggle on={showHoliday} onChange={setShowHoliday} /></span>}
        />
        <MenuItem icon={<Maximize2 size={16} />} label="全部展开" onClick={() => { toast('已展开全部'); moreMenu.hide() }} />
      </Popover>

      {/* 右键菜单 */}
      <Popover open={ctxMenu.open} onClose={ctxMenu.hide} position={ctxMenu.position} closeOnClick>
        <MenuItem icon={<Pencil size={16} />} label="编辑" onClick={() => ctxTarget && openEdit(ctxTarget)} />
        <MenuItem
          icon={ctxTarget && pinned.includes(ctxTarget.id) ? <PinOff size={16} /> : <Pin size={16} />}
          label={ctxTarget && pinned.includes(ctxTarget.id) ? '取消置顶' : '置顶'}
          onClick={() => ctxTarget && togglePin(ctxTarget.id)}
        />
        <MenuDivider />
        <MenuItem icon={<Trash2 size={16} />} label="删除" danger onClick={() => setConfirmDel(ctxTarget)} />
      </Popover>

      {modal.open && <CountdownModal key={modal.seq} open onClose={closeModal} editing={modal.editing} defaultKind={tab === 'all' ? 'countdown' : tab} />}

      <ConfirmModal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="删除倒数日"
        text={`确定删除「${confirmDel?.title || confirmDel?.icon || ''}」吗？此操作无法撤销。`}
        danger
        confirmText="删除"
        onConfirm={() => {
          if (confirmDel) {
            deleteCountdown(confirmDel.id)
            toast('已删除')
          }
        }}
      />
    </div>
  )
}
