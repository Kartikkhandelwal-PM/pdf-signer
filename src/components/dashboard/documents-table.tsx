import {
  Download,
  Eye,
  FileText,
  Lock,
  MoreHorizontal,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { DocumentStatusBadge } from './status-badge'

export function DocumentsTable() {
  const navigate = useNavigate()
  const { documents } = useDocuments()
  const recentDocuments = documents.slice(0, 6)

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl border border-border py-0 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
      <CardHeader className="gap-1.5 border-b border-border py-5.5">
        <CardTitle className="text-[15.5px] font-semibold">Recent documents</CardTitle>
        <CardDescription className="text-[12.5px]">
          Everything signed, sent or drafted across your firm
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            className="h-8 rounded-[10px] bg-secondary px-4 font-semibold text-primary shadow-none hover:bg-secondary/70"
            onClick={() => navigate('/documents')}
          >
            View all
          </Button>
        </CardAction>
      </CardHeader>
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
                  Updated
                </TableHead>
                <TableHead className="h-11 pr-6 text-right text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDocuments.map((doc) => (
                <TableRow key={doc.id} className="border-border">
                  <TableCell className="py-3.5 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent">
                        <FileText className="size-4 text-primary" />
                      </div>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="max-w-64 truncate text-[12.5px] font-semibold">
                          {doc.name}
                        </span>
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
                  <TableCell className="py-3.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <DocumentStatusBadge status={doc.status} />
                      {doc.status === 'signed' && !doc.sentTo && (
                        <span className="rounded-full bg-secondary px-2 py-1 text-[10.5px] font-semibold text-muted-foreground">
                          Not sent
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-48 truncate py-3.5 font-mono text-xs text-muted-foreground">
                    {doc.certificate}
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 rounded-[9px] bg-secondary/60 hover:bg-secondary"
                            onClick={() =>
                              toast.success(`Verifying signature — ${doc.name}`)
                            }
                          >
                            <ShieldCheck className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Verify signature</TooltipContent>
                      </Tooltip>
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
                          <DropdownMenuItem
                            onClick={() => toast(`Downloading ${doc.name}`)}
                          >
                            <Download />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              toast(`Preparing to send ${doc.name} to client`)
                            }
                          >
                            <Send />
                            Send to client
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
