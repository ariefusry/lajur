type Cell = string | number | null | undefined;

const cell = (v: Cell) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote when needed; a leading =,+,-,@ would run as a formula in Excel/Sheets, so it gets a ' prefix.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

/** RFC 4180 CSV with a UTF-8 BOM, so Excel shows Indonesian text (and "–") correctly. */
export function toCsv(header: string[], rows: Cell[][]) {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
