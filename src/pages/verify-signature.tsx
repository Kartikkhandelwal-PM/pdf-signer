import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  FileCheck2,
  FileQuestion,
  FileSearch,
  FileText,
  Fingerprint,
  KeyRound,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  UserRound,
  X,
} from 'lucide-react'
import { useLocation } from 'react-router-dom'

import { FileDropzone } from '@/components/shared/file-dropzone'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { useDocuments } from '@/context/documents-context'
import { VERIFY_STATUS_META, VERIFY_TONE_CLASSES, type VerifyTone } from '@/lib/verify-status'
import { cn } from '@/lib/utils'
import type { SignedDocument, VerifyStatus } from '@/types'

interface VerifyFile {
  id: string
  file: File
  progress: number
}

interface VerifyResult {
  id: string
  fileName: string
  status: VerifyStatus
  signer?: string
  organization?: string
  issuer?: string
  serialNumber?: string
  signedAt?: string
  reason: string
}

const STATUS_META = VERIFY_STATUS_META
const TONE_CLASSES = VERIFY_TONE_CLASSES
type ResultTone = VerifyTone

// Same cryptographic-verification checklist language as the signing flow's own steps, mirrored
// for the reverse operation — reading, chain of trust, signature match, then integrity.
const VERIFY_STAGES = [
  { label: 'Reading document', icon: FileSearch },
  { label: 'Checking certificate chain', icon: ShieldCheck },
  { label: 'Verifying signature', icon: KeyRound },
  { label: 'Checking document integrity', icon: FileCheck2 },
] as const

function randomSerial() {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()).join(' ')
}

function truncateMiddle(name: string, max = 34) {
  if (name.length <= max) return name
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : ''
  const base = ext ? name.slice(0, -ext.length) : name
  const keep = max - ext.length - 1
  if (keep <= 2) return `${name.slice(0, max - 1)}…`
  const head = Math.ceil(keep * 0.65)
  const tail = keep - head
  return `${base.slice(0, head)}…${tail > 0 ? base.slice(-tail) : ''}${ext}`
}

// A signature can fail verification in several distinct, realistic ways — not just "tampered".
// checksForStatus reflects each one: an expired or revoked certificate still has an intact
// signature over an unmodified document, it's the trust chain that's the problem.
function checksForStatus(status: VerifyStatus): { label: string; ok: boolean }[] {
  switch (status) {
    case 'valid':
      return [
        { label: 'Certificate trusted', ok: true },
        { label: 'Signature matches document', ok: true },
        { label: 'Document unmodified', ok: true },
        { label: 'Timestamp valid', ok: true },
      ]
    case 'invalid':
      return [
        { label: 'Certificate trusted', ok: true },
        { label: 'Signature matches document', ok: false },
        { label: 'Document unmodified', ok: false },
        { label: 'Timestamp valid', ok: true },
      ]
    case 'expired':
      return [
        { label: 'Certificate trusted', ok: false },
        { label: 'Signature matches document', ok: true },
        { label: 'Document unmodified', ok: true },
        { label: 'Timestamp valid', ok: true },
      ]
    case 'revoked':
      return [
        { label: 'Certificate trusted', ok: false },
        { label: 'Signature matches document', ok: true },
        { label: 'Document unmodified', ok: true },
        { label: 'Timestamp valid', ok: false },
      ]
    case 'unsigned':
      return []
  }
}

const REASONS: Record<Exclude<VerifyStatus, 'valid'>, string> = {
  invalid: 'This document has been modified after it was signed — the signature no longer matches the document contents.',
  unsigned: "This PDF doesn't contain a digital signature to verify.",
  expired: 'The signature itself is intact, but the signing certificate had already expired when this document was checked.',
  revoked: 'The certificate authority revoked this certificate — it can no longer be trusted, even though the signature is intact.',
}

// A single-file headline names its actual outcome — an expired certificate is not the same
// finding as a tampered document, and the hero shouldn't imply otherwise.
const SINGLE_HEADLINE: Record<VerifyStatus, string> = {
  valid: 'Signature is valid',
  invalid: 'Signature could not be verified',
  unsigned: 'No digital signature found',
  expired: 'Certificate has expired',
  revoked: 'Certificate has been revoked',
}

