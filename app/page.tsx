// app/page.tsx
import React from 'react';
import * as ExcelJS from 'exceljs';
import TableClient from '@/components/TableClient';

export const dynamic = 'force-dynamic';

interface CellData {
  value: unknown;
  color?: string;
}

type Row = Record<string, CellData>;

interface SheetData {
  name: string;
  fields: string[];
  rows: Row[];
}

async function fetchExcelData(url: string): Promise<{ data?: SheetData[]; error?: string }> {
  try {
    const res = await fetch(url, { 
      redirect: 'follow', 
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!res.ok) {
      return { error: `Failed to fetch: ${res.status} ${res.statusText}` };
    }

    const arrayBuffer = await res.arrayBuffer();
    
    // Check if the buffer starts with HTML signature
    const header = new Uint8Array(arrayBuffer.slice(0, 5));
    const headerString = String.fromCharCode(...Array.from(header));
    if (headerString.toLowerCase().startsWith('<html') || headerString.toLowerCase().startsWith('<!doc')) {
       return { error: "The URL returned an HTML page instead of a file. Please ensure the link is a direct download link." };
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const sheets: SheetData[] = [];

    workbook.eachSheet((worksheet) => {
      const trimmedName = worksheet.name.trim();
      const lowerName = trimmedName.toLowerCase();
      
      // Skip excluded sheets
      const excludeSheetsExact = ["removed", "original server mods"];
      if (excludeSheetsExact.includes(lowerName)) return;

      // Header is usually in row 3
      const headerRow = worksheet.getRow(3);
      const fields: string[] = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const val = cell.value;
        fields[colNumber] = typeof val === 'object' && val !== null && 'text' in val ? String((val as { text: unknown }).text) : String(val || '');
      });

      const rows: Row[] = [];
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (rowNumber <= 3) return; // Skip title, legend, and header

        const rowData: Row = {};
        let hasData = false;
        
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const fieldName = fields[colNumber];
          if (!fieldName) return;

          let cellValue: unknown = cell.value;
          // Handle hyperlinks
          if (cellValue && typeof cellValue === 'object' && 'text' in cellValue) {
             cellValue = (cellValue as { text: unknown }).text;
          }
          if (cellValue && typeof cellValue === 'object' && 'result' in cellValue) {
             cellValue = (cellValue as { result: unknown }).result;
          }

          let color: string | undefined;
          const fill = cell.fill;
          if (fill && fill.type === 'pattern' && fill.fgColor && 'argb' in fill.fgColor) {
             color = fill.fgColor.argb;
          }

          rowData[fieldName] = {
            value: cellValue === null ? '' : cellValue,
            color: color
          };
          
          if (cellValue) hasData = true;
        });

        if (hasData) {
          rows.push(rowData);
        }
      });

      if (fields.length > 0) {
        // Clean up fields array (it might have holes if columns were skipped)
        const cleanFields = fields.filter(f => f && f !== 'undefined');
        sheets.push({
          name: worksheet.name,
          fields: cleanFields,
          rows: rows
        });
      }
    });

    return { data: JSON.parse(JSON.stringify(sheets)) };
  } catch (err: unknown) {
    console.error('Fetch error:', err);
    return { error: String(err) };
  }
}

export default async function Page() {
  const excelUrl = process.env.DOCUMENT_URL;
  if (!excelUrl) {
    return (
        <main className="container mx-auto p-4">
          <h1 className="text-3xl font-bold mb-4">Epicraft Mod Explorer</h1>
          <p className="text-red-500 font-medium">Missing environment variable DOCUMENT_URL in .env.local</p>
        </main>
    );
  }

  const { data: sheets, error } = await fetchExcelData(excelUrl);

  if (error) {
    return (
        <main className="min-h-screen bg-linear-to-b from-orange-50 to-rose-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white dark:bg-gray-800 rounded-2xl p-10 border border-rose-200 dark:border-rose-900/50 shadow-lg text-center">
            <div className="text-5xl mb-5">⚠️</div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Connection Failed</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">We couldn&apos;t reach the compatibility sheet. This is usually due to a private link or a temporary connection issue.</p>

            <div className="p-5 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800/50 text-left mb-6">
              <h2 className="text-sm font-semibold text-rose-900 dark:text-rose-300 mb-3">Technical Details</h2>
              <code className="text-xs text-rose-700 dark:text-rose-400 break-all bg-white dark:bg-gray-900 p-2.5 rounded-lg block border border-rose-100 dark:border-rose-800 mb-5">{error}</code>

              <h3 className="text-sm font-medium text-rose-800 dark:text-rose-300 mb-2">Troubleshooting:</h3>
              <ul className="space-y-2 text-sm text-rose-700 dark:text-rose-400">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>Verify the Google Sheets link is <strong>&quot;Published to the web&quot;</strong> specifically as an <strong>XLSX</strong> file.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>Ensure &quot;Anyone with the link&quot; permissions are set if using a direct OneDrive link.</span>
                </li>
              </ul>
            </div>

            <button
                onClick={() => typeof window !== 'undefined' && window.location.reload()}
                className="w-full py-3.5 bg-linear-to-r from-orange-500 to-rose-500 text-white rounded-xl font-medium hover:shadow-md hover:shadow-orange-200/50 transition-all active:scale-95"
            >
              Try to reconnect
            </button>
          </div>
        </main>
    );
  }

  if (!sheets || sheets.length === 0) {
    return (
        <main className="min-h-screen bg-linear-to-b from-orange-50 to-rose-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white dark:bg-gray-800 rounded-2xl p-10 border border-gray-200 dark:border-gray-700 shadow-lg text-center">
            <div className="text-5xl mb-5">📦</div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">No Sheets Found</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">The connected document doesn&apos;t seem to contain any valid mod sheets or category tabs.</p>
            <button
                onClick={() => typeof window !== 'undefined' && window.location.reload()}
                className="w-full py-3.5 bg-linear-to-r from-orange-500 to-rose-500 text-white rounded-xl font-medium hover:shadow-md hover:shadow-orange-200/50 transition-all active:scale-95"
            >
              Refresh data
            </button>
          </div>
        </main>
    );
  }

  return (
      <main className="min-h-screen bg-linear-to-b from-orange-50 to-rose-50 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 selection:bg-orange-100 selection:text-orange-900 dark:selection:bg-orange-900 dark:selection:text-orange-100">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          <header className="mb-16 text-center">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-5">
              Epicraft <span className="bg-linear-to-r from-orange-600 to-rose-600 dark:from-orange-500 dark:to-rose-500 bg-clip-text text-transparent">Mod Explorer</span>
            </h1>
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Browse the compatibility spreadsheet with no effort and live updates.
            </p>
          </header>

          <section className="animate-slide-up">
            <TableClient sheets={sheets} />
          </section>

          <footer className="mt-24 pt-10 border-t border-gray-200/50 dark:border-gray-700/50 text-center">
            <div className="flex flex-col items-center gap-4">
              <a
                  href="https://docs.google.com/spreadsheets/d/e/2PACX-1vRz6SXO_bxSPz7xeH7w8YEqoP5NAWMrcQ2McyjEdd8g40SZ-dufQZdAkR8a1bI5Y3gyjgTN_Er-QWmi/pub"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Connected to live spreadsheet
              </a>
              <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
                Powered by <span className="font-medium text-gray-700 dark:text-gray-300">Next.js</span> & <span className="font-medium text-gray-700 dark:text-gray-300">Google Sheets</span>.
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
                Made by <span className="font-medium text-gray-700 dark:text-gray-300">Tyr</span>.
              </p>
            </div>
          </footer>
        </div>
      </main>
  );
}
