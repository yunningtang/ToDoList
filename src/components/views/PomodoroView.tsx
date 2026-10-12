import { useEffect, useRef, useState } from 'react'
import { BarChart2, Check, Ellipsis, Music2, Play, Plus, Settings2, Square } from 'lucide-react'
import { useStore } from '../../store/useStore'
import Popover, { MenuDivider, MenuItem, MenuTitle, usePopover } from '../common/Popover'
import TimerPanel from './pomodoro/TimerPanel'
import RecordsPanel from './pomodoro/RecordsPanel'
import { AddRecordModal, FocusSettingsModal, StatsModal } from './pomodoro/PomodoroModals'
import { noiseShouldPlay, useTimerStore } from './pomodoro/timerStore'
import { NOISE_LABELS, setNoise, stopNoise } from '../../services/noise'
import type { NoiseKind } from '../../services/noise'
import '../../styles/pomodoro.css'

const NOISE_KINDS: NoiseKind[] = ['none', 'white', 'pink', 'brown', 'rain']
const PREVIEW_MS = 3000

/** 番茄专注视图 */
export default function PomodoroView() {
  const toast = useStore((s) => s.toast)
  const pomo = useStore((s) => s.settings.pomodoro)
  const updateSettings = useStore((s) => s.updateSettings)
  const mode = useTimerStore((s) => s.mode)
  const status = useTimerStore((s) => s.status)
  const phase = useTimerStore((s) => s.phase)
  const setMode = useTimerStore((s) => s.setMode)
  const more = usePopover()
  const noise = usePopover()
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [previewing, setPreviewing] = useState<NoiseKind | null>(null)
  const previewTimer = useRef<number | null>(null)

  const switchMode = (m: 'pomo' | 'stopwatch') => {
    if (m === mode) return
    if (!setMode(m)) toast('请先结束当前计时')
  }

  /** 试听结束后：若计时中应播放噪音则恢复，否则停止 */
  const endPreview = () => {
    if (previewTimer.current !== null) {
      window.clearTimeout(previewTimer.current)
      previewTimer.current = null
    }
    setPreviewing(null)
    const t = useTimerStore.getState()
    const p = useStore.getState().settings.pomodoro
    if (noiseShouldPlay(t) && p.noise !== 'none') setNoise(p.noise, p.noiseVolume)
    else stopNoise()
  }
  const preview = (kind: NoiseKind) => {
    if (previewing) {
      endPreview()
      if (previewing === kind) return
    }
    if (kind === 'none') return
    setNoise(kind, pomo.noiseVolume)
    setPreviewing(kind)
    previewTimer.current = window.setTimeout(endPreview, PREVIEW_MS)
  }
  // 试听中音量变化即时生效
  useEffect(() => {
    if (previewing) setNoise(previewing, pomo.noiseVolume)
  }, [previewing, pomo.noiseVolume])
  // 离开视图时结束试听
  useEffect(() => () => {
    if (previewTimer.current !== null) {
      window.clearTimeout(previewTimer.current)
      previewTimer.current = null
      const t = useTimerStore.getState()
      const p = useStore.getState().settings.pomodoro
      if (noiseShouldPlay(t) && p.noise !== 'none') setNoise(p.noise, p.noiseVolume)
      else stopNoise()
    }
  }, [])

  const playing = pomo.noise !== 'none' && noiseShouldPlay({ status, phase })
  const noiseHint = pomo.noise === 'none' ? '关闭' : `${NOISE_LABELS[pomo.noise]}${playing ? ' · 播放中' : ''}`

  return (
    <div className="pomo-root">
      <div className="pomo-left">
        <header className="pomo-header">
          <h1 className="page-title">番茄专注</h1>
          <div className="segmented">
            <button className={mode === 'pomo' ? 'active' : ''} onClick={() => switchMode('pomo')} disabled={status !== 'idle' && mode !== 'pomo'}>
              番茄计时
            </button>
            <button className={mode === 'stopwatch' ? 'active' : ''} onClick={() => switchMode('stopwatch')} disabled={status !== 'idle' && mode !== 'stopwatch'}>
              正计时
            </button>
          </div>
          <div className="header-actions">
            <button className="icon-btn" title="添加专注记录" onClick={() => setAddOpen(true)}>
              <Plus size={24} />
            </button>
            <button className="icon-btn" title="更多" onClick={more.show}>
              <Ellipsis size={24} />
            </button>
          </div>
        </header>
        <TimerPanel />
      </div>

      <RecordsPanel onAdd={() => setAddOpen(true)} />

      {/* 头部「...」菜单 */}
      <Popover open={more.open} onClose={more.hide} anchor={more.anchor} placement="bottom" align="end" closeOnClick>
        <MenuItem icon={<Settings2 size={16} />} label="专注设置" onClick={() => setSettingsOpen(true)} />
        <MenuItem icon={<BarChart2 size={16} />} label="专注统计" onClick={() => setStatsOpen(true)} />
        <MenuDivider />
        <MenuItem
          icon={<Music2 size={16} />}
          label="白噪音"
          hint={`${noiseHint} ›`}
          onClick={() => {
            if (more.anchor) noise.show(more.anchor)
          }}
        />
      </Popover>

      {/* 白噪音选择器 */}
      <Popover
        open={noise.open}
        onClose={() => {
          if (previewing) endPreview()
          noise.hide()
        }}
        anchor={noise.anchor}
        placement="bottom"
        align="end"
        style={{ width: 260 }}
      >
        <MenuTitle>白噪音 · 专注计时进行中播放</MenuTitle>
        {NOISE_KINDS.map((k) => (
          <MenuItem
            key={k}
            label={NOISE_LABELS[k]}
            active={pomo.noise === k}
            right={
              <span className="pomo-noise-right">
                {k !== 'none' && (
                  <button
                    className={`pomo-noise-preview ${previewing === k ? 'on' : ''}`}
                    title={previewing === k ? '停止试听' : '试听 3 秒'}
                    onClick={(e) => {
                      e.stopPropagation()
                      preview(k)
                    }}
                  >
                    {previewing === k ? <Square size={11} /> : <Play size={11} />}
                  </button>
                )}
                {pomo.noise === k && <Check size={14} />}
              </span>
            }
            onClick={() => {
              updateSettings({ pomodoro: { noise: k } })
              toast(k === 'none' ? '已关闭白噪音' : `白噪音：${NOISE_LABELS[k]}`)
            }}
          />
        ))}
        <MenuDivider />
        <div className="pomo-noise-volume">
          <div className="pomo-noise-volume-head">
            <span>音量</span>
            <span className="val">{pomo.noiseVolume}%</span>
          </div>
          <input
            type="range"
            className="slider"
            min={0}
            max={100}
            step={1}
            value={pomo.noiseVolume}
            style={{ ['--pct' as string]: `${pomo.noiseVolume}%`, width: '100%' }}
            onChange={(e) => updateSettings({ pomodoro: { noiseVolume: Number(e.target.value) } })}
          />
          <div className="pomo-noise-foot">
            <button
              className="btn sm"
              disabled={pomo.noise === 'none'}
              onClick={() => preview(pomo.noise)}
            >
              {previewing && previewing === pomo.noise ? <Square size={12} /> : <Play size={12} />}
              {previewing && previewing === pomo.noise ? '停止' : '试听'}
            </button>
            <span className="hint">{playing ? '正在播放' : '开始专注后自动播放'}</span>
          </div>
        </div>
      </Popover>

      <AddRecordModal open={addOpen} onClose={() => setAddOpen(false)} />
      <FocusSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
    </div>
  )
}
