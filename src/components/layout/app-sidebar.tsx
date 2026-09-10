import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

import logoHorizontal from '@/assets/logo-horizontal.png'
import logoMark from '@/assets/logo-mark.png'
import { cn } from '@/lib/utils'
import { allNavItems } from '@/config/nav'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const badgeClass =
  'h-5 min-w-5 rounded-full border-none bg-linear-to-br from-brand-orange to-brand-pink px-1.5 font-mono text-[10.5px] font-semibold text-white'

const navButtonClass =
  'h-10 gap-3 rounded-[10px] px-3 text-[13.5px] [&>svg]:size-[18px] group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0! group-data-[collapsible=icon]:[&>svg]:size-5!'

const activeNavButtonClass =
  'bg-linear-to-br from-primary to-[#2f93c0] font-semibold text-white! shadow-none hover:from-primary hover:to-[#2f93c0] hover:text-white! [&>svg]:text-white!'

function SidebarBrandHeader() {
  const { state } = useSidebar()

  if (state === 'collapsed') {
    return (
      <div className="flex items-center justify-center">
        <img src={logoMark} alt="PDF Signer" className="size-8 shrink-0 object-contain" />
      </div>
    )
  }

  return (
    <div className="flex items-center px-1">
      {/* The logo's wordmark is baked into the PNG in fixed dark colors. The sidebar is already
          white in light mode, so the image sits directly on it; only in dark mode does it get a
          light backing plate, to stay legible against the dark sidebar background there. */}
      <div className="flex min-w-0 flex-1 items-center dark:rounded-[8px] dark:bg-white dark:px-2 dark:py-2">
        <img src={logoHorizontal} alt="PDF Signer" className="h-14 w-auto object-contain" />
      </div>
    </div>
  )
}

// The one control that opens and closes the rail, pinned to the bottom of the sidebar so it
// sits away from the navigation and stays in the same place in both states.
function SidebarCollapseToggle() {
  const { state, toggleSidebar } = useSidebar()
  const collapsed = state === 'collapsed'

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className={cn(
        'flex h-10 items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
        collapsed && 'size-11 justify-center px-0',
      )}
    >
      {collapsed ? <ChevronsRight className="size-[18px]" /> : <ChevronsLeft className="size-[18px]" />}
      {!collapsed && <span>Collapse</span>}
    </button>
  )
}

export function AppSidebar() {
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="icon">
      {/* Fixed to the same 72px as AppTopbar (see app-topbar.tsx) so the two header rows'
          bottom borders line up in a single straight line across the page. */}
      <SidebarHeader className="flex h-[72px] flex-col justify-center border-b border-sidebar-border px-3 py-0 group-data-[collapsible=icon]:px-2">
        <SidebarBrandHeader />
      </SidebarHeader>
      <SidebarContent className="gap-2 px-1 py-2 group-data-[collapsible=icon]:px-0">
        <SidebarGroup className="px-3 py-2 group-data-[collapsible=icon]:px-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {allNavItems.map((item) => {
                const isActive = item.path === '/' ? pathname === '/' : pathname === item.path
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(navButtonClass, isActive && activeNavButtonClass)}
                    >
                      <NavLink to={item.path} end={item.path === '/'}>
                        <item.icon />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {item.badge ? (
                      <SidebarMenuBadge className={badgeClass}>
                        {item.badge}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-2">
        <SidebarCollapseToggle />
      </SidebarFooter>
    </Sidebar>
  )
}
