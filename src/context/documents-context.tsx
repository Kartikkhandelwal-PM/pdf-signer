import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

import { documents as initialDocuments } from '@/data/mock'
import type { SignedDocument, VerifyStatus } from '@/types'

export interface SendUpdate {
  id: string
  sentTo: string
  recipientName?: string
  // Only present when the send flow learned/confirmed a password for this document (e.g. from
  // an uploaded recipient CSV) — merged in so it's remembered for next time, never cleared.
  password?: string
}

interface DocumentsContextValue {
  documents: SignedDocument[]
  addDocuments: (docs: SignedDocument[]) => void
  markVerified: (id: string, status: VerifyStatus) => void
  // Applied after a "Send to client" / "Resend" action for one or many documents at once.
  sendDocuments: (updates: SendUpdate[]) => void
  // Finishing a draft document should replace that row, not leave a stale unsigned copy
  // sitting next to the newly signed one.
  replaceDocument: (oldId: string, next: SignedDocument) => void
  // A draft's actual PDF bytes never leave the browser tab (there's no backend to persist
  // them to) — so "Save as draft" stashes the real File here, keyed by the draft's document
  // id, and "Resume signing" reads it back so the user isn't asked to re-pick the same file.
  // It's a plain ref, not state: nothing on screen needs to re-render when this changes.
  saveDraftFile: (id: string, file: File) => void
  getDraftFile: (id: string) => File | undefined
  clearDraftFile: (id: string) => void
}

const DocumentsContext = createContext<DocumentsContextValue | null>(null)

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<SignedDocument[]>(initialDocuments)
  const draftFilesRef = useRef<Map<string, File>>(new Map())

  const addDocuments = useCallback((docs: SignedDocument[]) => {
    setDocuments((prev) => [...docs, ...prev])
  }, [])

  const markVerified = useCallback((id: string, status: VerifyStatus) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, lastVerifiedStatus: status, lastVerifiedAt: new Date().toISOString() } : doc)),
    )
  }, [])

  const replaceDocument = useCallback((oldId: string, next: SignedDocument) => {
    setDocuments((prev) => [next, ...prev.filter((doc) => doc.id !== oldId)])
  }, [])

  const sendDocuments = useCallback((updates: SendUpdate[]) => {
    const byId = new Map(updates.map((update) => [update.id, update]))
    setDocuments((prev) =>
      prev.map((doc) => {
        const update = byId.get(doc.id)
        if (!update) return doc
        return {
          ...doc,
          sentTo: update.sentTo,
          recipientName: update.recipientName || doc.recipientName,
          password: update.password ?? doc.password,
          updatedAt: new Date().toISOString(),
        }
      }),
    )
  }, [])

  const saveDraftFile = useCallback((id: string, file: File) => {
    draftFilesRef.current.set(id, file)
  }, [])

  const getDraftFile = useCallback((id: string) => draftFilesRef.current.get(id), [])

  const clearDraftFile = useCallback((id: string) => {
    draftFilesRef.current.delete(id)
  }, [])

  const value = useMemo(
    () => ({
      documents,
      addDocuments,
      markVerified,
      replaceDocument,
      sendDocuments,
      saveDraftFile,
      getDraftFile,
      clearDraftFile,
    }),
    [
      documents,
      addDocuments,
      markVerified,
      replaceDocument,
      sendDocuments,
      saveDraftFile,
      getDraftFile,
      clearDraftFile,
    ],
  )

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>
}

export function useDocuments() {
  const ctx = useContext(DocumentsContext)
  if (!ctx) {
    throw new Error('useDocuments must be used within a DocumentsProvider')
  }
  return ctx
}
