// Colour grades for Neon Coast Cover Studio.
// Each grade is a gradient map: photo luminance is remapped through these
// stops (dark -> light), plus a tint wash and a title-band gradient, all in
// the grade's own palette. No Rockstar art, no borrowed palette — just
// sunset and neon hues picked for poster lettering.

/** Gradient stops as [position 0..1, css colour] for the luminance map. */
export const GRADES = {
  sunset: {
    label: 'Sunset',
    map: [[0, '#1c0b2e'], [0.28, '#5c1a5e'], [0.55, '#c22a6e'], [0.78, '#ff7a3d'], [1, '#ffe9a8']],
    wash: 'rgba(255, 110, 60, 0.14)',
    band: ['#160a26', '#3d1040'],
    title: '#fff3d6',
    accent: '#ffb347',
  },
  neon: {
    label: 'Neon Coast',
    map: [[0, '#020617'], [0.3, '#0b2a6b'], [0.55, '#0e7490'], [0.8, '#22e6ff'], [1, '#e0fbff']],
    wash: 'rgba(34, 230, 255, 0.12)',
    band: ['#03122b', '#0b2a4d'],
    title: '#e8fbff',
    accent: '#22e6ff',
  },
  vice: {
    label: 'Vice Pink',
    map: [[0, '#1e0533'], [0.3, '#6d1b8f'], [0.55, '#c026d3'], [0.8, '#ff7ad9'], [1, '#ffe3f6']],
    wash: 'rgba(255, 122, 217, 0.14)',
    band: ['#2a0a3d', '#571b6e'],
    title: '#ffe9f8',
    accent: '#ff7ad9',
  },
  teal: {
    label: 'Teal Night',
    map: [[0, '#02131a'], [0.3, '#063a3a'], [0.55, '#0d7a6e'], [0.8, '#19f2c8'], [1, '#d9fff4']],
    wash: 'rgba(25, 242, 200, 0.10)',
    band: ['#02161c', '#063a3a'],
    title: '#e2fff6',
    accent: '#19f2c8',
  },
  gold: {
    label: 'Gold Hour',
    map: [[0, '#1f0e02'], [0.3, '#6b2d05'], [0.55, '#c25e1e'], [0.8, '#ffb347'], [1, '#fff3c4']],
    wash: 'rgba(255, 183, 71, 0.14)',
    band: ['#241203', '#4d2405'],
    title: '#fff6d8',
    accent: '#ffd76a',
  },
};

/** Builds a 256-entry RGB lookup table for a grade's gradient map. */
export function buildGradeLUT(grade) {
  const stops = GRADES[grade]?.map ?? GRADES.sunset.map;
  const parsed = stops.map(([at, colour]) => {
    const n = parseInt(colour.slice(1), 16);
    return [at, [(n >> 16) & 255, (n >> 8) & 255, n & 255]];
  });
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = parsed[0];
    let b = parsed[parsed.length - 1];
    for (let s = 0; s < parsed.length - 1; s++) {
      if (t >= parsed[s][0] && t <= parsed[s + 1][0]) { a = parsed[s]; b = parsed[s + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(a[1][c] + (b[1][c] - a[1][c]) * f);
  }
  return lut;
}

/**
 * Remaps an ImageData's luminance through the grade lookup table, in place.
 * Keeps a little of the original colour so photos stay recognisable.
 */
export function applyGradeMap(imageData, lut, strength = 0.82) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    const g = lum * 3;
    d[i] = Math.round(d[i] * (1 - strength) + lut[g] * strength);
    d[i + 1] = Math.round(d[i + 1] * (1 - strength) + lut[g + 1] * strength);
    d[i + 2] = Math.round(d[i + 2] * (1 - strength) + lut[g + 2] * strength);
  }
}
