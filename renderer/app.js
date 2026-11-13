'use strict';

const $ = (id) => document.getElementById(id);
const api = window.cutview;

const video = $('video');
const player = $('player');
const seek = $('seek');
const track = $('track');
const trackWrap = $('trackWrap');

const SNAP_PX = 12; // how close (in pixels) a handle must get to the playhead to stick to it
const MIN_LEN = 0.1; // shortest allowed selection, in seconds
const FRAME = 1 / 30;

const state = {
  src: null, // { path, url, name } of the original file
  proxy: false, // true when a converted preview is being played instead of the original
  loaded: false,
  busy: false,
  duration: 0,
  start: 0,
  end: 0,
  drag: null, // active handle drag
  scrubbing: null, // element currently scrubbed
  previewEnd: null,
  settings: { exportDir: '', askPath: false, fastCopy: false, language: 'fr' },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pad2 = (n) => String(n).padStart(2, '0');

function fmt(t, withMs) {
  if (!isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  let out = h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
  if (withMs) out += '.' + String(Math.floor((t % 1) * 1000)).padStart(3, '0');
  return out;
}

// ---------------------------------------------------------------- toast
let toastTimer = null;
function toast(text, { error = false, action = null, ms = 7000 } = {}) {
  const el = $('toast');
  $('toastText').textContent = text;
  el.classList.toggle('error', error);
  const btn = $('toastAction');
  btn.hidden = !action;
  btn.onclick = action ? () => { action.run(); el.hidden = true; } : null;
  if (action) btn.textContent = action.label;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

// ---------------------------------------------------------------- loading
function setBusy(text, progress = 0) {
  state.busy = !!text;
  $('busy').hidden = !text;
  if (text) {
    $('busyText').textContent = text;
    $('busyFill').style.width = `${Math.round(progress * 100)}%`;
  }
}

function setEnabled(on) {
  document
    .querySelectorAll('#btnPlay, #btnBack, #btnFwd, #btnFramePrev, #btnFrameNext, #btnFull, #btnMute, #btnSetStart, #btnSetEnd, #btnPreview, #btnReset, #btnExport')
    .forEach((b) => (b.disabled = !on));
  $('speed').disabled = !on;
  $('volume').disabled = !on;
}

function loadFile(info) {
  if (!info) return;
  if (state.busy) return toast(tr('toast.wait'));
  state.src = info;
  state.proxy = false;
  state.loaded = false;
  state.previewEnd = null;
  setEnabled(false);
  $('empty').hidden = true;
  document.title = `${info.name} — CutView`;
  video.src = info.url;
  video.playbackRate = Number($('speed').value);
}

async function fallbackToProxy() {
  const info = state.src;
  setBusy(tr('busy.convert'));
  const res = await api.makeProxy(info.path);
  if (state.src !== info) return;
  setBusy(null);
  if (!res.ok) {
    if (!res.canceled) toast(tr('toast.cantPlay', { error: res.error || tr('toast.unsupported') }), { error: true, ms: 12000 });
    return;
  }
  state.proxy = true;
  video.src = res.info.url;
}

video.addEventListener('error', () => {
  if (!state.src || state.proxy || state.busy) {
    if (state.proxy) toast(tr('toast.cantPlayShort'), { error: true });
    return;
  }
  fallbackToProxy();
});

video.addEventListener('loadedmetadata', () => {
  if (!state.proxy && (!isFinite(video.duration) || video.videoWidth === 0)) {
    fallbackToProxy();
    return;
  }
  state.duration = video.duration;
  state.start = 0;
  state.end = video.duration;
  state.loaded = true;
  setEnabled(true);
  video.currentTime = 0;
  buildThumbs();
});

// ---------------------------------------------------------------- playback
function togglePlay() {
  if (!state.loaded) return;
  state.previewEnd = null;
  if (video.paused || video.ended) {
    if (video.ended) video.currentTime = 0;
    video.play();
  } else {
    video.pause();
  }
}

function seekBy(delta) {
  if (!state.loaded) return;
  state.previewEnd = null;
  video.currentTime = clamp(video.currentTime + delta, 0, state.duration);
}

function stepFrame(dir) {
  if (!state.loaded) return;
  video.pause();
  seekBy(dir * FRAME);
}

function syncPlayIcon() {
  const playing = !video.paused && !video.ended;
  $('iconPlay').toggleAttribute('hidden', playing);
  $('iconPause').toggleAttribute('hidden', !playing);
}
video.addEventListener('play', syncPlayIcon);
video.addEventListener('pause', () => {
  state.previewEnd = null;
  syncPlayIcon();
});
video.addEventListener('ended', syncPlayIcon);

function setVolume(v) {
  video.volume = clamp(v, 0, 1);
  if (video.volume > 0) video.muted = false;
  $('volume').value = String(video.volume);
  syncMute();
  try { localStorage.setItem('volume', String(video.volume)); } catch {}
}

function syncMute() {
  const muted = video.muted || video.volume === 0;
  $('iconVol').toggleAttribute('hidden', muted);
  $('iconMute').toggleAttribute('hidden', !muted);
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else player.requestFullscreen();
}

// ---------------------------------------------------------------- selection (trim)
function setStart(t) {
  state.start = clamp(t, 0, state.end - MIN_LEN);
}
function setEnd(t) {
  state.end = clamp(t, state.start + MIN_LEN, state.duration);
}

// ---------------------------------------------------------------- pointer: scrubbing
function timeAt(clientX, el) {
  const r = el.getBoundingClientRect();
  return clamp((clientX - r.left) / r.width, 0, 1) * state.duration;
}

function attachScrub(el) {
  el.addEventListener('pointerdown', (e) => {
    if (!state.loaded || e.button !== 0 || e.target.closest('.handle')) return;
    el.setPointerCapture(e.pointerId);
    state.scrubbing = el;
    state.previewEnd = null;
    video.currentTime = timeAt(e.clientX, el);
  });
  el.addEventListener('pointermove', (e) => {
    if (!state.loaded) return;
    if (state.scrubbing === el) video.currentTime = timeAt(e.clientX, el);
    showHoverTip(el, e);
  });
  const end = () => { if (state.scrubbing === el) state.scrubbing = null; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', () => hideHoverTip(el));
}

function hoverTip(el) {
  return el === seek ? $('seekTip') : $('trackTip');
}
function showHoverTip(el, e) {
  if (state.drag) return;
  const tip = hoverTip(el);
  const r = el.getBoundingClientRect();
  const x = clamp(e.clientX - r.left, 0, r.width);
  tip.textContent = fmt(timeAt(e.clientX, el), true);
  tip.style.left = `${x}px`;
  tip.hidden = false;
}
function hideHoverTip(el) {
  hoverTip(el).hidden = true;
}

attachScrub(seek);
attachScrub(track);

// ---------------------------------------------------------------- pointer: trim handles
function attachHandle(el, which) {
  el.addEventListener('pointerdown', (e) => {
    if (!state.loaded || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const r = track.getBoundingClientRect();
    const t = which === 'start' ? state.start : state.end;
    const edgeX = r.left + (t / state.duration) * r.width;
    state.drag = { which, el, offset: e.clientX - edgeX };
    el.setPointerCapture(e.pointerId);
    $('trackTip').hidden = true;
    trackWrap.classList.add('dragging');
    $('magnet').hidden = false;
    onHandleMove(e);
  });
  el.addEventListener('pointermove', (e) => {
    if (state.drag && state.drag.el === el) onHandleMove(e);
  });
  const finish = () => {
    if (!state.drag || state.drag.el !== el) return;
    state.drag = null;
    trackWrap.classList.remove('dragging', 'snapping');
    $('dragTip').hidden = true;
    $('magnet').hidden = true;
    $('handleL').classList.remove('snapped');
    $('handleR').classList.remove('snapped');
  };
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
}

function onHandleMove(e) {
  const { which, offset } = state.drag;
  const r = track.getBoundingClientRect();
  const playheadX = r.left + (video.currentTime / state.duration) * r.width;
  const edgeX = e.clientX - offset;

  let t = clamp((edgeX - r.left) / r.width, 0, 1) * state.duration;
  if (Math.abs(edgeX - playheadX) <= SNAP_PX) t = video.currentTime; // magnet

  if (which === 'start') {
    setStart(t);
    t = state.start;
  } else {
    setEnd(t);
    t = state.end;
  }

  const snapped = Math.abs(t - video.currentTime) < 1e-3;
  trackWrap.classList.toggle('snapping', snapped);
  (which === 'start' ? $('handleL') : $('handleR')).classList.toggle('snapped', snapped);

  const tip = $('dragTip');
  tip.textContent = fmt(t, true) + (snapped ? '  ·  ' + tr('ed.snapped') : '');
  tip.style.left = `${(t / state.duration) * r.width}px`;
  tip.hidden = false;
}

attachHandle($('handleL'), 'start');
attachHandle($('handleR'), 'end');

// ---------------------------------------------------------------- thumbnails strip
let thumbToken = 0;

function waitFor(el, evt, ms = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(reject, new Error('timeout')), ms);
    const ok = () => done(resolve);
    const bad = () => done(reject, new Error('media error'));
    function done(fn, arg) {
      clearTimeout(timer);
      el.removeEventListener(evt, ok);
      el.removeEventListener('error', bad);
      fn(arg);
    }
    el.addEventListener(evt, ok);
    el.addEventListener('error', bad);
  });
}

async function buildThumbs() {
  const token = ++thumbToken;
  const canvas = $('thumbs');
  const r = track.getBoundingClientRect();
  if (!state.loaded || r.width < 10) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const aspect = (video.videoWidth || 16) / (video.videoHeight || 9);
  const n = Math.max(1, Math.round(r.width / (r.height * aspect)));
  const cellW = canvas.width / n;

  const tv = document.createElement('video');
  tv.muted = true;
  tv.preload = 'auto';
  tv.src = video.currentSrc;
  try {
    await waitFor(tv, 'loadeddata');
    for (let i = 0; i < n; i++) {
      if (token !== thumbToken) return;
      tv.currentTime = ((i + 0.5) / n) * state.duration;
      await waitFor(tv, 'seeked');
      const scale = Math.max(cellW / tv.videoWidth, canvas.height / tv.videoHeight);
      const sw = cellW / scale;
      const sh = canvas.height / scale;
      ctx.drawImage(tv, (tv.videoWidth - sw) / 2, (tv.videoHeight - sh) / 2, sw, sh, i * cellW, 0, cellW, canvas.height);
    }
  } catch {
    /* the strip is cosmetic; the plain track still works */
  } finally {
    tv.removeAttribute('src');
    tv.load();
  }
}

let resizeTimer = null;
let lastTrackWidth = 0;
new ResizeObserver(() => {
  const w = Math.round(track.getBoundingClientRect().width);
  if (w === lastTrackWidth) return;
  lastTrackWidth = w;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(buildThumbs, 350);
}).observe(track);

// ---------------------------------------------------------------- render loop
const cache = {};
function setText(key, el, text) {
  if (cache[key] !== text) { cache[key] = text; el.textContent = text; }
}
function setStyle(key, el, prop, value) {
  const k = key + prop;
  if (cache[k] !== value) { cache[k] = value; el.style[prop] = value; }
}

function render() {
  requestAnimationFrame(render);
  if (!state.loaded) return;

  const d = state.duration;
  const t = video.currentTime || 0;

  if (state.previewEnd !== null && t >= state.previewEnd) {
    video.pause();
    video.currentTime = state.previewEnd;
  }

  const pct = (t / d) * 100;
  const sp = (state.start / d) * 100;
  const ep = (state.end / d) * 100;

  setStyle('fill', $('seekFill'), 'width', `${pct}%`);
  setStyle('thumb', $('seekThumb'), 'left', `${pct}%`);
  setStyle('ph', $('playhead'), 'left', `${pct}%`);
  setStyle('ss', $('seekSel'), 'left', `${sp}%`);
  setStyle('ss', $('seekSel'), 'width', `${ep - sp}%`);

  setStyle('sel', $('selection'), 'left', `${sp}%`);
  setStyle('sel', $('selection'), 'width', `${ep - sp}%`);
  setStyle('hl', $('handleL'), 'left', `${sp}%`);
  setStyle('hr', $('handleR'), 'left', `${ep}%`);
  setStyle('dl', $('dimL'), 'width', `${sp}%`);
  setStyle('dr', $('dimR'), 'width', `${100 - ep}%`);

  const rw = track.clientWidth;
  setStyle('mg', $('magnet'), 'left', `${(pct / 100) * rw - SNAP_PX}px`);
  setStyle('mg', $('magnet'), 'width', `${SNAP_PX * 2}px`);

  setText('time', $('timeLabel'), `${fmt(t)} / ${fmt(d)}`);
  setText('rs', $('roStart'), fmt(state.start, true));
  setText('re', $('roEnd'), fmt(state.end, true));
  setText('rl', $('roLen'), fmt(state.end - state.start, true));
}
requestAnimationFrame(render);

// ---------------------------------------------------------------- export
async function doExport() {
  if (!state.loaded || !state.src) return;
  video.pause();
  const modal = $('exportModal');
  $('exportText').textContent = tr(state.settings.askPath ? 'exp.choose' : 'exp.starting');
  $('exportFill').style.width = '0%';
  modal.hidden = false;

  const res = await api.exportClip({ input: state.src.path, start: state.start, end: state.end });
  modal.hidden = true;

  if (res.ok) {
    toast(tr('toast.saved', { path: res.output }), { action: { label: tr('toast.show'), run: () => api.reveal(res.output) }, ms: 15000 });
  } else if (!res.canceled) {
    toast(tr('toast.exportFailed', { error: res.error || tr('toast.unknown') }), { error: true, ms: 15000 });
  }
}

api.onExportProgress((p) => {
  $('exportFill').style.width = `${Math.round(p * 100)}%`;
  $('exportText').textContent = `${Math.round(p * 100)} %`;
});
api.onProxyProgress((p) => {
  $('busyFill').style.width = `${Math.round(p * 100)}%`;
});

$('btnCancelExport').addEventListener('click', () => api.cancelExport());
$('busyCancel').addEventListener('click', () => api.cancelExport());

// ---------------------------------------------------------------- settings dialog
function syncSettingsUi() {
  const s = state.settings;
  $('exportDir').value = s.exportDir || '';
  $('askPath').checked = s.askPath;
  $('fastCopy').checked = s.fastCopy;
  $('language').value = s.language;
  $('askNote').textContent = tr(s.askPath ? 'set.askOn' : 'set.askOff');
}

async function updateSettings(patch) {
  state.settings = await api.setSettings(patch);
  syncSettingsUi();
}

$('btnSettings').addEventListener('click', () => {
  syncSettingsUi();
  $('settingsModal').hidden = false;
});
$('btnCloseSettings').addEventListener('click', () => ($('settingsModal').hidden = true));
$('settingsModal').addEventListener('pointerdown', (e) => {
  if (e.target === $('settingsModal')) $('settingsModal').hidden = true;
});
$('btnBrowse').addEventListener('click', async () => {
  const dir = await api.pickFolder(state.settings.exportDir);
  if (dir) updateSettings({ exportDir: dir });
});
$('btnClearDir').addEventListener('click', () => updateSettings({ exportDir: '' }));
$('language').addEventListener('change', async (e) => {
  setLanguage(e.target.value);
  await updateSettings({ language: e.target.value });
});
$('askPath').addEventListener('change', (e) => updateSettings({ askPath: e.target.checked }));
$('fastCopy').addEventListener('change', (e) => updateSettings({ fastCopy: e.target.checked }));

// ---------------------------------------------------------------- buttons
async function openDialog() {
  loadFile(await api.pickFile());
}

$('btnOpen').addEventListener('click', openDialog);
$('emptyOpen').addEventListener('click', openDialog);
$('btnPlay').addEventListener('click', togglePlay);
$('btnBack').addEventListener('click', () => seekBy(-5));
$('btnFwd').addEventListener('click', () => seekBy(5));
$('btnFramePrev').addEventListener('click', () => stepFrame(-1));
$('btnFrameNext').addEventListener('click', () => stepFrame(1));
$('btnFull').addEventListener('click', toggleFullscreen);
$('btnMute').addEventListener('click', () => {
  video.muted = !video.muted;
  syncMute();
});
$('volume').addEventListener('input', (e) => setVolume(Number(e.target.value)));
$('speed').addEventListener('change', (e) => (video.playbackRate = Number(e.target.value)));

$('btnSetStart').addEventListener('click', () => setStart(video.currentTime));
$('btnSetEnd').addEventListener('click', () => setEnd(video.currentTime));
$('btnReset').addEventListener('click', () => {
  state.start = 0;
  state.end = state.duration;
});
$('btnPreview').addEventListener('click', () => {
  if (!state.loaded) return;
  video.currentTime = state.start;
  video.play().then(() => (state.previewEnd = state.end));
});
$('btnExport').addEventListener('click', doExport);

video.addEventListener('click', togglePlay);
video.addEventListener('dblclick', toggleFullscreen);

// Buttons should not keep focus, otherwise Space would "click" them again.
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) b.blur();
});

