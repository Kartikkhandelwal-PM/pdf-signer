import { KeyRound, ListChecks, Upload } from 'lucide-react'
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
import { Progress } from '@/components/ui/progress'
import { batchJobs } from '@/data/mock'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/format'
import type { BatchJob } from '@/types'
import { BatchStatusBadge } from './status-badge'

const passwordModeConfig: Record<BatchJob['passwordMode'], { label: string; icon: typeof KeyRound }> = {
  common: { label: 'Common password', icon: KeyRound },
  custom: { label: 'Custom per file', icon: ListChecks },
  'uploaded-list': { label: 'Uploaded list', icon: Upload },
}

export function BatchPanel() {
  const navigate = useNavigate()

  return (
    <Card className="gap-4 rounded-2xl border border-border py-5 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
      <CardHeader className="px-5">
        <CardTitle className="text-[15px] font-semibold">Batch signing jobs</CardTitle>
        <CardDescription className="text-[12.5px]">Bulk PDFs in the pipeline</CardDescription>
        <CardAction>
          <Button
            size="sm"
            className="h-8 rounded-[10px] bg-secondary px-4 font-semibold text-primary shadow-none hover:bg-secondary/70"
            onClick={() => navigate('/sign')}
          >
            New batch
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4.5 px-5">
        {batchJobs.map((job, index) => {
          const percent = Math.round((job.completedFiles / job.totalFiles) * 100)
          const mode = passwordModeConfig[job.passwordMode]
          return (
            <div
              key={job.id}
              className={cn(
                'flex flex-col gap-2.5',
                index > 0 && 'border-t border-border pt-4.5',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[13px] font-semibold">{job.name}</span>
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                    <mode.icon className="size-3" />
                    {mode.label} · {formatRelativeTime(job.createdAt)}
                  </span>
                </div>
                <BatchStatusBadge status={job.status} />
              </div>
              <div className="flex items-center gap-3">
                <Progress
                  value={percent}
                  className={cn(
                    'h-1.5',
                    job.status === 'processing' && '[&>div]:bg-primary',
                    job.status === 'completed' && '[&>div]:bg-success',
                    job.status === 'queued' && '[&>div]:bg-muted-foreground/40',
                  )}
                />
                <span className="w-12 shrink-0 text-right font-mono text-[11px] font-semibold text-muted-foreground tabular-nums">
                  {job.completedFiles}/{job.totalFiles}
                </span>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
