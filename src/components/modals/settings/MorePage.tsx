import { useState } from 'react'
import { Eraser, Monitor, RotateCcw } from 'lucide-react'
import Toggle from '../../common/Toggle'
import { ConfirmModal } from '../../common/Modal'
import { useStore } from '../../../store/useStore'
import type { Settings } from '../../../store/types'
import { Card, PageHeader, Row } from './shared'

type Lang = Settings['more']['language']

/** 不能清除的键：主数据、旧版数据、同步队列 / 游标 / 客户端标识 */
const PROTECTED_KEYS = new Set(['dida-data-v2', 'dida-clone-v1', 'dida-outbox-v1', 'dida-outbox-v1-versions', 'dida-sync-cursor-v1', 'dida-client-id'])
const FRIENDLY: Record<string, string> = {
  'dida-recent-searches': '搜索记录',
  'dida-reminders-fired': '提醒触发标记',
}

/** 判断是否为本应用的缓存键（dida- 前缀且不在保护名单） */
function isCacheKey(k: string): boolean {
  return k.startsWith('dida-') && !PROTECTED_KEYS.has(k)
}

export default function MorePage() {
  const { settings, updateSettings, resetSettings, toast } = useStore()
  const m = settings.more
  const [confirm, setConfirm] = useState(false)
  const isDesktop = typeof window !== 'undefined' && !!(window as unknown as { desktop?: unknown }).desktop

  const clearCache = () => {
    const removed: string[] = []
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && isCacheKey(k)) keys.push(k)
      }
      for (const k of keys) {
        localStorage.removeItem(k)
        removed.push(FRIENDLY[k] ?? k.replace(/^dida-/, ''))
      }
      try {
        sessionStorage.clear()
      } catch {
        /* ignore */
      }
    } catch {
      toast('清除缓存失败：无法访问本地存储')
      return
    }
    toast(removed.length ? `已清除：${removed.join('、')}` : '没有可清除的缓存，任务数据未受影响')
  }

  return (
    <>
      <PageHeader title="更多设置" desc="删除确认、开机启动、全局快捷键与语言等其他选项。" />
      <Card>
        <Row label="删除任务前确认" desc="删除任务时弹出确认提示，避免误删。">
          <Toggle on={m.confirmDelete} onChange={(v) => updateSettings({ more: { confirmDelete: v } })} />
        </Row>
        <Row label="开机自动启动" desc="登录系统后自动在后台启动滴答清单。仅桌面版生效。">
          <Toggle on={m.launchOnStartup} onChange={(v) => updateSettings({ more: { launchOnStartup: v } })} />
        </Row>
        <Row label="全局快速添加快捷键" desc="在任意应用中按下该快捷键即可快速添加任务。仅桌面版生效。">
          <input
            className="input"
            value={m.quickAddShortcut}
            placeholder="例如 Ctrl+Shift+A"
            onChange={(e) => updateSettings({ more: { quickAddShortcut: e.target.value } })}
          />
        </Row>
        <div className="st-note">
          <Monitor size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          开机自启与全局快捷键由桌面版（Electron）实现；{isDesktop ? '当前为桌面版，修改后即时生效。' : '当前在浏览器中运行，这两项设置会保存但不会生效。'}
        </div>
        <Row label="语言" desc="界面语言，切换后部分内容需重启生效。">
          <select className="select" value={m.language} onChange={(e) => updateSettings({ more: { language: e.target.value as Lang } })}>
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </select>
        </Row>
      </Card>
      <Card title="维护">
        <Row label="清除缓存" desc="清除搜索记录、提醒触发标记等临时数据，不会影响任务数据与同步队列。">
          <button className="btn sm" onClick={clearCache}>
            <Eraser size={14} /> 清除缓存
          </button>
        </Row>
        <Row label="恢复默认设置" desc="将所有设置项恢复为默认值，任务数据不受影响。">
          <button className="btn sm danger" onClick={() => setConfirm(true)}>
            <RotateCcw size={14} /> 恢复默认
          </button>
        </Row>
      </Card>
      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          resetSettings()
          toast('已恢复默认设置')
        }}
        title="恢复默认设置？"
        text="所有设置将恢复为默认值（包括账号信息、外观与快捷键），任务数据不会被删除。"
        danger
        confirmText="恢复"
      />
    </>
  )
}
