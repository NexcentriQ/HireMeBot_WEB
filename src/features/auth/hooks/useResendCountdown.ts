import { useCallback, useEffect, useRef, useState } from 'react'

export function useResendCountdown(initial = 60) {
  const [remaining, setRemaining] = useState(initial)
  const intervalRef = useRef<number | null>(null)

  const clear = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback(
    (seconds: number = initial) => {
      clear()
      setRemaining(seconds)
      intervalRef.current = window.setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clear()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    },
    [clear, initial]
  )

  useEffect(() => {
    start(initial)
    return clear
  }, [start, initial, clear])

  return { remaining, start, clear }
}
