import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  BadgeCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FileSignature,
  FileText,
  FileWarning,
  Fingerprint,
  FolderUp,
  KeyRound,
  Layers,
  ListChecks,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  Plus,
  PenLine,
  Search,
  Send,
  ShieldCheck,
  Star,
  Upload,
  UserRound,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { RecipientTemplateCard } from '@/components/documents/recipient-template-card'
import { SendDialog } from '@/components/documents/send-dialog'
import { FileDropzone } from '@/components/shared/file-dropzone'
import { OptionCard } from '@/components/shared/option-card'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { useDocuments } from '@/context/documents-context'
import { certificates } from '@/data/mock'
import { resolveIncomingFiles } from '@/lib/file-intake'
import { checkPdfPassword, loadPdfDocument } from '@/lib/pdf'
import { cn } from '@/lib/utils'
import type { SignedDocument } from '@/types'

type Position = 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right' | 'custom'
type PasswordMode = 'none' | 'common' | 'custom' | 'uploaded-list'
type BatchPhase = 'setup' | 'processing' | 'done'

// Whether an uploaded file needs its EXISTING open-password before we can read it at all —
// distinct from `password` below, which is a NEW password the signed output will be protected
// with. 'checking' while pdf.js is still probing it; 'locked' means a correct password hasn't
// been supplied yet.
type ProtectionState = 'checking' | 'none' | 'locked' | 'unlocked' | 'error'

interface WorkFile {
  id: string
  name: string
  file: File
  pages: number
  password: string
  progress: number
  protection: ProtectionState
  unlockPassword?: string
  unlockError?: string
}

// Combines a prefix and suffix around a file's base name, e.g. ("Signed_", "Invoice", "_v1") -> "Signed_Invoice_v1.pdf"
function buildOutputName(prefix: string, baseName: string, suffix: string) {
  return ensurePdfExt(`${prefix.trim()}${baseName.trim()}${suffix.trim()}`)
}

function ensurePdfExt(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`
}

function stripPdfExt(name: string) {
  return name.replace(/\.pdf$/i, '')
}

// Keeps the file extension and a trailing fragment of the name visible (e.g. an ID suffix)
// instead of losing them to a plain end-truncate — useful for long, system-generated filenames.
function truncateMiddle(name: string, max = 30) {
  if (name.length <= max) return name
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : ''
  const base = ext ? name.slice(0, -ext.length) : name
  const keep = max - ext.length - 1
  if (keep <= 2) return `${name.slice(0, max - 1)}…`
  const head = Math.ceil(keep * 0.65)
  const tail = keep - head
  return `${base.slice(0, head)}…${tail > 0 ? base.slice(-tail) : ''}${ext}`
}

// A single page token is a page number, or a numeric range like "5-8" — numbers only, so
// typing (or the quick-fill chips) never produces anything but digits, commas, dashes, spaces.
const PAGE_TOKEN_RE = /^\d+(\s*-\s*\d+)?$/

// Parses a page-selection string like "1, 3, 5-8" into a sorted, de-duplicated list of page
// numbers, bounded to [1, totalPages].
//
// Strict mode (default, used for a single file the user is looking at): any token that
// doesn't resolve against totalPages (e.g. page 20 of a 15-page file) fails the whole
// expression, returning null — an out-of-range page number there is unambiguously a typo.
//
// Lenient mode (used for batch, where one expression is applied across files with different
// page counts): a token that doesn't resolve for THIS file is just skipped rather than
// invalidating the rest — e.g. "1-3, 5, 16" against a 15-page file still signs 1, 2, 3, 5.
// Returns null only if nothing at all resolves.
function parsePageRange(input: string, totalPages: number, opts?: { lenient?: boolean }): number[] | null {
  const trimmed = input.trim()
  if (!trimmed || totalPages <= 0) return null
  const lenient = opts?.lenient ?? false

  const pages = new Set<number>()
  for (const rawToken of trimmed.split(',')) {
    const token = rawToken.trim()
    if (!token) continue

    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/)
    if (rangeMatch) {
      const start = Number(rangeMatch[1])
      const end = Number(rangeMatch[2])
      const inRange = start >= 1 && start <= totalPages && end >= 1 && end <= totalPages && start <= end
      if (!inRange) {
        if (lenient) continue
        return null
      }
      for (let p = start; p <= end; p++) pages.add(p)
      continue
    }

    if (!/^\d+$/.test(token)) {
      if (lenient) continue
      return null
    }
    const page = Number(token)
    if (page < 1 || page > totalPages) {
      if (lenient) continue
      return null
    }
    pages.add(page)
  }

  return pages.size > 0 ? Array.from(pages).sort((a, b) => a - b) : null
}

type StandardPageMode = 'all' | 'first' | 'last' | 'first-last' | 'custom'

// Batch labels are the same for every file (unlike single mode, where "All" and "Current"
// need this specific file's page count / current page baked into the text).
const BATCH_PAGE_MODE_LABEL: Record<StandardPageMode, string> = {
  all: 'All pages in every file',
  first: 'First page only',
  last: 'Last page only',
  'first-last': 'First and last page',
  custom: 'Custom range',
}

// Resolves one of the fixed page-selection modes against a specific file's page count —
// "last" (and the "last" half of "first-last") is computed fresh per file, which is exactly
// what batch signing needs: the same mode means page 1 for every file, but a different exact
// page number for "last" depending on how long that particular file is. null = every page.
function resolvePageMode(
  mode: StandardPageMode,
  customInput: string,
  totalPages: number,
  opts?: { lenient?: boolean },
): number[] | null {
  if (totalPages <= 0) return null
  switch (mode) {
    case 'all':
      return null
    case 'first':
      return [1]
    case 'last':
      return [totalPages]
    case 'first-last':
      return totalPages === 1 ? [1] : [1, totalPages]
    case 'custom':
      return parsePageRange(customInput, totalPages, opts)
  }
}

// Syntax-only check, usable before a file's page count is known (e.g. a batch file that
// hasn't been previewed yet) — validates shape without resolving numeric bounds.
function isPageExpressionSyntaxValid(input: string): boolean {
  const trimmed = input.trim()
  if (!trimmed) return false
  return trimmed.split(',').every((token) => PAGE_TOKEN_RE.test(token.trim()))
}

// Collapses a resolved page list into a compact, human-readable label, e.g. [1,2,3,6] against
// a 6-page file -> "Pages 1-3, 6"; the whole document -> "All 6 pages".
function formatPageSelection(pages: number[], totalPages: number): string {
  if (totalPages > 0 && pages.length === totalPages) return `All ${totalPages} page${totalPages === 1 ? '' : 's'}`
  if (pages.length === 1) return `Page ${pages[0]}`

  const parts: string[] = []
  let start = pages[0]
  let prev = pages[0]
  for (let i = 1; i <= pages.length; i++) {
    const cur = pages[i]
    if (cur === prev + 1) {
      prev = cur
      continue
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`)
    if (cur !== undefined) {
      start = cur
      prev = cur
    }
  }
  return `Pages ${parts.join(', ')}`
}

// The staged checklist shown while a single document is being signed — mirrors the actual
// steps a PDF digital signature goes through (hash the bytes, apply the certificate, embed a
// trusted timestamp, verify the result), one at a time rather than a single opaque spinner.
const SIGN_STEPS = [
  { label: 'Generating document hash', icon: Fingerprint },
  { label: 'Applying digital certificate', icon: ShieldCheck },
  { label: 'Embedding trusted timestamp', icon: Clock3 },
  { label: 'Verifying signature integrity', icon: BadgeCheck },
] as const

// Same four cryptographic stages, described for a whole batch rather than one document — shown
// once above the live per-file list, driven by the batch's average progress rather than a
// discrete step index (many files are genuinely in different stages at once).
const BATCH_SIGN_STEPS = [
  { label: 'Generating document hashes', icon: Fingerprint },
  { label: 'Applying digital certificates', icon: ShieldCheck },
  { label: 'Embedding trusted timestamps', icon: Clock3 },
  { label: 'Verifying signature integrity', icon: BadgeCheck },
] as const

