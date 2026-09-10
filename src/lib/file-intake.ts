// Shared logic for turning "whatever the user just handed us" — individual PDFs, a .zip full of
// them, or a FileList picked via a webkitdirectory folder input — into a flat File[] of PDFs.
// Used by both the FileDropzone (which also has to walk dropped folders via the File System
// Entry API) and the plainer "+ Add" file inputs sprinkled through the signing flow.
import JSZip from 'jszip'

export function isPdfName(name: string) {
  return name.toLowerCase().endsWith('.pdf')
}

export function isZipName(name: string) {
  return name.toLowerCase().endsWith('.zip')
}

// Unwraps a .zip archive into the PDFs it contains — dropping folders, non-PDF entries and
// macOS's "__MACOSX" junk — so callers get back the same flat File[] shape as anything picked
// or dropped directly, without needing to know a file arrived inside an archive.
export async function extractPdfsFromZip(zipFile: File): Promise<File[]> {
  const zip = await JSZip.loadAsync(zipFile)
  const entries = Object.values(zip.files).filter(
    (entry) => !entry.dir && isPdfName(entry.name) && !entry.name.startsWith('__MACOSX/'),
  )
  return Promise.all(
    entries.map(async (entry) => {
      const blob = await entry.async('blob')
      const baseName = entry.name.split('/').pop() || entry.name
      return new File([blob], baseName, { type: 'application/pdf' })
    }),
  )
}

// Resolves a flat list of picked files (a normal multi-file selection, or every file under a
// webkitdirectory folder selection) into just the PDFs — expanding any .zip along the way.
export async function resolveIncomingFiles(picked: File[]): Promise<File[]> {
  const results = await Promise.all(
    picked.map((f) => (isZipName(f.name) ? extractPdfsFromZip(f) : isPdfName(f.name) ? [f] : [])),
  )
  return results.flat()
}
