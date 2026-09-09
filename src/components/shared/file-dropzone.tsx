import { useRef, useState, type DragEvent } from 'react'
import { UploadCloud } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FileDropzoneProps {
  multiple?: boolean
  onFiles: (files: File[]) => void
  title?: string
  subtitle?: string
  className?: string
}

export function FileDropzone({
  multiple = false,
  onFiles,
  title = 'Drop your PDFs here',
  subtitle = 'or browse from your computer',
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList).filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (files.length > 0) onFiles(files)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragActive(false)
    handleFiles(e.dataTransfer.files)
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
        'flex w-full max-w-[420px] flex-col items-center gap-5 rounded-[20px] border bg-card px-10 py-12 text-center shadow-[0_1px_2px_rgba(20,32,42,.04),0_24px_48px_-24px_rgba(20,77,105,.28)] transition-colors',
        isDragActive ? 'border-primary bg-primary/5' : 'border-border',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
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
      <Button
        onClick={() => inputRef.current?.click()}
        className="h-10 gap-1.5 rounded-[10px] border-none bg-primary px-5 font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90"
      >
        <UploadCloud className="size-4" />
        Browse files
      </Button>
      <span className="rounded-full bg-secondary px-3 py-1 font-mono text-[11px] text-muted-foreground">
        PDF only · up to 25MB{multiple ? ' per file' : ''}
      </span>
    </div>
  )
}
