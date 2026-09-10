import { ChevronDown, CreditCard, LogOut, Plus, Settings, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GlobalSearch } from './global-search'
import { ModeToggle } from './mode-toggle'

export function AppTopbar() {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-10 flex h-[72px] shrink-0 items-center gap-4 border-b bg-background/80 px-5 backdrop-blur supports-backdrop-filter:bg-background/60 sm:px-7">
      <GlobalSearch />

      <div className="ml-auto flex items-center gap-2.5">
        <Button
          size="sm"
          className="hidden h-10 gap-1.5 rounded-[10px] border-none bg-primary px-5 font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90 sm:inline-flex"
          onClick={() => navigate('/sign')}
        >
          <Plus className="size-4" />
          New signature
        </Button>

        {/* Notification bell — parked until there's a real notification feed behind it.
        <Button
          variant="ghost"
          size="icon"
          className="relative size-10 rounded-[10px] border border-border bg-secondary/60"
          onClick={() =>
            toast.info("Priya Nair's DSC expires in 27 days", {
              description: 'eMudhra Class 3 CA · renew before Oct 2, 2026',
            })
          }
        >
          <Bell className="size-4.5" />
          <span className="absolute top-2 right-2 size-1.5 rounded-full bg-brand-pink ring-2 ring-background" />
        </Button>
        */}

        <ModeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-[10px] py-1.5 pr-2 pl-1.5 hover:bg-secondary">
              <Avatar className="size-9 rounded-[10px] after:rounded-[10px]">
                <AvatarFallback className="rounded-[10px] bg-primary text-xs font-semibold text-white">
                  KK
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-0">
            <DropdownMenuLabel className="px-4 py-3 font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="truncate text-[14px] font-semibold">Kartik Khandelwal</span>
                <span className="truncate text-[12px] text-muted-foreground">
                  kartik.khandelwal@kdksoftware.com
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="mx-0 my-0" />
            <div className="p-1.5">
              <DropdownMenuItem className="gap-2.5 px-2.5 py-2 text-[13.5px]" onClick={() => navigate('/profile')}>
                <UserRound className="size-4 text-muted-foreground" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2.5 px-2.5 py-2 text-[13.5px]"
                onClick={() => navigate('/subscription')}
              >
                <CreditCard className="size-4 text-muted-foreground" />
                Subscription
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2.5 px-2.5 py-2 text-[13.5px]" onClick={() => navigate('/settings')}>
                <Settings className="size-4 text-muted-foreground" />
                Settings
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator className="mx-0 my-0" />
            <div className="p-1.5">
              <DropdownMenuItem
                variant="destructive"
                className="gap-2.5 px-2.5 py-2 text-[13.5px] font-medium"
                onClick={() => toast('Signed out')}
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
