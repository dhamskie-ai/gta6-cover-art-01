// Cover renderer for Neon Coast Cover Studio.
// Draws the whole poster — panels, grade, inked frames, lettering, badge,
// heat meter, grain and vignette — onto any 2D canvas at any size, from a
// plain state object and a map of loaded images. Everything is drawn with
// the canvas API; no Rockstar art, no external assets.

import { GRADES, buildGradeLUT, applyGradeMap } from './grades.js';

/** How many photo panels each layout holds. */
export const LAYOUT_PANELS = {
  grid4: 4,
  hero3: 4,
  fullbleed: 1,
  tilted: 3,
  grid9: 9,
  titleblock: 2,
};

/** Panel rectangles as fractions of the cover, plus the title zone. */
function layoutGeometry(layout, w, h) {
  const m = 0.028; // outer margin, as a fraction of width
  const g = 0.018; // gutter
  const bandTop = 0.76; // where the bottom title band starts (banded layouts)
  const panelArea = { x: m, y: m, w: 1 - 2 * m, h: bandTop - m };
  const cell = (area, cols, rows, i) => {
    const cw = (area.w - g * (cols - 1)) / cols;
    const ch = (area.h - g * (rows - 1)) / rows;
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      x: area.x + col * (cw + g),
      y: area.y + row * (ch + g),
      w: cw,
      h: ch,
      rot: 0,
    };
  };
  switch (layout) {
    case 'hero3': {
      const hero = { ...panelArea, w: panelArea.w * 0.6 };
      const side = { x: panelArea.x + panelArea.w * 0.6 + g, y: panelArea.y, w: panelArea.w * 0.4 - g, h: panelArea.h };
      return {
        panels: [hero, cell(side, 1, 3, 0), cell(side, 1, 3, 1), cell(side, 1, 3, 2)],
        title: { x: 0, y: bandTop, w: 1, h: 1 - bandTop, kind: 'band' },
      };
    }
    case 'fullbleed':
      return {
        panels: [{ x: 0, y: 0, w: 1, h: 1, rot: 0 }],
        title: { x: 0, y: 0.68, w: 1, h: 0.32, kind: 'scrim' },
      };
    case 'tilted': {
      const big = { x: 0.16, y: 0.06, w: 0.68, h: 0.62, rot: -0.05 };
      const left = { x: 0.03, y: 0.52, w: 0.36, h: 0.3, rot: 0.07 };
      const right = { x: 0.61, y: 0.55, w: 0.36, h: 0.3, rot: -0.06 };
      return {
        panels: [big, left, right],
        title: { x: 0, y: 0.84, w: 1, h: 0.16, kind: 'scrim' },
      };
    }
    case 'grid9':
      return {
        panels: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => cell(panelArea, 3, 3, i)),
        title: { x: 0, y: bandTop, w: 1, h: 1 - bandTop, kind: 'band' },
      };
    case 'titleblock': {
      const area = { x: m, y: m, w: 1 - 2 * m, h: 0.56 - m };
      return {
        panels: [cell(area, 2, 1, 0), cell(area, 2, 1, 1)],
        title: { x: 0, y: 0.56, w: 1, h: 0.44, kind: 'block' },
      };
    }
    case 'grid4':
    default:
      return {
        panels: [0, 1, 2, 3].map((i) => cell(panelArea, 2, 2, i)),
        title: { x: 0, y: bandTop, w: 1, h: 1 - bandTop, kind: 'band' },
      };
  }
}

let noiseCanvas = null;
/** A small tiled noise canvas for the film grain, built once. */
function grainTile() {
  if (noiseCanvas) return noiseCanvas;
  noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 160;
  noiseCanvas.height = 160;
  const nctx = noiseCanvas.getContext('2d');
  const data = nctx.createImageData(160, 160);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  nctx.putImageData(data, 0, 0);
  return noiseCanvas;
}

/** Fits a font size so `text` fits `maxWidth`, starting from `start`. */
function fitFont(ctx, text, maxWidth, start, family, weight = 400) {
  let size = start;
  const set = () => { ctx.font = `${weight} ${size}px ${family}`; };
  set();
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= Math.max(1, Math.round(size * 0.04));
    set();
  }
  return size;
}

