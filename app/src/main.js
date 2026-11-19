// Wires Neon Coast Cover Studio: photo uploads, tray, layout/grade/caption
// controls, panel drag-and-zoom on the preview, undo/redo, and PNG export.
// A `?shot=` query sets up a fixed scene for screenshots (./shots.js).

import { renderCover, panelRects } from './cover.js';
import {
  defaultState, snapshot, restore, createHistory, loadImage, fileToDataURL,
  addPhoto, resizePanels, fillAllPanels, parseSize,
} from './state.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const state = defaultState();
const history = createHistory();
const images = new Map(); // photo id -> loaded HTMLImageElement
let fontsReady = false;

document.fonts?.ready.then(() => { fontsReady = true; redraw(); });

/** Renders the preview at a capped resolution, keeping the export aspect. */
function redraw() {
  // In a cover scene the canvas already fills the viewport at its size:
  // never resize it back to the preview, or the cover is clipped and
  // stretched (the fonts-ready handler below also calls this).
  if (document.body.classList.contains('shot-cover')) {
    renderCover(ctx, canvas.width, canvas.height, state, images);
    syncControls();
    return;
  }
  const { w, h } = parseSize(state.size);
  const cap = 900;
  const scale = Math.min(1, cap / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  renderCover(ctx, canvas.width, canvas.height, state, images);
  syncControls();
}

/** Mirrors the state back into the control panel (active buttons, inputs). */
function syncControls() {
  document.querySelectorAll('#layouts .layout-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('#grades .grade-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('#sizes .size-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.size === state.size));
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('badge').value = state.badge;
  document.getElementById('grain').checked = state.grain;
  document.getElementById('vignette').checked = state.vignette;
  document.getElementById('halftone').checked = state.halftone;
  document.querySelectorAll('#heat button').forEach((b, i) =>
    b.classList.toggle('lit', i < state.heat));
  document.getElementById('undo').disabled = !history.canUndo();
  document.getElementById('redo').disabled = !history.canRedo();
  document.querySelectorAll('#tray img').forEach((img) =>
    img.classList.toggle('selected', img.dataset.id === state.selectedPhotoId));
}

/** Records the current state for undo, then re-renders. */
function commit() {
  history.push(snapshot(state));
  redraw();
}

/** Rebuilds the photo tray thumbnails. */
function renderTray() {
  const tray = document.getElementById('tray');
  tray.innerHTML = '';
  if (!state.photos.length) {
    const empty = document.createElement('span');
    empty.className = 'empty';
    empty.textContent = 'No photos yet — add yours or try a sample.';
    tray.append(empty);
    return;
  }
  for (const photo of state.photos) {
    const thumb = document.createElement('img');
    thumb.src = photo.src;
    thumb.alt = photo.name;
    thumb.title = photo.name;
    thumb.dataset.id = photo.id;
    if (photo.id === state.selectedPhotoId) thumb.classList.add('selected');
    thumb.addEventListener('click', () => {
      history.push(snapshot(state));
      state.selectedPhotoId = photo.id;
      const panel = state.panels[state.selectedPanel];
      if (panel) panel.photoId = photo.id;
      redraw();
    });
    tray.append(thumb);
  }
}

/** Loads a photo record into the image cache, then re-renders. */
async function registerPhoto(photo) {
  try {
    images.set(photo.id, await loadImage(photo.src));
  } catch (err) {
    status.textContent = `Could not load ${photo.name}.`;
    return false;
  }
  renderTray();
  redraw();
  return true;
}

// --- Photos: uploads and samples ------------------------------------------
document.getElementById('photo-files').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  history.push(snapshot(state));
  for (const file of files) {
    const src = await fileToDataURL(file);
    const photo = addPhoto(state, file.name, src);
    await registerPhoto(photo);
  }
  const first = state.panels.find((p) => !p.photoId);
  if (first) first.photoId = state.selectedPhotoId;
  status.textContent = `${files.length} photo${files.length > 1 ? 's' : ''} loaded — click a panel, drag to position it.`;
  redraw();
  e.target.value = '';
});

document.querySelectorAll('.sample-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const name = btn.dataset.sample;
    if (state.photos.some((p) => p.src === `samples/${name}.jpg`)) {
      status.textContent = 'That sample is already in the tray.';
      return;
    }
    history.push(snapshot(state));
    const photo = addPhoto(state, `${name}.jpg`, `samples/${name}.jpg`);
    if (await registerPhoto(photo)) {
      const first = state.panels.find((p) => !p.photoId);
      if (first) first.photoId = photo.id;
      status.textContent = `${name} sample loaded — drag it into place on the cover.`;
      redraw();
    }
  });
});

