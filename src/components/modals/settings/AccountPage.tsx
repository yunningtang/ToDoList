import { useRef, useState } from 'react'
import { Crown, Download, Eraser, ImagePlus, LogOut, RefreshCw, RotateCcw, Trash2, Upload } from 'lucide-react'
import { ConfirmModal } from '../../common/Modal'
import { currentAdapterKind, useStore } from '../../../store/useStore'
import { dayjs } from '../../../utils/date'
import { Card, PageHeader, Row } from './shared'

const SYNC_KEYS = ['dida-sync-cursor-v1', 'dida-outbox-v1', 'dida-outbox-v1-versions']

export default function AccountPage() {
  const { settings, updateSettings, exportData, importData, resetAll, toast, openSettings, sync, syncing, pendingSync, lastSyncAt } = useStore()
  const a = settings.account
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [confirmClearSync, setConfirmClearSync] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLInputElement>(null)
  const initial = (a.name.trim().slice(0, 1) || 'U').toUpperCase()

  const adapterKind = currentAdapterKind()
  const adapterLabel = adapterKind === 'http' ? 'NOTE OS 服务器' : '仅本机'
  const syncStatus = [
    `当前适配器：${adapterLabel}`,
    `待同步：${pendingSync} 条`,
    `上次同步：${lastSyncAt ? dayjs(lastSyncAt).format('M月D日 HH:mm:ss') : '从未'}`,
  ].join(' · ')
  const httpMisconfigured = a.backend === 'http' && !a.serverUrl.trim()

  const doExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url
    el.download = `dida-backup-${dayjs().format('YYYYMMDD-HHmm')}.json`
    document.body.appendChild(el)
    el.click()
    el.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast('已导出数据')
  }

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const txt = await f.text()
      toast(importData(txt) ? '导入成功' : '导入失败：文件格式不正确')
    } catch {
      toast('导入失败：无法读取文件')
    }
  }

  const onAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 2 * 1024 * 1024) {
      toast('图片不能超过 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      updateSettings({ account: { avatar: String(reader.result ?? '') } })
      toast('头像已更新')
    }
    reader.readAsDataURL(f)
  }

  const clearSyncCursor = () => {
    const removeKeys = () => {
      let n = 0
      try {
        for (const k of SYNC_KEYS) {
          if (localStorage.getItem(k) !== null) n++
          localStorage.removeItem(k)
        }
      } catch {
        /* ignore */
      }
      return n
    }
    const removed = removeKeys()
    if (a.backend === 'http' && a.serverUrl) {
      // 切换后端会重新创建适配器，使内存中的待同步队列与清空后的本地存储一致；
      // 旧适配器尚在进行的写入可能把队列写回，稍后再清一次兜底。
      updateSettings({ account: { backend: 'local' } })
      updateSettings({ account: { backend: 'http' } })
      window.setTimeout(removeKeys, 400)
    }
    toast(removed ? `已清除同步游标与待同步队列（${removed} 项），下次同步将全量拉取远端变更` : '没有需要清除的同步记录')
  }

  return (
    <>
      <PageHeader title="账号" desc="管理你的个人资料、数据后端与本地数据。" />
      <Card>
        <div className="st-account-head">
          <div className="st-avatar">
            {a.avatar ? <img src={a.avatar} alt="" /> : initial}
            {a.premium && (
              <span className="crown">
                <Crown size={13} fill="#ffe08a" />
              </span>
            )}
          </div>
          <div className="info">
            <div className="name">
              {a.name || '未命名'}
              {a.premium ? <span className="st-tag gold">高级会员</span> : <span className="st-tag grey">免费版</span>}
            </div>
            <div className="email">{a.email || '未设置邮箱'}</div>
          </div>
          <div className="ops">
            <button className="btn sm" onClick={() => avatarRef.current?.click()}>
              <ImagePlus size={14} /> 更换头像
            </button>
            {a.avatar && (
              <button className="btn sm ghost" onClick={() => updateSettings({ account: { avatar: '' } })}>
                <Trash2 size={14} /> 移除
              </button>
            )}
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={onAvatarFile} />
          </div>
        </div>
        <Row label="昵称">
          <input className="input" value={a.name} maxLength={30} placeholder="输入昵称" onChange={(e) => updateSettings({ account: { name: e.target.value } })} />
        </Row>
        <Row label="邮箱">
          <input className="input" type="email" value={a.email} placeholder="name@example.com" onChange={(e) => updateSettings({ account: { email: e.target.value } })} />
        </Row>
        <Row label="会员状态" desc={a.premium ? '你已开通高级会员，可使用全部高级功能。' : '升级高级会员以解锁日历、便签、小部件等功能。'}>
          <button className="btn sm" onClick={() => openSettings(true, 'premium')}>
            <Crown size={14} /> {a.premium ? '查看会员' : '升级会员'}
          </button>
        </Row>
      </Card>

      <Card title="数据与同步">
        <Row label="数据后端" desc="「仅本机」把数据保存在此设备；「NOTE OS 服务器」会把任务推送到服务器并拉取远端变更（清单、专注记录、习惯等仍保存在本机）。">
          <select className="select" value={a.backend} onChange={(e) => updateSettings({ account: { backend: e.target.value as 'local' | 'http' } })}>
            <option value="local">仅本机</option>
            <option value="http">NOTE OS 服务器</option>
          </select>
        </Row>
        {a.backend === 'http' && (
          <>
            <Row label="服务器地址" desc={httpMisconfigured ? '尚未填写地址，当前仍使用本机存储。' : '例如 https://note.example.com，不含末尾斜杠。'}>
              <input
                className="input"
                type="url"
                value={a.serverUrl}
                placeholder="https://"
                spellCheck={false}
                onChange={(e) => updateSettings({ account: { serverUrl: e.target.value.trim() } })}
              />
            </Row>
            <Row label="访问令牌" desc="Bearer Token，仅保存在本机。">
              <input
                className="input"
                type={showToken ? 'text' : 'password'}
                value={a.token}
                placeholder="token"
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => updateSettings({ account: { token: e.target.value.trim() } })}
              />
              <button className="btn sm ghost" onClick={() => setShowToken((v) => !v)}>
                {showToken ? '隐藏' : '显示'}
              </button>
            </Row>
          </>
        )}
        <Row label="同步状态" desc={syncStatus}>
          <button className="btn sm" onClick={() => void sync()} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? 'spin' : ''} /> {syncing ? '同步中…' : '立即同步'}
          </button>
          <button className="btn sm ghost" onClick={() => setConfirmClearSync(true)} title="删除本机保存的同步游标与待推送队列">
            <Eraser size={14} /> 清除同步游标
          </button>
        </Row>
      </Card>

      <Card title="数据">
        <Row label="导出数据" desc="将所有任务、清单、习惯、专注记录及设置导出为 JSON 文件。">
          <button className="btn sm" onClick={doExport}>
            <Download size={14} /> 导出
          </button>
        </Row>
        <Row label="导入数据" desc="从之前导出的 JSON 备份文件恢复数据，将覆盖当前内容。">
          <button className="btn sm" onClick={() => importRef.current?.click()}>
            <Upload size={14} /> 导入
          </button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={onImportFile} />
        </Row>
        <Row label="重置所有数据" desc="清空本地全部数据并恢复为示例内容，此操作不可撤销。">
          <button className="btn sm danger" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={14} /> 重置
          </button>
        </Row>
      </Card>

      <div className="st-actions">
        <button className="btn danger" onClick={() => setConfirmLogout(true)}>
          <LogOut size={15} /> 退出登录
        </button>
      </div>

      <ConfirmModal
        open={confirmClearSync}
        onClose={() => setConfirmClearSync(false)}
        onConfirm={clearSyncCursor}
        title="清除同步游标？"
        text="将删除本机保存的同步游标与尚未推送的变更队列。任务数据不受影响；下次同步会从头拉取远端全部变更，本机未推送的修改需要重新编辑才会再次上传。"
        danger
        confirmText="清除"
      />
      <ConfirmModal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetAll()
          toast('已重置所有数据')
        }}
        title="重置所有数据？"
        text="将删除本地所有任务、清单、习惯与设置并恢复为示例内容。此操作不可撤销，建议先导出备份。"
        danger
        confirmText="重置"
      />
      <ConfirmModal
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => {
          updateSettings({ account: { backend: 'local', token: '' } })
          toast('已退出登录：已切换为仅本机，令牌已清除，本地数据保留')
        }}
        title="退出登录？"
        text="退出后将切换为「仅本机」并清除访问令牌，本地数据仍会保留在此设备上。"
        confirmText="退出"
      />
    </>
  )
}
