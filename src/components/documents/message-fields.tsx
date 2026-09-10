import { useRef } from 'react'
import { AlertTriangle, Lock, Paperclip } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { MESSAGE_VARIABLES, PASSWORD_LINE_TEMPLATE, renderTemplate, type TemplateVars } from '@/lib/message-template'

const FROM_ADDRESS = 'no-reply@kdksoftware.com'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'KS'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

function insertAtCursor(el: HTMLInputElement | HTMLTextAreaElement, token: string, value: string, onChange: (v: string) => void) {
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? value.length
  const next = value.slice(0, start) + token + value.slice(end)
  onChange(next)
  requestAnimationFrame(() => {
    el.focus()
    const caret = start + token.length
    el.setSelectionRange(caret, caret)
  })
}

interface VariableChipsProps {
  onInsert: (token: string) => void
  disabled?: boolean
}

function VariableChips({ onInsert, disabled }: VariableChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10.5px] font-medium text-muted-foreground">Insert:</span>
      {MESSAGE_VARIABLES.map((variable) => (
        <button
          key={variable.token}
          type="button"
          disabled={disabled}
          onClick={() => onInsert(variable.token)}
          className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10.5px] font-medium text-muted-foreground hover:bg-secondary/70 hover:text-foreground disabled:opacity-50"
        >
          {variable.label}
        </button>
      ))}
    </div>
  )
}

interface MessageFieldsProps {
  subject: string
  onSubjectChange: (v: string) => void
  body: string
  onBodyChange: (v: string) => void
  vars: TemplateVars
  /** Who the inbox preview shows this going to — falls back to a placeholder when not chosen yet. */
  recipientEmail?: string
  attachmentLabel: string
  /** Document(s) are protected and a password is on record — shows the include-password toggle. */
  showPasswordToggle: boolean
  includePassword: boolean
  onIncludePasswordChange: (v: boolean) => void
  /** Document(s) are protected but no password is on record — shows a warning instead. */
  passwordUnknown?: boolean
  disabled?: boolean
  idPrefix: string
}

export function MessageFields({
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  vars,
  recipientEmail,
  attachmentLabel,
  showPasswordToggle,
  includePassword,
  onIncludePasswordChange,
  passwordUnknown,
  disabled,
  idPrefix,
}: MessageFieldsProps) {
  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const previewSubject = renderTemplate(subject, vars)
  const previewBody = renderTemplate(body, vars)
  const previewPasswordLine =
    includePassword && vars.password ? renderTemplate(PASSWORD_LINE_TEMPLATE, vars) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${idPrefix}-subject`} className="text-[12.5px] font-semibold">
            Subject
          </Label>
          <VariableChips disabled={disabled} onInsert={(token) => subjectRef.current && insertAtCursor(subjectRef.current, token, subject, onSubjectChange)} />
        </div>
        <Input
          id={`${idPrefix}-subject`}
          ref={subjectRef}
          value={subject}
          disabled={disabled}
          onChange={(e) => onSubjectChange(e.target.value)}
          className="h-10 rounded-[9px] font-mono text-[12.5px]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${idPrefix}-body`} className="text-[12.5px] font-semibold">
            Message
          </Label>
          <VariableChips disabled={disabled} onInsert={(token) => bodyRef.current && insertAtCursor(bodyRef.current, token, body, onBodyChange)} />
        </div>
        <Textarea
          id={`${idPrefix}-body`}
          ref={bodyRef}
          value={body}
          disabled={disabled}
          onChange={(e) => onBodyChange(e.target.value)}
          className="min-h-28 rounded-[9px] font-mono text-[12.5px]"
        />
      </div>

      {showPasswordToggle && (
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-border p-3.5">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
            <Lock className="size-3.5 shrink-0 text-primary" />
            Include password in this email
          </span>
          <Switch checked={includePassword} onCheckedChange={onIncludePasswordChange} disabled={disabled} />
        </div>
      )}

      {passwordUnknown && (
        <span className="flex items-center gap-1.5 rounded-[12px] border border-warning/25 bg-warning/[0.06] p-3.5 text-[12px] text-warning">
          <AlertTriangle className="size-3.5 shrink-0" />
          Protected, but no password is on record — share it with the client separately.
        </span>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
          Inbox preview
        </span>
        <div className="overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_1px_2px_rgba(20,32,42,.04)]">
          <div className="flex items-start gap-2.5 border-b border-border p-3.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-[#2f93c0] text-[10.5px] font-bold text-primary-foreground">
              {initials(vars.firmName)}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[12.5px] font-semibold">{vars.firmName}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">now</span>
              </div>
              <span className="truncate font-mono text-[10.5px] text-muted-foreground">{FROM_ADDRESS}</span>
              <span className="truncate font-mono text-[10.5px] text-muted-foreground">
                to {recipientEmail?.trim() || 'client@company.com'}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-3 p-3.5">
            <span className="text-[13px] font-semibold">{previewSubject}</span>
            <p className="whitespace-pre-line text-[12px] leading-relaxed text-secondary-foreground">
              {previewBody}
              {previewPasswordLine ? `\n\n${previewPasswordLine}` : ''}
            </p>
            <span className="flex w-fit items-center gap-1.5 rounded-[8px] bg-secondary px-2.5 py-1.5 text-[10.5px] font-medium text-muted-foreground">
              <Paperclip className="size-3 shrink-0" />
              {attachmentLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
