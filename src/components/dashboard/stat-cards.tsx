import { ArrowDownRight, ArrowUpRight, FileSignature, Layers, ShieldAlert, Timer } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Stat {
  label: string
  value: string
  delta: string
  trend: 'up' | 'down' | 'neutral'
  icon: typeof FileSignature
  iconClassName: string
}

const stats: Stat[] = [
  {
    label: 'Documents signed this month',
    value: '1,248',
    delta: '+12.4%',
    trend: 'up',
    icon: FileSignature,
    iconClassName: 'bg-linear-to-br from-primary to-[#2f93c0]',
  },
  {
    label: 'Awaiting your signature',
    value: '18',
    delta: '+3 today',
    trend: 'up',
    icon: Timer,
    iconClassName: 'bg-linear-to-br from-brand-orange to-brand-pink',
  },
  {
    label: 'Active batch jobs',
    value: '3',
    delta: '186 files',
    trend: 'neutral',
    icon: Layers,
    iconClassName: 'bg-linear-to-br from-brand-teal to-primary',
  },
  {
    label: 'Certificates expiring soon',
    value: '1',
    delta: '−1 vs last month',
    trend: 'down',
    icon: ShieldAlert,
    iconClassName: 'bg-linear-to-br from-[#fb7185] to-destructive',
  },
]

export function StatCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className="gap-3 rounded-2xl border border-border py-5 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0"
        >
          <CardContent className="flex items-start justify-between px-5">
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-medium text-muted-foreground">{stat.label}</span>
              <span className="font-heading text-[26px] font-bold tracking-tight text-foreground">
                {stat.value}
              </span>
              {stat.trend === 'neutral' ? (
                <span className="font-mono text-[11.5px] text-muted-foreground">{stat.delta}</span>
              ) : (
                <span
                  className={cn(
                    'inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 font-mono text-[11.5px] font-semibold',
                    stat.trend === 'up' ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground',
                  )}
                >
                  {stat.trend === 'up' ? (
                    <ArrowUpRight className="size-3" />
                  ) : (
                    <ArrowDownRight className="size-3" />
                  )}
                  {stat.delta}
                </span>
              )}
            </div>
            <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-[10px] text-white', stat.iconClassName)}>
              <stat.icon className="size-4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
