# Sign Studio — Unified Calculator Suite

One Next.js (App Router) project that combines three signage calculators behind a
shared navigation and a single unified neon theme:

| Nav item       | Route          | What it is                                            |
| -------------- | -------------- | ----------------------------------------------------- |
| Inkjet Banner  | `/banner`      | Inkjet printing banner calculator (original, verbatim) |
| Neon Line      | `/neon-line`   | Neon tube-length calculator from `.ai` / `.pdf` artwork |
| 3D Box Up      | `/3d-box-up`   | 3D LED box-up estimator with a live Three.js preview   |

The home page (`/`) presents all three in the unified dark-blue neon style; the
top navigation lets you switch between them from anywhere.

## How it was combined

Each product keeps its **exact original behaviour**:

- **Inkjet Banner** is a self-contained static page, served from
  `public/apps/banner/` and embedded under the shared nav.
- **Neon Line** and **3D Box Up** were server-rendered apps (Node + Python).
  Their original HTML / CSS / client JS (including the Three.js 3D preview) are
  served verbatim by route handlers (`app/<product>/app/route.ts`), and the
  Python measurement algorithms were **ported to TypeScript**:
  - `lib/neon/analyze.ts` — port of `ai_measure.py` (pure vector math).
    Validated to match the original exactly (path counts, per-colour lengths,
    sizes).
  - `lib/boxup/analyze.ts` + `lib/boxup/raster.ts` — port of
    `ai_measure_boxup.py`. Letter/word detection rasterizes the PDF with
    **pdfium compiled to WebAssembly** (`@hyzyla/pdfium`), the same engine the
    original used via `pypdfium2`, so results match to within ~1px.
  - `lib/pdf/*` — shared PDF extraction (pdf-lib) and helpers.

  Preview images are generated inline as data URLs (SVG line/dimension previews,
  PNG letter crops). Pricing is the original client-side logic, unchanged.

No Python or external server is required at runtime — the app is pure Node/Next.js.

## Running

Node and pnpm are provided by the codex runtime (not on PATH). Convenience
scripts reference them directly:

- **Dev:** double-click `run-dev.cmd` (or `pnpm dev`) → http://localhost:3000
- **Production:** `run-prod.cmd` (runs `next build` then `next start`)

If `node_modules` is missing, install first with the bundled pnpm:

```
"C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" ^
  "C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs" install
```

## Project layout

```
app/
  page.tsx                 unified home page
  layout.tsx, globals.css  shared theme
  banner/, neon-line/, 3d-box-up/   product pages (nav + iframe host)
  neon-line/app/route.ts   neon GET (page) + POST (/analyze)
  3d-box-up/app/route.ts   box-up GET (page) + POST (/analyze)
components/                Nav, ProductFrame
lib/
  products.ts              nav/product registry
  pdf/                     shared PDF extraction, vector parser, pdfium, helpers
  neon/                    neon analyzer + adapted server module
  boxup/                   box-up analyzer + raster detection + adapted server module
public/
  apps/banner/             original Inkjet Banner static app + assets
  neon-line/assets/        neon colour / collect-date images
  3d-box-up/assets/        filament / LED / side-finishing images + company-logo.svg
  3d-box-up/vendor/        Three.js r160 modules
```
