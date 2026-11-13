const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'mkv', 'webm', 'mov', 'avi', 'wmv', 'flv', 'mpg', 'mpeg', 'ts', 'm2ts', '3gp', 'ogv'];

const DEFAULT_SETTINGS = { exportDir: '', askPath: false, fastCopy: false, language: 'fr' };

const MESSAGES = {
  fr: {
    openTitle: 'Ouvrir une vidéo',
    videos: 'Vidéos',
    allFiles: 'Tous les fichiers',
    folderTitle: 'Choisir le dossier d’export par défaut',
    saveTitle: 'Exporter la partie sélectionnée',
    video: 'Vidéo',
    exportRunning: 'Un export est déjà en cours.',
    sourceMissing: 'La vidéo source n’existe plus.',
    convRunning: 'Une autre conversion est déjà en cours.',
  },
  en: {
    openTitle: 'Open a video',
    videos: 'Videos',
    allFiles: 'All files',
    folderTitle: 'Choose the default export folder',
    saveTitle: 'Export the selected part',
    video: 'Video',
    exportRunning: 'An export is already running.',
    sourceMissing: 'The source video no longer exists.',
    convRunning: 'Another conversion is already running.',
  },
};
const msg = () => MESSAGES[loadSettings().language] || MESSAGES.fr;

let win = null;
let pendingFile = null;
let exportJob = null;

// ---------- settings ----------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2));
  return next;
}

// ---------- helpers ----------
function ffmpegPath() {
  return require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
}

function fileInfo(p) {
  try {
    if (!p || !fs.statSync(p).isFile()) return null;
  } catch {
    return null;
  }
  return { path: p, url: pathToFileURL(p).href, name: path.basename(p) };
}

function findFileArg(argv) {
  // Packaged: [exe, ...args]. Dev: [electron, '.', ...args].
  const args = argv.slice(app.isPackaged ? 1 : 2);
  for (const a of args) {
    if (a.startsWith('-')) continue;
    if (fileInfo(a)) return a;
  }
  return null;
}

function uniquePath(dir, base, ext) {
  let candidate = path.join(dir, base + ext);
  for (let i = 2; fs.existsSync(candidate); i++) candidate = path.join(dir, `${base} (${i})${ext}`);
  return candidate;
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function openInWindow(p) {
  const info = fileInfo(p);
  if (!info) return;
  if (win && !win.isDestroyed() && !win.webContents.isLoading()) {
    if (win.isMinimized()) win.restore();
    win.focus();
    send('open-file', info);
  } else {
    pendingFile = p;
  }
}

// ---------- window ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 780,
    minHeight: 560,
    backgroundColor: '#0e1014',
    autoHideMenuBar: true,
    title: 'CutView',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('closed', () => {
    win = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  pendingFile = findFileArg(process.argv);

  app.on('second-instance', (_e, argv) => {
    const p = findFileArg(argv);
    if (p) openInWindow(p);
    else if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (exportJob) exportJob.cancel();
    app.quit();
  });
}

// ---------- IPC: files & settings ----------
ipcMain.handle('initial-file', () => {
  const p = pendingFile;
  pendingFile = null;
  return fileInfo(p);
});

ipcMain.handle('file-info', (_e, p) => fileInfo(p));

ipcMain.handle('pick-file', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: msg().openTitle,
    properties: ['openFile'],
    filters: [
      { name: msg().videos, extensions: VIDEO_EXTENSIONS },
      { name: msg().allFiles, extensions: ['*'] },
    ],
  });
  return res.canceled ? null : fileInfo(res.filePaths[0]);
});

