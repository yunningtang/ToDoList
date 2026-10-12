// 滴答清单 桌面壳：主窗口 + 便签窗口 + 桌面小部件 + 托盘 + 全局快捷键
const { app, BrowserWindow, shell, ipcMain, globalShortcut, Tray, Menu, nativeImage, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const zlib = require('zlib')

const DEV_URL = process.env.VITE_DEV_SERVER_URL
const DIST_INDEX = path.join(__dirname, '..', 'dist', 'index.html')
const PRELOAD = path.join(__dirname, 'preload.cjs')

const STICKY_DEFAULT = { width: 300, height: 320 }
const STICKY_MIN = { width: 200, height: 160 }
const WIDGET_SIZES = { today: { width: 320, height: 420 }, calendar: { width: 320, height: 360 }, pomo: { width: 240, height: 240 } }
const GAP_PX = { small: 8, normal: 16, large: 32, xlarge: 56 }

/** @type {BrowserWindow | null} */
let mainWin = null
/** @type {Tray | null} */
let tray = null
let quitting = false
/** taskId → BrowserWindow */
const stickies = new Map()
/** kind → BrowserWindow */
const widgets = new Map()

// ---------- 持久化（便签 / 小部件位置） ----------
function userFile(name) {
  return path.join(app.getPath('userData'), name)
}
function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(userFile(name), 'utf8'))
  } catch {
    return fallback
  }
}
function writeJson(name, data) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(userFile(name), JSON.stringify(data, null, 2), 'utf8')
  } catch (e) {
    console.warn('[main] write failed', name, e)
  }
}
const stickyStore = { get: () => readJson('stickies.json', {}), set: (d) => writeJson('stickies.json', d) }
const widgetStore = { get: () => readJson('widgets.json', {}), set: (d) => writeJson('widgets.json', d) }

function rememberBounds(store, key, win) {
  if (!win || win.isDestroyed()) return
  const data = store.get()
  data[key] = win.getBounds()
  store.set(data)
}
/** 若保存的位置已不在任何显示器内，则丢弃 */
function sanitizeBounds(b) {
  if (!b || typeof b.x !== 'number' || typeof b.y !== 'number') return null
  const inside = screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return b.x + 40 > a.x && b.x < a.x + a.width - 40 && b.y + 20 > a.y && b.y < a.y + a.height - 20
  })
  return inside ? b : null
}
function debounce(fn, ms) {
  let t = null
  return (...args) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => {
      t = null
      fn(...args)
    }, ms)
  }
}

// ---------- 加载入口（dist 或 dev server），附带 URL 参数 ----------
function loadEntry(win, query) {
  if (DEV_URL) {
    const u = new URL(DEV_URL)
    for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null) u.searchParams.set(k, String(v))
    return win.loadURL(u.toString())
  }
  const q = {}
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null) q[k] = String(v)
  return win.loadFile(DIST_INDEX, { query: q })
}
function openExternalLinks(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ---------- 主窗口 ----------
function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1710,
    height: 1170,
    minWidth: 980,
    minHeight: 640,
    title: '滴答清单',
    backgroundColor: '#f3f5fb',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  })
  loadEntry(mainWin, {})
  openExternalLinks(mainWin)
  mainWin.once('ready-to-show', () => mainWin && mainWin.show())
  // 关闭 → 隐藏到托盘
  mainWin.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    mainWin.hide()
  })
  mainWin.on('closed', () => {
    mainWin = null
  })
  return mainWin
}
function showMain() {
  if (!mainWin || mainWin.isDestroyed()) createMainWindow()
  if (mainWin.isMinimized()) mainWin.restore()
  mainWin.show()
  mainWin.focus()
}
function toggleMain() {
  if (!mainWin || mainWin.isDestroyed()) return showMain()
  if (mainWin.isVisible() && mainWin.isFocused()) mainWin.hide()
  else showMain()
}
function sendToMain(channel, payload) {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(channel, payload)
}

