const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('glance', {
  on: (ch, fn) => ipcRenderer.on(ch, (_e, v) => fn(v)),
  size: (width, height) => ipcRenderer.send('size', { width, height }),
})
