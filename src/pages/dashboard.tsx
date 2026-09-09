import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { BatchPanel } from '@/components/dashboard/batch-panel'
import { CertificatesPanel } from '@/components/dashboard/certificates-panel'
import { DocumentsTable } from '@/components/dashboard/documents-table'
import { StatCards } from '@/components/dashboard/stat-cards'

export function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col gap-5 p-5 sm:p-7">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-xl font-bold tracking-tight">
          Welcome back, Kartik
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Here's what's happening across your firm's document signing today.
        </p>
      </div>

      <StatCards />

      <DocumentsTable />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <BatchPanel />
        <CertificatesPanel />
        <ActivityFeed />
      </div>
    </div>
  )
}
