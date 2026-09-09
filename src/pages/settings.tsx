import { useState } from 'react'
import { Building2, Mail, SendHorizonal, Settings as SettingsIcon, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type SettingsTab = 'firm' | 'smtp'
type Encryption = 'tls' | 'ssl' | 'none'

function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[12.5px] font-semibold">
        {label}
      </Label>
      {children}
    </div>
  )
}

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('firm')
  const [encryption, setEncryption] = useState<Encryption>('tls')
  const [logoName, setLogoName] = useState('')

  return (
    <div className="flex flex-1 flex-col gap-5 p-5 sm:p-7">
      <PageHeader
        title="Settings"
        description="Firm profile and outgoing email configuration."
        icon={SettingsIcon}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)}>
        <TabsList className="h-11 w-fit rounded-[10px] bg-secondary p-1">
          <TabsTrigger
            value="firm"
            className="gap-1.5 rounded-[8px] px-4 text-[12.5px] font-semibold data-active:bg-linear-to-br data-active:from-primary data-active:to-[#2f93c0] data-active:text-white data-active:shadow-none"
          >
            <Building2 className="size-3.5" />
            Firm profile
          </TabsTrigger>
          <TabsTrigger
            value="smtp"
            className="gap-1.5 rounded-[8px] px-4 text-[12.5px] font-semibold data-active:bg-linear-to-br data-active:from-primary data-active:to-[#2f93c0] data-active:text-white data-active:shadow-none"
          >
            <Mail className="size-3.5" />
            SMTP configuration
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'firm' ? (
        <Card className="max-w-3xl gap-5 rounded-2xl border border-border py-6 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
          <CardHeader className="px-6">
            <CardTitle className="text-[15px] font-semibold">Firm profile</CardTitle>
            <CardDescription className="text-[12.5px]">
              Shown on signed PDFs, client emails and the signer footer.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 px-6">
            <div className="flex items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Building2 className="size-6" />
              </div>
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-secondary px-4 text-[12.5px] font-semibold hover:bg-secondary/70">
                <Upload className="size-3.5" />
                {logoName || 'Upload firm logo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setLogoName(e.target.files?.[0]?.name ?? '')}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="firm-name" label="Firm name">
                <Input id="firm-name" defaultValue="KDK Softwares" className="h-10 rounded-[9px]" />
              </Field>
              <Field id="firm-email" label="Firm email">
                <Input id="firm-email" defaultValue="contact@kdksoftware.com" className="h-10 rounded-[9px]" />
              </Field>
              <Field id="gstin" label="GSTIN">
                <Input id="gstin" placeholder="22AAAAA0000A1Z5" className="h-10 rounded-[9px] font-mono" />
              </Field>
              <Field id="pan" label="PAN">
                <Input id="pan" placeholder="AAAAA0000A" className="h-10 rounded-[9px] font-mono" />
              </Field>
              <Field id="signatory" label="Authorized signatory">
                <Input id="signatory" defaultValue="Kartik Khandelwal" className="h-10 rounded-[9px]" />
              </Field>
              <Field id="designation" label="Designation">
                <Input id="designation" defaultValue="Proprietor" className="h-10 rounded-[9px]" />
              </Field>
            </div>

            <Field id="address" label="Registered address">
              <Input
                id="address"
                defaultValue="4th Floor, Vaishali Nagar, Jaipur, Rajasthan 302021"
                className="h-10 rounded-[9px]"
              />
            </Field>

            <div className="flex justify-end">
              <Button
                className="h-10 gap-1.5 rounded-[10px] border-none bg-primary px-5 font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90"
                onClick={() => toast.success('Firm profile saved')}
              >
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-3xl gap-5 rounded-2xl border border-border py-6 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
          <CardHeader className="px-6">
            <CardTitle className="text-[15px] font-semibold">SMTP configuration</CardTitle>
            <CardDescription className="text-[12.5px]">
              Used to send signed documents and notifications to your clients.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 px-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
              <Field id="smtp-host" label="SMTP host">
                <Input id="smtp-host" placeholder="smtp.zoho.in" className="h-10 rounded-[9px] font-mono" />
              </Field>
              <Field id="smtp-port" label="Port">
                <Input id="smtp-port" defaultValue="587" className="h-10 rounded-[9px] font-mono" />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="smtp-user" label="Username">
                <Input id="smtp-user" placeholder="notifications@kdksoftware.com" className="h-10 rounded-[9px]" />
              </Field>
              <Field id="smtp-pass" label="Password">
                <Input id="smtp-pass" type="password" placeholder="••••••••" className="h-10 rounded-[9px]" />
              </Field>
              <Field id="from-name" label="From name">
                <Input id="from-name" defaultValue="KDK Softwares" className="h-10 rounded-[9px]" />
              </Field>
              <Field id="from-email" label="From email">
                <Input id="from-email" placeholder="no-reply@kdksoftware.com" className="h-10 rounded-[9px]" />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-[12.5px] font-semibold">Encryption</Label>
              <RadioGroup
                value={encryption}
                onValueChange={(v) => setEncryption(v as Encryption)}
                className="grid grid-cols-3 gap-2.5"
              >
                {(['tls', 'ssl', 'none'] as Encryption[]).map((option) => (
                  <div
                    key={option}
                    onClick={() => setEncryption(option)}
                    className="flex cursor-pointer items-center gap-2 rounded-[9px] border border-border px-3 py-2.5 text-[12.5px] font-medium uppercase"
                  >
                    <RadioGroupItem value={option} />
                    {option}
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="flex justify-end gap-2.5">
              <Button
                variant="ghost"
                className="h-10 gap-1.5 rounded-[10px] bg-secondary px-4 font-semibold hover:bg-secondary/70"
                onClick={() => toast('Test email sent to contact@kdksoftware.com')}
              >
                <SendHorizonal className="size-4" />
                Send test email
              </Button>
              <Button
                className="h-10 gap-1.5 rounded-[10px] border-none bg-primary px-5 font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90"
                onClick={() => toast.success('SMTP settings saved')}
              >
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
