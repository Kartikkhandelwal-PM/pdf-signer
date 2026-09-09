import { useEffect, useRef } from 'react'
import { Bell, ChevronDown, Plus, Search } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { ModeToggle } from './mode-toggle'

export function AppTopbar() {
  const navigate = useNavigate()
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return
      const target = e.target as HTMLElement | null
      const isTyping =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isTyping) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <header className="sticky top-0 z-10 flex h-[72px] shrink-0 items-center gap-4 border-b bg-background/80 px-5 backdrop-blur supports-backdrop-filter:bg-background/60 sm:px-7">
      <div className="relative hidden max-w-sm flex-1 md:block">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          placeholder="Search documents, clients, certificates…"
          className="h-10 rounded-[10px] bg-secondary/60 pr-10 pl-10"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-[6px] border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          /
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <Button
          size="sm"
          className="hidden h-10 gap-1.5 rounded-[10px] border-none bg-primary px-5 font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90 sm:inline-flex"
          onClick={() => navigate('/sign')}
        >
          <Plus className="size-4" />
          New signature
        </Button>

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
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Kartik Khandelwal</span>
                <span className="text-xs text-muted-foreground">
                  kartik.khandelwal@kdksoftware.com
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>Firm settings</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>SMTP configuration</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/certificates')}>My certificates</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
