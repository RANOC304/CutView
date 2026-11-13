const { contextBridge, ipcRenderer, webUtils } = require('electron');

const on = (channel) => (cb) => ipcRenderer.on(channel, (_e, payload) => cb(payload));

contextBridge.exposeInMainWorld('cutview', {
  getInitialFile: () => ipcRenderer.invoke('initial-file'),
  onOpenFile: on('open-file'),
  pickFile: () => ipcRenderer.invoke('pick-file'),
  pickFolder: (current) => ipcRenderer.invoke('pick-folder', current),
  fileInfo: (p) => ipcRenderer.invoke('file-info', p),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getSettings: () => ipcRenderer.invoke('settings-get'),
  setSettings: (patch) => ipcRenderer.invoke('settings-set', patch),
  exportClip: (opts) => ipcRenderer.invoke('export', opts),
  cancelExport: () => ipcRenderer.invoke('export-cancel'),
  onExportProgress: on('export-progress'),
  makeProxy: (input) => ipcRenderer.invoke('make-proxy', input),
  onProxyProgress: on('proxy-progress'),
  reveal: (p) => ipcRenderer.invoke('reveal', p),
});
