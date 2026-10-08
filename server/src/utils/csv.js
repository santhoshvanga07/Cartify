/**
 * Minimal RFC 4180 CSV writer.
 *
 * Two traps it avoids:
 *  1. Commas, quotes and newlines inside a value - the value is quoted and
 *     inner quotes doubled.
 *  2. CSV INJECTION. A product named "=HYPERLINK(...)" becomes a live formula
 *     when an admin opens the export in Excel. Any text starting with
 *     = + - @ (or a tab/CR) is prefixed with an apostrophe so it stays text.
 *     Real numbers are left alone so they still sum in a spreadsheet.
 */
const cell = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (value instanceof Date) return value.toISOString();

  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** @param columns [{ key, label }]  @param rows array of plain objects */
export const toCsv = (columns, rows) =>
  [columns.map((c) => cell(c.label)).join(','), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(','))].join(
    '\r\n'
  ) + '\r\n';

/** Sends a CSV download. The BOM makes Excel read ₹ and accented names as UTF-8. */
export const sendCsv = (res, filename, columns, rows) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send('﻿' + toCsv(columns, rows));
};
