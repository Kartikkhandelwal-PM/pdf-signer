import { ArrowUpRight, FileCheck2, FileSignature, Send, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useDocuments } from '@/context/documents-context'
import { certificates } from '@/data/mock'
import { cn } from '@/lib/utils'

type BadgeTone = 'neutral' | 'warning' | 'success'

interface QuickAction {
  title: string
  description: string
  path: string
  icon: LucideIcon
  iconClassName: string
  washClassName: string
  arrowHoverClassName: string
  badge?: string
  badgeTone?: BadgeTone
}

const badgeToneClassName: Record<BadgeTone, string> = {
  neutral: 'bg-secondary text-muted-foreground',
  warning: 'bg-warning/14 text-warning',
  success: 'bg-success/11 text-success',
}

export function QuickActionCards() {
  const navigate = useNavigate()
  const { documents } = useDocuments()

  const draftCount = documents.filter((doc) => doc.status === 'draft').length
  const readyToSendCount = documents.filter((doc) => doc.status === 'signed' && !doc.sentTo).length
  const attentionCertCount = certificates.filter((cert) => cert.status !== 'active').length

  const actions: QuickAction[] = [
    {
      title: 'Sign a document',
      description: 'Upload a PDF and apply your digital signature.',
      path: '/sign',
      icon: FileSignature,
      iconClassName: 'bg-linear-to-br from-primary to-[#2f93c0]',
      washClassName:
        'bg-linear-to-br from-primary/[0.12] via-primary/[0.03] to-transparent border-primary/15 hover:border-primary/30',
      arrowHoverClassName: 'group-hover:text-primary',
      badge: draftCount > 0 ? `${draftCount} draft${draftCount === 1 ? '' : 's'} waiting` : undefined,
      badgeTone: 'neutral',
    },
    {
      title: 'Send a document',
      description: 'Pick a signed document and email it to your client.',
      path: '/documents',
      icon: Send,
      iconClassName: 'bg-linear-to-br from-brand-orange to-brand-pink',
      washClassName:
        'bg-linear-to-br from-brand-orange/[0.11] via-brand-pink/[0.04] to-transparent border-brand-orange/15 hover:border-brand-orange/30',
      arrowHoverClassName: 'group-hover:text-brand-orange',
      badge: readyToSendCount > 0 ? `${readyToSendCount} ready to send` : undefined,
      badgeTone: 'neutral',
    },
    {
      title: 'Verify a signature',
      description: 'Check whether a signed PDF is valid and untampered.',
      path: '/verify',
      icon: FileCheck2,
      iconClassName: 'bg-linear-to-br from-brand-teal to-primary',
      washClassName:
        'bg-linear-to-br from-brand-teal/[0.12] via-brand-teal/[0.03] to-transparent border-brand-teal/15 hover:border-brand-teal/30',
      arrowHoverClassName: 'group-hover:text-brand-teal',
    },
    {
      title: 'Certificates',
      description: 'Manage saved DSC certificates and your default signer.',
      path: '/certificates',
      icon: ShieldCheck,
      iconClassName: 'bg-linear-to-br from-[#8b5cf6] to-[#6366f1]',
      washClassName:
        'bg-linear-to-br from-[#8b5cf6]/[0.11] via-[#8b5cf6]/[0.03] to-transparent border-[#8b5cf6]/15 hover:border-[#8b5cf6]/30',
      arrowHoverClassName: 'group-hover:text-[#8b5cf6]',
      badge:
        attentionCertCount > 0
          ? `${attentionCertCount} need${attentionCertCount === 1 ? 's' : ''} attention`
          : 'All certificates valid',
      badgeTone: attentionCertCount > 0 ? 'warning' : 'success',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map((action) => (
        <button
          key={action.title}
          type="button"
          onClick={() => navigate(action.path)}
          className={cn(
            'group relative flex flex-col items-start gap-2.5 overflow-hidden rounded-2xl border p-4 text-left shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-16px_rgba(20,77,105,.28)]',
            action.washClassName,
          )}
        >
          <div className="flex w-full items-start justify-between">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-[11px] text-white shadow-[0_4px_10px_-4px_rgba(20,77,105,.4)]',
                action.iconClassName,
              )}
            >
              <action.icon className="size-[18px]" />
            </div>
            <ArrowUpRight
              className={cn(
                'size-3.5 -translate-x-1 translate-y-1 text-muted-foreground/40 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100',
                action.arrowHoverClassName,
              )}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-heading text-[13.5px] font-semibold tracking-tight text-foreground">
              {action.title}
            </span>
            <span className="line-clamp-1 text-[11px] text-muted-foreground">
              {action.description}
            </span>
          </div>
          {action.badge && (
            <span
              className={cn(
                'mt-auto inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                badgeToneClassName[action.badgeTone ?? 'neutral'],
              )}
            >
              {action.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
