import type { CSSProperties } from 'react'
import { Outlet } from 'react-router-dom'

import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppTopbar } from '@/components/layout/app-topbar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export function AppLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider
        className="h-svh overflow-hidden"
        style={{ '--sidebar-width-icon': '4.5rem' } as CSSProperties}
      >
        <AppSidebar />
        <SidebarInset className="min-h-0">
          <AppTopbar />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </div>
        </SidebarInset>
        <Toaster position="top-right" richColors offset={{ top: '76px', right: '24px' }} />
      </SidebarProvider>
    </TooltipProvider>
  )
}
