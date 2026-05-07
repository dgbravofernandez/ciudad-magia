'use client'

import { Shield, X } from 'lucide-react'
import { useTransition } from 'react'
import { stopImpersonation } from '@/features/superadmin/actions/superadmin.actions'

export function ImpersonationBanner({ clubName }: { clubName: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-yellow-400 text-black px-4 py-2 flex items-center justify-between text-sm font-medium shadow-lg">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4" aria-hidden="true" />
        <span>Modo Superadmin — Viendo como admin de: <strong>{clubName}</strong></span>
      </div>
      <button
        onClick={() => startTransition(async () => { await stopImpersonation() })}
        disabled={isPending}
        aria-label="Salir de impersonación"
        className="flex items-center gap-1.5 bg-black/10 hover:bg-black/20 rounded-md px-2 py-1 transition-colors disabled:opacity-50"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
        Salir de impersonación
      </button>
    </div>
  )
}
