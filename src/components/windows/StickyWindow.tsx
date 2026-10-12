import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { FONT_PX, resolveStickyColor, StickyBody, StickyFrame, useRehydrateOnFocus } from './StickyBody'
import '../../styles/windows.css'

/** Electron 独立便签窗口：?window=sticky&task=ID&color=…&opacity=…&font=… */
export default function StickyWindow({ taskId }: { taskId: string }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const stickySettings = useStore((s) => s.settings.sticky)
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId))
  const [color, setColor] = useState(() => resolveStickyColor(params.get('color') || stickySettings.defaultColor))
  const [pinned, setPinned] = useState(stickySettings.alwaysOnTop)
  const fontPx = FONT_PX[stickySettings.fontSize] ?? 15

  useRehydrateOnFocus()

  useEffect(() => {
    document.title = task?.title ? `便签 · ${task.title}` : '便签'
  }, [task?.title])
  useEffect(() => {
    document.body.style.background = color
  }, [color])

  // 设置页改了“默认置顶”→ 主进程已应用到窗口，这里同步按钮状态
  useEffect(() => setPinned(stickySettings.alwaysOnTop), [stickySettings.alwaysOnTop])

  return (
    <StickyFrame
      className="sticky-window"
      color={color}
      fontPx={fontPx}
      title={task?.title ?? '便签'}
      pinned={pinned}
      onPin={(v) => {
        setPinned(v)
        void window.desktop?.setStickyOptions({ alwaysOnTop: v })
      }}
      onColor={setColor}
      onClose={() => void window.desktop?.closeSelf()}
      nativeDrag
    >
      <StickyBody taskId={taskId} />
    </StickyFrame>
  )
}
