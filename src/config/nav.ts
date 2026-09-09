import {
  FileCheck2,
  FileSignature,
  Files,
  LayoutDashboard,
  Send,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  title: string
  path: string
  icon: LucideIcon
  badge?: string
  description: string
}

export const mainNav: NavItem[] = [
  {
    title: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    description: "Here's what's happening across your firm's document signing today.",
  },
  {
    title: 'Sign a document',
    path: '/sign',
    icon: FileSignature,
    description: 'Upload one PDF to sign it yourself, or several at once to batch sign them together.',
  },
  {
    title: 'All documents',
    path: '/documents',
    icon: Files,
    description: 'Every document across your firm — signed, sent or drafted.',
  },
  {
    title: 'Sent documents',
    path: '/sent',
    icon: Send,
    description: 'Track delivery, opens and downloads for documents you sent.',
  },
  {
    title: 'Verify signature',
    path: '/verify',
    icon: FileCheck2,
    description: 'Check whether a signed PDF is valid and untampered.',
  },
  {
    title: 'Certificates',
    path: '/certificates',
    icon: ShieldCheck,
    badge: '1',
    description: 'Manage saved DSC certificates and your default signer.',
  },
]

export const settingsNav: NavItem = {
  title: 'Settings',
  path: '/settings',
  icon: Settings,
  description: 'Firm profile and outgoing email configuration.',
}

export const allNavItems: NavItem[] = [...mainNav, settingsNav]
