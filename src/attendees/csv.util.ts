/**
 * Minimal, dependency-free CSV parsing + validation for the attendee import.
 *
 * Implements the practical subset of RFC 4180 we need:
 *  - quoted fields (double-quote delimited, `""` escapes a quote)
 *  - fields may span multiple lines when quoted
 *  - commas and CR/LF inside quotes are preserved
 *  - optional per-row error capture so a bad row never aborts the import
 */

export interface CsvParseRow {
  values: string[];
  /** 1-based row number (2 = first data row after headers). */
  rowNumber: number;
}

export function parseCsv(input: string): CsvParseRow[] {
  const rows: CsvParseRow[] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let rowNumber = 1;

  // Normalize the BOM if present.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  // Iterate by code point; CRLF is collapsed to LF.
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        // A doubled quote is an escaped quote.
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push({ values: row, rowNumber });
      row = [];
      rowNumber++;
      continue;
    }

    field += ch;
  }

  // Push the trailing field (if any) so a file without a final newline is parsed.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push({ values: row, rowNumber });
  }

  return rows;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Strips surrounding whitespace and removes a surrounding UTF-8 BOM. */
export function cleanValue(value: string): string {
  return value.trim().replace(/^\ufeff/, '');
}

export interface AttendeeRow {
  name: string;
  email: string;
  passType?: string;
}

export interface AttendeeParseResult {
  rows: AttendeeRow[];
  /**
   * Per-row problems. Each entry describes why that row was skipped.
   * Rows with a problem are EXCLUDED from `rows`; valid rows are included.
   */
  errors: { rowNumber: number; message: string }[];
  /** Header row number (0 when the file had no header). */
  headerRowNumber: number;
}

/**
 * Maps a parsed CSV to attendee rows by matching a header row.
 *
 * Accepts headers like `Name`, `Full name`, `Email`, `Email Address`,
 * `Pass type`, `Pass Type` / `Ticket type`. Returns per-row errors for
 * missing required fields or invalid emails.
 */
export function mapAttendeeRows(parsed: CsvParseRow[]): AttendeeParseResult {
  if (parsed.length === 0) {
    return { rows: [], errors: [], headerRowNumber: 0 };
  }

  const logic = {
    name: /^(name|full\s*name|attendee\s*name|attendee)$/i,
    email: /^(email|email\s*address|e-mail)$/i,
    passType: /^(pass\s*type|pass\s?type|ticket\s*type|type)$/i,
  };

  const header = parsed[0].values.map((v) => cleanValue(v));
  let nameIdx = -1;
  let emailIdx = -1;
  let passTypeIdx = -1;

  header.forEach((cell, i) => {
    if (nameIdx === -1 && logic.name.test(cell)) nameIdx = i;
    if (emailIdx === -1 && logic.email.test(cell)) emailIdx = i;
    if (passTypeIdx === -1 && logic.passType.test(cell)) passTypeIdx = i;
  });

  const hasHeader = nameIdx >= 0 || emailIdx >= 0;
  const result: AttendeeParseResult = {
    rows: [],
    errors: [],
    headerRowNumber: hasHeader ? parsed[0].rowNumber : 0,
  };

  const dataRows = hasHeader ? parsed.slice(1) : parsed;

  for (const item of dataRows) {
    const rowNumber = item.rowNumber;
    const get = (idx: number): string =>
      idx >= 0 ? cleanValue(item.values[idx] ?? '') : '';

    const name = hasHeader ? get(nameIdx) : get(0);
    const email = hasHeader ? get(emailIdx) : get(1);
    const passType = hasHeader ? get(passTypeIdx) : get(2);

    if (!name && !email) {
      // Entirely blank row — skip silently, it's not an attendee error.
      continue;
    }
    if (!name) {
      result.errors.push({ rowNumber, message: 'Row is missing a name.' });
      continue;
    }
    if (!email) {
      result.errors.push({ rowNumber, message: 'Row is missing an email address.' });
      continue;
    }
    if (!isEmail(email)) {
      result.errors.push({ rowNumber, message: `"${email}" is not a valid email address.` });
      continue;
    }

    result.rows.push({ name, email, passType: passType || undefined });
  }

  return result;
}

/** Builds the row-level feedback message used after a CSV import. */
export function summarizeCsvResult(args: {
  total: number;
  created: number;
  duplicates: number;
  errors: { rowNumber: number; message: string }[];
}): string {
  const { total, created, duplicates, errors } = args;
  const parts = [`${created} of ${total} attendee row(s) imported.`];
  if (duplicates > 0) {
    parts.push(`${duplicates} duplicate(s) skipped.`);
  }
  if (errors.length > 0) {
    parts.push(`${errors.length} row(s) had errors.`);
  }
  return parts.join(' ');
}