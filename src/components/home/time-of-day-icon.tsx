import { type TimeOfDay } from '@/lib/format'
import { cn } from '@/lib/utils'

const glowClassName: Record<TimeOfDay, string> = {
  morning: 'bg-[#fbbf24]/50',
  afternoon: 'bg-brand-teal/50',
  evening: 'bg-brand-orange/50',
}

function SunriseGlyph() {
  return (
    <svg viewBox="0 0 40 40" className="relative z-10 size-6">
      <defs>
        <linearGradient id="g-rise" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="100%" stopColor="#ff9d47" />
        </linearGradient>
      </defs>
      <g stroke="#ffd27a" strokeLinecap="round">
        <line
          className="[animation:ray-pulse_2.2s_ease-in-out_infinite]"
          x1="20"
          y1="3"
          x2="20"
          y2="8"
          strokeWidth="2.2"
        />
        <line
          className="[animation:ray-pulse_2.2s_ease-in-out_0.35s_infinite]"
          x1="7.5"
          y1="9.5"
          x2="10.8"
          y2="12.8"
          strokeWidth="2.2"
        />
        <line
          className="[animation:ray-pulse_2.2s_ease-in-out_0.7s_infinite]"
          x1="32.5"
          y1="9.5"
          x2="29.2"
          y2="12.8"
          strokeWidth="2.2"
        />
      </g>
      <path d="M6 27 A14 14 0 0 1 34 27 Z" fill="url(#g-rise)" />
      <line x1="3" y1="27" x2="37" y2="27" stroke="white" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SunGlyph() {
  return (
    <svg viewBox="0 0 40 40" className="relative z-10 size-6">
      <defs>
        <radialGradient id="g-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6d8" />
          <stop offset="100%" stopColor="#ffce54" />
        </radialGradient>
      </defs>
      <g className="origin-center animate-spin [animation-duration:18s]">
        <g stroke="#ffe082" strokeWidth="2.4" strokeLinecap="round">
          <line x1="20" y1="2" x2="20" y2="7" />
          <line x1="20" y1="33" x2="20" y2="38" />
          <line x1="2" y1="20" x2="7" y2="20" />
          <line x1="33" y1="20" x2="38" y2="20" />
          <line x1="7.6" y1="7.6" x2="11" y2="11" />
          <line x1="29" y1="29" x2="32.4" y2="32.4" />
          <line x1="7.6" y1="32.4" x2="11" y2="29" />
          <line x1="29" y1="11" x2="32.4" y2="7.6" />
        </g>
      </g>
      <circle cx="20" cy="20" r="9" fill="url(#g-sun)" />
    </svg>
  )
}

function SunsetGlyph() {
  return (
    <svg viewBox="0 0 40 40" className="relative z-10 size-6">
      <defs>
        <linearGradient id="g-set" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffc38a" />
          <stop offset="100%" stopColor="#f1685a" />
        </linearGradient>
      </defs>
      <g stroke="#ffb488" strokeLinecap="round">
        <line
          className="[animation:ray-pulse_2.2s_ease-in-out_infinite]"
          x1="10"
          y1="33"
          x2="8"
          y2="35.5"
          strokeWidth="2"
        />
        <line
          className="[animation:ray-pulse_2.2s_ease-in-out_0.35s_infinite]"
          x1="20"
          y1="35"
          x2="20"
          y2="38"
          strokeWidth="2"
        />
        <line
          className="[animation:ray-pulse_2.2s_ease-in-out_0.7s_infinite]"
          x1="30"
          y1="33"
          x2="32"
          y2="35.5"
          strokeWidth="2"
        />
      </g>
      <path d="M6 27 A14 14 0 0 1 34 27 Z" fill="url(#g-set)" />
      <line x1="3" y1="27" x2="37" y2="27" stroke="white" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const glyphByTime: Record<TimeOfDay, () => React.JSX.Element> = {
  morning: SunriseGlyph,
  afternoon: SunGlyph,
  evening: SunsetGlyph,
}

// The current time of day is passed in rather than read here, so the icon and the greeting
// beside it always come from the same reading of the clock.
export function TimeOfDayIcon({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const Glyph = glyphByTime[timeOfDay]

  return (
    <div className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10">
      <div
        className={cn(
          'absolute -inset-1.5 rounded-full blur-[10px] [animation:pulse-glow_3.2s_ease-in-out_infinite]',
          glowClassName[timeOfDay],
        )}
      />
      <Glyph />
    </div>
  )
}
