import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'

interface OptionCardProps {
  value: string
  selected: boolean
  onSelect: () => void
  disabled?: boolean
  icon: LucideIcon
  title: string
  description?: string
  badge?: string
  children?: ReactNode
  /** Skip the left indent that normally aligns expanded content with the title text — for
   * content (like a template table) that needs every pixel of the card's width, not alignment. */
  fullWidthContent?: boolean
}

/** A radio option rendered as a self-contained card, with room to expand its own config inline
 * when selected — so every choice in a mode picker carries equal visual weight, instead of some
 * being a bare label and others a fully-built-out box. */
export function OptionCard({
  value,
  selected,
  onSelect,
  disabled,
  icon: Icon,
  title,
  description,
  badge,
  children,
  fullWidthContent,
}: OptionCardProps) {
  return (
    <div
      onClick={() => !disabled && onSelect()}
      className={cn(
        'flex flex-col gap-3 rounded-[12px] border p-3 transition-colors',
        disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer',
        selected ? 'border-primary/35 bg-primary/[0.045]' : 'border-border hover:border-primary/25',
      )}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-[9px]',
            selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
            {title}
            {badge && (
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground">
                {badge}
              </span>
            )}
          </span>
          {description && <span className="text-[11px] text-muted-foreground">{description}</span>}
        </div>
        <RadioGroupItem value={value} disabled={disabled} />
      </div>
      {selected && children && (
        <div
          className={cn('flex flex-col gap-2.5 border-t border-primary/15 pt-3', !fullWidthContent && 'pl-[42px]')}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  )
}