document.getElementById('fill-all').addEventListener('click', () => {
  if (!state.selectedPhotoId) {
    status.textContent = 'Pick a photo in the tray first.';
    return;
  }
  history.push(snapshot(state));
  fillAllPanels(state, state.selectedPhotoId);
  status.textContent = 'Every panel now uses the selected photo.';
  redraw();
});

// --- Layout, grade, caption, effects --------------------------------------
document.getElementById('layouts').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-layout]');
  if (!btn) return;
  history.push(snapshot(state));
  state.layout = btn.dataset.layout;
  resizePanels(state, state.layout);
  redraw();
});

document.getElementById('grades').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-grade]');
  if (!btn) return;
  history.push(snapshot(state));
  state.grade = btn.dataset.grade;
  redraw();
});

document.getElementById('sizes').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-size]');
  if (!btn) return;
  history.push(snapshot(state));
  state.size = btn.dataset.size;
  redraw();
});

const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const badgeInput = document.getElementById('badge');
titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
badgeInput.addEventListener('input', () => { state.badge = badgeInput.value; redraw(); });
titleInput.addEventListener('change', () => commit());
subtitleInput.addEventListener('change', () => commit());
badgeInput.addEventListener('change', () => commit());

const heatBox = document.getElementById('heat');
for (let i = 1; i <= 5; i++) {
  const star = document.createElement('button');
  star.type = 'button';
  star.textContent = '★';
  star.setAttribute('aria-label', `${i} star${i > 1 ? 's' : ''}`);
  star.addEventListener('click', () => {
    history.push(snapshot(state));
    state.heat = state.heat === i ? 0 : i;
    redraw();
  });
  heatBox.append(star);
}

for (const id of ['grain', 'vignette', 'halftone']) {
  document.getElementById(id).addEventListener('change', (e) => {
    history.push(snapshot(state));
    state[id] = e.target.checked;
    redraw();
  });
}

// --- Undo / redo ------------------------------------------------------------
document.getElementById('undo').addEventListener('click', () => {
  const snap = history.undo(snapshot(state));
  if (snap) { restore(state, snap); redraw(); }
});
document.getElementById('redo').addEventListener('click', () => {
  const snap = history.redo(snapshot(state));
  if (snap) { restore(state, snap); redraw(); }
});

// --- Panel interaction: click to select, drag to pan, wheel to zoom --------
function panelAt(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const x = (clientX - box.left) / box.width;
  const y = (clientY - box.top) / box.height;
  const rects = panelRects(state.layout, 1, 1);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  history.push(snapshot(state));
  state.selectedPanel = i;
  const panel = state.panels[i];
  drag = { x: e.clientX, y: e.clientY, ox: panel.ox, oy: panel.oy, moved: false };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const box = canvas.getBoundingClientRect();
  const panel = state.panels[state.selectedPanel];
  const dx = (e.clientX - drag.x) / box.width;
  const dy = (e.clientY - drag.y) / box.height;
  if (Math.abs(dx) + Math.abs(dy) > 0.002) drag.moved = true;
  panel.ox = Math.max(-0.6, Math.min(0.6, drag.ox + dx));
  panel.oy = Math.max(-0.6, Math.min(0.6, drag.oy + dy));
  redraw();
});
canvas.addEventListener('pointerup', () => {
  drag = null;
  canvas.classList.remove('dragging');
});
canvas.addEventListener('wheel', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  e.preventDefault();
  history.push(snapshot(state));
  state.selectedPanel = i;
  const panel = state.panels[i];
  panel.zoom = Math.max(1, Math.min(4, panel.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  redraw();
}, { passive: false });
canvas.addEventListener('dblclick', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  history.push(snapshot(state));
  state.panels[i].ox = 0;
  state.panels[i].oy = 0;
  state.panels[i].zoom = 1;
  status.textContent = 'Panel reset to its original framing.';
  redraw();
});

// --- Export -----------------------------------------------------------------
document.getElementById('export').addEventListener('click', async () => {
  const { w, h } = parseSize(state.size);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  try {
    await document.fonts.load('400 100px Anton');
    await document.fonts.load('400 60px Pacifico');
  } catch { /* fall back to system fonts */ }
  renderCover(off.getContext('2d'), w, h, state, images);
  off.toBlob((blob) => {
    if (!blob) {
      status.textContent = 'Export failed — try again.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-coast-cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status.textContent = `Saved neon-coast-cover-${w}x${h}.png`;
  }, 'image/png');
});

// --- Boot -------------------------------------------------------------------
renderTray();
redraw();

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    state, images, redraw, registerPhoto, addPhoto,
  }).catch((err) => { status.textContent = `Shot scene failed: ${err.message}`; });
}
