import { Fragment, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSignature,
  FileText,
  Files,
  Layers,
  ListFilter,
  Lock,
  MoreHorizontal,
  PenLine,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { DocumentStatusBadge, documentStatusConfig } from '@/components/dashboard/status-badge'
import { DocumentDetailDialog } from '@/components/documents/document-detail-dialog'
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
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { aggregateVerifyStatus, VERIFY_STATUS_META, VERIFY_TONE_CLASSES } from '@/lib/verify-status'
import type { DocumentSource, DocumentStatus, SignedDocument } from '@/types'

// doc.certificate is stored as one string, "Holder Name (Organization)" — split it so a long
// name gets its own line instead of being cut off mid-word in a cramped single-line column.
function splitCertificate(certificate: string): { name: string; organization: string | null } {
  const match = certificate.match(/^(.*?)\s*\(([^)]*)\)\s*$/)
  if (!match) return { name: certificate, organization: null }
  return { name: match[1].trim(), organization: match[2].trim() }
}

const statusFilters: { label: string; value: DocumentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Signed', value: 'signed' },
  { label: 'Draft', value: 'draft' },
  { label: 'Expired', value: 'expired' },
]

const sourceFilters: { label: string; value: DocumentSource | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Single', value: 'single' },
  { label: 'Batch', value: 'batch' },
]

const PAGE_SIZE = 8

type Row =
  | { kind: 'single'; doc: SignedDocument }
  | { kind: 'group'; batchName: string; docs: SignedDocument[] }

function rowTime(row: Row) {
  return new Date(row.kind === 'group' ? row.docs[0].updatedAt : row.doc.updatedAt).getTime()
}

interface DocRowProps {
  doc: SignedDocument
  indented?: boolean
  onOpenDetail: (doc: SignedDocument) => void
  onVerify: (doc: SignedDocument) => void
  onResume: (doc: SignedDocument) => void
}

