'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw, AlertTriangle, Search, Settings, Activity, ExternalLink, Plus, Trash2, Eye, UserPlus, X } from 'lucide-react'
import {
  triggerRffmSync,
  updateSignalStatus,
  captureSignalToScouting,
  addTrackedCompetition,
  removeTrackedCompetition,
} from '@/features/rffm/actions/rffm.actions'

// ── Types (mirrors DB rows) ────────────────────────────────────

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
  const [filterEstado, setFilterEstado] = useState<string>('nuevo')
  const [searchText, setSearchText] = useState('')

  // New comp form
  const [showAddComp, setShowAddComp] = useState(false)
  const [compForm, setCompForm] = useState({
    cod_temporada: '21', cod_tipojuego: '2', cod_competicion: '', cod_grupo: '',
    nombre_competicion: '', nombre_grupo: '', codigo_equipo_nuestro: '',
    nombre_equipo_nuestro: '', umbral_amarillas: '5',
  })

  // ── Signal filtering ─────────────────────────────────────────
  const filteredSignals = signals.filter(s => {
    if (filterEstado !== 'all' && s.estado !== filterEstado) return false
    if (s.anio_nacimiento) {
      if (s.anio_nacimiento < filterAnioMin || s.anio_nacimiento > filterAnioMax) return false
    }
    if (s.goles_por_partido < filterMinRatio) return false
    if (filterMinValor > 0 && s.valor_score < filterMinValor) return false
    if (filterDivision > 0 && s.division_level < filterDivision) return false
    if (searchText) {
      const q = searchText.toLowerCase()
      if (!s.nombre_jugador.toLowerCase().includes(q) && !s.nombre_equipo.toLowerCase().includes(q)) return false
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
      let r
      if (action === 'captado') {
        r = await captureSignalToScouting(id)
        if (r.success) toast.success('Añadido a Scouting')
      } else {
        r = await updateSignalStatus(id, action)
        if (r.success) toast.success(action === 'descartado' ? 'Descartado' : 'Marcado como visto')
      }
      if (!r.success) toast.error(r.error ?? 'Error')
      else router.refresh()
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
    startTransition(async () => {
      const r = await addTrackedCompetition({
        ...compForm,
        umbral_amarillas: parseInt(compForm.umbral_amarillas, 10) || 5,
      })
      if (r.success) {
        toast.success('Competición añadida')
        setShowAddComp(false)
        setCompForm({ cod_temporada: '21', cod_tipojuego: '2', cod_competicion: '', cod_grupo: '', nombre_competicion: '', nombre_grupo: '', codigo_equipo_nuestro: '', nombre_equipo_nuestro: '', umbral_amarillas: '5' })
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error')
      }
    })
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scouting RFFM</h1>
          <p className="text-sm text-gray-500">{filteredSignals.length} señales · {cardAlerts.length} alertas amarillas</p>
        </div>
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

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
            {tab === 'Alertas amarillas' && cardAlerts.length > 0 && (
              <span className="ml-1.5 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">{cardAlerts.length}</span>
            )}
            {tab === 'Señales' && signals.filter(s => s.estado === 'nuevo').length > 0 && (
              <span className="ml-1.5 bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">{signals.filter(s => s.estado === 'nuevo').length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Señales ── */}
      {activeTab === 'Señales' && (
        <div>
          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Año nac. mín</label>
              <input type="number" value={filterAnioMin} onChange={e => setFilterAnioMin(parseInt(e.target.value) || 2010)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Año nac. máx</label>
              <input type="number" value={filterAnioMax} onChange={e => setFilterAnioMax(parseInt(e.target.value) || 2020)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Goles/partido mín</label>
              <input type="number" step="0.1" value={filterMinRatio} onChange={e => setFilterMinRatio(parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
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

          {/* Signals table */}
          {filteredSignals.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Search className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">No hay señales con estos filtros</p>
              <p className="text-sm text-gray-400 mt-1">Prueba a lanzar un "Sync completo" primero</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Jugador</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Equipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 hidden md:table-cell">Competición</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">Div</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">Año</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">G</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">PJ</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">G/P</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">Valor</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSignals.map(s => (
                    <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${s.estado === 'captado' ? 'bg-green-50' : s.estado === 'visto' ? 'bg-gray-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{s.nombre_jugador}</div>
                        {s.estado === 'captado' && <span className="text-xs text-green-600 font-medium">✓ Captado</span>}
                        {s.estado === 'visto' && <span className="text-xs text-gray-500">Visto</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{s.nombre_equipo}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                        {s.nombre_competicion}<br /><span className="text-gray-400">{s.nombre_grupo}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          s.division_level >= 8 ? 'bg-purple-100 text-purple-700' :
                          s.division_level >= 6 ? 'bg-blue-100 text-blue-700' :
                          s.division_level >= 4 ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{s.division_level}</span>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-700">{s.anio_nacimiento ?? '—'}</td>
                      <td className="px-3 py-3 text-center font-semibold text-gray-900">{s.goles}</td>
                      <td className="px-3 py-3 text-center text-gray-600">{s.partidos_jugados}</td>
                      <td className="px-3 py-3 text-center font-medium text-blue-700">{Number(s.goles_por_partido).toFixed(2)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-bold text-sm ${s.valor_score >= 8 ? 'text-orange-600' : s.valor_score >= 5 ? 'text-blue-600' : 'text-gray-600'}`}>
                          {Number(s.valor_score).toFixed(1)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 justify-center">
                          <a
                            href={`https://www.rffm.es/fichajugador/${s.codjugador}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-gray-400 hover:text-gray-700 rounded"
                            title="Ver ficha RFFM"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          {s.estado !== 'captado' && (
                            <>
                              <button onClick={() => handleSignalAction(s.id, 'visto')} disabled={isPending} className="p-1 text-gray-400 hover:text-blue-600 rounded" title="Marcar como visto">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleSignalAction(s.id, 'captado')} disabled={isPending} className="p-1 text-gray-400 hover:text-green-600 rounded" title="Añadir a Scouting">
                                <UserPlus className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleSignalAction(s.id, 'descartado')} disabled={isPending} className="p-1 text-gray-400 hover:text-red-500 rounded" title="Descartar">
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
              <p className="text-sm text-gray-400 mt-1">Todos los jugadores están lejos del límite de amarillas</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Jugador</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Competición</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">Amarillas ciclo</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">Próximo límite</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cardAlerts.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{a.nombre_jugador}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {a.rffm_tracked_competitions?.nombre_competicion}<br />
                        {a.rffm_tracked_competitions?.nombre_grupo}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-orange-600 font-bold text-lg">{a.amarillas_ciclo_actual}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{a.proximo_umbral}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-red-50 text-red-700 text-xs px-2 py-1 rounded-full font-medium">
                          ⚠️ 1 amarilla para sanción
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
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowAddComp(true)} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
              <Plus className="w-4 h-4" /> Añadir competición
            </button>
          </div>
          {trackedComps.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Settings className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">No hay competiciones configuradas</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Competición / Grupo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Nuestro equipo</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">Umbral amarillas</th>
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
                      <td className="px-4 py-3 text-gray-600">{c.nombre_equipo_nuestro}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{c.umbral_amarillas}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {c.last_calendar_sync ? new Date(c.last_calendar_sync).toLocaleDateString('es') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleRemoveComp(c.id, c.nombre_competicion)} disabled={isPending} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
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
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Añadir competición RFFM</h3></div>
                <div className="p-5 space-y-3">
                  {[
                    ['Código temporada', 'cod_temporada', 'text', '21'],
                    ['Código tipojuego', 'cod_tipojuego', 'text', '2'],
                    ['Código competición', 'cod_competicion', 'text', '24037779'],
                    ['Código grupo', 'cod_grupo', 'text', '24037784'],
                    ['Nombre competición', 'nombre_competicion', 'text', 'PREFERENTE BENJAMÍN F-7'],
                    ['Nombre grupo', 'nombre_grupo', 'text', 'Grupo 5'],
                    ['Código equipo nuestro', 'codigo_equipo_nuestro', 'text', '300513'],
                    ['Nombre equipo nuestro', 'nombre_equipo_nuestro', 'text', 'EF CIUDAD DE GETAFE'],
                    ['Umbral amarillas', 'umbral_amarillas', 'number', '5'],
                  ].map(([label, field, type, placeholder]) => (
                    <div key={field as string}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{label as string}</label>
                      <input
                        type={type as string}
                        value={(compForm as never)[field as string] as string}
                        onChange={e => setCompForm(f => ({ ...f, [field as string]: e.target.value }))}
                        placeholder={placeholder as string}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
                  <button onClick={() => setShowAddComp(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancelar</button>
                  <button onClick={handleAddComp} disabled={isPending} className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
                    Añadir
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              ['Sync completo', 'full', 'Calendario + Actas + Tarjetas + Goleadores'],
              ['Solo goleadores', 'scorers', 'Barrido RFFM completo para scouting'],
              ['Calendario', 'calendar', 'Actualiza partidos y resultados'],
              ['Actas pendientes', 'actas', 'Procesa actas cerradas sin sync'],
            ] as const).map(([label, type, desc]) => (
              <button
                key={type}
                onClick={() => handleSync(type)}
                disabled={isPending}
                className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <span className="font-medium text-sm text-gray-900">{label}</span>
                </div>
                <p className="text-xs text-gray-500">{desc}</p>
              </button>
            ))}
          </div>

          {/* Recent syncs */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h4 className="font-semibold text-gray-900 text-sm">Historial de sincronizaciones</h4>
            </div>
            {recentSyncs.length === 0 ? (
              <p className="px-5 py-8 text-center text-gray-400 text-sm">Sin historial</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Tipo</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Estado</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Competiciones</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Actas</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Señales</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Errores</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentSyncs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-700 capitalize">{log.sync_type}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          log.status === 'success' ? 'bg-green-100 text-green-700' :
                          log.status === 'error' ? 'bg-red-100 text-red-700' :
                          log.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{log.status}</span>
                      </td>
                      <td className="px-4 py-2 text-center text-gray-600">{log.competitions_processed}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{log.actas_processed}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{log.signals_created}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{log.errors_count}</td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500">
                        {new Date(log.started_at).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
