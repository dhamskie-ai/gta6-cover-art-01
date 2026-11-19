// Neon Coast Cover Studio — colour grades as gradient maps.
// Each grade is a list of [position 0..1, [r, g, b]] stops. A pixel's
// luminance is remapped through the stops, so shadows take the deep tone
// and highlights take the hot tone: the sunset / neon poster look.
// The LUT is built once per grade (256 entries) and reused every frame.

// Stops are [shadow, low-mid, high-mid, highlight].
const GRADE_STOPS = {
  sunset: [
    [0.0, [16, 4, 40]],
    [0.35, [94, 22, 88]],
    [0.7, [232, 84, 60]],
    [1.0, [255, 214, 130]],
  ],
  neon: [
    [0.0, [4, 10, 38]],
    [0.35, [20, 60, 130]],
    [0.7, [34, 200, 220]],
    [1.0, [255, 190, 240]],
  ],
  vice: [
    [0.0, [24, 4, 44]],
    [0.35, [120, 20, 110]],
    [0.7, [255, 80, 160]],
    [1.0, [255, 220, 160]],
  ],
  teal: [
    [0.0, [2, 14, 26]],
    [0.35, [10, 70, 90]],
    [0.7, [30, 190, 170]],
    [1.0, [220, 255, 230]],
  ],
  gold: [
    [0.0, [26, 10, 4]],
    [0.35, [110, 52, 14]],
    [0.7, [235, 150, 40]],
    [1.0, [255, 240, 180]],
  ],
};

const lutCache = new Map();

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function gradeLut(gradeId) {
  if (lutCache.has(gradeId)) return lutCache.get(gradeId);
  const stops = GRADE_STOPS[gradeId] ?? GRADE_STOPS.sunset;
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s += 1) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
    }
    const span = (b[0] - a[0]) || 1;
    const local = Math.min(1, Math.max(0, (t - a[0]) / span));
    const rgb = mix(a[1], b[1], local);
    lut[i * 3] = rgb[0];
    lut[i * 3 + 1] = rgb[1];
    lut[i * 3 + 2] = rgb[2];
  }
  lutCache.set(gradeId, lut);
  return lut;
}

// Apply the grade to a canvas in place. Transparent pixels keep alpha 0;
// only their (invisible) rgb channels are remapped, which is harmless.
export function applyGrade(canvas, gradeId) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const lut = gradeLut(gradeId);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    // Luminance, then a gentle S-curve so the grade bites in the mids.
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const shaped = Math.round(255 * (lum / 255) * (lum / 255) * (3 - 2 * (lum / 255)));
    const base = Math.max(0, Math.min(255, shaped)) * 3;
    // Keep a whisper of the original hue so faces do not go flat duotone.
    data[i] = Math.round(lut[base] * 0.82 + data[i] * 0.18);
    data[i + 1] = Math.round(lut[base + 1] * 0.82 + data[i + 1] * 0.18);
    data[i + 2] = Math.round(lut[base + 2] * 0.82 + data[i + 2] * 0.18);
  }
  ctx.putImageData(image, 0, 0);
}

// One shared film-grain tile, generated once per page load.
let grainTile = null;
export function grainPattern(ctx) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 140;
    grainTile.height = 140;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(140, 140);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  return ctx.createPattern(grainTile, 'repeat');
}
