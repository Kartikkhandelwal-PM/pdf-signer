import type { PDFDocumentProxy } from 'pdfjs-dist'

let workerConfigured = false
const docCache = new WeakMap<File, Promise<PDFDocumentProxy>>()

async function getPdfJs() {
  const pdfjsLib = await import('pdfjs-dist')
  if (!workerConfigured) {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
    workerConfigured = true
  }
  return pdfjsLib
}

// Cached per File object — the same file is parsed at most once, however many
// times its page count or page content is requested (list row, thumbnail, preview).
//
// Only ever cached on SUCCESS: a password-protected file rejects on the first (password-less)
// attempt, and that rejection must not stick around and poison a later attempt made with the
// correct password.
export function loadPdfDocument(file: File, password?: string): Promise<PDFDocumentProxy> {
  const cached = docCache.get(file)
  if (cached) return cached

  const promise = getPdfJs().then((pdfjsLib) =>
    file.arrayBuffer().then((buf) => pdfjsLib.getDocument({ data: buf, password }).promise),
  )
  promise.then(
    () => docCache.set(file, promise),
    () => {},
  )
  return promise
}

export type PasswordCheck = 'ok' | 'password-required' | 'wrong-password' | 'error'

// Tries to open a PDF — with a candidate password, when retrying one the user just typed —
// purely to learn whether it's protected. Never touches pdfjs-dist statically (the dynamic
// import in getPdfJs keeps the ~400KB library out of the main bundle).
export async function checkPdfPassword(file: File, password?: string): Promise<PasswordCheck> {
  const pdfjsLib = await getPdfJs()
  try {
    await loadPdfDocument(file, password)
    return 'ok'
  } catch (err) {
    if (err instanceof pdfjsLib.PasswordException) {
      return err.code === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD ? 'wrong-password' : 'password-required'
    }
    return 'error'
  }
}
