import { useState } from 'react'
import { Copy, Inbox, Share2, UserPlus } from 'lucide-react'
import Modal from '../../common/Modal'
import { useStore } from '../../../store/useStore'
import { Card, PageHeader } from './shared'

function fakeCode(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h.toString(36).padStart(6, '0').slice(0, 6).toUpperCase()
}

export default function SharePage() {
  const { lists, tasks, settings, toast } = useStore()
  const [shareId, setShareId] = useState<string | null>(null)
  const target = shareId === 'inbox' ? { id: 'inbox', name: '收集箱', color: 'var(--text-3)' } : lists.find((l) => l.id === shareId) ?? null
  const link = target ? `https://dida365.com/share/${target.id}?code=${fakeCode(target.id)}` : ''
  const owner = settings.account.name || '我'

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link)
        toast('邀请链接已复制')
        return
      }
    } catch {
      /* fallthrough */
    }
    try {
      const ta = document.createElement('textarea')
      ta.value = link
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      toast('邀请链接已复制')
    } catch {
      toast('复制失败，请手动复制')
    }
  }

  const count = (id: string) => tasks.filter((t) => t.listId === id && !t.deleted && !t.completed).length

  return (
    <>
      <PageHeader title="共享协作" desc="将清单分享给家人、朋友或同事，一起管理任务。成员可以查看、添加与完成清单中的任务。" />
      <Card title="我的清单">
        <div className="share-list-row">
          <span className="ico" style={{ color: 'var(--text-3)', display: 'inline-flex' }}>
            <Inbox size={16} />
          </span>
          <span className="name">收集箱</span>
          <span className="cnt">{count('inbox')} 个待办</span>
          <button className="btn sm" onClick={() => setShareId('inbox')}>
            <Share2 size={14} /> 分享清单
          </button>
        </div>
        {lists.map((l) => (
          <div key={l.id} className="share-list-row">
            <span className="color-dot" style={{ background: l.color }} />
            <span className="name">
              {l.emoji && <span style={{ marginRight: 6 }}>{l.emoji}</span>}
              {l.name}
            </span>
            <span className="cnt">{count(l.id)} 个待办</span>
            <button className="btn sm" onClick={() => setShareId(l.id)}>
              <Share2 size={14} /> 分享清单
            </button>
          </div>
        ))}
      </Card>
      <div className="st-note">提示：被分享者打开邀请链接并登录后即可加入清单；你可以随时在清单成员列表中移除成员或停止分享。</div>

      <Modal open={!!target} onClose={() => setShareId(null)} title={target ? `分享「${target.name}」` : '分享清单'} width={480}>
        <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 6 }}>邀请链接</div>
        <div className="share-link-box">
          <span className="url" title={link}>
            {link}
          </span>
          <button className="btn sm primary" onClick={copy}>
            <Copy size={14} /> 复制
          </button>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 4 }}>成员</div>
        <div className="member-row">
          <span className="m-avatar">{owner.slice(0, 1).toUpperCase()}</span>
          <span className="m-name">{owner}</span>
          <span className="m-role">所有者</span>
        </div>
        <div className="member-row">
          <span className="m-avatar empty">
            <UserPlus size={15} />
          </span>
          <span className="m-name" style={{ color: 'var(--text-3)' }}>
            暂无其他成员，发送邀请链接邀请好友加入
          </span>
        </div>
      </Modal>
    </>
  )
}
