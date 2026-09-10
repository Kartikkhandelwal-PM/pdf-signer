import { FileCheck2, Files, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react'

import { useDocuments } from '@/context/documents-context'
import { certificates } from '@/data/mock'

interface StatItem {
  label: string
  value: number
  icon: LucideIcon
}

export function SimpleStats() {
  const { documents } = useDocuments()

  const stats: StatItem[] = [
    { label: 'Total documents', value: documents.length, icon: Files },
    {
      label: 'Signed documents',
      value: documents.filter((doc) => doc.status === 'signed').length,
      icon: FileCheck2,
    },
    { label: 'Certificates saved', value: certificates.length, icon: ShieldCheck },
    {
      label: 'Need attention',
      value: certificates.filter((cert) => cert.status !== 'active').length,
      icon: ShieldAlert,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)]"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-accent text-primary">
            <stat.icon className="size-4.5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-heading text-lg font-bold tracking-tight text-foreground">
              {stat.value}
            </span>
            <span className="text-[11px] text-muted-foreground">{stat.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
