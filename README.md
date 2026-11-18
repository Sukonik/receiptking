<div align="center">
  <img src="./favicon.svg" width="112" height="112" alt="ReceiptKing Emperor Tamarin logo" />

  # ReceiptKing

  **Receipt automation, built simply.**

  Turn receipt PDFs, photos, and scans into clean purchasing records for PDF, Excel, CSV, and print.

  [![Open ReceiptKing](https://img.shields.io/badge/Open_ReceiptKing-163F36?style=for-the-badge&logo=github&logoColor=D7F06B)](https://sukonik.github.io/receiptking/)
  [![Browse Source](https://img.shields.io/badge/Browse_Source-225B4E?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Sukonik/receiptking)
  [![Deployment](https://img.shields.io/github/actions/workflow/status/Sukonik/receiptking/pages.yml?branch=main&style=for-the-badge&label=Pages)](https://github.com/Sukonik/receiptking/actions/workflows/pages.yml)

  [![Version](https://img.shields.io/badge/version-1.0-D7F06B?style=flat-square&labelColor=163F36)](#site-versions)
  [![License](https://img.shields.io/github/license/Sukonik/receiptking?style=flat-square&color=D7F06B&labelColor=163F36)](./LICENSE)
  [![Static App](https://img.shields.io/badge/static-browser_app-F6F7F2?style=flat-square&labelColor=163F36)](#privacy-and-data-handling)
</div>

---

## Quick links

[Live website](https://sukonik.github.io/receiptking/) · [Version history](#site-versions) · [Features](#version-1-features) · [Workflow](#how-it-works) · [Emperor UI](#emperor-ui-system) · [Run locally](#run-locally) · [Roadmap](#roadmap)

## What ReceiptKing does

ReceiptKing is a lightweight receipt importer for offices that need to turn scattered receipts into consistent purchasing spreadsheets. Staff can upload a receipt, review OCR suggestions, add the correct budget code, and export a clean expense record without retyping every field from scratch.

The project begins with a deliberately narrow municipal workflow. It follows the current City credit card expense form while leaving room for future department templates and approved budget-code lists.

### The problem it solves

- Receipts arrive as PDFs, scans, screenshots, and phone photos.
- Purchasing wants consistent Excel or CSV records.
- Staff repeatedly type amounts and purchase reasons by hand.
- Budget codes must be supplied or confirmed by the submitting department.
- OCR can save time, but financial values still need human review.
- The original workflow should remain simple enough for occasional users.

ReceiptKing addresses those hurdles with a three-step flow: report details, receipt intake, and reviewed export.

## Version 1 features

| Area | Included in v1 |
| --- | --- |
| Receipt intake | PDF, PNG, JPG, JPEG, and WebP |
| OCR | Browser-based Tesseract.js text recognition |
| PDF handling | PDF.js renders the first page for OCR |
| Report fields | Department, Month, and Today's Date |
| Purchase fields | Budget Code, Amount, and Reason for Purchase |
| Approval fields | Signature / Printed Name and Signature Date |
| Review | Every OCR suggestion remains editable |
| Totals | Live report-total calculation |
| Exports | Direct PDF, Excel `.xlsx`, CSV, and browser print |
| Drafts | Automatic browser-local draft storage |
| Deployment | Static GitHub Pages website |

## How it works

1. **Create the report**
   - Confirm the department.
   - Select the reporting month.
   - Confirm today's date.

2. **Import or enter purchases**
   - Drop in a supported receipt file or add a row manually.
   - ReceiptKing reads the first page and suggests an amount and purchase reason.
   - Enter the approved budget code.
   - Review every suggested value against the original receipt.

3. **Approve and export**
   - Add the signature or printed name and date.
   - Download a formatted PDF report, Excel workbook, or CSV file.
   - Use the separate print view when a paper copy is required.

## City expense-form mapping

ReceiptKing v1 mirrors the source form instead of inventing a larger accounting system.

| City form field | ReceiptKing behavior |
| --- | --- |
| Department | Defaults to Corporation Counsel and remains editable |
| Month | Month picker |
| Today's Date | Date picker, defaulted to the current day |
| Budget Code | Staff-entered field pending an approved code list |
| Amount | OCR suggestion or manual entry |
| Reason for Purchase | OCR-assisted suggestion or manual entry |
| Signature | Typed name for the report record |
| Date | Signature-date picker |

## OCR and review boundaries

ReceiptKing uses OCR as an assistant, not as final approval. Thermal receipts, shadows, folds, handwriting, unusual layouts, and low-resolution scans can produce imperfect results. Version 1 therefore never locks or silently submits an OCR value. Staff should compare the amount and purchase reason with the original receipt before exporting.

Current OCR scope:

- Reads the first page of a PDF.
- Searches receipt text for total-like monetary values.
- Uses likely merchant text to suggest a purchase description.
- Leaves budget-code selection to staff.
- Keeps manual entry available when OCR cannot read a document.

## Privacy and data handling

Version 1 is a static browser application.

- Receipt OCR runs in the user's browser through Tesseract.js.
- Receipt files are not uploaded to a ReceiptKing application server.
- Draft report data is stored in the browser's local storage.
- Clearing site data or using another browser will remove or hide that local draft.
- Exported spreadsheets are generated in the browser and downloaded by the user.
- Exported PDFs are generated locally with jsPDF and jsPDF-AutoTable.

This architecture keeps the first release easy to inspect and deploy. Organizations should still apply their own records, security, and retention policies before using any public web application with official documents.

## Emperor UI system

ReceiptKing introduces the **Emperor UI system**, named for its Emperor Tamarin mascot. The visual system gives a very small workflow a distinct identity without making the purchasing experience feel childish or distracting.

### Emperor UI principles

- **Compact authority:** dense enough for financial work, but never cramped.
- **Visible progress:** three numbered stages make the workflow immediately understandable.
- **Review before action:** OCR values stay editable and export remains a deliberate step.
- **Friendly precision:** rounded panels and mascot branding sit beside clear labels and totals.
- **Responsive simplicity:** the same workflow remains readable on desktop, tablet, and mobile.

### Core visual language

| Token | Use |
| --- | --- |
| Forest green `#163F36` | Primary controls, totals, and brand authority |
| Deep green `#225B4E` | Secondary emphasis and active states |
| Lime `#D7F06B` | Progress, confirmation, and crown accents |
| Warm paper `#F6F7F2` | Application background |
| White `#FFFFFF` | Forms and working panels |

The interface uses Ant Design components with Tailwind-inspired responsive composition, spacing, and utility patterns.

## Site versions

The newest public version always appears first.

| Version | Status | Website | Source snapshot | Published |
| --- | --- | --- | --- | --- |
| **v1.1** | Current | [Open v1.1](https://sukonik.github.io/receiptking/) | [`main`](https://github.com/Sukonik/receiptking/tree/main) | November 18, 2026 |
| **v1.0** | Historical source | Replaced by v1.1 | [`d128fc2`](https://github.com/Sukonik/receiptking/commit/d128fc28faa4f07cad1498cdff8d4da4e26fc7d0) | November 18, 2026 |

Permanent project links:

- **Latest live site:** https://sukonik.github.io/receiptking/
- **Main branch:** https://github.com/Sukonik/receiptking/tree/main
- **Deployment history:** https://github.com/Sukonik/receiptking/actions/workflows/pages.yml
- **Commit history:** https://github.com/Sukonik/receiptking/commits/main

Future public versions should be added to the top of the table with a release tag or immutable commit link, so the history remains traceable even when the main site changes.

## Technical foundation

- React 18
- Ant Design 5
- Tailwind CSS browser utilities
- Tesseract.js OCR
- PDF.js
- SheetJS
- jsPDF and jsPDF-AutoTable
- Browser local storage
- GitHub Actions
- GitHub Pages

### Project structure

```text
receiptking/
├── .github/workflows/pages.yml  # GitHub Pages deployment
├── app.jsx                      # Receipt workflow and export logic
├── favicon.svg                  # Emperor Tamarin brand mark
├── index.html                   # Application entry point and browser libraries
├── styles.css                   # Emperor UI responsive styling
├── package.json                 # Local preview command
├── LICENSE                      # Mozilla Public License 2.0
└── README.md                    # Project guide and version history
```

## Run locally

ReceiptKing is a static application. The simplest preview uses Python:

```bash
git clone https://github.com/Sukonik/receiptking.git
cd receiptking
python3 -m http.server 8000
```

Open `http://localhost:8000`.

For the included Vite preview:

```bash
npm install
npm run dev
```

## Deployment

Commits to `main` trigger `.github/workflows/pages.yml`. The workflow checks out the repository, configures GitHub Pages, uploads the static site, and deploys it to the public website.

[View the deployment workflow](https://github.com/Sukonik/receiptking/actions/workflows/pages.yml)

## Roadmap

### Next practical build slices

1. **Budget-code intelligence**
   - Import the approved City budget-code list.
   - Add validated selection and commonly used codes.

2. **Stronger receipt extraction**
   - Improve vendor, date, subtotal, tax, and total parsing.
   - Add multi-page PDF processing and confidence flags.

3. **Submission packages**
   - Package the spreadsheet with consistently named original receipts.
   - Link spreadsheet rows to source documents.

4. **Review safeguards**
   - Detect likely duplicates.
   - Flag missing budget codes and questionable totals.

5. **Optional templates**
   - Support additional department forms without expanding the default workflow.

## Project boundaries

ReceiptKing is intentionally not a corporate-card platform, accounting system, or automatic approval service. Its job is to convert receipt material into reviewable, spreadsheet-ready records while keeping staff in control.

ReceiptKing is an independent open-source project. It is not affiliated with or endorsed by Ramp.

## Related reference project

[WYWO](https://github.com/Sukonik/wywo) is ReceiptKing's sibling office-utility reference project. WYWO helped establish the browser-local, print-friendly approach used here for municipal office workflows. ReceiptKing extends that philosophy with structured PDF, Excel, and CSV purchasing exports.

## License

ReceiptKing is available under the [Mozilla Public License 2.0](./LICENSE).
