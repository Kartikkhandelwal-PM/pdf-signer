import { ShieldCheck, Star, Usb } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { CertificateStatusBadge } from '@/components/dashboard/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { certificates } from '@/data/mock'
import { cn } from '@/lib/utils'
import type { Certificate } from '@/types'

const iconClassName: Record<Certificate['status'], string> = {
  active: 'bg-success/10 text-success',
  expiring: 'bg-warning/12 text-warning',
  expired: 'bg-destructive/10 text-destructive',
}

export function CertificatesGrid() {
  const navigate = useNavigate()
  // Fetching lives on the certificates page; this is the same action, so it goes there and
  // opens the scan rather than running a second, shallower version of it here.
  const fetchCertificate = () => navigate('/certificates', { state: { startFetch: true } })

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl border border-border py-0 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
      <CardHeader className="gap-1 border-b border-border py-4">
        <CardTitle className="text-[14px] font-semibold">Your DSC certificates</CardTitle>
        <CardDescription className="text-[11.5px]">
          Saved certificates ready to sign with
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            className="h-7 gap-1.5 rounded-[9px] px-3 text-[12px] font-semibold shadow-none"
            onClick={fetchCertificate}
          >
            <Usb className="size-3" />
            Fetch certificate
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5 p-3.5">
        {certificates.length === 0 ? (
          <EmptyState
            size="sm"
            icon={ShieldCheck}
            title="No certificates saved yet"
            description="Add a DSC certificate to start signing documents."
          />
        ) : (
          certificates.map((cert) => (
            <button
              key={cert.id}
              type="button"
              onClick={() => navigate('/certificates')}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-secondary/60"
            >
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-[10px]',
                  iconClassName[cert.status],
                )}
              >
                <ShieldCheck className="size-4" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 truncate text-[12.5px] font-semibold">
                  {cert.holderName}
                  {cert.isDefault && (
                    <Star className="size-3 shrink-0 fill-brand-orange text-brand-orange" />
                  )}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {cert.organization}
                </span>
              </div>
              <CertificateStatusBadge status={cert.status} />
            </button>
          ))
        )}
      </CardContent>
    </Card>
  )
}
