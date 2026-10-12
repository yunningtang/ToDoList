import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import Modal from '../../common/Modal'
import { useStore } from '../../../store/useStore'
import type { DateRule, Filter, Priority, Tag, TaskList } from '../../../store/types'
import { LIST_COLORS, PRIORITIES, PRIORITY_META } from '../../../utils/task'
import { DATE_RULE_LABEL, EMOJIS } from './helpers'

// ---------- 颜色色板 ----------
function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="color-swatches">
      {LIST_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`swatch ${value.toLowerCase() === c.toLowerCase() ? 'selected' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        >
          {value.toLowerCase() === c.toLowerCase() && (
            <span className="chk">
              <Check size={10} strokeWidth={3} />
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ---------- 清单 ----------
export function ListModal({ open, onClose, list }: { open: boolean; onClose: () => void; list: TaskList | null }) {
  const { addList, updateList, toast } = useStore()
  const [name, setName] = useState('')
  const [color, setColor] = useState(LIST_COLORS[0])
  const [emoji, setEmoji] = useState('')

  useEffect(() => {
    if (open) {
      setName(list?.name ?? '')
      setColor(list?.color ?? LIST_COLORS[0])
      setEmoji(list?.emoji ?? '')
    }
  }, [open, list])

  const save = () => {
    const n = name.trim()
    if (!n) return
    if (list) {
      updateList(list.id, { name: n, color, emoji })
      toast('清单已更新')
    } else {
      addList({ name: n, color, emoji })
      toast('清单已创建')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={list ? '编辑清单' : '添加清单'}
      width={460}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" onClick={save} disabled={!name.trim()}>
            保存
          </button>
        </>
      }
    >
      <div className="tk-form">
        <label className="tk-field">
          <span className="tk-label">名称</span>
          <input
            className="input"
            autoFocus
            placeholder="清单名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </label>
        <div className="tk-field">
          <span className="tk-label">颜色</span>
          <Swatches value={color} onChange={setColor} />
        </div>
        <div className="tk-field">
          <span className="tk-label">图标</span>
          <div className="emoji-grid">
            <button type="button" className={emoji === '' ? 'selected' : ''} onClick={() => setEmoji('')} title="无">
              <span className="color-dot" style={{ background: color, width: 12, height: 12 }} />
            </button>
            {EMOJIS.map((e) => (
              <button key={e} type="button" className={emoji === e ? 'selected' : ''} onClick={() => setEmoji(e)}>
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ---------- 标签 ----------
export function TagModal({ open, onClose, tag }: { open: boolean; onClose: () => void; tag: Tag | null }) {
  const { addTag, updateTag, tags, toast } = useStore()
  const [name, setName] = useState('')
  const [color, setColor] = useState(LIST_COLORS[5])

  useEffect(() => {
    if (open) {
      setName(tag?.name ?? '')
      setColor(tag?.color ?? LIST_COLORS[5])
    }
  }, [open, tag])

  const save = () => {
    const n = name.trim().replace(/^#/, '')
    if (!n) return
    const dup = tags.find((t) => t.name === n && t.id !== tag?.id)
    if (dup) {
      toast('标签已存在')
      return
    }
    if (tag) {
      updateTag(tag.id, { name: n, color })
      toast('标签已更新')
    } else {
      addTag({ name: n, color })
      toast('标签已创建')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tag ? '编辑标签' : '添加标签'}
      width={440}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" onClick={save} disabled={!name.trim()}>
            保存
          </button>
        </>
      }
    >
      <div className="tk-form">
        <label className="tk-field">
          <span className="tk-label">名称</span>
          <input
            className="input"
            autoFocus
            placeholder="标签名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </label>
        <div className="tk-field">
          <span className="tk-label">颜色</span>
          <Swatches value={color} onChange={setColor} />
        </div>
      </div>
    </Modal>
  )
}

// ---------- 过滤器 ----------
const EMPTY_RULE: Filter['rule'] = { listIds: [], priorities: [], tags: [], date: 'any', keyword: '' }

export function FilterModal({ open, onClose, filter }: { open: boolean; onClose: () => void; filter: Filter | null }) {
  const { addFilter, updateFilter, lists, tags, toast } = useStore()
  const [name, setName] = useState('')
  const [rule, setRule] = useState<Filter['rule']>(EMPTY_RULE)

  useEffect(() => {
    if (open) {
      setName(filter?.name ?? '')
      setRule(filter ? { ...EMPTY_RULE, ...filter.rule } : EMPTY_RULE)
    }
  }, [open, filter])

  const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const save = () => {
    const n = name.trim()
    if (!n) return
    if (filter) {
      updateFilter(filter.id, { name: n, rule })
      toast('过滤器已更新')
    } else {
      addFilter({ name: n, rule })
      toast('过滤器已创建')
    }
    onClose()
  }

  const listOptions = [{ id: 'inbox', name: '收集箱', color: '#8C8C8C' }, ...lists]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={filter ? '编辑过滤器' : '添加过滤器'}
      width={520}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" onClick={save} disabled={!name.trim()}>
            保存
          </button>
        </>
      }
    >
      <div className="tk-form">
        <label className="tk-field">
          <span className="tk-label">名称</span>
          <input
            className="input"
            autoFocus
            placeholder="过滤器名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </label>
        <div className="tk-field">
          <span className="tk-label">
            清单 <em>不选表示所有清单</em>
          </span>
          <div className="tk-chips">
            {listOptions.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`tk-chip ${rule.listIds.includes(l.id) ? 'on' : ''}`}
                onClick={() => setRule({ ...rule, listIds: toggle(rule.listIds, l.id) })}
              >
                <span className="color-dot" style={{ background: l.color }} />
                {l.name}
              </button>
            ))}
          </div>
        </div>
        <div className="tk-field">
          <span className="tk-label">
            优先级 <em>不选表示所有优先级</em>
          </span>
          <div className="tk-chips">
            {PRIORITIES.map((p: Priority) => (
              <button
                key={p}
                type="button"
                className={`tk-chip ${rule.priorities.includes(p) ? 'on' : ''}`}
                onClick={() => setRule({ ...rule, priorities: toggle(rule.priorities, p) })}
              >
                <span className="color-dot" style={{ background: PRIORITY_META[p].color }} />
                {PRIORITY_META[p].label}
              </button>
            ))}
          </div>
        </div>
        <div className="tk-field">
          <span className="tk-label">
            标签 <em>不选表示所有标签</em>
          </span>
          {tags.length === 0 ? (
            <div className="tk-muted">暂无标签</div>
          ) : (
            <div className="tk-chips">
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`tk-chip ${rule.tags.includes(t.name) ? 'on' : ''}`}
                  onClick={() => setRule({ ...rule, tags: toggle(rule.tags, t.name) })}
                >
                  <span className="color-dot" style={{ background: t.color }} />#{t.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="tk-field tk-inline">
          <span className="tk-label">日期</span>
          <select className="select" value={rule.date} onChange={(e) => setRule({ ...rule, date: e.target.value as DateRule })}>
            {(Object.keys(DATE_RULE_LABEL) as DateRule[]).map((k) => (
              <option key={k} value={k}>
                {DATE_RULE_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <label className="tk-field">
          <span className="tk-label">关键词</span>
          <input className="input" placeholder="标题包含…" value={rule.keyword} onChange={(e) => setRule({ ...rule, keyword: e.target.value })} />
        </label>
      </div>
    </Modal>
  )
}
