import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Loader2, Mic, Plus, Settings2, Sparkles, Square, X } from 'lucide-react'
import Modal from '../common/Modal'
import { useStore } from '../../store/useStore'
import type { Priority, Task } from '../../store/types'
import { PRIORITIES, PRIORITY_META } from '../../utils/task'
import { uid } from '../../utils/id'
import { aiErrorMessage, isAiConfigured, parseSpokenTasks } from '../../services/ai'
import type { SpokenParseResult, SpokenTask } from '../../services/ai'
import { speechSupport, startRecognition } from '../../services/speech'
import type { RecognitionController, SpeechState } from '../../services/speech'
import '../../styles/ai.css'

interface Props {
  open: boolean
  onClose: () => void
  /** 来自 QuickAdd 的默认字段（清单、日期等） */
  defaults?: Partial<Task>
  onAdded?: (ids: string[]) => void
}

interface Row {
  id: string
  title: string
  dueDate: string
  dueTime: string
  priority: Priority
  listId: string
  tags: string[]
  subtasks: string[]
  tagDraft: string
  subDraft: string
}

const HOLD_MS = 700

/** 语音录入任务：说话 → 文本 → AI 解析为多个任务 → 预览编辑 → 批量创建 */
export default function VoiceTaskModal({ open, onClose, defaults = {}, onAdded }: Props) {
  const { addTask, addTag, lists, tags, toast, openSettings, settings } = useStore()
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [speech, setSpeech] = useState<SpeechState>('idle')
  const [stage, setStage] = useState<'input' | 'preview'>('input')
  const [rows, setRows] = useState<Row[]>([])
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState<SpokenParseResult['source'] | null>(null)
  const ctrlRef = useRef<RecognitionController | null>(null)
  const pressAt = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const support = speechSupport(settings.ai)
  const aiReady = isAiConfigured(settings.ai)

  // 打开时重置
  useEffect(() => {
    if (!open) {
      ctrlRef.current?.cancel()
      ctrlRef.current = null
      abortRef.current?.abort()
      return
    }
    setTranscript('')
    setInterim('')
    setSpeech('idle')
    setStage('input')
    setRows([])
    setParsing(false)
    setError('')
    setSource(null)
  }, [open])
  useEffect(() => () => ctrlRef.current?.cancel(), [])

  // ---------- 录音 ----------
  const appendText = (text: string) => {
    const t = text.trim()
    if (!t) return
    setTranscript((prev) => {
      const p = prev.trim()
      if (!p) return t
      return /[，。,.！!？?；;、\n]$/.test(p) ? `${p}${t}` : `${p}，${t}`
    })
  }
  const startListening = () => {
    if (ctrlRef.current || !support.engine) return
    setInterim('')
    setError('')
    setSpeech('listening')
    ctrlRef.current = startRecognition({
      onPartial: (t) => setInterim(t),
      onState: (s) => setSpeech(s),
      onFinal: (text) => {
        ctrlRef.current = null
        setSpeech('idle')
        setInterim('')
        appendText(text)
      },
      onError: (err) => {
        ctrlRef.current = null
        setSpeech('idle')
        setInterim('')
        if (err.code === 'aborted') return
        if (err.code === 'not-configured' || err.code === 'unsupported') toast(err.message, { label: '去设置', onClick: () => openSettings(true, 'ai') })
        else toast(err.message)
      },
    })
  }
  const stopListening = () => ctrlRef.current?.stop()

  const listening = speech === 'listening'
  const processing = speech === 'processing'

  // ---------- 解析 ----------
  const toRows = (tasks: SpokenTask[]): Row[] =>
    tasks.map((t) => ({
      id: uid('row'),
      title: t.title,
      dueDate: t.dueDate ?? defaults.dueDate ?? '',
      dueTime: t.dueTime ?? (t.dueDate ? '' : defaults.dueTime ?? ''),
      priority: t.priority ?? defaults.priority ?? 0,
      listId: (t.listName && t.listName !== '收集箱' ? lists.find((l) => l.name === t.listName)?.id : t.listName === '收集箱' ? 'inbox' : undefined) ?? defaults.listId ?? 'inbox',
      tags: Array.from(new Set([...(defaults.tags ?? []), ...(t.tags ?? [])])),
      subtasks: t.subtasks ?? [],
      tagDraft: '',
      subDraft: '',
    }))

  const parse = async (forceLocal = false) => {
    const text = transcript.trim()
    if (!text || parsing) return
    if (listening) stopListening()
    setParsing(true)
    setError('')
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const r = await parseSpokenTasks(text, { lists, tags }, { forceLocal, signal: ac.signal })
      if (ac.signal.aborted) return
      setSource(r.source)
      setRows(toRows(r.tasks))
      setStage('preview')
    } catch (e) {
      if (!ac.signal.aborted) setError(aiErrorMessage(e))
    } finally {
      if (abortRef.current === ac) abortRef.current = null
      setParsing(false)
    }
  }

  // ---------- 行编辑 ----------
  const patchRow = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id))
  const addRow = () =>
    setRows((rs) => [
      ...rs,
      { id: uid('row'), title: '', dueDate: defaults.dueDate ?? '', dueTime: '', priority: defaults.priority ?? 0, listId: defaults.listId ?? 'inbox', tags: [...(defaults.tags ?? [])], subtasks: [], tagDraft: '', subDraft: '' },
    ])

  // ---------- 创建 ----------
  const validRows = rows.filter((r) => r.title.trim())
  const create = () => {
    if (!validRows.length) return
    const ids: string[] = []
    for (const r of validRows) {
      for (const t of r.tags) addTag({ name: t })
      ids.push(
        addTask({
          ...defaults,
          title: r.title.trim(),
          dueDate: r.dueDate || null,
          dueTime: r.dueDate && r.dueTime ? r.dueTime : null,
          priority: r.priority,
          tags: r.tags,
          listId: r.listId,
          subtasks: r.subtasks.map((s) => ({ id: uid('sub'), title: s, completed: false })),
        }),
      )
    }
    toast(`已创建 ${ids.length} 个任务`)
    onAdded?.(ids)
    onClose()
  }
  const addRaw = () => {
    const title = transcript.trim().replace(/\s+/g, ' ')
    if (!title) return
    const id = addTask({ ...defaults, title })
    toast('已添加任务')
    onAdded?.([id])
    onClose()
  }

  const micDisabled = !support.engine || processing
  const hintText = listening ? (
    <>
      正在听…<b>松开或再点一下</b>结束
    </>
  ) : processing ? (
    '正在识别…'
  ) : support.engine ? (
    <>
      <b>按住说话</b>，或<b>点击开始</b>、说完再点一下停止
      {support.engine === 'whisper' ? '（Whisper 识别）' : ''}
    </>
  ) : (
    support.reason
  )

  const footer =
    stage === 'input' ? (
      <>
        <button className="btn ghost" onClick={addRaw} disabled={!transcript.trim()} title="不经解析，直接把文本作为一个任务标题">
          直接添加原文
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button className="btn primary" onClick={() => parse(false)} disabled={!transcript.trim() || parsing}>
          {parsing ? <Loader2 size={16} className="ai-spin" /> : <Sparkles size={16} />}
          {aiReady ? 'AI 解析' : '解析（本地）'}
        </button>
      </>
    ) : (
      <>
        <button className="btn ghost" onClick={() => setStage('input')}>
          <ArrowLeft size={16} /> 返回修改
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button className="btn primary" onClick={create} disabled={!validRows.length}>
          创建 {validRows.length} 个任务
        </button>
      </>
    )

  return (
    <Modal open={open} onClose={onClose} title={stage === 'input' ? '语音添加任务' : '确认要创建的任务'} width={600} footer={footer}>
      {stage === 'input' ? (
        <div className="vt-body">
          <div className="vt-mic-wrap">
            <button
              type="button"
              className={`vt-mic ${speech}`}
              disabled={micDisabled}
              title={listening ? '停止' : '开始说话'}
              onPointerDown={(e) => {
                e.preventDefault()
                if (ctrlRef.current) {
                  stopListening()
                  pressAt.current = 0
                } else {
                  pressAt.current = Date.now()
                  startListening()
                }
              }}
              onPointerUp={() => {
                if (ctrlRef.current && pressAt.current && Date.now() - pressAt.current > HOLD_MS) stopListening()
                pressAt.current = 0
              }}
              onPointerLeave={() => {
                if (ctrlRef.current && pressAt.current && Date.now() - pressAt.current > HOLD_MS) stopListening()
                pressAt.current = 0
              }}
            >
              {processing ? <Loader2 size={30} className="ai-spin" /> : listening ? <Square size={26} fill="currentColor" /> : <Mic size={32} />}
            </button>
            <div className="vt-hint">{hintText}</div>
            {!support.engine && (
              <button className="btn sm" onClick={() => { openSettings(true, 'ai'); onClose() }}>
                <Settings2 size={14} /> 去设置语音识别
              </button>
            )}
            {(listening || processing) && <div className="vt-interim">{interim || (listening ? '…' : '')}</div>}
          </div>
          <textarea
            className="input vt-transcript"
            placeholder="识别出的文字会显示在这里，也可以直接输入。例如：明天上午十点和老王开会，然后周五前交周报，还有买牛奶"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) parse(false)
            }}
          />
          <div className="vt-source">
            {aiReady ? (
              <span className="vt-badge ai">AI 解析：{settings.ai.model || '默认模型'}</span>
            ) : (
              <>
                <span className="vt-badge">本地解析</span>
                <span>未配置模型服务，将按 顿号 / 逗号 / 然后 / 再 / 和 拆分并识别日期、标签。</span>
                <a className="link-btn" onClick={() => { openSettings(true, 'ai'); onClose() }} style={{ cursor: 'pointer' }}>
                  配置 AI
                </a>
              </>
            )}
            <span className="grow" />
            <span>Ctrl + Enter 解析</span>
          </div>
          {error && (
            <div className="vt-error">
              {error}
              {aiReady && (
                <>
                  {' '}
                  <a className="link-btn" style={{ cursor: 'pointer' }} onClick={() => parse(true)}>
                    改用本地解析
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="vt-body">
          <div className="vt-source">
            <span className={`vt-badge ${source === 'ai' ? 'ai' : ''}`}>{source === 'ai' ? 'AI 解析' : '本地解析'}</span>
            <span>识别出 {rows.length} 个任务，可直接修改。</span>
            <span className="grow" />
            <button className="btn sm ghost" onClick={addRow}>
              <Plus size={14} /> 添加一条
            </button>
          </div>
          <div className="vt-list">
            {rows.length === 0 && <div className="vt-empty">没有识别出任务，点击"添加一条"手动填写，或返回修改文本。</div>}
            {rows.map((r, i) => (
              <div key={r.id} className="vt-row">
                <div className="vt-row-head">
                  <span className="idx">{i + 1}.</span>
                  <input className="vt-title" value={r.title} placeholder="任务标题" onChange={(e) => patchRow(r.id, { title: e.target.value })} autoFocus={!r.title} />
                  <button className="icon-btn sm" title="移除" onClick={() => removeRow(r.id)}>
                    <X size={14} />
                  </button>
                </div>
                <div className="vt-row-fields">
                  <input type="date" className="input" value={r.dueDate} onChange={(e) => patchRow(r.id, { dueDate: e.target.value })} title="日期" />
                  <input type="time" className="input" value={r.dueTime} disabled={!r.dueDate} onChange={(e) => patchRow(r.id, { dueTime: e.target.value })} title="时间" />
                  <select className="select" value={r.priority} onChange={(e) => patchRow(r.id, { priority: Number(e.target.value) as Priority })} title="优先级">
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_META[p].label}
                      </option>
                    ))}
                  </select>
                  <select className="select" value={r.listId} onChange={(e) => patchRow(r.id, { listId: e.target.value })} title="清单">
                    <option value="inbox">收集箱</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="vt-chips">
                  <span className="lbl">标签</span>
                  {r.tags.map((t) => (
                    <span key={t} className="vt-chip tag">
                      #{t}
                      <button onClick={() => patchRow(r.id, { tags: r.tags.filter((x) => x !== t) })}>
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    className="vt-chip-input"
                    placeholder="添加标签，回车确认"
                    value={r.tagDraft}
                    onChange={(e) => patchRow(r.id, { tagDraft: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const n = r.tagDraft.trim().replace(/^#/, '')
                        if (n) patchRow(r.id, { tags: r.tags.includes(n) ? r.tags : [...r.tags, n], tagDraft: '' })
                      }
                      if (e.key === 'Backspace' && !r.tagDraft && r.tags.length) patchRow(r.id, { tags: r.tags.slice(0, -1) })
                    }}
                  />
                </div>
                <div className="vt-chips">
                  <span className="lbl">子任务</span>
                  {r.subtasks.map((s, si) => (
                    <span key={si} className="vt-chip">
                      {s}
                      <button onClick={() => patchRow(r.id, { subtasks: r.subtasks.filter((_, j) => j !== si) })}>
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    className="vt-chip-input"
                    placeholder="添加子任务，回车确认"
                    value={r.subDraft}
                    onChange={(e) => patchRow(r.id, { subDraft: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const n = r.subDraft.trim()
                        if (n) patchRow(r.id, { subtasks: [...r.subtasks, n], subDraft: '' })
                      }
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
