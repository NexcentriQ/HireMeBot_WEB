import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  FileText,
  HelpCircle,
  LogOut,
  Mail,
  Palette,
  Pencil,
  Phone,
  Shield,
  User2
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { ComingSoonDialog } from '@/components/common/ComingSoonDialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme, type Theme } from '@/app/ThemeProvider'
import { cn } from '@/lib/utils'

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

const THEME_LABEL: Record<Theme, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark'
}

export function StudentProfilePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [editOpen, setEditOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)

  if (!user) return null

  function cycleTheme() {
    const order: Theme[] = ['system', 'light', 'dark']
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
  }

  async function handleSignOut() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="My Profile" />
      <div className="mx-auto w-full max-w-md px-4 py-4 flex flex-col gap-4">
        {/* Header card */}
        <section className="flex items-center gap-3">
          <div
            className="h-14 w-14 rounded-full bg-primary/15 text-primary inline-flex items-center justify-center text-base font-bold"
            aria-hidden="true"
          >
            {initials(user.firstName, user.lastName)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold truncate">
              {user.firstName} {user.lastName}
            </h2>
            <p className="text-xs text-muted-foreground">Student</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 bg-card"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </section>

        {/* Personal Information */}
        <section
          aria-labelledby="personal-info"
          className="rounded-2xl border border-border bg-card p-4"
        >
          <h3 id="personal-info" className="text-sm font-bold mb-3">
            Personal Information
          </h3>
          <ul className="space-y-3 text-sm">
            <InfoRow icon={User2} label="First Name" value={user.firstName} />
            <InfoRow icon={User2} label="Last Name" value={user.lastName} />
            <InfoRow icon={Mail} label="Email" value={user.email} />
            <InfoRow
              icon={Phone}
              label="Phone Number"
              value={user.phoneE164}
              trailing={
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Verified
                </span>
              }
            />
          </ul>
        </section>

        {/* Account & Settings */}
        <section
          aria-labelledby="account-settings"
          className="rounded-2xl border border-border bg-card overflow-hidden"
        >
          <h3 id="account-settings" className="text-sm font-bold px-4 pt-4 pb-2">
            Account & Settings
          </h3>
          <ul className="divide-y divide-border">
            <SettingLink icon={Bell} label="Notifications" to="/student/notifications" />
            <SettingButton
              icon={Palette}
              label="Theme"
              trailing={<span className="text-sm text-muted-foreground">{THEME_LABEL[theme]}</span>}
              onClick={cycleTheme}
            />
            <SettingButton icon={HelpCircle} label="Help & Support" onClick={() => setHelpOpen(true)} />
            <SettingButton icon={Shield} label="Privacy Policy" onClick={() => setPrivacyOpen(true)} />
            <SettingButton icon={FileText} label="Terms of Service" onClick={() => setTermsOpen(true)} />
            <SettingButton
              icon={LogOut}
              label="Sign Out"
              onClick={handleSignOut}
              danger
            />
          </ul>
        </section>
      </div>

      <ComingSoonDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Profile Editing Coming Soon"
        description="You’ll be able to update your profile information in a future HireMeBot release."
      />
      <ComingSoonDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        title="Help & Support Coming Soon"
        description="Dedicated help resources will be available in a future HireMeBot release."
      />
      <ComingSoonDialog
        open={privacyOpen}
        onOpenChange={setPrivacyOpen}
        title="Privacy Policy"
        description="The HireMeBot Privacy Policy is being finalized. A published version will be linked here soon."
      />
      <ComingSoonDialog
        open={termsOpen}
        onOpenChange={setTermsOpen}
        title="Terms of Service"
        description="The HireMeBot Terms of Service are being finalized. A published version will be linked here soon."
      />
    </div>
  )
}

type InfoRowProps = {
  icon: typeof User2
  label: string
  value: string
  trailing?: React.ReactNode
}

function InfoRow({ icon: Icon, label, value, trailing }: InfoRowProps) {
  return (
    <li className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
      {trailing}
    </li>
  )
}

type SettingRowBaseProps = {
  icon: typeof User2
  label: string
  trailing?: React.ReactNode
  danger?: boolean
}

function SettingRowShell({ icon: Icon, label, trailing, danger }: SettingRowBaseProps) {
  return (
    <>
      <Icon
        className={cn('h-4 w-4 shrink-0', danger ? 'text-destructive' : 'text-muted-foreground')}
        aria-hidden="true"
      />
      <span className={cn('flex-1 text-left text-sm font-medium', danger && 'text-destructive')}>
        {label}
      </span>
      {trailing}
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </>
  )
}

function SettingLink({ to, ...rest }: SettingRowBaseProps & { to: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors"
      >
        <SettingRowShell {...rest} />
      </Link>
    </li>
  )
}

function SettingButton({
  onClick,
  ...rest
}: SettingRowBaseProps & { onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors text-left"
      >
        <SettingRowShell {...rest} />
      </button>
    </li>
  )
}
