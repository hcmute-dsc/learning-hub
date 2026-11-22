/**
 * CSV for spreadsheets (RFC 4180), safe to open in Excel or Google Sheets. Pure functions,
 * tested in csv.spec.ts.
 *
 * - UTF-8 with a byte order mark: without it Excel reads the file as the local code page and
 *   Vietnamese letters break ("Nguyá»…n").
 * - CRLF line ends, cells quoted only when needed.
 * - Formula injection (OWASP "CSV Injection"): a text cell that starts with = + - @ (also
 *   the full-width ＝ ＋ － ＠ that Excel accepts, and tab / CR) would run as a formula,
 *   so it gets a leading apostrophe and shows as plain text. Numbers stay numbers.
 */

export type CsvValue = string | number | null | undefined;

export const UTF8_BOM = '﻿';

const FORMULA_START = /^[=+\-@\t\r＝＋－＠]/;
const NEEDS_QUOTES = /[",\r\n]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  if (NEEDS_QUOTES.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** A whole file: BOM, header, rows, CRLF after every line. */
export function toCsv(header: string[], rows: CsvValue[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(','));
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
}
