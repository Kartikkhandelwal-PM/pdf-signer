import { useEffect, useRef, useState, type DragEvent } from 'react'
import { FolderUp, Loader2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { extractPdfsFromZip, isPdfName, isZipName, resolveIncomingFiles } from '@/lib/file-intake'
import { cn } from '@/lib/utils'

interface FileDropzoneProps {
  multiple?: boolean
  onFiles: (files: File[]) => void
  title?: string
  subtitle?: string
  className?: string
}

// Recursively reads one dropped filesystem entry — a single file, or a whole folder — into a
// flat list of PDFs, descending into subfolders and unzipping any .zip it encounters.
async function readEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      ;(entry as FileSystemFileEntry).file(resolve, reject)
    })
    if (isZipName(file.name)) return extractPdfsFromZip(file)
    return isPdfName(file.name) ? [file] : []
  }

  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    const children: FileSystemEntry[] = []
    // readEntries only returns up to ~100 entries per call — keep calling until it's empty.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject)
      })
      if (batch.length === 0) break
      children.push(...batch)
    }
    const nested = await Promise.all(children.map(readEntry))
    return nested.flat()
  }

  return []
}

export function FileDropzone({
  multiple = false,
  onFiles,
  title = 'Drop your PDFs here',
  subtitle = 'or browse from your computer',
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [isReading, setIsReading] = useState(false)

  useEffect(() => {
    // webkitdirectory/directory aren't part of React's (or standard HTML's) typed attribute
    // set — set them as raw DOM properties instead of fighting the JSX types.
    const el = folderInputRef.current
    if (!el) return
    el.setAttribute('webkitdirectory', '')
    el.setAttribute('directory', '')
  }, [])

  function finish(files: File[]) {
    setIsReading(false)
    if (files.length === 0) {
      toast.error('No PDF files found')
      return
    }
    onFiles(multiple ? files : files.slice(0, 1))
  }

  // Plain <input> selections — both the regular file picker and the folder picker land here as
  // a flat FileList, no directory traversal needed, but zips still need unwrapping.
  async function handleFileList(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setIsReading(true)
    finish(await resolveIncomingFiles(Array.from(fileList)))
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragActive(false)

    const items = e.dataTransfer.items
    const canWalkEntries = items && items.length > 0 && typeof items[0]?.webkitGetAsEntry === 'function'

    if (canWalkEntries) {
      setIsReading(true)
      const entries = Array.from(items)
        .map((item) => item.webkitGetAsEntry())
        .filter((entry): entry is FileSystemEntry => entry !== null)
      const results = await Promise.all(entries.map(readEntry))
      finish(results.flat())
      return
    }

    await handleFileList(e.dataTransfer.files)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragActive(true)
      }}
      onDragLeave={() => setIsDragActive(false)}
      onDrop={handleDrop}
      className={cn(
        'relative flex w-full max-w-[420px] flex-col items-center gap-5 rounded-[20px] border bg-card px-10 py-12 text-center shadow-[0_1px_2px_rgba(20,32,42,.04),0_24px_48px_-24px_rgba(20,77,105,.28)] transition-colors',
        isDragActive ? 'border-primary bg-primary/5' : 'border-border',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf,.zip,application/zip,application/x-zip-compressed"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          void handleFileList(e.target.files)
          e.target.value = ''
        }}
      />
      {multiple && (
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFileList(e.target.files)
            e.target.value = ''
          }}
        />
      )}

      {isReading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[20px] bg-card/90 backdrop-blur-[1px]">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-[12px] font-medium text-muted-foreground">Reading files…</span>
        </div>
      )}

      <div className="relative flex size-16 items-center justify-center rounded-2xl bg-primary/10">
        <UploadCloud className="size-7 text-primary" />
        <span className="absolute -top-1.5 -right-2 rounded-[6px] bg-brand-pink px-1.5 py-0.5 text-[8.5px] font-bold tracking-wide text-white shadow-[0_2px_6px_-2px_rgba(20,32,42,.4)]">
          PDF
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="font-heading text-[17px] font-semibold">{title}</span>
        <span className="max-w-[280px] text-[13px] text-muted-foreground">{subtitle}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={() => inputRef.current?.click()}
          className="h-10 gap-1.5 rounded-[10px] border-none bg-primary px-5 font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90"
        >
          <UploadCloud className="size-4" />
          Browse files
        </Button>
        {multiple && (
          <Button
            variant="ghost"
            onClick={() => folderInputRef.current?.click()}
            className="h-10 gap-1.5 rounded-[10px] bg-secondary px-4 font-semibold hover:bg-secondary/70"
          >
            <FolderUp className="size-4" />
            Browse folder
          </Button>
        )}
      </div>
      <span className="rounded-full bg-secondary px-3 py-1 font-mono text-[11px] text-muted-foreground">
        PDF, ZIP{multiple ? ' or a folder' : ''} · up to 25MB per file
      </span>
    </div>
  )
}
