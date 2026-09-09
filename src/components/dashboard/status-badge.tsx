import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { BatchStatus, CertificateStatus, DocumentStatus } from '@/types'

export const documentStatusConfig: Record<
  DocumentStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  signed: {
    label: 'Signed',
    icon: CheckCircle2,
    className: 'bg-success/11 text-success',
  },
  draft: {
    label: 'Draft',
    icon: CircleDashed,
    className: 'bg-secondary text-muted-foreground',
  },
  expired: {
    label: 'Expired',
    icon: XCircle,
    className: 'bg-destructive/11 text-destructive',
  },
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const config = documentStatusConfig[status]
  const Icon = config.icon
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-semibold',
        config.className,
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  )
}

const certificateConfig: Record<CertificateStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success/11 text-success' },
  expiring: { label: 'Expiring', className: 'bg-warning/14 text-warning' },
  expired: { label: 'Expired', className: 'bg-destructive/11 text-destructive' },
}

export function CertificateStatusBadge({ status }: { status: CertificateStatus }) {
  const config = certificateConfig[status]
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2 py-1 text-[10.5px] font-semibold',
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}

const batchConfig: Record<BatchStatus, { label: string; className: string }> = {
  processing: { label: 'Processing', className: 'bg-primary/11 text-primary' },
  completed: { label: 'Completed', className: 'bg-success/11 text-success' },
  queued: { label: 'Queued', className: 'bg-secondary text-muted-foreground' },
  failed: { label: 'Failed', className: 'bg-destructive/11 text-destructive' },
}

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const config = batchConfig[status]
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2 py-1 text-[10.5px] font-semibold',
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}
