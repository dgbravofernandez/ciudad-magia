'use client'

import { Bell } from 'lucide-react'
import { useCurrentUser } from '@/context/UserContext'
import { ROLE_LABELS } from '@/types/roles'

interface TopbarProps {
  title?: string
}

export function Topbar({ title }: TopbarProps) {
  const { member, roles } = useCurrentUser()

  const roleLabel = roles
    .map((r) => ROLE_LABELS[r])
    .filter(Boolean)
    .join(' · ')

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        {title && (
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          className="relative text-muted-foreground hover:text-foreground transition-colors"
          title="Notificaciones"
        >
          <Bell className="w-5 h-5" />
          {/* Notification dot - show when there are unread */}
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
            {member.full_name.charAt(0)}
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-foreground leading-tight">{member.full_name}</p>
            <p className="text-xs text-muted-foreground leading-tight">{roleLabel}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
