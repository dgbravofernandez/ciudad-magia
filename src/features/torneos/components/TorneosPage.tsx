'use client'
import { Trophy, Plus, Calendar, MapPin, Users, ChevronRight, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import Link from 'next/link'
import { createTournament, deleteTournament } from '@/features/torneos/actions/tournament.actions'

interface Tournament {
  id: string
  name: string
  category: string | null
  format: 'league' | 'cup' | 'mixed'
  start_date: string | null
  end_date: string | null
  location: string | null
  status: 'upcoming' | 'in_progress' | 'finished'
  kind?: 'local' | 'external'
}

interface Props { torneos: Tournament[]; clubId: string }

const STATUS_LABELS = { upcoming: 'Próximo', in_progress: 'En curso', finished: 'Finalizado' }
const STATUS_COLORS = {
  upcoming: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-green-50 text-green-700',
  finished: 'bg-gray-100 text-gray-600',
}
const FORMAT_LABELS = { league: 'Liga', cup: 'Copa', mixed: 'Liga + Eliminatorias' }

export function TorneosPage({ torneos, clubId: _clubId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showNew, setShowNew] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [form, setForm] = useState<{ name: string; category: string; format: 'league' | 'cup' | 'mixed'; kind: 'local' | 'external'; start_date: string; end_date: string; location: string }>({ name: '', category: '', format: 'league', kind: 'local', start_date: '', end_date: '', location: '' })

  function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar el torneo "${name}"? Esta acción no se puede deshacer.`)) return
    startTransition(async () => {
      const r = await deleteTournament(id)
      if (r.success) {
        toast.success('Torneo eliminado')
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error al eliminar torneo')
      }
    })
  }

  function handleCreate() {
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return }
    startTransition(async () => {
      const r = await createTournament({
        name: form.name,
        category: form.category || null,
        format: form.format,
        kind: form.kind,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        location: form.location || null,
      })
      if (r.success) {
        toast.success('Torneo creado')
        setShowNew(false)
        setForm({ name: '', category: '', format: 'league', kind: 'local', start_date: '', end_date: '', location: '' })
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error al crear torneo')
      }
    })
  }

  const filtered = filterStatus === 'all' ? torneos : torneos.filter(t => t.status === filterStatus)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Torneos</h1>
          <p className="text-sm text-gray-500">{torneos.length} competiciones</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
          <Plus className="w-4 h-4" /> Nuevo torneo
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['all', 'upcoming', 'in_progress', 'finished'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterStatus === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'}`}>
            {s === 'all' ? 'Todos' : STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Trophy className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No hay torneos</p>
          <p className="text-sm text-gray-400 mt-1">Crea el primer torneo para empezar</p>
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map(t => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-200 hover:border-blue-200 hover:shadow-sm transition-all">
            <Link href={`/torneos/${t.id}`} className="p-5 block">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{t.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                    {t.kind === 'external' && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-700">✈️ Externo</span>
                    )}
                    {t.kind === 'local' && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">🏆 Local</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                    {t.category && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{t.category}</span>}
                    <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />{FORMAT_LABELS[t.format]}</span>
                    {t.start_date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{format(new Date(t.start_date), 'd MMM yyyy', { locale: es })}</span>}
                    {t.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{t.location}</span>}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" />
              </div>
            </Link>
            <div className="px-5 pb-3 flex justify-end border-t border-gray-50">
              <button
                onClick={() => handleDelete(t.id, t.name)}
                disabled={isPending}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Nuevo torneo</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, kind: 'local' }))}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium border text-left ${form.kind === 'local' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    🏆 Torneo local
                    <div className="text-xs font-normal text-gray-500">Lo organizamos nosotros</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, kind: 'external' }))}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium border text-left ${form.kind === 'external' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    ✈️ Torneo externo
                    <div className="text-xs font-normal text-gray-500">Vamos a uno de fuera</div>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Copa Primavera 2026" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Alevín" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Formato</label>
                  <select value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value as 'league' | 'cup' | 'mixed' }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="league">Liga</option>
                    <option value="cup">Copa</option>
                    <option value="mixed">Liga + Eliminatorias</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lugar</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ciudad o instalación" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} disabled={isPending} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50">Cancelar</button>
              <button onClick={handleCreate} disabled={isPending} className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
                {isPending ? 'Guardando...' : 'Crear torneo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