ipcMain.handle('pick-folder', async (_e, current) => {
  const res = await dialog.showOpenDialog(win, {
    title: msg().folderTitle,
    defaultPath: current || undefined,
    properties: ['openDirectory', 'createDirectory'],
  });
  return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle('settings-get', () => loadSettings());
ipcMain.handle('settings-set', (_e, patch) => saveSettings(patch));
ipcMain.handle('reveal', (_e, p) => shell.showItemInFolder(p));

// ---------- IPC: export ----------
function runFfmpeg(args, { totalSeconds, onProgress }) {
  const child = spawn(ffmpegPath(), args, { windowsHide: true });
  let stderrTail = '';
  let canceled = false;
  let buf = '';

  child.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const line of lines) {
      const m = /^out_time_(?:us|ms)=(\d+)/.exec(line);
      if (m && totalSeconds > 0) onProgress(Math.min(1, Number(m[1]) / 1e6 / totalSeconds));
    }
  });
  child.stderr.on('data', (chunk) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-1500);
  });

  const done = new Promise((resolve) => {
    child.on('error', (err) => resolve({ ok: false, error: err.message }));
    child.on('close', (code) => {
      if (canceled) resolve({ ok: false, canceled: true });
      else if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, error: stderrTail.trim().split(/\r?\n/).slice(-4).join('\n') || `ffmpeg exited with code ${code}` });
    });
  });

  return {
    done,
    cancel() {
      canceled = true;
      child.kill();
    },
  };
}

ipcMain.handle('export', async (_e, { input, start, end }) => {
  if (exportJob) return { ok: false, error: msg().exportRunning };
  if (!fileInfo(input)) return { ok: false, error: msg().sourceMissing };

  const settings = loadSettings();
  const duration = Math.max(0.05, end - start);
  const ext = settings.fastCopy ? path.extname(input) || '.mp4' : '.mp4';
  const base = `${path.basename(input, path.extname(input))}_cut`;
  const sourceDir = path.dirname(input);

  let output;
  if (settings.askPath) {
    let startDir = sourceDir;
    if (settings.exportDir && fs.existsSync(settings.exportDir)) startDir = settings.exportDir;
    const res = await dialog.showSaveDialog(win, {
      title: msg().saveTitle,
      defaultPath: uniquePath(startDir, base, ext),
      filters: [{ name: msg().video, extensions: [ext.slice(1)] }],
    });
    if (res.canceled || !res.filePath) return { ok: false, canceled: true };
    output = res.filePath;
  } else {
    output = uniquePath(sourceDir, base, ext);
  }

  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(start), '-i', input, '-t', String(duration), '-map', '0:v:0?', '-map', '0:a?'];
  if (settings.fastCopy) {
    args.push('-c', 'copy', '-avoid_negative_ts', 'make_zero');
  } else {
    args.push(
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k',
      '-movflags', '+faststart'
    );
  }
  args.push('-progress', 'pipe:1', '-nostats', output);

  exportJob = runFfmpeg(args, { totalSeconds: duration, onProgress: (p) => send('export-progress', p) });
  const result = await exportJob.done;
  exportJob = null;

  if (!result.ok) {
    try { fs.rmSync(output, { force: true }); } catch {}
    return result;
  }
  return { ok: true, output };
});

ipcMain.handle('export-cancel', () => {
  if (exportJob) exportJob.cancel();
});

// ---------- IPC: preview proxy for formats the player cannot decode ----------
ipcMain.handle('make-proxy', async (_e, input) => {
  const dir = path.join(os.tmpdir(), 'CutView');
  fs.mkdirSync(dir, { recursive: true });
  const stat = fs.statSync(input);
  const key = crypto.createHash('sha1').update(`${input}|${stat.size}|${stat.mtimeMs}`).digest('hex').slice(0, 16);
  const output = path.join(dir, `proxy-${key}.mp4`);
  if (fs.existsSync(output)) return { ok: true, info: fileInfo(output) };

  const partial = `${output}.part.mp4`;
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error', '-i', input,
    '-map', '0:v:0?', '-map', '0:a:0?',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
    '-progress', 'pipe:1', '-nostats', partial,
  ];
  if (exportJob) return { ok: false, error: msg().convRunning };
  const total = await probeDuration(input);
  exportJob = runFfmpeg(args, { totalSeconds: total, onProgress: (p) => send('proxy-progress', p) });
  const result = await exportJob.done;
  exportJob = null;
  if (!result.ok) {
    try { fs.rmSync(partial, { force: true }); } catch {}
    return result;
  }
  fs.renameSync(partial, output);
  return { ok: true, info: fileInfo(output) };
});

function probeDuration(input) {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath(), ['-hide_banner', '-i', input], { windowsHide: true });
    let err = '';
    child.stderr.on('data', (c) => (err += c.toString()));
    child.on('error', () => resolve(0));
    child.on('close', () => {
      const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(err);
      resolve(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0);
    });
  });
}
