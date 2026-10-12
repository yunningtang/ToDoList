// ---- 语音识别：浏览器 Web Speech，或录音后上传到 Whisper 兼容接口 ----
import { useStore } from '../store/useStore'
import type { Settings } from '../store/types'

export type SpeechEngine = 'web' | 'whisper'
export type SpeechState = 'listening' | 'processing' | 'idle'
export type SpeechErrorCode = 'unsupported' | 'not-configured' | 'not-allowed' | 'network' | 'no-speech' | 'aborted' | 'request' | 'unknown'

export interface SpeechError {
  code: SpeechErrorCode
  message: string
  engine: SpeechEngine | null
}

export interface RecognitionOptions {
  /** 识别语言，默认取设置中的 speechLang */
  lang?: string
  /** 引擎，默认按设置自动选择 */
  engine?: SpeechEngine
  /** 中间结果（Web Speech 实时文本；Whisper 为状态提示） */
  onPartial?: (text: string) => void
  onFinal: (text: string) => void
  onError: (err: SpeechError) => void
  onState?: (state: SpeechState, engine: SpeechEngine) => void
}

export interface RecognitionController {
  /** 停止并等待识别结果 */
  stop(): void
  /** 取消，不返回结果 */
  cancel(): void
  readonly engine: SpeechEngine
}

