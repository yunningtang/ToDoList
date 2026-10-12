import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CalendarDays, CalendarRange, Filter as FilterIcon, Inbox, Layers, List as ListIcon, MoreHorizontal, Pencil, Pin, Plus, SquareCheck, Sunrise, Tag as TagIcon, Trash2 } from 'lucide-react'
import Popover, { MenuDivider, MenuItem, usePopover } from '../../common/Popover'
import { ConfirmModal } from '../../common/Modal'
import { useStore } from '../../../store/useStore'
import type { TaskSelection } from '../../../store/useStore'
import type { Filter, Tag, TaskList } from '../../../store/types'
import { pendingCount, tasksForSelection } from '../../../utils/task'
import { dayjs } from '../../../utils/date'
import { FilterModal, ListModal, TagModal } from './EditModals'

type SmartId = Extract<TaskSelection, { type: 'smart' }>['id']

const SMART_TOP: { id: SmartId; label: string; icon: ReactNode }[] = [
  { id: 'all', label: '所有', icon: <Layers size={20} /> },
  { id: 'today', label: '今天', icon: <TodayIcon /> },
  { id: 'tomorrow', label: '明天', icon: <Sunrise size={20} /> },
  { id: 'next7', label: '最近7天', icon: <CalendarRange size={20} /> },
  { id: 'inbox', label: '收集箱', icon: <Inbox size={20} /> },
]
const SMART_BOTTOM: { id: SmartId; label: string; icon: ReactNode }[] = [
  { id: 'completed', label: '已完成', icon: <SquareCheck size={20} /> },
  { id: 'trash', label: '垃圾桶', icon: <Trash2 size={20} /> },
]

/** 带今日日期数字的日历图标 */
function TodayIcon() {
  return (
    <span className="tk-today-icon">
      <CalendarDays size={20} />
      <span>{dayjs().date()}</span>
    </span>
  )
}

interface ItemProps {
  icon: ReactNode
  label: string
  count?: number
  active: boolean
  dot?: string
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onMore?: (e: React.MouseEvent) => void
}

function SideItem({ icon, label, count, active, dot, onClick, onContextMenu, onMore }: ItemProps) {
  return (
    <div className={`tk-side-item ${active ? 'active' : ''} ${onMore ? 'has-more' : ''}`} onClick={onClick} onContextMenu={onContextMenu}>
      <span className="tk-side-icon">{icon}</span>
      <span className="tk-side-label">{label}</span>
      {dot && <span className="color-dot" style={{ background: dot }} />}
      {count !== undefined && count > 0 && <span className="tk-side-count">{count}</span>}
      {onMore && (
        <button
          className="icon-btn sm tk-side-more"
          onClick={(e) => {
            e.stopPropagation()
            onMore(e)
          }}
          title="更多"
        >
          <MoreHorizontal size={16} />
        </button>
      )}
    </div>
  )
}

function SectionTitle({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="tk-section">
      <span>{label}</span>
      <button className="icon-btn sm tk-section-add" title={`添加${label}`} onClick={onAdd}>
        <Plus size={16} />
      </button>
    </div>
  )
}

