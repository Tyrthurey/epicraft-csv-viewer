# Epicraft Mod Explorer

This is a simple web viewer for the Epicraft mod compatibility spreadsheet. Instead of navigating a massive Google Sheet, you can use this to quickly search for mods and see what works on which version.

## How it works
It fetches the latest `.xlsx` version of the spreadsheet, parses it with `exceljs`, and renders it using Next.js.

## Setup
1. `npm install`
2. Create `.env.local` with `DOCUMENT_URL` (must be a direct download link to an Excel file).
3. `npm run dev`

The current document url is:
```js
DOCUMENT_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vRz6SXO_bxSPz7xeH7w8YEqoP5NAWMrcQ2McyjEdd8g40SZ-dufQZdAkR8a1bI5Y3gyjgTN_Er-QWmi/pub?output=xlsx"
```

Website made by Tyr.
Community spreadsheet maintained by @jurkomsk and @cobwebblocks.
