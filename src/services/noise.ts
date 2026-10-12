/**
 * 白噪音生成器（WebAudio，纯程序合成，无需音频文件）
 * - white：均匀随机噪声
 * - pink：Paul Kellet 滤波近似
 * - brown：对白噪声积分（随机游走）
 * - rain：棕噪声底 + 带通滤波的白噪声“雨滴”层（LFO + 随机脉冲调制）
 *
 * 音量 0–100 → 增益 0–0.6，切换/停止均做平滑渐变。
 */

export type NoiseKind = 'none' | 'white' | 'pink' | 'brown' | 'rain'

const MAX_GAIN = 0.6
const RAMP = 0.35 // 秒
const BUFFER_SECONDS = 8

interface Playing {
  kind: NoiseKind
  master: GainNode
  sources: AudioScheduledSourceNode[]
  timers: number[]
}

let ctx: AudioContext | null = null
let current: Playing | null = null
const buffers = new Map<string, AudioBuffer>()

function getCtx(): AudioContext | null {
  if (ctx) return ctx
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    ctx = new Ctx()
  } catch {
    ctx = null
  }
  return ctx
}

function gainOf(volume: number): number {
  const v = Math.max(0, Math.min(100, Number(volume) || 0))
  return (v / 100) * MAX_GAIN
}

/** 生成循环噪声缓冲区（首尾做短交叉淡化，避免接缝爆音） */
function noiseBuffer(ac: AudioContext, kind: 'white' | 'pink' | 'brown'): AudioBuffer {
  const key = `${kind}-${ac.sampleRate}`
  const cached = buffers.get(key)
  if (cached) return cached
  const len = Math.floor(ac.sampleRate * BUFFER_SECONDS)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  if (kind === 'white') {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  } else if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
  } else {
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      data[i] = last * 3.5
    }
  }
  // 接缝交叉淡化（约 50ms）
  const fade = Math.min(Math.floor(ac.sampleRate * 0.05), Math.floor(len / 4))
  for (let i = 0; i < fade; i++) {
    const t = i / fade
    const a = data[i]
    const b = data[len - fade + i]
    data[i] = a * t + b * (1 - t)
  }
  buffers.set(key, buf)
  return buf
}

function makeLoop(ac: AudioContext, kind: 'white' | 'pink' | 'brown'): AudioBufferSourceNode {
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer(ac, kind)
  src.loop = true
  return src
}

function build(ac: AudioContext, kind: Exclude<NoiseKind, 'none'>, master: GainNode): { sources: AudioScheduledSourceNode[]; timers: number[] } {
  const sources: AudioScheduledSourceNode[] = []
  const timers: number[] = []
  const now = ac.currentTime
  if (kind !== 'rain') {
    const src = makeLoop(ac, kind)
    src.connect(master)
    src.start(now)
    sources.push(src)
    return { sources, timers }
  }

  // 雨声：低沉的棕噪声底层
  const bed = makeLoop(ac, 'brown')
  const bedLp = ac.createBiquadFilter()
  bedLp.type = 'lowpass'
  bedLp.frequency.value = 900
  const bedGain = ac.createGain()
  bedGain.gain.value = 0.55
  bed.connect(bedLp).connect(bedGain).connect(master)
  bed.start(now)
  sources.push(bed)

  // 雨滴层：白噪声 → 带通 → 增益（LFO 缓慢起伏 + 随机阵雨脉冲）
  const drops = makeLoop(ac, 'white')
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2600
  bp.Q.value = 0.7
  const hp = ac.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 1200
  const dropGain = ac.createGain()
  dropGain.gain.value = 0.35
  drops.connect(bp).connect(hp).connect(dropGain).connect(master)
  drops.start(now)
  sources.push(drops)

  const lfo = ac.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 0.18
  const lfoGain = ac.createGain()
  lfoGain.gain.value = 0.12
  lfo.connect(lfoGain).connect(dropGain.gain)
  lfo.start(now)
  sources.push(lfo)

  // 随机阵雨：每 0.6–2.2 秒给雨滴层一个短促的强弱变化
  const burst = () => {
    if (!ctx || current?.master !== master) return
    const t = ctx.currentTime
    const peak = 0.3 + Math.random() * 0.4
    dropGain.gain.cancelScheduledValues(t)
    dropGain.gain.setTargetAtTime(peak, t, 0.08)
    dropGain.gain.setTargetAtTime(0.3, t + 0.15 + Math.random() * 0.3, 0.5)
    timers.push(window.setTimeout(burst, 600 + Math.random() * 1600))
  }
  timers.push(window.setTimeout(burst, 400))
  return { sources, timers }
}

function teardown(p: Playing, ac: AudioContext) {
  for (const id of p.timers) window.clearTimeout(id)
  const t = ac.currentTime
  p.master.gain.cancelScheduledValues(t)
  p.master.gain.setValueAtTime(p.master.gain.value, t)
  p.master.gain.linearRampToValueAtTime(0, t + RAMP)
  const stopAt = t + RAMP + 0.05
  for (const s of p.sources) {
    try {
      s.stop(stopAt)
    } catch {
      /* 已停止 */
    }
  }
  window.setTimeout(() => {
    try {
      p.master.disconnect()
    } catch {
      /* ignore */
    }
  }, (RAMP + 0.2) * 1000)
}

/** 播放 / 切换噪音；kind 为 'none' 等价于 stopNoise()。音量变化时平滑过渡。 */
export function setNoise(kind: NoiseKind, volume: number) {
  if (kind === 'none') {
    stopNoise()
    return
  }
  const ac = getCtx()
  if (!ac) return
  if (ac.state === 'suspended') ac.resume().catch(() => undefined)
  const target = gainOf(volume)
  if (current && current.kind === kind) {
    const t = ac.currentTime
    current.master.gain.cancelScheduledValues(t)
    current.master.gain.setValueAtTime(current.master.gain.value, t)
    current.master.gain.linearRampToValueAtTime(target, t + 0.15)
    return
  }
  if (current) {
    teardown(current, ac)
    current = null
  }
  const master = ac.createGain()
  master.gain.value = 0
  master.connect(ac.destination)
  const { sources, timers } = build(ac, kind, master)
  const t = ac.currentTime
  master.gain.setValueAtTime(0, t)
  master.gain.linearRampToValueAtTime(target, t + RAMP)
  current = { kind, master, sources, timers }
}

export function stopNoise() {
  if (!current || !ctx) {
    current = null
    return
  }
  teardown(current, ctx)
  current = null
}

export function isPlaying(): boolean {
  return current !== null
}

export function currentNoise(): NoiseKind {
  return current?.kind ?? 'none'
}

export const NOISE_LABELS: Record<NoiseKind, string> = {
  none: '无',
  white: '白噪音',
  pink: '粉噪音',
  brown: '棕噪音',
  rain: '雨声',
}
