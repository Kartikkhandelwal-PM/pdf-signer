import {
  FileCheck2,
  FileSignature,
  Files,
  House,
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
    path: '/home',
    icon: House,
    description: 'Quick actions and your most recent documents, at a glance.',
  },
  // Classic stats-and-tables dashboard — superseded by the Home page above, which now
  // carries the "Dashboard" name. Kept here (commented, not deleted) in case we want it back.
  // {
  //   title: 'Dashboard',
  //   path: '/',
  //   icon: LayoutDashboard,
  //   description: "Here's what's happening across your firm's document signing today.",
  // },
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
