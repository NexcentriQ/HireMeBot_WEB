import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/button'
import { useAuth } from '../AuthProvider'

const CONFETTI_COLORS = ['#f97316', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7']

function Confetti() {
  const pieces = Array.from({ length: 14 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: Math.random() * 100,
    delay: Math.random() * 400,
    rotation: Math.random() * 360,
    size: 6 + Math.random() * 6
  }))
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute block animate-confetti"
          style={{
            left: `${p.left}%`,
            top: `${20 + Math.random() * 20}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            transform: `rotate(${p.rotation}deg)`,
            borderRadius: p.id % 2 === 0 ? '2px' : '50%',
            animationDelay: `${p.delay}ms`
          }}
        />
      ))}
    </div>
  )
}

export function SignupSuccessPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.activated) {
      navigate('/login', { replace: true })
    }
  }, [user, navigate])

  if (!user?.activated) return null

  return (
    <AuthLayout dark>
      <div className="relative flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
        <Confetti />
        <div className="relative h-24 w-24 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl">
          <Check className="h-14 w-14" strokeWidth={3} />
        </div>
        <h1 className="mt-8 text-3xl font-extrabold">Account Created!</h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-xs">
          Your HireMeBot account has been successfully activated.
        </p>

        <Button
          size="lg"
          className="w-full mt-10"
          onClick={() => navigate('/student/dashboard', { replace: true })}
        >
          Go to Dashboard
        </Button>
      </div>
    </AuthLayout>
  )
}
