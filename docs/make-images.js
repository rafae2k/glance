// Renders launch images using the real index.html + markdown.js as the overlay.
// usage: npx electron docs/make-images.js . docs/images
const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')

const [ROOT, OUT] = process.argv.slice(-2)
const W = 1600, H = 900

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
const markdownJs = fs.readFileSync(path.join(ROOT, 'markdown.js'), 'utf8')

// the real overlay page, fed by a fake `glance` bridge
function overlay(id, { text, ms = 2800, idle = false }) {
  const shim = `<script>
    window.glance = { _h: {}, on(c, f) { this._h[c] = f },
      size(w, h) { parent.postMessage({ id: ${JSON.stringify(id)}, w, h }, '*') } }
    addEventListener('load', () => {
      ${idle ? '' : `const h = glance._h; h.start({ model: 'sonnet' }); h.chunk(${JSON.stringify(text || '')}); h.done({ ms: ${ms} })`}
    })
  </script>`
  let doc = indexHtml
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
    .replace('<script src="markdown.js"></script>', `<script>${markdownJs}</script>`)
    .replace('<body>', `<body>${shim}`)
    .replace('</style>', '#card{background:rgba(24,24,30,.84)}</style>')
  return `<iframe class="glance" data-id="${id}" srcdoc="${doc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe>`
}

const BASE_CSS = `
  * { box-sizing: border-box }
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden }
  body { font-family: -apple-system, 'SF Pro Display', sans-serif; -webkit-font-smoothing: antialiased; color: #fff;
    background: radial-gradient(1200px 700px at 15% 10%, #3a2f6b 0%, transparent 60%),
                radial-gradient(1000px 700px at 90% 100%, #1d4f6e 0%, transparent 55%), #0e0e14; }
  iframe.glance { position: absolute; border: 0; width: 220px; height: 44px; border-radius: 12px; background: transparent;
    backdrop-filter: blur(28px) saturate(1.7); -webkit-backdrop-filter: blur(28px) saturate(1.7);
    box-shadow: 0 0 0 .5px rgba(255,255,255,.18), 0 18px 50px rgba(0,0,0,.45) }
`

const CURSOR = `<svg width="26" height="34" viewBox="0 0 26 34"><path d="M2 2v26l7-6 5 10 4-2-5-10h9z" fill="#111" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>`
const RINGS = `<div class="rings"><i></i><i></i><i></i></div>`
const RINGS_CSS = `.rings { position: absolute; width: 0; height: 0 }
  .rings i { position: absolute; border-radius: 50%; border: 2px solid rgba(124,196,255,.85); transform: translate(-50%,-50%) }
  .rings i:nth-child(1) { width: 34px; height: 34px; background: rgba(124,196,255,.25) }
  .rings i:nth-child(2) { width: 64px; height: 64px; opacity: .55 }
  .rings i:nth-child(3) { width: 98px; height: 98px; opacity: .25 }`

