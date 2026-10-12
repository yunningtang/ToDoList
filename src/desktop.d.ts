/**
 * Electron 预加载脚本通过 contextBridge 暴露的桌面能力。
 * 浏览器中运行时 window.desktop 为 undefined，所有调用方都要判空。
 */
export interface DesktopBridge {
  platform: 'win32' | 'darwin' | 'linux'
  version: string
  /** 打开 / 聚焦便签窗口（一个任务一个窗口） */
  openSticky(taskId: string, opts?: { color?: string; opacity?: number; alwaysOnTop?: boolean; skipTaskbar?: boolean; fontSize?: string }): Promise<void>
  closeSticky(taskId: string): Promise<void>
  /** 当前便签窗口：置顶 / 不透明度 / 任务栏 */
  setStickyOptions(opts: { alwaysOnTop?: boolean; opacity?: number; skipTaskbar?: boolean }): Promise<void>
  /** 排列所有便签（可选恢复默认大小） */
  arrangeStickies(restoreSize: boolean, gap: 'small' | 'normal' | 'large' | 'xlarge'): Promise<void>
  /** 桌面小部件窗口 */
  openWidget(kind: 'today' | 'calendar' | 'pomo'): Promise<void>
  closeWidget(kind: 'today' | 'calendar' | 'pomo'): Promise<void>
  /** 开机自启 */
  setLaunchOnStartup(on: boolean): Promise<void>
  /** 注册全局快捷键：{ quickAdd: 'Ctrl+Shift+A', toggleWindow: 'Ctrl+Shift+E' } */
  setGlobalShortcuts(map: Record<string, string>): Promise<{ ok: string[]; failed: string[] }>
  /** 主窗口 */
  showMainWindow(): Promise<void>
  /** 监听主进程事件：'quick-add'（全局快捷键）、'data-changed'（其他窗口改了数据，需重新 hydrate） */
  on(event: 'quick-add' | 'data-changed' | 'sticky-closed', cb: (payload?: any) => void): () => void
  /** 通知其他窗口数据已变更 */
  broadcastDataChanged(): void
  /** 关闭当前（便签 / 小部件）窗口 */
  closeSelf(): Promise<void>
}

declare global {
  interface Window {
    desktop?: DesktopBridge
  }
}

export {}
