import { useState } from 'react'
import { Eye, EyeOff, Server, SendHorizonal, Sparkles, Webhook } from 'lucide-react'
import { toast } from 'sonner'

import { SettingsField } from '@/components/settings/settings-field'
import { OptionCard } from '@/components/shared/option-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'

type MailProvider = 'smtp' | 'zeptomail'
type Encryption = 'tls' | 'ssl' | 'none'
/** ZeptoMail can be driven either over plain SMTP or through its own Send Mail API. */
type ZeptoTransport = 'api' | 'smtp'

// ZeptoMail documents one sending host for everyone, regardless of which Zoho domain the
// account itself was registered on — so these are fixed rather than derived from a region.
const ZEPTO_SMTP_HOST = 'smtp.zeptomail.com'
const ZEPTO_API_ENDPOINT = 'https://api.zeptomail.com/v1.1/email'

// Every ZeptoMail SMTP connection authenticates with this literal username; the Mail Agent's
// token goes in the password field. Showing it read-only saves a support ticket.
const ZEPTO_SMTP_USER = 'emailapikey'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface SmtpConfig {
  host: string
  port: string
  username: string
  password: string
  fromName: string
  fromEmail: string
  encryption: Encryption
}

interface ZeptoConfig {
  transport: ZeptoTransport
  token: string
  mailAgent: string
  fromName: string
  fromEmail: string
  bounceAddress: string
  encryption: Extract<Encryption, 'tls' | 'ssl'>
}

const INITIAL_SMTP: SmtpConfig = {
  host: '',
  port: '587',
  username: '',
  password: '',
  fromName: 'KDK Softwares',
  fromEmail: '',
  encryption: 'tls',
}

const INITIAL_ZEPTO: ZeptoConfig = {
  transport: 'api',
  token: '',
  mailAgent: '',
  fromName: 'KDK Softwares',
  fromEmail: '',
  bounceAddress: '',
  encryption: 'tls',
}

/** TLS uses the submission port, SSL the implicit-TLS one — the pair is fixed, so it's derived. */
function zeptoSmtpPort(encryption: ZeptoConfig['encryption']) {
  return encryption === 'ssl' ? '465' : '587'
}

// A small read-only row for values the account's own settings decide — shown rather than left
// implicit, so what the app will actually connect to is never a guess.
function DerivedValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold">{label}</span>
      <div className="flex h-10 items-center rounded-[9px] border border-border bg-secondary/50 px-3">
        <span className="truncate font-mono text-[12px] text-muted-foreground" title={value}>
          {value}
        </span>
      </div>
    </div>
  )
}

function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  invalid?: boolean
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={invalid}
        className={cn('h-10 rounded-[9px] pr-10 font-mono', invalid && 'border-destructive')}
      />
      <button
        type="button"
        aria-label={visible ? 'Hide token' : 'Show token'}
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-[6px] text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  )
}

/** A 2- or 3-up segmented radio, matching the encryption picker the SMTP form already used. */
function SegmentedChoice<T extends string>({
  value,
  options,
  onChange,
  columns = 3,
}: {
  value: T
  options: { value: T; label: string; caption?: string }[]
  onChange: (v: T) => void
  columns?: 2 | 3
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as T)}
      className={cn('grid gap-2.5', columns === 2 ? 'grid-cols-2' : 'grid-cols-3')}
    >
      {options.map((option) => (
        <div
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-[9px] border px-3 py-2.5 transition-colors',
            value === option.value ? 'border-primary/35 bg-primary/[0.045]' : 'border-border hover:border-primary/25',
          )}
        >
          <RadioGroupItem value={option.value} />
          <div className="flex min-w-0 flex-col">
            <span className="text-[12.5px] font-medium">{option.label}</span>
            {option.caption && (
              <span className="truncate font-mono text-[10.5px] text-muted-foreground">{option.caption}</span>
            )}
          </div>
        </div>
      ))}
    </RadioGroup>
  )
}