// ---------- 便签窗口 ----------
function stickyQuery(taskId, opts) {
  return {
    window: 'sticky',
    task: taskId,
    color: opts.color,
    opacity: opts.opacity,
    font: opts.fontSize,
  }
}
function openSticky(taskId, opts = {}) {
  const existing = stickies.get(taskId)
  if (existing && !existing.isDestroyed()) {
    existing.show()
    existing.focus()
    return
  }
  const saved = sanitizeBounds(stickyStore.get()[taskId])
  const bg = /^#[0-9a-f]{6}$/i.test(opts.color || '') ? opts.color : '#fff3b0'
  const win = new BrowserWindow({
    width: saved ? saved.width : STICKY_DEFAULT.width,
    height: saved ? saved.height : STICKY_DEFAULT.height,
    x: saved ? saved.x : undefined,
    y: saved ? saved.y : undefined,
    minWidth: STICKY_MIN.width,
    minHeight: STICKY_MIN.height,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: opts.alwaysOnTop !== false,
    skipTaskbar: !!opts.skipTaskbar,
    backgroundColor: bg,
    title: '便签',
    show: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  })
  win.__taskId = taskId
  win.__kind = 'sticky'
  if (typeof opts.opacity === 'number') win.setOpacity(Math.max(0.2, Math.min(1, opts.opacity / 100)))
  loadEntry(win, stickyQuery(taskId, opts))
  openExternalLinks(win)
  win.once('ready-to-show', () => win.show())
  const remember = debounce(() => rememberBounds(stickyStore, taskId, win), 300)
  win.on('move', remember)
  win.on('resize', remember)
  win.on('close', () => rememberBounds(stickyStore, taskId, win))
  win.on('closed', () => {
    if (stickies.get(taskId) === win) stickies.delete(taskId)
    sendToMain('sticky-closed', taskId)
  })
  stickies.set(taskId, win)
}
function liveStickies() {
  return [...stickies.values()].filter((w) => !w.isDestroyed())
}
function applyStickyOptions(win, opts) {
  if (!win || win.isDestroyed()) return
  if (typeof opts.alwaysOnTop === 'boolean') win.setAlwaysOnTop(opts.alwaysOnTop)
  if (typeof opts.skipTaskbar === 'boolean') win.setSkipTaskbar(opts.skipTaskbar)
  if (typeof opts.opacity === 'number') win.setOpacity(Math.max(0.2, Math.min(1, opts.opacity / 100)))
}
function arrangeStickies(restoreSize, gap) {
  const wins = liveStickies()
  if (!wins.length) return
  const g = GAP_PX[gap] ?? GAP_PX.normal
  const area = screen.getPrimaryDisplay().workArea
  let x = area.x + g
  let y = area.y + g
  let rowH = 0
  for (const win of wins) {
    const size = restoreSize ? { ...STICKY_DEFAULT } : { width: win.getBounds().width, height: win.getBounds().height }
    if (x + size.width > area.x + area.width && x > area.x + g) {
      x = area.x + g
      y += rowH + g
      rowH = 0
    }
    if (y + size.height > area.y + area.height) y = area.y + g
    win.setBounds({ x: Math.round(x), y: Math.round(y), width: size.width, height: size.height })
    rememberBounds(stickyStore, win.__taskId, win)
    x += size.width + g
    rowH = Math.max(rowH, size.height)
  }
}

// ---------- 桌面小部件 ----------
function openWidget(kind) {
  const size = WIDGET_SIZES[kind]
  if (!size) return
  const existing = widgets.get(kind)
  if (existing && !existing.isDestroyed()) {
    existing.show()
    return
  }
  const saved = sanitizeBounds(widgetStore.get()[kind])
  const win = new BrowserWindow({
    width: saved ? saved.width : size.width,
    height: saved ? saved.height : size.height,
    x: saved ? saved.x : undefined,
    y: saved ? saved.y : undefined,
    minWidth: 200,
    minHeight: 160,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    backgroundColor: '#ffffff',
    title: '小部件',
    show: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  })
  win.__kind = 'widget'
  win.__widget = kind
  loadEntry(win, { window: 'widget', kind })
  openExternalLinks(win)
  win.once('ready-to-show', () => win.show())
  const remember = debounce(() => rememberBounds(widgetStore, kind, win), 300)
  win.on('move', remember)
  win.on('resize', remember)
  win.on('close', () => rememberBounds(widgetStore, kind, win))
  win.on('closed', () => {
    if (widgets.get(kind) === win) widgets.delete(kind)
  })
  widgets.set(kind, win)
}
function closeWidget(kind) {
  const w = widgets.get(kind)
  if (w && !w.isDestroyed()) w.close()
}

// ---------- 全局快捷键 ----------
function toAccelerator(s) {
  return String(s || '')
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const k = p.toLowerCase()
      if (k === 'ctrl' || k === 'control' || k === 'cmd' || k === 'command' || k === 'meta') return 'CommandOrControl'
      if (k === 'win' || k === 'super') return 'Super'
      if (k === 'option') return 'Alt'
      if (k === 'esc') return 'Escape'
      if (k === 'space') return 'Space'
      return p.length === 1 ? p.toUpperCase() : p
    })
    .join('+')
}
function setGlobalShortcuts(map) {
  globalShortcut.unregisterAll()
  const ok = []
  const failed = []
  for (const [name, combo] of Object.entries(map || {})) {
    const acc = toAccelerator(combo)
    if (!acc) continue
    const handler =
      name === 'quickAdd'
        ? () => {
            showMain()
            sendToMain('quick-add')
          }
        : name === 'toggleWindow'
          ? () => toggleMain()
          : null
    if (!handler) continue
    try {
      if (globalShortcut.register(acc, handler)) ok.push(name)
      else failed.push(name)
    } catch {
      failed.push(name)
    }
  }
  return { ok, failed }
}