// ── scene 1: the product on a real-looking desktop ──────────────────────────
const BILL = `
<div class="menubar"><b></b><span>Safari</span><span>File</span><span>Edit</span><span>View</span><em>Tue 10:42</em></div>
<div class="browser">
  <div class="chrome"><i></i><i></i><i></i><div class="url">myaccount.citypower.com/billing</div></div>
  <div class="page">
    <div class="brand">City Power &amp; Light <small>Account 4410-2287-09</small></div>
    <h1>Statement for October 2026</h1>
    <p class="fine">This statement reflects charges for the service period 09/14/2026–10/13/2026. Amounts shown include applicable taxes,
      regulatory recovery charges and the Renewable Portfolio Standard surcharge pursuant to Tariff Schedule R-4. Payments received after
      the due date are subject to a late payment charge of 2.0% of the unpaid balance. Budget Billing participants: see reverse for
      reconciliation details. Autopay enrollment status is reflected in the Payment Options section below.</p>
    <div class="grid">
      <div><label>Previous balance</label><b>$161.92</b></div>
      <div><label>Payments received</label><b>−$161.92</b></div>
      <div><label>Current charges</label><b>$187.40</b></div>
      <div class="hl"><label>Total amount due</label><b>$187.40</b><small>Due 11/10/2026</small></div>
    </div>
    <table>
      <tr><td>Delivery service — 742 kWh @ $0.0891</td><td>$66.11</td></tr>
      <tr><td>Supply service — 742 kWh @ $0.1342</td><td>$99.58</td></tr>
      <tr><td>Renewable Portfolio Standard surcharge</td><td>$6.31</td></tr>
      <tr><td>Regulatory recovery &amp; taxes</td><td>$15.40</td></tr>
    </table>
    <p class="fine">Usage this period: 742 kWh (+18% vs. 629 kWh last period). Payment options: Autopay — not enrolled.</p>
  </div>
</div>`
const BILL_CSS = `
  .menubar { position: absolute; top: 0; left: 0; right: 0; height: 26px; background: rgba(20,20,28,.55); backdrop-filter: blur(20px);
    display: flex; align-items: center; gap: 18px; padding: 0 16px; font-size: 13px; color: rgba(255,255,255,.88) }
  .menubar b { width: 14px; height: 14px; border-radius: 4px; background: rgba(255,255,255,.85) }
  .menubar span:first-of-type { font-weight: 700 } .menubar em { margin-left: auto; font-style: normal }
  .browser { position: absolute; left: 70px; top: 92px; width: 1060px; height: 660px; border-radius: 12px; overflow: hidden;
    background: #fff; box-shadow: 0 0 0 .5px rgba(0,0,0,.4), 0 30px 80px rgba(0,0,0,.5); color: #222 }
  .chrome { height: 44px; background: #ececef; display: flex; align-items: center; gap: 8px; padding: 0 16px; border-bottom: 1px solid #d8d8dc }
  .chrome i { width: 12px; height: 12px; border-radius: 50% } .chrome i:nth-child(1){background:#ff5f57}.chrome i:nth-child(2){background:#febc2e}.chrome i:nth-child(3){background:#28c840}
  .url { margin: 0 auto; width: 460px; height: 28px; border-radius: 7px; background: #fff; font-size: 13px; color: #666; display: grid; place-items: center }
  .page { padding: 34px 48px; font-family: Georgia, serif }
  .brand { font: 700 15px -apple-system; color: #0b5394; display: flex; justify-content: space-between }
  .brand small { font-weight: 400; color: #888 }
  h1 { font: 600 26px -apple-system; margin: 18px 0 10px }
  .fine { font-size: 12.5px; line-height: 1.55; color: #666; margin: 0 0 22px }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; font-family: -apple-system }
  .grid div { border: 1px solid #e3e3e8; border-radius: 8px; padding: 12px 14px }
  .grid label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #888 }
  .grid b { font-size: 21px } .grid small { display: block; font-size: 11.5px; color: #888 }
  .grid .hl { border-color: #0b5394; background: #f3f7fc }
  table { width: 100%; border-collapse: collapse; font: 13.5px -apple-system; margin-bottom: 18px }
  td { padding: 9px 4px; border-bottom: 1px solid #eee } td:last-child { text-align: right }
  .cursor { position: absolute; left: 1018px; top: 362px } .rings { left: 1020px; top: 364px }
  iframe.glance { transform: scale(1.3); transform-origin: top right }
`

