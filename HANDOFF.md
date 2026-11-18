# ReceiptKing v1.2: Cole Engineering Handoff

## Handoff purpose

ReceiptKing is a browser-local receipt importer for municipal purchasing workflows. It converts receipt PDFs and images into reviewed purchase rows, then exports PDF, Excel, CSV, or print-ready records.

This handoff gives Cole a bounded performance and UI/UX improvement brief. Preserve the intentionally simple workflow and avoid expanding ReceiptKing into a card-management or accounting platform.

## Current release

| Item | Current value |
| --- | --- |
| Live site | https://sukonik.github.io/receiptking/ |
| Repository | https://github.com/Sukonik/receiptking |
| Baseline release | v1.2 |
| Baseline commit | `989a8eb6b714c60e7f55cf7ef0b3b7915d1ea071` |
| Deployment | GitHub Pages through `.github/workflows/pages.yml` |
| License | MPL-2.0 |

The header has been simplified to the ReceiptKing name and selected Jungle icon. The internal design-system name, Emperor UI, now appears quietly in the footer and inside the Appearance menu instead of competing with the product name.

## Product workflow to preserve

1. Confirm Department, Month, and Today's Date.
2. Import a PDF or image receipt, or enter a purchase manually.
3. Review the OCR-suggested amount and purchase reason.
4. Enter the approved Budget Code.
5. Add the signature or printed name and date.
6. Export PDF, Excel, CSV, or print.

OCR is assistive only. It must never silently approve or submit financial values.

## Current technical shape

- Static React 18 application hosted from the repository root.
- Ant Design components with custom Emperor UI CSS.
- `app.jsx` is the editable source.
- `app.js` is the committed, minified production build.
- Tesseract.js performs browser OCR.
- PDF.js renders the first PDF page for OCR.
- SheetJS generates Excel and CSV-compatible data.
- jsPDF and AutoTable generate the PDF report.
- Form data and appearance preferences are stored separately in browser local storage.
- Eight color themes support Light, Dark, and Auto modes.
- Six Jungle icons are selectable independently of the color theme.

Important: never edit `app.js` by hand. After changing `app.jsx`, run `npm run build` and commit both files.

## Priority 0: performance pass

### 1. Lazy-load task-specific libraries

The current page loads several large libraries before the user needs them. Cole should load each dependency only when its feature is first used:

| Library | Load trigger |
| --- | --- |
| Tesseract.js | First receipt OCR request |
| PDF.js | First uploaded PDF |
| SheetJS | First Excel export |
| jsPDF and AutoTable | First PDF export |

Remove the standalone PDF.js module tag from `index.html` if the dynamic import in `app.jsx` remains. Loading both paths is unnecessary.

Acceptance criteria:

- Initial page load does not request Tesseract, PDF.js, SheetJS, jsPDF, or AutoTable.
- The first feature request shows a clear short loading state.
- Later uses reuse the loaded module without another download.
- OCR and all export formats still work after a hard refresh.

### 2. Measure the real startup path

Run Lighthouse or an equivalent browser trace at 390 px mobile width using a throttled mobile profile.

Targets:

- Performance score of 90 or higher on the static landing state.
- Largest Contentful Paint below 2.5 seconds on a reasonable simulated mobile connection.
- Cumulative Layout Shift below 0.1.
- No application console errors.
- No render-blocking asset that is unrelated to the initial screen.

Record before-and-after results in the pull request. Do not claim an improvement without measurements.

### 3. Keep images lightweight

The live UI uses optimized WebP brand previews. Do not replace them with the multi-megabyte source PNG files. The original brand pack remains the archival source; the website should continue using the optimized derivatives under `assets/brand/`.

## Priority 1: professional UI/UX refinement

### Header and navigation

- Keep the header product-first: icon, ReceiptKing, privacy status, and Appearance control.
- Do not restore “Emperor UI · Purchasing organized” under the product name.
- Keep Emperor UI as a quiet design-system reference in the footer and Appearance panel.
- Confirm the header remains readable at 320, 360, 390, 768, and 1440 px widths.

