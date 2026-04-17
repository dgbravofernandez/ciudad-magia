'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { deleteSession } from '@/features/entrenadores/actions/session.actions'

export function DeleteSessionButton({
  sessionId,
  label,
  className,
}: {
  sessionId: string
  label: string
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleClick(e: React.MouseEvent) {
    // The surrounding card is a <Link>, so swallow the click before it navigates.
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`¿Borrar ${label}? Esta acción no se puede deshacer.`)) return
    startTransition(async () => {
      const r = await deleteSession(sessionId)
      if (r.success) {
        toast.success('Borrado')
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error al borrar')
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={
        className ??
        'p-2 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors shrink-0 disabled:opacity-40'
      }
      title="Borrar"
      aria-label="Borrar"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
