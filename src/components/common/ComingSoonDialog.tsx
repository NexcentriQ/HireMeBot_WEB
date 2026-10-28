import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Sparkles } from 'lucide-react'

type ComingSoonDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  closeLabel?: string
}

export function ComingSoonDialog({
  open,
  onOpenChange,
  title = 'Coming in a Future Release',
  description = "This feature isn't available yet. We're working on bringing it to HireMeBot in an upcoming release.",
  closeLabel = 'Got it'
}: ComingSoonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
          <Sparkles className="h-7 w-7" aria-hidden="true" />
        </div>
        <DialogHeader className="mt-4 text-center sm:text-center">
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 sm:justify-center">
          <Button type="button" size="lg" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            {closeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
