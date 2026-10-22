const { app, BrowserWindow, globalShortcut, desktopCapturer, ipcMain, screen, systemPreferences } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

// GLANCE_DEBUG=1 → visible in screenshots/screen share and reads the screen on launch
const DEBUG = process.env.GLANCE_DEBUG === '1'
const MODEL = process.env.GLANCE_MODEL || 'sonnet'
const MARGIN = 16 // distance from the screen corner
// trackpad trigger: force (Force Click) | double (double click) | off
const TRIGGER = process.env.GLANCE_TRIGGER || 'force'

let win
let currentAbort // AbortController for the request in flight
let askClaudeFn

// the bridge is ESM; load it with a dynamic import
async function getAskClaude() {
  askClaudeFn ??= (await import('./bridge.mjs')).askClaude
  return askClaudeFn
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay()
  win = new BrowserWindow({
    width: 220, height: 44,
    x: workArea.x + workArea.width - 220 - MARGIN, y: workArea.y + MARGIN,
    frame: false, transparent: true, hasShadow: true, resizable: false,
    vibrancy: 'hud', visualEffectState: 'active', // native blur even without focus
    focusable: false,          // never steals focus from the app you're using
    skipTaskbar: true, alwaysOnTop: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  })
  if (!DEBUG) win.setContentProtection(true)        // private: excluded from screen share/recordings
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setIgnoreMouseEvents(true)                    // clicks pass through
  win.loadFile('index.html')
  win.once('ready-to-show', () => win.showInactive())
}

// the window follows the content size, anchored to the top-right corner
ipcMain.on('size', (_e, { width, height }) => {
  const { workArea } = screen.getPrimaryDisplay()
  const w = Math.ceil(width)
  const h = Math.min(Math.ceil(height), Math.round(workArea.height * 0.7))
  const b = win.getBounds()
  if (b.width === w && b.height === h) return
  win.setBounds({ x: workArea.x + workArea.width - w - MARGIN, y: b.y, width: w, height: h })
  win.invalidateShadow()
})

async function captureAndAsk() {
  currentAbort?.abort()
  currentAbort = new AbortController()
  const { signal } = currentAbort
  if (!win.isVisible()) win.showInactive()

  if (systemPreferences.getMediaAccessStatus('screen') !== 'granted') {
    const name = app.isPackaged ? 'glance' : 'Electron'
    fail(`macOS blocked Screen Recording.\n\nSystem Settings → Privacy & Security → Screen Recording → enable **${name}** and restart the app.`)
    return
  }

  win.webContents.send('start', { model: MODEL })
  const t0 = Date.now()

  let data
  try {
    const { width, height } = screen.getPrimaryDisplay().size
    const scale = 1568 / Math.max(width, height)      // a good size for Claude's vision
    const [src] = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) },
    })
    if (!src) throw new Error('no screen to capture')
    data = src.thumbnail.toJPEG(85).toString('base64')
  } catch (e) {
    if (!signal.aborted) fail(`Capture failed: ${e.message || e}`)
    return
  }

  const askClaude = await getAskClaude()
  try {
    await askClaude(data, {
      abortController: currentAbort,
      onText: (t) => win.webContents.send('chunk', t),
      onDone: () => !signal.aborted && win.webContents.send('done', { ms: Date.now() - t0 }),
      onError: (e) => !signal.aborted && fail(String(e)),
    })
  } catch (e) {
    if (!signal.aborted) fail(e.message || String(e))
  }
}

// native helper (trigger/glance-trigger.swift) prints a "trigger" line per gesture
function startTrigger() {
  if (TRIGGER === 'off') return
  const bin = app.isPackaged
    ? path.join(process.resourcesPath, 'bin', 'glance-trigger')
    : path.join(__dirname, 'bin', 'glance-trigger')
  const proc = spawn(bin, [TRIGGER], { stdio: ['pipe', 'pipe', 'inherit'] })
  proc.on('error', (e) => console.error(`glance: trackpad trigger unavailable (${e.message}) — run npm run build:trigger`))

  let buf = ''
  let last = 0
  proc.stdout.on('data', (d) => {
    buf += d
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i)
      buf = buf.slice(i + 1)
      if (line !== 'trigger') { console.log('glance:', line); continue }
      if (Date.now() - last < 800) continue            // one gesture, one read
      last = Date.now()
      captureAndAsk()
    }
  })
  app.on('will-quit', () => proc.kill())
}

function fail(text) {
  win.webContents.send('error', text)
  console.error(text)
}

app.whenReady().then(() => {
  app.dock?.hide()                                  // no Dock icon
  createWindow()
  console.log('glance: screen permission =', systemPreferences.getMediaAccessStatus('screen'))
  startTrigger()
  globalShortcut.register('CommandOrControl+Shift+Space', captureAndAsk)
  globalShortcut.register('CommandOrControl+Shift+H', () => (win.isVisible() ? win.hide() : win.showInactive()))
  globalShortcut.register('CommandOrControl+Shift+Down', () => win.webContents.send('scroll', 160))
  globalShortcut.register('CommandOrControl+Shift+Up', () => win.webContents.send('scroll', -160))
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit())
  if (DEBUG) win.webContents.once('did-finish-load', () => setTimeout(captureAndAsk, 800))
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  currentAbort?.abort()
})
