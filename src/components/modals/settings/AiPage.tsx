import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, Loader2, Mic, Square, XCircle } from 'lucide-react'
import Toggle from '../../common/Toggle'
import { useStore } from '../../../store/useStore'
import { Card, PageHeader, Row } from './shared'
import {
  aiErrorMessage,
  CLAUDE_MODEL_SUGGESTIONS,
  DEFAULT_ANTHROPIC_URL,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_OPENAI_URL,
  OPENAI_MODEL_SUGGESTIONS,
  testConnection,
} from '../../../services/ai'
import { speechSupport, startRecognition } from '../../../services/speech'
import type { RecognitionController, SpeechState } from '../../../services/speech'
import '../../../styles/ai.css'

type TestState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok'; model: string; latency: number; reply: string } | { kind: 'err'; message: string }

export default function AiPage() {
  const { settings, updateSettings } = useStore()
  const ai = settings.ai
  const set = (patch: Partial<typeof ai>) => updateSettings({ ai: patch })

  const [showKey, setShowKey] = useState(false)
  const [showWhisperKey, setShowWhisperKey] = useState(false)
  const [test, setTest] = useState<TestState>({ kind: 'idle' })

  // 语音试用
  const [speech, setSpeech] = useState<SpeechState>('idle')
  const [tryText, setTryText] = useState('')
  const [tryErr, setTryErr] = useState('')
  const ctrlRef = useRef<RecognitionController | null>(null)
  useEffect(() => () => ctrlRef.current?.cancel(), [])

  const isAnthropic = ai.provider === 'anthropic'
  const suggestions = isAnthropic ? CLAUDE_MODEL_SUGGESTIONS : OPENAI_MODEL_SUGGESTIONS
  const support = speechSupport(ai)

  const runTest = async () => {
    setTest({ kind: 'loading' })
    try {
      const r = await testConnection()
      setTest({ kind: 'ok', model: r.model, latency: r.latency, reply: r.reply })
    } catch (e) {
      setTest({ kind: 'err', message: aiErrorMessage(e) })
    }
  }

  const tryVoice = () => {
    if (ctrlRef.current) {
      ctrlRef.current.stop()
      return
    }
    setTryErr('')
    setTryText('')
    setSpeech('listening')
    ctrlRef.current = startRecognition({
      onPartial: (t) => setTryText(t),
      onState: (s) => setSpeech(s),
      onFinal: (t) => {
        ctrlRef.current = null
        setSpeech('idle')
        setTryText(t)
      },
      onError: (err) => {
        ctrlRef.current = null
        setSpeech('idle')
        if (err.code !== 'aborted') setTryErr(err.message)
      },
    })
  }

  return (
    <>
      <PageHeader title="AI 功能" desc="借助 AI 更快地记录与整理任务。模型与语音服务使用你自己的 Key，仅保存在本机。" />

      <Card>
        <Row label="启用 AI 功能" desc="关闭后将停用所有 AI 相关功能（智能解析、语音拆解等）。">
          <Toggle on={ai.enabled} onChange={(v) => set({ enabled: v })} />
        </Row>
      </Card>

      <Card>
        <Row
          label="智能解析"
          desc={
            <>
              在快速添加框中输入自然语言，自动识别日期、时间、标签、优先级与清单（本地规则，无需联网）。
              <div className="ai-example">
                <span className="ex">
                  <b>明天 14:00</b> 开会 <b>#工作</b> <b>!高</b>
                </span>
                <span className="ex">
                  <b>下周三</b> 提交周报 <b>~本周</b>
                </span>
                <span className="ex">
                  <b>10月15日</b> 体检 <b>!中</b>
                </span>
              </div>
            </>
          }
        >
          <Toggle on={ai.smartParse} disabled={!ai.enabled} onChange={(v) => set({ smartParse: v })} />
        </Row>
        <Row label="任务摘要" desc="为较长的任务描述自动生成一句话摘要，并在任务列表中显示。">
          <Toggle on={ai.summary} disabled={!ai.enabled} onChange={(v) => set({ summary: v })} />
        </Row>
      </Card>

      <Card title="模型服务">
        <Row label="接口类型" desc="Anthropic 官方接口，或任意 OpenAI 兼容接口（如 DeepSeek、通义、本地 Ollama 等）。">
          <select
            className="select"
            value={ai.provider}
            onChange={(e) => {
              const provider = e.target.value as typeof ai.provider
              const patch: Partial<typeof ai> = { provider }
              // 切换类型时若模型名明显不匹配，换成该类型的默认值
              if (provider === 'anthropic' && !/^claude-/.test(ai.model)) patch.model = DEFAULT_CLAUDE_MODEL
              if (provider === 'openai-compatible' && /^claude-/.test(ai.model)) patch.model = OPENAI_MODEL_SUGGESTIONS[0].id
              set(patch)
              setTest({ kind: 'idle' })
            }}
          >
            <option value="anthropic">Anthropic（Claude）</option>
            <option value="openai-compatible">OpenAI 兼容接口</option>
          </select>
        </Row>
        <Row label="API Key" desc="只保存在本机，不会上传到任何第三方服务器；请求将直接从本机发往上面的接口。" column>
          <div className="ai-field">
            <div className="ai-key">
              <input
                className="input"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                placeholder={isAnthropic ? 'sk-ant-…' : 'sk-…'}
                value={ai.apiKey}
                onChange={(e) => {
                  set({ apiKey: e.target.value.trim() })
                  setTest({ kind: 'idle' })
                }}
              />
              <button className="icon-btn" title={showKey ? '隐藏' : '显示'} onClick={() => setShowKey((v) => !v)}>
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </Row>
        <Row label="Base URL" desc={`留空使用默认地址 ${isAnthropic ? DEFAULT_ANTHROPIC_URL : DEFAULT_OPENAI_URL}；使用代理或自建服务时填写。`} column>
          <div className="ai-field">
            <input
              className="input"
              spellCheck={false}
              placeholder={isAnthropic ? DEFAULT_ANTHROPIC_URL : DEFAULT_OPENAI_URL}
              value={ai.baseUrl}
              onChange={(e) => {
                set({ baseUrl: e.target.value.trim() })
                setTest({ kind: 'idle' })
              }}
            />
          </div>
        </Row>
        <Row label="模型" desc={isAnthropic ? '当前可用的 Claude 模型，点击快速填入。Sonnet 5.5 在速度与效果之间较均衡。' : '填写服务商提供的模型名称。'} column>
          <div className="ai-field">
            <input
              className="input"
              spellCheck={false}
              placeholder={isAnthropic ? DEFAULT_CLAUDE_MODEL : 'gpt-4o-mini'}
              value={ai.model}
              onChange={(e) => {
                set({ model: e.target.value.trim() })
                setTest({ kind: 'idle' })
              }}
            />
            <div className="ai-chips">
              {suggestions.map((m) => (
                <button key={m.id} className={`ai-chip ${ai.model === m.id ? 'active' : ''}`} onClick={() => { set({ model: m.id }); setTest({ kind: 'idle' }) }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </Row>
        <Row label="测试连接" desc="发送一条极短的消息，验证 Key、地址与模型是否可用。">
          <div className="ai-inline">
            {test.kind === 'ok' && (
              <span className="ai-result ok">
                <CheckCircle2 size={15} /> {test.model || '默认模型'} · {test.latency} ms{test.reply ? ` · 回复「${test.reply}」` : ''}
              </span>
            )}
            {test.kind === 'err' && (
              <span className="ai-result err" title={test.message}>
                <XCircle size={15} /> {test.message}
              </span>
            )}
            <button className="btn sm" onClick={runTest} disabled={test.kind === 'loading' || !ai.enabled || (isAnthropic && !ai.apiKey)}>
              {test.kind === 'loading' ? <Loader2 size={14} className="ai-spin" /> : null}
              {test.kind === 'loading' ? '测试中…' : '测试连接'}
            </button>
          </div>
        </Row>
      </Card>

      <Card title="语音识别">
        <Row
          label="识别引擎"
          desc={
            <>
              「浏览器内置」使用系统 / Chrome 的 Web Speech，免费但在 Electron 中可能不可用；「Whisper 接口」会把录音上传到 OpenAI 兼容的 /audio/transcriptions 接口。
              <div className="ai-support" style={{ marginTop: 6 }}>
                当前环境：内置识别 <span className={support.web ? 'ok' : 'no'}>{support.web ? '可用' : '不可用'}</span> · 录音{' '}
                <span className={support.recorder ? 'ok' : 'no'}>{support.recorder ? '可用' : '不可用'}</span>
                {support.isElectron ? ' · Electron' : ''}
                {support.reason ? ` · ${support.reason}` : ''}
              </div>
            </>
          }
        >
          <select className="select" value={ai.speech} onChange={(e) => set({ speech: e.target.value as typeof ai.speech })}>
            <option value="web">浏览器内置</option>
            <option value="whisper">Whisper 接口</option>
          </select>
        </Row>
        <Row label="识别语言">
          <select className="select" value={ai.speechLang} onChange={(e) => set({ speechLang: e.target.value })}>
            <option value="zh-CN">中文（普通话）</option>
            <option value="zh-TW">中文（台湾）</option>
            <option value="zh-HK">中文（粤语）</option>
            <option value="en-US">English (US)</option>
            <option value="ja-JP">日本語</option>
          </select>
        </Row>
        <Row label="Whisper 接口地址" desc="OpenAI 兼容的 Base URL，例如 https://api.openai.com/v1；内置识别失败时也会自动改用它。" column>
          <div className="ai-field">
            <input className="input" spellCheck={false} placeholder="https://api.openai.com/v1" value={ai.whisperUrl} onChange={(e) => set({ whisperUrl: e.target.value.trim() })} />
          </div>
        </Row>
        <Row label="Whisper Key" desc="留空则不发送认证头（本地服务常不需要）。" column>
          <div className="ai-field">
            <div className="ai-key">
              <input
                className="input"
                type={showWhisperKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-…"
                value={ai.whisperKey}
                onChange={(e) => set({ whisperKey: e.target.value.trim() })}
              />
              <button className="icon-btn" title={showWhisperKey ? '隐藏' : '显示'} onClick={() => setShowWhisperKey((v) => !v)}>
                {showWhisperKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </Row>
        <Row label="试一下" desc="点击后说一句话，识别结果会显示在下方。" column>
          <div className="ai-field">
            <div className="ai-inline">
              <button className={`btn sm ${speech === 'listening' ? 'danger' : ''}`} onClick={tryVoice} disabled={speech === 'processing' || !support.engine}>
                {speech === 'listening' ? <Square size={14} fill="currentColor" /> : speech === 'processing' ? <Loader2 size={14} className="ai-spin" /> : <Mic size={14} />}
                {speech === 'listening' ? '停止' : speech === 'processing' ? '识别中…' : '开始说话'}
              </button>
              <span className="ai-result muted">
                {speech === 'listening' ? '正在听…' : speech === 'processing' ? '正在上传识别…' : support.engine ? `将使用：${support.engine === 'web' ? '浏览器内置' : 'Whisper 接口'}` : support.reason}
              </span>
            </div>
            <div className={`ai-try-text ${tryText || tryErr ? '' : 'placeholder'}`} style={tryErr ? { color: 'var(--danger)' } : undefined}>
              {tryErr || tryText || '识别结果会显示在这里'}
            </div>
          </div>
        </Row>
      </Card>

      <Card title="隐私说明">
        <ul className="ai-privacy" style={{ margin: '4px 0 12px', paddingLeft: 18 }}>
          <li>API Key 与 Whisper Key 仅保存在本机的应用数据中，不会上传到任何服务器。</li>
          <li>使用 AI 拆解或语音解析时，相关任务的标题、描述与口述文本会直接从本机发送到你填写的模型 / 语音服务接口。</li>
          <li>智能解析（#标签、!优先级、日期等）为本地规则，不会发起网络请求。</li>
          <li>未配置模型服务时，语音录入会退回本地规则解析。</li>
        </ul>
      </Card>

      <div className="st-note">
        语法说明：<span className="kbd">#标签</span> 添加标签；<span className="kbd">!高 / !中 / !低</span> 设置优先级；<span className="kbd">~清单名</span> 归入清单；支持
        今天 / 明天 / 后天 / 周x / 下周x / M月D日 / HH:mm 等日期时间写法。
      </div>
    </>
  )
}