// ---------------------------------------------------------------- keyboard
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input[type="text"], select')) return;
  if (!$('settingsModal').hidden) {
    if (e.key === 'Escape') $('settingsModal').hidden = true;
    return;
  }
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 'o') { e.preventDefault(); openDialog(); return; }
  if (ctrl && e.key.toLowerCase() === 'e') { e.preventDefault(); doExport(); return; }
  if (ctrl || e.altKey) return;
  if (!state.loaded) return;

  switch (e.key) {
    case ' ': case 'k': e.preventDefault(); togglePlay(); break;
    case 'ArrowLeft': e.preventDefault(); seekBy(e.shiftKey ? -1 : -5); break;
    case 'ArrowRight': e.preventDefault(); seekBy(e.shiftKey ? 1 : 5); break;
    case ',': stepFrame(-1); break;
    case '.': stepFrame(1); break;
    case 'ArrowUp': e.preventDefault(); setVolume(video.volume + 0.05); break;
    case 'ArrowDown': e.preventDefault(); setVolume(video.volume - 0.05); break;
    case 'Home': seekBy(-state.duration); break;
    case 'End': seekBy(state.duration); break;
    case 'm': case 'M': video.muted = !video.muted; syncMute(); break;
    case 'f': case 'F': toggleFullscreen(); break;
    case 'i': case 'I': setStart(video.currentTime); break;
    case 'o': case 'O': setEnd(video.currentTime); break;
    case 'Escape': if (document.fullscreenElement) document.exitFullscreen(); break;
  }
});

// ---------------------------------------------------------------- drag & drop
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  $('dropHint').hidden = false;
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) { dragDepth = 0; $('dropHint').hidden = true; }
});
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('dropHint').hidden = true;
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const info = await api.fileInfo(api.getPathForFile(file));
  if (info) loadFile(info);
});

// ---------------------------------------------------------------- start-up
(async function init() {
  setEnabled(false);
  state.settings = await api.getSettings();
  setLanguage(state.settings.language);
  syncSettingsUi();

  let vol = 1;
  try { vol = Number(localStorage.getItem('volume') ?? 1); } catch {}
  setVolume(isFinite(vol) ? vol : 1);

  api.onOpenFile(loadFile);
  const first = await api.getInitialFile();
  if (first) loadFile(first);
})();