export default function Sidebar() {
  const { tasks, lists, tags, filters, settings, selection, setSelection, deleteList, deleteTag, deleteFilter, updateList, toast } = useStore()
  const showCount = settings.appearance.sidebarCount
  const smart = settings.smartLists

  // 计数
  const countOf = useMemo(() => {
    const cache = new Map<string, number>()
    return (sel: TaskSelection) => {
      const k = `${sel.type}:${sel.id}`
      if (!cache.has(k)) cache.set(k, pendingCount(tasksForSelection(tasks, sel, tags, filters)))
      return cache.get(k)!
    }
  }, [tasks, tags, filters])

  const isActive = (sel: TaskSelection) => selection.type === sel.type && selection.id === sel.id
  const sortedLists = useMemo(() => [...lists].sort((a, b) => a.order - b.order), [lists])

  // 菜单与弹窗状态
  const listMenu = usePopover()
  const tagMenu = usePopover()
  const filterMenu = usePopover()
  const [menuList, setMenuList] = useState<TaskList | null>(null)
  const [menuTag, setMenuTag] = useState<Tag | null>(null)
  const [menuFilter, setMenuFilter] = useState<Filter | null>(null)
  const [listModal, setListModal] = useState<{ open: boolean; list: TaskList | null }>({ open: false, list: null })
  const [tagModal, setTagModal] = useState<{ open: boolean; tag: Tag | null }>({ open: false, tag: null })
  const [filterModal, setFilterModal] = useState<{ open: boolean; filter: Filter | null }>({ open: false, filter: null })
  const [confirm, setConfirm] = useState<{ title: string; text: string; onConfirm: () => void } | null>(null)

  const pinList = (l: TaskList) => {
    const ordered = [l, ...sortedLists.filter((x) => x.id !== l.id)]
    ordered.forEach((x, i) => {
      if (x.order !== i) updateList(x.id, { order: i })
    })
    toast('已置顶')
  }

  const openMenu = (pop: ReturnType<typeof usePopover>, e: React.MouseEvent) => {
    if (e.type === 'contextmenu') pop.showContext(e)
    else pop.show(e)
  }

  return (
    <aside className="tk-sidebar">
      <div className="tk-side-group">
        {SMART_TOP.filter((s) => smart[s.id]).map((s) => {
          const sel: TaskSelection = { type: 'smart', id: s.id }
          return (
            <SideItem
              key={s.id}
              icon={s.icon}
              label={s.label}
              active={isActive(sel)}
              count={showCount ? countOf(sel) : undefined}
              onClick={() => setSelection(sel)}
            />
          )
        })}
      </div>

      <div className="tk-side-divider" />

      {/* 清单 */}
      <SectionTitle label="清单" onAdd={() => setListModal({ open: true, list: null })} />
      <div className="tk-side-group">
        {sortedLists.length === 0 && <div className="tk-side-hint">还没有清单，点击右上角「+」创建</div>}
        {sortedLists.map((l) => {
          const sel: TaskSelection = { type: 'list', id: l.id }
          return (
            <SideItem
              key={l.id}
              icon={l.emoji ? <span className="tk-emoji">{l.emoji}</span> : <ListIcon size={20} />}
              label={l.name}
              dot={l.color}
              active={isActive(sel)}
              count={showCount ? countOf(sel) : undefined}
              onClick={() => setSelection(sel)}
              onContextMenu={(e) => {
                setMenuList(l)
                openMenu(listMenu, e)
              }}
              onMore={(e) => {
                setMenuList(l)
                openMenu(listMenu, e)
              }}
            />
          )
        })}
      </div>

      {/* 标签 */}
      <SectionTitle label="标签" onAdd={() => setTagModal({ open: true, tag: null })} />
      <div className="tk-side-group">
        {tags.length === 0 && <div className="tk-side-hint">以标签的维度展示不同清单的任务。在添加任务时输入“#”可快速选择标签</div>}
        {tags.map((t) => {
          const sel: TaskSelection = { type: 'tag', id: t.id }
          return (
            <SideItem
              key={t.id}
              icon={<TagIcon size={20} color={t.color} />}
              label={t.name}
              active={isActive(sel)}
              count={showCount ? countOf(sel) : undefined}
              onClick={() => setSelection(sel)}
              onContextMenu={(e) => {
                setMenuTag(t)
                openMenu(tagMenu, e)
              }}
              onMore={(e) => {
                setMenuTag(t)
                openMenu(tagMenu, e)
              }}
            />
          )
        })}
      </div>

      {/* 过滤器 */}
      <SectionTitle label="过滤器" onAdd={() => setFilterModal({ open: true, filter: null })} />
      <div className="tk-side-group">
        {filters.length === 0 && <div className="tk-side-hint">根据清单、时间、优先级、标签等过滤出特定的任务</div>}
        {filters.map((f) => {
          const sel: TaskSelection = { type: 'filter', id: f.id }
          return (
            <SideItem
              key={f.id}
              icon={<FilterIcon size={20} />}
              label={f.name}
              active={isActive(sel)}
              count={showCount ? countOf(sel) : undefined}
              onClick={() => setSelection(sel)}
              onContextMenu={(e) => {
                setMenuFilter(f)
                openMenu(filterMenu, e)
              }}
              onMore={(e) => {
                setMenuFilter(f)
                openMenu(filterMenu, e)
              }}
            />
          )
        })}
      </div>

      <div className="tk-side-divider" />

      <div className="tk-side-group">
        {SMART_BOTTOM.filter((s) => smart[s.id]).map((s) => {
          const sel: TaskSelection = { type: 'smart', id: s.id }
          return <SideItem key={s.id} icon={s.icon} label={s.label} active={isActive(sel)} onClick={() => setSelection(sel)} />
        })}
      </div>

      {/* 清单菜单 */}
      <Popover open={listMenu.open} onClose={listMenu.hide} anchor={listMenu.anchor} position={listMenu.position} align="end" closeOnClick>
        <MenuItem icon={<Pencil size={16} />} label="编辑" onClick={() => setListModal({ open: true, list: menuList })} />
        <MenuItem icon={<Pin size={16} />} label="置顶" onClick={() => menuList && pinList(menuList)} />
        <MenuDivider />
        <MenuItem
          icon={<Trash2 size={16} />}
          label="删除"
          danger
          onClick={() =>
            menuList &&
            setConfirm({
              title: '删除清单',
              text: `确定删除清单「${menuList.name}」吗？清单内的任务将移至垃圾桶。`,
              onConfirm: () => {
                deleteList(menuList.id)
                toast('清单已删除')
              },
            })
          }
        />
      </Popover>

      {/* 标签菜单 */}
      <Popover open={tagMenu.open} onClose={tagMenu.hide} anchor={tagMenu.anchor} position={tagMenu.position} align="end" closeOnClick>
        <MenuItem icon={<Pencil size={16} />} label="编辑" onClick={() => setTagModal({ open: true, tag: menuTag })} />
        <MenuDivider />
        <MenuItem
          icon={<Trash2 size={16} />}
          label="删除"
          danger
          onClick={() =>
            menuTag &&
            setConfirm({
              title: '删除标签',
              text: `确定删除标签「${menuTag.name}」吗？任务上的该标签会被移除。`,
              onConfirm: () => {
                deleteTag(menuTag.id)
                toast('标签已删除')
              },
            })
          }
        />
      </Popover>

      {/* 过滤器菜单 */}
      <Popover open={filterMenu.open} onClose={filterMenu.hide} anchor={filterMenu.anchor} position={filterMenu.position} align="end" closeOnClick>
        <MenuItem icon={<Pencil size={16} />} label="编辑" onClick={() => setFilterModal({ open: true, filter: menuFilter })} />
        <MenuDivider />
        <MenuItem
          icon={<Trash2 size={16} />}
          label="删除"
          danger
          onClick={() =>
            menuFilter &&
            setConfirm({
              title: '删除过滤器',
              text: `确定删除过滤器「${menuFilter.name}」吗？`,
              onConfirm: () => {
                deleteFilter(menuFilter.id)
                toast('过滤器已删除')
              },
            })
          }
        />
      </Popover>

      <ListModal open={listModal.open} list={listModal.list} onClose={() => setListModal({ open: false, list: null })} />
      <TagModal open={tagModal.open} tag={tagModal.tag} onClose={() => setTagModal({ open: false, tag: null })} />
      <FilterModal open={filterModal.open} filter={filterModal.filter} onClose={() => setFilterModal({ open: false, filter: null })} />
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.onConfirm()}
        title={confirm?.title ?? ''}
        text={confirm?.text}
        danger
        confirmText="删除"
      />
    </aside>
  )
}
