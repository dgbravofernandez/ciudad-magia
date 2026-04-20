'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Shield, Footprints, Ruler, Weight,
  Calendar, Mail, Phone, FileText, Heart, Euro, AlertTriangle,
  ExternalLink, CheckCircle2, XCircle, Send, Trash2, Plus, MessageSquare, Pencil
} from 'lucide-react'
import { deletePlayer, sendTrialLetter, addInjury, addPlayerObservation, updateInjury, deleteInjury, updatePlayerObservation, deletePlayerObservation, getPlayerPerformance, type PlayerPerformance } from '@/features/jugadores/actions/player.actions'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer
} from 'recharts'
import { cn } from '@/lib/utils/cn'
import { formatDate, formatCurrency, getMonthName } from '@/lib/utils/currency'
import type { Player, Injury, QuotaPayment } from '@/types/database.types'
import { RoleGuard } from '@/components/shared/RoleGuard'

type PlayerWithTeam = Player & {
  teams?: { id: string; name: string; categories?: { name: string } | null } | null
}

const STATUS_COLORS: Record<string, string> = {
  active: 'badge-success',
  injured: 'badge-warning',
  inactive: 'badge-muted',
  low: 'badge-destructive',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  injured: 'Lesionado',
  inactive: 'Inactivo',
  low: 'Baja',
}

const TABS = ['Datos', 'Rendimiento', 'Stats', 'Lesiones', 'Pagos', 'Documentos', 'Observaciones'] as const
type Tab = (typeof TABS)[number]

type Observation = { id: string; category: string; comment: string; author_name: string | null; created_at: string }

