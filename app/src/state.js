// State for Neon Coast Cover Studio: the cover's settings, its photos and
// its panels, plus an undo/redo history of plain JSON snapshots. Photos are
// kept as { id, name, src } — sample photos point at files under samples/,
// uploads carry a data: URL so the state stays self-contained.

import { LAYOUT_PANELS } from './cover.js';

let photoSeq = 0;

/** A fresh default cover: 4-panel grid, sunset grade, no photos yet. */
export function defaultState() {
  return {
    layout: 'grid4',
    grade: 'sunset',
    title: 'NEON COAST',
    subtitle: 'Vice nights, your story',
    badge: 'EST. 2026',
    heat: 4,
    grain: true,
    vignette: true,
    halftone: false,
    size: '1080x1080',
    photos: [],
    selectedPhotoId: null,
    selectedPanel: 0,
    panels: defaultPanels('grid4'),
  };
}

/** Panels for a layout: every slot starts empty, centred, at zoom 1. */
export function defaultPanels(layout) {
  const count = LAYOUT_PANELS[layout] ?? 4;
  return Array.from({ length: count }, () => ({ photoId: null, ox: 0, oy: 0, zoom: 1 }));
}

/** Deep-copies the serialisable part of the state (for history snapshots). */
export function snapshot(state) {
  return JSON.parse(JSON.stringify({
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    badge: state.badge,
    heat: state.heat,
    grain: state.grain,
    vignette: state.vignette,
    halftone: state.halftone,
    size: state.size,
    photos: state.photos,
    selectedPhotoId: state.selectedPhotoId,
    selectedPanel: state.selectedPanel,
    panels: state.panels,
  }));
}

/** Restores a snapshot into the live state object, in place. */
export function restore(state, snap) {
  for (const key of Object.keys(snap)) state[key] = JSON.parse(JSON.stringify(snap[key]));
}

/** Small undo/redo stack over snapshots. */
export function createHistory(limit = 40) {
  let past = [];
  let future = [];
  return {
    push(snap) {
      past.push(snap);
      if (past.length > limit) past.shift();
      future = [];
    },
    undo(current) {
      if (!past.length) return null;
      future.push(current);
      return past.pop();
    },
    redo(current) {
      if (!future.length) return null;
      past.push(current);
      return future.pop();
    },
    canUndo() { return past.length > 0; },
    canRedo() { return future.length > 0; },
  };
}

/** Loads an image from a URL (file, sample or data: URL). */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

/** Reads a File into a data: URL (kept on this machine, never uploaded). */
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Registers a photo in the state and returns its record. */
export function addPhoto(state, name, src) {
  const photo = { id: `photo-${++photoSeq}-${Date.now().toString(36)}`, name, src };
  state.photos.push(photo);
  state.selectedPhotoId = photo.id;
  return photo;
}

/** Resizes the panels array when the layout changes, keeping assignments. */
export function resizePanels(state, layout) {
  const count = LAYOUT_PANELS[layout] ?? 4;
  const next = Array.from({ length: count }, (_, i) => state.panels[i] ?? { photoId: null, ox: 0, oy: 0, zoom: 1 });
  state.panels = next;
  state.selectedPanel = Math.min(state.selectedPanel, count - 1);
}

/** Puts one photo into every panel. */
export function fillAllPanels(state, photoId) {
  for (const panel of state.panels) panel.photoId = photoId;
}

/** Parses an export size like "1080x1350" into { w, h }. */
export function parseSize(size) {
  const [w, h] = size.split('x').map(Number);
  return { w: w || 1080, h: h || 1080 };
}