// This is a mock verifier — a real one would validate the embedded PKCS#7 signature and
// certificate chain against a trust store. Here, a filename hint stands in for each outcome.
function generateResult(file: File): VerifyResult {
  const name = file.name.toLowerCase()
  const id = `${file.name}-${Math.random().toString(36).slice(2, 8)}`
  let status: VerifyStatus = 'valid'
  if (/unsign|nosign/.test(name)) status = 'unsigned'
  else if (/revok/.test(name)) status = 'revoked'
  else if (/expired/.test(name)) status = 'expired'
  else if (/invalid|tamper/.test(name)) status = 'invalid'

  if (status === 'unsigned') {
    return { id, fileName: file.name, status, reason: REASONS.unsigned }
  }

  return {
    id,
    fileName: file.name,
    status,
    signer: 'Kartik Khandelwal',
    organization: 'KDK Softwares',
    issuer: '(n)Code Solutions CA 2022',
    serialNumber: randomSerial(),
    signedAt: '05 Sep 2026, 9:32 AM',
    reason: status === 'valid' ? '' : REASONS[status],
  }
}

// Verifying a document straight from All documents skips the upload+scan entirely for its
// identity — it's a real record already, not a file we need to guess about from its name.
function generateResultFromDocument(doc: SignedDocument): VerifyResult {
  const match = doc.certificate.match(/^(.*?)\s*\(([^)]*)\)\s*$/)
  const signer = match?.[1]?.trim() || doc.signedBy
  const organization = match?.[2]?.trim() || '—'
  const status: VerifyStatus =
    doc.status === 'signed' ? 'valid' : doc.status === 'expired' ? 'expired' : 'unsigned'

  if (status === 'unsigned') {
    return { id: doc.id, fileName: doc.name, status, reason: 'This document is still a draft or awaiting signature — it has not been signed yet.' }
  }

  return {
    id: doc.id,
    fileName: doc.name,
    status,
    signer,
    organization,
    issuer: '(n)Code Solutions CA 2022',
    serialNumber: randomSerial(),
    signedAt: new Date(doc.updatedAt).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    reason: status === 'valid' ? '' : REASONS[status],
  }
}

interface VerifyResultCardProps {
  result: VerifyResult
  index: number
  featured?: boolean
  expanded?: boolean
  onToggle?: () => void
}

