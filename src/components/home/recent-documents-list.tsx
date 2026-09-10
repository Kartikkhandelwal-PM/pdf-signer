import { FileSignature, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DocumentStatusBadge } from '@/components/dashboard/status-badge'
import { useDocuments } from '@/context/documents-context'
import { formatRelativeTime } from '@/lib/format'

export function RecentDocumentsList() {
  const navigate = useNavigate()
  const { documents } = useDocuments()
  const recentDocuments = documents.slice(0, 5)

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl border border-border py-0 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
      <CardHeader className="gap-1.5 border-b border-border py-5.5">
        <CardTitle className="text-[15.5px] font-semibold">Recent documents</CardTitle>
        <CardDescription className="text-[12.5px]">
          Your latest activity, at a glance
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
      <CardContent className="divide-y divide-border px-0">
        {recentDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileSignature className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[13.5px] font-semibold">No documents yet</span>
              <span className="text-[12px] text-muted-foreground">
                Sign your first document and it'll show up here.
              </span>
            </div>
          </div>
        ) : (
          recentDocuments.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => navigate('/documents')}
              className="flex w-full items-center gap-3 px-6 py-3.5 text-left transition-colors hover:bg-secondary/40"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent">
                <FileText className="size-4 text-primary" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[12.5px] font-semibold">{doc.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">{doc.client}</span>
              </div>
              <DocumentStatusBadge status={doc.status} />
              <span className="w-16 shrink-0 text-right font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                {formatRelativeTime(doc.updatedAt)}
              </span>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  )
}