export function PlayerCard({
  player,
  stats,
  injuries,
  payments,
  sanctions,
  observations = [],
  canAddInjury = false,
  authorName = '',
}: {
  player: PlayerWithTeam
  stats: Record<string, unknown>[]
  injuries: Injury[]
  payments: QuotaPayment[]
  sanctions: Record<string, unknown>[]
  observations?: Observation[]
  canAddInjury?: boolean
  authorName?: string
}) {
  const [tab, setTab] = useState<Tab>('Datos')
  const [deleting, setDeleting] = useState(false)
  const [photoError, setPhotoError] = useState(false)

  // Carta de pruebas modal
  const [showTrialModal, setShowTrialModal] = useState(false)
  const [trialClub, setTrialClub] = useState('')
  const [trialDate, setTrialDate] = useState('')
  const [trialLoading, setTrialLoading] = useState(false)

  const router = useRouter()

  async function handleSendTrialLetter() {
    if (!trialClub.trim() || !trialDate) return
    setTrialLoading(true)
    const res = await sendTrialLetter(player.id, trialClub.trim(), trialDate)
    setTrialLoading(false)
    if (res.success) {
      setShowTrialModal(false)
      setTrialClub('')
      setTrialDate('')
      alert(res.emailSent ? 'Carta enviada al tutor por email.' : 'Carta guardada (no hay email de tutor).')
    } else {
      alert(`Error: ${res.error}`)
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar a ${player.first_name} ${player.last_name}? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    const result = await deletePlayer(player.id)
    if (result.success) {
      router.push('/jugadores')
    } else {
      alert(`Error: ${result.error}`)
      setDeleting(false)
    }
  }

  const currentSeason = stats[0]
  const age = player.birth_date
    ? Math.floor(
        (Date.now() - new Date(player.birth_date).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : null

  const radarData = [
    { subject: 'Goles', value: Math.min(((currentSeason?.goals as number) ?? 0) * 10, 100) },
    { subject: 'Asistencias', value: Math.min(((currentSeason?.assists as number) ?? 0) * 10, 100) },
    { subject: 'Partidos', value: Math.min(((currentSeason?.matches_played as number) ?? 0) * 5, 100) },
    { subject: 'Asistencia', value: currentSeason?.matches_available
      ? Math.round(((currentSeason.matches_played as number) / (currentSeason.matches_available as number)) * 100)
      : 0
    },
    { subject: 'Valoración', value: currentSeason?.rating_avg
      ? ((currentSeason.rating_avg as number) / 10) * 100
      : 0
    },
  ]

  const pendingPayments = payments.filter((p) => p.status === 'pending' || p.status === 'partial')
  const activeSanctions = sanctions.filter((s) => (s as {active: boolean}).active)

  return (
    <div className="space-y-6">
      {/* Back + actions */}
      <div className="flex items-center gap-4">
        <Link href="/jugadores" className="btn-ghost gap-2">
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <RoleGuard roles={['admin', 'direccion', 'director_deportivo']}>
            <button
              onClick={() => setShowTrialModal(true)}
              className="btn-secondary gap-1.5 flex items-center text-sm"
            >
              <FileText className="w-4 h-4" />
              Carta de pruebas
            </button>
          </RoleGuard>
          <RoleGuard roles={['admin', 'direccion', 'coordinador', 'director_deportivo']}>
            <Link href={`/jugadores/${player.id}/editar`} className="btn-secondary">
              Editar ficha
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </RoleGuard>
        </div>
      </div>

      {/* Carta de pruebas modal */}
      {showTrialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Carta de pruebas</h3>
            <p className="text-sm text-muted-foreground">
              Se enviará una carta al tutor autorizando a <strong>{player.first_name} {player.last_name}</strong> a realizar una prueba.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Club destino *</label>
                <input
                  className="input w-full"
                  placeholder="Nombre del club"
                  value={trialClub}
                  onChange={e => setTrialClub(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Fecha de prueba *</label>
                <input
                  type="date"
                  className="input w-full"
                  value={trialDate}
                  onChange={e => setTrialDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowTrialModal(false); setTrialClub(''); setTrialDate('') }}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendTrialLetter}
                disabled={trialLoading || !trialClub.trim() || !trialDate}
                className="btn-primary flex-1 gap-2 flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
                {trialLoading ? 'Enviando...' : 'Enviar carta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIFA-style header card */}
      <div className="card overflow-hidden">
        <div
          className="h-24 w-full"
          style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-primary)aa)` }}
        />
        <div className="px-6 pb-6">
          <div className="flex items-end gap-6 -mt-10 mb-4">
            <div className="relative">
              {player.photo_url && !photoError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={driveImageUrl(player.photo_url)}
                  alt={`${player.first_name} ${player.last_name}`}
                  className="w-24 h-24 rounded-xl object-cover border-4 border-card shadow-lg"
                  onError={() => setPhotoError(true)}
                />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-muted border-4 border-card shadow-lg flex items-center justify-center text-2xl font-bold text-muted-foreground">
                  {player.first_name.charAt(0)}{player.last_name.charAt(0)}
                </div>
              )}
              {player.dorsal_number && (
                <span className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow">
                  {player.dorsal_number}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0 pt-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold">
                  {player.first_name} {player.last_name}
                </h2>
                <span className={cn('badge', STATUS_COLORS[player.status])}>
                  {STATUS_LABELS[player.status]}
                </span>
                {activeSanctions.length > 0 && (
                  <span className="badge badge-destructive gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Sancionado
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
                {player.teams && (
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {player.teams.name}
                    {player.teams.categories && ` · ${player.teams.categories.name}`}
                  </span>
                )}
                {player.position && (
                  <span className="flex items-center gap-1">
                    <Footprints className="w-3 h-3" />
                    {player.position}
                  </span>
                )}
                {age && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {age} años
                  </span>
                )}
                {player.nationality && (
                  <span>{player.nationality}</span>
                )}
              </div>
            </div>

            {/* Quick stats */}
            {currentSeason && (
              <div className="hidden lg:flex items-center gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{currentSeason.goals as number}</p>
                  <p className="text-xs text-muted-foreground">Goles</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{currentSeason.assists as number}</p>
                  <p className="text-xs text-muted-foreground">Asistencias</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{currentSeason.matches_played as number}</p>
                  <p className="text-xs text-muted-foreground">Partidos</p>
                </div>
                {!!currentSeason.rating_avg && (
                  <div>
                    <p className="text-2xl font-bold text-primary">{(currentSeason.rating_avg as number).toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Valoración</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b flex gap-1 -mb-px">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  tab === t
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {t}
                {t === 'Pagos' && pendingPayments.length > 0 && (
                  <span className="ml-1.5 badge badge-destructive text-[10px] py-0">
                    {pendingPayments.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {tab === 'Datos' && <DatosTab player={player} />}
        {tab === 'Rendimiento' && <RendimientoTab playerId={player.id} />}
        {tab === 'Stats' && <StatsTab stats={stats} radarData={radarData} />}
        {tab === 'Lesiones' && <LesionesTab injuries={injuries} playerId={player.id} canAdd={canAddInjury} />}
        {tab === 'Pagos' && <PagosTab payments={payments} />}
        {tab === 'Documentos' && <DocumentosTab player={player} />}
        {tab === 'Observaciones' && (
          <ObservacionesTab observations={observations} playerId={player.id} authorName={authorName} />
        )}
      </div>
    </div>
  )
}

function DatosTab({ player }: { player: PlayerWithTeam }) {
  return (
    <>
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold">Datos deportivos</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Posición</dt>
              <dd className="font-medium">{player.position ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pie dominante</dt>
              <dd className="font-medium">{player.dominant_foot ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Altura</dt>
              <dd className="font-medium">{player.height_cm ? `${player.height_cm} cm` : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Peso</dt>
              <dd className="font-medium">{player.weight_kg ? `${player.weight_kg} kg` : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Dorsal</dt>
              <dd className="font-medium">{player.dorsal_number ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Equipo</dt>
              <dd className="font-medium">{player.teams?.name ?? '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="font-semibold">Datos personales</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Fecha nacimiento</dt>
              <dd className="font-medium">{player.birth_date ? formatDate(player.birth_date) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">DNI/NIE</dt>
              <dd className="font-medium">{player.dni ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nacionalidad</dt>
              <dd className="font-medium">{player.nationality ?? '—'}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold">Tutor principal</h3>
          <div className="space-y-2 text-sm">
            <p className="font-medium">{player.tutor_name ?? '—'}</p>
            {player.tutor_email && (
              <a href={`mailto:${player.tutor_email}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                <Mail className="w-3.5 h-3.5" />
                {player.tutor_email}
              </a>
            )}
            {player.tutor_phone && (
              <a href={`tel:${player.tutor_phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                <Phone className="w-3.5 h-3.5" />
                {player.tutor_phone}
              </a>
            )}
          </div>
        </div>

        {player.tutor2_name && (
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold">Tutor secundario</h3>
            <div className="space-y-2 text-sm">
              <p className="font-medium">{player.tutor2_name}</p>
              {player.tutor2_email && (
                <a href={`mailto:${player.tutor2_email}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                  <Mail className="w-3.5 h-3.5" />
                  {player.tutor2_email}
                </a>
              )}
            </div>
          </div>
        )}

        {player.notes && (
          <div className="card p-5 space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notas
            </h3>
            <p className="text-sm text-muted-foreground">{player.notes}</p>
          </div>
        )}
      </div>
    </>
  )
}

