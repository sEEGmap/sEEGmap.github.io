# sEEGplan v1.0

Interactive 2D stereoelectroencephalography (sEEG) planning tool for epilepsy surgery
planning. Entirely browser-based: no backend, no authentication, no cloud dependency.

**Planning aid only. Not intended to replace physician judgment.**

## Stack

React + TypeScript + Vite · Zustand · Dexie (IndexedDB) · dnd-kit · PptxGenJS · jsPDF ·
html-to-image · PapaParse

## Run it locally

```bash
npm install
npm run dev
```

## Build for production

```bash
npm run build   # outputs to dist/
npm run preview # sanity-check the production build locally
```

## Deploy to GitHub Pages

This repo is set up for a **user/organization site** named `sEEGplan.github.io`
(project root deployment), using client-side `HashRouter` so no server-side rewrite
rules are needed.

1. Create a GitHub repository named exactly `sEEGplan.github.io` and push this project
   to its `main` branch.
2. In the repo, go to **Settings → Pages → Build and deployment → Source** and choose
   **GitHub Actions**. The included workflow at `.github/workflows/deploy.yml` builds
   and deploys automatically on every push to `main`.
3. Your site will be live at `https://sEEGplan.github.io/`.

If you instead deploy this as a **project page** under a different repo name (e.g.
`https://username.github.io/sEEGplan/`), edit the `base` value in `vite.config.ts`
to `'/sEEGplan/'` before building.

## Data & privacy

All plan data (electrodes, notes, ordering) autosaves to **IndexedDB in the current
browser only**. Nothing is uploaded anywhere. Clearing browser storage / using a
different browser or device means the saved session won't be there — use **Export →
Save .seegplan** regularly and/or **Export PDF/PNG/PPTX** for anything you need to keep.

## Configuration files (`public/`)

These drive the app without needing a rebuild for content changes (only a redeploy):

- `app-config.json` — Home screen contact/institution block.
- `brain-regions.json` — quadrant bounding boxes (measured from the shipped
  `brain-template.png`) used to auto-place lateral-medial electrodes from a parsed
  4-letter code (e.g. `LTMI`).
- `superior-inferior-regions.json` — named anchor coordinates (e.g. `LAI`, `RPF`) used
  to auto-place superior-inferior electrodes from an exact name match.
- `anatomy-library.csv` — the seed anatomical target/entry library used by the "By
  Target" add workflow and the Settings → Anatomical Library page. Fully editable
  in-app (Import/Export CSV or JSON), or edit this file directly before deploying to
  change the shipped default for all users.

## Important limitation — please read

`brain-regions.json`'s auto-placement grid and every coordinate in the seeded
`anatomy-library.csv` are **first-pass approximations**, generated from the general
shape of the supplied line-art template rather than from verified individual
neuroanatomy. They exist to save clicks, not to encode clinical ground truth. The app
deliberately makes every marker draggable and every name/note field editable so a
clinician can correct placement before it's used for anything. Please review and adjust
region/library coordinates for your own template and workflow, and always visually
verify final electrode placement against real imaging — this tool does not import,
register, or reason about MRI/CT data.

## Acceptance-criteria checklist

- [x] Intro/Home page with disclaimer and configurable contact section
- [x] Brain template background, displayed exactly, with four labeled quadrants
- [x] Lateral-medial electrodes (● entry / ✕ target, no trajectory line)
- [x] Superior-inferior electrodes (paired ● / ✕ per view with trajectory line), all
      four endpoints independently draggable
- [x] Auto-placement from electrode name (4-letter parse + region grid, or exact
      superior-inferior code lookup)
- [x] Auto-placement from anatomical search ("By Target")
- [x] Manual placement workflow with a nomenclature builder
- [x] Electrode names always directly editable, no rename popups
- [x] Editable, searchable anatomy library with CSV/JSON import & export
- [x] Hover highlighting between list rows and canvas markers (both directions)
- [x] Drag-and-drop reorderable electrode list (dnd-kit), order persists and drives
      export order
- [x] IndexedDB autosave on every create/move/delete/rename/notes/reorder/library change
- [x] Session restore / discard flow on Home
- [x] `.seegplan` import (Home) and export (Planner toolbar)
- [x] PNG export (high-resolution canvas capture)
- [x] PDF export (Overview / Electrode Table / Notes pages)
- [x] PowerPoint export (Both Hemispheres / Left / Right / Summary / Notes slides)
- [x] GitHub Pages deployment compatibility (HashRouter, relative `base`, included
      Actions workflow)
- [x] Configuration-driven region mapping (`brain-regions.json`) and superior-inferior
      placement (`superior-inferior-regions.json`)

## Architecture notes for future extension

The data model (`src/types.ts`) stores every point as `{x, y}` normalized 0–1 against
the full template image — the "master coordinate system" called for in the spec. That
makes it straightforward to later add MRI/CT overlays, alternate templates, trajectory
analysis, or collaborative/cloud sync as additional layers without changing how
electrodes are stored.
