import { Fragment, useMemo, useState } from 'react'
import {
  CalendarClock,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileText,
  Layers,
  ListFilter,
  Lock,
  MailCheck,
  MailOpen,
  MailX,
  MoreHorizontal,
  RotateCw,
  Search,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'

import { DocumentPreviewDialog } from '@/components/documents/document-preview-dialog'
import { SendDialog } from '@/components/documents/send-dialog'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDocuments } from '@/context/documents-context'
import { formatRelativeTime, NOW } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DeliveryStatus, SignedDocument } from '@/types'

const deliveryConfig: Record<DeliveryStatus, { label: string; icon: typeof MailCheck; className: string }> = {
  sent: { label: 'Sent', icon: Send, className: 'bg-secondary text-muted-foreground' },
  delivered: { label: 'Delivered', icon: MailCheck, className: 'bg-secondary text-secondary-foreground' },
  opened: { label: 'Opened', icon: MailOpen, className: 'bg-primary/10 text-primary' },
  downloaded: { label: 'Downloaded', icon: Download, className: 'bg-success/12 text-success' },
  failed: { label: 'Failed', icon: MailX, className: 'bg-destructive/10 text-destructive' },
}

const deliveryFilters: { value: DeliveryStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'opened', label: 'Opened' },
  { value: 'downloaded', label: 'Downloaded' },
  { value: 'failed', label: 'Failed' },
]

type Period = 'all' | '7d' | '30d' | '90d'

const periodFilters: { value: Period; label: string; days: number | null }[] = [
  { value: 'all', label: 'Any time', days: null },
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 3 months', days: 90 },
]

/** Anything sent before this app existed defaults to "sent" — handed to the relay, nothing back yet. */
function deliveryOf(doc: SignedDocument): DeliveryStatus {
  return doc.deliveryStatus ?? 'sent'
}

function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  const config = deliveryConfig[status]
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-semibold',
        config.className,
      )}
    >
      <config.icon className="size-3" />
      {config.label}
    </span>
  )
}

type Row = { kind: 'single'; doc: SignedDocument } | { kind: 'group'; batchName: string; docs: SignedDocument[] }

interface SentRowProps {
  doc: SignedDocument
  indented?: boolean
  onResend: (doc: SignedDocument) => void
  onPreview: (doc: SignedDocument) => void
}

