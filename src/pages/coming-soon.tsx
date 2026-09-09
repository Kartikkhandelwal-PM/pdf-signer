import type { LucideIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'

interface ComingSoonPageProps {
  title: string
  description: string
  icon: LucideIcon
}

export function ComingSoonPage({ title, description, icon: Icon }: ComingSoonPageProps) {
  return (
    <div className="flex flex-1 flex-col gap-5 p-5 sm:p-7">
      <PageHeader title={title} description={description} icon={Icon} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-24 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Icon className="size-6 text-primary" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-semibold">This screen is being built</span>
          <span className="text-[13px] text-muted-foreground">Check back shortly.</span>
        </div>
      </div>
    </div>
  )
}
