'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trophy, Sparkles, Calendar } from 'lucide-react'
import { createActivity, deleteActivity, type Activity } from '../actions/activities.actions'
import { formatCurrency } from '@/lib/utils/currency'

const TYPE_LABELS: Record<string, string> = {
  campus: 'Campus',
  tecnificacion: 'Tecnificación',
  otro: 'Otro',
}

const TYPE_ICON: Record<string, typeof Trophy> = {
  campus: Trophy,
  tecnificacion: Sparkles,
  otro: Calendar,
}

interface Props {
  activities: Activity[]
  totals: Record<string, { income: number; paid: number; pending: number; expense: number }>
}

export function ActivitiesList({ activities, totals }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [type, setType] = useState<'campus' | 'tecnificacion' | 'otro'>('campus')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  function handleCreate() {
    if (!name.trim()) {
      toast.error('Nombre requerido')
      return
    }
    startTransition(async () => {
      const res = await createActivity({
        name,
        type,
        description: description || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      if (res.success) {
        toast.success('Actividad creada')
        setShowForm(false)
        setName('')
        setDescription('')
        setStartDate('')
        setEndDate('')
        if (res.id) router.push(`/contabilidad/actividades/${res.id}`)
        else router.refresh()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}"? Se borrarán todos sus cobros y gastos.`)) return
    startTransition(async () => {
      const res = await deleteActivity(id)
      if (res.success) {
        toast.success('Eliminada')
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Actividades</h1>
          <p className="text-sm text-muted-foreground">
            Campus, tecnificación y otros servicios con contabilidad separada.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nueva actividad
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold">Crear actividad</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Campus verano 2026"
                className="input w-full"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="input w-full"
              >
                <option value="campus">Campus</option>
                <option value="tecnificacion">Tecnificación</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fecha inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fecha fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Descripción (opcional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="input w-full"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
            <button onClick={handleCreate} disabled={isPending} className="btn-primary">
              Crear
            </button>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="card p-12 text-center text-muted-foreground">
          Sin actividades registradas todavía.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activities.map((a) => {
            const t = totals[a.id] ?? { income: 0, paid: 0, pending: 0, expense: 0 }
            const balance = t.paid - t.expense
            const Icon = TYPE_ICON[a.type] ?? Calendar
            return (
              <div key={a.id} className="card p-4 hover:shadow-md transition-shadow">
                <Link href={`/contabilidad/actividades/${a.id}`} className="block">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{TYPE_LABELS[a.type]}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Cobrado</p>
                      <p className="font-semibold text-emerald-700">{formatCurrency(t.paid)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Pendiente</p>
                      <p className="font-semibold text-amber-700">{formatCurrency(t.pending)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Gastos</p>
                      <p className="font-semibold text-red-700">{formatCurrency(t.expense)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Balance</p>
                      <p className={`font-semibold ${balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatCurrency(balance)}
                      </p>
                    </div>
                  </div>
                </Link>
                <div className="mt-3 pt-3 border-t flex justify-end">
                  <button
                    onClick={() => handleDelete(a.id, a.name)}
                    disabled={isPending}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