// ---------- 托盘图标 ----------
function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  }))
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
/** 用代码画一枚 32×32 的蓝底白勾图标（避免依赖 SVG 支持） */
function drawIconPng(size = 32) {
  const px = Buffer.alloc(size * size * 4)
  const r = size * 0.22
  const inRounded = (x, y) => {
    const cx = Math.max(r, Math.min(size - r, x))
    const cy = Math.max(r, Math.min(size - r, y))
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
  }
  // 勾：两段线段
  const seg = [
    [size * 0.28, size * 0.52, size * 0.44, size * 0.68],
    [size * 0.44, size * 0.68, size * 0.72, size * 0.34],
  ]
  const distSeg = (x, y, [ax, ay, bx, by]) => {
    const dx = bx - ax
    const dy = by - ay
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy))
  }
  const stroke = size * 0.11
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = x + 0.5
      const cy = y + 0.5
      const i = (y * size + x) * 4
      if (!inRounded(cx, cy)) continue
      const d = Math.min(distSeg(cx, cy, seg[0]), distSeg(cx, cy, seg[1]))
      const white = Math.max(0, Math.min(1, stroke - d + 0.5))
      px[i] = Math.round(0x47 + (255 - 0x47) * white)
      px[i + 1] = Math.round(0x72 + (255 - 0x72) * white)
      px[i + 2] = Math.round(0xfa + (255 - 0xfa) * white)
      px[i + 3] = 255
    }
  }
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}
function trayIcon() {
  let img = nativeImage.createFromPath(path.join(__dirname, '..', 'public', 'favicon.svg'))
  if (img.isEmpty()) img = nativeImage.createFromBuffer(drawIconPng(32))
  return img.resize({ width: 16, height: 16 })
}
function createTray() {
  try {
    tray = new Tray(trayIcon())
  } catch (e) {
    console.warn('[main] tray failed', e)
    return
  }
  tray.setToolTip('滴答清单')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示主窗口', click: () => showMain() },
      {
        label: '新建任务',
        click: () => {
          showMain()
          sendToMain('quick-add')
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          quitting = true
          app.quit()
        },
      },
    ]),
  )
  tray.on('click', () => showMain())
  tray.on('double-click', () => showMain())
}

// ---------- IPC ----------
function senderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender)
}
ipcMain.handle('sticky:open', (_e, taskId, opts) => openSticky(String(taskId), opts || {}))
ipcMain.handle('sticky:close', (_e, taskId) => {
  const w = stickies.get(String(taskId))
  if (w && !w.isDestroyed()) w.close()
})
ipcMain.handle('sticky:options', (event, opts) => {
  const from = senderWindow(event)
  // 便签窗口自己调用 → 只改自己；主窗口（设置页）调用 → 应用到全部便签
  if (from && from.__kind === 'sticky') applyStickyOptions(from, opts || {})
  else for (const w of liveStickies()) applyStickyOptions(w, opts || {})
})
ipcMain.handle('sticky:arrange', (_e, restoreSize, gap) => arrangeStickies(!!restoreSize, gap))
ipcMain.handle('widget:open', (_e, kind) => openWidget(String(kind)))
ipcMain.handle('widget:close', (_e, kind) => closeWidget(String(kind)))
ipcMain.handle('app:launch-on-startup', (_e, on) => {
  try {
    app.setLoginItemSettings({ openAtLogin: !!on, path: process.execPath, args: [path.resolve(__dirname, '..')] })
  } catch (e) {
    console.warn('[main] setLoginItemSettings failed', e)
  }
})
ipcMain.handle('app:shortcuts', (_e, map) => setGlobalShortcuts(map))
ipcMain.handle('main:show', () => showMain())
ipcMain.handle('window:close-self', (event) => {
  const w = senderWindow(event)
  if (w && w !== mainWin) w.close()
  else if (w) w.hide()
})
ipcMain.on('data-changed', (event) => {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed() && w.webContents !== event.sender) w.webContents.send('data-changed')
  }
})

// ---------- 生命周期 ----------
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMain())
  app.whenReady().then(() => {
    createMainWindow()
    createTray()
    app.on('activate', () => showMain())
  })
  app.on('before-quit', () => {
    quitting = true
  })
  app.on('will-quit', () => globalShortcut.unregisterAll())
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
