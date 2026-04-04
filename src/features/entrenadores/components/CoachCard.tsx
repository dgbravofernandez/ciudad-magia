'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { driveImageUrl } from '@/lib/utils/drive'
import {
  UserCircle2, ArrowLeft, Mail, Phone, Shield,
  Users, Calendar, Trophy, FileText, CheckCircle2, XCircle,
  Plus, X, ClipboardList, Star, BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import {
  assignCoachToTeam, removeCoachFromTeam,
  assignCoordinatorToTeam, removeCoordinatorFromTeam,
} from '@/features/entrenadores/actions/coach.actions'

type TeamAssignment = {
  team_id: string
  role: string
  teams: { id: string; name: string; categories?: { name: string } | null } | null
}

type CoordAssignment = {
  team_id: string
  teams: { id: string; name: string; categories?: { name: string } | null } | null
}

type Session = {
  id: string
  session_type: string
  session_date: string
  opponent: string | null
  score_home: number | null
  score_away: number | null
  team_id: string
  teams?: { name: string } | null
}

type Observation = {
  id: string
  team_id: string
  nivel_rating: number | null
  ajeno_rating: number | null
  notes: string | null
  created_at: string
  period: string | null
  season: string | null
  teams?: { name: string } | null
}

const TABS = ['Datos', 'Equipos', 'Evaluaciones', 'Historial', 'Documentos'] as const
type Tab = (typeof TABS)[number]

const ROLE_LABELS: Record<string, string> = {
  entrenador: 'Entrenador/a',
  coordinador: 'Coordinador/a',
  director_deportivo: 'Director/a Deportivo/a',
  fisio: 'Fisioterapeuta',
  admin: 'Administrador/a',
  direccion: 'Dirección',
  infancia: 'Dpto. Infancia',
  redes: 'Redes Sociales',
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  training: 'Entrenamiento',
  match: 'Partido',
  friendly: 'Amistoso',
  tournament: 'Torneo',
}

const PERIOD_LABELS: Record<string, string> = {
  P1: 'Período 1 (Sep–Dic)',
  P2: 'Período 2 (Ene–Mar)',
  P3: 'Período 3 (Abr–Jun)',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function RatingStars({ value, max = 5 }: { value: number | null; max?: number }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} className={cn('w-3 h-3', i < value ? 'text-amber-400 fill-amber-400' : 'text-muted')} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{value}/{max}</span>
    </span>
  )
}

