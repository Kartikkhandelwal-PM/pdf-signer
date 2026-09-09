import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description: string
  icon?: LucideIcon
  action?: ReactNode
}

export function PageHeader({ title, description, icon: Icon, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-xl font-bold tracking-tight">{title}</h1>
          <p className="text-[13px] text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  )
}
