import { useState } from 'react'
import { Building2, Mail, Settings as SettingsIcon, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { EmailDeliverySettings } from '@/components/settings/email-delivery'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type SettingsTab = 'firm' | 'smtp'

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
  const [logoName, setLogoName] = useState('')

  return (
    <div className="flex flex-1 flex-col gap-5 p-5 sm:p-7">
      <PageHeader
        title="Settings"
        description="Firm profile and outgoing email configuration."
        icon={SettingsIcon}
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as SettingsTab)}
        className="flex max-w-3xl flex-col gap-5"
      >
        <TabsList variant="line" className="h-10 w-full justify-start gap-7 border-b border-border p-0">
          {(
            [
              { value: 'firm', label: 'Firm profile', icon: Building2 },
              { value: 'smtp', label: 'Email delivery', icon: Mail },
            ] as { value: SettingsTab; label: string; icon: typeof Building2 }[]
          ).map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="h-full flex-none gap-2 rounded-none px-0.5 text-[13px] font-semibold text-muted-foreground after:bottom-[-1px] after:h-[2.5px] after:rounded-full after:bg-primary hover:text-foreground data-active:text-primary [&_svg]:size-4"
            >
              <item.icon />
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="firm" className="mt-0">
          <Card className="gap-5 rounded-2xl border border-border py-6 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
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
        </TabsContent>

        <TabsContent value="smtp" className="mt-0">
          <EmailDeliverySettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}