function VerifyResultCard({ result, index, featured, expanded = true, onToggle }: VerifyResultCardProps) {
  const meta = STATUS_META[result.status]
  const tone = TONE_CLASSES[meta.tone]
  const checks = checksForStatus(result.status)
  const collapsible = onToggle !== undefined
  const StatusIcon = meta.icon

  const header = (
    <div className="flex items-center gap-3">
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-[10px]', tone.iconBg)}>
        <FileText className="size-4.5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13.5px] font-semibold" title={result.fileName}>
          {truncateMiddle(result.fileName, 48)}
        </span>
        <span className={cn('text-[11.5px] font-semibold', tone.text)}>{meta.label}</span>
      </div>
      <StatusIcon className={cn('size-5 shrink-0', tone.text)} />
      {collapsible && (
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      )}
    </div>
  )

  return (
    <div
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}
      className={cn(
        'flex animate-in flex-col fade-in-0 slide-in-from-bottom-2 duration-500',
        collapsible ? 'gap-0 overflow-hidden rounded-2xl border' : 'gap-4 rounded-2xl border p-5',
        tone.border,
        featured && 'shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)]',
      )}
    >
      {collapsible ? (
        <button type="button" onClick={onToggle} className="p-4 text-left hover:bg-secondary/30">
          {header}
        </button>
      ) : (
        header
      )}

      {expanded && (
        <div className={cn('flex flex-col gap-4', collapsible && 'px-4 pb-4 pt-1')}>
          {result.status === 'unsigned' ? (
            <div className="flex items-start gap-2.5 rounded-[10px] bg-secondary/50 p-3.5 text-[12px] text-muted-foreground">
              <FileQuestion className="mt-0.5 size-4 shrink-0" />
              {result.reason}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-[10px] bg-secondary/40 p-3.5 sm:grid-cols-2">
                {checks.map((c) => (
                  <div key={c.label} className="flex items-center gap-2 text-[11.5px]">
                    {c.ok ? (
                      <Check className="size-3.5 shrink-0 text-success" />
                    ) : (
                      <X className="size-3.5 shrink-0 text-destructive" />
                    )}
                    <span className={c.ok ? 'text-foreground' : 'text-muted-foreground'}>{c.label}</span>
                  </div>
                ))}
              </div>

              {result.status !== 'valid' && (
                <div
                  className={cn(
                    'flex items-start gap-2.5 rounded-[10px] p-3.5 text-[12px]',
                    meta.tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-destructive/5 text-destructive',
                  )}
                >
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  {result.reason}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2.5 rounded-[10px] border border-border p-3.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-primary/10">
                    <UserRound className="size-4 text-primary" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[11px] text-muted-foreground">Signed by</span>
                    <span className="truncate text-[12.5px] font-semibold">{result.signer}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-[10px] border border-border p-3.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-brand-teal/10">
                    <Building2 className="size-4 text-brand-teal" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[11px] text-muted-foreground">Organization</span>
                    <span className="truncate text-[12.5px] font-semibold">{result.organization}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-[10px] border border-border p-3.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-success/10">
                    <ShieldCheck className="size-4 text-success" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[11px] text-muted-foreground">Certificate issuer</span>
                    <span className="truncate text-[12.5px] font-semibold">{result.issuer}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-[10px] border border-border p-3.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-brand-orange/10">
                    <Fingerprint className="size-4 text-brand-orange" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[11px] text-muted-foreground">Certificate serial</span>
                    <span className="truncate font-mono text-[12px] font-semibold">{result.serialNumber}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-[10px] border border-border p-3.5 sm:col-span-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-brand-pink/10">
                    <CalendarClock className="size-4 text-brand-pink" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[11px] text-muted-foreground">Signed at</span>
                    <span className="font-mono text-[12.5px] font-semibold">{result.signedAt}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function VerifySignaturePage() {
  const location = useLocation()
  const { markVerified } = useDocuments()
  const [phase, setPhase] = useState<'idle' | 'verifying' | 'done'>('idle')
  const [files, setFiles] = useState<VerifyFile[]>([])
  const [results, setResults] = useState<VerifyResult[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [resultQuery, setResultQuery] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Arriving from a "Verify signature" / "Verify all" action on real documents (All documents)
  // — those documents' own identity drives the check, one or many, so a real File to upload
  // isn't needed either way.
  useEffect(() => {
    const linkedDocs = (location.state as { documents?: SignedDocument[] } | null)?.documents
    if (!linkedDocs || linkedDocs.length === 0) return

    setPhase('verifying')
    setFiles(linkedDocs.map((doc) => ({ id: doc.id, file: new File([], doc.name), progress: 0 })))
    timerRef.current = setInterval(() => {
      setFiles((prev) =>
        prev.map((f) => (f.progress >= 100 ? f : { ...f, progress: Math.min(100, f.progress + Math.random() * 26 + 14) })),
      )
    }, 350)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // Only ever react to a fresh navigation carrying documents — not to every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  useEffect(() => {
    if (phase !== 'verifying' || files.length === 0) return
    if (!files.every((f) => f.progress >= 100)) return

    if (timerRef.current) clearInterval(timerRef.current)
    const linkedDocs = (location.state as { documents?: SignedDocument[] } | null)?.documents
    const linkedById = new Map(linkedDocs?.map((doc) => [doc.id, doc]) ?? [])
    const isLinked = linkedById.size > 0 && files.every((f) => linkedById.has(f.id))
    const newResults = isLinked
      ? files.map((f) => generateResultFromDocument(linkedById.get(f.id)!))
      : files.map((f) => generateResult(f.file))
    if (isLinked) newResults.forEach((r) => markVerified(r.id, r.status))
    setResults(newResults)
    // Collapsed by default — a single result (whether from upload or a linked document) opens
    // itself since there's nothing else to scan past.
    setExpandedIds(newResults.length === 1 ? new Set(newResults.map((r) => r.id)) : new Set())
    setPhase('done')
    // location.state is read once the scan completes, not on every progress tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, files])

  function handleFiles(newFiles: File[]) {
    const entries: VerifyFile[] = newFiles.map((f) => ({
      id: `${f.name}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      progress: 0,
    }))
    setFiles(entries)
    setResults([])
    setPhase('verifying')

    timerRef.current = setInterval(() => {
      setFiles((prev) =>
        prev.map((f) => (f.progress >= 100 ? f : { ...f, progress: Math.min(100, f.progress + Math.random() * 26 + 12) })),
      )
    }, 400)
  }

  function reset() {
    if (timerRef.current) clearInterval(timerRef.current)
    window.history.replaceState({}, '')
    setPhase('idle')
    setFiles([])
    setResults([])
    setExpandedIds(new Set())
    setResultQuery('')
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isMulti = files.length > 1
  const avgProgress = files.length > 0 ? files.reduce((sum, f) => sum + f.progress, 0) / files.length : 0
  const stageIndex = Math.min(VERIFY_STAGES.length - 1, Math.floor(avgProgress / 25))
  const ActiveStageIcon = VERIFY_STAGES[stageIndex].icon

  const validCount = results.filter((r) => r.status === 'valid').length
  const allValid = results.length > 0 && validCount === results.length
  const allInvalid = results.length > 0 && validCount === 0
  // A single result takes on its own status's real severity (an expired certificate is not the
  // same alarm level as a tampered document) — only a mixed batch falls back to the 3-way tone.
  const heroTone: ResultTone =
    results.length === 1 ? STATUS_META[results[0].status].tone : allValid ? 'success' : allInvalid ? 'destructive' : 'warning'
  const burstDots = [
    { x: -46, y: -58, color: 'var(--primary)', delay: 0 },
    { x: 50, y: -50, color: 'var(--brand-teal)', delay: 60 },
    { x: -62, y: 10, color: 'var(--brand-orange)', delay: 120 },
    { x: 60, y: 20, color: 'var(--brand-pink)', delay: 90 },
    { x: -20, y: -70, color: 'var(--success)', delay: 150 },
    { x: 24, y: -68, color: 'var(--primary)', delay: 40 },
  ]

  return (
    <div className="relative flex flex-1 flex-col gap-5 overflow-hidden p-5 sm:p-7">
      <PageHeader
        title="Verify signature"
        description="Check whether one or more signed PDFs are valid and untampered."
        icon={FileCheck2}
        action={
          phase !== 'idle' ? (
            <Button
              variant="ghost"
              className="h-9 rounded-[10px] bg-secondary px-4 text-[12.5px] font-semibold hover:bg-secondary/70"
              onClick={reset}
            >
              Verify more documents
            </Button>
          ) : undefined
        }
      />

      {phase === 'idle' && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute top-8 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-12 bottom-4 size-56 rounded-full bg-brand-teal/[0.07] blur-3xl"
          />
          <div className="relative flex flex-1 items-center justify-center">
            <FileDropzone
              multiple
              onFiles={handleFiles}
              title="Upload signed PDFs to verify"
              subtitle="We'll check each signature, certificate chain and document integrity"
            />
          </div>
        </>
      )}

      {phase === 'verifying' && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute top-10 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-16 bottom-10 size-56 rounded-full bg-brand-teal/[0.08] blur-3xl"
          />

          <div className={cn('relative flex min-h-0 flex-1', isMulti && 'grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]')}>
            <Card
              className={cn(
                'flex flex-col items-center justify-center gap-8 rounded-2xl border border-border p-8 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0',
                !isMulti && 'mx-auto w-full max-w-md',
              )}
            >
              <div className="flex animate-in flex-col items-center gap-5 fade-in-0 slide-in-from-bottom-2 text-center duration-500">
                <div className="relative flex size-28 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
                  <svg className="absolute inset-0 -rotate-90" width="112" height="112" viewBox="0 0 112 112">
                    <circle cx="56" cy="56" r="50" fill="none" stroke="currentColor" strokeWidth="4" className="text-secondary" />
                    <circle
                      cx="56"
                      cy="56"
                      r="50"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      className="text-primary"
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={1 - avgProgress / 100}
                      style={{ transition: 'stroke-dashoffset 450ms cubic-bezier(0.4,0,0.2,1)' }}
                    />
                  </svg>
                  <div
                    key={stageIndex}
                    className="flex size-16 animate-in items-center justify-center rounded-full bg-primary/10 zoom-in-50 fade-in-0 duration-300"
                  >
                    <ActiveStageIcon className="size-6 text-primary" />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-heading text-[17px] font-bold">{VERIFY_STAGES[stageIndex].label}</span>
                  <span className="text-[12.5px] text-muted-foreground">
                    {isMulti ? `${files.filter((f) => f.progress >= 100).length} of ${files.length} files checked` : truncateMiddle(files[0]?.file.name ?? '', 40)}
                  </span>
                </div>
              </div>
              <div className="flex w-full max-w-xs flex-col items-center gap-2">
                <Progress
                  value={avgProgress}
                  className="h-2 w-full [&>div]:bg-linear-to-r [&>div]:from-primary [&>div]:to-[#2f93c0]"
                />
                <span className="text-[11px] text-muted-foreground">{Math.round(avgProgress)}%</span>
              </div>
            </Card>

            {isMulti && (
              <Card className="flex min-h-0 flex-col gap-0 overflow-hidden rounded-2xl border border-border shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
                <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
                  <span className="text-[13px] font-semibold">Files</span>
                  <span className="text-[11.5px] font-semibold text-muted-foreground">{files.length} total</span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {files.map((f, index) => (
                    <div
                      key={f.id}
                      className={cn(
                        'flex animate-in items-center gap-3 px-5 py-3 fade-in-0 slide-in-from-left-1 duration-300',
                        index > 0 && 'border-t border-border',
                      )}
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-accent">
                        <FileText className="size-3.5 text-primary" />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium" title={f.file.name}>
                        {truncateMiddle(f.file.name, 40)}
                      </span>
                      <div className="w-28 shrink-0">
                        <Progress
                          value={f.progress}
                          className={cn('h-1.5', f.progress >= 100 ? '[&>div]:bg-success' : '[&>div]:bg-primary')}
                        />
                      </div>
                      {f.progress >= 100 ? (
                        <ShieldCheck className="size-4 shrink-0 text-success" />
                      ) : (
                        <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      {phase === 'done' && results.length > 0 && (
        <div className="relative flex flex-1 flex-col gap-6 overflow-y-auto">
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute top-0 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full blur-3xl',
              heroTone === 'success' && 'bg-success/[0.07]',
              heroTone === 'destructive' && 'bg-destructive/[0.06]',
              heroTone === 'warning' && 'bg-warning/[0.07]',
            )}
          />

          <div className="relative flex animate-in flex-col items-center gap-3 fade-in-0 zoom-in-95 pt-2 text-center duration-500">
            <div className="relative flex size-20 items-center justify-center">
              {heroTone === 'success' && (
                <>
                  <div className="absolute inset-0 animate-pulse rounded-full bg-success/15 blur-lg" />
                  {burstDots.map((dot, i) => (
                    <span
                      key={i}
                      aria-hidden
                      style={
                        {
                          '--burst-x': `${dot.x}px`,
                          '--burst-y': `${dot.y}px`,
                          background: dot.color,
                          animationDelay: `${dot.delay}ms`,
                        } as CSSProperties
                      }
                      className="absolute top-1/2 left-1/2 size-1.5 rounded-full opacity-0 [animation:burst-out_0.7s_ease-out_forwards]"
                    />
                  ))}
                </>
              )}
              {heroTone === 'success' || heroTone === 'destructive' ? (
                <svg
                  width="72"
                  height="72"
                  viewBox="0 0 72 72"
                  fill="none"
                  className={cn('relative', heroTone === 'success' ? 'text-success' : 'text-destructive')}
                >
                  <circle cx="36" cy="36" r="32" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
                  <circle
                    cx="36"
                    cy="36"
                    r="32"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={1}
                    className="[animation:stroke-draw_0.6s_ease-out_forwards]"
                  />
                  {heroTone === 'success' ? (
                    <path
                      d="M22 37 L31 46 L50 25"
                      stroke="currentColor"
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={1}
                      className="[animation:stroke-draw_0.35s_ease-out_0.55s_forwards]"
                    />
                  ) : (
                    <>
                      <path
                        d="M25 25 L47 47"
                        stroke="currentColor"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        pathLength={1}
                        strokeDasharray={1}
                        strokeDashoffset={1}
                        className="[animation:stroke-draw_0.3s_ease-out_0.55s_forwards]"
                      />
                      <path
                        d="M47 25 L25 47"
                        stroke="currentColor"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        pathLength={1}
                        strokeDasharray={1}
                        strokeDashoffset={1}
                        className="[animation:stroke-draw_0.3s_ease-out_0.75s_forwards]"
                      />
                    </>
                  )}
                </svg>
              ) : (
                <div
                  className={cn(
                    'flex size-20 animate-in items-center justify-center rounded-full zoom-in-50 fade-in-0 duration-500',
                    TONE_CLASSES[heroTone].iconBg,
                  )}
                >
                  {(() => {
                    const HeroIcon = results.length === 1 ? STATUS_META[results[0].status].icon : ShieldQuestion
                    return <HeroIcon className={cn('size-8', TONE_CLASSES[heroTone].text)} />
                  })()}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-heading text-[19px] font-bold">
                {results.length === 1
                  ? SINGLE_HEADLINE[results[0].status]
                  : allValid
                    ? `All ${results.length} signatures are valid`
                    : allInvalid
                      ? `None of the ${results.length} signatures are valid`
                      : `${validCount} of ${results.length} signatures are valid`}
              </span>
              <span className="max-w-md text-[13px] text-muted-foreground">
                {results.length === 1
                  ? results[0].status === 'valid'
                    ? 'This document has a trusted digital signature and has not been modified since signing.'
                    : results[0].reason
                  : 'Every file was checked against its embedded certificate chain and signature.'}
              </span>
            </div>
          </div>

          {results.length > 1 && (
            <div className="relative flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={resultQuery}
                  onChange={(e) => setResultQuery(e.target.value)}
                  placeholder="Search files…"
                  className="h-9 rounded-[8px] bg-secondary/60 pl-8 text-[12px]"
                />
              </div>
              <div className="flex shrink-0 items-center gap-3 text-[11.5px] font-semibold">
                <span className="text-success">{validCount} valid</span>
                <span className="text-destructive">{results.length - validCount} to review</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="ghost"
                  className="h-8 rounded-[8px] bg-secondary px-3 text-[11.5px] font-semibold hover:bg-secondary/70"
                  onClick={() => setExpandedIds(new Set(results.map((r) => r.id)))}
                >
                  Expand all
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 rounded-[8px] bg-secondary px-3 text-[11.5px] font-semibold hover:bg-secondary/70"
                  onClick={() => setExpandedIds(new Set())}
                >
                  Collapse all
                </Button>
              </div>
            </div>
          )}

          <div className={cn('relative flex flex-col gap-4', results.length === 1 && 'mx-auto w-full max-w-2xl')}>
            {results
              .filter((r) => r.fileName.toLowerCase().includes(resultQuery.trim().toLowerCase()))
              .map((result, index) =>
                results.length === 1 ? (
                  <VerifyResultCard key={result.id} result={result} index={index} featured />
                ) : (
                  <VerifyResultCard
                    key={result.id}
                    result={result}
                    index={index}
                    expanded={expandedIds.has(result.id)}
                    onToggle={() => toggleExpanded(result.id)}
                  />
                ),
              )}
          </div>
        </div>
      )}
    </div>
  )
}
