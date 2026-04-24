'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  RefreshCw, AlertTriangle, Search, Settings,
  Activity, ExternalLink, Plus, Trash2, Eye, UserPlus, X,
} from 'lucide-react'
import {
  triggerRffmSync,
  updateSignalStatus,
  captureSignalToScouting,
  addTrackedCompetition,
  removeTrackedCompetition,
} from '@/features/rffm/actions/rffm.actions'

// ── Constants ──────────────────────────────────────────────────

const TIPOJUEGO_LABELS: Record<string, string> = {
  '1': 'F-7',
  '2': 'F-11',
  '4': 'F-5 / Sala',
}

const TIPOJUEGO_COLORS: Record<string, string> = {
  '1': 'bg-green-100 text-green-700',
  '2': 'bg-blue-100 text-blue-700',
  '4': 'bg-orange-100 text-orange-700',
}

const DIV_COLOR = (level: number) =>
  level >= 8 ? 'bg-purple-100 text-purple-700' :
  level >= 6 ? 'bg-blue-100 text-blue-700' :
  level >= 4 ? 'bg-green-100 text-green-700' :
  'bg-gray-100 text-gray-600'

// ── Types ──────────────────────────────────────────────────────

interface Signal {
  id: string
  codjugador: string
  nombre_jugador: string
  nombre_equipo: string
  nombre_competicion: string
  nombre_grupo: string
  goles: number
  partidos_jugados: number
  goles_por_partido: number
  anio_nacimiento: number | null
  division_level: number
  valor_score: number
  estado: 'nuevo' | 'visto' | 'descartado' | 'captado'
}

interface CardAlert {
  id: string
  codjugador: string
  nombre_jugador: string
  amarillas_ciclo_actual: number
  proximo_umbral: number
  alerta_activa: boolean
  rffm_tracked_competitions: { nombre_competicion: string; nombre_grupo: string }
}

interface TrackedComp {
  id: string
  nombre_competicion: string
  nombre_grupo: string
  nombre_equipo_nuestro: string
  cod_tipojuego: string
  umbral_amarillas: number
  last_calendar_sync: string | null
  last_acta_sync: string | null
  active: boolean
}

interface SyncLog {
  id: string
  sync_type: string
  status: string
  competitions_processed: number
  actas_processed: number
  signals_created: number
  errors_count: number
  started_at: string
  finished_at: string | null
}

interface Props {
  signals: Signal[]
  cardAlerts: CardAlert[]
  trackedComps: TrackedComp[]
  recentSyncs: SyncLog[]
}

const TABS = ['Señales', 'Alertas amarillas', 'Competiciones', 'Sync'] as const
type Tab = typeof TABS[number]

const CURRENT_YEAR = new Date().getFullYear()

// ── Default new competition form ───────────────────────────────

const defaultForm = {
  cod_temporada: '21',
  cod_tipojuego: '1',
  cod_competicion: '',
  cod_grupo: '',
  nombre_competicion: '',
  nombre_grupo: '',
  codigo_equipo_nuestro: '',
  nombre_equipo_nuestro: '',
  umbral_amarillas: '5',
}

// ── Main component ─────────────────────────────────────────────

