'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, Plus, Pencil, Trash2, Eye, Star } from 'lucide-react'
import { formatDate } from '@/lib/utils/currency'
import {
  createScoutingReport,
  updateScoutingReport,
  deleteScoutingReport,
} from '@/features/scouting/actions/scouting.actions'

type ScoutingStatus = 'new' | 'watching' | 'contacted' | 'signed' | 'dropped'

interface Report {
  id: string
  rival_team: string
  player_name: string | null
  dorsal: string | null
  position: string | null
  approx_age: number | null
  comment: string | null
  interest_level: number | null
  status: ScoutingStatus | null
  created_at: string
  reporter?: { full_name: string } | null
}

const STATUS_LABELS: Record<ScoutingStatus, string> = {
  new: 'Nuevo',
  watching: 'Siguiendo',
  contacted: 'Contactado',
  signed: 'Fichado',
  dropped: 'Descartado',
}

const STATUS_COLORS: Record<ScoutingStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  watching: 'bg-yellow-100 text-yellow-700',
  contacted: 'bg-purple-100 text-purple-700',
  signed: 'bg-green-100 text-green-700',
  dropped: 'bg-gray-100 text-gray-600',
}

const POSITIONS = ['Portero', 'Defensa', 'Lateral', 'Mediocentro', 'Banda', 'Delantero']

