# Neon Coast Cover Studio

![make.fun bounty](https://make.fun/badge/gta6-cover-art-01.svg)
![make.fun rank](https://make.fun/badge/gta6-cover-art-01/dhamskie-ai/gta6-cover-art-01/rank.svg)
![make.fun reward](https://make.fun/badge/gta6-cover-art-01/dhamskie-ai/gta6-cover-art-01/reward.svg)

A GTA-style cover art maker for the [make.fun "Make GTA 6 Cover Art" bounty](https://make.fun/bounty/gta6-cover-art-01). Turn your own photos into a multi-panel poster cover — sunset and neon grades, bold poster lettering, a badge ribbon and a heat meter — and export it as a PNG to share. Fully offline: the app is static files under `app/`, makes no network requests, and your photos never leave your machine.

## What it does

- **Your photos** — upload photos from your machine, or try the two built-in samples (Pier, Boulevard). Click a panel on the cover, then drag to move the photo and scroll to zoom it; double-click resets the framing. One photo can fill every panel, or each panel can hold a different one.
- **Six layouts** — 4-panel grid, hero-and-three, full bleed, tilted snapshots, nine-panel grid, and a title block.
- **Captions** — a main title in bold poster lettering (Anton), a neon script subtitle (Pacifico), a badge ribbon, and a five-star heat meter.
- **Grades** — five gradient-map colour grades: Sunset, Neon Coast, Vice Pink, Teal Night, Gold Hour, plus film grain, vignette, and a halftone title-block option. Panels are inked and banded like poster art.
- **Export** — one click downloads a PNG at 1080 × 1080, 1080 × 1350, or 1920 × 1080.
- **Undo / redo** — every change is reversible.

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no dependencies. Any static file server works — `app/index.html` is the entry point.

## Fonts and samples

- **Anton** and **Pacifico** under `app/fonts/`, both under the SIL Open Font License (their `OFL-*.txt` texts are included). No Rockstar logo, wordmark, artwork, character, or font is used anywhere in this app.
- The sample photos under `app/samples/` were made for make.fun with an image model and are free to use.

## Screenshots

`screenshots/` holds four shots taken by the app's maker with `node tools/shot.mjs`:

1. `1-cover.jpg` — an exported cover (4-panel grid, Sunset grade)
2. `2-editor.jpg` — the studio with a photo loaded (hero-and-three, Vice Pink)
3. `3-cover.jpg` — an exported cover (tilted snapshots, Neon Coast)
4. `4-cover.jpg` — an exported cover in portrait size (title block, Gold Hour)

## Entry

This repository is the entry for the make.fun bounty `gta6-cover-art-01` by `dhamskie-ai`. `main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` to `/output` and writes `/output/dossier.json`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

MIT licensed — see `LICENSE`.