const scenes = {
  'glance-hero': {
    css: BILL_CSS + RINGS_CSS,
    html: BILL + RINGS + `<div class="cursor">${CURSOR}</div>` +
      overlay('a', { text: '$187.40, due November 10\n\n- **Late fee**: 2% if paid after the 10th\n- **Autopay** is off on this account\n- Usage is **18% higher** than last month', ms: 2600 }),
    place: { a: { right: 24, top: 42 } },
  },

  // ── scene 2: title card ────────────────────────────────────────────────────
  'glance-title': {
    css: `.copy { position: absolute; left: 110px; top: 0; bottom: 0; width: 640px; display: flex; flex-direction: column; justify-content: center }
      .logo { font-size: 15px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.55); margin-bottom: 26px }
      h1 { font-size: 76px; line-height: 1.02; letter-spacing: -.035em; margin: 0 0 26px; font-weight: 700 }
      h1 span { color: #7cc4ff }
      p { font-size: 23px; line-height: 1.45; color: rgba(255,255,255,.7); margin: 0; max-width: 560px }
      .leaflet { position: absolute; right: 90px; top: 190px; width: 600px; height: 500px; border-radius: 14px; background: #fbfaf6; color: #333;
        padding: 30px 34px; font: 12px/1.55 Georgia, serif; box-shadow: 0 30px 80px rgba(0,0,0,.5); transform: rotate(1.5deg) }
      .leaflet h3 { font: 700 15px -apple-system; margin: 0 0 12px; color: #8a1c1c } .leaflet p { color: #555; font-size: 12px; margin: 0 0 10px; max-width: none }`,
    html: `<div class="copy"><div class="logo">glance</div>
        <h1>Look at it.<br><span>Click.</span> Understand it.</h1>
        <p>An open-source macOS assistant that reads your screen and answers in one line. Triggered by a trackpad click — no keyboard needed.</p></div>
      <div class="leaflet"><h3>PATIENT INFORMATION LEAFLET — Amoxicillin 500 mg capsules</h3>
        <p>4. How to take this medicine. Always take this medicine exactly as your doctor or pharmacist has told you. Check with your doctor or pharmacist if you are not sure. The usual dose in adults and children weighing 40 kg and over is 250 mg to 500 mg three times a day, or 750 mg to 1 g every 12 hours, depending on the severity and type of infection. Severe infections: 750 mg to 1 g three times a day.</p>
        <p>Swallow the capsules whole with water. Space the doses evenly during the day, at least 4 hours apart. Do not take more than 6 g per day. Patients with kidney problems: the dose may be lower than the usual dose.</p>
        <p>If you forget to take this medicine, take it as soon as you remember. Do not take the next dose too soon; wait about 4 hours before taking the next dose. Do not take a double dose to make up for a forgotten dose.</p>
        <p>Keep taking this medicine until the treatment is finished, even if you feel better. You need every dose to help fight the infection.</p></div>` +
      overlay('b', { text: 'One capsule 3 times a day, until the treatment is done\n\n- **Space doses** at least 4 hours apart\n- **Forgot one?** Take it now — never double up\n- Swallow whole, with water', ms: 2100 }),
    place: { b: { right: 150, top: 380 } },
  },

  // ── scene 3: the trigger ──────────────────────────────────────────────────
  'glance-trigger': {
    css: RINGS_CSS + `.copy { position: absolute; left: 110px; top: 0; bottom: 0; width: 600px; display: flex; flex-direction: column; justify-content: center }
      h1 { font-size: 64px; line-height: 1.05; letter-spacing: -.03em; margin: 0 0 24px; font-weight: 700 }
      p { font-size: 22px; line-height: 1.5; color: rgba(255,255,255,.7); margin: 0 0 14px }
      .chips { display: flex; gap: 10px; margin-top: 18px } .chip { font-size: 15px; padding: 8px 14px; border-radius: 99px; background: rgba(255,255,255,.08); color: rgba(255,255,255,.85) }
      .pad { position: absolute; right: 150px; top: 230px; width: 620px; height: 420px; border-radius: 26px;
        background: linear-gradient(160deg, #3b3b44, #24242b); box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 40px 90px rgba(0,0,0,.55) }
      .pad .rings { left: 330px; top: 200px } .pad .rings i:nth-child(1) { width: 60px; height: 60px } .pad .rings i:nth-child(2) { width: 120px; height: 120px } .pad .rings i:nth-child(3) { width: 190px; height: 190px }
      .finger { position: absolute; left: 300px; top: 168px; width: 64px; height: 84px; border-radius: 32px 32px 26px 26px;
        background: linear-gradient(180deg, #e9c3a6, #d6a582); box-shadow: 0 10px 24px rgba(0,0,0,.4) }
      .label { position: absolute; left: 0; right: 0; bottom: 30px; text-align: center; font-size: 16px; color: rgba(255,255,255,.5); letter-spacing: .04em }`,
    html: `<div class="copy"><h1>Press a little harder.<br>That's it.</h1>
        <p>A Force Click anywhere reads the screen. The answer floats in the corner — your focus never leaves what you were doing.</p>
        <div class="chips"><span class="chip">Force Click</span><span class="chip">or double click</span><span class="chip">keyboard optional</span></div></div>
      <div class="pad">${RINGS}<div class="finger"></div><div class="label">FORCE CLICK → READ SCREEN</div></div>` +
      overlay('c', { idle: true }),
    place: { c: { right: 24, top: 24 } },
  },

  // ── scene 4: answer-first typography ──────────────────────────────────────
  'glance-answer': {
    css: `.copy { position: absolute; left: 110px; top: 0; bottom: 0; width: 560px; display: flex; flex-direction: column; justify-content: center }
      h1 { font-size: 64px; line-height: 1.05; letter-spacing: -.03em; margin: 0 0 24px; font-weight: 700 }
      p { font-size: 22px; line-height: 1.5; color: rgba(255,255,255,.7); margin: 0 }
      ul { list-style: none; padding: 0; margin: 30px 0 0; font-size: 19px; color: rgba(255,255,255,.85) } li { margin: 10px 0 } li b { color: #7cc4ff; font-weight: 600; margin-right: 8px }
      iframe.glance { transform: scale(1.45); transform-origin: top right }`,
    html: `<div class="copy"><h1>The answer first.<br>Nothing else.</h1>
        <p>One line you can read at a glance, then only the details that matter.</p>
        <ul><li><b>Private</b>hidden from screen share and recordings</li><li><b>Calm</b>never steals focus, clicks pass through</li><li><b>Open</b>MIT licensed, runs on your Claude account</li></ul></div>` +
      overlay('d', { text: 'Restart the router, then rejoin "Home-5G"\n\n- **Error 651**: the modem dropped the connection\n- Hold the reset button **10 seconds** if it persists', ms: 1900 }),
    place: { d: { right: 120, top: 300 } },
  },
}