export function RffmDashboard({ signals, cardAlerts, trackedComps, recentSyncs }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<Tab>('Señales')

  // Signal filters
  const [filterAnioMin, setFilterAnioMin] = useState(CURRENT_YEAR - 14)
  const [filterAnioMax, setFilterAnioMax] = useState(CURRENT_YEAR - 8)
  const [filterMinRatio, setFilterMinRatio] = useState(0.5)
  const [filterMinValor, setFilterMinValor] = useState(0)
  const [filterDivision, setFilterDivision] = useState(0)
  const [filterTipo, setFilterTipo] = useState('all')
  const [filterEstado, setFilterEstado] = useState<string>('nuevo')
  const [searchText, setSearchText] = useState('')

  // New comp form
  const [showAddComp, setShowAddComp] = useState(false)
  const [compForm, setCompForm] = useState(defaultForm)

  // ── Signal filtering ─────────────────────────────────────────
  const filteredSignals = signals.filter(s => {
    if (filterEstado !== 'all' && s.estado !== filterEstado) return false
    if (filterTipo !== 'all') {
      // Match tipojuego from competition name heuristic
      // (we don't store tipojuego on signals, but can infer from name)
      // F7 competitions usually have "F-7" or "F7" in name; F11 don't
      const isF7 = s.nombre_competicion.includes('F-7') || s.nombre_competicion.includes('F7') || s.nombre_competicion.includes('FÚTBOL 7') || s.nombre_competicion.includes('FUTBOL 7')
      if (filterTipo === '1' && !isF7) return false
      if (filterTipo === '2' && isF7) return false
    }
    if (s.anio_nacimiento) {
      if (s.anio_nacimiento < filterAnioMin || s.anio_nacimiento > filterAnioMax) return false
    }
    if (Number(s.goles_por_partido) < filterMinRatio) return false
    if (filterMinValor > 0 && Number(s.valor_score) < filterMinValor) return false
    if (filterDivision > 0 && s.division_level < filterDivision) return false
    if (searchText) {
      const q = searchText.toLowerCase()
      if (
        !s.nombre_jugador.toLowerCase().includes(q) &&
        !s.nombre_equipo.toLowerCase().includes(q) &&
        !s.nombre_competicion.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // ── Actions ──────────────────────────────────────────────────

  function handleSync(type: 'full' | 'calendar' | 'actas' | 'scorers') {
    startTransition(async () => {
      toast.loading('Sincronizando con RFFM...')
      const r = await triggerRffmSync(type)
      toast.dismiss()
      if (r.success) {
        toast.success('Sync completado')
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error en sync')
      }
    })
  }

  function handleSignalAction(id: string, action: 'visto' | 'descartado' | 'captado') {
    startTransition(async () => {
      const r = action === 'captado'
        ? await captureSignalToScouting(id)
        : await updateSignalStatus(id, action)
      if (r.success) {
        toast.success(
          action === 'captado' ? 'Añadido a Scouting' :
          action === 'descartado' ? 'Descartado' : 'Marcado como visto'
        )
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error')
      }
    })
  }

  function handleRemoveComp(id: string, nombre: string) {
    if (!confirm(`¿Dejar de seguir "${nombre}"?`)) return
    startTransition(async () => {
      const r = await removeTrackedCompetition(id)
      if (r.success) { toast.success('Eliminado'); router.refresh() }
      else toast.error(r.error ?? 'Error')
    })
  }

  function handleAddComp() {
    if (!compForm.cod_competicion || !compForm.cod_grupo || !compForm.nombre_competicion) {
      toast.error('Rellena al menos: código competición, grupo y nombre')
      return
    }
    startTransition(async () => {
      const r = await addTrackedCompetition({
        ...compForm,
        umbral_amarillas: parseInt(compForm.umbral_amarillas, 10) || 5,
      })
      if (r.success) {
        toast.success('Competición añadida')
        setShowAddComp(false)
        setCompForm(defaultForm)
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error')
      }
    })
  }

  // ── Render ───────────────────────────────────────────────────

  const newSignalCount = signals.filter(s => s.estado === 'nuevo').length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scouting RFFM</h1>
          <p className="text-sm text-gray-500">
            {newSignalCount} señales nuevas · {cardAlerts.length} alertas amarillas ·{' '}
            {trackedComps.length} competiciones seguidas
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleSync('scorers')}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            Barrido goleadores
          </button>
          <button
            onClick={() => handleSync('full')}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
            Sync completo
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
            {tab === 'Alertas amarillas' && cardAlerts.length > 0 && (
              <span className="ml-1.5 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">{cardAlerts.length}</span>
            )}
            {tab === 'Señales' && newSignalCount > 0 && (
              <span className="ml-1.5 bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">{newSignalCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Señales ── */}
      {activeTab === 'Señales' && (
        <div>
          {/* Filters bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="all">Todos</option>
                  <option value="nuevo">Nuevos</option>
                  <option value="visto">Vistos</option>
                  <option value="captado">Captados</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Modalidad</label>
                <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="all">F7 + F11</option>
                  <option value="1">Fútbol 7</option>
                  <option value="2">Fútbol 11</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Año nac. mín</label>
                <input type="number" value={filterAnioMin} onChange={e => setFilterAnioMin(parseInt(e.target.value) || 2010)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Año nac. máx</label>
                <input type="number" value={filterAnioMax} onChange={e => setFilterAnioMax(parseInt(e.target.value) || 2020)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">G/partido mín</label>
                <input type="number" step="0.1" min="0" value={filterMinRatio} onChange={e => setFilterMinRatio(parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">División mín (1–10)</label>
                <input type="number" min={0} max={10} value={filterDivision} onChange={e => setFilterDivision(parseInt(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Jugador o equipo" className="w-full border border-gray-300 rounded pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Mostrando <strong className="text-gray-600">{filteredSignals.length}</strong> señales · Valor = (G/P) × nivel división · F7=1, F11=2, solo goleadores F7+F11
            </p>
          </div>

          {/* Signals table */}
          {filteredSignals.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Search className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">No hay señales con estos filtros</p>
              <p className="text-sm text-gray-400 mt-1">Prueba a ajustar los filtros o lanza un "Barrido goleadores"</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Jugador</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Equipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 hidden lg:table-cell">Competición</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">Div</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">Año</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">G</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">PJ</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">G/P</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">⭐ Valor</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSignals.map(s => (
                    <tr
                      key={s.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        s.estado === 'captado' ? 'bg-green-50/50' :
                        s.estado === 'visto' ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-sm">{s.nombre_jugador}</div>
                        {s.estado === 'captado' && <span className="text-xs text-green-600 font-medium">✓ En scouting</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[160px] truncate">{s.nombre_equipo}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">
                        <div className="max-w-[180px]">
                          <div className="truncate">{s.nombre_competicion}</div>
                          <div className="text-gray-400 truncate">{s.nombre_grupo}</div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${DIV_COLOR(s.division_level)}`}>
                          {s.division_level}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-sm text-gray-700 font-medium">
                        {s.anio_nacimiento ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-gray-900">{s.goles}</td>
                      <td className="px-3 py-3 text-center text-gray-500">{s.partidos_jugados}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-semibold text-blue-700">{Number(s.goles_por_partido).toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-bold text-base ${
                          Number(s.valor_score) >= 12 ? 'text-red-500' :
                          Number(s.valor_score) >= 8 ? 'text-orange-500' :
                          Number(s.valor_score) >= 5 ? 'text-blue-600' :
                          'text-gray-500'
                        }`}>
                          {Number(s.valor_score).toFixed(1)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 justify-center">
                          <a
                            href={`https://www.rffm.es/fichajugador/${s.codjugador}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                            title="Ver en RFFM"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          {s.estado !== 'captado' && (
                            <>
                              {s.estado === 'nuevo' && (
                                <button
                                  onClick={() => handleSignalAction(s.id, 'visto')}
                                  disabled={isPending}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Marcar como visto"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleSignalAction(s.id, 'captado')}
                                disabled={isPending}
                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Añadir a Scouting"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleSignalAction(s.id, 'descartado')}
                                disabled={isPending}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Descartar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Alertas amarillas ── */}
      {activeTab === 'Alertas amarillas' && (
        <div>
          {cardAlerts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">Sin alertas activas</p>
              <p className="text-sm text-gray-400 mt-1">Ningún jugador está a 1 tarjeta de sanción</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-red-50">
                <p className="text-sm text-red-700 font-medium">
                  ⚠️ {cardAlerts.length} jugador{cardAlerts.length > 1 ? 'es' : ''} a 1 amarilla de sanción
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Jugador</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Competición</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">Amarillas ciclo</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">Límite</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cardAlerts.map(a => (
                    <tr key={a.id} className="hover:bg-red-50/30">
                      <td className="px-4 py-3 font-semibold text-gray-900">{a.nombre_jugador}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <div>{a.rffm_tracked_competitions?.nombre_competicion}</div>
                        <div className="text-gray-400">{a.rffm_tracked_competitions?.nombre_grupo}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-orange-600 font-bold text-xl">{a.amarillas_ciclo_actual}</span>
                        <span className="text-gray-400 text-sm"> / {a.proximo_umbral}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-red-50 text-red-700 text-xs px-2.5 py-1 rounded-full font-medium border border-red-200">
                          ⚠️ Próxima = sanción
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Competiciones ── */}
      {activeTab === 'Competiciones' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">
              Competiciones de las que se sincronizan calendario, actas y alertas de tarjetas.
              Los goleadores se barren de <strong>toda la RFFM</strong> (F7 + F11) automáticamente.
            </p>
            <button
              onClick={() => setShowAddComp(true)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium flex-shrink-0 ml-4"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Plus className="w-4 h-4" /> Añadir
            </button>
          </div>

          {trackedComps.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Settings className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">No hay competiciones configuradas</p>
              <p className="text-sm text-gray-400 mt-1">Añade las competiciones en las que participan tus equipos</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Competición / Grupo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Modalidad</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Nuestro equipo</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">Umbral 🟡</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">Último sync</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trackedComps.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{c.nombre_competicion}</div>
                        <div className="text-xs text-gray-500">{c.nombre_grupo}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPOJUEGO_COLORS[c.cod_tipojuego] ?? 'bg-gray-100 text-gray-600'}`}>
                          {TIPOJUEGO_LABELS[c.cod_tipojuego] ?? `Tipo ${c.cod_tipojuego}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">{c.nombre_equipo_nuestro}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{c.umbral_amarillas}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {c.last_calendar_sync
                          ? new Date(c.last_calendar_sync).toLocaleDateString('es', { day: '2-digit', month: '2-digit' })
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRemoveComp(c.id, c.nombre_competicion)}
                          disabled={isPending}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Dejar de seguir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add comp modal */}
          {showAddComp && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddComp(false)}>
              <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Añadir competición RFFM</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Encuentra los códigos en la URL de RFFM: rffm.es/competicion/clasificaciones?<br />
                    temporada=<strong>21</strong>&tipojuego=<strong>1</strong>&competicion=<strong>24037779</strong>&grupo=<strong>24037784</strong>
                  </p>
                </div>
                <div className="p-5 space-y-3">
                  {/* Modalidad selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Modalidad *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[['1', 'Fútbol 7', 'F-7'], ['2', 'Fútbol 11', 'F-11'], ['4', 'Fútbol 5 / Sala', 'F-5']].map(([val, label, short]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCompForm(f => ({ ...f, cod_tipojuego: val }))}
                          className={`py-2 px-3 rounded-lg text-sm font-medium border text-left ${
                            compForm.cod_tipojuego === val
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-semibold">{short}</div>
                          <div className="text-xs font-normal text-gray-500">{label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Temporada *</label>
                      <input type="text" value={compForm.cod_temporada} onChange={e => setCompForm(f => ({ ...f, cod_temporada: e.target.value }))} placeholder="21" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Umbral amarillas *</label>
                      <input type="number" value={compForm.umbral_amarillas} onChange={e => setCompForm(f => ({ ...f, umbral_amarillas: e.target.value }))} placeholder="5" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Código competición *</label>
                      <input type="text" value={compForm.cod_competicion} onChange={e => setCompForm(f => ({ ...f, cod_competicion: e.target.value }))} placeholder="24037779" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Código grupo *</label>
                      <input type="text" value={compForm.cod_grupo} onChange={e => setCompForm(f => ({ ...f, cod_grupo: e.target.value }))} placeholder="24037784" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nombre competición *</label>
                    <input type="text" value={compForm.nombre_competicion} onChange={e => setCompForm(f => ({ ...f, nombre_competicion: e.target.value }))} placeholder="PREFERENTE BENJAMÍN F-7" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nombre grupo</label>
                    <input type="text" value={compForm.nombre_grupo} onChange={e => setCompForm(f => ({ ...f, nombre_grupo: e.target.value }))} placeholder="Grupo 5" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Código equipo nuestro *</label>
                      <input type="text" value={compForm.codigo_equipo_nuestro} onChange={e => setCompForm(f => ({ ...f, codigo_equipo_nuestro: e.target.value }))} placeholder="300513" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nombre equipo nuestro</label>
                      <input type="text" value={compForm.nombre_equipo_nuestro} onChange={e => setCompForm(f => ({ ...f, nombre_equipo_nuestro: e.target.value }))} placeholder="EF CIUDAD DE GETAFE" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
                  <button onClick={() => setShowAddComp(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancelar</button>
                  <button onClick={handleAddComp} disabled={isPending} className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
                    {isPending ? 'Guardando...' : 'Añadir competición'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Sync ── */}
      {activeTab === 'Sync' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {([
              ['Sync completo', 'full', 'Calendario + Actas + Tarjetas + Goleadores', 'text-purple-600'],
              ['Barrido goleadores', 'scorers', 'Recorre TODOS los grupos F7+F11 de la RFFM', 'text-blue-600'],
              ['Calendario + actas', 'calendar', 'Actualiza partidos y procesa actas cerradas', 'text-green-600'],
              ['Solo actas pendientes', 'actas', 'Procesa únicamente actas sin sincronizar', 'text-gray-600'],
            ] as const).map(([label, type, desc, color]) => (
              <button
                key={type}
                onClick={() => handleSync(type)}
                disabled={isPending}
                className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Activity className={`w-4 h-4 ${color}`} />
                  <span className="font-semibold text-sm text-gray-900">{label}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </button>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">Crons automáticos configurados</p>
            <ul className="text-xs space-y-1 text-blue-600">
              <li>🌙 Domingos 23:00 — Barrido global goleadores RFFM (F7 + F11)</li>
              <li>🌙 Diario 01:00 — Sync actas pendientes de equipos nuestros</li>
            </ul>
          </div>

          {/* Recent syncs */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h4 className="font-semibold text-gray-900 text-sm">Historial de sincronizaciones</h4>
            </div>
            {recentSyncs.length === 0 ? (
              <p className="px-5 py-8 text-center text-gray-400 text-sm">Sin historial aún — lanza un sync para empezar</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Tipo</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Estado</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Comps</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Actas</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Señales</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Errores</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600">Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentSyncs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-700 capitalize">{log.sync_type}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          log.status === 'success' ? 'bg-green-100 text-green-700' :
                          log.status === 'error' ? 'bg-red-100 text-red-700' :
                          log.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{log.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{log.competitions_processed}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{log.actas_processed}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{log.signals_created}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={log.errors_count > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                          {log.errors_count}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-500">
                        {new Date(log.started_at).toLocaleString('es', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
