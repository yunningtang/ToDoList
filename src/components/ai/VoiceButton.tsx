import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import Popover from '../common/Popover'
import { useStore } from '../../store/useStore'
import { startRecognition } from '../../services/speech'
import type { RecognitionController, SpeechError, SpeechState } from '../../services/speech'
import '../../styles/ai.css'

interface Props {
  onResult: (text: string) => void
  size?: number
  className?: string
  title?: string
  lang?: string
  disabled?: boolean
  /** 是否在小浮层中显示实时文本（默认显示） */
  showInterim?: boolean
}

/** 麦克风按钮：点击开始 / 再点停止；监听时红色脉冲，实时文本显示在小浮层里 */
export default function VoiceButton({ onResult, size = 16, className = '', title = '语音输入', lang, disabled, showInterim = true }: Props) {
  const toast = useStore((s) => s.toast)
  const openSettings = useStore((s) => s.openSettings)
  const [state, setState] = useState<SpeechState>('idle')
  const [interim, setInterim] = useState('')
  const ctrlRef = useRef<RecognitionController | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => () => ctrlRef.current?.cancel(), [])

  const handleError = (err: SpeechError) => {
    ctrlRef.current = null
    setState('idle')
    setInterim('')
    if (err.code === 'aborted') return
    if (err.code === 'not-configured' || err.code === 'unsupported') {
      toast(err.message, { label: '去设置', onClick: () => openSettings(true, 'ai') })
    } else {
      toast(err.message)
    }
  }

  const start = () => {
    if (disabled || ctrlRef.current) return
    setInterim('')
    setState('listening')
    ctrlRef.current = startRecognition({
      lang,
      onPartial: (t) => setInterim(t),
      onState: (s) => setState(s === 'idle' ? 'idle' : s),
      onFinal: (text) => {
        ctrlRef.current = null
        setState('idle')
        setInterim('')
        onResultRef.current(text)
      },
      onError: handleError,
    })
  }
  const stop = () => ctrlRef.current?.stop()
  const cancel = () => {
    ctrlRef.current?.cancel()
    ctrlRef.current = null
    setState('idle')
    setInterim('')
  }

  const listening = state === 'listening'
  const processing = state === 'processing'

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`icon-btn voice-btn ${state} ${className}`}
        title={listening ? '点击停止' : processing ? '识别中…' : title}
        disabled={disabled}
        onClick={() => (listening ? stop() : processing ? undefined : start())}
      >
        {processing ? <Loader2 size={size} className="ai-spin" /> : listening ? <Square size={size - 2} fill="currentColor" /> : <Mic size={size} />}
      </button>
      {showInterim && (
        <Popover open={state !== 'idle'} onClose={cancel} anchor={btnRef.current} className="voice-popover" placement="bottom" align="end">
          <div className="vp-status">
            {listening ? (
              <>
                <span className="vp-dot" /> 正在听…说完后点击停止
              </>
            ) : (
              <>
                <Loader2 size={12} className="ai-spin" /> 正在识别…
              </>
            )}
          </div>
          <div className={`vp-text ${interim ? '' : 'placeholder'}`}>{interim || '请开始说话'}</div>
        </Popover>
      )}
    </>
  )
}
