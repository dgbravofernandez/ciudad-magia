'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X, Plus, Trash2, Calendar, Loader2 } from 'lucide-react'
import {
  getTeamSchedule,
  addScheduleSlot,
  deleteScheduleSlot,
  generateWeekSessions,
} from '../actions/schedule.actions'

interface Slot {
  id: string
  weekday: number
  start_time: string
  end_time: string | null
  location: string | null
  session_type: string
}

const WEEKDAYS = [
  { v: 1, label: 'Lunes' },
  { v: 2, label: 'Martes' },
  { v: 3, label: 'Miércoles' },
  { v: 4, label: 'Jueves' },
  { v: 5, label: 'Viernes' },
  { v: 6, label: 'Sábado' },
  { v: 0, label: 'Domingo' },
]

function fmtTime(t: string | null): string {
  if (!t) return ''
  return t.slice(0, 5) // 'HH:MM:SS' -> 'HH:MM'
}

export function TeamScheduleModal({
  teamId,
  teamName,
  onClose,
}: {
  teamId: string
  teamName: string
  onClose: () => void
}) {
  const router = useRouter()
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    weekday: 1,
    start_time: '18:00',
    end_time: '19:30',
    location: '',
  })

  useEffect(() => {
    ;(async () => {
      const res = await getTeamSchedule(teamId)
      if (res.success) setSlots(res.slots as Slot[])
      setLoading(false)
    })()
  }, [teamId])

  function reload() {
    startTransition(async () => {
      const res = await getTeamSchedule(teamId)
      if (res.success) setSlots(res.slots as Slot[])
    })
  }

  function handleAdd() {
    if (!form.start_time) {
      toast.error('Hora de inicio requerida')
      return
    }
    startTransition(async () => {
      const res = await addScheduleSlot({
        team_id: teamId,
        weekday: form.weekday,
        start_time: form.start_time,
        end_time: form.end_time || null,
        location: form.location || null,
        session_type: 'training',
      })
      if (res.success) {
        toast.success('Horario añadido')
        reload()
      } else toast.error(res.error ?? 'Error')
    })
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar este horario? Las sesiones ya generadas no se borran.')) return
    startTransition(async () => {
      const res = await deleteScheduleSlot(id)
      if (res.success) {
        toast.success('Eliminado')
        reload()
      } else toast.error(res.error ?? 'Error')
    })
  }

  function handleGenerateNow() {
    if (!confirm('¿Generar ahora las sesiones de la próxima semana para este equipo? Si ya existen, no se duplican.')) return
    startTransition(async () => {
      const res = await generateWeekSessions()
      if (res.success) {
        toast.success(`${res.created} sesiones creadas, ${res.skipped} ya existían`)
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Horario habitual — {teamName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define cuándo entrena el equipo cada semana. Las sesiones se crearán automáticamente cada domingo.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : (
            <>
              {/* Current slots */}
              <div className="space-y-2">
                <label className="label">Horarios configurados</label>
                {slots.length === 0 ? (
                  <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 text-center">
                    Sin horarios configurados aún.
                  </div>
                ) : (
                  <div className="border rounded-lg divide-y">
                    {slots.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3">
                        <div className="flex-1 flex items-center gap-3 text-sm">
                          <span className="font-medium w-20">
                            {WEEKDAYS.find((w) => w.v === s.weekday)?.label ?? '?'}
                          </span>
                          <span className="text-muted-foreground">
                            {fmtTime(s.start_time)}
                            {s.end_time ? ` — ${fmtTime(s.end_time)}` : ''}
                          </span>
                          {s.location && (
                            <span className="text-muted-foreground text-xs">· {s.location}</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={isPending}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add form */}
              <div className="border-t pt-4 space-y-3">
                <label className="label">Añadir horario</label>
                <div className="grid grid-cols-4 gap-2">
                  <select
                    value={form.weekday}
                    onChange={(e) => setForm((f) => ({ ...f, weekday: Number(e.target.value) }))}
                    className="input"
                  >
                    {WEEKDAYS.map((w) => (
                      <option key={w.v} value={w.v}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="input"
                    placeholder="Inicio"
                  />
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                    className="input"
                    placeholder="Fin"
                  />
                  <input
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className="input"
                    placeholder="Campo / sala"
                  />
                </div>
                <button
                  onClick={handleAdd}
                  disabled={isPending}
                  className="btn-primary text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Añadir
                </button>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t flex items-center justify-between bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Las sesiones se autogeneran cada domingo a las 23:00.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleGenerateNow}
              disabled={isPending || slots.length === 0}
              className="btn-secondary text-sm"
              title="Generar manualmente las sesiones de la semana que viene"
            >
              Generar esta semana ahora
            </button>
            <button onClick={onClose} className="btn-ghost text-sm">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
