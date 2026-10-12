// 通过 contextBridge 暴露 window.desktop（契约见 src/desktop.d.ts）
const { contextBridge, ipcRenderer } = require('electron')

const EVENTS = new Set(['quick-add', 'data-changed', 'sticky-closed'])

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  version: process.versions.electron,
  openSticky: (taskId, opts) => ipcRenderer.invoke('sticky:open', taskId, opts || {}),
  closeSticky: (taskId) => ipcRenderer.invoke('sticky:close', taskId),
  setStickyOptions: (opts) => ipcRenderer.invoke('sticky:options', opts || {}),
  arrangeStickies: (restoreSize, gap) => ipcRenderer.invoke('sticky:arrange', !!restoreSize, gap),
  openWidget: (kind) => ipcRenderer.invoke('widget:open', kind),
  closeWidget: (kind) => ipcRenderer.invoke('widget:close', kind),
  setLaunchOnStartup: (on) => ipcRenderer.invoke('app:launch-on-startup', !!on),
  setGlobalShortcuts: (map) => ipcRenderer.invoke('app:shortcuts', map || {}),
  showMainWindow: () => ipcRenderer.invoke('main:show'),
  on: (event, cb) => {
    if (!EVENTS.has(event) || typeof cb !== 'function') return () => {}
    const handler = (_e, payload) => cb(payload)
    ipcRenderer.on(event, handler)
    return () => ipcRenderer.removeListener(event, handler)
  },
  broadcastDataChanged: () => ipcRenderer.send('data-changed'),
  closeSelf: () => ipcRenderer.invoke('window:close-self'),
})
