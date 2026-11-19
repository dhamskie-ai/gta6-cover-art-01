// Neon Coast Cover Studio — shared state: layouts, grades, sizes, history.
// Everything serialisable lives in the plain state object; the photo pixels
// live outside it (see main.js photoStore) and panels only name a photo id.

export const LAYOUTS = [
  { id: 'grid4', label: '4-Panel Grid', panels: 4 },
  { id: 'hero3', label: 'Hero + Three', panels: 4 },
  { id: 'fullbleed', label: 'Full Bleed', panels: 1 },
  { id: 'tilted', label: 'Tilted Snapshots', panels: 3 },
  { id: 'grid9', label: 'Nine-Panel Grid', panels: 9 },
  { id: 'titleblock', label: 'Title Block', panels: 3 },
];

export const GRADES = [
  { id: 'sunset', label: 'Sunset', accent: '#ff7a3d', glow: '#ff4d8d' },
  { id: 'neon', label: 'Neon Coast', accent: '#22e6ff', glow: '#ff3df0' },
  { id: 'vice', label: 'Vice Pink', accent: '#ff5da2', glow: '#ffb03d' },
  { id: 'teal', label: 'Teal Night', accent: '#2affc4', glow: '#2a7bff' },
  { id: 'gold', label: 'Gold Hour', accent: '#ffc53d', glow: '#ff7a3d' },
];

export const SIZES = [
  { id: 'square', label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Story 1080 × 1350', w: 1080, h: 1350 },
  { id: 'landscape', label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
];

export function defaultPanel(photoId) {
  return { photo: photoId, dx: 0, dy: 0, zoom: 1 };
}

export function defaultState() {
  return {
    layout: 'grid4',
    grade: 'sunset',
    size: 'square',
    title: 'Sunset Heist',
    subtitle: 'neon coast nights',
    badge: 'NEON COAST',
    heat: 4,
    showBadge: true,
    showStars: true,
    grain: true,
    vignette: true,
    halftone: false,
    frames: true,
    selected: 0,
    panels: [defaultPanel('pier'), defaultPanel('boulevard'), defaultPanel('pier'), defaultPanel('boulevard')],
  };
}

// Keep the panel list in step with the active layout, reusing transforms
// wherever a panel survives the switch.
export function panelsForLayout(state, layoutId) {
  const layout = LAYOUTS.find((l) => l.id === layoutId) ?? LAYOUTS[0];
  const old = state.panels;
  const next = [];
  for (let i = 0; i < layout.panels; i += 1) {
    const keep = old[i] ?? old[i % Math.max(old.length, 1)] ?? defaultPanel('pier');
    next.push({ photo: keep.photo, dx: keep.dx, dy: keep.dy, zoom: keep.zoom });
  }
  return next;
}

export function serializeState(state) {
  const { selected, ...rest } = state;
  return JSON.stringify(rest);
}

export function applySnapshot(state, json) {
  const data = JSON.parse(json);
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, data, { selected: 0 });
}

// Undo/redo over serialised snapshots. Push once per completed gesture
// (a button click, a finished drag), never per pointermove.
export class History {
  constructor(state) {
    this.past = [];
    this.future = [];
    this.current = serializeState(state);
  }
  push(state) {
    const snap = serializeState(state);
    if (snap === this.current) return;
    this.past.push(this.current);
    if (this.past.length > 60) this.past.shift();
    this.current = snap;
    this.future = [];
  }
  undo(state) {
    if (!this.past.length) return false;
    this.future.push(this.current);
    this.current = this.past.pop();
    applySnapshot(state, this.current);
    return true;
  }
  redo(state) {
    if (!this.future.length) return false;
    this.past.push(this.current);
    this.current = this.future.pop();
    applySnapshot(state, this.current);
    return true;
  }
  // Forget every snapshot and treat the given state as the new baseline
  // (used after a ?shot= scene loads, so undo cannot rewind to the
  // pre-scene defaults).
  reset(state) {
    this.past = [];
    this.future = [];
    this.current = serializeState(state);
  }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}
