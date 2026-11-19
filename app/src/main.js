// Neon Coast Cover Studio — editor wiring: photo tray, panel dragging,
// layout / grade / size controls, caption editing, undo-redo and PNG export.
// The preview canvas and every export are painted by renderCover in
// cover.js, so the editor always shows the finished cover.

import { defaultState, panelsForLayout, History, LAYOUTS, GRADES, SIZES } from './state.js';
import { renderCover, panelRects } from './cover.js';
import { runShot } from './shots.js';

const state = defaultState();
const history = new History(state);
const photos = new Map();
let uploadCount = 0;
let drag = null;

const $ = (id) => document.getElementById(id);
const canvas = $('coverCanvas');
const ctx = canvas.getContext('2d');
const statusLine = $('statusLine');

function say(text) {
  if (statusLine) statusLine.textContent = text;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function ensureSample(id) {
  if (photos.has(id)) return photos.get(id);
  const img = await loadImage(`samples/${id}.jpg`);
  photos.set(id, img);
  return img;
}

function previewDims() {
  const size = SIZES.find((s) => s.id === state.size) ?? SIZES[0];
  const scale = 960 / Math.max(size.w, size.h);
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

function render() {
  const shotCover = document.body.classList.contains('shot-cover');
  let w;
  let h;
  if (shotCover) {
    w = window.innerWidth;
    h = window.innerHeight;
  } else {
    const dims = previewDims();
    w = dims.w;
    h = dims.h;
  }
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  renderCover(ctx, w, h, state, photos);
  refreshUndoButtons();
  refreshPanelLabel();
}

let renderQueued = false;
function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

function refreshUndoButtons() {
  if ($('undoBtn')) $('undoBtn').disabled = !history.canUndo;
  if ($('redoBtn')) $('redoBtn').disabled = !history.canRedo;
}

function refreshPanelLabel() {
  const panel = state.panels[state.selected];
  if ($('panelLabel')) {
    $('panelLabel').textContent = panel
      ? `Panel ${state.selected + 1} of ${state.panels.length} — ${panel.photo} · zoom ${panel.zoom.toFixed(2)}×`
      : 'No panel';
  }
  if ($('zoomRange') && panel) $('zoomRange').value = String(panel.zoom);
}

function commit() {
  history.push(state);
  queueRender();
}

// ---- photo tray -----------------------------------------------------------

function rebuildTray() {
  const tray = $('photoTray');
  if (!tray) return;
  tray.innerHTML = '';
  for (const [id] of photos) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.dataset.photo = id;
    button.title = `Use ${id} in the selected panel`;
    const img = photos.get(id);
    const thumb = document.createElement('img');
    thumb.src = img.src;
    thumb.alt = id;
    button.appendChild(thumb);
    const label = document.createElement('span');
    label.textContent = id;
    button.appendChild(label);
    button.addEventListener('click', () => {
      const panel = state.panels[state.selected];
      if (!panel) return;
      panel.photo = id;
      commit();
      say(`Panel ${state.selected + 1} now shows ${id}.`);
    });
    tray.appendChild(button);
  }
}

async function addUpload(file) {
  if (!file || !file.type.startsWith('image/')) return;
  uploadCount += 1;
  const id = `upload-${uploadCount}`;
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  photos.set(id, img);
  rebuildTray();
  const panel = state.panels[state.selected];
  if (panel) {
    panel.photo = id;
    panel.dx = 0;
    panel.dy = 0;
    panel.zoom = 1;
  }
  commit();
  say(`Loaded ${file.name} into panel ${state.selected + 1}.`);
}

// ---- shot scenes ----------------------------------------------------------

async function loadShotPhoto(photoId, caption, options = {}) {
  await ensureSample(photoId);
  const other = photoId === 'pier' ? 'boulevard' : 'pier';
  await ensureSample(other);
  if (options.layout) {
    state.layout = options.layout;
    state.panels = panelsForLayout(state, state.layout);
  }
  if (options.grade) state.grade = options.grade;
  if (options.size) state.size = options.size;
  state.title = caption;
  state.subtitle = photoId === 'pier' ? 'neon coast nights' : 'boulevard queen';
  state.panels.forEach((panel, i) => {
    panel.photo = i % 2 === 0 ? photoId : other;
    panel.dx = 0;
    panel.dy = 0;
    panel.zoom = 1;
  });
  syncControls();
  render();
}

// ---- controls -------------------------------------------------------------

function buildOptionButtons(rowId, items, currentId, onPick) {
  const row = $(rowId);
  if (!row) return;
  row.innerHTML = '';
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.dataset.id = item.id;
    button.textContent = item.label;
    if (item.id === currentId) button.classList.add('active');
    button.addEventListener('click', () => {
      onPick(item.id);
      for (const child of row.children) child.classList.toggle('active', child.dataset.id === item.id);
    });
    row.appendChild(button);
  }
}

function syncControls() {
  if ($('titleInput')) $('titleInput').value = state.title;
  if ($('subtitleInput')) $('subtitleInput').value = state.subtitle;
  if ($('badgeInput')) $('badgeInput').value = state.badge;
  if ($('heatRange')) $('heatRange').value = String(state.heat);
  if ($('heatValue')) $('heatValue').textContent = `${state.heat}/5`;
  const toggles = {
    toggleBadge: state.showBadge, toggleStars: state.showStars,
    toggleGrain: state.grain, toggleVignette: state.vignette,
    toggleHalftone: state.halftone, toggleFrames: state.frames,
  };
  for (const [id, value] of Object.entries(toggles)) {
    const el = $(id);
    if (el) el.checked = value;
  }
  buildOptionButtons('layoutRow', LAYOUTS, state.layout, (id) => {
    state.layout = id;
    state.panels = panelsForLayout(state, id);
    state.selected = 0;
    commit();
  });
  buildOptionButtons('gradeRow', GRADES, state.grade, (id) => { state.grade = id; commit(); });
  buildOptionButtons('sizeRow', SIZES, state.size, (id) => { state.size = id; commit(); });
}