export function ScoutingListPage({ reports }: { reports: Report[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ScoutingStatus>('all')
  const [posFilter, setPosFilter] = useState<string>('all')
  const [minInterest, setMinInterest] = useState(0)

  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Report | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return reports.filter((r) => {
      if (statusFilter !== 'all' && (r.status ?? 'new') !== statusFilter) return false
      if (posFilter !== 'all' && r.position !== posFilter) return false
      if ((r.interest_level ?? 0) < minInterest) return false
      if (q) {
        const hay = `${r.rival_team} ${r.player_name ?? ''} ${r.dorsal ?? ''} ${r.comment ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [reports, search, statusFilter, posFilter, minInterest])

  function setStatus(r: Report, status: ScoutingStatus) {
    startTransition(async () => {
      const res = await updateScoutingReport({ id: r.id, status })
      if (res.success) {
        toast.success('Estado actualizado')
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar este informe de scouting?')) return
    startTransition(async () => {
      const res = await deleteScoutingReport(id)
      if (res.success) {
        toast.success('Informe eliminado')
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <div className="space-y-6">
      {/* Header + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold">Scouting</h2>
          <p className="text-sm text-muted-foreground">
            Informes de jugadores observados en partidos ({reports.length} en total)
          </p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary gap-2 flex items-center text-sm">
          <Plus className="w-4 h-4" />
          Nuevo informe
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar jugador, equipo…"
              className="input w-full pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | ScoutingStatus)}
            className="input w-full"
          >
            <option value="all">Todos los estados</option>
            {(Object.keys(STATUS_LABELS) as ScoutingStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="input w-full">
            <option value="all">Cualquier posición</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={minInterest}
            onChange={(e) => setMinInterest(Number(e.target.value))}
            className="input w-full"
          >
            <option value={0}>Cualquier interés</option>
            <option value={3}>≥ 3 estrellas</option>
            <option value={4}>≥ 4 estrellas</option>
            <option value={5}>5 estrellas</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jugador</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo rival</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pos.</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Interés</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reporte</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const status = (r.status ?? 'new') as ScoutingStatus
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {r.player_name || <span className="text-muted-foreground italic">Sin nombre</span>}
                        {r.dorsal && <span className="ml-2 text-xs text-muted-foreground">#{r.dorsal}</span>}
                      </div>
                      {r.approx_age && <div className="text-xs text-muted-foreground">{r.approx_age} años</div>}
                    </td>
                    <td className="px-4 py-3">{r.rival_team}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.position ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`w-3.5 h-3.5 ${
                              n <= (r.interest_level ?? 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={status}
                        disabled={isPending}
                        onChange={(e) => setStatus(r, e.target.value as ScoutingStatus)}
                        className={`text-xs px-2 py-1 rounded-md border-0 cursor-pointer ${STATUS_COLORS[status]}`}
                      >
                        {(Object.keys(STATUS_LABELS) as ScoutingStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" title={r.comment ?? ''}>
                      {r.comment ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setEditing(r)}
                          disabled={isPending}
                          className="p-1 text-gray-400 hover:text-gray-700"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={isPending}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Eye className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay informes que coincidan con los filtros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(showNew || editing) && (
        <ScoutingModal
          report={editing}
          onClose={() => { setShowNew(false); setEditing(null) }}
          onSaved={() => { setShowNew(false); setEditing(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function ScoutingModal({
  report,
  onClose,
  onSaved,
}: {
  report: Report | null
  onClose: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    rival_team: report?.rival_team ?? '',
    player_name: report?.player_name ?? '',
    dorsal: report?.dorsal ?? '',
    position: report?.position ?? '',
    approx_age: report?.approx_age ?? ('' as number | ''),
    interest_level: report?.interest_level ?? 3,
    status: (report?.status ?? 'new') as ScoutingStatus,
    comment: report?.comment ?? '',
  })

  function save() {
    startTransition(async () => {
      const base = {
        rival_team: form.rival_team.trim(),
        player_name: form.player_name.trim() || null,
        dorsal: form.dorsal.trim() || null,
        position: form.position.trim() || null,
        approx_age: form.approx_age === '' ? null : Number(form.approx_age),
        interest_level: form.interest_level,
        comment: form.comment.trim() || null,
      }
      const res = report
        ? await updateScoutingReport({ id: report.id, ...base, status: form.status })
        : await createScoutingReport({
            rival_team: base.rival_team,
            player_name: base.player_name ?? undefined,
            dorsal: base.dorsal ?? undefined,
            position: base.position ?? undefined,
            approx_age: base.approx_age ?? undefined,
            comment: base.comment ?? undefined,
            interest_level: base.interest_level,
          })
      if (res.success) {
        toast.success(report ? 'Informe actualizado' : 'Informe creado')
        onSaved()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{report ? 'Editar informe' : 'Nuevo informe de scouting'}</h3>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Equipo rival *</label>
              <input
                value={form.rival_team}
                onChange={(e) => setForm((f) => ({ ...f, rival_team: e.target.value }))}
                className="input w-full"
                placeholder="Nombre del club"
              />
            </div>
            <div className="col-span-2">
              <label className="label">Nombre del jugador</label>
              <input
                value={form.player_name}
                onChange={(e) => setForm((f) => ({ ...f, player_name: e.target.value }))}
                className="input w-full"
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="label">Dorsal</label>
              <input
                value={form.dorsal}
                onChange={(e) => setForm((f) => ({ ...f, dorsal: e.target.value }))}
                className="input w-full"
              />
            </div>
            <div>
              <label className="label">Edad aprox.</label>
              <input
                type="number"
                value={form.approx_age}
                onChange={(e) => setForm((f) => ({ ...f, approx_age: e.target.value === '' ? '' : Number(e.target.value) }))}
                className="input w-full"
              />
            </div>
            <div>
              <label className="label">Posición</label>
              <select
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                className="input w-full"
              >
                <option value="">—</option>
                {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Interés</label>
              <select
                value={form.interest_level}
                onChange={(e) => setForm((f) => ({ ...f, interest_level: Number(e.target.value) }))}
                className="input w-full"
              >
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} estrella{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            {report && (
              <div className="col-span-2">
                <label className="label">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ScoutingStatus }))}
                  className="input w-full"
                >
                  {(Object.keys(STATUS_LABELS) as ScoutingStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="label">Comentario</label>
              <textarea
                value={form.comment}
                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                rows={3}
                className="input w-full"
                placeholder="Lo que viste: físico, técnica, actitud…"
              />
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={isPending} className="btn-ghost">Cancelar</button>
          <button onClick={save} disabled={isPending || !form.rival_team.trim()} className="btn-primary">
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
