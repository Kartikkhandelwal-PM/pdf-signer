import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Send, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { MessageFields } from '@/components/documents/message-fields'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDocuments } from '@/context/documents-context'
import { cn } from '@/lib/utils'
import { DEFAULT_BODY_TEMPLATE, DEFAULT_SUBJECT_TEMPLATE, type TemplateVars } from '@/lib/message-template'
import {
  buildRecipientTemplateCsv,
  DEFAULT_FIRM_NAME,
  downloadCsv,
  isValidEmail,
  matchRecipientRows,
  parseRecipientCsv,
  type RecipientMatch,
  type RecipientRowError,
  type UnmatchedRow,
} from '@/lib/recipients'
import type { SignedDocument } from '@/types'

type BatchMode = 'same' | 'csv'

interface SendDialogProps {
  documents: SignedDocument[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

function documentNameLabel(docs: SignedDocument[]) {
  return docs.length === 1 ? docs[0].name : `${docs.length} documents`
}

export function SendDialog({ documents, open, onOpenChange }: SendDialogProps) {
  const { sendDocuments } = useDocuments()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isBatch = documents.length > 1
  const singleDoc = documents.length === 1 ? documents[0] : null

  const [recipient, setRecipient] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [subject, setSubject] = useState(DEFAULT_SUBJECT_TEMPLATE)
  const [body, setBody] = useState(DEFAULT_BODY_TEMPLATE)
  const [includePassword, setIncludePassword] = useState(true)
  const [batchMode, setBatchMode] = useState<BatchMode>('same')
  const [csvFileName, setCsvFileName] = useState('')
  const [csvMatches, setCsvMatches] = useState<RecipientMatch[]>([])
  const [csvUnmatched, setCsvUnmatched] = useState<UnmatchedRow[]>([])
  const [csvErrors, setCsvErrors] = useState<RecipientRowError[]>([])

  // Mirrors the pattern used in document-detail-dialog: only re-derive from `documents` at the
  // moment the dialog opens, so typing inside it doesn't get clobbered by a parent re-render.
  useEffect(() => {
    if (!open) return
    const commonRecipient = documents.every((doc) => doc.sentTo && doc.sentTo === documents[0].sentTo)
      ? documents[0].sentTo
      : undefined
    setRecipient(singleDoc?.sentTo ?? commonRecipient ?? '')
    setRecipientName(singleDoc?.recipientName ?? '')
    setSubject(DEFAULT_SUBJECT_TEMPLATE)
    setBody(DEFAULT_BODY_TEMPLATE)
    setIncludePassword(true)
    setBatchMode('same')
    setCsvFileName('')
    setCsvMatches([])
    setCsvUnmatched([])
    setCsvErrors([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleCsvFile(file: File) {
    const text = await file.text()
    const { rows, errors } = parseRecipientCsv(text)
    const { matches, unmatched } = matchRecipientRows(
      rows,
      documents.map((doc) => ({ id: doc.id, name: doc.name })),
    )
    setCsvFileName(file.name)
    setCsvMatches(matches)
    setCsvUnmatched(unmatched)
    setCsvErrors(errors)
  }

  function handleDownloadTemplate() {
    const csv = buildRecipientTemplateCsv(documents.map((doc) => ({ name: doc.name, password: doc.password })))
    downloadCsv('recipient-template.csv', csv)
    toast.success('Template downloaded')
  }

  const protectedDocs = documents.filter((doc) => doc.passwordProtected)
  const withStoredPassword = protectedDocs.filter((doc) => doc.password)
  const withoutStoredPassword = protectedDocs.filter((doc) => !doc.password)
  const coveredIds = new Set(csvMatches.map((match) => match.docId))
  const missingDocs = documents.filter((doc) => !coveredIds.has(doc.id))

  // What the Subject/Message preview resolves against — the representative case for "same
  // recipient" mode, or the first uploaded row once a recipient CSV has been matched.
  const previewVars: TemplateVars =
    batchMode === 'csv'
      ? {
          clientName: csvMatches[0]?.clientName ?? '',
          documentName: csvMatches[0]?.docName ?? documentNameLabel(documents),
          firmName: DEFAULT_FIRM_NAME,
          password: csvMatches[0]?.password || undefined,
        }
      : {
          clientName: recipientName,
          documentName: documentNameLabel(documents),
          firmName: DEFAULT_FIRM_NAME,
          password: withStoredPassword[0]?.password,
        }

  function handleSend() {
    if (isBatch && batchMode === 'csv') {
      if (csvMatches.length === 0) {
        toast.error('Upload a filled-in template first')
        return
      }
      sendDocuments(
        csvMatches.map((match) => ({
          id: match.docId,
          sentTo: match.email,
          recipientName: match.clientName || undefined,
          password: match.password || undefined,
        })),
      )
      const recipientCount = new Set(csvMatches.map((match) => match.email)).size
      toast.success(
        `Sent ${csvMatches.length} document${csvMatches.length === 1 ? '' : 's'} to ${recipientCount} recipient${recipientCount === 1 ? '' : 's'}`,
      )
      onOpenChange(false)
      return
    }

    if (!isValidEmail(recipient)) {
      toast.error('Enter a valid client email to send to')
      return
    }

    sendDocuments(
      documents.map((doc) => ({ id: doc.id, sentTo: recipient, recipientName: recipientName || undefined })),
    )
    if (isBatch) {
      toast.success(`Sent ${documents.length} documents to ${recipient}`)
    } else {
      toast.success(singleDoc?.sentTo ? `Resent to ${recipient}` : `Sent to ${recipient}`)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-[94vw] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl',
          isBatch && batchMode === 'csv' && 'sm:max-w-3xl',
        )}
      >
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border px-7 py-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-primary/10">
            <Send className="size-5 text-primary" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <DialogTitle className="truncate text-[16px]">
              {isBatch ? `Send ${documents.length} documents` : singleDoc?.sentTo ? 'Resend to client' : 'Send to client'}
            </DialogTitle>
            <span className="truncate font-mono text-[11.5px] text-muted-foreground">
              {isBatch
                ? `${documents.length} files · ${documents.reduce((sum, d) => sum + d.pages, 0)} pages`
                : `${singleDoc?.pages} pages${singleDoc?.passwordProtected ? ' · protected' : ''}`}
            </span>
          </div>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto p-7">
          {isBatch && (
            <div className="flex h-10 w-fit items-center gap-1 rounded-[10px] bg-secondary p-1">
              {(
                [
                  { value: 'same', label: 'Same recipient' },
                  { value: 'csv', label: 'Upload recipient file' },
                ] as { value: BatchMode; label: string }[]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setBatchMode(option.value)}
                  className={cn(
                    'h-8 rounded-[8px] px-3.5 text-[12.5px] font-semibold transition-colors',
                    batchMode === option.value
                      ? 'bg-linear-to-br from-primary to-[#2f93c0] text-white shadow-none'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {(!isBatch || batchMode === 'same') && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="send-recipient" className="text-[12.5px] font-semibold">
                  Client email
                </Label>
                <Input
                  id="send-recipient"
                  type="email"
                  placeholder="client@company.com"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="h-10 rounded-[9px]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="send-recipient-name" className="text-[12.5px] font-semibold">
                  Client name <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="send-recipient-name"
                  placeholder="Used to personalize the greeting"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="h-10 rounded-[9px]"
                />
              </div>
            </div>
          )}

          {isBatch && batchMode === 'csv' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 rounded-[12px] border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-accent">
                    <Upload className="size-4 text-primary" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[12.5px] font-semibold">
                      {csvFileName || 'Upload a filled recipient template'}
                    </span>
                    <span className="text-[11.5px] text-muted-foreground">
                      Columns: File Name, Client Name, Client Email, Password
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 rounded-[8px] bg-secondary px-3 font-semibold hover:bg-secondary/70"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="size-3.5" />
                    Download template
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleCsvFile(file)
                      e.target.value = ''
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 rounded-[8px] border-none bg-primary px-3 font-semibold hover:bg-primary/90"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-3.5" />
                    Upload
                  </Button>
                </div>
              </div>

              {csvErrors.length > 0 && (
                <div className="flex flex-col gap-1 rounded-[10px] bg-warning/10 p-3.5 text-[12px] text-warning">
                  {csvErrors.map((error) => (
                    <span key={`${error.line}-${error.message}`} className="flex items-center gap-1.5">
                      <AlertTriangle className="size-3 shrink-0" />
                      Row {error.line}: {error.message}
                    </span>
                  ))}
                </div>
              )}

              {(csvMatches.length > 0 || csvUnmatched.length > 0) && (
                <div className="overflow-hidden rounded-[12px] border border-border">
                  <div className="max-h-56 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="h-10 pl-4 text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                            File
                          </TableHead>
                          <TableHead className="h-10 text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                            Client
                          </TableHead>
                          <TableHead className="h-10 text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                            Password
                          </TableHead>
                          <TableHead className="h-10 pr-4 text-right text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvMatches.map((match) => (
                          <TableRow key={match.docId} className="border-border">
                            <TableCell className="max-w-40 truncate py-2.5 pl-4 text-[12px] font-medium">
                              {match.docName}
                            </TableCell>
                            <TableCell className="max-w-40 truncate py-2.5 font-mono text-[11.5px] text-muted-foreground">
                              {match.clientName ? `${match.clientName} · ${match.email}` : match.email}
                            </TableCell>
                            <TableCell className="py-2.5 text-[11.5px] text-muted-foreground">
                              {match.password ? '••••••••' : '—'}
                            </TableCell>
                            <TableCell className="py-2.5 pr-4 text-right">
                              <span className="inline-flex items-center gap-1 rounded-full bg-success/11 px-2 py-0.5 text-[10.5px] font-semibold text-success">
                                <CheckCircle2 className="size-3" />
                                Ready
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        {csvUnmatched.map((row) => (
                          <TableRow key={row.fileName} className="border-border">
                            <TableCell className="max-w-40 truncate py-2.5 pl-4 text-[12px] font-medium text-muted-foreground">
                              {row.fileName}
                            </TableCell>
                            <TableCell colSpan={2} className="py-2.5 text-[11.5px] text-muted-foreground">
                              {row.reason}
                            </TableCell>
                            <TableCell className="py-2.5 pr-4 text-right">
                              <span className="inline-flex items-center gap-1 rounded-full bg-warning/12 px-2 py-0.5 text-[10.5px] font-semibold text-warning">
                                <AlertTriangle className="size-3" />
                                Skipped
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {csvMatches.length > 0 && missingDocs.length > 0 && (
                <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <AlertTriangle className="size-3.5 shrink-0 text-warning" />
                  {missingDocs.length} of {documents.length} selected file{missingDocs.length === 1 ? '' : 's'} aren't in
                  this template and won't be sent.
                </span>
              )}
            </div>
          )}

          <MessageFields
            idPrefix="send"
            subject={subject}
            onSubjectChange={setSubject}
            body={body}
            onBodyChange={setBody}
            vars={previewVars}
            recipientEmail={batchMode === 'csv' ? csvMatches[0]?.email : recipient}
            attachmentLabel={`${documents.length} PDF${documents.length === 1 ? '' : 's'} attached${batchMode === 'csv' ? ' · one email per recipient' : ''}`}
            showPasswordToggle={withStoredPassword.length > 0}
            includePassword={includePassword}
            onIncludePasswordChange={setIncludePassword}
            passwordUnknown={batchMode !== 'csv' && withoutStoredPassword.length > 0}
          />
        </div>

        <DialogFooter className="-mx-0 -mb-0 gap-2 rounded-b-2xl border-t border-border bg-secondary/30 px-7 py-4">
          <Button
            variant="ghost"
            className="h-10 gap-1.5 rounded-[10px] bg-secondary font-semibold hover:bg-secondary/70"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="h-10 gap-1.5 rounded-[10px] border-none bg-primary font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90"
            onClick={handleSend}
          >
            <Send className="size-4" />
            {isBatch && batchMode === 'csv'
              ? `Send to ${csvMatches.length} recipient${csvMatches.length === 1 ? '' : 's'}`
              : isBatch
                ? `Send ${documents.length} documents`
                : singleDoc?.sentTo
                  ? 'Resend'
                  : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