function wireControls() {
  $('uploadInput')?.addEventListener('change', async (event) => {
    for (const file of event.target.files) await addUpload(file);
    event.target.value = '';
  });
  $('fillAll')?.addEventListener('click', () => {
    const panel = state.panels[state.selected];
    if (!panel) return;
    for (const p of state.panels) p.photo = panel.photo;
    commit();
    say(`Every panel now shows ${panel.photo}.`);
  });
  $('resetPanel')?.addEventListener('click', () => {
    const panel = state.panels[state.selected];
    if (!panel) return;
    panel.dx = 0; panel.dy = 0; panel.zoom = 1;
    commit();
    say(`Panel ${state.selected + 1} reset.`);
  });
  $('zoomRange')?.addEventListener('input', (event) => {
    const panel = state.panels[state.selected];
    if (!panel) return;
    panel.zoom = Number(event.target.value);
    queueRender();
  });
  $('zoomRange')?.addEventListener('change', () => commit());
  $('titleInput')?.addEventListener('input', (event) => { state.title = event.target.value; queueRender(); });
  $('titleInput')?.addEventListener('change', () => commit());
  $('subtitleInput')?.addEventListener('input', (event) => { state.subtitle = event.target.value; queueRender(); });
  $('subtitleInput')?.addEventListener('change', () => commit());
  $('badgeInput')?.addEventListener('input', (event) => { state.badge = event.target.value; queueRender(); });
  $('badgeInput')?.addEventListener('change', () => commit());
  $('heatRange')?.addEventListener('input', (event) => {
    state.heat = Number(event.target.value);
    if ($('heatValue')) $('heatValue').textContent = `${state.heat}/5`;
    queueRender();
  });
  $('heatRange')?.addEventListener('change', () => commit());
  const toggleMap = {
    toggleBadge: 'showBadge', toggleStars: 'showStars', toggleGrain: 'grain',
    toggleVignette: 'vignette', toggleHalftone: 'halftone', toggleFrames: 'frames',
  };
  for (const [id, key] of Object.entries(toggleMap)) {
    $(id)?.addEventListener('change', (event) => { state[key] = event.target.checked; commit(); });
  }
  $('undoBtn')?.addEventListener('click', () => { if (history.undo(state)) { syncControls(); render(); } });
  $('redoBtn')?.addEventListener('click', () => { if (history.redo(state)) { syncControls(); render(); } });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      // Inside a text field the browser's own text undo must win.
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      event.preventDefault();
      if (event.shiftKey) { if (history.redo(state)) { syncControls(); render(); } }
      else if (history.undo(state)) { syncControls(); render(); }
    }
  });
  for (const size of SIZES) {
    $(`export-${size.id}`)?.addEventListener('click', () => exportPng(size));
  }
}

// ---- canvas interaction: click to select, drag to pan, wheel to zoom -----

function panelAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const rects = panelRects(state.layout);
  for (let i = rects.length - 1; i >= 0; i -= 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

canvas.addEventListener('pointerdown', (event) => {
  const hit = panelAt(event.clientX, event.clientY);
  if (hit < 0) return;
  state.selected = hit;
  const rect = canvas.getBoundingClientRect();
  const panelRect = panelRects(state.layout)[hit];
  drag = {
    startX: event.clientX, startY: event.clientY,
    dx: state.panels[hit].dx, dy: state.panels[hit].dy,
    widthPx: panelRect.w * rect.width, heightPx: panelRect.h * rect.height,
  };
  canvas.setPointerCapture(event.pointerId);
  refreshPanelLabel();
  queueRender();
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const panel = state.panels[state.selected];
  panel.dx = drag.dx + (event.clientX - drag.startX) / drag.widthPx;
  panel.dy = drag.dy + (event.clientY - drag.startY) / drag.heightPx;
  panel.dx = Math.max(-0.6, Math.min(0.6, panel.dx));
  panel.dy = Math.max(-0.6, Math.min(0.6, panel.dy));
  queueRender();
});

canvas.addEventListener('pointerup', () => {
  if (!drag) return;
  drag = null;
  commit();
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.zoom = Math.max(1, Math.min(4, panel.zoom * (event.deltaY < 0 ? 1.08 : 0.93)));
  queueRender();
}, { passive: false });

// ---- export ---------------------------------------------------------------

export function exportPng(size) {
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  renderCover(off.getContext('2d'), size.w, size.h, state, photos);
  off.toBlob((blob) => {
    if (!blob) { say('Export failed — try again.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neon-coast-cover-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    say(`Exported ${size.w} × ${size.h} PNG.`);
  }, 'image/png');
}

// ---- boot -----------------------------------------------------------------

async function boot() {
  wireControls();
  syncControls();
  await ensureSample('pier');
  await ensureSample('boulevard');
  rebuildTray();
  const query = new URLSearchParams(window.location.search);
  const shot = query.get('shot');
  if (shot === 'cover' || shot === 'editor') {
    await runShot(shot, query, loadShotPhoto);
    history.reset(state);
  } else {
    await document.fonts.ready;
  }
  render();
  say('Ready — pick a photo, a layout and a grade, then export.');
}

boot().catch((error) => {
  console.error(error);
  say(`Could not start: ${error.message}`);
});