function SentRow({ doc, indented, onResend, onPreview }: SentRowProps) {
  return (
    <TableRow className={cn('border-border', indented && 'bg-secondary/10 hover:bg-secondary/20')}>
      <TableCell className={cn('py-3.5 pl-6', indented && 'pl-14')}>
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent">
            <FileText className="size-4 text-primary" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="max-w-64 truncate text-[12.5px] font-semibold">{doc.name}</span>
            <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
              {doc.pages} pages
              {doc.passwordProtected ? ' · protected' : ''}
              {doc.passwordProtected && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Lock className="size-2.5 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>Password protected</TooltipContent>
                </Tooltip>
              )}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="max-w-56 truncate py-3.5 font-mono text-[12px] text-secondary-foreground">
        {doc.recipientName ? `${doc.recipientName} · ${doc.sentTo}` : doc.sentTo}
      </TableCell>
      <TableCell className="py-3.5">
        <DeliveryBadge status={deliveryOf(doc)} />
      </TableCell>
      <TableCell className="py-3.5 font-mono text-[11.5px] whitespace-nowrap text-muted-foreground">
        {formatRelativeTime(doc.updatedAt)}
      </TableCell>
      <TableCell className="py-3.5 pr-6">
        <div className="flex items-center justify-end gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-[9px] bg-secondary/60 hover:bg-secondary"
                onClick={() => onPreview(doc)}
              >
                <Eye className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Preview</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9 rounded-[9px] bg-secondary/60 hover:bg-secondary">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onResend(doc)}>
                <RotateCw />
                {deliveryOf(doc) === 'failed' ? 'Try again' : 'Resend'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast('Link copied to clipboard')}>
                <Copy />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast(`Downloading ${doc.name}`)}>
                <Download />
                Download
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function SentDocumentsPage() {
  const { documents } = useDocuments()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [sendTargets, setSendTargets] = useState<SignedDocument[] | null>(null)
  const [previewDoc, setPreviewDoc] = useState<SignedDocument | null>(null)
  const [query, setQuery] = useState('')
  const [delivery, setDelivery] = useState<DeliveryStatus | 'all'>('all')
  const [period, setPeriod] = useState<Period>('all')

  const sent = useMemo(() => documents.filter((doc) => doc.sentTo), [documents])

  // Counts come from everything sent, not the current result, so the numbers next to each
  // filter don't shift as you narrow things down.
  const deliveryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: sent.length }
    for (const filter of deliveryFilters) {
      if (filter.value !== 'all') counts[filter.value] = 0
    }
    for (const doc of sent) counts[deliveryOf(doc)] += 1
    return counts
  }, [sent])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const days = periodFilters.find((filter) => filter.value === period)?.days ?? null
    const cutoff = days === null ? null : NOW.getTime() - days * 24 * 60 * 60 * 1000
    return sent.filter((doc) => {
      const matchesDelivery = delivery === 'all' || deliveryOf(doc) === delivery
      const matchesPeriod = cutoff === null || new Date(doc.updatedAt).getTime() >= cutoff
      const matchesQuery =
        needle.length === 0 ||
        doc.name.toLowerCase().includes(needle) ||
        (doc.sentTo?.toLowerCase().includes(needle) ?? false) ||
        (doc.recipientName?.toLowerCase().includes(needle) ?? false) ||
        (doc.batchName?.toLowerCase().includes(needle) ?? false)
      return matchesDelivery && matchesPeriod && matchesQuery
    })
  }, [sent, query, delivery, period])

  // A batch send can go to one shared email or, via the per-file list, a different recipient
  // per file — either way, the files that went out together should read as one send, not as
  // unrelated rows that happen to share a batch name.
  const rows = useMemo(() => {
    const byBatch = new Map<string, SignedDocument[]>()
    const singles: SignedDocument[] = []
    for (const doc of filtered) {
      if (doc.source === 'batch' && doc.batchName) {
        const list = byBatch.get(doc.batchName) ?? []
        list.push(doc)
        byBatch.set(doc.batchName, list)
      } else {
        singles.push(doc)
      }
    }
    const result: Row[] = []
    for (const [batchName, docs] of byBatch) {
      const sorted = [...docs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      if (sorted.length > 1) result.push({ kind: 'group', batchName, docs: sorted })
      else result.push({ kind: 'single', doc: sorted[0] })
    }
    for (const doc of singles) {
      result.push({ kind: 'single', doc })
    }
    result.sort((a, b) => {
      const aTime = new Date(a.kind === 'group' ? a.docs[0].updatedAt : a.doc.updatedAt).getTime()
      const bTime = new Date(b.kind === 'group' ? b.docs[0].updatedAt : b.doc.updatedAt).getTime()
      return bTime - aTime
    })
    return result
  }, [filtered])

  const filtersActive = query.trim().length > 0 || delivery !== 'all' || period !== 'all'
  const activeDeliveryLabel = deliveryFilters.find((f) => f.value === delivery)?.label ?? 'All'
  const activePeriodLabel = periodFilters.find((f) => f.value === period)?.label ?? 'Any time'

  function clearFilters() {
    setQuery('')
    setDelivery('all')
    setPeriod('all')
  }

  function toggleExpanded(batchName: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(batchName)) next.delete(batchName)
      else next.add(batchName)
      return next
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-5 sm:p-7">
      <PageHeader
        title="Sent documents"
        description="Track delivery, opens and downloads for documents you sent."
        icon={Send}
      />

      <Card className="gap-0 overflow-hidden rounded-2xl border border-border py-0 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search document or recipient…"
              className="h-10 rounded-[10px] bg-secondary/60 pl-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {filtersActive && (
              <Button
                variant="ghost"
                className="h-10 rounded-[10px] px-3 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
                onClick={clearFilters}
              >
                Clear
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 gap-1.5 rounded-[10px] border-border bg-secondary/60 px-3.5 text-[12.5px] font-semibold text-foreground hover:bg-secondary"
                >
                  <ListFilter className="size-3.5 text-muted-foreground" />
                  <span className="font-normal text-muted-foreground">Delivery</span>
                  {activeDeliveryLabel}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuRadioGroup
                  value={delivery}
                  onValueChange={(value) => setDelivery(value as DeliveryStatus | 'all')}
                >
                  {deliveryFilters.map((filter) => {
                    const Icon = filter.value === 'all' ? null : deliveryConfig[filter.value].icon
                    return (
                      <DropdownMenuRadioItem key={filter.value} value={filter.value} className="justify-between pr-7">
                        <span className="flex items-center gap-2">
                          {Icon && <Icon className="size-3.5 text-muted-foreground" />}
                          {filter.label}
                        </span>
                        <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                          {deliveryCounts[filter.value] ?? 0}
                        </span>
                      </DropdownMenuRadioItem>
                    )
                  })}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 gap-1.5 rounded-[10px] border-border bg-secondary/60 px-3.5 text-[12.5px] font-semibold text-foreground hover:bg-secondary"
                >
                  <CalendarClock className="size-3.5 text-muted-foreground" />
                  <span className="font-normal text-muted-foreground">Sent</span>
                  {activePeriodLabel}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuRadioGroup value={period} onValueChange={(value) => setPeriod(value as Period)}>
                  {periodFilters.map((filter) => (
                    <DropdownMenuRadioItem key={filter.value} value={filter.value} className="pr-7">
                      {filter.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="h-11 pl-6 text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                    Document
                  </TableHead>
                  <TableHead className="h-11 text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                    Sent to
                  </TableHead>
                  <TableHead className="h-11 text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                    Delivery
                  </TableHead>
                  <TableHead className="h-11 text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                    Sent
                  </TableHead>
                  <TableHead className="h-11 pr-6 text-right text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow className="border-border hover:bg-transparent">
                    <TableCell colSpan={5} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-[13px] text-muted-foreground">
                          {sent.length === 0 ? "Nothing's been sent yet." : 'No sent document matches these filters.'}
                        </span>
                        {sent.length > 0 && filtersActive && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="text-[12.5px] font-semibold text-primary hover:underline"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => {
                  if (row.kind === 'single') {
                    return (
                      <SentRow
                        key={row.doc.id}
                        doc={row.doc}
                        onResend={(doc) => setSendTargets([doc])}
                        onPreview={setPreviewDoc}
                      />
                    )
                  }

                  const { batchName, docs } = row
                  const isOpen = expanded.has(batchName)
                  const recipients = new Set(docs.map((d) => d.sentTo))
                  const recipientLabel = recipients.size === 1 ? docs[0].sentTo : `${recipients.size} recipients`
                  const totalPages = docs.reduce((sum, d) => sum + d.pages, 0)
                  const failedInBatch = docs.filter((d) => deliveryOf(d) === 'failed').length

                  return (
                    <Fragment key={batchName}>
                      <TableRow className="border-border hover:bg-secondary/30">
                        <TableCell className="py-3.5 pl-6">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(batchName)}
                            className="relative flex items-center gap-3 rounded-[10px] text-left"
                          >
                            <ChevronDown
                              className={cn(
                                'absolute top-1/2 -left-5 size-4 -translate-y-1/2 text-muted-foreground transition-transform',
                                !isOpen && '-rotate-90',
                              )}
                            />
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-teal/12">
                              <Layers className="size-4 text-brand-teal" />
                            </div>
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="max-w-56 truncate text-[12.5px] font-semibold">{batchName}</span>
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {docs.length} files · {totalPages} pages
                              </span>
                            </div>
                          </button>
                        </TableCell>
                        <TableCell className="max-w-56 truncate py-3.5 font-mono text-[12px] text-secondary-foreground">
                          {recipientLabel}
                        </TableCell>
                        <TableCell className="py-3.5">
                          {failedInBatch > 0 ? (
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[11.5px] font-semibold text-destructive">
                              <MailX className="size-3" />
                              {failedInBatch} of {docs.length} failed
                            </span>
                          ) : (
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[11.5px] font-semibold text-muted-foreground">
                              <Send className="size-3" />
                              {docs.length} sent
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5 font-mono text-[11.5px] whitespace-nowrap text-muted-foreground">
                          {formatRelativeTime(docs[0].updatedAt)}
                        </TableCell>
                        <TableCell className="py-3.5 pr-6">
                          <div className="flex items-center justify-end gap-1.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-9 rounded-[9px] bg-secondary/60 hover:bg-secondary"
                                  onClick={() => setSendTargets(docs)}
                                >
                                  <RotateCw className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Resend all</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-9 rounded-[9px] bg-secondary/60 hover:bg-secondary"
                                  onClick={() => toast(`Downloading ${docs.length} files as a ZIP archive`)}
                                >
                                  <Download className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download all</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isOpen &&
                        docs.map((doc) => (
                          <SentRow
                            key={doc.id}
                            doc={doc}
                            indented
                            onResend={(d) => setSendTargets([d])}
                            onPreview={setPreviewDoc}
                          />
                        ))}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
            <span className="font-mono text-[11.5px] text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{' '}
              <span className="font-semibold text-foreground">{sent.length}</span> sent documents
            </span>
          </div>
        )}
      </Card>

      <DocumentPreviewDialog
        document={previewDoc}
        open={previewDoc !== null}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
        onSend={(doc) => setSendTargets([doc])}
      />

      {sendTargets && (
        <SendDialog
          documents={sendTargets}
          open={sendTargets !== null}
          onOpenChange={(open) => !open && setSendTargets(null)}
        />
      )}
    </div>
  )
}