export function EmailDeliverySettings() {
  const [provider, setProvider] = useState<MailProvider>('smtp')
  const [smtp, setSmtp] = useState<SmtpConfig>(INITIAL_SMTP)
  const [zepto, setZepto] = useState<ZeptoConfig>(INITIAL_ZEPTO)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const setSmtpField = <K extends keyof SmtpConfig>(key: K, value: SmtpConfig[K]) =>
    setSmtp((prev) => ({ ...prev, [key]: value }))
  const setZeptoField = <K extends keyof ZeptoConfig>(key: K, value: ZeptoConfig[K]) =>
    setZepto((prev) => ({ ...prev, [key]: value }))

  // Only the selected provider is validated — half-filled details for the other one shouldn't
  // block saving the one actually in use.
  function validate(): Record<string, string> {
    const next: Record<string, string> = {}

    if (provider === 'smtp') {
      if (!smtp.host.trim()) next.host = 'Enter the SMTP host.'
      const port = Number(smtp.port)
      if (!smtp.port.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
        next.port = 'Use a port between 1 and 65535.'
      }
      if (!smtp.username.trim()) next.username = 'Enter the username.'
      if (!smtp.password) next.password = 'Enter the password.'
      if (!smtp.fromName.trim()) next.fromName = 'Enter the name clients will see.'
      if (!EMAIL_RE.test(smtp.fromEmail.trim())) next.fromEmail = 'Enter a valid From address.'
      return next
    }

    if (!zepto.token.trim()) {
      next.token = zepto.transport === 'api' ? 'Paste the Send Mail token.' : 'Paste the SMTP token.'
    }
    if (!zepto.fromName.trim()) next.fromName = 'Enter the name clients will see.'
    if (!EMAIL_RE.test(zepto.fromEmail.trim())) {
      next.fromEmail = 'Enter a valid From address on a verified domain.'
    }
    // Optional, but a typo here silently breaks bounce handling, so it's checked when present.
    if (zepto.bounceAddress.trim() && !EMAIL_RE.test(zepto.bounceAddress.trim())) {
      next.bounceAddress = 'Enter a valid bounce address, or leave it empty.'
    }
    return next
  }

  /** Shared gate for both buttons — nothing is sent or saved against invalid details. */
  function withValidation(action: () => void) {
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      toast.error('Check the highlighted fields')
      return
    }
    action()
  }

  const relayLabel =
    provider === 'smtp'
      ? smtp.host || 'your SMTP server'
      : zepto.transport === 'api'
        ? 'ZeptoMail Send Mail API'
        : ZEPTO_SMTP_HOST

  return (
    <Card className="gap-5 rounded-2xl border border-border py-6 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
      <CardHeader className="px-6">
        <CardTitle className="text-[15px] font-semibold">Email delivery</CardTitle>
        <CardDescription className="text-[12.5px]">
          How signed documents and notifications reach your clients.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 px-6">
        <div className="flex flex-col gap-2.5">
          <Label className="text-[12.5px] font-semibold">Provider</Label>
          <RadioGroup
            value={provider}
            onValueChange={(v) => {
              setProvider(v as MailProvider)
              setErrors({})
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <OptionCard
              value="smtp"
              selected={provider === 'smtp'}
              onSelect={() => {
                setProvider('smtp')
                setErrors({})
              }}
              icon={Server}
              title="Custom SMTP"
              description="Any mail server — Zoho, Google Workspace, or your own relay."
            />
            <OptionCard
              value="zeptomail"
              selected={provider === 'zeptomail'}
              onSelect={() => {
                setProvider('zeptomail')
                setErrors({})
              }}
              icon={Sparkles}
              title="ZeptoMail"
              badge="Transactional"
              description="Zoho's transactional service, built for delivery receipts at volume."
            />
          </RadioGroup>
        </div>

        {provider === 'smtp' ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
              <SettingsField id="smtp-host" label="SMTP host" error={errors.host}>
                <Input
                  id="smtp-host"
                  value={smtp.host}
                  onChange={(e) => setSmtpField('host', e.target.value)}
                  placeholder="smtp.zoho.in"
                  aria-invalid={!!errors.host}
                  className={cn('h-10 rounded-[9px] font-mono', errors.host && 'border-destructive')}
                />
              </SettingsField>
              <SettingsField id="smtp-port" label="Port" error={errors.port}>
                <Input
                  id="smtp-port"
                  value={smtp.port}
                  onChange={(e) => setSmtpField('port', e.target.value)}
                  inputMode="numeric"
                  aria-invalid={!!errors.port}
                  className={cn('h-10 rounded-[9px] font-mono', errors.port && 'border-destructive')}
                />
              </SettingsField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SettingsField id="smtp-user" label="Username" error={errors.username}>
                <Input
                  id="smtp-user"
                  value={smtp.username}
                  onChange={(e) => setSmtpField('username', e.target.value)}
                  placeholder="notifications@kdksoftware.com"
                  aria-invalid={!!errors.username}
                  className={cn('h-10 rounded-[9px]', errors.username && 'border-destructive')}
                />
              </SettingsField>
              <SettingsField id="smtp-pass" label="Password" error={errors.password}>
                <SecretInput
                  id="smtp-pass"
                  value={smtp.password}
                  onChange={(v) => setSmtpField('password', v)}
                  placeholder="••••••••"
                  invalid={!!errors.password}
                />
              </SettingsField>
              <SettingsField id="smtp-from-name" label="From name" error={errors.fromName}>
                <Input
                  id="smtp-from-name"
                  value={smtp.fromName}
                  onChange={(e) => setSmtpField('fromName', e.target.value)}
                  aria-invalid={!!errors.fromName}
                  className={cn('h-10 rounded-[9px]', errors.fromName && 'border-destructive')}
                />
              </SettingsField>
              <SettingsField id="smtp-from-email" label="From email" error={errors.fromEmail}>
                <Input
                  id="smtp-from-email"
                  value={smtp.fromEmail}
                  onChange={(e) => setSmtpField('fromEmail', e.target.value)}
                  placeholder="no-reply@kdksoftware.com"
                  aria-invalid={!!errors.fromEmail}
                  className={cn('h-10 rounded-[9px]', errors.fromEmail && 'border-destructive')}
                />
              </SettingsField>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-[12.5px] font-semibold">Encryption</Label>
              <SegmentedChoice
                value={smtp.encryption}
                onChange={(v) => setSmtpField('encryption', v)}
                options={[
                  { value: 'tls', label: 'TLS' },
                  { value: 'ssl', label: 'SSL' },
                  { value: 'none', label: 'None' },
                ]}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label className="text-[12.5px] font-semibold">Connection</Label>
              <SegmentedChoice
                columns={2}
                value={zepto.transport}
                onChange={(v) => {
                  setZeptoField('transport', v)
                  setErrors({})
                }}
                options={[
                  { value: 'api', label: 'Send Mail API', caption: 'v1.1 · recommended' },
                  { value: 'smtp', label: 'SMTP relay', caption: 'port 587 / 465' },
                ]}
              />
            </div>

            {zepto.transport === 'api' ? (
              <>
                <DerivedValue label="API endpoint" value={ZEPTO_API_ENDPOINT} />
                <SettingsField
                  id="zepto-token"
                  label="Send Mail token"
                  error={errors.token}
                  hint="From your Mail Agent's Setup Info. Sent as the Zoho-enczapikey authorization header."
                >
                  <SecretInput
                    id="zepto-token"
                    value={zepto.token}
                    onChange={(v) => setZeptoField('token', v)}
                    placeholder="••••••••••••"
                    invalid={!!errors.token}
                  />
                </SettingsField>
                <SettingsField
                  id="zepto-agent"
                  label="Mail Agent"
                  hint="Optional — only needed to label which agent these sends belong to."
                >
                  <Input
                    id="zepto-agent"
                    value={zepto.mailAgent}
                    onChange={(e) => setZeptoField('mailAgent', e.target.value)}
                    placeholder="signed-documents"
                    className="h-10 rounded-[9px] font-mono"
                  />
                </SettingsField>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
                  <DerivedValue label="SMTP host" value={ZEPTO_SMTP_HOST} />
                  <DerivedValue label="Port" value={zeptoSmtpPort(zepto.encryption)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-[12.5px] font-semibold">Encryption</Label>
                  <SegmentedChoice
                    columns={2}
                    value={zepto.encryption}
                    onChange={(v) => setZeptoField('encryption', v)}
                    options={[
                      { value: 'tls', label: 'TLS', caption: 'port 587' },
                      { value: 'ssl', label: 'SSL', caption: 'port 465' },
                    ]}
                  />
                </div>
                <DerivedValue label="Username" value={ZEPTO_SMTP_USER} />
                <SettingsField
                  id="zepto-smtp-token"
                  label="SMTP token"
                  error={errors.token}
                  hint="Your Mail Agent's SMTP password. The username above is always emailapikey."
                >
                  <SecretInput
                    id="zepto-smtp-token"
                    value={zepto.token}
                    onChange={(v) => setZeptoField('token', v)}
                    placeholder="••••••••••••"
                    invalid={!!errors.token}
                  />
                </SettingsField>
              </>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SettingsField id="zepto-from-name" label="From name" error={errors.fromName}>
                <Input
                  id="zepto-from-name"
                  value={zepto.fromName}
                  onChange={(e) => setZeptoField('fromName', e.target.value)}
                  aria-invalid={!!errors.fromName}
                  className={cn('h-10 rounded-[9px]', errors.fromName && 'border-destructive')}
                />
              </SettingsField>
              <SettingsField
                id="zepto-from-email"
                label="From email"
                error={errors.fromEmail}
                hint="Must sit on a domain you've verified in ZeptoMail."
              >
                <Input
                  id="zepto-from-email"
                  value={zepto.fromEmail}
                  onChange={(e) => setZeptoField('fromEmail', e.target.value)}
                  placeholder="no-reply@kdksoftware.com"
                  aria-invalid={!!errors.fromEmail}
                  className={cn('h-10 rounded-[9px]', errors.fromEmail && 'border-destructive')}
                />
              </SettingsField>
            </div>

            <SettingsField
              id="zepto-bounce"
              label="Bounce address"
              error={errors.bounceAddress}
              hint="Optional — where ZeptoMail returns undeliverable mail."
            >
              <Input
                id="zepto-bounce"
                value={zepto.bounceAddress}
                onChange={(e) => setZeptoField('bounceAddress', e.target.value)}
                placeholder="bounces@kdksoftware.com"
                aria-invalid={!!errors.bounceAddress}
                className={cn('h-10 rounded-[9px]', errors.bounceAddress && 'border-destructive')}
              />
            </SettingsField>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Webhook className="size-3.5 shrink-0" />
            Sending through <span className="font-mono text-foreground">{relayLabel}</span>
          </span>
          <div className="flex gap-2.5">
            <Button
              variant="ghost"
              className="h-10 gap-1.5 rounded-[10px] bg-secondary px-4 font-semibold hover:bg-secondary/70"
              onClick={() =>
                withValidation(() =>
                  toast('Test email sent', {
                    description: `Sent to ${provider === 'smtp' ? smtp.fromEmail : zepto.fromEmail} via ${relayLabel}.`,
                  }),
                )
              }
            >
              <SendHorizonal className="size-4" />
              Send test email
            </Button>
            <Button
              className="h-10 gap-1.5 rounded-[10px] border-none bg-primary px-5 font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90"
              onClick={() =>
                withValidation(() =>
                  toast.success(
                    provider === 'smtp' ? 'SMTP settings saved' : 'ZeptoMail settings saved',
                  ),
                )
              }
            >
              Save changes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