function StatsTab({
  stats,
  radarData,
}: {
  stats: Record<string, unknown>[]
  radarData: { subject: string; value: number }[]
}) {
  return (
    <>
      <div className="lg:col-span-2 card p-5">
        <h3 className="font-semibold mb-4">Rendimiento (temporada actual)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
            <Radar
              name="Jugador"
              dataKey="value"
              stroke="var(--color-primary)"
              fill="var(--color-primary)"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">Historial por temporada</h3>
        {stats.map((s) => (
          <div key={s.season as string} className="card p-4">
            <p className="font-medium text-sm mb-3">{s.season as string}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-center p-2 rounded-md bg-muted">
                <p className="text-lg font-bold text-primary">{s.goals as number}</p>
                <p className="text-xs text-muted-foreground">Goles</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted">
                <p className="text-lg font-bold text-primary">{s.assists as number}</p>
                <p className="text-xs text-muted-foreground">Asistencias</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted">
                <p className="text-lg font-bold">{s.matches_played as number}/{s.matches_available as number}</p>
                <p className="text-xs text-muted-foreground">Partidos</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted">
                <p className="text-lg font-bold">{s.yellow_cards as number} 🟨 {s.red_cards as number} 🟥</p>
                <p className="text-xs text-muted-foreground">Tarjetas</p>
              </div>
            </div>
          </div>
        ))}
        {stats.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin estadísticas registradas</p>
        )}
      </div>
    </>
  )
}

const INJURY_TYPES = ['Muscular', 'Esguince', 'Fractura', 'Contusión', 'Tendinitis', 'Otro']

