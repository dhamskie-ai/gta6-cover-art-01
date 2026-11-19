// Neon Coast Cover Studio — the cover renderer.
// renderCover(ctx, w, h, state, photos) paints one finished cover at any
// size: panels first (graded on an offscreen layer), then inked frames,
// halftone / grain / vignette, then the Anton title, Pacifico subtitle,
// badge ribbon and star heat meter. The preview and the PNG export call
// exactly this function, so what you see is what you download.

import { applyGrade, grainPattern } from './grades.js';
import { GRADES, LAYOUTS } from './state.js';

const INK = '#12061f';
const PAPER = '#fff7ea';

function gradeOf(state) {
  return GRADES.find((g) => g.id === state.grade) ?? GRADES[0];
}

// Panel rectangles in normalised (0..1) coordinates per layout.
export function panelRects(layoutId) {
  const g = 0.018;
  switch (layoutId) {
    case 'hero3':
      return [
        { x: 0, y: 0, w: 0.615, h: 1, rot: 0 },
        { x: 0.633, y: 0, w: 0.367, h: 0.322, rot: 0 },
        { x: 0.633, y: 0.339, w: 0.367, h: 0.322, rot: 0 },
        { x: 0.633, y: 0.678, w: 0.367, h: 0.322, rot: 0 },
      ];
    case 'fullbleed':
      return [{ x: 0, y: 0, w: 1, h: 1, rot: 0 }];
    case 'tilted':
      return [
        { x: 0.03, y: 0.26, w: 0.34, h: 0.52, rot: -0.07 },
        { x: 0.33, y: 0.20, w: 0.36, h: 0.58, rot: 0.03 },
        { x: 0.64, y: 0.28, w: 0.33, h: 0.5, rot: -0.02 },
      ];
    case 'grid9': {
      const rects = [];
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
          rects.push({ x: c * (1 / 3) + (c === 0 ? 0 : g / 2), y: r * (1 / 3) + (r === 0 ? 0 : g / 2), w: 1 / 3 - g, h: 1 / 3 - g, rot: 0 });
        }
      }
      return rects;
    }
    case 'titleblock':
      return [
        { x: 0, y: 0.315, w: 0.322, h: 0.685, rot: 0 },
        { x: 0.339, y: 0.315, w: 0.322, h: 0.685, rot: 0 },
        { x: 0.678, y: 0.315, w: 0.322, h: 0.685, rot: 0 },
      ];
    case 'grid4':
    default: {
      const rects = [];
      for (let r = 0; r < 2; r += 1) {
        for (let c = 0; c < 2; c += 1) {
          rects.push({ x: c * 0.5 + (c === 0 ? 0 : g / 2), y: r * 0.5 + (r === 0 ? 0 : g / 2), w: 0.5 - g, h: 0.5 - g, rot: 0 });
        }
      }
      return rects;
    }
  }
}

function drawPhotoInto(ctx, img, rect, panel, W, H) {
  const px = rect.x * W;
  const py = rect.y * H;
  const pw = rect.w * W;
  const ph = rect.h * H;
  ctx.save();
  ctx.translate(px + pw / 2, py + ph / 2);
  if (rect.rot) ctx.rotate(rect.rot);
  ctx.translate(-pw / 2, -ph / 2);
  ctx.beginPath();
  ctx.rect(0, 0, pw, ph);
  ctx.clip();
  const base = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * (panel.zoom || 1);
  const dw = img.naturalWidth * base;
  const dh = img.naturalHeight * base;
  ctx.drawImage(img, (pw - dw) / 2 + (panel.dx || 0) * pw, (ph - dh) / 2 + (panel.dy || 0) * ph, dw, dh);
  ctx.restore();
}

function fitFont(ctx, text, maxWidth, startPx, family, weight) {
  let px = startPx;
  while (px > 12) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return px;
    px = Math.floor(px * 0.92);
  }
  return px;
}

