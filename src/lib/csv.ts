type Cell = string | number | null | undefined;

const cell = (v: Cell) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote when needed; a leading =,+,-,@ would run as a formula in Excel/Sheets, so it gets a ' prefix.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

/**
 * RFC 4180 CSV with a UTF-8 BOM and `sep=,` hint on the first line.
 * The BOM makes Excel show Indonesian characters correctly; `sep=,` tells
 * Excel to use comma as delimiter regardless of the Windows locale (Indonesia
 * uses semicolons by default, which causes all data to appear in column A).
 * Google Sheets ignores the `sep=,` line and handles comma-CSVs fine anyway.
 */
export function toCsv(header: string[], rows: Cell[][]) {
  return "\uFEFFsep=,\r\n" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
