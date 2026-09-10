import { useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Input } from '@/components/ui/input'
import { useDocuments } from '@/context/documents-context'
import { certificates as allCertificates } from '@/data/mock'
import { flattenGroups, searchEverything, splitOnMatch, type SearchResult } from '@/lib/global-search'
import { cn } from '@/lib/utils'

function Highlighted({ text, query }: { text: string; query: string }) {
  const [before, match, after] = splitOnMatch(text, query)
  if (!match) return <>{text}</>
  return (
    <>
      {before}
      <mark className="bg-primary/15 text-primary rounded-[3px] px-0.5 font-semibold">{match}</mark>
      {after}
    </>
  )
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const { documents } = useDocuments()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const groups = useMemo(
    () => searchEverything(query, documents, allCertificates),
    [query, documents],
  )
  const flat = useMemo(() => flattenGroups(groups), [groups])
  // Where each group starts in the flattened list, so a row can work out its own keyboard
  // index without a counter being mutated as the list renders.
  const groupOffsets = useMemo(
    () => groups.map((_, i) => groups.slice(0, i).reduce((sum, g) => sum + g.results.length, 0)),
    [groups],
  )
  const hasQuery = query.trim().length > 0
  const showPanel = open && hasQuery

  // The highlighted row has to stay inside the list as results shrink under a longer query.
  const safeIndex = flat.length === 0 ? 0 : Math.min(activeIndex, flat.length - 1)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return
      const target = e.target as HTMLElement | null
      const isTyping =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isTyping) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function go(result: SearchResult) {
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
    navigate(result.path, result.state ? { state: result.state } : undefined)
  }

  // Enter with nothing highlighted still has somewhere sensible to go — the documents list,
  // already filtered by whatever was typed.
  function goToAllResults() {
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
    navigate('/documents', { state: { query: query.trim() } })
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (hasQuery) {
        setQuery('')
        return
      }
      setOpen(false)
      inputRef.current?.blur()
      return
    }

    if (!showPanel) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (flat.length === 0 ? 0 : (Math.min(prev, flat.length - 1) + 1) % flat.length))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (flat.length === 0 ? 0 : (Math.min(prev, flat.length - 1) + flat.length - 1) % flat.length))
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const target = flat[safeIndex]
      if (target) go(target)
      else if (hasQuery) goToAllResults()
    }
  }

  return (
    <div ref={containerRef} className="relative hidden max-w-sm flex-1 md:block">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        placeholder="Search documents, recipients, certificates…"
        className="h-10 rounded-[10px] bg-secondary/60 pr-10 pl-10"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        onChange={(e) => {
          setQuery(e.target.value)
          setActiveIndex(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleInputKeyDown}
      />
      {hasQuery ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQuery('')
            inputRef.current?.focus()
          }}
          className="absolute top-1/2 right-2.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-[6px] text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-[6px] border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          /
        </kbd>
      )}

      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute top-[calc(100%+8px)] right-0 left-0 z-50 max-h-[min(28rem,70vh)] overflow-y-auto rounded-[14px] border border-border bg-popover p-1.5 shadow-[0_4px_12px_-4px_rgba(20,32,42,.12),0_24px_48px_-24px_rgba(20,77,105,.4)]"
        >
          {flat.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
              <span className="text-[13px] font-semibold">No matches for “{query.trim()}”</span>
              <span className="text-[11.5px] text-muted-foreground">
                Try a document name, a recipient, or a certificate holder.
              </span>
            </div>
          ) : (
            <>
              {groups.map((group, groupIndex) => (
                <div key={group.kind} className="pb-1 last:pb-0">
                  <div className="flex items-center justify-between px-2.5 pt-2 pb-1.5">
                    <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
                      {group.label}
                    </span>
                    {group.overflow > 0 && (
                      <span className="text-[10.5px] text-muted-foreground">+{group.overflow} more</span>
                    )}
                  </div>
                  {group.results.map((result, resultIndex) => {
                    const index = groupOffsets[groupIndex] + resultIndex
                    const isActive = index === safeIndex
                    const ResultIcon = result.icon
                    return (
                      <button
                        key={result.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => go(result)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left',
                          isActive && 'bg-accent',
                        )}
                      >
                        <div
                          className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-secondary',
                            isActive && 'bg-primary/10',
                          )}
                        >
                          <ResultIcon className={cn('size-4 text-muted-foreground', isActive && 'text-primary')} />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[12.5px] font-medium">
                            <Highlighted text={result.title} query={query} />
                          </span>
                          <span className="truncate text-[11px] text-muted-foreground">{result.subtitle}</span>
                        </div>
                        {isActive && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
                      </button>
                    )
                  })}
                </div>
              ))}
              <button
                type="button"
                onClick={goToAllResults}
                className="mt-1 flex w-full items-center justify-between rounded-[10px] border-t border-border px-2.5 py-2.5 text-left hover:bg-accent"
              >
                <span className="text-[11.5px] font-semibold text-primary">
                  See all documents matching “{query.trim()}”
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
