import {
  FileSignature,
  Layers,
  Send,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { activity } from '@/data/mock'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/format'
import type { ActivityKind } from '@/types'

const kindConfig: Record<ActivityKind, { icon: typeof FileSignature; className: string }> = {
  signed: { icon: FileSignature, className: 'bg-primary/11 text-primary' },
  verified: { icon: ShieldCheck, className: 'bg-success/12 text-success' },
  sent: { icon: Send, className: 'bg-brand-teal/12 text-brand-teal' },
  certificate: { icon: ShieldAlert, className: 'bg-destructive/12 text-destructive' },
  batch: { icon: Layers, className: 'bg-warning/13 text-warning' },
}

export function ActivityFeed() {
  return (
    <Card className="rounded-2xl border border-border py-5 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
      <CardHeader className="px-5">
        <CardTitle className="text-[15px] font-semibold">Activity</CardTitle>
        <CardDescription className="text-[12.5px]">Latest actions in your workspace</CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <ol className="flex flex-col">
          {activity.map((item, index) => {
            const config = kindConfig[item.kind]
            return (
              <li key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex size-7.5 shrink-0 items-center justify-center rounded-[9px]',
                      config.className,
                    )}
                  >
                    <config.icon className="size-3.5" />
                  </div>
                  {index < activity.length - 1 && (
                    <div className="mt-1.5 w-px flex-1 bg-border" />
                  )}
                </div>
                <div className="flex flex-col gap-1 pb-4">
                  <span className="text-[12.5px] font-semibold">{item.title}</span>
                  <span className="text-[11.5px] text-muted-foreground">
                    {item.description}
                  </span>
                  <span className="font-mono text-[10.5px] text-muted-foreground/60">
                    {item.actor} · {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
