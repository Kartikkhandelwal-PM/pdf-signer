// The demo data is dated around this point, so "now" is pinned here rather than read from the
// clock — otherwise every relative time and date filter drifts as real time passes.
export const NOW = new Date('2026-09-05T10:00:00')

export function formatRelativeTime(iso: string): string {
  const diffMs = NOW.getTime() - new Date(iso).getTime()
  const diffMin = Math.round(diffMs / 60000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

// Hour boundaries the greeting flips on — shared with useTimeOfDay so the hook knows exactly
// when to schedule its next update.
export const AFTERNOON_HOUR = 12
export const EVENING_HOUR = 17

// Unlike everything else here, this is about the person reading the screen rather than about
// the sample data — so it reads the real clock, not the pinned NOW. Callers that need to
// reason about a specific moment (the hook below) can pass one in.
export function getTimeOfDay(at: Date = new Date()): TimeOfDay {
  const hour = at.getHours()
  if (hour < AFTERNOON_HOUR) return 'morning'
  if (hour < EVENING_HOUR) return 'afternoon'
  return 'evening'
}

export const GREETING_BY_TIME: Record<TimeOfDay, string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
}

// The next instant the greeting changes — noon, then 5pm, then midnight. Kept next to the
// boundaries themselves so the two can't drift apart.
export function nextTimeOfDayBoundary(from: Date = new Date()): Date {
  const next = new Date(from)
  next.setMinutes(0, 0, 0)
  const hour = from.getHours()

  if (hour < AFTERNOON_HOUR) {
    next.setHours(AFTERNOON_HOUR)
  } else if (hour < EVENING_HOUR) {
    next.setHours(EVENING_HOUR)
  } else {
    next.setHours(0)
    next.setDate(next.getDate() + 1)
  }

  return next
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
