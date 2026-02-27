import * as ExcelJS from 'exceljs';

export interface CellData {
    value: unknown;
    hyperlink?: string;
    color?: string;
}

export type Row = Record<string, CellData>;

export interface SheetData {
    name: string;
    fields: string[];
    rows: Row[];
}

export function cleanGoogleLink(url: string): string {
    if (url.includes('google.com/url?q=')) {
        try {
            const parsed = new URL(url);
            const q = parsed.searchParams.get('q');
            return q || url;
        } catch {
            return url;
        }
    }
    return url;
}

export const EXCLUDED_SHEETS = ["removed", "outdated list of all mods"];

export function isSheetExcluded(name: string): boolean {
    const lowerName = name.trim().toLowerCase();
    return EXCLUDED_SHEETS.includes(lowerName);
}

export async function fetchExcelData(url: string): Promise<{ data?: SheetData[]; error?: string }> {
    try {
        const res = await fetch(url, {
            redirect: 'follow',
            cache: 'no-store',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!res.ok) {
            return {error: `Failed to fetch: ${res.status} ${res.statusText}`};
        }

        const arrayBuffer = await res.arrayBuffer();

        // Check if the buffer starts with HTML signature
        const header = new Uint8Array(arrayBuffer.slice(0, 5));
        const headerString = String.fromCharCode(...Array.from(header));
        if (headerString.toLowerCase().startsWith('<html') || headerString.toLowerCase().startsWith('<!doc')) {
            return {error: "The URL returned an HTML page instead of a file. Please ensure the link is a direct download link."};
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        const sheets: SheetData[] = [];

        workbook.eachSheet((worksheet) => {
            // Skip excluded sheets
            if (isSheetExcluded(worksheet.name)) return;

            // Header is usually in row 3
            const headerRow = worksheet.getRow(3);
            const fields: string[] = [];
            headerRow.eachCell({includeEmpty: true}, (cell, colNumber) => {
                const val = cell.value;
                fields[colNumber] = typeof val === 'object' && val !== null && 'text' in val ? String((val as {
                    text: unknown
                }).text) : String(val || '');
            });

            const rows: Row[] = [];
            worksheet.eachRow({includeEmpty: true}, (row, rowNumber) => {
                if (rowNumber <= 3) return; // Skip title, legend, and header

                const rowData: Row = {};
                let hasData = false;

                row.eachCell({includeEmpty: true}, (cell, colNumber) => {
                    const fieldName = fields[colNumber];
                    if (!fieldName) return;

                    let cellValue: unknown = cell.value;
                    let hyperlink: string | undefined;

                    // Handle complex cell values (RichText, Hyperlink, Formula result)
                    if (cellValue && typeof cellValue === 'object') {
                        const valObj = cellValue as Record<string, unknown>;

                        // 1. Extract hyperlink if present
                        if ('hyperlink' in valObj) {
                            hyperlink = cleanGoogleLink(String(valObj.hyperlink));
                        }

                        // 2. Extract visible value
                        if ('richText' in valObj && Array.isArray(valObj.richText)) {
                            cellValue = (valObj.richText as { text: string }[]).map(rt => rt.text).join('');
                        } else if ('text' in valObj) {
                            cellValue = valObj.text;
                        } else if ('result' in valObj) {
                            cellValue = valObj.result;
                        }
                    }

                    if (typeof cellValue === 'string') {
                        cellValue = cleanGoogleLink(cellValue);
                    }

                    let color: string | undefined;
                    const fill = cell.fill;
                    if (fill && fill.type === 'pattern' && fill.fgColor && 'argb' in fill.fgColor) {
                        color = fill.fgColor.argb;
                    }

                    rowData[fieldName] = {
                        value: cellValue === null ? '' : cellValue,
                        hyperlink: hyperlink,
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

        return {data: JSON.parse(JSON.stringify(sheets))};
    } catch (err: unknown) {
        console.error('Fetch error:', err);
        return {error: String(err)};
    }
}
