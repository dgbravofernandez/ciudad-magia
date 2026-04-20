'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus, Minus, X, Trash2 } from 'lucide-react'
import { updateSanction, deleteSanction } from '../actions/sanction.actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any

export function SanctionsTable({ rows, canDelete }: { rows: Row[]; canDelete: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  const bump = (id: string, delta: number, current: number) => {
    const next = Math.max(0, current + delta)
    setBusyId(id)
    startTransition(async () => {
      const res = await updateSanction(id, { matches_served: next })
      setBusyId(null)
      if (res.success) {
        toast.success('Actualizado')
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  const cancel = (id: string) => {
    if (!confirm('¿Cancelar esta sanción? Quedará marcada como no activa.')) return
    setBusyId(id)
    startTransition(async () => {
      const res = await updateSanction(id, { active: false })
      setBusyId(null)
      if (res.success) {
        toast.success('Sanción cancelada')
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  const remove = (id: string) => {
    if (!confirm('¿Eliminar sanción permanentemente? No se puede deshacer.')) return
    setBusyId(id)
    startTransition(async () => {
      const res = await deleteSanction(id)
      setBusyId(null)
      if (res.success) {
        toast.success('Eliminada')
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jugador</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Competición</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Total</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Cumplidos</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Restantes</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Inicio</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const served = s.matches_served ?? 0
              const total = s.matches_banned ?? 1
              const remaining = total - served
              return (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/jugadores/${s.players?.id}`} className="font-medium hover:underline hover:text-primary">
                      {s.players?.first_name} {s.players?.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.players?.teams?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{s.competition ?? 'Liga'}</td>
                  <td className="px-4 py-3 text-center font-medium">{total}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{served}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="badge badge-destructive font-semibold">{remaining}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.start_date ? new Date(s.start_date).toLocaleDateString('es-ES') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => bump(s.id, -1, served)}
                        disabled={isPending || served <= 0 || busyId === s.id}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors disabled:opacity-30"
                        title="Restar partido cumplido"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => bump(s.id, 1, served)}
                        disabled={isPending || busyId === s.id}
                        className="p-1.5 rounded hover:bg-muted text-primary transition-colors disabled:opacity-30"
                        title="Sumar partido cumplido"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => cancel(s.id)}
                        disabled={isPending || busyId === s.id}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors disabled:opacity-30"
                        title="Cancelar sanción"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => remove(s.id)}
                          disabled={isPending || busyId === s.id}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                          title="Eliminar permanentemente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