function LesionesTab({ injuries, playerId, canAdd }: { injuries: Injury[]; playerId: string; canAdd: boolean }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [injuryType, setInjuryType] = useState('Muscular')
  const [injuryDesc, setInjuryDesc] = useState('')
  const [injuryDate, setInjuryDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Injury | null>(null)

  async function handleRecover(id: string) {
    const recoveredAt = prompt('Fecha de alta médica (AAAA-MM-DD):', new Date().toISOString().slice(0, 10))
    if (!recoveredAt) return
    const res = await updateInjury(id, { status: 'recovered', recovered_at: recoveredAt })
    if (res.success) router.refresh()
    else alert(res.error)
  }

  async function handleReopen(id: string) {
    const res = await updateInjury(id, { status: 'active', recovered_at: null })
    if (res.success) router.refresh()
    else alert(res.error)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta lesión del historial?')) return
    const res = await deleteInjury(id)
    if (res.success) router.refresh()
    else alert(res.error)
  }

  async function handleAddInjury() {
    setSaving(true)
    const res = await addInjury(playerId, { injury_type: injuryType, description: injuryDesc || undefined, injured_at: injuryDate })
    setSaving(false)
    if (res.success) {
      setShowForm(false)
      setInjuryDesc('')
    } else {
      alert(`Error: ${res.error}`)
    }
  }

  return (
    <div className="lg:col-span-3 card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Heart className="w-4 h-4 text-destructive" />
          Historial de lesiones
        </h3>
        {canAdd && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn-secondary gap-1.5 flex items-center text-sm">
            <Plus className="w-4 h-4" />
            Añadir lesión
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-muted/40 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Tipo de lesión</label>
              <select className="input w-full text-sm" value={injuryType} onChange={e => setInjuryType(e.target.value)}>
                {INJURY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Fecha inicio</label>
              <input type="date" className="input w-full text-sm" value={injuryDate} onChange={e => setInjuryDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Descripción (opcional)</label>
            <input className="input w-full text-sm" placeholder="Detalles..." value={injuryDesc} onChange={e => setInjuryDesc(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm flex-1">Cancelar</button>
            <button onClick={handleAddInjury} disabled={saving} className="btn-primary text-sm flex-1">
              {saving ? 'Guardando...' : 'Guardar lesión'}
            </button>
          </div>
        </div>
      )}

      {injuries.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground">Sin lesiones registradas</p>
      ) : injuries.length > 0 ? (
        <div className="space-y-3">
          {injuries.map((injury) => (
            <div
              key={injury.id}
              className={cn(
                'flex items-start gap-4 p-3 rounded-lg border',
                injury.status === 'active' ? 'border-warning bg-warning/5' : 'border-border'
              )}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{injury.injury_type ?? 'Lesión'}</p>
                  {injury.status === 'active' && (
                    <span className="badge-warning">Activa</span>
                  )}
                </div>
                {injury.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{injury.description}</p>
                )}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>{formatDate(injury.injured_at)}</p>
                {injury.recovered_at && (
                  <p className="text-success">Alta: {formatDate(injury.recovered_at)}</p>
                )}
              </div>
              {canAdd && (
                <div className="flex flex-col gap-1">
                  {injury.status === 'active' ? (
                    <button onClick={() => handleRecover(injury.id)} className="text-xs text-green-600 hover:underline" title="Marcar alta">
                      ✓ Alta
                    </button>
                  ) : (
                    <button onClick={() => handleReopen(injury.id)} className="text-xs text-yellow-600 hover:underline" title="Reabrir">
                      ↻ Reabrir
                    </button>
                  )}
                  <button onClick={() => setEditing(injury)} className="text-gray-400 hover:text-gray-700" title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(injury.id)} className="text-gray-400 hover:text-red-600" title="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {editing && (
        <InjuryEditModal
          injury={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function InjuryEditModal({ injury, onClose, onSaved }: { injury: Injury; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState(injury.injury_type ?? 'Muscular')
  const [desc, setDesc] = useState(injury.description ?? '')
  const [date, setDate] = useState(injury.injured_at?.slice(0, 10) ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await updateInjury(injury.id, { injury_type: type, description: desc || null, injured_at: date })
    setSaving(false)
    if (res.success) onSaved()
    else alert(res.error)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold">Editar lesión</h3>
        <div>
          <label className="text-xs font-medium block mb-1">Tipo</label>
          <select className="input w-full text-sm" value={type} onChange={e => setType(e.target.value)}>
            {INJURY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Fecha inicio</label>
          <input type="date" className="input w-full text-sm" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Descripción</label>
          <input className="input w-full text-sm" value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} disabled={saving} className="btn-ghost">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

function PagosTab({ payments }: { payments: QuotaPayment[] }) {
  const totalPending = payments
    .filter((p) => p.status === 'pending' || p.status === 'partial')
    .reduce((sum, p) => sum + (p.amount_due - p.amount_paid), 0)

  const PAYMENT_STATUS_COLORS: Record<string, string> = {
    paid: 'badge-success',
    pending: 'badge-destructive',
    partial: 'badge-warning',
    exempt: 'badge-muted',
  }
  const PAYMENT_STATUS_LABELS: Record<string, string> = {
    paid: 'Pagado',
    pending: 'Pendiente',
    partial: 'Parcial',
    exempt: 'Exento',
  }

  return (
    <div className="lg:col-span-3 card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Euro className="w-4 h-4" />
          Historial de pagos
        </h3>
        {totalPending > 0 && (
          <span className="badge-destructive font-medium">
            Pendiente: {formatCurrency(totalPending)}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-medium text-muted-foreground">Concepto</th>
              <th className="text-left py-2 font-medium text-muted-foreground">Fecha</th>
              <th className="text-right py-2 font-medium text-muted-foreground">Importe</th>
              <th className="text-right py-2 font-medium text-muted-foreground">Pagado</th>
              <th className="text-center py-2 font-medium text-muted-foreground">Estado</th>
              <th className="text-left py-2 font-medium text-muted-foreground">Forma pago</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="py-2">
                  {p.concept ?? (p.month ? `${getMonthName(p.month)} ${p.season}` : p.season)}
                </td>
                <td className="py-2 text-muted-foreground">
                  {p.payment_date ? formatDate(p.payment_date) : '—'}
                </td>
                <td className="py-2 text-right font-medium">{formatCurrency(p.amount_due)}</td>
                <td className="py-2 text-right">{formatCurrency(p.amount_paid)}</td>
                <td className="py-2 text-center">
                  <span className={cn('badge', PAYMENT_STATUS_COLORS[p.status])}>
                    {PAYMENT_STATUS_LABELS[p.status]}
                  </span>
                </td>
                <td className="py-2 text-muted-foreground capitalize">{p.payment_method ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">Sin pagos registrados</p>
        )}
      </div>
    </div>
  )
}

import { driveViewUrl, driveImageUrl } from '@/lib/utils/drive'

function DocRow({ label, url }: { label: string; url: string | null | undefined }) {
  const hasDoc = !!url
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-2 text-sm">
        {hasDoc
          ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
        <span className={hasDoc ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
      </div>
      {hasDoc && url && (
        <a
          href={driveViewUrl(url)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          Ver <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  )
}

function DocumentosTab({ player }: { player: PlayerWithTeam }) {
  const p = player as PlayerWithTeam & {
    photo_url?: string | null
    dni_front_url?: string | null
    dni_back_url?: string | null
    birth_cert_url?: string | null
    residency_cert_url?: string | null
    passport_url?: string | null
    nie_url?: string | null
    spanish_nationality?: boolean | null
  }

  const isSpanish = p.spanish_nationality !== false  // assume Spanish unless explicitly false
  const missingCount = [
    p.photo_url,
    p.dni_front_url,
    p.dni_back_url,
    isSpanish ? 'ok' : p.nie_url,
    isSpanish ? 'ok' : p.passport_url,
    p.birth_cert_url,
  ].filter(v => !v).length

  const photoDisplay = p.photo_url ? driveImageUrl(p.photo_url) : null

  return (
    <>
      {/* Photo + identity */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold">Foto y DNI</h3>

        {/* Photo preview */}
        {photoDisplay ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoDisplay}
            alt={`Foto de ${p.first_name}`}
            className="w-32 h-32 object-cover rounded-xl border shadow-sm"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center text-3xl font-bold text-muted-foreground border">
            {p.first_name.charAt(0)}{p.last_name.charAt(0)}
          </div>
        )}

        <DocRow label="Foto jugador" url={p.photo_url} />
        <DocRow label="DNI cara 1" url={p.dni_front_url} />
        <DocRow label="DNI cara 2 / Libro familia" url={p.dni_back_url} />
        {!isSpanish && <DocRow label="NIE" url={p.nie_url} />}
        {!isSpanish && <DocRow label="Pasaporte" url={p.passport_url} />}
      </div>

      {/* Certificates */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold">Certificados</h3>
        <DocRow label="Certificado de nacimiento" url={p.birth_cert_url} />
        <DocRow label="Cert. empadronamiento" url={p.residency_cert_url} />
        {p.forms_link && (
          <a href={p.forms_link} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <ExternalLink className="w-3 h-3" /> Formulario inscripción
          </a>
        )}

        {/* Nationality tag */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-1">Nacionalidad española</p>
          <span className={cn('badge', p.spanish_nationality === true ? 'badge-success' : p.spanish_nationality === false ? 'badge-warning' : 'badge-muted')}>
            {p.spanish_nationality === true ? 'Sí' : p.spanish_nationality === false ? 'No' : 'Sin confirmar'}
          </span>
        </div>

        {/* Request docs button */}
        {missingCount > 0 && p.tutor_email && (
          <a
            href={`mailto:${p.tutor_email}?subject=Documentación pendiente - ${p.first_name} ${p.last_name}&body=Estimada familia,%0D%0A%0D%0AEn el club tenemos pendiente recibir la documentación de ${p.first_name} ${p.last_name}.%0D%0APor favor, envíe los documentos solicitados.%0D%0A%0D%0AUn saludo,%0D%0AE.F. Ciudad de Getafe`}
            className="flex items-center gap-2 w-full justify-center px-3 py-2 rounded-lg text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors mt-2"
          >
            <Send className="w-4 h-4" />
            Solicitar {missingCount} documento{missingCount !== 1 ? 's' : ''} por email
          </a>
        )}
        {missingCount > 0 && !p.tutor_email && (
          <p className="text-xs text-muted-foreground mt-2">
            Sin email de tutor — sincroniza desde Google Sheets para obtenerlo.
          </p>
        )}
      </div>

      {/* Email tracking */}
      <div className="card p-5">
        <h3 className="font-semibold mb-4">Emails de gestión</h3>
        <div className="space-y-0">
          {[
            { label: 'Asignación de equipo', sent: p.email_team_assignment_sent },
            { label: 'Solicitar documentos',  sent: p.email_request_docs_sent },
            { label: 'Rellenar formulario',   sent: p.email_fill_form_sent },
            { label: 'Admisión confirmada',   sent: p.email_admitted_sent },
          ].map((e) => (
            <div key={e.label} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <span className="text-sm">{e.label}</span>
              <span className={cn('badge', e.sent ? 'badge-muted' : 'badge-warning')}>
                {e.sent ? 'Enviado' : 'Pendiente'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

const OBS_CATEGORIES = ['Técnica', 'Táctica', 'Física', 'Actitud', 'Psicológica', 'Otro']

function ObservacionesTab({
  observations,
  playerId,
  authorName,
}: {
  observations: Observation[]
  playerId: string
  authorName: string
}) {
  const [category, setCategory] = useState('Técnica')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [localObs, setLocalObs] = useState<Observation[]>(observations)

  async function handleAdd() {
    if (!comment.trim()) return
    setSaving(true)
    const res = await addPlayerObservation(playerId, { category, comment: comment.trim(), author_name: authorName })
    setSaving(false)
    if (res.success) {
      const newObs: Observation = {
        id: Date.now().toString(),
        category,
        comment: comment.trim(),
        author_name: authorName,
        created_at: new Date().toISOString(),
      }
      setLocalObs(prev => [newObs, ...prev])
      setComment('')
    } else {
      alert(`Error: ${res.error}`)
    }
  }

  return (
    <div className="lg:col-span-3 card p-5 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        Observaciones
      </h3>

      {/* Add form */}
      <div className="bg-muted/40 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="text-xs font-medium block mb-1">Categoría</label>
            <select className="input w-full text-sm" value={category} onChange={e => setCategory(e.target.value)}>
              {OBS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium block mb-1">Observación</label>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="Escribe una observación..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              />
              <button
                onClick={handleAdd}
                disabled={saving || !comment.trim()}
                className="btn-primary text-sm px-3"
              >
                {saving ? '...' : 'Añadir'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      {localObs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin observaciones aún</p>
      ) : (
        <div className="space-y-3">
          {localObs.map(obs => (
            <ObservationRow
              key={obs.id}
              obs={obs}
              onEdited={(updated) => setLocalObs(prev => prev.map(o => o.id === updated.id ? updated : o))}
              onDeleted={(id) => setLocalObs(prev => prev.filter(o => o.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ObservationRow({
  obs,
  onEdited,
  onDeleted,
}: {
  obs: Observation
  onEdited: (o: Observation) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(obs.comment)
  const [editCat, setEditCat] = useState(obs.category)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const res = await updatePlayerObservation(obs.id, { category: editCat, comment: editText.trim() })
    setBusy(false)
    if (res.success) {
      onEdited({ ...obs, category: editCat, comment: editText.trim() })
      setEditing(false)
    } else alert(res.error)
  }

  async function remove() {
    if (!confirm('¿Eliminar esta observación?')) return
    setBusy(true)
    const res = await deletePlayerObservation(obs.id)
    setBusy(false)
    if (res.success) onDeleted(obs.id)
    else alert(res.error)
  }

  return (
    <div className="flex gap-3 p-3 rounded-lg border">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          {editing ? (
            <select className="input text-xs py-1" value={editCat} onChange={e => setEditCat(e.target.value)}>
              {OBS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <span className="badge-muted text-xs">{obs.category}</span>
          )}
          {obs.author_name && (
            <span className="text-xs text-muted-foreground">{obs.author_name}</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {new Date(obs.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
        </div>
        {editing ? (
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            rows={2}
            className="input w-full text-sm mt-1"
          />
        ) : (
          <p className="text-sm">{obs.comment}</p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {editing ? (
          <>
            <button onClick={save} disabled={busy} className="text-xs text-green-600 hover:underline">Guardar</button>
            <button onClick={() => { setEditing(false); setEditText(obs.comment); setEditCat(obs.category) }} className="text-xs text-gray-500 hover:underline">Cancelar</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-700" title="Editar">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={remove} disabled={busy} className="text-gray-400 hover:text-red-600" title="Eliminar">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function RendimientoTab({ playerId }: { playerId: string }) {
  const [data, setData] = useState<PlayerPerformance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      const res = await getPlayerPerformance(playerId)
      if (!mounted) return
      if (res.success && res.data) setData(res.data)
      else setError(res.error ?? 'Error cargando rendimiento')
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [playerId])

  if (loading) {
    return (
      <div className="lg:col-span-3 card p-8 text-center text-muted-foreground text-sm">
        Cargando rendimiento…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="lg:col-span-3 card p-8 text-center text-sm text-destructive">
        {error ?? 'Sin datos'}
      </div>
    )
  }

  const pctColor = (p: number) =>
    p >= 80 ? 'text-green-600' : p >= 60 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="lg:col-span-3 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Temporada {data.season}
        </h3>
      </div>

      {/* Fila 1: Asistencia + Minutos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Asistencia entrenamientos</p>
              <p className={cn('text-3xl font-bold mt-1', pctColor(data.attendance_pct))}>
                {data.attendance_pct}%
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{data.trainings_attended} / {data.trainings_scheduled}</p>
              <p>sesiones</p>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                data.attendance_pct >= 80 ? 'bg-green-500'
                  : data.attendance_pct >= 60 ? 'bg-amber-500'
                  : 'bg-red-500'
              )}
              style={{ width: `${Math.min(100, data.attendance_pct)}%` }}
            />
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span><span className="font-medium text-green-600">{data.trainings_attended}</span> presentes</span>
            <span><span className="font-medium text-amber-600">{data.trainings_justified}</span> justificados</span>
            <span><span className="font-medium text-red-600">{data.trainings_absent}</span> ausentes</span>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Minutos jugados (partidos)</p>
              <p className="text-3xl font-bold mt-1">{data.minutes_played}<span className="text-base font-normal text-muted-foreground"> min</span></p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{data.matches_played} / {data.matches_team_total}</p>
              <p>partidos</p>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, data.minutes_pct)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            <span className={cn('font-medium', pctColor(data.minutes_pct))}>{data.minutes_pct}%</span> de los minutos posibles en los partidos que disputó
          </p>
        </div>
      </div>

      {/* Fila 2: Acciones ofensivas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatBox label="Goles" value={data.goals} accent="text-green-600" />
        <StatBox label="Asistencias" value={data.assists} accent="text-blue-600" />
        <StatBox label="Amarillas" value={data.yellow_cards} accent="text-amber-500" />
        <StatBox label="Rojas" value={data.red_cards} accent="text-red-600" />
        <StatBox
          label="Valoración"
          value={data.rating_avg != null ? `${data.rating_avg.toFixed(1)}/10` : '—'}
          accent="text-primary"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Datos agregados de las sesiones registradas. Los minutos se cuentan en los partidos donde el jugador
        tuvo al menos 1 minuto; el % compara sobre 90 min por partido jugado.
      </p>
    </div>
  )
}

function StatBox({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', accent)}>{value}</p>
    </div>
  )
}
