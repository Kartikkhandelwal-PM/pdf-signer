// Minimal ambient types for the (still non-standard, webkit-prefixed) File and Directory Entries
// API used to recursively read a dropped folder — not part of lib.dom.d.ts. Only the members
// file-dropzone.tsx actually calls are declared.

interface FileSystemEntry {
  readonly isFile: boolean
  readonly isDirectory: boolean
  readonly fullPath: string
  readonly name: string
}

interface FileSystemFileEntry extends FileSystemEntry {
  file(successCallback: (file: File) => void, errorCallback?: (err: DOMException) => void): void
}

interface FileSystemDirectoryReader {
  readEntries(
    successCallback: (entries: FileSystemEntry[]) => void,
    errorCallback?: (err: DOMException) => void,
  ): void
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader(): FileSystemDirectoryReader
}

interface DataTransferItem {
  webkitGetAsEntry(): FileSystemEntry | null
}
