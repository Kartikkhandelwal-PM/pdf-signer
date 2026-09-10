// CSV (not binary .xlsx) is used deliberately here — it opens and saves fine in Excel, Google
// Sheets and Numbers, and avoids pulling in a spreadsheet-parsing library to handle untrusted
// uploaded files (the popular `xlsx`/SheetJS package has unpatched prototype-pollution and
// ReDoS advisories).

export interface RecipientRow {
  fileName: string
  clientName: string
  email: string
  password: string
}

export interface RecipientRowError {
  line: number
  message: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

/** Builds a downloadable CSV template, one row per document, prefilled with what's already
 *  known about each file's client — so the sender fills in gaps instead of the whole sheet. */
export function buildRecipientTemplateCsv(
  docs: { name: string; clientName?: string; email?: string }[],
): string {
  const header = ['File Name', 'Client Name', 'Client Email']
  const rows = docs.map((doc) => [doc.name, doc.clientName ?? '', doc.email ?? ''])
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Parses an uploaded recipient CSV. The header row (if present) is detected and skipped.
 * Deliberately lenient about email — a row missing or malformed there is still returned (only a
 * missing file name is a hard parse error) — because this same shape is reused for password-only
 * uploads where no email is expected at all. Anything that actually requires a usable email
 * (matchRecipientRows, for the "send" use case) validates it at that point instead.
 */
export function parseRecipientCsv(text: string): { rows: RecipientRow[]; errors: RecipientRowError[] } {
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0)
  const rows: RecipientRow[] = []
  const errors: RecipientRowError[] = []

  lines.forEach((line, index) => {
    const cells = parseCsvLine(line)
    const isHeader = index === 0 && /file\s*name/i.test(cells[0] ?? '')
    if (isHeader) return

    const [fileName = '', clientName = '', email = '', password = ''] = cells
    const lineNumber = index + 1

    if (!fileName) {
      errors.push({ line: lineNumber, message: 'Missing file name' })
      return
    }

    rows.push({ fileName, clientName, email, password })
  })

  return { rows, errors }
}

export interface RecipientMatch {
  docId: string
  docName: string
  clientName: string
  email: string
  password: string
}

export interface UnmatchedRow {
  fileName: string
  reason: string
}

/** Matches parsed CSV rows back to real documents by file name (case-insensitive, exact match). */
export function matchRecipientRows(
  rows: RecipientRow[],
  documents: { id: string; name: string }[],
): { matches: RecipientMatch[]; unmatched: UnmatchedRow[] } {
  const byName = new Map(documents.map((doc) => [doc.name.trim().toLowerCase(), doc]))
  const matches: RecipientMatch[] = []
  const unmatched: UnmatchedRow[] = []

  for (const row of rows) {
    const doc = byName.get(row.fileName.trim().toLowerCase())
    if (!doc) {
      unmatched.push({ fileName: row.fileName, reason: "Doesn't match any selected document" })
      continue
    }
    if (!row.email) {
      unmatched.push({ fileName: row.fileName, reason: 'Missing client email' })
      continue
    }
    if (!isValidEmail(row.email)) {
      unmatched.push({ fileName: row.fileName, reason: `"${row.email}" isn't a valid email` })
      continue
    }
    matches.push({ docId: doc.id, docName: doc.name, clientName: row.clientName, email: row.email, password: row.password })
  }

  return { matches, unmatched }
}
