import { Fragment } from 'react'
import { Forward, Paperclip, Reply, Star } from 'lucide-react'

import { firmInitials, type FirmProfile } from '@/lib/firm'
import { cn } from '@/lib/utils'

/**
 * The message as it actually lands in the client's mail app — window chrome, subject, sender
 * line, the email itself, Gmail-style attachment cards and a reply bar. The point is that the
 * sender can judge the real thing, so this is styled as a mail client, not as another panel of
 * the app.
 *
 * Colours are fixed rather than theme tokens because a mail app paints this on its own white
 * canvas; rendering it in the app's dark theme would preview something nobody receives. Body
 * copy uses the Arial/Helvetica stack that mail clients fall back to, for the same reason.
 */

export interface PreviewAttachment {
  name: string
  pages: number
}

interface EmailPreviewProps {
  firm: FirmProfile
  toEmail?: string
  subject: string
  body: string
  /** How the client can work out the PDF password — never the password itself. */
  passwordHint?: string
  attachments: PreviewAttachment[]
  className?: string
}

const INK = '#1f2b36'
const MUTED = '#6b7f8d'
const HAIRLINE = '#e3ebf0'
const MAIL_FONT = 'Arial, Helvetica, sans-serif'

function clockTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/** A miniature PDF page, the way a mail client renders an attachment thumbnail. */
function PdfThumb() {
  return (
    <div
      className="flex h-[52px] w-[38px] flex-col gap-[3px] rounded-[2px] bg-white p-[5px]"
      style={{ boxShadow: '0 1px 3px rgba(20,32,42,.18)' }}
    >
      <div className="h-[3px] w-3/4 rounded-full" style={{ background: '#dbe6ec' }} />
      <div className="h-[2px] w-full rounded-full" style={{ background: '#eaf1f5' }} />
      <div className="h-[2px] w-full rounded-full" style={{ background: '#eaf1f5' }} />
      <div className="h-[2px] w-2/3 rounded-full" style={{ background: '#eaf1f5' }} />
      <div className="mt-auto h-[8px] w-3/5 rounded-[1px] border border-dashed" style={{ borderColor: '#9dc4d8' }} />
    </div>
  )
}

function PasswordLine({ hint }: { hint: string }) {
  return (
    <div className="py-0.5 pl-3" style={{ borderLeft: '3px solid #e8b84b' }}>
      <span className="text-[12px] leading-[1.6]" style={{ color: INK }}>
        The attached PDF is password protected. To open it, enter <span className="font-bold">{hint}</span>.
      </span>
    </div>
  )
}

export function EmailPreview({
  firm,
  toEmail,
  subject,
  body,
  passwordHint,
  attachments,
  className,
}: EmailPreviewProps) {
  const paragraphs = body.split(/\n{2,}/).filter((block) => block.trim().length > 0)
  // The password line belongs in the message, above the sign-off — never stranded after
  // "Regards, …" — so it goes in just before the closing paragraph.
  const hintIndex = paragraphs.length > 1 ? paragraphs.length - 1 : paragraphs.length
  const totalPages = attachments.reduce((sum, file) => sum + file.pages, 0)

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-[10px] bg-white ring-1 ring-black/[0.09]',
        'shadow-[0_2px_4px_rgba(20,32,42,.06),0_20px_44px_-26px_rgba(20,32,42,.45)]',
        className,
      )}
    >
      {/* Mail app window bar */}
      <div
        className="flex items-center gap-1.5 px-3 py-2"
        style={{ background: '#f1f5f7', borderBottom: `1px solid ${HAIRLINE}` }}
      >
        <span className="size-[7px] rounded-full" style={{ background: '#ff5f57' }} />
        <span className="size-[7px] rounded-full" style={{ background: '#febc2e' }} />
        <span className="size-[7px] rounded-full" style={{ background: '#28c840' }} />
        <span className="mx-auto truncate pr-6 text-[9.5px]" style={{ color: MUTED }}>
          Inbox — {toEmail?.trim() || 'client@company.com'}
        </span>
      </div>

      {/* Subject + sender */}
      <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-3">
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-[14.5px] leading-snug font-semibold" style={{ color: INK }}>
            {subject.trim() || '(no subject)'}
          </span>
          <span
            className="mt-0.5 shrink-0 rounded-[4px] px-1.5 py-0.5 text-[8.5px] font-semibold tracking-wide uppercase"
            style={{ background: '#eaf1f5', color: MUTED }}
          >
            Inbox
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#1d6e96] to-[#2f93c0] text-[10px] font-bold text-white">
            {firmInitials(firm.fromName)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[11.5px] font-semibold" style={{ color: INK }}>
              {firm.fromName}{' '}
              <span className="text-[10px] font-normal" style={{ color: MUTED }}>
                &lt;{firm.fromAddress}&gt;
              </span>
            </span>
            <span className="truncate text-[10px]" style={{ color: MUTED }}>
              to me
            </span>
          </div>
          <span className="shrink-0 text-[9.5px]" style={{ color: MUTED }}>
            {clockTime()}
          </span>
          <Star className="size-3.5 shrink-0" style={{ color: '#c3d1da' }} />
        </div>
      </div>

      {/* The message */}
      <div
        className="flex flex-col gap-3 px-4 pt-3.5 pb-4"
        style={{ borderTop: `1px solid ${HAIRLINE}`, fontFamily: MAIL_FONT }}
      >
        {paragraphs.length === 0 && (
          <p className="text-[12.5px] italic" style={{ color: MUTED }}>
            Your message will appear here.
          </p>
        )}

        {paragraphs.map((block, index) => (
          <Fragment key={index}>
            {passwordHint && index === hintIndex && <PasswordLine hint={passwordHint} />}
            <p className="text-[12.5px] leading-[1.65] whitespace-pre-line" style={{ color: INK }}>
              {block}
            </p>
          </Fragment>
        ))}

        {passwordHint && hintIndex >= paragraphs.length && <PasswordLine hint={passwordHint} />}

      </div>

      {/* Attachments, rendered the way a mail client cards them */}
      {attachments.length > 0 && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          <span className="flex items-center gap-1.5 text-[10px]" style={{ color: MUTED }}>
            <Paperclip className="size-3" />
            {attachments.length} attachment{attachments.length === 1 ? '' : 's'} · {totalPages} page
            {totalPages === 1 ? '' : 's'}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {attachments.slice(0, 4).map((file) => (
              <div
                key={file.name}
                className="overflow-hidden rounded-[7px]"
                style={{ border: `1px solid ${HAIRLINE}` }}
              >
                <div className="flex h-[70px] items-center justify-center" style={{ background: '#f5f9fb' }}>
                  <PdfThumb />
                </div>
                <div
                  className="flex items-center gap-1.5 px-2 py-1.5"
                  style={{ borderTop: `1px solid ${HAIRLINE}`, background: '#fff' }}
                >
                  <span
                    className="shrink-0 rounded-[3px] px-1 text-[7.5px] font-bold text-white"
                    style={{ background: '#d0483a' }}
                  >
                    PDF
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[9.5px] font-medium" style={{ color: INK }}>
                    {file.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {attachments.length > 4 && (
            <span className="text-[10px]" style={{ color: MUTED }}>
              + {attachments.length - 4} more file{attachments.length - 4 === 1 ? '' : 's'}
            </span>
          )}
        </div>
      )}

      {/* Reply bar */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        {[
          { icon: Reply, label: 'Reply' },
          { icon: Forward, label: 'Forward' },
        ].map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-medium"
            style={{ border: `1px solid ${HAIRLINE}`, color: MUTED }}
          >
            <Icon className="size-3" />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
