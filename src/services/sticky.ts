import { useStore } from '../store/useStore'

/**
 * 打开便签：Electron 中创建独立置顶小窗口；浏览器中退化为应用内浮动便签（StickyLayer 监听事件）。
 */
export function openSticky(taskId: string) {
  const s = useStore.getState()
  const st = s.settings.sticky
  if (window.desktop) {
    void window.desktop.openSticky(taskId, {
      color: st.defaultColor,
      opacity: st.opacity,
      alwaysOnTop: st.alwaysOnTop,
      skipTaskbar: st.hideFromTaskbar,
      fontSize: st.fontSize,
    })
    return
  }
  window.dispatchEvent(new CustomEvent('dida:open-sticky', { detail: { taskId } }))
}
