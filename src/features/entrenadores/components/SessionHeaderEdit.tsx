'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import { updateSession, deleteSession } from '@/features/entrenadores/actions/session.actions'

interface Props {
  sessionId: string
  session_date: string
  end_time: string | null
  opponent: string | null
  score_home: number | null
  score_away: number | null
  notes: string | null
  session_type: string
  teams: { id: string; name: string }[]
  currentTeamId: string | null
}

export function SessionHeaderEdit(props: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    session_date: props.session_date?.slice(0, 10) ?? '',
    end_time: props.end_time ?? '',
    team_id: props.currentTeamId ?? '',
    opponent: props.opponent ?? '',
    score_home: props.score_home ?? ('' as number | ''),
    score_away: props.score_away ?? ('' as number | ''),
    notes: props.notes ?? '',
    session_type: props.session_type as 'training' | 'match' | 'futsal' | 'friendly',
  })

  const isMatch = form.session_type !== 'training'

  function save() {
    startTransition(async () => {
      const res = await updateSession({
        sessionId: props.sessionId,
        session_date: form.session_date,
        end_time: form.end_time || null,
        team_id: form.team_id || null,
        opponent: form.opponent || null,
        score_home: form.score_home === '' ? null : Number(form.score_home),
        score_away: form.score_away === '' ? null : Number(form.score_away),
        notes: form.notes || null,
        session_type: form.session_type,
      })
      if (res.success) {
        toast.success('Sesión actualizada')
        setOpen(false)
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  function remove() {
    if (!confirm('¿Eliminar esta sesión? Se borrarán asistencias, ejercicios y eventos asociados.')) return
    startTransition(async () => {
      const res = await deleteSession(props.sessionId)
      if (res.success) {
        toast.success('Sesión eliminada')
        router.push('/entrenadores/sesiones')
      } else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <>
      <div className="flex gap-2">
        <button onClick={() => setOpen(true)} className="btn-ghost gap-1.5 flex items-center text-sm" title="Editar">
          <Pencil className="w-4 h-4" /> Editar
        </button>
        <button onClick={remove} disabled={isPending} className="btn-ghost gap-1.5 flex items-center text-sm text-red-600 hover:text-red-700" title="Eliminar">
          <Trash2 className="w-4 h-4" /> Eliminar
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="font-semibold">Editar sesión</h3>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo</label>
                  <select value={form.session_type} onChange={e => setForm(f => ({ ...f, session_type: e.target.value as never }))} className="input w-full">
                    <option value="training">Entrenamiento</option>
                    <option value="match">Partido</option>
                    <option value="friendly">Amistoso</option>
                    <option value="futsal">Futbol sala</option>
                  </select>
                </div>
                <div>
                  <label className="label">Equipo</label>
                  <select value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))} className="input w-full">
                    <option value="">—</option>
                    {props.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Fecha</label>
                  <input type="date" value={form.session_date} onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))} className="input w-full" />
                </div>
                <div>
                  <label className="label">Hora fin</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="input w-full" />
                </div>
                {isMatch && (
                  <>
                    <div className="col-span-2">
                      <label className="label">Rival</label>
                      <input value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} className="input w-full" />
                    </div>
                    <div>
                      <label className="label">Goles local</label>
                      <input type="number" value={form.score_home} onChange={e => setForm(f => ({ ...f, score_home: e.target.value === '' ? '' : Number(e.target.value) }))} className="input w-full" />
                    </div>
                    <div>
                      <label className="label">Goles visitante</label>
                      <input type="number" value={form.score_away} onChange={e => setForm(f => ({ ...f, score_away: e.target.value === '' ? '' : Number(e.target.value) }))} className="input w-full" />
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <label className="label">Notas</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="input w-full" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={isPending} className="btn-ghost">Cancelar</button>
              <button onClick={save} disabled={isPending} className="btn-primary">{isPending ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