export function CoachCard({
  member,
  roles,
  teamAssignments,
  coordAssignments,
  sessions,
  observations,
  allTeams,
  isAdmin,
  clubId: _clubId,
}: {
  member: Record<string, unknown>
  roles: { role: string; team_id: string | null }[]
  teamAssignments: TeamAssignment[]
  coordAssignments: CoordAssignment[]
  sessions: Session[]
  observations: Observation[]
  allTeams: { id: string; name: string }[]
  isAdmin: boolean
  clubId?: string
}) {
  const [tab, setTab] = useState<Tab>('Datos')
  const [showAssign, setShowAssign] = useState<'coach' | 'coord' | null>(null)
  const [isPending, startTransition] = useTransition()
  const [photoError, setPhotoError] = useState(false)

  const memberRoleNames = [...new Set(roles.map(r => r.role))]
  const isCoordinator = memberRoleNames.some(r => ['coordinador', 'director_deportivo'].includes(r))

  const assignedCoachTeamIds = new Set(teamAssignments.map(t => t.team_id))
  const assignedCoordTeamIds = new Set(coordAssignments.map(t => t.team_id))
  const assignableCoachTeams = allTeams.filter(t => !assignedCoachTeamIds.has(t.id))
  const assignableCoordTeams = allTeams.filter(t => !assignedCoordTeamIds.has(t.id))

  const trainingCount = sessions.filter(s => s.session_type === 'training').length
  const matchCount = sessions.filter(s => s.session_type !== 'training').length

  // Group observations by season + period
  const obsBySeasonPeriod: Record<string, Observation[]> = {}
  for (const o of observations) {
    const key = `${o.season ?? 'Sin temporada'}|${o.period ?? 'Sin período'}`
    if (!obsBySeasonPeriod[key]) obsBySeasonPeriod[key] = []
    obsBySeasonPeriod[key].push(o)
  }

  function handleAssign(teamId: string, type: 'coach' | 'coord') {
    startTransition(async () => {
      const r = type === 'coach'
        ? await assignCoachToTeam(member.id as string, teamId)
        : await assignCoordinatorToTeam(member.id as string, teamId)
      if (r.success) toast.success(type === 'coach' ? 'Equipo de entrenamiento asignado' : 'Coordinación asignada')
      else toast.error(r.error ?? 'Error')
      setShowAssign(null)
    })
  }

  function handleRemoveCoach(teamId: string) {
    if (!confirm('¿Quitar este equipo del entrenador?')) return
    startTransition(async () => {
      const r = await removeCoachFromTeam(member.id as string, teamId)
      if (r.success) toast.success('Equipo eliminado')
      else toast.error(r.error ?? 'Error')
    })
  }

  function handleRemoveCoord(teamId: string) {
    if (!confirm('¿Quitar este equipo de la coordinación?')) return
    startTransition(async () => {
      const r = await removeCoordinatorFromTeam(member.id as string, teamId)
      if (r.success) toast.success('Equipo eliminado de coordinación')
      else toast.error(r.error ?? 'Error')
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/entrenadores/staff" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver al cuerpo técnico
      </Link>

      {/* Profile header */}
      <div className="card p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="shrink-0">
            {member.avatar_url && !photoError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={driveImageUrl(member.avatar_url as string)}
                alt={member.full_name as string}
                className="rounded-full object-cover w-24 h-24"
                onError={() => setPhotoError(true)}
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                <UserCircle2 className="w-14 h-14 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{member.full_name as string}</h1>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {memberRoleNames.map(r => (
                <span key={r} className={cn('badge text-xs',
                  r === 'coordinador' ? 'bg-amber-100 text-amber-700' :
                  r === 'director_deportivo' ? 'bg-purple-100 text-purple-700' :
                  'bg-primary/15 text-primary')}>
                  {ROLE_LABELS[r] ?? r}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" />{member.email as string}</span>
              {(member.phone as string | null) && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" />{member.phone as string}</span>}
            </div>
          </div>
          <div className="flex gap-3 text-center">
            <div className="bg-muted/40 rounded-lg px-4 py-2">
              <p className="text-xl font-bold">{teamAssignments.length}</p>
              <p className="text-xs text-muted-foreground">Entrena</p>
            </div>
            {isCoordinator && (
              <div className="bg-amber-50 rounded-lg px-4 py-2">
                <p className="text-xl font-bold text-amber-700">{coordAssignments.length}</p>
                <p className="text-xs text-amber-600">Coordina</p>
              </div>
            )}
            <div className="bg-muted/40 rounded-lg px-4 py-2">
              <p className="text-xl font-bold">{trainingCount}</p>
              <p className="text-xs text-muted-foreground">Entrenos</p>
            </div>
            <div className="bg-muted/40 rounded-lg px-4 py-2">
              <p className="text-xl font-bold">{matchCount}</p>
              <p className="text-xs text-muted-foreground">Partidos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.filter(t => t !== 'Evaluaciones' || isCoordinator || observations.length > 0).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Datos ── */}
      {tab === 'Datos' && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Información personal</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow icon={<UserCircle2 className="w-4 h-4" />} label="Nombre completo" value={member.full_name as string} />
            <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={member.email as string} />
            <InfoRow icon={<Phone className="w-4 h-4" />} label="Teléfono" value={(member.phone as string) ?? '—'} />
            <InfoRow icon={<Shield className="w-4 h-4" />} label="Roles" value={memberRoleNames.map(r => ROLE_LABELS[r] ?? r).join(', ')} />
          </div>
        </div>
      )}

      {/* ── Equipos ── */}
      {tab === 'Equipos' && (
        <div className="space-y-4">
          {/* Coaching teams */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Users className="w-4 h-4" /> Equipos que entrena
              </h3>
              {isAdmin && assignableCoachTeams.length > 0 && (
                <button onClick={() => setShowAssign(showAssign === 'coach' ? null : 'coach')}
                  className="btn-secondary text-xs flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Asignar equipo
                </button>
              )}
            </div>
            {showAssign === 'coach' && (
              <div className="border rounded-lg overflow-hidden mb-3">
                {assignableCoachTeams.map(t => (
                  <button key={t.id} onClick={() => handleAssign(t.id, 'coach')} disabled={isPending}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors border-b last:border-0">
                    {t.name}
                  </button>
                ))}
              </div>
            )}
            {teamAssignments.length > 0 ? (
              <div className="space-y-2">
                {teamAssignments.map(ta => (
                  <div key={ta.team_id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{ta.teams?.name ?? '—'}</p>
                        {ta.teams?.categories?.name && <p className="text-xs text-muted-foreground">{ta.teams.categories.name}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/entrenadores?team=${ta.team_id}`} className="text-xs text-primary hover:underline">Ver equipo</Link>
                      {isAdmin && (
                        <button onClick={() => handleRemoveCoach(ta.team_id)} disabled={isPending}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Sin equipos asignados.</p>
            )}
          </div>

          {/* Coordinator teams */}
          {(isCoordinator || coordAssignments.length > 0 || isAdmin) && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Equipos que coordina
                </h3>
                {isAdmin && assignableCoordTeams.length > 0 && (
                  <button onClick={() => setShowAssign(showAssign === 'coord' ? null : 'coord')}
                    className="btn-secondary text-xs flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Asignar coordinación
                  </button>
                )}
              </div>
              {showAssign === 'coord' && (
                <div className="border rounded-lg overflow-hidden mb-3">
                  {assignableCoordTeams.map(t => (
                    <button key={t.id} onClick={() => handleAssign(t.id, 'coord')} disabled={isPending}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors border-b last:border-0">
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              {coordAssignments.length > 0 ? (
                <div className="space-y-2">
                  {coordAssignments.map(ca => (
                    <div key={ca.team_id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-amber-600" />
                        <div>
                          <p className="font-medium text-sm">{ca.teams?.name ?? '—'}</p>
                          {ca.teams?.categories?.name && <p className="text-xs text-amber-600/70">{ca.teams.categories.name}</p>}
                        </div>
                      </div>
                      {isAdmin && (
                        <button onClick={() => handleRemoveCoord(ca.team_id)} disabled={isPending}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Sin equipos de coordinación asignados.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Evaluaciones ── */}
      {tab === 'Evaluaciones' && (
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Evaluaciones por período
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Períodos: P1 (Sep–Dic) · P2 (Ene–Mar) · P3 (Abr–Jun). Las evaluaciones las realiza el coordinador desde la sección Observaciones.
            </p>
            {observations.length > 0 ? (
              <div className="space-y-6">
                {Object.entries(obsBySeasonPeriod).map(([key, obs]) => {
                  const [season, period] = key.split('|')
                  const avgNivel = obs.reduce((acc, o) => acc + (o.nivel_rating ?? 0), 0) / obs.filter(o => o.nivel_rating).length
                  const avgAjeno = obs.reduce((acc, o) => acc + (o.ajeno_rating ?? 0), 0) / obs.filter(o => o.ajeno_rating).length
                  return (
                    <div key={key} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-sm">{PERIOD_LABELS[period] ?? period}</p>
                          <p className="text-xs text-muted-foreground">{season}</p>
                        </div>
                        <div className="flex gap-4 text-right">
                          <div>
                            <p className="text-xs text-muted-foreground">Nivel prom.</p>
                            <RatingStars value={isNaN(avgNivel) ? null : Math.round(avgNivel)} />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Ajeno prom.</p>
                            <RatingStars value={isNaN(avgAjeno) ? null : Math.round(avgAjeno)} />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {obs.map(o => (
                          <div key={o.id} className="pl-3 border-l-2 border-muted">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium">{o.teams?.name ?? 'Equipo'}</p>
                              <div className="flex gap-3">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  Nivel: <RatingStars value={o.nivel_rating} />
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  Ajeno: <RatingStars value={o.ajeno_rating} />
                                </span>
                              </div>
                            </div>
                            {o.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{o.notes}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Sin evaluaciones registradas aún.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Historial ── */}
      {tab === 'Historial' && (
        <div className="card p-6">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Sesiones registradas ({sessions.length})
          </h3>
          {sessions.length > 0 ? (
            <div className="space-y-2">
              {sessions.map(s => (
                <Link
                  key={s.id}
                  href={s.session_type === 'training' ? `/entrenadores/sesiones/${s.id}` : `/entrenadores/partidos/${s.id}`}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {s.session_type === 'training' ? (
                      <ClipboardList className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {SESSION_TYPE_LABELS[s.session_type] ?? s.session_type}
                        {s.opponent ? ` vs ${s.opponent}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.teams?.name ?? '—'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{formatDate(s.session_date)}</p>
                    {s.session_type !== 'training' && s.score_home !== null && (
                      <p className="text-sm font-semibold">{s.score_home} - {s.score_away}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sin sesiones registradas todavía.</p>
          )}
        </div>
      )}

      {/* ── Documentos ── */}
      {tab === 'Documentos' && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Documentación del cuerpo técnico</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DocRow label="DNI / NIE" url={member.doc_dni_url as string | null} />
            <DocRow label="Cert. antecedentes penales" url={member.doc_antecedentes_url as string | null} />
            <DocRow label="Cert. delitos sexuales" url={member.doc_delitos_sexuales_url as string | null} />
            <DocRow label="Licencia federativa" url={member.doc_licencia_url as string | null} />
            <DocRow label="Titulación UEFA / RFEF" url={member.doc_titulacion_url as string | null} />
            <DocRow label="Contrato / Voluntariado" url={member.doc_contrato_url as string | null} />
          </div>
          <p className="text-xs text-muted-foreground">
            Los documentos se sincronizan desde Google Sheets al hacer &ldquo;Sync Entrenadores&rdquo;.
          </p>
        </div>
      )}
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.JSX.Element; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

function DocRow({ label, url }: { label: string; url?: string | null }) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Ver
        </a>
      ) : (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5" /> Sin subir
        </span>
      )}
    </div>
  )
}
