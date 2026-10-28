import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastKind = 'info' | 'success' | 'error'
type Toast = { id: number; message: string; kind: ToastKind }
type ToastContextValue = {
  show: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { id, message, kind }])
      window.setTimeout(() => dismiss(id), 4000)
    },
    [dismiss]
  )

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed top-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 safe-top"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg bg-card text-card-foreground max-w-sm w-full animate-fade-in',
              t.kind === 'success' && 'border-emerald-500/40',
              t.kind === 'error' && 'border-destructive/60',
              t.kind === 'info' && 'border-border'
            )}
          >
            <span className="mt-0.5">
              {t.kind === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              {t.kind === 'error' && <AlertTriangle className="h-5 w-5 text-destructive" />}
              {t.kind === 'info' && <Info className="h-5 w-5 text-primary" />}
            </span>
            <p className="text-sm leading-5 flex-1">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
