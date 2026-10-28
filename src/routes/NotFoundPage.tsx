import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <AuthLayout>
      <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
        <div className="text-6xl font-extrabold text-primary">404</div>
        <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          The page you’re looking for doesn’t exist or has moved.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/login">Go back home</Link>
        </Button>
      </div>
    </AuthLayout>
  )
}
