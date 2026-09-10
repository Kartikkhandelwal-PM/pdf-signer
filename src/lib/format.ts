const NOW = new Date('2026-09-05T10:00:00')

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

export function getTimeOfDay(): TimeOfDay {
  const hour = NOW.getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

export function getGreeting(): string {
  const timeOfDay = getTimeOfDay()
  if (timeOfDay === 'morning') return 'Good morning'
  if (timeOfDay === 'afternoon') return 'Good afternoon'
  return 'Good evening'
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
