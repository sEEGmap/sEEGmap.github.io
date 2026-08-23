# sEEGplan

Interactive 2D stereoelectroencephalography (sEEG) planning tool for epilepsy surgery
planning. Entirely browser-based: no backend, no authentication, no cloud dependency.

https://seegplan.github.io/sEEGplan/

**Planning aid only. Not intended to replace physician judgment.**

Build using Anthropic Claude Sonnet 5 (Medium) - beware of errors

## Stack

React + TypeScript + Vite · Zustand · Dexie (IndexedDB) · dnd-kit · PptxGenJS · jsPDF ·
html-to-image · PapaParse

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

## Architecture notes for future extension

The data model (`src/types.ts`) stores every point as `{x, y}` normalized 0–1 against
the full template image — the "master coordinate system" called for in the spec. That
makes it straightforward to later add MRI/CT overlays, alternate templates, trajectory
analysis, or collaborative/cloud sync as additional layers without changing how
electrodes are stored.
