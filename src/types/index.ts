export type DocumentStatus = 'signed' | 'draft' | 'expired'

export type DocumentSource = 'single' | 'batch'

// The outcome of running a document through Verify signature — not just "valid" vs "tampered".
// A signature can be cryptographically intact yet still untrustworthy (expired or revoked
// certificate), or simply absent (unsigned).
export type VerifyStatus = 'valid' | 'invalid' | 'unsigned' | 'expired' | 'revoked'

export interface SignedDocument {
  id: string
  name: string
  client: string
  status: DocumentStatus
  pages: number
  signedPages?: string
  signedBy: string
  certificate: string
  updatedAt: string
  passwordProtected: boolean
  password?: string
  sentTo?: string
  source?: DocumentSource
  batchName?: string
  lastVerifiedStatus?: VerifyStatus
  lastVerifiedAt?: string
}

export type BatchStatus = 'processing' | 'completed' | 'queued' | 'failed'

export interface BatchJob {
  id: string
  name: string
  totalFiles: number
  completedFiles: number
  status: BatchStatus
  passwordMode: 'common' | 'custom' | 'uploaded-list'
  createdAt: string
}

export type CertificateStatus = 'active' | 'expiring' | 'expired'

export interface Certificate {
  id: string
  holderName: string
  organization: string
  serialNumber: string
  issuer: string
  expiresOn: string
  status: CertificateStatus
  isDefault: boolean
}

export type ActivityKind = 'signed' | 'verified' | 'sent' | 'certificate' | 'batch'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  title: string
  description: string
  timestamp: string
  actor: string
}