### Appearance menu

- Preserve the WYWO-inspired structure: Mode, Color Theme, and Jungle App Icon.
- Add focus trapping, focus return, and body-scroll locking while the dialog is open.
- Ensure Escape closes the dialog and the close button has a visible keyboard focus state.
- Confirm all eight themes meet readable contrast in both light and dark modes.
- Preserve independent browser storage for theme, mode, and icon choices.

### Purchasing workspace

- On narrow screens, consider purchase rows as stacked cards instead of a horizontally scrolling table.
- Keep report details, receipt import, purchases, and approval visibly ordered as steps 1 through 3.
- Add inline validation for missing Budget Code, Amount, and Reason before export.
- Keep error messages beside the affected field where possible instead of relying only on temporary toast messages.
- Consider a compact sticky export bar on mobile after the report contains at least one completed row.
- Do not hide the source receipt filename from the reviewer.

### Hero treatment

- Keep the Clerk logo and selected Jungle seal, but do not let the marketing hero dominate the working form on smaller laptop screens.
- Test a reduced hero height for returning users or screens below approximately 800 px tall.
- Avoid adding more slogans, badges, or decorative panels above the form.

## Priority 2: reliability and accessibility

- Add an OCR cancel action and release the worker after completion or cancellation.
- Add reasonable file-size and image-dimension guidance before OCR begins.
- Test low-resolution receipts, rotated photos, blank files, and password-protected PDFs.
- Add duplicate-receipt warnings without preventing manual override.
- Add keyboard-only coverage for the Appearance dialog, upload area, purchase rows, delete actions, and export controls.
- Respect `prefers-reduced-motion` for panel animations and transitions.
- Add local-storage schema versioning before changing saved form structure.
- Keep exported financial data independent of the active UI color theme.

## Important product boundaries

- Browser-local processing is a design promise. Do not add a server upload path without an explicit privacy and records decision.
- The current OCR scope reads only the first PDF page.
- Budget Code is still staff-entered until an approved City list is supplied.
- Draft data is specific to the browser and device.
- ReceiptKing is independent and is not affiliated with Ramp.
- The public site should not imply that OCR values are automatically approved.

## Verification matrix

| Area | Required checks |
| --- | --- |
| Browsers | Current Chrome, Edge, Safari, and Firefox |
| Widths | 320, 360, 390, 768, 1024, and 1440 px |
| Modes | Light, Dark, and Auto |
| Themes | All eight Emperor UI themes |
| Icons | All six Jungle icons, including persistence after reload |
| Intake | PNG, JPG, WebP, and single-page PDF |
| Exports | PDF, Excel, CSV, and browser print |
| Accessibility | Keyboard navigation, focus visibility, dialog behavior, reduced motion, and contrast |
| Persistence | Form draft, selected theme, selected mode, and selected icon |

## Build and release checklist

```bash
npm ci
npm run build
```

Then confirm:

- `app.js` was regenerated from the current `app.jsx`.
- The application opens without console errors.
- OCR still populates an editable purchase row.
- PDF, Excel, and CSV exports contain Department, Month, Today's Date, Budget Code, Amount, Reason for Purchase, Signature, and Date.
- README version links and the site-version table remain accurate.
- GitHub Pages finishes successfully before the task is marked complete.

## Recommended delivery sequence

1. PR 1: dependency lazy-loading and duplicate PDF.js removal.
2. PR 2: Appearance dialog accessibility and reduced-motion support.
3. PR 3: mobile purchase cards, inline validation, and compact export controls.
4. PR 4: OCR cancellation, file safeguards, and regression tests.

Keep each pull request small enough to measure and reverse independently. Avoid a framework migration during this pass unless profiling shows a concrete limitation that cannot be solved within the current static architecture.