function DocRow({ doc, indented, onOpenDetail, onVerify, onResume }: DocRowProps) {
  const unfinished = doc.status === 'draft'
  return (
    <TableRow className={cn('border-border hover:bg-secondary/30', indented && 'bg-secondary/10')}>
      <TableCell className={cn('py-3.5 pl-6', indented && 'pl-14')}>
        <button
          type="button"
          onClick={() => onOpenDetail(doc)}
          className="flex items-center gap-3 rounded-[10px] text-left transition-opacity hover:opacity-75"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent">
            <FileText className="size-4 text-primary" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="max-w-56 truncate text-[12.5px] font-semibold">{doc.name}</span>
            <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
              {doc.pages} pages
              {doc.passwordProtected ? ' · protected' : ''}
              {doc.passwordProtected && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Lock className="size-2.5 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>Password protected — click to view</TooltipContent>
                </Tooltip>
              )}
            </span>
          </div>
        </button>
      </TableCell>
      <TableCell className="py-3.5">
        <DocumentStatusBadge status={doc.status} />
      </TableCell>
      <TableCell className="max-w-48 py-3.5">
        {doc.certificate === '—' ? (
          <span className="text-[12.5px] text-muted-foreground/50">—</span>
        ) : (
          (() => {
            const { name, organization } = splitCertificate(doc.certificate)
            return (
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[12.5px] font-medium" title={name}>
                  {name}
                </span>
                {organization && (
                  <span className="truncate font-mono text-[10.5px] text-muted-foreground" title={organization}>
                    {organization}
                  </span>
                )}
              </div>
            )
          })()
        )}
      </TableCell>
      <TableCell className="py-3.5">
        {doc.status === 'signed' ? (
          doc.sentTo ? (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[11.5px] font-semibold text-success">
              <Send className="size-3" />
              Sent
            </span>
          ) : (
            <span className="inline-flex w-fit items-center rounded-full bg-secondary px-2 py-1 text-[11.5px] font-semibold text-muted-foreground">
              Not sent
            </span>
          )
        ) : (
          <span className="text-[12.5px] text-muted-foreground/50">—</span>
        )}
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
                onClick={() => onOpenDetail(doc)}
              >
                <Eye className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View details</TooltipContent>
          </Tooltip>
          {unfinished ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-[9px] bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => onResume(doc)}
                >
                  <PenLine className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Resume signing</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                {doc.lastVerifiedStatus ? (
                  (() => {
                    const meta = VERIFY_STATUS_META[doc.lastVerifiedStatus]
                    const tone = VERIFY_TONE_CLASSES[meta.tone]
                    const VerifiedIcon = meta.icon
                    return (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn('size-9 rounded-[9px] hover:opacity-80', tone.iconBg)}
                        onClick={() => onVerify(doc)}
                      >
                        <VerifiedIcon className="size-4" />
                      </Button>
                    )
                  })()
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-[9px] bg-primary/10 text-primary hover:bg-primary/15"
                    onClick={() => onVerify(doc)}
                  >
                    <ShieldCheck className="size-4" />
                  </Button>
                )}
              </TooltipTrigger>
              <TooltipContent>
                {doc.lastVerifiedStatus
                  ? `${VERIFY_STATUS_META[doc.lastVerifiedStatus].label} · verified ${formatRelativeTime(doc.lastVerifiedAt!)}`
                  : 'Verify signature'}
              </TooltipContent>
            </Tooltip>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-[9px] bg-secondary/60 hover:bg-secondary"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toast(`Downloading ${doc.name}`)}>
                <Download />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  toast(doc.sentTo ? `Resent to ${doc.sentTo}` : `Preparing to send ${doc.name} to client`)
                }
              >
                <Send />
                {doc.sentTo ? 'Resend' : 'Send to client'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function AllDocumentsPage() {
  const navigate = useNavigate()
  const { documents } = useDocuments()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<DocumentStatus | 'all'>('all')
  const [source, setSource] = useState<DocumentSource | 'all'>('all')
  const [page, setPage] = useState(0)
  const [activeDoc, setActiveDoc] = useState<SignedDocument | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function handleVerify(doc: SignedDocument) {
    navigate('/verify', { state: { documents: [doc] } })
  }

  function handleVerifyAll(docs: SignedDocument[]) {
    navigate('/verify', { state: { documents: docs } })
  }

  function handleResume(doc: SignedDocument) {
    navigate('/sign', { state: { resumeDocument: doc } })
  }

  const statusCounts = useMemo(() => {
    const counts: Record<DocumentStatus | 'all', number> = {
      all: documents.length,
      signed: 0,
      draft: 0,
      expired: 0,
    }
    for (const doc of documents) counts[doc.status] += 1
    return counts
  }, [documents])

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      const matchesStatus = status === 'all' || doc.status === status
      const matchesSource = source === 'all' || doc.source === source
      const matchesQuery =
        query.trim().length === 0 ||
        doc.name.toLowerCase().includes(query.toLowerCase()) ||
        doc.client.toLowerCase().includes(query.toLowerCase())
      return matchesStatus && matchesSource && matchesQuery
    })
  }, [documents, query, status, source])

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
      if (docs.length > 1) {
        const sorted = [...docs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        result.push({ kind: 'group', batchName, docs: sorted })
      } else {
        result.push({ kind: 'single', doc: docs[0] })
      }
    }
    for (const doc of singles) {
      result.push({ kind: 'single', doc })
    }
    result.sort((a, b) => rowTime(b) - rowTime(a))
    return result
  }, [filtered])

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageItems = rows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  const activeStatusFilter = statusFilters.find((filter) => filter.value === status) ?? statusFilters[0]
  const ActiveStatusIcon = status === 'all' ? null : documentStatusConfig[status]?.icon
  const activeSourceFilter = sourceFilters.find((filter) => filter.value === source) ?? sourceFilters[0]

  function updateStatus(value: DocumentStatus | 'all') {
    setStatus(value)
    setPage(0)
  }

  function updateSource(value: DocumentSource | 'all') {
    setSource(value)
    setPage(0)
  }

  function updateQuery(value: string) {
    setQuery(value)
    setPage(0)
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
        title="All documents"
        description="Every document across your firm — signed, sent or drafted."
        icon={Files}
      />

      <Card className="gap-0 overflow-hidden rounded-2xl border border-border py-0 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
              placeholder="Search by document or client…"
              className="h-10 rounded-[10px] bg-secondary/60 pl-10"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 gap-1.5 rounded-[10px] border-border bg-secondary/60 px-3.5 text-[12.5px] font-semibold text-foreground hover:bg-secondary"
                >
                  {ActiveStatusIcon ? (
                    <ActiveStatusIcon className="size-3.5 text-muted-foreground" />
                  ) : (
                    <ListFilter className="size-3.5 text-muted-foreground" />
                  )}
                  <span className="font-normal text-muted-foreground">Status</span>
                  {activeStatusFilter.label}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuRadioGroup
                  value={status}
                  onValueChange={(value) => updateStatus(value as DocumentStatus | 'all')}
                >
                  {statusFilters.map((filter) => {
                    const config = filter.value === 'all' ? null : documentStatusConfig[filter.value]
                    const Icon = config?.icon
                    return (
                      <DropdownMenuRadioItem key={filter.value} value={filter.value} className="justify-between pr-7">
                        <span className="flex items-center gap-2">
                          {Icon && <Icon className="size-3.5 text-muted-foreground" />}
                          {filter.label}
                        </span>
                        <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                          {statusCounts[filter.value]}
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
                  {activeSourceFilter.value === 'batch' && <Layers className="size-3.5 text-muted-foreground" />}
                  {activeSourceFilter.value === 'single' && (
                    <FileSignature className="size-3.5 text-muted-foreground" />
                  )}
                  {activeSourceFilter.value === 'all' && <ListFilter className="size-3.5 text-muted-foreground" />}
                  <span className="font-normal text-muted-foreground">Signed via</span>
                  {activeSourceFilter.label}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuRadioGroup
                  value={source}
                  onValueChange={(value) => updateSource(value as DocumentSource | 'all')}
                >
                  {sourceFilters.map((filter) => (
                    <DropdownMenuRadioItem key={filter.value} value={filter.value}>
                      {filter.value === 'batch' && <Layers className="size-3.5 text-muted-foreground" />}
                      {filter.value === 'single' && <FileSignature className="size-3.5 text-muted-foreground" />}
                      {filter.value === 'all' && <ListFilter className="size-3.5 text-muted-foreground" />}
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
                    Status
                  </TableHead>
                  <TableHead className="h-11 text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                    Certificate
                  </TableHead>
                  <TableHead className="h-11 text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                    Delivery
                  </TableHead>
                  <TableHead className="h-11 text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                    Updated
                  </TableHead>
                  <TableHead className="h-11 pr-6 text-right text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.length === 0 && (
                  <TableRow className="border-border hover:bg-transparent">
                    <TableCell colSpan={6} className="py-16 text-center text-[13px] text-muted-foreground">
                      No documents match your filters.
                    </TableCell>
                  </TableRow>
                )}
                {pageItems.map((row) => {
                  if (row.kind === 'single') {
                    return (
                      <DocRow
                        key={row.doc.id}
                        doc={row.doc}
                        onOpenDetail={setActiveDoc}
                        onVerify={handleVerify}
                        onResume={handleResume}
                      />
                    )
                  }

                  const { batchName, docs } = row
                  const isOpen = expanded.has(batchName)
                  const sentCount = docs.filter((d) => d.sentTo).length
                  const totalPages = docs.reduce((sum, d) => sum + d.pages, 0)
                  const groupVerifyStatus = aggregateVerifyStatus(docs.map((d) => d.lastVerifiedStatus))
                  const lastVerifiedAt = groupVerifyStatus
                    ? docs.reduce((latest, d) => (d.lastVerifiedAt && d.lastVerifiedAt > latest ? d.lastVerifiedAt : latest), '')
                    : null

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
                        <TableCell className="py-3.5">
                          <DocumentStatusBadge status={docs[0].status} />
                        </TableCell>
                        <TableCell className="max-w-44 truncate py-3.5 font-mono text-xs text-muted-foreground">
                          {docs[0].certificate}
                        </TableCell>
                        <TableCell className="py-3.5">
                          {sentCount === 0 ? (
                            <span className="inline-flex w-fit items-center rounded-full bg-secondary px-2 py-1 text-[11.5px] font-semibold text-muted-foreground">
                              Not sent
                            </span>
                          ) : sentCount === docs.length ? (
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[11.5px] font-semibold text-success">
                              <Send className="size-3" />
                              Sent
                            </span>
                          ) : (
                            <span className="inline-flex w-fit items-center rounded-full bg-warning/12 px-2 py-1 text-[11.5px] font-semibold text-warning">
                              {sentCount}/{docs.length} sent
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
                                {groupVerifyStatus ? (
                                  (() => {
                                    const meta = VERIFY_STATUS_META[groupVerifyStatus]
                                    const tone = VERIFY_TONE_CLASSES[meta.tone]
                                    const GroupVerifiedIcon = meta.icon
                                    return (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn('size-9 rounded-[9px] hover:opacity-80', tone.iconBg)}
                                        onClick={() => handleVerifyAll(docs)}
                                      >
                                        <GroupVerifiedIcon className="size-4" />
                                      </Button>
                                    )
                                  })()
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-9 rounded-[9px] bg-primary/10 text-primary hover:bg-primary/15"
                                    onClick={() => handleVerifyAll(docs)}
                                  >
                                    <ShieldCheck className="size-4" />
                                  </Button>
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                {groupVerifyStatus
                                  ? `All ${docs.length} files verified — ${VERIFY_STATUS_META[groupVerifyStatus].label}${lastVerifiedAt ? ` · ${formatRelativeTime(lastVerifiedAt)}` : ''}`
                                  : `Verify all ${docs.length} files`}
                              </TooltipContent>
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
                          <DocRow
                            key={doc.id}
                            doc={doc}
                            indented
                            onOpenDetail={setActiveDoc}
                            onVerify={handleVerify}
                            onResume={handleResume}
                          />
                        ))}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <span className="text-[12px] text-muted-foreground">
            Showing{' '}
            <span className="font-semibold text-foreground">
              {rows.length === 0 ? 0 : currentPage * PAGE_SIZE + 1}-
              {Math.min(rows.length, currentPage * PAGE_SIZE + PAGE_SIZE)}
            </span>{' '}
            of <span className="font-semibold text-foreground">{rows.length}</span>
          </span>
          <div className={cn('flex items-center gap-2', pageCount <= 1 && 'opacity-40')}>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-[9px] bg-secondary/60 hover:bg-secondary disabled:opacity-40"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="font-mono text-[12px] text-muted-foreground">
              {currentPage + 1} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-[9px] bg-secondary/60 hover:bg-secondary disabled:opacity-40"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </Card>

      <DocumentDetailDialog
        document={activeDoc}
        open={activeDoc !== null}
        onOpenChange={(open) => !open && setActiveDoc(null)}
      />
    </div>
  )
}
