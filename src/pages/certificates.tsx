import { useEffect, useState } from 'react'
import {
  Check,
  KeyRound,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  Star,
  Usb,
} from 'lucide-react'
import { toast } from 'sonner'

import { CertificateStatusBadge } from '@/components/dashboard/status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { certificates as initialCertificates } from '@/data/mock'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Certificate } from '@/types'

const statusConfig: Record<Certificate['status'], string> = {
  active: 'bg-success/10 text-success',
  expiring: 'bg-warning/12 text-warning',
  expired: 'bg-destructive/10 text-destructive',
}

// The token doesn't hand over its holder's own name — it hands over an X.509 identity, and the
// closest thing this mock has to one is whoever is signed in. The issuer is picked per fetch,
// same as a real token could carry a cert from any of these CAs.
const TOKEN_ISSUERS = ['(n)Code Solutions CA 2022', 'eMudhra Class 3 CA', 'Capricorn CA 2022', 'Sify SafeScrypt CA']
const TOKEN_EXPIRIES = ['2028-06-14', '2027-09-30', '2029-02-11']

function randomSerial() {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()).join(' ')
}

// A single physical token or a device's certificate store can hold more than one identity —
// a token often carries separate signing and encryption certs, or ones renewed over time.
function generateFoundCertificates(): Certificate[] {
  const count = 2 + Math.round(Math.random()) // 2 or 3
  const issuers = [...TOKEN_ISSUERS].sort(() => Math.random() - 0.5)
  return Array.from({ length: count }, (_, i) => ({
    id: `cert-${Math.random().toString(36).slice(2, 8)}`,
    holderName: 'Kartik Khandelwal',
    organization: 'KDK Softwares',
    serialNumber: randomSerial(),
    issuer: issuers[i % issuers.length],
    expiresOn: TOKEN_EXPIRIES[i % TOKEN_EXPIRIES.length],
    status: 'active',
    isDefault: false,
  }))
}

// Three quick stages mirroring the signing flow's own step language — connect, read, verify —
// so "fetching a certificate" feels like the same product as "signing a document".
const FETCH_STAGES = [
  { label: 'Connecting to token…', icon: Usb },
  { label: 'Reading certificate…', icon: ShieldCheck },
  { label: 'Verifying with issuer…', icon: KeyRound },
] as const

type FetchPhase = 'scanning' | 'found'

