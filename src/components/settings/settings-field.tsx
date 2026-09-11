import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'

interface SettingsFieldProps {
  id: string
  label: string
  /** Standing explanation — what this value is, or where to find it. */
  hint?: ReactNode
  /** Replaces the hint while the value is wrong, so the row never grows a second line. */
  error?: string
  children: ReactNode
}

export function SettingsField({ id, label, hint, error, children }: SettingsFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[12.5px] font-semibold">
        {label}
      </Label>
      {children}
      {error ? (
        <span className="text-[11px] font-medium text-destructive">{error}</span>
      ) : (
        hint && <span className="text-[11px] leading-relaxed text-muted-foreground">{hint}</span>
      )}
    </div>
  )
}
