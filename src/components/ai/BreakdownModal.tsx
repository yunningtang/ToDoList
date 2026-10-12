import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, Settings2, Sparkles, X } from 'lucide-react'
import Modal from '../common/Modal'
import Checkbox from '../common/Checkbox'
import VoiceButton from './VoiceButton'
import { useStore } from '../../store/useStore'
import { humanDate } from '../../utils/date'
import { listName } from '../../utils/task'
import { uid } from '../../utils/id'
import { aiErrorMessage, breakdownTask, isAiConfigured, isAiNotConfigured } from '../../services/ai'
import '../../styles/ai.css'

interface Props {
  open: boolean
  onClose: () => void
  taskId: string
}

interface Step {
  id: string
  title: string
  minutes?: number
  selected: boolean
}

/** AI 拆解：把任务拆成可执行步骤，加为子任务或拆成独立任务 */
export default function BreakdownModal({ open, onClose, taskId }: Props) {
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId))
  const { updateTask, addTask, lists, toast, openSettings, settings } = useStore()
  const [extra, setExtra] = useState('')
  const [steps, setSteps] = useState<Step[]>([])
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      return
    }
    setExtra('')
    setSteps([])
    setSummary('')
    setLoading(false)
    setError('')
    setNotConfigured(!isAiConfigured(settings.ai))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return null

  const run = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const r = await breakdownTask({ title: task.title, content: task.content, dueDate: task.dueDate, extra }, { signal: ac.signal })
      if (ac.signal.aborted) return
      setSteps(r.steps.map((s) => ({ id: uid('step'), title: s.title, minutes: s.minutes, selected: true })))
      setSummary(r.summary ?? '')
    } catch (e) {
      if (ac.signal.aborted) return
      if (isAiNotConfigured(e)) setNotConfigured(true)
      else setError(aiErrorMessage(e))
    } finally {
      if (abortRef.current === ac) abortRef.current = null
      setLoading(false)
    }
  }

  const selected = steps.filter((s) => s.selected && s.title.trim())
  const patch = (id: string, p: Partial<Step>) => setSteps((ss) => ss.map((s) => (s.id === id ? { ...s, ...p } : s)))

  const addAsSubtasks = () => {
    if (!selected.length) return
    updateTask(task.id, { subtasks: [...task.subtasks, ...selected.map((s) => ({ id: uid('sub'), title: s.title.trim(), completed: false }))] })
    toast(`已添加 ${selected.length} 个子任务`)
    onClose()
  }
  const splitIntoTasks = () => {
    if (!selected.length) return
    selected.forEach((s, i) => {
      addTask({
        title: `步骤 ${i + 1}：${s.title.trim()}`,
        listId: task.listId,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        priority: task.priority,
        tags: [...task.tags],
        content: s.minutes ? `预计 ${s.minutes} 分钟 · 来自「${task.title}」` : `来自「${task.title}」`,
      })
    })
    toast(`已创建 ${selected.length} 个任务`)
    onClose()
  }

  const totalMinutes = selected.reduce((n, s) => n + (s.minutes ?? 0), 0)
  const hasResult = steps.length > 0

  const footer = notConfigured ? (
    <>
      <button className="btn" onClick={onClose}>
        关闭
      </button>
      <button className="btn primary" onClick={() => { openSettings(true, 'ai'); onClose() }}>
        <Settings2 size={16} /> 去设置
      </button>
    </>
  ) : !hasResult ? (
    <>
      <button className="btn" onClick={onClose}>
        取消
      </button>
      <button className="btn primary" onClick={run} disabled={loading}>
        {loading ? <Loader2 size={16} className="ai-spin" /> : <Sparkles size={16} />}
        {loading ? '正在拆解…' : '开始拆解'}
      </button>
    </>
  ) : (
    <>
      <div className="bd-footer-left">
        <button className="btn ghost" onClick={run} disabled={loading}>
          {loading ? <Loader2 size={16} className="ai-spin" /> : <RefreshCw size={16} />} 重新生成
        </button>
      </div>
      <button className="btn" onClick={splitIntoTasks} disabled={!selected.length || loading}>
        拆成独立任务
      </button>
      <button className="btn primary" onClick={addAsSubtasks} disabled={!selected.length || loading}>
        添加为子任务{selected.length ? `（${selected.length}）` : ''}
      </button>
    </>
  )

  return (
    <Modal open={open} onClose={onClose} title="AI 拆解步骤" width={580} footer={footer}>
      <div className="bd-body">
        <div className="bd-task">
          <div className="t">{task.title || '（无标题）'}</div>
          {task.content.trim() && <div className="c">{task.content}</div>}
          <div className="meta">
            {listName(lists, task.listId)}
            {task.dueDate ? ` · ${humanDate(task.dueDate, task.dueTime)}` : ''}
            {task.subtasks.length ? ` · 已有 ${task.subtasks.length} 个子任务` : ''}
          </div>
        </div>

        {notConfigured ? (
          <div className="ai-setup">
            <Sparkles size={28} />
            <div>
              尚未配置 AI 模型服务。
              <br />
              在「设置 → AI 功能」中填写你自己的 API Key 后即可使用智能拆解。
            </div>
          </div>
        ) : (
          <>
            {!hasResult && (
              <>
                <div className="bd-extra">
                  <textarea
                    className="input"
                    placeholder="可选：补充背景、约束或期望（可用右侧麦克风口述），例如：时间只有两天，先做最关键的部分"
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                  />
                  <VoiceButton onResult={(t) => setExtra((prev) => (prev.trim() ? `${prev.trim()}，${t}` : t))} title="口述补充说明" />
                </div>
                {loading ? (
                  <div className="bd-start">
                    <Loader2 size={28} className="ai-spin" color="var(--accent)" />
                    <div className="tip">正在请求 {settings.ai.model || '模型'} 拆解…</div>
                  </div>
                ) : (
                  <div className="bd-start">
                    <div className="tip">AI 会把任务拆成 3 到 8 个按顺序的可执行步骤，你可以勾选、修改后再添加。</div>
                  </div>
                )}
              </>
            )}

            {hasResult && (
              <>
                {summary && <div className="bd-summary">{summary}</div>}
                <div className="bd-head">
                  <span>
                    已选 {selected.length} / {steps.length} 步{totalMinutes ? ` · 约 ${totalMinutes} 分钟` : ''}
                  </span>
                  <span className="grow" />
                  <a className="link-btn" style={{ cursor: 'pointer' }} onClick={() => setSteps((ss) => ss.map((s) => ({ ...s, selected: true })))}>
                    全选
                  </a>
                  <a className="link-btn" style={{ cursor: 'pointer' }} onClick={() => setSteps((ss) => ss.map((s) => ({ ...s, selected: false })))}>
                    全不选
                  </a>
                </div>
                <div className="bd-steps">
                  {steps.map((s, i) => (
                    <div key={s.id} className={`bd-step ${s.selected ? '' : 'off'}`}>
                      <Checkbox size="sm" checked={s.selected} onChange={(v) => patch(s.id, { selected: v })} />
                      <span className="idx">{i + 1}.</span>
                      <input value={s.title} onChange={(e) => patch(s.id, { title: e.target.value })} placeholder="步骤内容" />
                      {s.minutes ? (
                        <span className="mins" title="预计耗时">
                          ≈{s.minutes} 分钟
                        </span>
                      ) : null}
                      <button className="icon-btn sm rm" title="移除" onClick={() => setSteps((ss) => ss.filter((x) => x.id !== s.id))}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {error && (
              <div className="bd-error">
                {error}{' '}
                <a className="link-btn" style={{ cursor: 'pointer' }} onClick={run}>
                  重试
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
