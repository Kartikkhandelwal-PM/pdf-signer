import { useEffect, useState } from 'react'
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  FileSignature,
  FileText,
  KeyRound,
  Layers,
  Lock,
  PenLine,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { DocumentStatusBadge } from '@/components/dashboard/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate, formatRelativeTime } from '@/lib/format'
import type { SignedDocument } from '@/types'

interface DetailRowProps {
  label: string
  children: React.ReactNode
}

function DetailRow({ label, children }: DetailRowProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-[10px] bg-secondary/50 p-3.5">
      <span className="text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
        {label}
      </span>
      <div className="min-w-0 text-[13px] font-medium">{children}</div>
    </div>
  )
}

interface DocumentDetailDialogProps {
  document: SignedDocument | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DocumentDetailDialog({ document, open, onOpenChange }: DocumentDetailDialogProps) {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!open) setShowPassword(false)
  }, [open])

  if (!document) return null

  function copyPassword() {
    if (!document?.password) return
    navigator.clipboard?.writeText(document.password)
    toast.success('Password copied to clipboard')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[94vw] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-4xl">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border px-7 py-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-accent">
            <FileText className="size-5 text-primary" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <DialogTitle className="truncate text-[16px]">{document.name}</DialogTitle>
            <span className="font-mono text-[11.5px] text-muted-foreground">
              {document.pages} pages · {formatDate(document.updatedAt)}
            </span>
          </div>
          <DocumentStatusBadge status={document.status} />
        </DialogHeader>

        <div className="grid grid-cols-1 gap-7 p-7 sm:grid-cols-[260px_1fr]">
          {/* Preview */}
          <div className="flex items-start justify-center">
            <div className="relative flex aspect-[210/297] w-full max-w-[260px] flex-col gap-2.5 rounded-[8px] bg-white p-6 shadow-[0_2px_4px_rgba(20,32,42,.06),0_16px_32px_-16px_rgba(20,32,42,.2)] ring-1 ring-black/5">
              <div className="h-2.5 w-2/3 rounded-full bg-[#e2edf1]" />
              <div className="mt-1 h-2 w-full rounded-full bg-[#eaf1f4]" />
              <div className="h-2 w-full rounded-full bg-[#eaf1f4]" />
              <div className="h-2 w-4/5 rounded-full bg-[#eaf1f4]" />
              <div className="mt-2.5 h-2 w-full rounded-full bg-[#eaf1f4]" />
              <div className="h-2 w-full rounded-full bg-[#eaf1f4]" />
              <div className="h-2 w-3/5 rounded-full bg-[#eaf1f4]" />
              <div className="mt-2.5 h-2 w-full rounded-full bg-[#eaf1f4]" />
              <div className="h-2 w-full rounded-full bg-[#eaf1f4]" />
              <div className="h-2 w-2/5 rounded-full bg-[#eaf1f4]" />

              {document.status === 'signed' && (
                <div className="absolute right-4 bottom-4 left-4 flex flex-col gap-1 rounded-[6px] border border-dashed border-primary bg-primary/5 p-2">
                  <div className="flex items-center gap-1">
                    <FileSignature className="size-3 shrink-0 text-primary" />
                    <span className="truncate text-[9px] font-semibold text-primary">
                      {document.signedBy}
                    </span>
                  </div>
                  <span className="font-mono text-[7px] text-primary/70">Digitally signed</span>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Source">
                {document.source === 'batch' ? (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Layers className="size-3.5 shrink-0 text-brand-teal" />
                    <span className="shrink-0">Batch</span>
                    {document.batchName && (
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-normal text-muted-foreground">
                        · {document.batchName}
                      </span>
                    )}
                  </div>
                ) : document.source === 'single' ? (
                  <div className="flex items-center gap-1.5">
                    <FileSignature className="size-3.5 shrink-0 text-primary" />
                    Single document
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </DetailRow>
              <DetailRow label="Certificate">
                <span className="block truncate font-mono text-[12px]">{document.certificate}</span>
              </DetailRow>
              <DetailRow label="Delivery">
                {document.sentTo ? (
                  <div className="flex min-w-0 items-center gap-1.5 text-success">
                    <Send className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{document.sentTo}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not sent</span>
                )}
              </DetailRow>
              <DetailRow label="Pages signed">
                <span className="block truncate font-mono text-[12px]">
                  {document.signedPages ?? `All ${document.pages} pages`}
                </span>
              </DetailRow>
            </div>

            {document.passwordProtected && (
              <div className="flex flex-col gap-2 rounded-[10px] border border-border p-4">
                <span className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                  <Lock className="size-3" />
                  Document password
                </span>
                {document.password ? (
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 min-w-0 flex-1 items-center overflow-hidden rounded-[9px] bg-secondary/60 px-3 font-mono text-[13px]">
                      <span className="truncate">
                        {showPassword ? document.password : '•'.repeat(document.password.length)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10 shrink-0 rounded-[9px] bg-secondary/60 hover:bg-secondary"
                      onClick={() => setShowPassword((s) => !s)}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10 shrink-0 rounded-[9px] bg-secondary/60 hover:bg-secondary"
                      onClick={copyPassword}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                    <KeyRound className="size-3.5 shrink-0" />
                    Password was set from an uploaded list and isn't stored here.
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-muted-foreground">
              Last updated {formatRelativeTime(document.updatedAt)}
            </div>
          </div>
        </div>

        <DialogFooter className="-mx-0 -mb-0 gap-2 rounded-b-2xl border-t border-border bg-secondary/30 px-7 py-4">
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
              className="h-10 gap-1.5 rounded-[10px] border-none bg-primary font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90"
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
                onClick={() =>
                  toast(document.sentTo ? `Resent to ${document.sentTo}` : `Preparing to send ${document.name} to client`)
                }
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