function drawStar(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function drawHalftone(ctx, x, y, w, h, step) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  for (let yy = y + step / 2; yy < y + h; yy += step) {
    for (let xx = x + step / 2; xx < x + w; xx += step) {
      const r = step * 0.16 * (0.6 + 0.4 * Math.sin(xx * 0.05 + yy * 0.03));
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function renderCover(ctx, W, H, state, photos) {
  const grade = gradeOf(state);
  const rects = panelRects(state.layout);
  const layout = LAYOUTS.find((l) => l.id === state.layout) ?? LAYOUTS[0];

  // Backdrop: deep plum with a diagonal sunset wash, so tilted / title
  // layouts have a poster ground behind the panels.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1b0533');
  bg.addColorStop(0.55, '#3d0a4d');
  bg.addColorStop(1, '#0a0a24');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const wash = ctx.createLinearGradient(0, H * 0.55, W, H);
  wash.addColorStop(0, 'rgba(255,110,60,0)');
  wash.addColorStop(1, 'rgba(255,110,60,0.35)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  // Photos on their own layer, so the grade touches only the photos.
  const layer = document.createElement('canvas');
  layer.width = W;
  layer.height = H;
  const lctx = layer.getContext('2d');
  state.panels.forEach((panel, i) => {
    const img = photos.get(panel.photo);
    if (!img || !rects[i]) return;
    drawPhotoInto(lctx, img, rects[i], panel, W, H);
  });
  applyGrade(layer, state.grade);
  ctx.drawImage(layer, 0, 0);

  // Inked poster frames around every panel.
  if (state.frames) {
    rects.forEach((rect) => {
      const px = rect.x * W;
      const py = rect.y * H;
      const pw = rect.w * W;
      const ph = rect.h * H;
      ctx.save();
      ctx.translate(px + pw / 2, py + ph / 2);
      if (rect.rot) ctx.rotate(rect.rot);
      ctx.translate(-pw / 2, -ph / 2);
      ctx.lineWidth = Math.max(3, W * 0.008);
      ctx.strokeStyle = PAPER;
      ctx.strokeRect(0, 0, pw, ph);
      ctx.lineWidth = Math.max(1.5, W * 0.003);
      ctx.strokeStyle = INK;
      ctx.strokeRect(-Math.max(3, W * 0.004), -Math.max(3, W * 0.004), pw + Math.max(6, W * 0.008), ph + Math.max(6, W * 0.008));
      ctx.restore();
    });
  }

  // Title block band + halftone dots for that layout.
  const isTitleBlock = state.layout === 'titleblock';
  const useHalftone = state.halftone || isTitleBlock;
  if (isTitleBlock) {
    const bandH = H * 0.30;
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, bandH);
    ctx.fillStyle = grade.accent;
    ctx.fillRect(0, bandH - Math.max(4, H * 0.008), W, Math.max(4, H * 0.008));
    drawHalftone(ctx, 0, 0, W, bandH, Math.max(12, W * 0.018));
  }
  if (state.halftone && !isTitleBlock) {
    drawHalftone(ctx, 0, 0, W, H * 0.16, Math.max(12, W * 0.02));
  }

  // Caption placement: title-block art carries its title in the band;
  // tilted art carries it at the top; the rest get a bottom scrim.
  const titleTop = isTitleBlock || state.layout === 'tilted';
  if (!titleTop) {
    const scrim = ctx.createLinearGradient(0, H * 0.55, 0, H);
    scrim.addColorStop(0, 'rgba(10,2,24,0)');
    scrim.addColorStop(1, 'rgba(10,2,24,0.82)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
  }

  const margin = W * 0.045;
  const titleSize = fitFont(ctx, state.title.toUpperCase(), W - margin * 2, Math.round(W * 0.115), 'Anton, "Arial Black", sans-serif', '400');
  const titleY = titleTop ? H * (isTitleBlock ? 0.135 : 0.10) : H * 0.815;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${titleSize}px Anton, "Arial Black", sans-serif`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, titleSize * 0.09);
  ctx.strokeStyle = INK;
  ctx.shadowColor = grade.glow;
  ctx.shadowBlur = titleSize * 0.18;
  ctx.shadowOffsetX = Math.max(3, titleSize * 0.045);
  ctx.shadowOffsetY = Math.max(3, titleSize * 0.045);
  ctx.strokeText(state.title.toUpperCase(), margin, titleY);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(state.title.toUpperCase(), margin, titleY);
  ctx.restore();

  // Neon script subtitle under the title.
  const subSize = Math.round(titleSize * 0.42);
  ctx.save();
  ctx.font = `${subSize}px Pacifico, cursive`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = grade.accent;
  ctx.shadowBlur = subSize * 0.7;
  ctx.fillStyle = grade.accent;
  const subY = titleY + subSize * 1.15;
  ctx.fillText(state.subtitle, margin, subY);
  ctx.restore();

  // Badge ribbon, top-right, tilted like a sticker.
  if (state.showBadge && state.badge.trim()) {
    const bw = Math.min(W * 0.34, margin + ctx.measureText(state.badge.toUpperCase()).width + W * 0.05);
    const bh = Math.max(22, H * 0.045);
    // Tilted art already carries its title at the top, so the ribbon
    // drops to the empty ground at the bottom-right instead of sitting
    // on the title.
    const badgeY = state.layout === 'tilted' ? H - bh * 1.1 : bh * 0.9;
    ctx.save();
    ctx.translate(W - bw / 2 - margin * 0.4, badgeY);
    ctx.rotate(0.06);
    ctx.fillStyle = grade.accent;
    ctx.beginPath();
    ctx.moveTo(-bw / 2, -bh / 2);
    ctx.lineTo(bw / 2, -bh / 2);
    ctx.lineTo(bw / 2 + bh * 0.35, 0);
    ctx.lineTo(bw / 2, bh / 2);
    ctx.lineTo(-bw / 2, bh / 2);
    ctx.lineTo(-bw / 2 - bh * 0.35, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `400 ${Math.round(bh * 0.52)}px Anton, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.badge.toUpperCase(), 0, 1);
    ctx.restore();
  }

  // Five-star heat meter under the subtitle (or in the title band).
  if (state.showStars) {
    const r = Math.max(9, W * 0.016);
    const gap = r * 2.5;
    const startX = margin;
    const starY = titleTop ? (isTitleBlock ? H * 0.245 : H * 0.185) : H * 0.935;
    for (let i = 0; i < 5; i += 1) {
      drawStar(ctx, startX + r + i * gap, starY, r, i < state.heat ? '#ffc53d' : 'rgba(255,255,255,0.28)');
    }
    ctx.save();
    ctx.font = `400 ${Math.round(r * 1.05)}px Anton, "Arial Black", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`HEAT ${state.heat}/5`, startX + 5 * gap + r * 0.6, starY);
    ctx.restore();
  }

  // Vignette, then grain on top of everything.
  if (state.vignette) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(8,2,20,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  return { layout, rects };
}
