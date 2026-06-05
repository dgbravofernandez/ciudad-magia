'use client'

import { useState, useTransition, useCallback } from 'react'
import {
  Timer, Target, CalendarCheck, HeartPulse, Calendar,
  Trophy, CreditCard, TrendingUp, MessageSquare, Download,
  ChevronRight, Loader2, BadgeEuro, Mail, CheckSquare, Square,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/currency'
import type { TeamOption, CuotasSummary } from '@/features/informes/actions/informes.actions'
import {
  getPlayerMinutes, getPlayerGoals, getPlayerAttendance, getInjuredPlayers,
  getSessions, getMatchResults, getPendingPayments, getIncomeByMonth,
  getCoachObservations, getCuotasNextSeason,
} from '@/features/informes/actions/informes.actions'
import { sendPendingReminders } from '@/features/contabilidad/actions/accounting.actions'

// ─────────────────────────────────────────────
// TIPOS DE VISTA
// ─────────────────────────────────────────────

type ViewId =
  | 'minutos' | 'goles' | 'asistencia' | 'lesiones'
  | 'sesiones' | 'resultados' | 'pagos_pend' | 'ingresos' | 'observaciones'
  | 'cuotas_sig'

type ViewDef = {
  id: ViewId
  label: string
  icon: React.ComponentType<{ className?: string }>
  group: string
  needsTeam?: boolean
}

const VIEWS: ViewDef[] = [
  { id: 'minutos', label: 'Minutos jugados', icon: Timer, group: 'Jugadores' },
  { id: 'goles', label: 'Goles y asistencias', icon: Target, group: 'Jugadores' },
  { id: 'asistencia', label: 'Asistencia entrenos', icon: CalendarCheck, group: 'Jugadores' },
  { id: 'lesiones', label: 'Lesionados actuales', icon: HeartPulse, group: 'Jugadores' },
  { id: 'sesiones', label: 'Sesiones planificadas', icon: Calendar, group: 'Equipo' },
  { id: 'resultados', label: 'Últimos resultados', icon: Trophy, group: 'Equipo' },
  { id: 'cuotas_sig', label: 'Cuotas sig. temporada', icon: BadgeEuro, group: 'Pagos' },
  { id: 'pagos_pend', label: 'Pagos pendientes', icon: CreditCard, group: 'Pagos' },
  { id: 'ingresos', label: 'Ingresos por mes', icon: TrendingUp, group: 'Pagos' },
  { id: 'observaciones', label: 'Observaciones técnicas', icon: MessageSquare, group: 'Técnico' },
]

const GROUPS = ['Jugadores', 'Equipo', 'Pagos', 'Técnico']

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

export function InformesExplorer({
  teams,
  currentSeason,
}: {
  teams: TeamOption[]
  currentSeason: string
}) {
  const [selectedView, setSelectedView] = useState<ViewId>('minutos')
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [selectedSeason] = useState(currentSeason)
  const [data, setData] = useState<any[]>([])
  const [cuotasSummary, setCuotasSummary] = useState<CuotasSummary | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selectedForReminder, setSelectedForReminder] = useState<Set<string>>(new Set())

  const loadData = useCallback((viewId: ViewId) => {
    startTransition(async () => {
      setLoaded(false)
      const filters = { teamId: selectedTeam || undefined, season: selectedSeason }

      if (viewId === 'cuotas_sig') {
        const result = await getCuotasNextSeason()
        if (result.success && result.data) {
          setCuotasSummary(result.data)
          setLoaded(true)
        } else {
          toast.error(result.error ?? 'Error al cargar cuotas')
        }
        return
      }

      let result: any
      switch (viewId) {
        case 'minutos':    result = await getPlayerMinutes(filters); break
        case 'goles':      result = await getPlayerGoals(filters); break
        case 'asistencia': result = await getPlayerAttendance(filters); break
        case 'lesiones':   result = await getInjuredPlayers({ teamId: filters.teamId }); break
        case 'sesiones':   result = await getSessions({ ...filters, type: 'all' }); break
        case 'resultados': result = await getMatchResults(filters); break
        case 'pagos_pend': result = await getPendingPayments(filters); break
        case 'ingresos':   result = await getIncomeByMonth(filters); break
        case 'observaciones': result = await getCoachObservations({ teamId: filters.teamId }); break
        default: return
      }

      if (result.success) {
        setData(result.data ?? [])
        setLoaded(true)
      } else {
        toast.error(result.error ?? 'Error al cargar datos')
      }
    })
  }, [selectedTeam, selectedSeason])

  function handleSelectView(viewId: ViewId) {
    setSelectedView(viewId)
    setSelectedForReminder(new Set())
    loadData(viewId)
  }

  function handleTeamChange(teamId: string) {
    setSelectedTeam(teamId)
    setLoaded(false)
    setData([])
  }

  function handleSendReminderFromInformes() {
    const ids = Array.from(selectedForReminder)
    if (ids.length === 0) return
    if (!confirm(`Enviar aviso de cuota pendiente a ${ids.length} familia(s)?`)) return
    startTransition(async () => {
      const r = await sendPendingReminders(ids)
      if (r.success || (r.sent && r.sent > 0)) {
        const parts: string[] = []
        if (r.sent) parts.push(`${r.sent} enviado(s)`)
        if (r.skippedNoEmail) parts.push(`${r.skippedNoEmail} sin email`)
        if (r.skippedSpecial) parts.push(`${r.skippedSpecial} caso especial`)
        if (r.failed) parts.push(`${r.failed} fallidos`)
        toast.success(`Avisos: ${parts.join(' · ')}`)
        setSelectedForReminder(new Set())
      } else {
        toast.error(r.error ?? 'Error al enviar avisos')
      }
    })
  }

  const currentViewDef = VIEWS.find(v => v.id === selectedView)!

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
      {/* ── SIDEBAR MENÚ ── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden h-fit lg:sticky lg:top-4">
        {/* Filtros globales */}
        <div className="p-3 border-b border-border space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Equipo</label>
          <select
            value={selectedTeam}
            onChange={(e) => handleTeamChange(e.target.value)}
            className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos los equipos</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Vistas por grupo */}
        <nav className="p-2">
          {GROUPS.map((group) => {
            const groupViews = VIEWS.filter(v => v.group === group)
            return (
              <div key={group} className="mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">
                  {group}
                </p>
                {groupViews.map((view) => {
                  const Icon = view.icon
                  const isActive = selectedView === view.id
                  return (
                    <button
                      key={view.id}
                      onClick={() => handleSelectView(view.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors text-left',
                        isActive
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'text-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1">{view.label}</span>
                      {isActive && <ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>
      </div>

      {/* ── CONTENIDO ── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Header de la vista */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(() => {
              const Icon = currentViewDef.icon
              return <Icon className="w-5 h-5 text-muted-foreground" />
            })()}
            <h2 className="font-semibold text-foreground">{currentViewDef.label}</h2>
            {selectedTeam && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {teams.find(t => t.id === selectedTeam)?.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedView === 'pagos_pend' && selectedForReminder.size > 0 && (
              <button
                onClick={handleSendReminderFromInformes}
                disabled={isPending}
                className="btn-secondary text-sm h-8 px-3 flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                Enviar aviso ({selectedForReminder.size})
              </button>
            )}
            {!loaded && (
              <button
                onClick={() => loadData(selectedView)}
                disabled={isPending}
                className="btn-primary text-sm h-8 px-3 flex items-center gap-1.5"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : null}
                {isPending ? 'Cargando...' : 'Cargar datos'}
              </button>
            )}
            {loaded && data.length > 0 && (
              <button
                onClick={() => exportToCSV(data, selectedView)}
                className="btn-secondary text-sm h-8 px-3 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Exportar CSV
              </button>
            )}
          </div>
        </div>

        {/* Contenido de la vista */}
        <div className="overflow-x-auto">
          {isPending ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !loaded ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              {(() => {
                const Icon = currentViewDef.icon
                return <Icon className="w-10 h-10 opacity-30" />
              })()}
              <p className="text-sm">Pulsa &quot;Cargar datos&quot; para ver {currentViewDef.label.toLowerCase()}</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <p className="text-sm">No hay datos disponibles para esta selección</p>
            </div>
          ) : (
            <ViewTable
              viewId={selectedView}
              data={data}
              selectedForReminder={selectedForReminder}
              onToggleReminder={(id) => setSelectedForReminder(prev => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id); else next.add(id)
                return next
              })}
              onToggleAllReminder={(ids) => setSelectedForReminder(prev =>
                prev.size === ids.length ? new Set() : new Set(ids)
              )}
            />
          )}
        </div>

        {loaded && data.length > 0 && (
          <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground">
            {data.length} registro{data.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// TABLAS POR VISTA
// ─────────────────────────────────────────────

function ViewTable({
  viewId, data, selectedForReminder, onToggleReminder, onToggleAllReminder,
}: {
  viewId: ViewId
  data: any[]
  selectedForReminder: Set<string>
  onToggleReminder: (id: string) => void
  onToggleAllReminder: (ids: string[]) => void
}) {
  switch (viewId) {
    case 'minutos': return <MinutosTable data={data} />
    case 'goles': return <GolesTable data={data} />
    case 'asistencia': return <AsistenciaTable data={data} />
    case 'lesiones': return <LesionesTable data={data} />
    case 'sesiones': return <SesionesTable data={data} />
    case 'resultados': return <ResultadosTable data={data} />
    case 'pagos_pend': return (
      <PagosPendTable
        data={data}
        selected={selectedForReminder}
        onToggle={onToggleReminder}
        onToggleAll={onToggleAllReminder}
      />
    )
    case 'ingresos': return <IngresosTable data={data} />
    case 'observaciones': return <ObservacionesTable data={data} />
    default: return null
  }
}

// Cabecera de tabla reutilizable
function Th({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <th className={cn(
      'px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/30 border-b border-border',
      center ? 'text-center' : 'text-left'
    )}>
      {children}
    </th>
  )
}

function Td({ children, center, mono }: { children: React.ReactNode; center?: boolean; mono?: boolean }) {
  return (
    <td className={cn(
      'px-4 py-3 text-sm border-b border-border/50',
      center && 'text-center',
      mono && 'font-mono'
    )}>
      {children}
    </td>
  )
}

// ── Minutos ──
function MinutosTable({ data }: { data: any[] }) {
  return (
    <table className="w-full">
      <thead><tr>
        <Th>#</Th><Th>Jugador</Th><Th>Equipo</Th>
        <Th center>Partidos</Th><Th center>Minutos</Th><Th center>% Tiempo</Th>
      </tr></thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={row.player_id} className="hover:bg-muted/20 transition-colors">
            <Td><span className="text-muted-foreground">{i + 1}</span></Td>
            <Td><span className="font-medium">{row.player_name}</span></Td>
            <Td><span className="text-muted-foreground">{row.team_name}</span></Td>
            <Td center>{row.matches_played}</Td>
            <Td center mono>{row.total_minutes}&apos;</Td>
            <Td center>
              <PctBar value={row.minutes_pct} />
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Goles ──
function GolesTable({ data }: { data: any[] }) {
  return (
    <table className="w-full">
      <thead><tr>
        <Th>#</Th><Th>Jugador</Th><Th>Equipo</Th>
        <Th center>⚽ Goles</Th><Th center>🎯 Asist.</Th>
        <Th center>🟨</Th><Th center>🟥</Th><Th center>Rating</Th>
      </tr></thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={row.player_id} className="hover:bg-muted/20 transition-colors">
            <Td><span className="text-muted-foreground">{i + 1}</span></Td>
            <Td><span className="font-medium">{row.player_name}</span></Td>
            <Td><span className="text-muted-foreground">{row.team_name}</span></Td>
            <Td center><span className="font-semibold text-green-600">{row.goals}</span></Td>
            <Td center><span className="text-blue-600">{row.assists}</span></Td>
            <Td center><span className="text-yellow-600">{row.yellow_cards}</span></Td>
            <Td center><span className="text-red-600">{row.red_cards}</span></Td>
            <Td center>{row.avg_rating ? <span className="font-mono">{row.avg_rating}</span> : '—'}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Asistencia ──
function AsistenciaTable({ data }: { data: any[] }) {
  return (
    <table className="w-full">
      <thead><tr>
        <Th>Jugador</Th><Th>Equipo</Th>
        <Th center>Sesiones</Th><Th center>Presentes</Th><Th center>Justif.</Th><Th center>Ausentes</Th><Th center>% Asist.</Th>
      </tr></thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.player_id} className="hover:bg-muted/20 transition-colors">
            <Td><span className="font-medium">{row.player_name}</span></Td>
            <Td><span className="text-muted-foreground">{row.team_name}</span></Td>
            <Td center>{row.total_sessions}</Td>
            <Td center><span className="text-green-600">{row.attended}</span></Td>
            <Td center><span className="text-yellow-600">{row.justified}</span></Td>
            <Td center><span className="text-red-600">{row.absent}</span></Td>
            <Td center><PctBar value={row.attendance_pct} /></Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Lesiones ──
function LesionesTable({ data }: { data: any[] }) {
  return (
    <table className="w-full">
      <thead><tr>
        <Th>Jugador</Th><Th>Equipo</Th><Th>Lesión</Th><Th>Estado</Th><Th center>Días lesionado</Th>
      </tr></thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.player_id} className="hover:bg-muted/20 transition-colors">
            <Td><span className="font-medium">{row.player_name}</span></Td>
            <Td><span className="text-muted-foreground">{row.team_name}</span></Td>
            <Td>{row.injury_type}</Td>
            <Td>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                row.status === 'active' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              )}>
                {row.status === 'active' ? 'Activa' : 'Recuperándose'}
              </span>
            </Td>
            <Td center>
              <span className={cn(
                'font-mono font-semibold',
                row.days_injured > 30 ? 'text-red-600' : row.days_injured > 14 ? 'text-yellow-600' : 'text-muted-foreground'
              )}>
                {row.days_injured}d
              </span>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Sesiones ──
function SesionesTable({ data }: { data: any[] }) {
  return (
    <table className="w-full">
      <thead><tr>
        <Th>Fecha</Th><Th>Equipo</Th><Th>Tipo</Th><Th>Lugar</Th><Th center>Asistentes</Th>
      </tr></thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id} className="hover:bg-muted/20 transition-colors">
            <Td><span className="font-mono text-xs">{new Date(row.session_date).toLocaleDateString('es-ES')}</span></Td>
            <Td><span className="font-medium">{row.team_name}</span></Td>
            <Td>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                row.session_type === 'match' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
              )}>
                {row.session_type === 'match' ? 'Partido' : 'Entreno'}
              </span>
            </Td>
            <Td><span className="text-muted-foreground text-xs">{row.location ?? '—'}</span></Td>
            <Td center>
              {row.total_players > 0
                ? <span>{row.attendees_count}/{row.total_players}</span>
                : <span className="text-muted-foreground">—</span>
              }
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Resultados ──
function ResultadosTable({ data }: { data: any[] }) {
  return (
    <table className="w-full">
      <thead><tr>
        <Th>Fecha</Th><Th>Equipo</Th><Th>Partido</Th><Th center>Resultado</Th>
      </tr></thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id} className="hover:bg-muted/20 transition-colors">
            <Td><span className="font-mono text-xs">{new Date(row.session_date).toLocaleDateString('es-ES')}</span></Td>
            <Td><span className="font-medium">{row.team_name}</span></Td>
            <Td><span className="text-muted-foreground text-sm">{row.title ?? '—'}</span></Td>
            <Td center>
              {row.result ? (
                <ResultBadge result={row.result} />
              ) : '—'}
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Pagos pendientes ──
function PagosPendTable({
  data,
  selected,
  onToggle,
  onToggleAll,
}: {
  data: any[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (ids: string[]) => void
}) {
  const total = data.reduce((sum: number, r: any) => sum + r.total_pending, 0)
  const allIds = data.map((r: any) => r.player_id)
  const allSelected = allIds.length > 0 && allIds.every((id: string) => selected.has(id))

  return (
    <>
      <table className="w-full">
        <thead><tr>
          <th className="px-3 py-3 w-8 bg-muted/30 border-b border-border">
            <button onClick={() => onToggleAll(allIds)} title="Seleccionar todos">
              {allSelected
                ? <CheckSquare className="w-4 h-4 text-primary" />
                : <Square className="w-4 h-4 text-muted-foreground" />}
            </button>
          </th>
          <Th>Jugador</Th><Th>Equipo</Th><Th>Meses</Th><Th>Contacto</Th><Th center>Estado pago</Th>
        </tr></thead>
        <tbody>
          {data.map((row) => {
            const hasPending = row.total_pending > 0
            const isSelected = selected.has(row.player_id)
            return (
              <tr key={row.player_id} className={cn(
                'hover:bg-muted/20 transition-colors',
                isSelected && 'bg-primary/5'
              )}>
                <td className="px-3 py-3 text-center">
                  <button onClick={() => onToggle(row.player_id)}>
                    {isSelected
                      ? <CheckSquare className="w-4 h-4 text-primary" />
                      : <Square className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </td>
                <Td><span className="font-medium">{row.player_name}</span></Td>
                <Td><span className="text-muted-foreground">{row.team_name}</span></Td>
                <Td>
                  <div className="flex gap-1 flex-wrap">
                    {row.pending_months.map((m: string) => (
                      <span key={m} className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">{m}</span>
                    ))}
                  </div>
                </Td>
                <Td>
                  <div className="space-y-0.5 text-xs">
                    {row.tutor_email
                      ? <a href={`mailto:${row.tutor_email}`} className="text-muted-foreground hover:text-primary flex items-center gap-1 truncate max-w-[180px]">
                          <Mail className="w-3 h-3 shrink-0" /><span className="truncate">{row.tutor_email}</span>
                        </a>
                      : <span className="text-muted-foreground/40">Sin email</span>}
                    {row.tutor_phone && (
                      <a href={`tel:${row.tutor_phone}`} className="text-muted-foreground hover:text-primary block">{row.tutor_phone}</a>
                    )}
                  </div>
                </Td>
                <Td center>
                  {hasPending ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        ✗ Pendiente
                      </span>
                      <span className="font-mono text-xs font-bold text-red-600">{row.total_pending.toFixed(2)}€</span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      ✓ Al corriente
                    </span>
                  )}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center justify-between text-sm font-semibold">
        <span className="text-muted-foreground">{data.length} jugadores con deuda · Total pendiente</span>
        <span className="text-red-600 font-mono">{total.toFixed(2)}€</span>
      </div>
    </>
  )
}

// ── Ingresos ──
function IngresosTable({ data }: { data: any[] }) {
  const total = data.reduce((sum: number, r: any) => sum + r.total, 0)
  return (
    <>
      <table className="w-full">
        <thead><tr>
          <Th>Mes</Th>
          <Th center>Efectivo</Th><Th center>Tarjeta</Th><Th center>Transfer.</Th>
          <Th center>Pagos</Th><Th center>Total</Th>
        </tr></thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.month} className="hover:bg-muted/20 transition-colors">
              <Td><span className="font-medium">{row.month}</span></Td>
              <Td center mono>{row.cash > 0 ? `${row.cash.toFixed(2)}€` : '—'}</Td>
              <Td center mono>{row.card > 0 ? `${row.card.toFixed(2)}€` : '—'}</Td>
              <Td center mono>{row.transfer > 0 ? `${row.transfer.toFixed(2)}€` : '—'}</Td>
              <Td center>{row.count}</Td>
              <Td center><span className="font-semibold text-green-600 font-mono">{row.total.toFixed(2)}€</span></Td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center justify-between text-sm font-semibold">
        <span className="text-muted-foreground">Total ingresos</span>
        <span className="text-green-600 font-mono">{total.toFixed(2)}€</span>
      </div>
    </>
  )
}

// ── Observaciones ──
function ObservacionesTable({ data }: { data: any[] }) {
  return (
    <table className="w-full">
      <thead><tr>
        <Th>Fecha</Th><Th>Jugador</Th><Th>Equipo</Th><Th>Categoría</Th><Th>Comentario</Th><Th>Autor</Th>
      </tr></thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id} className="hover:bg-muted/20 transition-colors">
            <Td><span className="font-mono text-xs">{new Date(row.created_at).toLocaleDateString('es-ES')}</span></Td>
            <Td><span className="font-medium">{row.player_name}</span></Td>
            <Td><span className="text-muted-foreground text-xs">{row.team_name}</span></Td>
            <Td>
              <span className="px-2 py-0.5 bg-muted rounded text-xs">{row.category}</span>
            </Td>
            <Td>
              <p className="text-sm max-w-xs truncate" title={row.comment}>{row.comment}</p>
            </Td>
            <Td><span className="text-muted-foreground text-xs">{row.author_name}</span></Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─────────────────────────────────────────────
// HELPERS UI
// ─────────────────────────────────────────────

function PctBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2 justify-center">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-mono w-8 text-right">{value}%</span>
    </div>
  )
}

function ResultBadge({ result }: { result: string }) {
  // Intentar detectar si es victoria/empate/derrota basado en el resultado "2-1", "1-1", "0-3"
  const parts = result.match(/(\d+)[\s-]+(\d+)/)
  let color = 'bg-muted text-muted-foreground'
  if (parts) {
    const [, a, b] = parts.map(Number)
    if (a > b) color = 'bg-green-100 text-green-700'
    else if (a === b) color = 'bg-yellow-100 text-yellow-700'
    else color = 'bg-red-100 text-red-700'
  }
  return (
    <span className={cn('px-2 py-0.5 rounded font-mono text-sm font-semibold', color)}>
      {result}
    </span>
  )
}

// ─────────────────────────────────────────────
// EXPORT CSV
// ─────────────────────────────────────────────

function exportToCSV(data: any[], viewId: ViewId) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h]
      if (Array.isArray(val)) return `"${val.join(', ')}"`
      if (typeof val === 'string' && val.includes(',')) return `"${val}"`
      return val ?? ''
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `informe_${viewId}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