// ---------- Web Speech 最小类型声明（lib.dom 未包含） ----------
interface WebSpeechAlternative {
  transcript: string
  confidence: number
}
interface WebSpeechResult {
  isFinal: boolean
  length: number
  [index: number]: WebSpeechAlternative
}
interface WebSpeechResultEvent {
  resultIndex: number
  results: { length: number; [index: number]: WebSpeechResult }
}
interface WebSpeechErrorEvent {
  error: string
  message?: string
}
interface WebSpeechRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((e: WebSpeechResultEvent) => void) | null
  onerror: ((e: WebSpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type WebSpeechCtor = new () => WebSpeechRecognition

function getWebSpeechCtor(): WebSpeechCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: WebSpeechCtor; webkitSpeechRecognition?: WebSpeechCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function aiSettings(): Settings['ai'] {
  return useStore.getState().settings.ai
}

export function isElectron(): boolean {
  return typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent)
}

function hasRecorder(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

function whisperConfigured(ai: Settings['ai'] = aiSettings()): boolean {
  return !!ai.whisperUrl.trim()
}

// ---------- 能力探测 ----------

export interface SpeechSupport {
  /** 浏览器内置 Web Speech 可用 */
  web: boolean
  /** 可以录音（MediaRecorder + getUserMedia） */
  recorder: boolean
  /** 已配置 Whisper 接口 */
  whisper: boolean
  isElectron: boolean
  secureContext: boolean
  /** 最终会使用的引擎；null 表示当前不可用 */
  engine: SpeechEngine | null
  /** 不可用时的原因说明 */
  reason: string
}

export function speechSupport(ai: Settings['ai'] = aiSettings()): SpeechSupport {
  const web = !!getWebSpeechCtor()
  const recorder = hasRecorder()
  const whisper = whisperConfigured(ai)
  const secureContext = typeof window === 'undefined' ? false : window.isSecureContext
  const electron = isElectron()
  let engine: SpeechEngine | null = null
  let reason = ''
  if (ai.speech === 'whisper') {
    if (whisper && recorder) engine = 'whisper'
    else if (web) engine = 'web'
  } else {
    if (web) engine = 'web'
    else if (whisper && recorder) engine = 'whisper'
  }
  if (!engine) {
    if (!web && !recorder) reason = '当前环境不支持语音识别'
    else if (!web && !whisper) reason = '当前环境没有内置语音识别，请在设置中配置 Whisper 接口'
    else reason = '未配置可用的语音识别引擎'
  } else if (engine === 'web' && electron && !whisper) {
    reason = 'Electron 中内置语音识别可能不可用，建议配置 Whisper 接口'
  }
  return { web, recorder, whisper, isElectron: electron, secureContext, engine, reason }
}

// ---------- Whisper：录音 + 上传 ----------

function fileExt(mime: string): string {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  return 'webm'
}

/** 把一段音频上传到 OpenAI 兼容的 /audio/transcriptions 接口 */
export async function transcribeAudio(blob: Blob, lang: string, ai: Settings['ai'] = aiSettings()): Promise<string> {
  const base = ai.whisperUrl.trim().replace(/\/+$/, '')
  if (!base) throw new Error('未配置 Whisper 接口地址')
  const url = `${base}/audio/transcriptions`
  const fd = new FormData()
  fd.append('file', blob, `speech.${fileExt(blob.type)}`)
  fd.append('model', 'whisper-1')
  const short = (lang || 'zh-CN').split('-')[0].toLowerCase()
  if (short) fd.append('language', short)
  fd.append('response_format', 'json')
  const headers: Record<string, string> = {}
  if (ai.whisperKey.trim()) headers.authorization = `Bearer ${ai.whisperKey.trim()}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const res = await fetch(url, { method: 'POST', headers, body: fd, signal: controller.signal })
    if (!res.ok) {
      let detail = ''
      try {
        const j = (await res.json()) as { error?: { message?: string } | string }
        detail = typeof j.error === 'string' ? j.error : j.error?.message ?? ''
      } catch {
        /* ignore */
      }
      const base = res.status === 401 ? 'Whisper Key 无效（401）' : res.status === 404 ? 'Whisper 接口地址不存在（404）' : `Whisper 识别失败（${res.status}）`
      throw new Error(detail ? `${base}：${detail}` : base)
    }
    const data = (await res.json()) as { text?: string }
    return (data.text ?? '').trim()
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw new Error('Whisper 识别超时')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

function startWhisper(opts: RecognitionOptions, lang: string): RecognitionController {
  // getUserMedia 是异步的，控制器需要同步返回：用状态机记录在录音器就绪前收到的指令
  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let pending: 'stop' | 'cancel' | null = null
  let cancelled = false
  let finished = false
  const chunks: Blob[] = []
  const ai = aiSettings()

  const cleanup = () => {
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
  }
  const fail = (code: SpeechErrorCode, message: string) => {
    if (finished) return
    finished = true
    cleanup()
    opts.onState?.('idle', 'whisper')
    opts.onError({ code, message, engine: 'whisper' })
  }

  ;(async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      const name = (e as { name?: string })?.name
      fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'not-allowed' : 'unknown', name === 'NotAllowedError' ? '麦克风权限被拒绝' : name === 'NotFoundError' ? '没有找到麦克风设备' : '无法打开麦克风')
      return
    }
    if (pending === 'cancel' || cancelled) {
      cleanup()
      finished = true
      opts.onState?.('idle', 'whisper')
      return
    }
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m))
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    } catch {
      fail('unsupported', '当前环境不支持录音')
      return
    }
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data)
    }
    recorder.onerror = () => fail('unknown', '录音出错')
    recorder.onstop = async () => {
      cleanup()
      if (cancelled || finished) {
        finished = true
        opts.onState?.('idle', 'whisper')
        return
      }
      const blob = new Blob(chunks, { type: recorder?.mimeType || mime || 'audio/webm' })
      if (blob.size < 1000) {
        fail('no-speech', '没有录到声音')
        return
      }
      opts.onState?.('processing', 'whisper')
      opts.onPartial?.('正在识别…')
      try {
        const text = await transcribeAudio(blob, lang, ai)
        finished = true
        opts.onState?.('idle', 'whisper')
        if (text) opts.onFinal(text)
        else opts.onError({ code: 'no-speech', message: '没有识别到内容', engine: 'whisper' })
      } catch (e) {
        fail(/网络|Failed to fetch|NetworkError/i.test(String(e)) ? 'network' : 'request', e instanceof Error ? e.message : String(e))
      }
    }
    recorder.start(250)
    opts.onState?.('listening', 'whisper')
    if (pending === 'stop') recorder.stop()
  })()

  return {
    engine: 'whisper',
    stop() {
      if (finished) return
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      else pending = 'stop'
    },
    cancel() {
      if (finished) return
      cancelled = true
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      else {
        pending = 'cancel'
        cleanup()
      }
    },
  }
}

// ---------- Web Speech ----------

function webErrorInfo(code: string): { code: SpeechErrorCode; message: string } {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return { code: 'not-allowed', message: '麦克风权限被拒绝，或当前环境不允许使用内置语音识别' }
    case 'network':
      return { code: 'network', message: '内置语音识别需要联网，且在 Electron 中可能不可用' }
    case 'no-speech':
      return { code: 'no-speech', message: '没有听到声音，请再试一次' }
    case 'audio-capture':
      return { code: 'not-allowed', message: '没有找到麦克风设备' }
    case 'aborted':
      return { code: 'aborted', message: '识别已取消' }
    case 'language-not-supported':
      return { code: 'unsupported', message: '不支持当前识别语言' }
    default:
      return { code: 'unknown', message: `语音识别出错（${code}）` }
  }
}

function startWeb(Ctor: WebSpeechCtor, opts: RecognitionOptions, lang: string, allowWhisperFallback: boolean): RecognitionController {
  const rec = new Ctor()
  rec.lang = lang
  rec.continuous = false
  rec.interimResults = true
  rec.maxAlternatives = 1
  let finalText = ''
  let errored = false
  let cancelled = false
  let fallback: RecognitionController | null = null
  let done = false

  rec.onstart = () => opts.onState?.('listening', 'web')
  rec.onresult = (e) => {
    let fin = ''
    let interim = ''
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i]
      const t = r[0]?.transcript ?? ''
      if (r.isFinal) fin += t
      else interim += t
    }
    finalText = fin
    opts.onPartial?.((fin + interim).trim())
  }
  rec.onerror = (e) => {
    errored = true
    if (cancelled || e.error === 'aborted') return
    const info = webErrorInfo(e.error)
    // Electron 等环境下内置识别常因缺少服务而失败：有 Whisper 配置时自动改用录音上传
    if (allowWhisperFallback && (info.code === 'network' || info.code === 'not-allowed') && whisperConfigured() && hasRecorder()) {
      done = true
      opts.onPartial?.('改用 Whisper 识别，请重新说话…')
      fallback = startWhisper(opts, lang)
      return
    }
    done = true
    opts.onState?.('idle', 'web')
    opts.onError({ ...info, engine: 'web' })
  }
  rec.onend = () => {
    if (done) return
    done = true
    opts.onState?.('idle', 'web')
    if (cancelled) return
    const text = finalText.trim()
    if (text) opts.onFinal(text)
    else if (!errored) opts.onError({ code: 'no-speech', message: '没有听到声音，请再试一次', engine: 'web' })
  }
  try {
    rec.start()
  } catch (e) {
    done = true
    opts.onError({ code: 'unknown', message: `无法启动语音识别：${e instanceof Error ? e.message : String(e)}`, engine: 'web' })
  }

  return {
    get engine() {
      return fallback ? fallback.engine : ('web' as SpeechEngine)
    },
    stop() {
      if (fallback) return fallback.stop()
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    },
    cancel() {
      if (fallback) return fallback.cancel()
      cancelled = true
      try {
        rec.abort()
      } catch {
        /* ignore */
      }
    },
  }
}

// ---------- 入口 ----------

/** 开始一次语音识别；返回控制器用于停止 / 取消 */
export function startRecognition(opts: RecognitionOptions): RecognitionController {
  const ai = aiSettings()
  const lang = opts.lang || ai.speechLang || 'zh-CN'
  const support = speechSupport(ai)
  const engine = opts.engine ?? support.engine
  const noop: RecognitionController = { engine: 'web', stop() {}, cancel() {} }

  if (!engine) {
    queueMicrotask(() =>
      opts.onError({ code: support.web || support.recorder ? 'not-configured' : 'unsupported', message: support.reason || '当前环境不支持语音识别', engine: null }),
    )
    return noop
  }
  if (engine === 'whisper') {
    if (!whisperConfigured(ai)) {
      queueMicrotask(() => opts.onError({ code: 'not-configured', message: '请先在设置中填写 Whisper 接口地址', engine: 'whisper' }))
      return noop
    }
    if (!hasRecorder()) {
      queueMicrotask(() => opts.onError({ code: 'unsupported', message: '当前环境不支持录音', engine: 'whisper' }))
      return noop
    }
    return startWhisper(opts, lang)
  }
  const Ctor = getWebSpeechCtor()
  if (!Ctor) {
    queueMicrotask(() => opts.onError({ code: 'unsupported', message: '当前环境没有内置语音识别', engine: 'web' }))
    return noop
  }
  return startWeb(Ctor, opts, lang, opts.engine === undefined)
}
