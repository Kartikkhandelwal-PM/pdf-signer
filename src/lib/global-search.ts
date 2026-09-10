import { FileText, Send, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'

import { allNavItems } from '@/config/nav'
import type { Certificate, SignedDocument } from '@/types'

export type SearchKind = 'document' | 'recipient' | 'certificate' | 'page'

export interface SearchResult {
  id: string
  kind: SearchKind
  title: string
  subtitle: string
  icon: LucideIcon
  path: string
  // Carried through navigation so the destination page can filter itself down to this hit
  // instead of dumping the user at the top of an unfiltered list.
  state?: Record<string, unknown>
  score: number
}

export interface SearchGroup {
  kind: SearchKind
  label: string
  results: SearchResult[]
  // How many matches were dropped by the per-group cap, so the UI can offer a way through.
  overflow: number
}

// At most this many hits per group — a global search is for jumping somewhere, not for
// browsing. The pages themselves are where you page through everything.
const GROUP_LIMIT = 4

const GROUP_ORDER: { kind: SearchKind; label: string }[] = [
  { kind: 'document', label: 'Documents' },
  { kind: 'recipient', label: 'Recipients' },
  { kind: 'certificate', label: 'Certificates' },
  { kind: 'page', label: 'Go to' },
]

// Lower is better. A whole-value match beats a prefix, which beats the start of a word,
// which beats something buried mid-token — so typing "pri" surfaces Priya Nair above a
// document that merely happens to contain "pri" inside a longer word.
function matchScore(value: string | undefined, needle: string): number | null {
  if (!value) return null
  const hay = value.toLowerCase()
  const at = hay.indexOf(needle)
  if (at === -1) return null
  if (hay === needle) return 0
  if (at === 0) return 1
  return /[\s_\-./@&(]/.test(hay[at - 1]) ? 2 : 3
}

function bestScore(values: (string | undefined)[], needle: string): number | null {
  let best: number | null = null
  for (const value of values) {
    const score = matchScore(value, needle)
    if (score !== null && (best === null || score < best)) best = score
  }
  return best
}

const STATUS_LABEL: Record<SignedDocument['status'], string> = {
  signed: 'Signed',
  draft: 'Draft',
  expired: 'Expired',
}

// Recipients aren't stored as their own records — they only exist as the address a document
// was sent to, so they're folded up from the documents themselves.
function collectRecipients(documents: SignedDocument[]) {
  const byEmail = new Map<string, { email: string; name?: string; count: number }>()

  for (const doc of documents) {
    if (!doc.sentTo) continue
    const existing = byEmail.get(doc.sentTo)
    if (existing) {
      existing.count += 1
      existing.name ??= doc.recipientName
    } else {
      byEmail.set(doc.sentTo, { email: doc.sentTo, name: doc.recipientName, count: 1 })
    }
  }

  return [...byEmail.values()]
}

export function searchEverything(
  rawQuery: string,
  documents: SignedDocument[],
  certificates: Certificate[],
): SearchGroup[] {
  const needle = rawQuery.trim().toLowerCase()
  if (needle.length === 0) return []

  const hits: SearchResult[] = []

  for (const doc of documents) {
    // The certificate string carries the signer's org, so it's worth searching even though
    // it isn't shown in the result row.
    const score = bestScore(
      [doc.name, doc.recipientName, doc.sentTo, doc.signedBy, doc.certificate, doc.batchName],
      needle,
    )
    if (score === null) continue

    hits.push({
      id: `document:${doc.id}`,
      kind: 'document',
      title: doc.name,
      subtitle: [STATUS_LABEL[doc.status], `${doc.pages} pages`, doc.recipientName ?? doc.sentTo]
        .filter(Boolean)
        .join(' · '),
      icon: FileText,
      path: '/documents',
      state: { query: doc.name, openDocumentId: doc.id },
      score,
    })
  }

  for (const recipient of collectRecipients(documents)) {
    const score = bestScore([recipient.name, recipient.email], needle)
    if (score === null) continue

    hits.push({
      id: `recipient:${recipient.email}`,
      kind: 'recipient',
      title: recipient.name ?? recipient.email,
      subtitle: `${recipient.email} · ${recipient.count} ${recipient.count === 1 ? 'document' : 'documents'}`,
      icon: recipient.name ? UserRound : Send,
      path: '/sent',
      state: { query: recipient.email },
      score,
    })
  }

  for (const cert of certificates) {
    const score = bestScore([cert.holderName, cert.organization, cert.issuer, cert.serialNumber], needle)
    if (score === null) continue

    hits.push({
      id: `certificate:${cert.id}`,
      kind: 'certificate',
      title: cert.holderName,
      subtitle: `${cert.organization} · ${cert.issuer}`,
      icon: ShieldCheck,
      path: '/certificates',
      state: { highlightId: cert.id },
      score,
    })
  }

  for (const item of allNavItems) {
    const score = bestScore([item.title, item.description], needle)
    if (score === null) continue

    hits.push({
      id: `page:${item.path}`,
      kind: 'page',
      title: item.title,
      subtitle: item.description,
      icon: item.icon,
      path: item.path,
      score,
    })
  }

  return GROUP_ORDER.map(({ kind, label }) => {
    const matches = hits
      .filter((hit) => hit.kind === kind)
      .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title))

    return { kind, label, results: matches.slice(0, GROUP_LIMIT), overflow: Math.max(0, matches.length - GROUP_LIMIT) }
  }).filter((group) => group.results.length > 0)
}

// The groups flattened into the order they're rendered in — what arrow keys actually walk.
export function flattenGroups(groups: SearchGroup[]): SearchResult[] {
  return groups.flatMap((group) => group.results)
}

// Splits a title around the matched run so the UI can bold just that part.
export function splitOnMatch(text: string, rawQuery: string): [string, string, string] {
  const needle = rawQuery.trim().toLowerCase()
  const at = needle.length === 0 ? -1 : text.toLowerCase().indexOf(needle)
  if (at === -1) return [text, '', '']
  return [text.slice(0, at), text.slice(at, at + needle.length), text.slice(at + needle.length)]
}