// A plausible-looking SHA-256-shaped hex string for display — this is a mock signer, not a
// real cryptographic hash of the file.
function generateDocHash() {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

const FILE_PAGE_SIZE = 8

type Cert = (typeof certificates)[number]

const STAMP_WIDTH_MIN = 14
const STAMP_WIDTH_MAX = 55
const STAMP_WIDTH_DEFAULT = 30
const STAMP_MARGIN = 3 // page-edge margin, in %, used by presets and drag/resize clamping

// A separate, explicit "how big does the whole stamp look" control — scales font sizes directly
// (not a CSS transform), so normal layout/reflow still applies and the box's auto height grows
// or shrinks to fit the now-bigger-or-smaller text, on top of whatever width is set.
const STAMP_SCALE_MIN = 0.8
const STAMP_SCALE_MAX = 1.8
const STAMP_SCALE_DEFAULT = 1

// Height starts as CSS height:auto (null) — the box just fits however many lines the text wraps
// into at the current width. Dragging a N/S handle switches it to an explicit fixed height (in
// %, same as width) from then on; the content clips instead of overflowing if it no longer fits.
const STAMP_HEIGHT_MIN_PX = 22

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

// These Y values are just reasonable fixed placements for the position presets, the same way
// "bottom-right" etc. worked before the stamp was resizable — since height is never measured,
// there's no real "bottom of the stamp" to anchor to precisely.
function getPresets(stampWidth: number): { value: Position; coords: { x: number; y: number } }[] {
  const rightX = 100 - stampWidth - STAMP_MARGIN
  const centerX = 50 - stampWidth / 2
  return [
    { value: 'top-left', coords: { x: STAMP_MARGIN, y: STAMP_MARGIN } },
    { value: 'top-right', coords: { x: rightX, y: STAMP_MARGIN } },
    { value: 'center', coords: { x: centerX, y: 42 } },
    { value: 'bottom-left', coords: { x: STAMP_MARGIN, y: 80 } },
    { value: 'bottom-right', coords: { x: rightX, y: 80 } },
  ]
}

// The card itself is the scrolling container (not its outer wrapper) so the sticky section
// headers below have something to stick to — overflow-y-auto still clips to the rounded
// corners just like overflow-hidden would, so the rounding never gets lost.
const flushCardClass =
  'min-h-0 flex-1 gap-0 overflow-x-hidden overflow-y-auto rounded-2xl border border-border py-0 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0'

interface SettingsSectionProps {
  title: string
  /** What this section currently amounts to, shown in the header once it's collapsed — so a
   *  closed section still answers "what is this set to" without being opened. */
  summary?: ReactNode
  defaultOpen?: boolean
  contentClassName?: string
  children: ReactNode
}

function SettingsSection({ title, summary, defaultOpen = true, contentClassName, children }: SettingsSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-border last:border-b-0">
      <CollapsibleTrigger asChild>
        <div className="group sticky top-0 z-10 flex cursor-pointer items-center gap-3 bg-card px-5 py-3.5 text-left select-none hover:bg-secondary/30">
          <span className="shrink-0 text-[13px] font-semibold">{title}</span>
          <span className="min-w-0 flex-1 truncate text-right text-[11.5px] text-muted-foreground">
            {!open && summary}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={cn('flex flex-col gap-2 px-5 pb-5', contentClassName)}>{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface StampToggleValues {
  showSignerName: boolean
  showSignedLabel: boolean
  showDate: boolean
  showTime: boolean
  showReason: boolean
  reasonText: string
  showLocation: boolean
  locationText: string
  showDN: boolean
  showCertSerial: boolean
}

interface StampAppearanceCardProps extends StampToggleValues {
  onShowSignerNameChange: (value: boolean) => void
  onShowSignedLabelChange: (value: boolean) => void
  onShowDateChange: (value: boolean) => void
  onShowTimeChange: (value: boolean) => void
  onShowReasonChange: (value: boolean) => void
  onReasonTextChange: (value: string) => void
  onShowLocationChange: (value: boolean) => void
  onLocationTextChange: (value: string) => void
  onShowDNChange: (value: boolean) => void
  onShowCertSerialChange: (value: boolean) => void
  disabled?: boolean
}

function StampAppearanceCard({
  showSignerName,
  onShowSignerNameChange,
  showSignedLabel,
  onShowSignedLabelChange,
  showDate,
  onShowDateChange,
  showTime,
  onShowTimeChange,
  showReason,
  onShowReasonChange,
  reasonText,
  onReasonTextChange,
  showLocation,
  onShowLocationChange,
  locationText,
  onLocationTextChange,
  showDN,
  onShowDNChange,
  showCertSerial,
  onShowCertSerialChange,
  disabled,
}: StampAppearanceCardProps) {
  return (
    <SettingsSection
      title="Stamp appearance"
      defaultOpen={false}
      summary={(() => {
        const shown = [
          showSignerName && 'Name',
          showSignedLabel && 'Signed label',
          showDate && 'Date',
          showTime && 'Time',
          showReason && 'Reason',
          showLocation && 'Location',
          showDN && 'DN',
          showCertSerial && 'Serial',
        ].filter(Boolean) as string[]
        if (shown.length === 0) return 'Nothing shown'
        // Two names plus a count reads better in a narrow header than a truncated list.
        return shown.length <= 2 ? shown.join(' · ') : `${shown[0]} · ${shown[1]} +${shown.length - 2}`
      })()}
      contentClassName="gap-4"
    >
        <div className="flex flex-col gap-3">
          <span className="text-[12px] font-semibold text-muted-foreground">Show on stamp</span>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="show-signer-name" className="text-[12.5px] font-normal">
              Signer name
            </Label>
            <Switch
              id="show-signer-name"
              checked={showSignerName}
              onCheckedChange={onShowSignerNameChange}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="show-signed-label" className="text-[12.5px] font-normal">
              "Digitally signed" label
            </Label>
            <Switch
              id="show-signed-label"
              checked={showSignedLabel}
              onCheckedChange={onShowSignedLabelChange}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="show-date" className="text-[12.5px] font-normal">
              Date
            </Label>
            <Switch id="show-date" checked={showDate} onCheckedChange={onShowDateChange} disabled={disabled} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="show-time" className="text-[12.5px] font-normal">
              Time
            </Label>
            <Switch id="show-time" checked={showTime} onCheckedChange={onShowTimeChange} disabled={disabled} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="show-reason" className="text-[12.5px] font-normal">
              Reason
            </Label>
            <Switch id="show-reason" checked={showReason} onCheckedChange={onShowReasonChange} disabled={disabled} />
          </div>
          {showReason && (
            <Input
              value={reasonText}
              onChange={(e) => onReasonTextChange(e.target.value)}
              placeholder="e.g. I am the author of this document"
              disabled={disabled}
              className="h-9 rounded-[8px] text-[12.5px]"
            />
          )}

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="show-location" className="text-[12.5px] font-normal">
              Location
            </Label>
            <Switch
              id="show-location"
              checked={showLocation}
              onCheckedChange={onShowLocationChange}
              disabled={disabled}
            />
          </div>
          {showLocation && (
            <Input
              value={locationText}
              onChange={(e) => onLocationTextChange(e.target.value)}
              placeholder="e.g. Mumbai, India"
              disabled={disabled}
              className="h-9 rounded-[8px] text-[12.5px]"
            />
          )}

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="show-dn" className="text-[12.5px] font-normal">
              Distinguished name
            </Label>
            <Switch id="show-dn" checked={showDN} onCheckedChange={onShowDNChange} disabled={disabled} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="show-serial" className="text-[12.5px] font-normal">
              Certificate serial
            </Label>
            <Switch
              id="show-serial"
              checked={showCertSerial}
              onCheckedChange={onShowCertSerialChange}
              disabled={disabled}
            />
          </div>
        </div>
    </SettingsSection>
  )
}

// The standard resize-handle layout: small squares on the 4 corners (resize width and height
// together), short straight lines on the 4 edge midpoints (resize just that one axis).
type HandleShape = 'square' | 'h' | 'v'

const HANDLE_SHAPE_CLASS: Record<HandleShape, string> = {
  square: 'size-2 rounded-[1px]',
  h: 'h-1 w-4 rounded-full',
  v: 'h-4 w-1 rounded-full',
}

interface ResizeHandleSpec {
  dir: ResizeDir
  className: string
  cursor: string
  shape: HandleShape
}

const RESIZE_HANDLES: ResizeHandleSpec[] = [
  { dir: 'nw', className: '-top-1 -left-1', cursor: 'cursor-nwse-resize', shape: 'square' },
  { dir: 'n', className: '-top-1 left-1/2 -translate-x-1/2', cursor: 'cursor-ns-resize', shape: 'h' },
  { dir: 'ne', className: '-top-1 -right-1', cursor: 'cursor-nesw-resize', shape: 'square' },
  { dir: 'e', className: 'top-1/2 -right-1 -translate-y-1/2', cursor: 'cursor-ew-resize', shape: 'v' },
  { dir: 'se', className: '-bottom-1 -right-1', cursor: 'cursor-nwse-resize', shape: 'square' },
  { dir: 's', className: '-bottom-1 left-1/2 -translate-x-1/2', cursor: 'cursor-ns-resize', shape: 'h' },
  { dir: 'sw', className: '-bottom-1 -left-1', cursor: 'cursor-nesw-resize', shape: 'square' },
  { dir: 'w', className: 'top-1/2 -left-1 -translate-y-1/2', cursor: 'cursor-ew-resize', shape: 'v' },
]

interface StampOverlayProps extends StampToggleValues {
  coords: { x: number; y: number }
  stampWidth: number
  stampHeight: number | null
  stampScale: number
  stampRef: RefObject<HTMLDivElement | null>
  isDragging: boolean
  isResizing: boolean
  cert?: Cert
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void
  onResizeStart: (dir: ResizeDir, e: PointerEvent<HTMLDivElement>) => void
  onResizeMove: (e: PointerEvent<HTMLDivElement>) => void
  onResizeEnd: (e: PointerEvent<HTMLDivElement>) => void
}

function StampOverlay({
  coords,
  stampWidth,
  stampHeight,
  stampScale,
  stampRef,
  isDragging,
  isResizing,
  cert,
  showSignerName,
  showSignedLabel,
  showDate,
  showTime,
  showReason,
  reasonText,
  showLocation,
  locationText,
  showDN,
  showCertSerial,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: StampOverlayProps) {
  const now = new Date()
  const nothingVisible =
    !showSignerName && !showSignedLabel && !showDate && !showTime && !showReason && !showLocation && !showDN && !showCertSerial

  // Font sizes scale directly (not via CSS transform) so normal text layout still applies — the
  // box's auto height grows or shrinks to fit the now-bigger-or-smaller text on its own.
  const nameSize = 9 * stampScale
  const fieldSize = 6.5 * stampScale
  const iconColWidth = 32 * stampScale
  const iconSize = 16 * stampScale
  const padding = 6 * stampScale
  const gap = 2 * stampScale

  return (
    <div
      ref={stampRef}
      style={{
        left: `${coords.x}%`,
        top: `${coords.y}%`,
        width: `${stampWidth}%`,
        height: stampHeight !== null ? `${stampHeight}%` : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'absolute touch-none select-none',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
      )}
    >
      <div
        className={cn(
          'flex overflow-hidden rounded-[4px] border-2 border-primary bg-card shadow-[0_4px_12px_-4px_rgba(29,110,150,.4)]',
          stampHeight !== null && 'h-full',
          isDragging && 'shadow-[0_8px_20px_-4px_rgba(29,110,150,.5)]',
        )}
      >
        <div
          style={{ width: iconColWidth }}
          className="flex shrink-0 items-center justify-center border-r border-primary bg-primary/10"
        >
          <CheckCircle2 style={{ width: iconSize, height: iconSize }} className="text-primary" strokeWidth={2} />
        </div>
        <div style={{ gap, padding }} className="flex min-w-0 flex-1 flex-col">
          {showSignerName && (
            <span
              style={{ fontSize: nameSize }}
              className="font-heading leading-[1.25] font-bold break-words text-primary"
            >
              {cert?.holderName ?? 'Signature'}
            </span>
          )}
          {showSignedLabel && (
            <span style={{ fontSize: fieldSize }} className="font-mono leading-[1.25] break-words text-primary/70">
              Digitally signed
            </span>
          )}
          {(showDate || showTime) && (
            <span style={{ fontSize: fieldSize }} className="font-mono leading-[1.25] break-words text-primary/70">
              {showDate &&
                now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              {showDate && showTime && ' · '}
              {showTime && now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {showReason && (
            <span style={{ fontSize: fieldSize }} className="font-mono leading-[1.25] break-words text-primary/70">
              Reason: {reasonText || '—'}
            </span>
          )}
          {showLocation && (
            <span style={{ fontSize: fieldSize }} className="font-mono leading-[1.25] break-words text-primary/70">
              Location: {locationText || '—'}
            </span>
          )}
          {showDN && (
            <span style={{ fontSize: fieldSize }} className="font-mono leading-[1.25] break-words text-primary/70">
              DN: cn={cert?.holderName ?? '—'}, o={cert?.organization ?? '—'}, c=IN
            </span>
          )}
          {showCertSerial && (
            <span style={{ fontSize: fieldSize }} className="font-mono leading-[1.25] break-words text-primary/70">
              S/N: {cert?.serialNumber ?? '—'}
            </span>
          )}
          {nothingVisible && (
            <span style={{ fontSize: fieldSize }} className="font-mono text-primary/50 italic">
              Signature
            </span>
          )}
        </div>
      </div>

      {RESIZE_HANDLES.map((handle) => (
        <div
          key={handle.dir}
          onPointerDown={(e) => onResizeStart(handle.dir, e)}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
          title="Drag to resize"
          className={cn(
            'absolute touch-none bg-primary shadow-[0_0_0_1px_white,0_1px_2px_rgba(0,0,0,.35)]',
            HANDLE_SHAPE_CLASS[handle.shape],
            handle.className,
            isResizing ? 'cursor-grabbing' : handle.cursor,
          )}
        />
      ))}
    </div>
  )
}

interface PdfPageCanvasProps {
  file: File
  password?: string
  pageNumber: number
  onAspectRatio?: (ratio: number) => void
  onNumPages?: (numPages: number) => void
}

function PdfPageCanvas({ file, password, pageNumber, onAspectRatio, onNumPages }: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const onAspectRatioRef = useRef(onAspectRatio)
  onAspectRatioRef.current = onAspectRatio
  const onNumPagesRef = useRef(onNumPages)
  onNumPagesRef.current = onNumPages

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    loadPdfDocument(file, password)
      .then(async (doc) => {
        if (cancelled) return
        onNumPagesRef.current?.(doc.numPages)
        const page = await doc.getPage(Math.min(Math.max(1, pageNumber), doc.numPages))
        if (cancelled) return

        const baseViewport = page.getViewport({ scale: 1 })
        onAspectRatioRef.current?.(baseViewport.width / baseViewport.height)

        const containerWidth = containerRef.current?.clientWidth || 420
        const scale = (containerWidth / baseViewport.width) * 2 // render at 2x for crisp text
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return

        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        if (cancelled) return
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
        onNumPagesRef.current?.(1)
      })

    return () => {
      cancelled = true
    }
  }, [file, password, pageNumber])

  return (
    <div ref={containerRef} className="relative flex h-full w-full items-center justify-center">
      <canvas ref={canvasRef} className={cn('h-full w-full', status !== 'ready' && 'invisible')} />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary/50" />
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <FileWarning className="size-6 text-muted-foreground" />
          <span className="text-[11.5px] text-muted-foreground">Couldn't render a preview for this file.</span>
        </div>
      )}
    </div>
  )
}

interface DocumentPreviewCardProps extends StampToggleValues {
  file: WorkFile
  currentPage: number
  // null = every page gets signed; otherwise only these page numbers do — drives both the
  // thumbnail strip's dimming and whether the stamp actually shows on the page in view.
  selectedPages: number[] | null
  onPageChange: (page: number) => void
  onNumPages?: (numPages: number) => void
  canvasRef: RefObject<HTMLDivElement | null>
  coords: { x: number; y: number }
  isDragging: boolean
  isResizing: boolean
  onStampPointerDown: (e: PointerEvent<HTMLDivElement>) => void
  onStampPointerMove: (e: PointerEvent<HTMLDivElement>) => void
  onStampPointerUp: (e: PointerEvent<HTMLDivElement>) => void
  onResizeStart: (dir: ResizeDir, e: PointerEvent<HTMLDivElement>) => void
  onResizeMove: (e: PointerEvent<HTMLDivElement>) => void
  onResizeEnd: (e: PointerEvent<HTMLDivElement>) => void
  stampWidth: number
  stampHeight: number | null
  stampScale: number
  stampRef: RefObject<HTMLDivElement | null>
  cert?: Cert
  className?: string
}

function DocumentPreviewCard({
  file,
  currentPage,
  selectedPages,
  onPageChange,
  onNumPages,
  canvasRef,
  coords,
  isDragging,
  isResizing,
  onStampPointerDown,
  onStampPointerMove,
  onStampPointerUp,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  stampWidth,
  stampHeight,
  stampScale,
  stampRef,
  cert,
  className,
  ...stampProps
}: DocumentPreviewCardProps) {
  const [aspectRatio, setAspectRatio] = useState(210 / 297)
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const previewAreaRef = useRef<HTMLDivElement>(null)

  // Reset to "fit width" whenever a different document is opened.
  useEffect(() => {
    setZoom(1)
  }, [file.id])

  useEffect(() => {
    const el = previewAreaRef.current
    if (!el) return

    function update() {
      if (!el) return
      const style = getComputedStyle(el)
      const availW = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      if (availW <= 0) return

      // Fit to the available width (scaled by zoom) rather than shrinking to fit height too —
      // tall/dense pages (e.g. tax forms) render bigger and scroll vertically instead of shrinking.
      const width = availW * zoom
      const height = width / aspectRatio
      setPageSize({ width: Math.floor(width), height: Math.floor(height) })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [aspectRatio, zoom])

  function zoomOut() {
    setZoom((z) => Math.max(0.5, Math.round((z - 0.15) * 100) / 100))
  }

  function zoomIn() {
    setZoom((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100))
  }

  return (
    <Card
      className={cn(
        'flex min-h-0 flex-col gap-0 overflow-hidden rounded-2xl border border-border py-0 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent">
            <FileText className="size-4 text-primary" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-semibold" title={file.name}>
              {truncateMiddle(file.name, 44)}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {file.pages > 0 ? `${file.pages} pages` : 'Reading file…'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-[8px] bg-secondary/60 hover:bg-secondary disabled:opacity-40"
            disabled={zoom <= 0.5}
            onClick={zoomOut}
          >
            <ZoomOut className="size-3.5" />
          </Button>
          <span className="w-10 text-center font-mono text-[11px] text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-[8px] bg-secondary/60 hover:bg-secondary disabled:opacity-40"
            disabled={zoom >= 2.5}
            onClick={zoomIn}
          >
            <ZoomIn className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[96px] shrink-0 flex-col gap-2.5 overflow-y-auto border-r border-border bg-secondary/30 p-3">
          {file.pages === 0 && (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {Array.from({ length: file.pages }, (_, i) => i + 1).map((p) => {
            const included = !selectedPages || selectedPages.includes(p)
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                title={selectedPages && !included ? `Page ${p} won't be signed` : undefined}
                className={cn(
                  'relative flex aspect-[3/4] shrink-0 flex-col items-center justify-center gap-1 rounded-[8px] border bg-card text-[10px] font-semibold text-muted-foreground transition-colors',
                  currentPage === p
                    ? 'border-primary text-primary ring-2 ring-primary/25'
                    : 'border-border hover:border-primary/40',
                  !included && 'opacity-40',
                )}
              >
                <FileText className="size-3.5 opacity-50" />
                {p}
                {selectedPages && included && (
                  <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>

        <div ref={previewAreaRef} className="flex flex-1 overflow-auto bg-secondary/20 p-6">
          <div
            ref={canvasRef}
            style={pageSize ? { width: pageSize.width, height: pageSize.height } : { aspectRatio, width: '100%', maxWidth: 420 }}
            className="relative m-auto flex shrink-0 overflow-hidden rounded-[4px] bg-white shadow-[0_2px_4px_rgba(20,32,42,.06),0_16px_32px_-16px_rgba(20,32,42,.2)] ring-1 ring-black/5"
          >
            <PdfPageCanvas
              file={file.file}
              password={file.unlockPassword}
              pageNumber={currentPage}
              onAspectRatio={setAspectRatio}
              onNumPages={onNumPages}
            />

            {!selectedPages || selectedPages.includes(currentPage) ? (
              <StampOverlay
                coords={coords}
                stampWidth={stampWidth}
                stampHeight={stampHeight}
                stampScale={stampScale}
                stampRef={stampRef}
                isDragging={isDragging}
                isResizing={isResizing}
                cert={cert}
                onPointerDown={onStampPointerDown}
                onPointerMove={onStampPointerMove}
                onPointerUp={onStampPointerUp}
                onResizeStart={onResizeStart}
                onResizeMove={onResizeMove}
                onResizeEnd={onResizeEnd}
                {...stampProps}
              />
            ) : (
              <div className="pointer-events-none absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-[7px] border border-border bg-card/95 px-2 py-1 text-[10.5px] font-semibold text-muted-foreground shadow-sm">
                <EyeOff className="size-3" />
                Not signed
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-border px-5 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-[8px] bg-secondary/60 hover:bg-secondary disabled:opacity-40"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="font-mono text-[12px] text-muted-foreground">
          Page {currentPage} of {file.pages}
        </span>
        {selectedPages && !selectedPages.includes(currentPage) && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
            Not signed
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-[8px] bg-secondary/60 hover:bg-secondary disabled:opacity-40"
          disabled={currentPage === file.pages}
          onClick={() => onPageChange(Math.min(file.pages, currentPage + 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </Card>
  )
}

export function SignDocumentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    documents: allDocuments,
    addDocuments,
    replaceDocument,
    saveDraftFile,
    getDraftFile,
    clearDraftFile,
  } = useDocuments()
  // Arriving from "Resume signing" on a pending/draft document (All documents) — we never
  // stored its original bytes, so the user still has to re-add the file, but finishing it here
  // replaces that stale row instead of leaving a duplicate behind.
  const resumeDoc = (location.state as { resumeDocument?: SignedDocument } | null)?.resumeDocument ?? null

  const [files, setFiles] = useState<WorkFile[]>([])
  const isBatch = files.length > 1
  const file = files[0]

  const [certId, setCertId] = useState(certificates.find((c) => c.isDefault)?.id ?? certificates[0]?.id)
  const selectedCert = useMemo(() => certificates.find((c) => c.id === certId) ?? certificates[0], [certId])

  // Sending is a separate step from signing — after a document (or batch) is signed, its
  // freshly-created row(s) are handed to the same Send dialog used everywhere else in the app.
  const [sendTargets, setSendTargets] = useState<SignedDocument[] | null>(null)
  const [batchResultDocs, setBatchResultDocs] = useState<SignedDocument[]>([])

  // Single-document-only state
  const [unlockInput, setUnlockInput] = useState('')
  const [showUnlockPassword, setShowUnlockPassword] = useState(false)
  const [signPhase, setSignPhase] = useState<BatchPhase>('setup')
  const [signStep, setSignStep] = useState(0)
  const [signedResult, setSignedResult] = useState<SignedDocument | null>(null)

  // Read the delivery state back from the store rather than the local snapshot, so the success
  // screens notice when the send dialog has actually delivered something.
  const signedResultSentTo = signedResult
    ? allDocuments.find((doc) => doc.id === signedResult.id)?.sentTo
    : undefined
  const batchSentCount = batchResultDocs.filter(
    (doc) => allDocuments.find((stored) => stored.id === doc.id)?.sentTo,
  ).length
  const [docHash, setDocHash] = useState('')
  const pendingDocRef = useRef<SignedDocument | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageMode, setPageMode] = useState<StandardPageMode | 'current'>('all')
  const [customRange, setCustomRange] = useState('')
  const parsedCustomPages = useMemo(
    () => parsePageRange(customRange, file?.pages ?? 0),
    [customRange, file?.pages],
  )
  const [position, setPosition] = useState<Position>('bottom-right')
  const [customCoords, setCustomCoords] = useState({ x: 78, y: 82 })
  const [singleProtect, setSingleProtect] = useState(false)
  const [singlePassword, setSinglePassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const stampRef = useRef<HTMLDivElement>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const resizeStateRef = useRef<{
    dir: ResizeDir
    startClientXPx: number
    startClientYPx: number
    xPx: number
    yPx: number
    widthPx: number
    heightPx: number
    scale: number
  } | null>(null)

  // Batch-only state
  const [unlockDrafts, setUnlockDrafts] = useState<Record<string, string>>({})
  const [lockedQuery, setLockedQuery] = useState('')
  const [lockedPage, setLockedPage] = useState(0)
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('none')
  const [commonPassword, setCommonPassword] = useState('')
  const [phase, setPhase] = useState<BatchPhase>('setup')
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [csvMatchedCount, setCsvMatchedCount] = useState(0)
  const [csvUnmatched, setCsvUnmatched] = useState<string[]>([])
  const [batchPageMode, setBatchPageMode] = useState<StandardPageMode>('all')
  const [batchPageRange, setBatchPageRange] = useState('')
  const [batchPrefix, setBatchPrefix] = useState('')
  const [batchSuffix, setBatchSuffix] = useState('')
  const [folderName, setFolderName] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stamp appearance — shared by single and batch modes
  const [stampWidth, setStampWidth] = useState<number>(STAMP_WIDTH_DEFAULT)
  const [stampHeight, setStampHeight] = useState<number | null>(null)
  const [stampScale, setStampScale] = useState<number>(STAMP_SCALE_DEFAULT)
  const [showSignerName, setShowSignerName] = useState(true)
  const [showSignedLabel, setShowSignedLabel] = useState(true)
  const [showDate, setShowDate] = useState(true)
  const [showTime, setShowTime] = useState(false)
  const [showReason, setShowReason] = useState(true)
  const [reasonText, setReasonText] = useState('I am the author of this document')
  const [showLocation, setShowLocation] = useState(false)
  const [locationText, setLocationText] = useState('')
  const [showDN, setShowDN] = useState(false)
  const [showCertSerial, setShowCertSerial] = useState(false)

  // Single-only output naming
  const [singlePrefix, setSinglePrefix] = useState('')
  const [singleSuffix, setSingleSuffix] = useState('_signed')

  // Batch-only: which file is shown in the preview panel
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)
  const previewFile = files.find((f) => f.id === previewFileId) ?? files[0]

  // Batch-only: file list search + pagination (a batch can hold anywhere from 1 to thousands of files)
  const [fileQuery, setFileQuery] = useState('')
  const [filePage, setFilePage] = useState(0)
  const filteredFiles = useMemo(() => {
    const q = fileQuery.trim().toLowerCase()
    if (!q) return files
    return files.filter((f) => f.name.toLowerCase().includes(q))
  }, [files, fileQuery])
  const filePageCount = Math.max(1, Math.ceil(filteredFiles.length / FILE_PAGE_SIZE))
  const currentFilePage = Math.min(filePage, filePageCount - 1)
  const pageFiles = filteredFiles.slice(
    currentFilePage * FILE_PAGE_SIZE,
    currentFilePage * FILE_PAGE_SIZE + FILE_PAGE_SIZE,
  )
  const totalPages = files.reduce((sum, f) => sum + f.pages, 0)

  // Batch-only: what the selected page mode resolves to for the file currently shown in the
  // preview panel — "last" (and custom ranges) need a real page count to resolve against.
  const batchPageRangeValid = batchPageMode !== 'custom' || isPageExpressionSyntaxValid(batchPageRange)
  const batchPreviewResolved = useMemo(
    () => resolvePageMode(batchPageMode, batchPageRange, previewFile?.pages ?? 0, { lenient: true }),
    [batchPageMode, batchPageRange, previewFile],
  )

  const presets = useMemo(() => getPresets(stampWidth), [stampWidth])
  const coords = position === 'custom' ? customCoords : presets.find((p) => p.value === position)!.coords

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Carries over what we already know about a resumed document. If it was saved as a draft
  // from this same browser tab, its actual file is still sitting in memory (see
  // DocumentsProvider) and gets loaded straight back in; otherwise — a draft from a fresh
  // reload, or one of the seeded example rows that never had a real file — the user still has
  // to add it by hand, same as before.
  //
  // Guarded by a ref rather than relying on addFiles being safe to call twice: it appends, so
  // React StrictMode's dev-only double-invoke of this effect would otherwise load the same
  // cached file in as two separate entries.
  const resumeLoadedRef = useRef(false)
  useEffect(() => {
    if (!resumeDoc || resumeLoadedRef.current) return
    resumeLoadedRef.current = true
    const cachedFile = getDraftFile(resumeDoc.id)
    if (cachedFile) addFiles([cachedFile])
    // Only the navigation that started this visit should seed these fields — not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isBatch && !folderName) {
      setFolderName(
        `Batch — ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      )
    }
  }, [isBatch, folderName])

  useEffect(() => {
    if (isBatch && (!previewFileId || !files.some((f) => f.id === previewFileId))) {
      setPreviewFileId(files[0]?.id ?? null)
    }
  }, [isBatch, previewFileId, files])

  useEffect(() => {
    setCurrentPage(1)
  }, [previewFileId])

  useEffect(() => {
    setUnlockInput('')
    setShowUnlockPassword(false)
  }, [file?.id])

  useEffect(() => {
    if (!isBatch || phase !== 'processing') return
    if (files.length === 0 || !files.every((f) => f.progress >= 100 && f.pages > 0)) return

    if (timerRef.current) clearInterval(timerRef.current)

    const cert = certificates.find((c) => c.id === certId)
    const batchName =
      folderName.trim() ||
      `Batch — ${new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}`
    const newDocuments: SignedDocument[] = files.map((f) => {
      // "last"/"first-last" resolve against this file's own page count; for custom ranges, a
      // page number that doesn't exist in this particular file is skipped (lenient mode) — if
      // nothing in the expression resolves for this file, sign every page instead.
      const resolvedPages = resolvePageMode(batchPageMode, batchPageRange, f.pages, { lenient: true })
      const signedPages = resolvedPages
        ? formatPageSelection(resolvedPages, f.pages)
        : `All ${f.pages} page${f.pages === 1 ? '' : 's'}`

      return {
        id: `doc-${Date.now()}-${f.id}`,
        name:
          batchPrefix.trim() || batchSuffix.trim()
            ? buildOutputName(batchPrefix, stripPdfExt(f.name), batchSuffix)
            : f.name,
        status: 'signed',
        pages: f.pages,
        signedPages,
        signedBy: cert?.holderName ?? 'Unknown',
        certificate: cert ? `${cert.holderName} (${cert.organization})` : 'Unknown',
        updatedAt: new Date().toISOString(),
        passwordProtected: passwordMode !== 'none',
        password:
          passwordMode === 'common'
            ? commonPassword.trim()
            : passwordMode === 'custom' || passwordMode === 'uploaded-list'
              ? f.password.trim()
              : undefined,
        source: 'batch',
        batchName,
      }
    })
    addDocuments(newDocuments)
    setBatchResultDocs(newDocuments)
    setPhase('done')
    toast.success(`Batch complete — ${files.length} files signed`)
  }, [
    files,
    phase,
    isBatch,
    certId,
    passwordMode,
    commonPassword,
    folderName,
    batchPrefix,
    batchSuffix,
    batchPageMode,
    batchPageRange,
    addDocuments,
  ])

  // Advances the single-document signing checklist one step at a time; once every step has
  // played, commits the document (addDocuments) and moves to the success screen. Modeled after
  // the batch effect above, just driven by a step counter instead of per-file progress.
  useEffect(() => {
    if (isBatch || signPhase !== 'processing') return

    if (signStep >= SIGN_STEPS.length) {
      const doc = pendingDocRef.current
      if (doc) {
        if (resumeDoc) {
          replaceDocument(resumeDoc.id, doc)
          clearDraftFile(resumeDoc.id)
        } else {
          addDocuments([doc])
        }
        setSignedResult(doc)
        toast.success(`${doc.name} signed with ${doc.signedBy}'s certificate`, {
          description: doc.sentTo
            ? `Sent to ${doc.sentTo}${doc.passwordProtected ? ' · password protected' : ''}`
            : 'Saved to your documents',
        })
      }
      setSignPhase('done')
      return
    }

    const timer = setTimeout(() => setSignStep((s) => s + 1), 550)
    return () => clearTimeout(timer)
  }, [isBatch, signPhase, signStep, addDocuments, replaceDocument, resumeDoc, clearDraftFile])

  function addFiles(newFiles: File[]) {
    const entries: WorkFile[] = newFiles.map((f) => ({
      id: `${f.name}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      file: f,
      pages: 0,
      password: '',
      progress: 0,
      protection: 'checking',
    }))
    setFiles((prev) => [...prev, ...entries])
    setCurrentPage(1)

    // Every newly added file is probed for an existing open-password right away — the user
    // needs to know (and, in bulk, get a chance to supply it) before they invest any time
    // placing a signature on a document we can't actually read yet.
    for (const entry of entries) {
      checkPdfPassword(entry.file).then((result) => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? { ...f, protection: result === 'ok' ? 'none' : result === 'password-required' ? 'locked' : 'error' }
              : f,
          ),
        )
      })
    }
  }

  // Same intake as the FileDropzone (expands .zip archives, keeps only PDFs) for the compact
  // "+ Add" inputs elsewhere in the flow, which are plain <input type="file"> rather than a
  // full dropzone.
  async function addPickedFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const resolved = await resolveIncomingFiles(Array.from(fileList))
    if (resolved.length === 0) {
      toast.error('No PDF files found')
      return
    }
    addFiles(resolved)
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  // Tries a candidate open-password against one locked file — used by both the single-file
  // unlock screen and the batch unlock list/CSV import below.
  function attemptUnlock(id: string, password: string) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, protection: 'checking', unlockError: undefined } : f)))
    const target = files.find((f) => f.id === id)
    if (!target) return
    checkPdfPassword(target.file, password).then((result) => {
      setFiles((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f
          if (result === 'ok') return { ...f, protection: 'unlocked', unlockPassword: password, unlockError: undefined }
          return {
            ...f,
            protection: 'locked',
            unlockError: result === 'wrong-password' ? 'Incorrect password.' : "Couldn't open this file.",
          }
        }),
      )
    })
  }

  function updateFilePassword(id: string, password: string) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, password } : f)))
  }

  // The password-to-protect-with template — just Filename + Password. Recipient info no longer
  // belongs here: sending is a separate step, handled after signing by the Send dialog.
  function downloadPasswordTemplate() {
    const rows = [['File Name', 'Password'], ...files.map((f) => [f.name, ''])]
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'password-template.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function handlePasswordListFile(csvFile: File) {
    const reader = new FileReader()
    reader.onerror = () => toast.error('Could not read that file.')
    reader.onload = () => {
      const rows = parseUnlockCsvText(String(reader.result ?? ''))
      if (rows.length === 0) {
        toast.error('That CSV has no rows — it needs a File Name column and a Password column.')
        return
      }

      const byName = new Map(rows.map((r) => [r.filename.toLowerCase(), r]))
      const matched = files.filter((f) => byName.has(f.name.toLowerCase()))
      const unmatched = files.filter((f) => !byName.has(f.name.toLowerCase()))

      setFiles((prev) =>
        prev.map((f) => {
          const row = byName.get(f.name.toLowerCase())
          if (!row) return f
          return { ...f, password: row.password || f.password }
        }),
      )
      setCsvFileName(csvFile.name)
      setCsvMatchedCount(matched.length)
      setCsvUnmatched(unmatched.map((f) => f.name))

      if (matched.length === 0) {
        toast.error('No filenames in that CSV matched your uploaded files.')
      } else if (unmatched.length > 0) {
        toast.warning(`Matched ${matched.length} of ${files.length} files — ${unmatched.length} still need a row.`)
      } else {
        toast.success(`Loaded ${matched.length} rows from ${csvFile.name}`)
      }
    }
    reader.readAsText(csvFile)
  }

  function csvCell(value: string) {
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  }

  // Splits one CSV line into cells, honoring double-quoted values that may contain commas
  // or escaped ("") quotes — used only by the unlock-CSV parser below, which is a distinct
  // 2-column format (Filename, Password) unrelated to the recipient template.
  function parseCsvLine(line: string): string[] {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"'
          i++
        } else if (char === '"') {
          inQuotes = false
        } else {
          current += char
        }
      } else if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        cells.push(current)
        current = ''
      } else {
        current += char
      }
    }
    cells.push(current)
    return cells
  }

  function parseUnlockCsvText(text: string): { filename: string; password: string }[] {
    const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0)
    const rows = lines.map(parseCsvLine)
    const looksLikeHeader = rows[0]?.some((cell) => /filename|file name|password/i.test(cell))
    const dataRows = looksLikeHeader ? rows.slice(1) : rows
    return dataRows
      .filter((cols) => cols[0]?.trim())
      .map((cols) => ({ filename: cols[0].trim(), password: (cols[1] ?? '').trim() }))
  }

  // Same shape as the recipient template above, but for the EXISTING open-password on whichever
  // uploaded files turned out to be locked — a separate template because it answers a different
  // question ("what already opens this file" vs. "what should protect it once sent").
  function downloadUnlockTemplate() {
    const locked = files.filter((f) => f.protection === 'locked')
    const rows = [['Filename', 'Password'], ...locked.map((f) => [f.name, ''])]
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'unlock-password-template.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function handleUnlockCsvFile(csvFile: File) {
    const reader = new FileReader()
    reader.onerror = () => toast.error('Could not read that file.')
    reader.onload = () => {
      const rows = parseUnlockCsvText(String(reader.result ?? ''))
      if (rows.length === 0) {
        toast.error('That CSV has no rows — it needs a Filename column and a Password column.')
        return
      }
      const byName = new Map(rows.map((r) => [r.filename.toLowerCase(), r.password]))
      const targets = files.filter((f) => f.protection === 'locked' && byName.has(f.name.toLowerCase()))
      if (targets.length === 0) {
        toast.error('No filenames in that CSV matched your locked files.')
        return
      }
      targets.forEach((f) => attemptUnlock(f.id, byName.get(f.name.toLowerCase())!))
      toast(`Trying passwords for ${targets.length} file${targets.length === 1 ? '' : 's'}…`)
    }
    reader.readAsText(csvFile)
  }

  function updateFilePages(id: string, pages: number) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, pages } : f)))
  }

  function resetAll() {
    if (resumeDoc) window.history.replaceState({}, '')
    setFiles([])
    setPhase('setup')
    setCommonPassword('')
    setSubmitAttempted(false)
    setCsvFileName(null)
    setCsvMatchedCount(0)
    setCsvUnmatched([])
    setBatchPageMode('all')
    setBatchPageRange('')
    setBatchPrefix('')
    setBatchSuffix('')
    setFolderName('')
    setSinglePrefix('')
    setSingleSuffix('_signed')
    setPreviewFileId(null)
    setFileQuery('')
    setFilePage(0)
    setSignPhase('setup')
    setSignStep(0)
    setSignedResult(null)
    setDocHash('')
    setBatchResultDocs([])
    pendingDocRef.current = null
    setUnlockInput('')
    setShowUnlockPassword(false)
    setUnlockDrafts({})
    setLockedQuery('')
    setLockedPage(0)
  }

  function updateCoordsFromPoint(clientX: number, clientY: number, offsetX = 0, offsetY = 0) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const maxX = 100 - stampWidth - STAMP_MARGIN
    const maxY = 88
    const x = Math.min(maxX, Math.max(STAMP_MARGIN, ((clientX - rect.left) / rect.width) * 100 - offsetX))
    const y = Math.min(maxY, Math.max(STAMP_MARGIN, ((clientY - rect.top) / rect.height) * 100 - offsetY))
    setCustomCoords({ x, y })
    setPosition('custom')
  }

  function handleStampPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const pointerXPct = ((e.clientX - rect.left) / rect.width) * 100
      const pointerYPct = ((e.clientY - rect.top) / rect.height) * 100
      dragOffsetRef.current = { x: pointerXPct - coords.x, y: pointerYPct - coords.y }
    }
    setIsDragging(true)
  }

  function handleStampPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!isDragging) return
    updateCoordsFromPoint(e.clientX, e.clientY, dragOffsetRef.current.x, dragOffsetRef.current.y)
  }

  function handleStampPointerUp(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setIsDragging(false)
  }

  function handleResizeStart(dir: ResizeDir, e: PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    const stampRect = stampRef.current?.getBoundingClientRect()
    if (!canvasRect || !stampRect) return
    resizeStateRef.current = {
      dir,
      startClientXPx: e.clientX - canvasRect.left,
      startClientYPx: e.clientY - canvasRect.top,
      xPx: (coords.x / 100) * canvasRect.width,
      yPx: (coords.y / 100) * canvasRect.height,
      // The stamp's own actual rendered size at drag-start — whether that came from an auto
      // (content-fit) height or a previously fixed one — so the drag starts from wherever it
      // visually is right now, not from some recomputed value.
      widthPx: stampRect.width,
      heightPx: stampRect.height,
      scale: stampScale,
    }
    setIsResizing(true)
  }

  function handleResizeMove(e: PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    const start = resizeStateRef.current
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!start || !rect) return

    const dx = e.clientX - rect.left - start.startClientXPx
    const dy = e.clientY - rect.top - start.startClientYPx
    const marginXPx = (STAMP_MARGIN / 100) * rect.width
    const marginYPx = (STAMP_MARGIN / 100) * rect.height
    const isCorner = start.dir.length === 2

    if (isCorner) {
      // A corner means "make the whole stamp bigger/smaller" — width and text size scale
      // together in lockstep (like resizing an image), and height goes back to auto so it
      // naturally fits whatever the now-bigger-or-smaller text needs.
      const sideSign = start.dir.includes('w') ? -1 : 1
      const rawRatio = (start.widthPx + sideSign * dx) / start.widthPx

      const maxWidthPx = Math.min(
        (STAMP_WIDTH_MAX / 100) * rect.width,
        start.dir.includes('w') ? start.xPx + start.widthPx - marginXPx : rect.width - start.xPx - marginXPx,
      )
      const widthMinRatio = ((STAMP_WIDTH_MIN / 100) * rect.width) / start.widthPx
      const widthMaxRatio = maxWidthPx / start.widthPx
      const scaleMinRatio = STAMP_SCALE_MIN / start.scale
      const scaleMaxRatio = STAMP_SCALE_MAX / start.scale

      const ratio = clamp(rawRatio, Math.max(widthMinRatio, scaleMinRatio), Math.min(widthMaxRatio, scaleMaxRatio))
      const widthPx = start.widthPx * ratio
      const xPx = start.dir.includes('w') ? start.xPx + start.widthPx - widthPx : start.xPx

      setStampWidth((widthPx / rect.width) * 100)
      setStampScale(start.scale * ratio)
      setStampHeight(null)
      setCustomCoords({ x: (xPx / rect.width) * 100, y: coords.y })
      setPosition('custom')
      return
    }

    if (start.dir === 'e' || start.dir === 'w') {
      let widthPx = start.dir === 'e' ? start.widthPx + dx : start.widthPx - dx
      const maxWidthPx = Math.min(
        (STAMP_WIDTH_MAX / 100) * rect.width,
        start.dir === 'w' ? start.xPx + start.widthPx - marginXPx : rect.width - start.xPx - marginXPx,
      )
      widthPx = clamp(widthPx, (STAMP_WIDTH_MIN / 100) * rect.width, maxWidthPx)
      const xPx = start.dir === 'w' ? start.xPx + start.widthPx - widthPx : start.xPx

      setStampWidth((widthPx / rect.width) * 100)
      setCustomCoords({ x: (xPx / rect.width) * 100, y: coords.y })
      setPosition('custom')
      return
    }

    // 'n' or 's': height only.
    let heightPx = start.dir === 's' ? start.heightPx + dy : start.heightPx - dy
    const maxHeightPx =
      start.dir === 'n' ? start.yPx + start.heightPx - marginYPx : rect.height - start.yPx - marginYPx
    heightPx = clamp(heightPx, STAMP_HEIGHT_MIN_PX, maxHeightPx)
    const yPx = start.dir === 'n' ? start.yPx + start.heightPx - heightPx : start.yPx

    setStampHeight((heightPx / rect.height) * 100)
    setCustomCoords({ x: coords.x, y: (yPx / rect.height) * 100 })
    setPosition('custom')
  }

  function handleResizeEnd(e: PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.currentTarget.releasePointerCapture(e.pointerId)
    resizeStateRef.current = null
    setIsResizing(false)
  }

  function handleSignSingle() {
    if (!file) return
    if (file.protection === 'locked' || file.protection === 'checking') return
    if (singleProtect && singlePassword.trim().length < 4) {
      toast.error('Set a password with at least 4 characters, or turn protection off.')
      return
    }
    if (pageMode === 'custom' && !parsedCustomPages) {
      toast.error(`Enter a valid page range between 1 and ${file.pages}.`)
      return
    }

    const resolvedSinglePages = pageMode === 'current' ? [currentPage] : resolvePageMode(pageMode, customRange, file.pages)
    const signedPages = resolvedSinglePages
      ? formatPageSelection(resolvedSinglePages, file.pages)
      : `All ${file.pages} page${file.pages === 1 ? '' : 's'}`

    const newDocument: SignedDocument = {
      id: `doc-${Date.now()}`,
      name: buildOutputName(singlePrefix, stripPdfExt(file.name), singleSuffix) || file.name,
      status: 'signed',
      pages: file.pages,
      signedPages,
      signedBy: selectedCert?.holderName ?? 'Unknown',
      certificate: selectedCert ? `${selectedCert.holderName} (${selectedCert.organization})` : 'Unknown',
      updatedAt: new Date().toISOString(),
      passwordProtected: singleProtect,
      password: singleProtect ? singlePassword.trim() : undefined,
      source: 'single',
    }

    // The document isn't added to the library yet — that, and the success toast, happen once
    // the staged effect above finishes playing through SIGN_STEPS.
    pendingDocRef.current = newDocument
    setDocHash(generateDocHash())
    setSignStep(0)
    setSignPhase('processing')
  }

  // Saves whatever is set up so far without actually signing anything — nothing here needs
  // validating, since a draft is by definition unfinished. Saving a draft that was itself
  // resumed from a draft updates that same row instead of creating a second one.
  function handleSaveDraft() {
    if (!file) return

    const draftDocument: SignedDocument = {
      id: resumeDoc?.id ?? `doc-${Date.now()}`,
      name: buildOutputName(singlePrefix, stripPdfExt(file.name), singleSuffix) || file.name,
      status: 'draft',
      pages: file.pages,
      signedBy: '—',
      certificate: '—',
      updatedAt: new Date().toISOString(),
      passwordProtected: false,
      source: 'single',
    }

    saveDraftFile(draftDocument.id, file.file)
    if (resumeDoc) replaceDocument(resumeDoc.id, draftDocument)
    else addDocuments([draftDocument])

    toast.success(`${draftDocument.name} saved as a draft`, { description: 'Resume it anytime from All documents.' })
    navigate('/documents')
  }

  function startBatch() {
    if (files.length === 0) return
    setSubmitAttempted(true)
    if (files.some((f) => f.protection === 'locked' || f.protection === 'checking')) {
      toast.error('Unlock every password-protected file before signing, or remove it from the batch.')
      return
    }
    if (passwordMode === 'common' && commonPassword.trim().length < 4) {
      toast.error('Set a common password with at least 4 characters.')
      return
    }
    if (passwordMode === 'custom' && files.some((f) => f.password.trim().length < 4)) {
      toast.error('Every file needs a password of at least 4 characters.')
      return
    }
    if (passwordMode === 'uploaded-list' && files.some((f) => f.password.trim().length < 4)) {
      toast.error('Every file needs a password of at least 4 characters — check your CSV or fill in the rest below.')
      return
    }
    if (batchPageMode === 'custom' && !isPageExpressionSyntaxValid(batchPageRange)) {
      toast.error('Enter a valid page selection, e.g. "1-3, 6, 6-12" or "first, last".')
      return
    }

    setPhase('processing')

    // Resolve real page counts for every file (not just the ones previewed) before the batch finishes.
    files.forEach((f) => {
      if (f.pages > 0) return
      loadPdfDocument(f.file, f.unlockPassword)
        .then((doc) => updateFilePages(f.id, doc.numPages))
        .catch(() => updateFilePages(f.id, 1))
    })

    timerRef.current = setInterval(() => {
      setFiles((prev) =>
        prev.map((f) => (f.progress >= 100 ? f : { ...f, progress: Math.min(100, f.progress + Math.random() * 22 + 8) })),
      )
    }, 450)
  }

  // ---------- Empty state ----------
  if (files.length === 0) {
    return (
      <div className="relative flex flex-1 flex-col gap-2 overflow-hidden p-3 sm:p-4">
        <PageHeader
          title="Sign a document"
          description={
            resumeDoc
              ? `Continuing ${resumeDoc.name} — add the file to finish signing it.`
              : 'Upload one PDF to sign it yourself, or several at once to batch sign them together.'
          }
          icon={FileSignature}
        />

        {/* Soft, separate color blobs — echoing the logo's blue + coral color-blocking rather
            than blending them into a gradient, which reads muddy at this size. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-8 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-12 bottom-4 size-56 rounded-full bg-brand-pink/[0.07] blur-3xl"
        />

        <div className="relative flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-3xl flex-col items-center gap-9">
            {resumeDoc && (
              <div className="flex w-full max-w-lg items-start gap-2.5 rounded-[10px] border border-primary/20 bg-primary/5 p-3.5">
                <PenLine className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-[12.5px] text-muted-foreground">
                  Continuing <span className="font-semibold text-foreground">{resumeDoc.name}</span> — this file
                  isn't stored, so add it again to finish signing.
                  {resumeDoc.sentTo && <> We've kept {resumeDoc.sentTo} as the recipient.</>}
                </span>
              </div>
            )}
            <FileDropzone multiple onFiles={addFiles} className="max-w-lg" />

            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3.5 rounded-2xl border border-border bg-card p-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-primary/10 text-primary">
                  <FileSignature className="size-4.5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13.5px] font-semibold">Select one file</span>
                  <span className="text-[12.5px] text-muted-foreground">
                    Preview it, place your signature and send it to your client.
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-3.5 rounded-2xl border border-border bg-card p-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-brand-teal/10 text-brand-teal">
                  <Layers className="size-4.5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13.5px] font-semibold">Select several files</span>
                  <span className="text-[12.5px] text-muted-foreground">
                    We'll switch to batch mode — one certificate, signature position and password policy for all of
                    them, with a live preview for each file.
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11.5px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-brand-teal" />
                DSC-certified signatures
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="size-3.5 text-brand-pink" />
                Password protection on send
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---------- Batch mode ----------
  if (isBatch) {
    const lockedFiles = files.filter((f) => f.protection === 'locked')
    const checkingFiles = files.filter((f) => f.protection === 'checking')

    if (phase === 'processing') {
      const completedCount = files.filter((f) => f.progress >= 100).length
      const signingCount = files.filter((f) => f.progress > 0 && f.progress < 100).length
      const avgProgress = files.reduce((sum, f) => sum + f.progress, 0) / files.length
      const stageIndex = Math.min(BATCH_SIGN_STEPS.length - 1, Math.floor(avgProgress / 25))
      const ActiveStageIcon = BATCH_SIGN_STEPS[stageIndex].icon

      return (
        <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3 sm:p-4">
          <PageHeader
            title="Sign a document"
            description={`Signing ${files.length} documents together as a batch…`}
            icon={FileSignature}
          />

          <div
            aria-hidden
            className="pointer-events-none absolute top-10 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-16 bottom-10 size-56 rounded-full bg-brand-teal/[0.08] blur-3xl"
          />

          <div className="relative grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
            <Card className="flex flex-col items-center justify-center gap-8 rounded-2xl border border-border p-8 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
              <div className="flex animate-in flex-col items-center gap-5 fade-in-0 slide-in-from-bottom-2 text-center duration-500">
                <div className="relative flex size-28 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
                  <svg className="absolute inset-0 -rotate-90" width="112" height="112" viewBox="0 0 112 112">
                    <circle cx="56" cy="56" r="50" fill="none" stroke="currentColor" strokeWidth="4" className="text-secondary" />
                    <circle
                      cx="56"
                      cy="56"
                      r="50"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      className="text-primary"
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={1 - avgProgress / 100}
                      style={{ transition: 'stroke-dashoffset 400ms cubic-bezier(0.4,0,0.2,1)' }}
                    />
                  </svg>
                  <div
                    key={stageIndex}
                    className="flex size-16 animate-in items-center justify-center rounded-full bg-primary/10 zoom-in-50 fade-in-0 duration-300"
                  >
                    <ActiveStageIcon className="size-6 text-primary" />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-heading text-[17px] font-bold">{BATCH_SIGN_STEPS[stageIndex].label}</span>
                  <span className="text-[12.5px] text-muted-foreground">
                    {completedCount} of {files.length} files signed
                  </span>
                </div>
              </div>
              <div className="flex w-full flex-col items-center gap-2">
                <Progress
                  value={avgProgress}
                  className="h-2 w-full [&>div]:bg-linear-to-r [&>div]:from-primary [&>div]:to-[#2f93c0]"
                />
                <span className="text-[11px] text-muted-foreground">
                  {Math.round(avgProgress)}% · please don't close this window
                </span>
              </div>
            </Card>

            <Card className="flex min-h-0 flex-col gap-0 overflow-hidden rounded-2xl border border-border shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
                <span className="text-[13px] font-semibold">Files</span>
                <div className="flex items-center gap-3 text-[11.5px] font-semibold">
                  <span className="text-success">{completedCount} done</span>
                  <span className="text-primary">{signingCount} signing</span>
                  <span className="text-muted-foreground">{files.length - completedCount - signingCount} queued</span>
                </div>
              </div>
              {files.length > FILE_PAGE_SIZE && (
                <div className="border-b border-border px-3 py-2.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={fileQuery}
                      onChange={(e) => {
                        setFileQuery(e.target.value)
                        setFilePage(0)
                      }}
                      placeholder="Search files…"
                      className="h-8 rounded-[8px] bg-secondary/60 pl-8 text-[12px]"
                    />
                  </div>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {pageFiles.map((f, index) => (
                  <div
                    key={f.id}
                    className={cn(
                      'flex animate-in items-center gap-3 px-5 py-3 fade-in-0 slide-in-from-left-1 duration-300',
                      index > 0 && 'border-t border-border',
                    )}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-accent">
                      <FileText className="size-3.5 text-primary" />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium" title={f.name}>
                      {truncateMiddle(f.name, 36)}
                    </span>
                    <div className="w-32 shrink-0">
                      <Progress
                        value={f.progress}
                        className={cn('h-1.5', f.progress >= 100 ? '[&>div]:bg-success' : '[&>div]:bg-primary')}
                      />
                    </div>
                    {f.progress >= 100 ? (
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                    ) : (
                      <span className="w-9 shrink-0 text-right font-mono text-[10.5px] text-muted-foreground">
                        {Math.round(f.progress)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {filteredFiles.length > FILE_PAGE_SIZE && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    {currentFilePage * FILE_PAGE_SIZE + 1}-
                    {Math.min(filteredFiles.length, (currentFilePage + 1) * FILE_PAGE_SIZE)} of {filteredFiles.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-[7px] bg-secondary/60 hover:bg-secondary disabled:opacity-40"
                      disabled={currentFilePage === 0}
                      onClick={() => setFilePage((p) => p - 1)}
                    >
                      <ChevronLeft className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-[7px] bg-secondary/60 hover:bg-secondary disabled:opacity-40"
                      disabled={currentFilePage >= filePageCount - 1}
                      onClick={() => setFilePage((p) => p + 1)}
                    >
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )
    }

    if (phase === 'done') {
      const protectedCount = passwordMode === 'none' ? 0 : files.length
      const burstDots = [
        { x: -46, y: -58, color: 'var(--primary)', delay: 0 },
        { x: 50, y: -50, color: 'var(--brand-teal)', delay: 60 },
        { x: -62, y: 10, color: 'var(--brand-orange)', delay: 120 },
        { x: 60, y: 20, color: 'var(--brand-pink)', delay: 90 },
        { x: -20, y: -70, color: 'var(--success)', delay: 150 },
        { x: 24, y: -68, color: 'var(--primary)', delay: 40 },
      ]

      return (
        <div className="relative flex flex-1 flex-col gap-2 overflow-hidden p-3 sm:p-4">
          <PageHeader
            title="Sign a document"
            description={`${files.length} documents signed together as a batch.`}
            icon={FileSignature}
          />

          <div
            aria-hidden
            className="pointer-events-none absolute top-10 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-success/[0.07] blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-16 bottom-10 size-56 rounded-full bg-primary/[0.07] blur-3xl"
          />

          <Card className="relative flex flex-1 flex-col gap-0 overflow-y-auto rounded-2xl border border-border py-0 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
            <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-7 px-6 py-14">
              <div className="flex animate-in flex-col items-center gap-3 fade-in-0 zoom-in-95 text-center duration-500">
                <div className="relative flex size-20 items-center justify-center">
                  <div className="absolute inset-0 animate-pulse rounded-full bg-success/15 blur-lg" />
                  {burstDots.map((dot, i) => (
                    <span
                      key={i}
                      aria-hidden
                      style={
                        {
                          '--burst-x': `${dot.x}px`,
                          '--burst-y': `${dot.y}px`,
                          background: dot.color,
                          animationDelay: `${dot.delay}ms`,
                        } as CSSProperties
                      }
                      className="absolute top-1/2 left-1/2 size-1.5 rounded-full opacity-0 [animation:burst-out_0.7s_ease-out_forwards]"
                    />
                  ))}
                  <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="relative text-success">
                    <circle cx="36" cy="36" r="32" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
                    <circle
                      cx="36"
                      cy="36"
                      r="32"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={1}
                      className="[animation:stroke-draw_0.6s_ease-out_forwards]"
                    />
                    <path
                      d="M22 37 L31 46 L50 25"
                      stroke="currentColor"
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={1}
                      className="[animation:stroke-draw_0.35s_ease-out_0.55s_forwards]"
                    />
                  </svg>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-heading text-[19px] font-bold">
                    {files.length} document{files.length > 1 ? 's' : ''} signed successfully
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {folderName.trim() || 'This batch'} is ready to share
                  </span>
                </div>
              </div>

              <div className="grid w-full animate-in grid-cols-2 gap-3 fade-in-0 slide-in-from-bottom-2 delay-150 duration-500">
                <div className="flex flex-col items-center gap-1 rounded-[10px] border border-border p-4">
                  <span className="text-[20px] font-bold text-primary">{files.length}</span>
                  <span className="text-[11px] text-muted-foreground">Signed</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-[10px] border border-border p-4">
                  <span className="text-[20px] font-bold text-success">{protectedCount}</span>
                  <span className="text-[11px] text-muted-foreground">Password protected</span>
                </div>
              </div>

              <div
                className={cn(
                  'flex w-full animate-in items-center gap-2.5 rounded-[10px] p-3.5 text-[12px] fade-in-0 delay-200 duration-500',
                  batchSentCount > 0
                    ? 'border border-success/25 bg-success/[0.06] text-success'
                    : 'bg-secondary/50 text-muted-foreground',
                )}
              >
                {batchSentCount > 0 ? (
                  <>
                    <MailCheck className="size-4 shrink-0" />
                    {batchSentCount} of {batchResultDocs.length} files emailed to clients.
                  </>
                ) : (
                  <>
                    <Mail className="size-4 shrink-0 text-primary" />
                    Nothing's been emailed yet — send it to your clients whenever you're ready.
                  </>
                )}
              </div>

              <div className="flex w-full animate-in flex-col items-center gap-3 fade-in-0 delay-300 duration-500">
                <Button
                  variant={batchSentCount === batchResultDocs.length ? 'ghost' : 'default'}
                  className={cn(
                    'h-11 w-full gap-1.5 rounded-[10px] font-semibold',
                    batchSentCount === batchResultDocs.length
                      ? 'bg-secondary hover:bg-secondary/70'
                      : 'border-none bg-linear-to-br from-primary to-[#2f93c0] shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:opacity-95',
                  )}
                  onClick={() => setSendTargets(batchResultDocs)}
                >
                  <Send className="size-4" />
                  {batchSentCount === batchResultDocs.length
                    ? 'Send again'
                    : batchSentCount > 0
                      ? 'Send the remaining files'
                      : 'Send to clients'}
                </Button>
                <div className="flex w-full items-center gap-2.5">
                  <Button
                    variant="ghost"
                    className="h-11 flex-1 gap-1.5 rounded-[10px] bg-secondary font-semibold hover:bg-secondary/70"
                    onClick={() => toast('Downloading signed files as a ZIP archive.')}
                  >
                    <Download className="size-4" />
                    Download all
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-11 flex-1 gap-1.5 rounded-[10px] bg-secondary font-semibold hover:bg-secondary/70"
                    onClick={() => navigate('/documents')}
                  >
                    View all documents
                  </Button>
                </div>
                <button onClick={resetAll} className="text-[12.5px] font-semibold text-primary hover:underline">
                  Start over
                </button>
              </div>
            </div>
          </Card>
          {sendTargets && (
            <SendDialog
              documents={sendTargets}
              open={sendTargets !== null}
              onOpenChange={(open) => !open && setSendTargets(null)}
            />
          )}
        </div>
      )
    }

    // Files must be fully readable before the user ever sees the workspace — while any file is
    // still being checked, or is locked, show only this gate. It never coexists with the normal
    // batch grid below.
    if (lockedFiles.length > 0 || checkingFiles.length > 0) {
      const unlockedCount = files.length - lockedFiles.length - checkingFiles.length
      const readyPct = (unlockedCount / files.length) * 100
      const query = lockedQuery.trim().toLowerCase()
      const filteredLocked = query ? lockedFiles.filter((f) => f.name.toLowerCase().includes(query)) : lockedFiles
      const lockedPageCount = Math.max(1, Math.ceil(filteredLocked.length / FILE_PAGE_SIZE))
      const currentLockedPage = Math.min(lockedPage, lockedPageCount - 1)
      const lockedPageFiles = filteredLocked.slice(
        currentLockedPage * FILE_PAGE_SIZE,
        currentLockedPage * FILE_PAGE_SIZE + FILE_PAGE_SIZE,
      )

      return (
        <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3 sm:p-4">
          <PageHeader
            title="Sign a document"
            description="Unlock every password-protected file before this batch can be signed."
            icon={FileSignature}
            action={
              <Button
                variant="ghost"
                className="h-9 rounded-[10px] bg-secondary px-4 text-[12.5px] font-semibold hover:bg-secondary/70"
                onClick={resetAll}
              >
                Clear all
              </Button>
            }
          />

          <div
            aria-hidden
            className="pointer-events-none absolute top-10 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-warning/[0.06] blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-16 bottom-10 size-56 rounded-full bg-primary/[0.06] blur-3xl"
          />

          <Card className="relative flex min-h-0 flex-1 flex-col gap-0 overflow-hidden rounded-2xl border border-border shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
            <div className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-warning/10">
                  {lockedFiles.length === 0 ? (
                    <Loader2 className="size-5 animate-spin text-warning" />
                  ) : (
                    <Lock className="size-5 text-warning" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold">
                    {lockedFiles.length > 0
                      ? `${lockedFiles.length} of ${files.length} files need a password`
                      : `Checking ${checkingFiles.length} file${checkingFiles.length === 1 ? '' : 's'}…`}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {unlockedCount} ready to sign
                    {lockedFiles.length > 0 && ` · ${lockedFiles.length} locked`}
                    {checkingFiles.length > 0 && ` · ${checkingFiles.length} checking`}
                  </span>
                </div>
              </div>
              <div className="flex w-full flex-col gap-1.5 sm:w-56">
                <Progress value={readyPct} className="h-1.5 [&>div]:bg-success" />
                <span className="text-right font-mono text-[10.5px] text-muted-foreground">
                  {unlockedCount} / {files.length} ready
                </span>
              </div>
            </div>

            {lockedFiles.length > 0 && (
              <>
                <div className="flex flex-col gap-3 border-b border-border bg-secondary/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold">Unlocking many files?</span>
                    <span className="text-[11.5px] text-muted-foreground">
                      Download a template, fill in a password per row, then upload it back — matched by filename.
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={downloadUnlockTemplate}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12px] font-semibold hover:bg-secondary"
                    >
                      <FileDown className="size-3.5" />
                      Download template
                    </button>
                    <label className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90">
                      <Upload className="size-3.5" />
                      Upload filled CSV
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                          const selected = e.target.files?.[0]
                          if (selected) handleUnlockCsvFile(selected)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                  <div className="relative w-full max-w-72">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={lockedQuery}
                      onChange={(e) => {
                        setLockedQuery(e.target.value)
                        setLockedPage(0)
                      }}
                      placeholder="Search locked files…"
                      className="h-9 rounded-[8px] bg-secondary/60 pl-8 text-[12px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => lockedFiles.forEach((f) => removeFile(f.id))}
                    className="text-[12px] font-semibold text-destructive hover:underline"
                  >
                    Remove all {lockedFiles.length} locked file{lockedFiles.length === 1 ? '' : 's'}
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6">
                  {lockedPageFiles.length === 0 && (
                    <div className="py-10 text-center text-[12.5px] text-muted-foreground">
                      No locked files match your search.
                    </div>
                  )}
                  {lockedPageFiles.map((f) => (
                    <div key={f.id} className="flex flex-wrap items-center gap-2.5 border-b border-border py-3 last:border-b-0">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-warning/10">
                        <Lock className="size-3.5 text-warning" />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium" title={f.name}>
                        {truncateMiddle(f.name, 40)}
                      </span>
                      <Input
                        type="password"
                        value={unlockDrafts[f.id] ?? ''}
                        onChange={(e) => setUnlockDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && unlockDrafts[f.id] && attemptUnlock(f.id, unlockDrafts[f.id])
                        }
                        placeholder="Password"
                        className={cn('h-9 w-44 rounded-[8px] text-[12px]', f.unlockError && 'border-destructive')}
                      />
                      <Button
                        size="sm"
                        className="h-9 rounded-[8px] border-none bg-primary font-semibold hover:bg-primary/90"
                        disabled={!unlockDrafts[f.id]}
                        onClick={() => attemptUnlock(f.id, unlockDrafts[f.id])}
                      >
                        Unlock
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0 rounded-[8px] bg-secondary/60 hover:bg-secondary"
                        onClick={() => removeFile(f.id)}
                      >
                        <X className="size-3.5" />
                      </Button>
                      {f.unlockError && (
                        <span className="w-full text-[11px] font-medium text-destructive">{f.unlockError}</span>
                      )}
                    </div>
                  ))}
                </div>

                {filteredLocked.length > FILE_PAGE_SIZE && (
                  <div className="flex items-center justify-between border-t border-border px-6 py-3">
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      {currentLockedPage * FILE_PAGE_SIZE + 1}-
                      {Math.min(filteredLocked.length, (currentLockedPage + 1) * FILE_PAGE_SIZE)} of {filteredLocked.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-[7px] bg-secondary/60 hover:bg-secondary disabled:opacity-40"
                        disabled={currentLockedPage === 0}
                        onClick={() => setLockedPage((p) => p - 1)}
                      >
                        <ChevronLeft className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-[7px] bg-secondary/60 hover:bg-secondary disabled:opacity-40"
                        disabled={currentLockedPage >= lockedPageCount - 1}
                        onClick={() => setLockedPage((p) => p + 1)}
                      >
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {lockedFiles.length === 0 && checkingFiles.length > 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <span className="text-[12.5px] text-muted-foreground">Scanning your files for a password…</span>
              </div>
            )}
          </Card>
        </div>
      )
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-4">
        <PageHeader
          title="Sign a document"
          description={`Signing ${files.length} documents together as a batch.`}
          icon={FileSignature}
          action={
            phase === 'setup' ? (
              <Button
                variant="ghost"
                className="h-9 rounded-[10px] bg-secondary px-4 text-[12.5px] font-semibold hover:bg-secondary/70"
                onClick={resetAll}
              >
                Clear all
              </Button>
            ) : undefined
          }
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[280px_1fr_360px]">
          <Card className="flex min-h-0 flex-col gap-0 overflow-hidden rounded-2xl border border-border py-0 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-4">
              <div className="flex min-w-0 flex-col">
                <span className="text-[13.5px] font-semibold">{files.length} files</span>
                {files.every((f) => f.pages > 0) && (
                  <span className="font-mono text-[10.5px] text-muted-foreground">{totalPages} pages total</span>
                )}
              </div>
              {phase === 'setup' && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <label className="flex cursor-pointer items-center gap-1 rounded-[10px] bg-secondary px-3 py-2 text-[12px] font-semibold text-primary hover:bg-secondary/70">
                    <Plus className="size-3.5" />
                    Add
                    <input
                      type="file"
                      accept="application/pdf,.pdf,.zip,application/zip,application/x-zip-compressed"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void addPickedFiles(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <label
                    title="Add a folder of PDFs"
                    className="flex size-[30px] cursor-pointer items-center justify-center rounded-[10px] bg-secondary text-primary hover:bg-secondary/70"
                  >
                    <FolderUp className="size-3.5" />
                    <span className="sr-only">Add a folder of PDFs</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      ref={(el) => {
                        el?.setAttribute('webkitdirectory', '')
                        el?.setAttribute('directory', '')
                      }}
                      onChange={(e) => {
                        void addPickedFiles(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            {files.length > FILE_PAGE_SIZE && (
              <div className="border-b border-border px-3 py-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={fileQuery}
                    onChange={(e) => {
                      setFileQuery(e.target.value)
                      setFilePage(0)
                    }}
                    placeholder="Search files…"
                    className="h-8 rounded-[8px] bg-secondary/60 pl-8 text-[12px]"
                  />
                </div>
              </div>
            )}

            <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
              {pageFiles.length === 0 && (
                <div className="px-4 py-10 text-center text-[12.5px] text-muted-foreground">
                  No files match your search.
                </div>
              )}
              {pageFiles.map((f, index) => (
                <div
                  key={f.id}
                  title={f.name}
                  className={cn(
                    'flex flex-col gap-2.5 px-4 py-3.5',
                    index > 0 && 'border-t border-border',
                    f.id === previewFile?.id && 'bg-primary/5',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPreviewFileId(f.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[8px] text-left"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent">
                        <FileText className="size-4 text-primary" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[12.5px] font-semibold">{truncateMiddle(f.name, 26)}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {f.pages > 0 ? `${f.pages} pages` : '…'}
                        </span>
                      </div>
                    </button>

                    {phase === 'setup' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 rounded-[8px] bg-secondary/60 hover:bg-secondary"
                        onClick={() => removeFile(f.id)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  {phase === 'setup' &&
                    (passwordMode === 'custom' || (passwordMode === 'uploaded-list' && csvFileName)) && (
                      <Input
                        type="password"
                        value={f.password}
                        onChange={(e) => updateFilePassword(f.id, e.target.value)}
                        placeholder="Password"
                        className={cn(
                          'h-9 rounded-[8px]',
                          submitAttempted && f.password.trim().length < 4 && 'border-destructive',
                        )}
                      />
                    )}
                </div>
              ))}
            </CardContent>

            {filteredFiles.length > FILE_PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  {currentFilePage * FILE_PAGE_SIZE + 1}-
                  {Math.min(filteredFiles.length, (currentFilePage + 1) * FILE_PAGE_SIZE)} of {filteredFiles.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-[7px] bg-secondary/60 hover:bg-secondary disabled:opacity-40"
                    disabled={currentFilePage === 0}
                    onClick={() => setFilePage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-[7px] bg-secondary/60 hover:bg-secondary disabled:opacity-40"
                    disabled={currentFilePage >= filePageCount - 1}
                    onClick={() => setFilePage((p) => Math.min(filePageCount - 1, p + 1))}
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {previewFile && (
            <DocumentPreviewCard
              file={previewFile}
              currentPage={currentPage}
              selectedPages={batchPreviewResolved}
              onPageChange={setCurrentPage}
              onNumPages={(n) => updateFilePages(previewFile.id, n)}
              canvasRef={canvasRef}
              coords={coords}
              isDragging={isDragging}
              isResizing={isResizing}
              onStampPointerDown={handleStampPointerDown}
              onStampPointerMove={handleStampPointerMove}
              onStampPointerUp={handleStampPointerUp}
              onResizeStart={handleResizeStart}
              onResizeMove={handleResizeMove}
              onResizeEnd={handleResizeEnd}
              stampWidth={stampWidth}
              stampHeight={stampHeight}
              stampScale={stampScale}
              stampRef={stampRef}
              cert={selectedCert}
              showSignerName={showSignerName}
              showSignedLabel={showSignedLabel}
              showDate={showDate}
              showTime={showTime}
              showReason={showReason}
              reasonText={reasonText}
              showLocation={showLocation}
              locationText={locationText}
              showDN={showDN}
              showCertSerial={showCertSerial}
            />
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5">
          <Card className={flushCardClass}>
            <SettingsSection title="Signing certificate" summary={selectedCert?.holderName}>
                {certificates.filter((c) => c.status !== 'expired').map((cert) => (
                  <button
                    key={cert.id}
                    disabled={phase !== 'setup'}
                    onClick={() => setCertId(cert.id)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors disabled:opacity-60',
                      certId === cert.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30',
                    )}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-success/10 text-success">
                      <ShieldCheck className="size-4" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[12.5px] font-semibold">{cert.holderName}</span>
                      <span className="truncate font-mono text-[10.5px] text-muted-foreground">{cert.organization}</span>
                    </div>
                    {certId === cert.id && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
                  </button>
                ))}
            </SettingsSection>

            <SettingsSection
              title="Pages to sign"
              summary={BATCH_PAGE_MODE_LABEL[batchPageMode]}
              contentClassName="gap-2"
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={phase !== 'setup'}
                    className="h-9 w-full justify-between rounded-[9px] px-3 text-[12.5px] font-normal"
                  >
                    {BATCH_PAGE_MODE_LABEL[batchPageMode]}
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup
                    value={batchPageMode}
                    onValueChange={(v) => setBatchPageMode(v as typeof batchPageMode)}
                  >
                    {(Object.entries(BATCH_PAGE_MODE_LABEL) as [StandardPageMode, string][]).map(([value, label]) => (
                      <DropdownMenuRadioItem key={value} value={value}>
                        {label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {batchPageMode === 'custom' && (
                <div className="flex flex-col gap-2">
                  <Input
                    value={batchPageRange}
                    onChange={(e) => setBatchPageRange(e.target.value.replace(/[^0-9,\-\s]/g, ''))}
                    placeholder="e.g. 1-3, 6, 6-12"
                    disabled={phase !== 'setup'}
                    className={cn(
                      'h-9 rounded-[9px]',
                      (submitAttempted || batchPageRange.trim()) && !batchPageRangeValid && 'border-destructive',
                    )}
                  />
                  {batchPageRange.trim() && !batchPageRangeValid && (
                    <span className="text-[11px] font-medium text-destructive">
                      Use page numbers only, comma-separated (e.g. 1-3, 6, 6-12).
                    </span>
                  )}
                  {batchPageRange.trim() && batchPageRangeValid && (
                    <span className="text-[11px] text-muted-foreground">
                      Matched by page number in each file — a file that's too short to reach every page in the list
                      is signed on all its pages instead.
                      {previewFile && previewFile.pages > 0 && (
                        <>
                          {' '}
                          E.g.{' '}
                          <span className="font-semibold text-foreground">
                            {batchPreviewResolved
                              ? formatPageSelection(batchPreviewResolved, previewFile.pages)
                              : `All ${previewFile.pages} pages`}
                          </span>{' '}
                          in "{truncateMiddle(previewFile.name, 22)}".
                        </>
                      )}
                    </span>
                  )}
                </div>
              )}
            </SettingsSection>

            <StampAppearanceCard
              showSignerName={showSignerName}
              onShowSignerNameChange={setShowSignerName}
              showSignedLabel={showSignedLabel}
              onShowSignedLabelChange={setShowSignedLabel}
              showDate={showDate}
              onShowDateChange={setShowDate}
              showTime={showTime}
              onShowTimeChange={setShowTime}
              showReason={showReason}
              onShowReasonChange={setShowReason}
              reasonText={reasonText}
              onReasonTextChange={setReasonText}
              showLocation={showLocation}
              onShowLocationChange={setShowLocation}
              locationText={locationText}
              onLocationTextChange={setLocationText}
              showDN={showDN}
              onShowDNChange={setShowDN}
              showCertSerial={showCertSerial}
              onShowCertSerialChange={setShowCertSerial}
              disabled={phase !== 'setup'}
            />

            <SettingsSection
              title="Password protection"
              defaultOpen={false}
              summary={
                passwordMode === 'none'
                  ? 'Not protected'
                  : passwordMode === 'common'
                    ? 'Same for all files'
                    : passwordMode === 'custom'
                      ? 'One per file'
                      : 'From uploaded list'
              }
              contentClassName="gap-2"
            >
                <RadioGroup value={passwordMode} onValueChange={(v) => setPasswordMode(v as PasswordMode)} className="gap-2">
                  <OptionCard
                    value="none"
                    selected={passwordMode === 'none'}
                    onSelect={() => setPasswordMode('none')}
                    disabled={phase !== 'setup'}
                    icon={X}
                    title="Don't password protect"
                  />
                  <OptionCard
                    value="common"
                    selected={passwordMode === 'common'}
                    onSelect={() => setPasswordMode('common')}
                    disabled={phase !== 'setup'}
                    icon={KeyRound}
                    title="Same password for all files"
                  >
                    <Input
                      type="password"
                      value={commonPassword}
                      onChange={(e) => setCommonPassword(e.target.value)}
                      placeholder="Set a password"
                      disabled={phase !== 'setup'}
                      className={cn(
                        'h-9 rounded-[9px]',
                        submitAttempted && commonPassword.trim().length < 4 && 'border-destructive',
                      )}
                    />
                    {submitAttempted && commonPassword.trim().length < 4 && (
                      <span className="text-[11px] font-medium text-destructive">Enter at least 4 characters.</span>
                    )}
                  </OptionCard>
                  <OptionCard
                    value="custom"
                    selected={passwordMode === 'custom'}
                    onSelect={() => setPasswordMode('custom')}
                    disabled={phase !== 'setup'}
                    icon={ListChecks}
                    title="Custom password per file"
                    description="Set one separately for each file below"
                  />
                  <OptionCard
                    value="uploaded-list"
                    selected={passwordMode === 'uploaded-list'}
                    onSelect={() => setPasswordMode('uploaded-list')}
                    disabled={phase !== 'setup'}
                    icon={Upload}
                    title="Upload a password list"
                    description="One CSV, matched by filename"
                  />
                </RadioGroup>
            </SettingsSection>

            {passwordMode === 'uploaded-list' && (
              <SettingsSection title="Password list" contentClassName="gap-2">
                <RecipientTemplateCard
                  fileNames={files.map((f) => f.name)}
                  columns={['password']}
                  helperText="Matched by filename — fill in the Password column."
                  onDownload={downloadPasswordTemplate}
                  onUpload={handlePasswordListFile}
                  uploadedFileName={csvFileName ?? undefined}
                  disabled={phase !== 'setup'}
                  status={
                    <span className={cn('text-muted-foreground', csvUnmatched.length > 0 && 'font-medium text-warning')}>
                      {csvMatchedCount} of {files.length} files matched
                      {csvUnmatched.length > 0 && ` — ${csvUnmatched.length} still need a row below`}
                    </span>
                  }
                />
                <span className="text-[11px] text-muted-foreground">
                  Any file the CSV didn't cover still needs a password entered below.
                </span>
              </SettingsSection>
            )}

            <SettingsSection
              title="Output file"
              defaultOpen={false}
              summary={
                batchPrefix.trim() || batchSuffix.trim()
                  ? `${batchPrefix}name${batchSuffix}.pdf`
                  : 'Original file names'
              }
              contentClassName="gap-3"
            >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="folder-name" className="text-[12px] font-semibold text-muted-foreground">
                    Batch / folder name
                  </Label>
                  <Input
                    id="folder-name"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    disabled={phase !== 'setup'}
                    className="h-10 rounded-[9px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="batch-prefix" className="text-[12px] font-semibold text-muted-foreground">
                      File prefix
                    </Label>
                    <Input
                      id="batch-prefix"
                      value={batchPrefix}
                      onChange={(e) => setBatchPrefix(e.target.value)}
                      placeholder="e.g. Signed_"
                      disabled={phase !== 'setup'}
                      className="h-10 rounded-[9px] font-mono text-[12.5px]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="batch-suffix" className="text-[12px] font-semibold text-muted-foreground">
                      File suffix
                    </Label>
                    <Input
                      id="batch-suffix"
                      value={batchSuffix}
                      onChange={(e) => setBatchSuffix(e.target.value)}
                      placeholder="e.g. _signed"
                      disabled={phase !== 'setup'}
                      className="h-10 rounded-[9px] font-mono text-[12.5px]"
                    />
                  </div>
                </div>
                {(batchPrefix.trim() || batchSuffix.trim()) && previewFile && (
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    e.g. {buildOutputName(batchPrefix, stripPdfExt(previewFile.name), batchSuffix)}
                  </span>
                )}
            </SettingsSection>
          </Card>

            <Button
              className="h-11 w-full shrink-0 gap-1.5 rounded-[10px] border-none bg-primary font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90"
              onClick={startBatch}
            >
              <ShieldCheck className="size-4" />
              Sign {files.length} documents
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- Single document mode: password-protected file ----------
  if (!isBatch && file && (file.protection === 'checking' || file.protection === 'locked')) {
    const checking = file.protection === 'checking'
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-4">
        <PageHeader
          title="Sign a document"
          description="This file needs to be unlocked before you can sign it."
          icon={FileSignature}
          action={
            <Button
              variant="ghost"
              className="h-9 rounded-[10px] bg-secondary px-4 text-[12.5px] font-semibold hover:bg-secondary/70"
              onClick={resetAll}
            >
              Choose a different file
            </Button>
          }
        />
        <Card className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-border shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
          <div className="flex w-full max-w-sm flex-col items-center gap-5 px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-warning/10">
              {checking ? (
                <Loader2 className="size-6 animate-spin text-warning" />
              ) : (
                <Lock className="size-6 text-warning" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold">
                {checking ? 'Checking this file…' : 'Password-protected PDF'}
              </span>
              <span className="text-[12.5px] text-muted-foreground">{truncateMiddle(file.name, 44)}</span>
            </div>

            {!checking && (
              <>
                <div className="flex w-full flex-col gap-1.5 text-left">
                  <Label htmlFor="unlock-password" className="text-[12px] font-semibold text-muted-foreground">
                    Enter the PDF's password
                  </Label>
                  <div className="relative">
                    <Input
                      id="unlock-password"
                      type={showUnlockPassword ? 'text' : 'password'}
                      value={unlockInput}
                      onChange={(e) => setUnlockInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && unlockInput && attemptUnlock(file.id, unlockInput)}
                      placeholder="Document password"
                      autoFocus
                      className={cn('h-10 rounded-[9px] pr-9', file.unlockError && 'border-destructive')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowUnlockPassword((s) => !s)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                    >
                      {showUnlockPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {file.unlockError && <span className="text-[11.5px] font-medium text-destructive">{file.unlockError}</span>}
                </div>

                <Button
                  className="h-10 w-full gap-1.5 rounded-[10px] border-none bg-primary font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90 disabled:opacity-50"
                  disabled={!unlockInput}
                  onClick={() => attemptUnlock(file.id, unlockInput)}
                >
                  <KeyRound className="size-4" />
                  Unlock file
                </Button>

                <span className="text-[11px] text-muted-foreground">
                  We only use this to open the file in your browser — it's never uploaded or stored.
                </span>
              </>
            )}
          </div>
        </Card>
      </div>
    )
  }

  // ---------- Single document mode: signing in progress ----------
  if (!isBatch && signPhase === 'processing' && file) {
    const activeIndex = Math.min(signStep, SIGN_STEPS.length - 1)
    const ActiveIcon = SIGN_STEPS[activeIndex].icon
    const progressPct = (signStep / SIGN_STEPS.length) * 100
    const stepDelay = ['', 'delay-75', 'delay-150', 'delay-200']

    return (
      <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3 sm:p-4">
        <PageHeader
          title="Sign a document"
          description={`Signing ${truncateMiddle(file.name, 40)}…`}
          icon={FileSignature}
        />

        <div
          aria-hidden
          className="pointer-events-none absolute top-10 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-16 bottom-10 size-56 rounded-full bg-brand-teal/[0.08] blur-3xl"
        />

        <Card className="relative flex flex-1 flex-col items-center justify-center gap-10 rounded-2xl border border-border py-16 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
          <div className="flex animate-in flex-col items-center gap-5 fade-in-0 slide-in-from-bottom-2 text-center duration-500">
            <div className="relative flex size-28 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
              <svg className="absolute inset-0 -rotate-90" width="112" height="112" viewBox="0 0 112 112">
                <circle cx="56" cy="56" r="50" fill="none" stroke="currentColor" strokeWidth="4" className="text-secondary" />
                <circle
                  cx="56"
                  cy="56"
                  r="50"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="text-primary"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - progressPct / 100}
                  style={{ transition: 'stroke-dashoffset 550ms cubic-bezier(0.4,0,0.2,1)' }}
                />
              </svg>
              <div
                key={activeIndex}
                className="flex size-16 animate-in items-center justify-center rounded-full bg-primary/10 zoom-in-50 fade-in-0 duration-300"
              >
                <ActiveIcon className="size-6 text-primary" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-heading text-[18px] font-bold">Signing your document</span>
              <span className="text-[12.5px] text-muted-foreground">This only takes a moment</span>
            </div>
          </div>

          <div className="flex w-full max-w-md flex-col gap-1">
            {SIGN_STEPS.map((step, i) => {
              const state = i < signStep ? 'done' : i === signStep ? 'active' : 'pending'
              const detail =
                i === 0
                  ? `SHA-256 · ${docHash.slice(0, 8)}…${docHash.slice(-8)}`
                  : i === 1
                    ? `${selectedCert?.holderName} · ${selectedCert?.issuer}`
                    : i === 2
                      ? 'RFC 3161 timestamp authority'
                      : 'Confirming the seal is valid and tamper-evident'
              return (
                <div
                  key={step.label}
                  className={cn(
                    'flex animate-in items-start gap-3 rounded-[10px] px-3 py-2.5 fade-in-0 slide-in-from-left-2 duration-500',
                    stepDelay[i],
                    state === 'active' && 'bg-primary/5',
                  )}
                >
                  <div
                    key={state}
                    className={cn(
                      'mt-0.5 flex size-6 shrink-0 animate-in items-center justify-center rounded-full zoom-in-50 duration-300',
                      state === 'done' && 'bg-success text-success-foreground',
                      state === 'active' && 'bg-primary/15 text-primary',
                      state === 'pending' && 'border border-border text-muted-foreground',
                    )}
                  >
                    {state === 'done' ? (
                      <Check className="size-3.5" />
                    ) : state === 'active' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <step.icon className="size-3.5" />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className={cn('text-[13px] font-semibold', state === 'pending' && 'text-muted-foreground')}>
                      {step.label}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">{detail}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex w-full max-w-md flex-col items-center gap-2">
            <Progress
              value={progressPct}
              className="h-2 w-full [&>div]:bg-linear-to-r [&>div]:from-primary [&>div]:to-[#2f93c0]"
            />
            <span className="text-[11px] text-muted-foreground">
              Step {Math.min(signStep + 1, SIGN_STEPS.length)} of {SIGN_STEPS.length} · please don't close this window
            </span>
          </div>
        </Card>
      </div>
    )
  }

  // ---------- Single document mode: signed successfully ----------
  if (!isBatch && signPhase === 'done' && signedResult) {
    const burstDots = [
      { x: -46, y: -58, color: 'var(--primary)', delay: 0 },
      { x: 50, y: -50, color: 'var(--brand-teal)', delay: 60 },
      { x: -62, y: 10, color: 'var(--brand-orange)', delay: 120 },
      { x: 60, y: 20, color: 'var(--brand-pink)', delay: 90 },
      { x: -20, y: -70, color: 'var(--success)', delay: 150 },
      { x: 24, y: -68, color: 'var(--primary)', delay: 40 },
    ]

    return (
      <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3 sm:p-4">
        <PageHeader
          title="Sign a document"
          description="Your document has been signed and is ready to share."
          icon={FileSignature}
        />

        <div
          aria-hidden
          className="pointer-events-none absolute top-10 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-success/[0.07] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-16 bottom-10 size-56 rounded-full bg-primary/[0.07] blur-3xl"
        />

        <Card className="relative flex flex-1 flex-col gap-0 overflow-y-auto rounded-2xl border border-border py-0 shadow-[0_1px_2px_rgba(20,32,42,.03),0_8px_20px_-16px_rgba(20,77,105,.14)] ring-0">
          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-7 px-6 py-14">
            <div className="flex animate-in flex-col items-center gap-3 fade-in-0 zoom-in-95 text-center duration-500">
              <div className="relative flex size-20 items-center justify-center">
                <div className="absolute inset-0 animate-pulse rounded-full bg-success/15 blur-lg" />
                {burstDots.map((dot, i) => (
                  <span
                    key={i}
                    aria-hidden
                    style={
                      {
                        '--burst-x': `${dot.x}px`,
                        '--burst-y': `${dot.y}px`,
                        background: dot.color,
                        animationDelay: `${dot.delay}ms`,
                      } as CSSProperties
                    }
                    className="absolute top-1/2 left-1/2 size-1.5 rounded-full opacity-0 [animation:burst-out_0.7s_ease-out_forwards]"
                  />
                ))}
                <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="relative text-success">
                  <circle cx="36" cy="36" r="32" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
                  <circle
                    cx="36"
                    cy="36"
                    r="32"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={1}
                    className="[animation:stroke-draw_0.6s_ease-out_forwards]"
                  />
                  <path
                    d="M22 37 L31 46 L50 25"
                    stroke="currentColor"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={1}
                    className="[animation:stroke-draw_0.35s_ease-out_0.55s_forwards]"
                  />
                </svg>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-heading text-[19px] font-bold">Document signed successfully</span>
                <span className="text-[13px] text-muted-foreground">{truncateMiddle(signedResult.name, 50)}</span>
              </div>
            </div>

            <div className="grid w-full animate-in grid-cols-1 gap-3 fade-in-0 slide-in-from-bottom-2 delay-150 duration-500 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 rounded-[10px] border border-border p-3.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-primary/10">
                  <UserRound className="size-4 text-primary" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground">Signed by</span>
                  <span className="text-[12.5px] font-semibold">{signedResult.signedBy}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-[10px] border border-border p-3.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-success/10">
                  <ShieldCheck className="size-4 text-success" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground">Certificate</span>
                  <span className="text-[12.5px] font-semibold">{signedResult.certificate}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-[10px] border border-border p-3.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-brand-teal/10">
                  <CalendarClock className="size-4 text-brand-teal" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground">Signed at</span>
                  <span className="font-mono text-[12.5px] font-semibold">
                    {new Date(signedResult.updatedAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-[10px] border border-border p-3.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-brand-orange/10">
                  <Fingerprint className="size-4 text-brand-orange" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground">Document hash</span>
                  <span className="font-mono text-[12.5px] font-semibold">
                    {docHash.slice(0, 8)}…{docHash.slice(-8)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex w-full animate-in items-center gap-2.5 rounded-[10px] bg-secondary/50 p-3.5 text-[12px] text-muted-foreground fade-in-0 delay-200 duration-500">
              <ListChecks className="size-4 shrink-0 text-primary" />
              {signedResult.signedPages} signed
              {signedResult.passwordProtected ? ' · password protected' : ''}
            </div>

            <div className="flex w-full animate-in flex-col items-center gap-3 fade-in-0 delay-300 duration-500">
              {/* Once it has gone out, this screen has to say so — otherwise the same button
                  invites a second send of a document the client already has. */}
              {signedResultSentTo ? (
                <div className="flex w-full items-center gap-2.5 rounded-[10px] border border-success/25 bg-success/[0.06] p-3.5">
                  <MailCheck className="size-4 shrink-0 text-success" />
                  <span className="min-w-0 flex-1 text-[12.5px] font-medium text-success">
                    Sent to <span className="font-mono">{signedResultSentTo}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSendTargets([signedResult])}
                    className="shrink-0 text-[12px] font-semibold text-success hover:underline"
                  >
                    Send again
                  </button>
                </div>
              ) : (
                <Button
                  className="h-11 w-full gap-1.5 rounded-[10px] border-none bg-linear-to-br from-primary to-[#2f93c0] font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:opacity-95"
                  onClick={() => setSendTargets([signedResult])}
                >
                  <Send className="size-4" />
                  Send to client
                </Button>
              )}
              <div className="flex w-full items-center gap-2.5">
                <Button
                  variant="ghost"
                  className="h-11 flex-1 gap-1.5 rounded-[10px] bg-secondary font-semibold hover:bg-secondary/70"
                  onClick={() => toast('Downloading signed PDF.')}
                >
                  <Download className="size-4" />
                  Download signed PDF
                </Button>
                <Button
                  variant="ghost"
                  className="h-11 flex-1 gap-1.5 rounded-[10px] bg-secondary font-semibold hover:bg-secondary/70"
                  onClick={() => navigate('/documents')}
                >
                  View in documents
                </Button>
              </div>
              <button onClick={resetAll} className="text-[12.5px] font-semibold text-primary hover:underline">
                Sign another document
              </button>
            </div>
          </div>
        </Card>
        {sendTargets && (
          <SendDialog
            documents={sendTargets}
            open={sendTargets !== null}
            onOpenChange={(open) => !open && setSendTargets(null)}
          />
        )}
      </div>
    )
  }

  // ---------- Single document mode ----------
  const pageModeLabel =
    pageMode === 'all'
      ? `All ${file.pages} pages`
      : pageMode === 'current'
        ? `Current page only (page ${currentPage})`
        : BATCH_PAGE_MODE_LABEL[pageMode]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-4">
      <PageHeader
        title="Sign a document"
        description="Place your signature, choose where it goes, and send it for record."
        icon={FileSignature}
        action={
          <div className="flex items-center gap-2">
            <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] bg-secondary px-4 text-[12.5px] font-semibold text-primary hover:bg-secondary/70">
              <Plus className="size-3.5" />
              Add another file
              <input
                type="file"
                accept="application/pdf,.pdf,.zip,application/zip,application/x-zip-compressed"
                multiple
                className="hidden"
                onChange={(e) => {
                  void addPickedFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
            <label
              title="Add a folder of PDFs"
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] bg-secondary px-4 text-[12.5px] font-semibold text-primary hover:bg-secondary/70"
            >
              <FolderUp className="size-3.5" />
              Add a folder
              <input
                type="file"
                multiple
                className="hidden"
                ref={(el) => {
                  el?.setAttribute('webkitdirectory', '')
                  el?.setAttribute('directory', '')
                }}
                onChange={(e) => {
                  void addPickedFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
            <Button
              variant="ghost"
              className="h-9 rounded-[10px] bg-secondary px-4 text-[12.5px] font-semibold hover:bg-secondary/70"
              onClick={resetAll}
            >
              Choose a different file
            </Button>
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* Preview */}
        <DocumentPreviewCard
          file={file}
          currentPage={currentPage}
          selectedPages={pageMode === 'current' ? [currentPage] : resolvePageMode(pageMode, customRange, file.pages)}
          onPageChange={setCurrentPage}
          onNumPages={(n) => updateFilePages(file.id, n)}
          canvasRef={canvasRef}
          coords={coords}
          isDragging={isDragging}
          isResizing={isResizing}
          onStampPointerDown={handleStampPointerDown}
          onStampPointerMove={handleStampPointerMove}
          onStampPointerUp={handleStampPointerUp}
          onResizeStart={handleResizeStart}
          onResizeMove={handleResizeMove}
          onResizeEnd={handleResizeEnd}
          stampWidth={stampWidth}
          stampHeight={stampHeight}
          stampScale={stampScale}
          stampRef={stampRef}
          cert={selectedCert}
          showSignerName={showSignerName}
          showSignedLabel={showSignedLabel}
          showDate={showDate}
          showTime={showTime}
          showReason={showReason}
          reasonText={reasonText}
          showLocation={showLocation}
          locationText={locationText}
          showDN={showDN}
          showCertSerial={showCertSerial}
        />

        {/* Controls */}
        <div className="flex min-h-0 flex-1 flex-col gap-5">
        <Card className={flushCardClass}>
          <SettingsSection title="Signing certificate" summary={selectedCert?.holderName}>
              {certificates.filter((c) => c.status !== 'expired').map((cert) => (
                <button
                  key={cert.id}
                  onClick={() => setCertId(cert.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors',
                    certId === cert.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30',
                  )}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-success/10 text-success">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5 truncate text-[12.5px] font-semibold">
                      {cert.holderName}
                      {cert.isDefault && <Star className="size-3 fill-primary text-primary" />}
                    </span>
                    <span className="truncate font-mono text-[10.5px] text-muted-foreground">{cert.organization}</span>
                  </div>
                  {certId === cert.id && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              ))}
          </SettingsSection>

          <SettingsSection title="Pages to sign" summary={pageModeLabel} contentClassName="gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full justify-between rounded-[9px] px-3 text-[12.5px] font-normal"
                  >
                    {pageModeLabel}
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={pageMode} onValueChange={(v) => setPageMode(v as typeof pageMode)}>
                    <DropdownMenuRadioItem value="all">All {file.pages} pages</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="current">
                      Current page only (page {currentPage})
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="first">First page only</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="last">Last page only</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="first-last">First and last page</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="custom">Custom range</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {pageMode === 'custom' && (
                <div className="flex flex-col gap-2">
                  <Input
                    value={customRange}
                    onChange={(e) => setCustomRange(e.target.value.replace(/[^0-9,\-\s]/g, ''))}
                    placeholder="e.g. 1-3, 6, 6-12"
                    className={cn('h-9 rounded-[9px]', customRange.trim() && !parsedCustomPages && 'border-destructive')}
                  />
                  {customRange.trim() &&
                    (parsedCustomPages ? (
                      <span className="text-[11px] text-muted-foreground">
                        {formatPageSelection(parsedCustomPages, file.pages)} selected
                        {parsedCustomPages.length > 1 && ` (${parsedCustomPages.join(', ')})`}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-destructive">
                        Use page numbers 1–{file.pages}, comma-separated (e.g. 1-3, 6, 6-12).
                      </span>
                    ))}
                </div>
              )}
          </SettingsSection>

          <StampAppearanceCard
            showSignerName={showSignerName}
            onShowSignerNameChange={setShowSignerName}
            showSignedLabel={showSignedLabel}
            onShowSignedLabelChange={setShowSignedLabel}
            showDate={showDate}
            onShowDateChange={setShowDate}
            showTime={showTime}
            onShowTimeChange={setShowTime}
            showReason={showReason}
            onShowReasonChange={setShowReason}
            reasonText={reasonText}
            onReasonTextChange={setReasonText}
            showLocation={showLocation}
            onShowLocationChange={setShowLocation}
            locationText={locationText}
            onLocationTextChange={setLocationText}
            showDN={showDN}
            onShowDNChange={setShowDN}
            showCertSerial={showCertSerial}
            onShowCertSerialChange={setShowCertSerial}
          />

          <SettingsSection
            title="Password protection"
            defaultOpen={false}
            summary={singleProtect ? 'Password set' : 'Not protected'}
            contentClassName="gap-3"
          >
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="protect" className="flex flex-col items-start gap-0.5">
                  <span className="text-[12.5px] font-semibold">Password protect</span>
                  <span className="text-[11px] font-normal text-muted-foreground">Recipient needs a password to open</span>
                </Label>
                <Switch id="protect" checked={singleProtect} onCheckedChange={setSingleProtect} />
              </div>
              {singleProtect && (
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={singlePassword}
                    onChange={(e) => setSinglePassword(e.target.value)}
                    placeholder="Set a password"
                    className="h-10 rounded-[9px] pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
          </SettingsSection>

          <SettingsSection
            title="Output file"
            defaultOpen={false}
            summary={
              singlePrefix.trim() || singleSuffix.trim()
                ? `${singlePrefix}name${singleSuffix}.pdf`
                : 'Original file name'
            }
            contentClassName="gap-3"
          >
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="single-prefix" className="text-[12px] font-semibold text-muted-foreground">
                    File prefix
                  </Label>
                  <Input
                    id="single-prefix"
                    value={singlePrefix}
                    onChange={(e) => setSinglePrefix(e.target.value)}
                    placeholder="e.g. Signed_"
                    className="h-10 rounded-[9px] font-mono text-[12.5px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="single-suffix" className="text-[12px] font-semibold text-muted-foreground">
                    File suffix
                  </Label>
                  <Input
                    id="single-suffix"
                    value={singleSuffix}
                    onChange={(e) => setSingleSuffix(e.target.value)}
                    placeholder="e.g. _signed"
                    className="h-10 rounded-[9px] font-mono text-[12.5px]"
                  />
                </div>
              </div>
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {buildOutputName(singlePrefix, stripPdfExt(file.name), singleSuffix)}
              </span>
          </SettingsSection>

        </Card>

          <div className="flex shrink-0 items-center gap-2.5">
            <Button
              variant="ghost"
              className="h-11 flex-1 rounded-[10px] bg-secondary font-semibold hover:bg-secondary/70"
              onClick={handleSaveDraft}
            >
              Save as draft
            </Button>
            <Button
              className="h-11 flex-1 gap-1.5 rounded-[10px] border-none bg-primary font-semibold shadow-[0_4px_10px_-4px_rgba(29,110,150,.45)] hover:bg-primary/90"
              onClick={handleSignSingle}
            >
              <PenLine className="size-4" />
              Sign document
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