export function CertificatesPage() {
  const [certificates, setCertificates] = useState(initialCertificates)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [fetchPhase, setFetchPhase] = useState<FetchPhase>('scanning')
  const [fetchStep, setFetchStep] = useState(0)
  const [foundCerts, setFoundCerts] = useState<Certificate[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function setDefault(id: string) {
    setCertificates((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })))
    toast.success('Default certificate updated')
  }

  function removeCertificate(id: string) {
    setCertificates((prev) => prev.filter((c) => c.id !== id))
    toast('Certificate removed')
  }

  // Starts (or restarts) the scan every time the dialog opens, or the user asks to rescan —
  // stages advance on a timer the same way the sign-document flow's SIGN_STEPS do.
  function startFetch() {
    setFetchPhase('scanning')
    setFetchStep(0)
    setFoundCerts([])
    setSelectedIds(new Set())
  }

  useEffect(() => {
    if (dialogOpen) startFetch()
  }, [dialogOpen])

  useEffect(() => {
    if (!dialogOpen || fetchPhase !== 'scanning') return

    if (fetchStep >= FETCH_STAGES.length) {
      const found = generateFoundCertificates()
      setFoundCerts(found)
      setSelectedIds(new Set(found.map((c) => c.id)))
      setFetchPhase('found')
      return
    }

    const timer = setTimeout(() => setFetchStep((s) => s + 1), 600)
    return () => clearTimeout(timer)
  }, [dialogOpen, fetchPhase, fetchStep])

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSaveFetchedCertificates() {
    const toSave = foundCerts.filter((c) => selectedIds.has(c.id))
    if (toSave.length === 0) return
    setCertificates((prev) => [...prev, ...toSave])
    toast.success(`${toSave.length} certificate${toSave.length === 1 ? '' : 's'} saved`, {
      description: toSave.map((c) => c.issuer).join(', '),
    })
    setDialogOpen(false)
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-5 sm:p-7">
      <PageHeader
        title="Certificates"
        description="Manage saved DSC certificates and your default signer."
        icon={ShieldCheck}
        action={
          <Button
            className="h-10 gap-1.5 rounded-[10px] border-none bg-primary px-5 font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90"
            onClick={() => setDialogOpen(true)}
          >
            <Usb className="size-4" />
            Fetch certificates
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {certificates.map((cert) => (
          <Card
            key={cert.id}
            className="gap-4 rounded-2xl border border-border py-5 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0"
          >
            <CardContent className="flex flex-col gap-4 px-5">
              <div className="flex items-start justify-between gap-2">
                <div
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-[12px]',
                    statusConfig[cert.status],
                  )}
                >
                  <ShieldCheck className="size-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <CertificateStatusBadge status={cert.status} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-[8px] bg-secondary/60 hover:bg-secondary"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDefault(cert.id)} disabled={cert.isDefault}>
                        <Star />
                        Set as default
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => removeCertificate(cert.id)}
                      >
                        Remove certificate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-[14.5px] font-semibold">
                  {cert.holderName}
                  {cert.isDefault && (
                    <span className="flex items-center gap-1 rounded-full bg-linear-to-br from-brand-orange to-brand-pink px-2 py-0.5 text-[9.5px] font-semibold text-white">
                      <Star className="size-2.5 fill-current" />
                      Default
                    </span>
                  )}
                </span>
                <span className="text-[12.5px] text-muted-foreground">{cert.organization}</span>
              </div>

              <div className="flex flex-col gap-2 rounded-[10px] bg-secondary/50 p-3">
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="text-muted-foreground">Issuer</span>
                  <span className="font-medium">{cert.issuer}</span>
                </div>
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="text-muted-foreground">Serial</span>
                  <span className="font-mono">{cert.serialNumber}</span>
                </div>
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="text-muted-foreground">Expires</span>
                  <span className="font-mono font-medium">{formatDate(cert.expiresOn)}</span>
                </div>
              </div>

              {!cert.isDefault && cert.status !== 'expired' && (
                <Button
                  variant="ghost"
                  className="h-9 w-full rounded-[10px] bg-secondary text-[12.5px] font-semibold hover:bg-secondary/70"
                  onClick={() => setDefault(cert.id)}
                >
                  Set as default
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        <button
          onClick={() => setDialogOpen(true)}
          className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border text-center transition-colors hover:border-primary/40 hover:bg-secondary/40"
        >
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
            <Usb className="size-5 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[13.5px] font-semibold">Fetch a certificate</span>
            <span className="text-[12px] text-muted-foreground">Reads it straight from your connected token</span>
          </div>
        </button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Fetch certificates</DialogTitle>
            <DialogDescription>
              {fetchPhase === 'scanning'
                ? 'Reading certificates straight from your connected USB token or smart card.'
                : `Found ${foundCerts.length} certificates on your token — choose which to save.`}
            </DialogDescription>
          </DialogHeader>

          {fetchPhase === 'scanning' ? (
            <div className="flex flex-col items-center gap-7 py-3">
              <div className="relative flex size-20 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-primary/10 blur-lg" />
                <svg className="absolute inset-0 -rotate-90" width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="4" className="text-secondary" />
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="text-primary"
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={1 - fetchStep / FETCH_STAGES.length}
                    style={{ transition: 'stroke-dashoffset 450ms cubic-bezier(0.4,0,0.2,1)' }}
                  />
                </svg>
                <div
                  key={Math.min(fetchStep, FETCH_STAGES.length - 1)}
                  className="flex size-12 animate-in items-center justify-center rounded-full bg-primary/10 zoom-in-50 fade-in-0 duration-300"
                >
                  {(() => {
                    const Icon = FETCH_STAGES[Math.min(fetchStep, FETCH_STAGES.length - 1)].icon
                    return <Icon className="size-5 text-primary" />
                  })()}
                </div>
              </div>

              <div className="flex w-full flex-col gap-1">
                {FETCH_STAGES.map((stage, i) => {
                  const state = i < fetchStep ? 'done' : i === fetchStep ? 'active' : 'pending'
                  return (
                    <div
                      key={stage.label}
                      className={cn(
                        'flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[12.5px]',
                        state === 'active' && 'bg-primary/5 font-semibold',
                        state === 'pending' && 'text-muted-foreground',
                      )}
                    >
                      <div
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-full',
                          state === 'done' && 'bg-success text-success-foreground',
                          state === 'active' && 'bg-primary/15 text-primary',
                          state === 'pending' && 'border border-border',
                        )}
                      >
                        {state === 'done' ? (
                          <Check className="size-3" />
                        ) : state === 'active' ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : null}
                      </div>
                      {stage.label}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex animate-in flex-col gap-3 fade-in-0 zoom-in-95 py-1 duration-300">
              {foundCerts.map((cert, i) => {
                const selected = selectedIds.has(cert.id)
                return (
                  <button
                    key={cert.id}
                    type="button"
                    onClick={() => toggleSelected(cert.id)}
                    style={{ animationDelay: `${i * 70}ms` }}
                    className={cn(
                      'flex animate-in flex-col gap-2.5 rounded-[10px] border p-3.5 text-left fade-in-0 slide-in-from-bottom-1 duration-300',
                      selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-[9px]',
                          selected ? 'bg-success/15 text-success' : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        <ShieldCheck className="size-4.5" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-semibold">{cert.holderName}</span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {cert.issuer} · expires {formatDate(cert.expiresOn)}
                        </span>
                      </div>
                      <div
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-full border',
                          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                        )}
                      >
                        {selected && <Check className="size-3" />}
                      </div>
                    </div>
                    <span className="font-mono text-[10.5px] text-muted-foreground">S/N {cert.serialNumber}</span>
                  </button>
                )
              })}
              <button
                onClick={startFetch}
                className="flex items-center justify-center gap-1.5 pt-1 text-[12px] font-semibold text-primary hover:underline"
              >
                <RefreshCw className="size-3.5" />
                Not these — rescan
              </button>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-[10px] bg-secondary font-semibold hover:bg-secondary/70"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            {fetchPhase === 'found' && (
              <Button
                className="gap-1.5 rounded-[10px] border-none bg-primary font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90 disabled:opacity-50"
                disabled={selectedIds.size === 0}
                onClick={handleSaveFetchedCertificates}
              >
                Save {selectedIds.size > 0 ? selectedIds.size : ''} certificate{selectedIds.size === 1 ? '' : 's'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
