# Neon Coast Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/dhamskie-ai/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/dhamskie-ai/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

A GTA 6-style cover art maker for the [make.fun "Make GTA 6 Cover Art" bounty](https://make.fun/bounty/gta6-cover-art-01): turn your own photos into a multi-panel poster with bold caption lettering, a Vice City sunset or neon colour grade, and export it as a PNG to share.

## What it does

- **Your photos, your panels** — upload photos from your machine (nothing is ever uploaded anywhere) or use the two bundled samples. Click a panel to select it, drag to pan the photo, scroll to zoom, or hit *Fill every panel* to spread one photo across the whole cover.
- **6 layouts** — 4-Panel Grid, Hero + Three, Full Bleed, Tilted Snapshots, Nine-Panel Grid, and Title Block.
- **Poster lettering** — a big Anton title with a neon-glow outline, a Pacifico script subtitle, a badge ribbon, and a 5-star heat meter.
- **5 colour grades** — Sunset, Neon Coast, Vice Pink, Teal Night, Gold Hour, each a true gradient-map LUT over the photos, plus film grain, vignette, halftone dots and inked poster frames.
- **One-click PNG export** — 1080 × 1080, 1080 × 1350 and 1920 × 1080.
- **Undo / redo** — every edit is a step you can walk back (Ctrl+Z / Ctrl+Shift+Z).
- **Fully offline** — static files under `app/`, no network requests. Fonts (Anton + Pacifico, SIL Open Font License) are bundled under `app/fonts/`.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Pick a photo, a layout and a grade, edit the caption, then export a PNG.

## Screenshots

The four screenshots in `screenshots/` are taken by `tools/shot.mjs` (Playwright, headless Chromium) from the app's own `?shot=` scenes: the cover alone, the editor with a photo loaded, and covers in other layouts and sizes.

## Originality

Everything here is original: no Rockstar Games logo, wordmark, artwork, character or font. The fonts are Anton and Pacifico from [google/fonts](https://github.com/google/fonts), shipped under the SIL Open Font License (see `app/fonts/OFL-Anton.txt` and `app/fonts/OFL-Pacifico.txt`). The two sample photos were made for make.fun with an image model and are free to use.

## License

MIT — see `LICENSE`.
