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
          {/* isolate keeps the page's own stacking inside this box. Without it, elements the
              browser promotes to their own compositor layer — the home banner's animated sun
              glow, for one — can paint over the topbar and anything hanging off it, like the
              global search results. */}
          <div className="isolate flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </div>
        </SidebarInset>
        <Toaster position="top-right" richColors offset={{ top: '76px', right: '24px' }} />
      </SidebarProvider>
    </TooltipProvider>
  )
}
