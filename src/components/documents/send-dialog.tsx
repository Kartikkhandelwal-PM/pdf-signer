import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Lock,
  MailCheck,
  Paperclip,
  RotateCw,
  Send,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'

import { EmailPreview } from '@/components/documents/email-preview'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { useDocuments, type SendUpdate } from '@/context/documents-context'
import { FIRM_PROFILE } from '@/lib/firm'
import {
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_SUBJECT_TEMPLATE,
  MESSAGE_VARIABLES,
  renderTemplate,
  type TemplateVars,
} from '@/lib/message-template'
import {
  buildRecipientTemplateCsv,
  downloadCsv,
  isValidEmail,
  matchRecipientRows,
  parseRecipientCsv,
  type RecipientMatch,
  type RecipientRowError,
  type UnmatchedRow,
} from '@/lib/recipients'
import { cn } from '@/lib/utils'
import type { SignedDocument } from '@/types'

type SendMode = 'single' | 'csv'
type Phase = 'compose' | 'sending' | 'sent'

interface SendDialogProps {
  documents: SignedDocument[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** One actual email leaving the outbox — a recipient plus the files attached to their copy. */
interface OutgoingEmail {
  email: string
  clientName: string
  docs: SignedDocument[]
}

// The password itself is never emailed. What the client gets is how to build it themselves —
// these are the conventions Indian filings use; the sender can type anything else instead.
const PASSWORD_HINT_PRESETS: { label: string; hint: string }[] = [
  { label: 'PAN + DOB', hint: 'your PAN in lowercase followed by your date of birth in DDMMYYYY format' },
  { label: 'Date of birth', hint: 'your date of birth in DDMMYYYY format' },
  { label: 'PAN in caps', hint: 'your PAN in capital letters' },
  { label: 'Shared separately', hint: 'the password already shared with you separately' },
]

function pluralize(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function insertAtCursor(el: HTMLTextAreaElement, token: string, value: string, onChange: (v: string) => void) {
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? value.length
  onChange(value.slice(0, start) + token + value.slice(end))
  requestAnimationFrame(() => {
    el.focus()
    const caret = start + token.length
    el.setSelectionRange(caret, caret)
  })
}

export function SendDialog({ documents, open, onOpenChange }: SendDialogProps) {
  const { sendDocuments } = useDocuments()
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<number | null>(null)

  const isBatch = documents.length > 1
  const singleDoc = documents.length === 1 ? documents[0] : null

  const [mode, setMode] = useState<SendMode>('single')
  const [recipient, setRecipient] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [subject, setSubject] = useState(DEFAULT_SUBJECT_TEMPLATE)
  const [body, setBody] = useState(DEFAULT_BODY_TEMPLATE)
  const [passwordHint, setPasswordHint] = useState(PASSWORD_HINT_PRESETS[0].hint)
  const [submitted, setSubmitted] = useState(false)

  const [csvFileName, setCsvFileName] = useState('')
  const [csvMatches, setCsvMatches] = useState<RecipientMatch[]>([])
  const [csvUnmatched, setCsvUnmatched] = useState<UnmatchedRow[]>([])
  const [csvErrors, setCsvErrors] = useState<RecipientRowError[]>([])

  const [previewIndex, setPreviewIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('compose')
  const [delivered, setDelivered] = useState(0)

  function stopTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => stopTimer, [])

  // Only re-derive from `documents` at the moment the dialog opens, so typing inside it never
  // gets clobbered by a parent re-render (same pattern as the document detail dialog).
  useEffect(() => {
    if (!open) return
    stopTimer()
    const commonRecipient = documents.every((doc) => doc.sentTo && doc.sentTo === documents[0].sentTo)
      ? documents[0].sentTo
      : undefined
    setMode('single')
    setRecipient(singleDoc?.sentTo ?? commonRecipient ?? '')
    setRecipientName(singleDoc?.recipientName ?? singleDoc?.client ?? '')
    setSubject(DEFAULT_SUBJECT_TEMPLATE)
    setBody(DEFAULT_BODY_TEMPLATE)
    setPasswordHint(PASSWORD_HINT_PRESETS[0].hint)
    setSubmitted(false)
    setCsvFileName('')
    setCsvMatches([])
    setCsvUnmatched([])
    setCsvErrors([])
    setPreviewIndex(0)
    setPhase('compose')
    setDelivered(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const hasProtected = documents.some((doc) => doc.passwordProtected)
  const coveredIds = new Set(csvMatches.map((match) => match.docId))
  const missingCount = documents.filter((doc) => !coveredIds.has(doc.id)).length
  const totalPages = documents.reduce((sum, doc) => sum + doc.pages, 0)

  // Every email that will actually leave the outbox. One client can own several files, so CSV
  // rows are grouped by address — they get a single email with all their documents attached.
  const outgoing = useMemo<OutgoingEmail[]>(() => {
    if (mode !== 'csv') {
      return [{ email: recipient.trim(), clientName: recipientName, docs: documents }]
    }
    const docById = new Map(documents.map((doc) => [doc.id, doc]))
    const byEmail = new Map<string, OutgoingEmail>()
    for (const match of csvMatches) {
      const doc = docById.get(match.docId)
      if (!doc) continue
      const key = match.email.trim().toLowerCase()
      const entry = byEmail.get(key) ?? { email: match.email.trim(), clientName: match.clientName, docs: [] }
      entry.clientName = entry.clientName || match.clientName
      entry.docs.push(doc)
      byEmail.set(key, entry)
    }
    return [...byEmail.values()]
  }, [mode, csvMatches, documents, recipient, recipientName])

  const activeIndex = Math.min(previewIndex, Math.max(outgoing.length - 1, 0))
  const preview = outgoing[activeIndex] as OutgoingEmail | undefined
  const previewDocs = preview?.docs.length ? preview.docs : documents
  const hintForEmail = hasProtected && passwordHint.trim().length > 0 ? passwordHint.trim() : undefined

  const previewVars: TemplateVars = {
    clientName: preview?.clientName ?? '',
    documentName: previewDocs.length === 1 ? previewDocs[0].name : pluralize(previewDocs.length, 'document'),
    firmName: FIRM_PROFILE.name,
  }

  const recipientError =
    submitted && mode === 'single' && !isValidEmail(recipient)
      ? recipient.trim().length === 0
        ? 'Enter the client email this should go to.'
        : "That doesn't look like a valid email address."
      : null

  const canSend = mode === 'csv' ? csvMatches.length > 0 : isValidEmail(recipient)

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
    setPreviewIndex(0)
    if (matches.length > 0) {
      toast.success(`${pluralize(matches.length, 'file')} matched to a recipient`)
    } else {
      toast.error('No rows in that file matched the selected documents')
    }
  }

  function handleSend() {
    setSubmitted(true)
    if (!canSend) {
      if (mode === 'csv') toast.error('Upload a filled-in recipient list first')
      return
    }

    const updates: SendUpdate[] =
      mode === 'csv'
        ? csvMatches.map((match) => ({
            id: match.docId,
            sentTo: match.email,
            recipientName: match.clientName || undefined,
          }))
        : documents.map((doc) => ({
            id: doc.id,
            sentTo: recipient.trim(),
            recipientName: recipientName.trim() || undefined,
          }))

    const total = outgoing.length
    const step = total > 6 ? 140 : total > 1 ? 300 : 700
    setPhase('sending')
    setDelivered(0)
    let done = 0
    stopTimer()
    timerRef.current = window.setInterval(() => {
      done += 1
      setDelivered(done)
      if (done >= total) {
        stopTimer()
        sendDocuments(updates)
        setPhase('sent')
        toast.success(total === 1 ? `Email sent to ${outgoing[0].email}` : `${pluralize(total, 'email')} sent`)
      }
    }, step)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={phase === 'compose'}
        className={cn(
          'grid max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none',
          // Composing needs the full workspace; delivering only needs a small panel, so the
          // dialog shrinks rather than leaving a half-empty box behind the progress.
          phase === 'compose' ? 'h-[min(90vh,700px)] w-[min(1020px,96vw)]' : 'w-[min(460px,94vw)]',
        )}
      >
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border px-6 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-linear-to-br from-primary to-[#2f93c0] text-white">
            <Send className="size-[18px]" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <DialogTitle className="truncate text-[15.5px]">
              {isBatch
                ? `Send ${pluralize(documents.length, 'document')}`
                : singleDoc?.sentTo
                  ? 'Resend to client'
                  : 'Send to client'}
            </DialogTitle>
            <DialogDescription className="truncate font-mono text-[11px]">
              From {FIRM_PROFILE.fromAddress}
            </DialogDescription>
          </div>
        </DialogHeader>

        {phase === 'compose' ? (
          <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_390px]">
            {/* ---------- Compose ---------- */}
            <div className="flex min-h-0 flex-col">
              <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-6 py-5">
                {isBatch && (
                  <div className="flex h-9 w-fit items-center gap-1 rounded-[9px] bg-secondary p-1">
                    {(
                      [
                        { value: 'single', label: 'One recipient' },
                        { value: 'csv', label: 'A recipient per file' },
                      ] as { value: SendMode; label: string }[]
                    ).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setMode(option.value)}
                        className={cn(
                          'h-7 rounded-[7px] px-4 text-[12px] font-semibold transition-colors',
                          mode === option.value
                            ? 'bg-linear-to-br from-primary to-[#2f93c0] text-white'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}

                {mode === 'single' ? (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.3fr_1fr]">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="send-recipient" className="text-[11.5px] font-semibold">
                          Client email
                        </Label>
                        <Input
                          id="send-recipient"
                          type="email"
                          placeholder="client@company.com"
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          className={cn('h-9 rounded-[9px]', recipientError && 'border-destructive')}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="send-recipient-name" className="text-[11.5px] font-semibold">
                          Client name <span className="font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="send-recipient-name"
                          placeholder="Used in the greeting"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          className="h-9 rounded-[9px]"
                        />
                      </div>
                    </div>
                    {recipientError && (
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-destructive">
                        <AlertTriangle className="size-3 shrink-0" />
                        {recipientError}
                      </span>
                    )}
                    {!recipientError && singleDoc?.sentTo && (
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <MailCheck className="size-3.5 shrink-0 text-success" />
                        Already sent to <span className="font-mono text-foreground">{singleDoc.sentTo}</span> — this
                        delivers a fresh copy.
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-2 rounded-[10px] border border-dashed border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-[12px] font-medium">
                          {csvFileName || 'Recipient list (CSV)'}
                        </span>
                        <span className="truncate text-[10.5px] text-muted-foreground">
                          {csvFileName
                            ? `${csvMatches.length} of ${documents.length} files matched to a client`
                            : 'Columns: file name, client name, client email'}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 rounded-[8px] bg-secondary px-2.5 text-[11.5px] font-semibold hover:bg-secondary/70"
                          onClick={() => {
                            downloadCsv(
                              'recipient-list.csv',
                              buildRecipientTemplateCsv(documents.map((doc) => ({ name: doc.name }))),
                            )
                            toast.success('Template downloaded')
                          }}
                        >
                          <Download className="size-3.5" />
                          Template
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
                          className="h-8 gap-1.5 rounded-[8px] border-none bg-primary px-2.5 text-[11.5px] font-semibold hover:bg-primary/90"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="size-3.5" />
                          {csvFileName ? 'Replace' : 'Upload'}
                        </Button>
                      </div>
                    </div>

                    {(csvErrors.length > 0 || csvUnmatched.length > 0 || missingCount > 0) && csvFileName && (
                      <span className="flex items-start gap-1.5 text-[11px] text-warning">
                        <AlertTriangle className="mt-px size-3 shrink-0" />
                        {[
                          csvUnmatched.length > 0 && `${pluralize(csvUnmatched.length, 'row')} skipped`,
                          csvErrors.length > 0 && `${pluralize(csvErrors.length, 'row')} unreadable`,
                          missingCount > 0 && `${missingCount} not in the list`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}{' '}
                        — those files won't be sent.
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="send-subject" className="text-[11.5px] font-semibold">
                    Subject
                  </Label>
                  <Input
                    id="send-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="h-9 rounded-[9px] text-[12.5px]"
                  />
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="send-body" className="text-[11.5px] font-semibold">
                      Message
                    </Label>
                    <div className="flex items-center gap-1">
                      {MESSAGE_VARIABLES.map((variable) => (
                        <button
                          key={variable.token}
                          type="button"
                          title={`Insert ${variable.token}`}
                          onClick={() =>
                            bodyRef.current && insertAtCursor(bodyRef.current, variable.token, body, setBody)
                          }
                          className="rounded-[6px] bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                        >
                          {variable.label}
                        </button>
                      ))}
                      {(subject !== DEFAULT_SUBJECT_TEMPLATE || body !== DEFAULT_BODY_TEMPLATE) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSubject(DEFAULT_SUBJECT_TEMPLATE)
                            setBody(DEFAULT_BODY_TEMPLATE)
                          }}
                          className="ml-1 flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                        >
                          <RotateCw className="size-2.5" />
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                  <Textarea
                    id="send-body"
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="min-h-24 flex-1 resize-none rounded-[9px] text-[12.5px] leading-relaxed"
                  />
                </div>

                {hasProtected && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label htmlFor="send-hint" className="flex items-center gap-1.5 text-[11.5px] font-semibold">
                        <Lock className="size-3 text-primary" />
                        How to open the PDF
                      </Label>
                      <div className="flex flex-wrap items-center gap-1">
                        {PASSWORD_HINT_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setPasswordHint(preset.hint)}
                            className={cn(
                              'rounded-[6px] px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                              passwordHint === preset.hint
                                ? 'bg-primary/10 text-primary'
                                : 'bg-secondary text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Input
                      id="send-hint"
                      value={passwordHint}
                      onChange={(e) => setPasswordHint(e.target.value)}
                      placeholder="Leave blank to say nothing about the password"
                      className="h-9 rounded-[9px] text-[12.5px]"
                    />
                    <span className="text-[10.5px] text-muted-foreground">
                      The password itself is never emailed — only this description.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ---------- Live preview ---------- */}
            <aside className="hidden min-h-0 flex-col border-l border-border bg-secondary/35 lg:flex">
              <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
                <span className="text-[10.5px] font-semibold tracking-[0.09em] text-muted-foreground/70 uppercase">
                  Preview
                </span>
                {outgoing.length > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 rounded-[7px] hover:bg-background"
                      onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                      disabled={activeIndex === 0}
                    >
                      <ChevronLeft className="size-3.5" />
                    </Button>
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      {activeIndex + 1}/{outgoing.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 rounded-[7px] hover:bg-background"
                      onClick={() => setPreviewIndex((i) => Math.min(outgoing.length - 1, i + 1))}
                      disabled={activeIndex >= outgoing.length - 1}
                    >
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="relative min-h-0 flex-1">
                <div className="h-full overflow-y-auto p-4">
                  <EmailPreview
                    firm={FIRM_PROFILE}
                    toEmail={preview?.email}
                    subject={renderTemplate(subject, previewVars)}
                    body={renderTemplate(body, previewVars)}
                    passwordHint={hintForEmail}
                    attachments={previewDocs.map((doc) => ({ name: doc.name, pages: doc.pages }))}
                  />
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-secondary/90 to-transparent" />
              </div>
            </aside>
          </div>
        ) : (
          <DeliveryPanel phase={phase} outgoing={outgoing} delivered={delivered} />
        )}

        <DialogFooter className="-mx-0 -mb-0 gap-3 rounded-b-2xl border-t border-border bg-secondary/40 px-6 py-3.5 sm:items-center sm:justify-between">
          {phase === 'sent' ? (
            <>
              <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-success">
                <CheckCircle2 className="size-3.5" />
                Delivery complete
              </span>
              <Button
                className="h-10 rounded-[10px] border-none bg-primary px-6 font-semibold hover:bg-primary/90"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <span className="hidden items-center gap-1.5 font-mono text-[11px] text-muted-foreground sm:flex">
                <Paperclip className="size-3 shrink-0" />
                {canSend
                  ? `${pluralize(outgoing.length, 'email')} · ${pluralize(documents.length, 'PDF')} · ${pluralize(totalPages, 'page')}`
                  : mode === 'csv'
                    ? 'Upload a recipient list to continue'
                    : 'Add a client email to continue'}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  disabled={phase === 'sending'}
                  className="h-10 rounded-[10px] bg-secondary px-4 font-semibold hover:bg-secondary/70"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={phase === 'sending'}
                  className="h-10 min-w-32 gap-1.5 rounded-[10px] border-none bg-primary px-5 font-semibold shadow-[0_4px_12px_-5px_rgba(29,110,150,.7)] hover:bg-primary/90"
                  onClick={handleSend}
                >
                  {phase === 'sending' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      {mode === 'csv' && csvMatches.length > 0
                        ? `Send ${pluralize(outgoing.length, 'email')}`
                        : singleDoc?.sentTo
                          ? 'Resend'
                          : 'Send'}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The sending / sent takeover — each email handing off to the SMTP relay in turn. */
function DeliveryPanel({
  phase,
  outgoing,
  delivered,
}: {
  phase: Phase
  outgoing: OutgoingEmail[]
  delivered: number
}) {
  const total = outgoing.length
  const pct = total === 0 ? 0 : Math.round((delivered / total) * 100)
  const done = phase === 'sent'

  return (
    <div className="flex min-h-0 flex-col items-center overflow-y-auto px-6 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <div
          className={cn(
            'flex size-14 items-center justify-center rounded-full text-white',
            done ? 'bg-success' : 'bg-linear-to-br from-primary to-[#2f93c0]',
          )}
        >
          {done ? (
            <MailCheck className="size-6 animate-in zoom-in-50 duration-300" />
          ) : (
            <Loader2 className="size-6 animate-spin" />
          )}
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <span className="font-heading text-[16.5px] font-semibold">
            {done
              ? total === 1
                ? 'Email sent'
                : `${pluralize(total, 'email')} sent`
              : total === 1
                ? 'Sending email…'
                : `Sending ${pluralize(total, 'email')}…`}
          </span>
          <span className="text-[12.5px] break-all text-muted-foreground">
            {done
              ? total === 1
                ? `Delivered to ${outgoing[0].email}`
                : `Delivered to ${pluralize(total, 'recipient')}`
              : `Handing off to ${FIRM_PROFILE.smtpHost}.`}
          </span>
        </div>

        {total > 1 && (
          <div className="flex w-full flex-col gap-1.5 pt-1">
            <Progress value={pct} className={cn('h-1.5', done && '[&_[data-slot=progress-indicator]]:bg-success')} />
            <span className="text-center font-mono text-[10.5px] text-muted-foreground">
              {delivered} of {total} sent
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
