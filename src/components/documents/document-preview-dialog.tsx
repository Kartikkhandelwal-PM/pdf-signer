import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileSignature,
  FileText,
  FileWarning,
  Layers,
  Loader2,
  MailCheck,
  PenLine,
  Send,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import sampleDocumentUrl from '@/assets/sample-signed-document.pdf?url'
import { DocumentStatusBadge } from '@/components/dashboard/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDocuments } from '@/context/documents-context'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { loadPdfDocument } from '@/lib/pdf'
import { cn } from '@/lib/utils'
import type { SignedDocument } from '@/types'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5

interface DocumentPreviewDialogProps {
  document: SignedDocument | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSend: (doc: SignedDocument) => void
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-[0.09em] text-muted-foreground/70 uppercase">
        {label}
      </span>
      <div className="min-w-0 text-[12.5px] font-medium">{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-5 py-4 last:border-b-0">
      <span className="text-[10px] font-semibold tracking-[0.09em] text-primary uppercase">{title}</span>
      {children}
    </div>
  )
}

export function DocumentPreviewDialog({ document, open, onOpenChange, onSend }: DocumentPreviewDialogProps) {
  const navigate = useNavigate()
  const { getDraftFile } = useDocuments()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [showPassword, setShowPassword] = useState(false)

  const docId = document?.id
  const docPassword = document?.password

  useEffect(() => {
    if (!open) return
    setPageNumber(1)
    setZoom(1)
    setShowPassword(false)
    setState('loading')

    let cancelled = false

    async function resolveFile(): Promise<{ file: File; sample: boolean }> {
      const draft = docId ? getDraftFile(docId) : undefined
      if (draft) return { file: draft, sample: false }
      const response = await fetch(sampleDocumentUrl)
      const blob = await response.blob()
      return { file: new File([blob], 'sample-signed-document.pdf', { type: 'application/pdf' }), sample: true }
    }

    resolveFile()
      .then(async ({ file, sample }) => {
        if (cancelled) return
        // The bundled stand-in isn't encrypted; only a real file needs the stored password.
        const loaded = await loadPdfDocument(file, sample ? undefined : docPassword)
        if (cancelled) return
        setPdf(loaded)
        setNumPages(loaded.numPages)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
    }
  }, [open, docId, docPassword, getDraftFile])

  const renderPage = useCallback(async () => {
    if (!pdf) return
    const page = await pdf.getPage(Math.min(Math.max(1, pageNumber), pdf.numPages))
    const base = page.getViewport({ scale: 1 })
    const available = (viewportRef.current?.clientWidth ?? 640) - 48
    // Fit the page to the pane at 100%, then let zoom scale from there; ×2 for crisp text.
    const scale = ((available / base.width) * zoom) || 1
    const viewport = page.getViewport({ scale: scale * 2 })
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.style.width = `${viewport.width / 2}px`
    canvas.style.height = `${viewport.height / 2}px`
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
  }, [pdf, pageNumber, zoom])

  useEffect(() => {
    if (state !== 'ready') return
    void renderPage()
  }, [state, renderPage])

  if (!document) return null

  function copyPassword() {
    if (!document?.password) return
    navigator.clipboard?.writeText(document.password)
    toast.success('Password copied to clipboard')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(92vh,780px)] w-[min(1120px,96vw)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border px-6 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-accent">
            <FileText className="size-[18px] text-primary" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <DialogTitle className="truncate text-[15.5px]">{document.name}</DialogTitle>
            <DialogDescription className="truncate font-mono text-[11px]">
              {document.pages} pages · {formatDate(document.updatedAt)}
            </DialogDescription>
          </div>
          <div className="mr-8 shrink-0">
            <DocumentStatusBadge status={document.status} />
          </div>
        </DialogHeader>

        <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px]">
          {/* ---------- Viewer ---------- */}
          <div className="flex min-h-0 flex-col bg-[#eef3f6] dark:bg-[#0d151a]">
            <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card/70 px-4 py-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-[7px]"
                disabled={pageNumber <= 1 || state !== 'ready'}
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="font-mono text-[11.5px] tabular-nums">
                {state === 'ready' ? `${pageNumber} / ${numPages}` : '— / —'}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-[7px]"
                disabled={pageNumber >= numPages || state !== 'ready'}
                onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>

              <div className="mx-1 h-4 w-px bg-border" />

              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-[7px]"
                disabled={zoom <= MIN_ZOOM || state !== 'ready'}
                onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)))}
              >
                <ZoomOut className="size-4" />
              </Button>
              <span className="w-11 text-center font-mono text-[11.5px] tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-[7px]"
                disabled={zoom >= MAX_ZOOM || state !== 'ready'}
                onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)))}
              >
                <ZoomIn className="size-4" />
              </Button>
            </div>

            <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto p-6">
              {state === 'loading' && (
                <div className="flex h-full flex-col items-center justify-center gap-2.5 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                  <span className="text-[12.5px]">Rendering page…</span>
                </div>
              )}
              {state === 'error' && (
                <div className="flex h-full flex-col items-center justify-center gap-2.5 text-muted-foreground">
                  <FileWarning className="size-6" />
                  <span className="text-[12.5px]">This file couldn't be opened for preview.</span>
                </div>
              )}
              <div className={cn('flex justify-center', state !== 'ready' && 'hidden')}>
                <canvas
                  ref={canvasRef}
                  className="rounded-[4px] bg-white shadow-[0_2px_6px_rgba(20,32,42,.12),0_18px_40px_-24px_rgba(20,32,42,.5)]"
                />
              </div>
            </div>
          </div>

          {/* ---------- Details ---------- */}
          <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-border lg:flex">
            <Section title="Document">
              <div className="grid grid-cols-2 gap-3">
                <Detail label="Pages">
                  <span className="font-mono">{document.pages}</span>
                </Detail>
                <Detail label="Pages signed">
                  <span className="font-mono">{document.signedPages ?? `All ${document.pages}`}</span>
                </Detail>
                <Detail label="Source">
                  {document.source === 'batch' ? (
                    <span className="flex items-center gap-1.5">
                      <Layers className="size-3.5 shrink-0 text-brand-teal" />
                      Batch
                    </span>
                  ) : document.source === 'single' ? (
                    <span className="flex items-center gap-1.5">
                      <FileSignature className="size-3.5 shrink-0 text-primary" />
                      Single
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Detail>
                <Detail label="Updated">
                  <span className="font-mono">{formatRelativeTime(document.updatedAt)}</span>
                </Detail>
              </div>
              {document.batchName && (
                <Detail label="Batch">
                  <span className="block truncate font-mono text-[11.5px]">{document.batchName}</span>
                </Detail>
              )}
            </Section>

            <Section title="Signature">
              <Detail label="Signed by">
                <span className="block truncate">{document.signedBy}</span>
              </Detail>
              <Detail label="Certificate">
                <span className="block truncate font-mono text-[11.5px]">{document.certificate}</span>
              </Detail>
              {document.lastVerifiedStatus && (
                <Detail label="Last verified">
                  <span
                    className={cn(
                      'flex items-center gap-1.5',
                      document.lastVerifiedStatus === 'valid' ? 'text-success' : 'text-warning',
                    )}
                  >
                    <ShieldCheck className="size-3.5 shrink-0" />
                    {document.lastVerifiedStatus}
                    {document.lastVerifiedAt && (
                      <span className="font-mono text-[11px] font-normal text-muted-foreground">
                        · {formatRelativeTime(document.lastVerifiedAt)}
                      </span>
                    )}
                  </span>
                </Detail>
              )}
            </Section>

            <Section title="Delivery">
              {document.sentTo ? (
                <>
                  <Detail label="Sent to">
                    <span className="flex items-center gap-1.5 text-success">
                      <MailCheck className="size-3.5 shrink-0" />
                      <span className="min-w-0 truncate font-mono text-[11.5px]">{document.sentTo}</span>
                    </span>
                  </Detail>
                  {document.recipientName && (
                    <Detail label="Recipient">
                      <span className="block truncate">{document.recipientName}</span>
                    </Detail>
                  )}
                </>
              ) : (
                <span className="text-[12.5px] text-muted-foreground">Not sent to anyone yet.</span>
              )}
            </Section>

            {document.password && (
              <Section title="Security">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-[9px] bg-secondary/60 px-3 font-mono text-[12.5px]">
                    <span className="truncate">
                      {showPassword ? document.password : '•'.repeat(document.password.length)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 rounded-[9px] bg-secondary/60 hover:bg-secondary"
                    onClick={() => setShowPassword((s) => !s)}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 rounded-[9px] bg-secondary/60 hover:bg-secondary"
                    onClick={copyPassword}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </Section>
            )}
          </aside>
        </div>

        <DialogFooter className="-mx-0 -mb-0 gap-2 rounded-b-2xl border-t border-border bg-secondary/40 px-6 py-3.5">
          <Button
            variant="ghost"
            className="h-10 gap-1.5 rounded-[10px] bg-secondary font-semibold hover:bg-secondary/70"
            onClick={() => toast(`Downloading ${document.name}`)}
          >
            <Download className="size-4" />
            Download
          </Button>
          {document.status === 'draft' ? (
            <Button
              className="h-10 gap-1.5 rounded-[10px] border-none bg-primary font-semibold hover:bg-primary/90"
              onClick={() => {
                onOpenChange(false)
                navigate('/sign', { state: { resumeDocument: document } })
              }}
            >
              <PenLine className="size-4" />
              Resume signing
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                className="h-10 gap-1.5 rounded-[10px] bg-secondary font-semibold hover:bg-secondary/70"
                onClick={() => {
                  onOpenChange(false)
                  navigate('/verify', { state: { documents: [document] } })
                }}
              >
                <ShieldCheck className="size-4" />
                Verify signature
              </Button>
              <Button
                className="h-10 gap-1.5 rounded-[10px] border-none bg-primary font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90"
                onClick={() => {
                  onOpenChange(false)
                  onSend(document)
                }}
              >
                <Send className="size-4" />
                {document.sentTo ? 'Resend' : 'Send to client'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
