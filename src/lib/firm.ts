// The single source of truth for "who this email comes from". Mirrors what Settings → Firm
// profile and Settings → SMTP configuration hold, so the send flow's From line and preview
// always match the configured account instead of hardcoding an address per screen.

export interface FirmProfile {
  name: string
  email: string
  /** SMTP "From name" — what a client's inbox shows as the sender. */
  fromName: string
  /** SMTP "From email" — the envelope address the message is actually delivered from. */
  fromAddress: string
  smtpHost: string
}

export const FIRM_PROFILE: FirmProfile = {
  name: 'KDK Softwares',
  email: 'contact@kdksoftware.com',
  fromName: 'KDK Softwares',
  fromAddress: 'no-reply@kdksoftware.com',
  smtpHost: 'smtp.zoho.in',
}

export function firmInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'KS'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}
