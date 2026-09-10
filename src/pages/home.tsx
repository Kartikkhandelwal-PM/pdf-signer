import { CertificatesGrid } from '@/components/home/certificates-grid'
import { HeroBanner } from '@/components/home/hero-banner'
import { QuickActionCards } from '@/components/home/quick-action-cards'
import { RecentDocumentsList } from '@/components/home/recent-documents-list'
import { SimpleStats } from '@/components/home/simple-stats'

export function HomePage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-5 sm:p-7">
      <HeroBanner />
      <SimpleStats />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QuickActionCards />
        <CertificatesGrid />
      </div>

      <RecentDocumentsList />
    </div>
  )
}
