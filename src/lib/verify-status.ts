import { ShieldAlert, ShieldCheck, ShieldOff, ShieldX, type LucideIcon } from 'lucide-react'

import type { VerifyStatus } from '@/types'

export type VerifyTone = 'success' | 'destructive' | 'warning' | 'muted'

// Single source of truth for how each verification outcome looks — shared by the Verify
// signature page and any other surface (the All documents table) that shows a document's last
// known verification result, so the two never drift apart.
export const VERIFY_STATUS_META: Record<VerifyStatus, { tone: VerifyTone; label: string; icon: LucideIcon }> = {
  valid: { tone: 'success', label: 'Valid signature', icon: ShieldCheck },
  invalid: { tone: 'destructive', label: 'Invalid signature', icon: ShieldAlert },
  unsigned: { tone: 'muted', label: 'Not signed', icon: ShieldOff },
  expired: { tone: 'warning', label: 'Certificate expired', icon: ShieldAlert },
  revoked: { tone: 'destructive', label: 'Certificate revoked', icon: ShieldX },
}

export const VERIFY_TONE_CLASSES: Record<VerifyTone, { iconBg: string; text: string; border: string }> = {
  success: { iconBg: 'bg-success/10 text-success', text: 'text-success', border: 'border-success/25' },
  destructive: { iconBg: 'bg-destructive/10 text-destructive', text: 'text-destructive', border: 'border-destructive/25' },
  warning: { iconBg: 'bg-warning/12 text-warning', text: 'text-warning', border: 'border-warning/30' },
  muted: { iconBg: 'bg-secondary text-muted-foreground', text: 'text-muted-foreground', border: 'border-border' },
}

// A batch's own verify state, for a group row that represents several documents at once —
// null unless every one of them has actually been checked, since a partly-verified batch
// isn't a state worth badging. Worst outcome wins: one revoked or invalid file makes the
// whole batch read as a problem even if the rest are clean.
export function aggregateVerifyStatus(statuses: (VerifyStatus | undefined)[]): VerifyStatus | null {
  if (statuses.length === 0 || statuses.some((s) => !s)) return null
  const resolved = statuses as VerifyStatus[]
  if (resolved.every((s) => s === 'valid')) return 'valid'
  if (resolved.some((s) => s === 'revoked')) return 'revoked'
  if (resolved.some((s) => s === 'invalid')) return 'invalid'
  if (resolved.some((s) => s === 'expired')) return 'expired'
  return 'unsigned'
}
