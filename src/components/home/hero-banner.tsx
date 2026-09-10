import { TimeOfDayIcon } from '@/components/home/time-of-day-icon'
import { getGreeting } from '@/lib/format'

export function HeroBanner() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#0f3a52] via-primary to-[#2f93c0] px-6 py-5 shadow-[0_16px_36px_-20px_rgba(15,58,82,.55)] sm:px-8 sm:py-6">
      <div className="pointer-events-none absolute -top-14 -right-8 size-48 rounded-full bg-brand-teal/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-1/4 size-40 rounded-full bg-brand-pink/15 blur-3xl" />

      <div className="relative flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <TimeOfDayIcon />
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 font-heading text-[20px] font-bold tracking-tight text-white sm:text-[22px]">
              {getGreeting()}, Kartik
              <span aria-hidden>👋</span>
            </h1>
            <p className="max-w-sm text-[13px] text-white/75">
              Sign, send and verify your firm's documents — all in a few clicks.
            </p>
          </div>
        </div>

        {/* A signed-PDF illustration — document with text lines, a signature squiggle and a
            checkmark seal — fully contained (no rotation/negative offsets) so it never clips
            or reads as broken at any viewport width. */}
        <svg
          aria-hidden
          viewBox="0 0 160 160"
          className="hidden h-20 w-20 shrink-0 sm:block md:h-24 md:w-24"
        >
          <rect x="28" y="8" width="94" height="126" rx="12" fill="white" fillOpacity="0.14" />
          <rect x="44" y="30" width="62" height="6" rx="3" fill="white" fillOpacity="0.4" />
          <rect x="44" y="46" width="62" height="6" rx="3" fill="white" fillOpacity="0.4" />
          <rect x="44" y="62" width="40" height="6" rx="3" fill="white" fillOpacity="0.4" />
          <path
            d="M44 98 C 54 82, 64 114, 74 94 S 94 78, 106 98"
            stroke="white"
            strokeOpacity="0.6"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="114" cy="120" r="24" fill="#22c55e" />
          <path
            d="M104 120 l8 8 l16 -16"
            stroke="white"
            strokeWidth="4.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  )
}
