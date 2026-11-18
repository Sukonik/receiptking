# ReceiptKing 🐒👑

> Receipt automation, built simply.

ReceiptKing turns receipt PDFs, photos, and scans into organized purchasing records for CSV, Excel, and print. It uses OCR to suggest receipt details, gives staff a clear review step, and keeps the final City expense form intentionally simple.

## Version 1

The first release follows the current City credit card expense form:

- Department
- Month
- Today's Date
- Budget Code
- Amount
- Reason for Purchase
- Signature / Printed Name
- Signature Date

Staff can add purchases manually or import a PDF or image receipt. ReceiptKing reads the first page with OCR and suggests the amount and purchase reason. Every result remains editable before export.

### Exports

- Excel `.xlsx`
- CSV
- Browser print / PDF

### Privacy

Version 1 runs as a static browser application. OCR happens in the browser through Tesseract.js, and ReceiptKing does not upload receipt files to its own server. Draft form data is saved in the browser's local storage.

## Emperor UI system

ReceiptKing uses the **Emperor UI system**, named for its Emperor Tamarin mascot. It is a small king for a deliberately small and practical workflow. Emperor UI combines:

- Deep forest green, warm paper white, and lime confirmation accents
- Compact finance panels with generous spacing
- Clear numbered steps for intake, review, and export
- Ant Design controls with Tailwind-inspired responsive composition
- Friendly monkey branding without weakening the professional purchasing workflow

ReceiptKing is an independent open-source project. It is not affiliated with or endorsed by Ramp.

## Run locally

Because the application loads browser libraries from CDNs, serve the folder with any static server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Technical foundation

- React 18
- Ant Design 5
- Tailwind CSS browser utilities
- Tesseract.js OCR
- PDF.js
- SheetJS
- GitHub Pages

## Planned follow-ups

1. Import an approved City budget-code list and provide validated code selection.
2. Improve receipt-field extraction and multi-page PDF handling.
3. Package original receipts with spreadsheet exports.
4. Add duplicate-receipt detection and a review queue.
5. Add optional department templates without expanding the core workflow.

## License

Mozilla Public License 2.0.