/** Draws a five-point star path centred at (cx, cy). */
function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Draws one photo into a panel rect, cover-fit with the panel's pan/zoom,
 * then remaps it through the grade. `rect` is in fractions of the cover.
 */
function drawPhotoPanel(ctx, img, rect, panel, w, h, lut, grade) {
  const px = rect.x * w;
  const py = rect.y * h;
  const pw = rect.w * w;
  const ph = rect.h * h;
  const cx = px + pw / 2;
  const cy = py + ph / 2;

  // Grade at a capped resolution, then scale up — fast and still crisp.
  const cap = 640;
  const scale = Math.min(1, cap / Math.max(pw, ph));
  const ow = Math.max(2, Math.round(pw * scale));
  const oh = Math.max(2, Math.round(ph * scale));
  const off = document.createElement('canvas');
  off.width = ow;
  off.height = oh;
  const octx = off.getContext('2d');
  octx.fillStyle = '#241533';
  octx.fillRect(0, 0, ow, oh);
  if (img) {
    const base = Math.max(ow / img.naturalWidth, oh / img.naturalHeight) * (panel.zoom || 1);
    const dw = img.naturalWidth * base;
    const dh = img.naturalHeight * base;
    const dx = (ow - dw) / 2 + (panel.ox || 0) * ow;
    const dy = (oh - dh) / 2 + (panel.oy || 0) * oh;
    octx.drawImage(img, dx, dy, dw, dh);
    const data = octx.getImageData(0, 0, ow, oh);
    applyGradeMap(data, lut, 0.8);
    octx.putImageData(data, 0, 0);
    octx.fillStyle = grade.wash;
    octx.fillRect(0, 0, ow, oh);
  }

  ctx.save();
  ctx.translate(cx, cy);
  if (rect.rot) ctx.rotate(rect.rot);
  ctx.translate(-cx, -cy);
  ctx.drawImage(off, px, py, pw, ph);
  // Inked frame + accent band along the foot of the panel.
  const frame = Math.max(3, w * 0.007);
  ctx.lineWidth = frame;
  ctx.strokeStyle = '#14081f';
  ctx.strokeRect(px + frame / 2, py + frame / 2, pw - frame, ph - frame);
  const bandH = Math.max(4, ph * 0.045);
  ctx.fillStyle = grade.accent;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(px + frame, py + ph - frame - bandH, pw - 2 * frame, bandH);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Draws the main title + neon script subtitle inside the title zone. */
function drawTitleZone(ctx, state, zone, w, h, grade) {
  const zx = zone.x * w;
  const zy = zone.y * h;
  const zw = zone.w * w;
  const zh = zone.h * h;
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();

  if (zone.kind === 'band' || zone.kind === 'block') {
    const band = ctx.createLinearGradient(0, zy, 0, zy + zh);
    band.addColorStop(0, grade.band[0]);
    band.addColorStop(1, grade.band[1]);
    ctx.fillStyle = band;
    ctx.fillRect(zx, zy, zw, zh);
    ctx.fillStyle = grade.accent;
    ctx.fillRect(zx, zy, zw, Math.max(3, h * 0.006));
    if (state.halftone) {
      const step = Math.max(10, w * 0.014);
      ctx.fillStyle = grade.accent;
      ctx.globalAlpha = 0.16;
      for (let y = zy + step / 2; y < zy + zh; y += step) {
        for (let x = zx + step / 2; x < zx + zw; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, step * 0.14, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
  } else {
    // Scrim: a dark wash rising from the foot so lettering reads over photos.
    const scrim = ctx.createLinearGradient(0, zy, 0, zy + zh);
    scrim.addColorStop(0, 'rgba(10, 4, 18, 0)');
    scrim.addColorStop(0.45, 'rgba(10, 4, 18, 0.55)');
    scrim.addColorStop(1, 'rgba(10, 4, 18, 0.85)');
    ctx.fillStyle = scrim;
    ctx.fillRect(zx, zy, zw, zh);
  }

  const pad = zw * 0.04;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (title) {
    const size = fitFont(ctx, title, zw - pad * 2, zh * (zone.kind === 'block' ? 0.42 : 0.52), 'Anton, sans-serif');
    try { ctx.letterSpacing = `${Math.round(size * 0.03)}px`; } catch { /* older canvas: no letter spacing */ }
    const ty = zy + zh * (subtitle ? (zone.kind === 'block' ? 0.38 : 0.4) : 0.52);
    const grad = ctx.createLinearGradient(0, ty - size * 0.6, 0, ty + size * 0.6);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, grade.title);
    grad.addColorStop(1, grade.accent);
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeStyle = '#14081f';
    ctx.lineJoin = 'round';
    ctx.strokeText(title, zx + zw / 2, ty);
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.04;
    ctx.fillText(title, zx + zw / 2, ty);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    try { ctx.letterSpacing = '0px'; } catch { /* reset */ }
  }
  if (subtitle) {
    const size = fitFont(ctx, subtitle, zw - pad * 2, zh * (zone.kind === 'block' ? 0.2 : 0.26), 'Pacifico, cursive');
    const sy = zy + zh * (zone.kind === 'block' ? 0.76 : 0.8);
    ctx.fillStyle = grade.accent;
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = size * 0.55;
    ctx.fillText(subtitle, zx + zw / 2, sy);
    ctx.shadowBlur = 0;
  }
}

/** Diagonal badge ribbon across the top-left corner. */
function drawBadge(ctx, text, w, h, grade) {
  if (!text || !text.trim()) return;
  const label = text.trim().toUpperCase();
  ctx.save();
  ctx.translate(w * 0.055, h * 0.055);
  ctx.rotate(-Math.PI / 4);
  const bw = w * 0.42;
  const bh = Math.max(18, h * 0.038);
  ctx.fillStyle = grade.accent;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 10;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#14081f';
  ctx.font = `400 ${Math.round(bh * 0.52)}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

/** Five-star heat meter in the bottom-right corner. */
function drawHeat(ctx, heat, w, h) {
  const r = Math.max(7, w * 0.011);
  const gap = r * 2.5;
  const total = gap * 4;
  const cy = h - r * 1.9;
  let cx = w - r * 1.9 - total;
  for (let i = 0; i < 5; i++) {
    starPath(ctx, cx + gap * i + r, cy, r);
    if (i < heat) {
      ctx.fillStyle = '#ffd76a';
      ctx.shadowColor = 'rgba(255, 215, 106, 0.9)';
      ctx.shadowBlur = r * 0.9;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fill();
    }
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.strokeStyle = 'rgba(20, 8, 31, 0.8)';
    ctx.stroke();
  }
}

/**
 * Renders the full cover onto `ctx` at size w x h.
 * `state` holds layout, grade, title, subtitle, badge, heat and panels;
 * `images` maps photo ids to loaded HTMLImageElements.
 */
export function renderCover(ctx, w, h, state, images) {
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const lut = buildGradeLUT(state.grade);
  const geo = layoutGeometry(state.layout || 'grid4', w, h);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = grade.band[0];
  ctx.fillRect(0, 0, w, h);

  const panels = state.panels || [];
  geo.panels.forEach((rect, i) => {
    const panel = panels[i] || {};
    const img = panel.photoId ? images.get(panel.photoId) ?? null : null;
    drawPhotoPanel(ctx, img, rect, panel, w, h, lut, grade);
  });

  drawTitleZone(ctx, state, geo.title, w, h, grade);
  drawBadge(ctx, state.badge, w, h, grade);
  if (state.heat > 0) drawHeat(ctx, state.heat, w, h);

  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (state.vignette) {
    const vg = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.42,
      w / 2, h / 2, Math.max(w, h) * 0.75,
    );
    vg.addColorStop(0, 'rgba(8, 2, 16, 0)');
    vg.addColorStop(1, 'rgba(8, 2, 16, 0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}

/** Panel rectangles in fractions, for hit-testing clicks on the preview. */
export function panelRects(layout, w, h) {
  return layoutGeometry(layout, w, h).panels;
}
