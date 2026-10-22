// Renders build/icon.png (1024×1024). usage: npx electron docs/make-icon.js build/icon.png
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const OUT = process.argv[process.argv.length - 1]

const html = `<!doctype html><html><body style="margin:0;width:512px;height:512px;background:transparent">
<div style="position:absolute;left:50px;top:50px;width:412px;height:412px;border-radius:92px;overflow:hidden;
  background:radial-gradient(260px 220px at 25% 15%,#4a3b8a 0%,transparent 70%),radial-gradient(260px 240px at 95% 100%,#1f6a8f 0%,transparent 65%),#101018;
  box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.12)">
  <div style="position:absolute;left:78px;top:118px;width:256px;height:176px;border-radius:26px;
    background:rgba(255,255,255,.10);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.22),0 16px 40px rgba(0,0,0,.4)">
    <div style="position:absolute;left:26px;top:24px;width:16px;height:16px;border-radius:50%;background:#6ee7a8"></div>
    <div style="position:absolute;left:26px;top:66px;width:180px;height:22px;border-radius:11px;background:#fff"></div>
    <div style="position:absolute;left:26px;top:108px;width:204px;height:12px;border-radius:6px;background:rgba(255,255,255,.45)"></div>
    <div style="position:absolute;left:26px;top:134px;width:150px;height:12px;border-radius:6px;background:rgba(255,255,255,.45)"></div>
  </div>
</div></body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, useContentSize: true })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 300))
  const img = (await win.capturePage()).resize({ width: 1024, height: 1024 })
  fs.writeFileSync(OUT, img.toPNG())
  app.quit()
})
