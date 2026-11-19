// Fixed scenes for screenshots: ?shot=editor shows the studio with a sample
// photo loaded; ?shot=cover shows the exported cover alone, filling the
// viewport. Query params pick the sample photo, caption, layout, grade and
// export size. window.__shotReady is set once the cover is painted.

import { resizePanels, fillAllPanels } from './state.js';

/** Applies the scene's query params onto the shared state. */
function applyParams(query, state) {
  const layout = query.get('layout');
  if (layout) {
    state.layout = layout;
    resizePanels(state, layout);
  }
  const grade = query.get('grade');
  if (grade) state.grade = grade;
  const size = query.get('size');
  if (size) state.size = size;
  const caption = query.get('caption');
  if (caption !== null) state.title = caption;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) state.subtitle = subtitle;
  const badge = query.get('badge');
  if (badge !== null) state.badge = badge;
  const heat = query.get('heat');
  if (heat !== null) state.heat = Math.max(0, Math.min(5, Number(heat) || 0));
  if (query.get('halftone') === '1') state.halftone = true;
}

/** Waits for the bundled fonts, then paints twice before flagging ready. */
async function readyAfterPaint(draw) {
  try {
    await document.fonts.load('400 100px Anton');
    await document.fonts.load('400 60px Pacifico');
    await document.fonts.ready;
  } catch { /* fonts are local; keep going */ }
  draw();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  draw();
  window.__shotReady = true;
}

export async function runShot(shot, query, helpers) {
  const { state, images, redraw, registerPhoto, addPhoto } = helpers;
  applyParams(query, state);
  const name = query.get('photo') ?? 'pier';
  const photo = addPhoto(state, `${name}.jpg`, `samples/${name}.jpg`);
  await registerPhoto(photo);
  fillAllPanels(state, photo.id);
  state.selectedPhotoId = photo.id;

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const canvas = document.getElementById('preview');
    // The cover fills the viewport at the viewport's own backing size;
    // redraw() keeps that size while the body carries shot-cover.
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    await readyAfterPaint(() => redraw());
  } else {
    // Editor scene: the studio chrome stays visible around the preview.
    await readyAfterPaint(() => redraw());
  }
}
