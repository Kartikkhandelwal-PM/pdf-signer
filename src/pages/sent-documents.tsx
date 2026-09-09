import { Fragment, useMemo, useState } from 'react'
import {
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileText,
  Layers,
  Lock,
  MailCheck,
  MailOpen,
  MoreHorizontal,
  RotateCw,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import type { SignedDocument } from '@/types'

type DeliveryStatus = 'delivered' | 'opened' | 'downloaded'

const deliveryConfig: Record<DeliveryStatus, { label: string; icon: typeof MailCheck; className: string }> = {
  delivered: { label: 'Delivered', icon: Send, className: 'bg-secondary text-muted-foreground' },
  opened: { label: 'Opened', icon: MailOpen, className: 'bg-primary/10 text-primary' },
  downloaded: { label: 'Downloaded', icon: MailCheck, className: 'bg-success/10 text-success' },
}

function deliveryStatusFor(id: string): DeliveryStatus {
  const statuses: DeliveryStatus[] = ['downloaded', 'opened', 'delivered']
  const hash = Array.from(id).reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return statuses[hash % statuses.length]
}

type Row = { kind: 'single'; doc: SignedDocument } | { kind: 'group'; batchName: string; docs: SignedDocument[] }

interface SentRowProps {
  doc: SignedDocument
  indented?: boolean
}

function SentRow({ doc, indented }: SentRowProps) {
  const status = deliveryStatusFor(doc.id)
  const config = deliveryConfig[status]
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
        {doc.sentTo}
      </TableCell>
      <TableCell className="py-3.5">
        <span
          className={cn(
            'inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-semibold',
            config.className,
          )}
        >
          <config.icon className="size-3" />
          {config.label}
        </span>
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
                onClick={() => toast(`Opening preview — ${doc.name}`)}
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
              <DropdownMenuItem onClick={() => toast(`Resent to ${doc.sentTo}`)}>
                <RotateCw />
                Resend
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

  // A batch send can go to one shared email or, via the per-file CSV, a different recipient
  // per file — either way, the files that went out together should read as one send, not as
  // unrelated rows that happen to share a batch name.
  const rows = useMemo(() => {
    const sent = documents.filter((doc) => doc.sentTo)
    const byBatch = new Map<string, SignedDocument[]>()
    const singles: SignedDocument[] = []
    for (const doc of sent) {
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
  }, [documents])

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
                    <TableCell colSpan={5} className="py-16 text-center text-[13px] text-muted-foreground">
                      Nothing's been sent yet.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => {
                  if (row.kind === 'single') {
                    return <SentRow key={row.doc.id} doc={row.doc} />
                  }

                  const { batchName, docs } = row
                  const isOpen = expanded.has(batchName)
                  const recipients = new Set(docs.map((d) => d.sentTo))
                  const recipientLabel =
                    recipients.size === 1 ? docs[0].sentTo : `${recipients.size} recipients`
                  const totalPages = docs.reduce((sum, d) => sum + d.pages, 0)

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
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[11.5px] font-semibold text-muted-foreground">
                            <Send className="size-3" />
                            {docs.length} sent
                          </span>
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
                                  onClick={() =>
                                    toast(
                                      recipients.size === 1
                                        ? `Resent to ${docs[0].sentTo}`
                                        : `Resent to ${recipients.size} recipients`,
                                    )
                                  }
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
                      {isOpen && docs.map((doc) => <SentRow key={doc.id} doc={doc} indented />)}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
