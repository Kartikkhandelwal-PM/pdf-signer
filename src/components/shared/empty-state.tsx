import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  /** A way out of the empty state — clearing a filter, or creating the first record. */
  action?: ReactNode
  /** 'sm' fits inside a card on a busy page; 'md' owns a whole page's worth of space. */
  size?: 'sm' | 'md'
  className?: string
}

// One shape for every "there's nothing here" moment in the app — an icon to soften the blank
// space, what's missing, why, and wherever possible something to do about it. Kept in one
// place so a filtered-to-nothing table and a brand-new account don't look like different
// products.
export function EmptyState({ icon: Icon, title, description, action, size = 'md', className }: EmptyStateProps) {
  const small = size === 'sm'
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        small ? 'gap-2.5 px-5 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl bg-primary/10 text-primary',
          small ? 'size-10' : 'size-12',
        )}
      >
        <Icon className={small ? 'size-5' : 'size-6'} />
      </div>
      <div className="flex flex-col gap-1">
        <span className={cn('font-semibold', small ? 'text-[12.5px]' : 'text-[13.5px]')}>{title}</span>
        <span className={cn('max-w-sm text-muted-foreground', small ? 'text-[11px]' : 'text-[12px]')}>
          {description}
        </span>
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}
