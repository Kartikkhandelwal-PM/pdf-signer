import { useEffect, useState } from 'react'

import { getTimeOfDay, nextTimeOfDayBoundary, type TimeOfDay } from '@/lib/format'

// Which part of the day it is *right now*, re-rendering the caller the moment that changes.
//
// Without this the greeting is only ever computed while the page draws, so a dashboard left
// open across noon keeps saying "Good morning" until something else happens to re-render it.
export function useTimeOfDay(): TimeOfDay {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => getTimeOfDay())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    // Aim at the next boundary rather than polling on a fixed interval: the banner flips
    // exactly on the hour, and one timer covers the whole wait.
    function arm() {
      const now = new Date()
      const wait = Math.max(1_000, nextTimeOfDayBoundary(now).getTime() - now.getTime())
      timer = setTimeout(() => {
        setTimeOfDay(getTimeOfDay())
        arm()
      }, wait)
    }

    // A sleeping machine fires the timer late (or not at all), so re-read the real clock
    // whenever the tab comes back — a dashboard left open overnight would otherwise wake up
    // still showing yesterday evening's greeting.
    function resync() {
      if (document.visibilityState !== 'visible') return
      clearTimeout(timer)
      setTimeOfDay(getTimeOfDay())
      arm()
    }

    arm()
    document.addEventListener('visibilitychange', resync)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', resync)
    }
  }, [])

  return timeOfDay
}
