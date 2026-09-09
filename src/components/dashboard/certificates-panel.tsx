import { Plus, ShieldCheck, Star } from 'lucide-react'
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
import { certificates } from '@/data/mock'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { CertificateStatusBadge } from './status-badge'

export function CertificatesPanel() {
  return (
    <Card className="gap-1.5 rounded-2xl border border-border py-5 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
      <CardHeader className="px-5">
        <CardTitle className="text-[15px] font-semibold">DSC certificates</CardTitle>
        <CardDescription className="text-[12.5px]">Saved signing certificates</CardDescription>
        <CardAction>
          <Button
            size="icon"
            className="size-9 rounded-[10px] border-none bg-primary shadow-none hover:bg-primary/90"
            onClick={() => toast('Upload a .pfx certificate or connect a USB token.')}
          >
            <Plus className="size-4" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col px-5">
        {certificates.map((cert, index) => (
          <div key={cert.id}>
            <div
              className={cn(
                'flex items-center gap-3 py-3.5',
                index > 0 && 'border-t border-border',
              )}
            >
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-[11px]',
                  cert.status === 'active' && 'bg-success/10 text-success',
                  cert.status === 'expiring' && 'bg-warning/12 text-warning',
                  cert.status === 'expired' && 'bg-destructive/10 text-destructive',
                )}
              >
                <ShieldCheck className="size-4.5" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold">{cert.holderName}</span>
                  {cert.isDefault && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-linear-to-br from-brand-orange to-brand-pink px-2 py-0.5 text-[9px] font-semibold text-white">
                      <Star className="size-2.5 fill-current" />
                      Default
                    </span>
                  )}
                </div>
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {cert.organization} · {formatDate(cert.expiresOn)}
                </span>
              </div>
              <CertificateStatusBadge status={cert.status} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