function page(s) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${s.css}</style></head><body>${s.html}
  <script>
    const place = ${JSON.stringify(s.place)}
    for (const f of document.querySelectorAll('iframe.glance')) Object.assign(f.style, Object.fromEntries(Object.entries(place[f.dataset.id]).map(([k, v]) => [k, v + 'px'])))
    let pending = document.querySelectorAll('iframe.glance').length
    addEventListener('message', (e) => {
      const f = document.querySelector('iframe[data-id="' + e.data.id + '"]')
      f.style.width = Math.ceil(e.data.w) + 'px'; f.style.height = Math.ceil(e.data.h) + 'px'
    })
  </script></body></html>`
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const win = new BrowserWindow({ width: W, height: H, show: false, useContentSize: true, enableLargerThanScreen: true })
  for (const [name, s] of Object.entries(scenes)) {
    const file = path.join(OUT, `.${name}.html`)
    fs.writeFileSync(file, page(s))
    await win.loadFile(file)
    await new Promise((r) => setTimeout(r, 900))
    const img = await win.capturePage({ x: 0, y: 0, width: W, height: H })
    fs.writeFileSync(path.join(OUT, `${name}.png`), img.toPNG())
    fs.unlinkSync(file)
    console.log(name, img.getSize())
  }
  app.quit()
})
