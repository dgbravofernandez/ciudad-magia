'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  UserCircle2, Users, ClipboardList, Plus, X, Shield, UserPlus, Send
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import {
  assignCoachToTeam, removeCoachFromTeam,
  assignCoordinatorToTeam, removeCoordinatorFromTeam,
  sendCoachInvitation,
} from '@/features/entrenadores/actions/coach.actions'
import { driveImageUrl } from '@/lib/utils/drive'

type CoachWithDetails = {
  id: string
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  active: boolean
  roles: string[]
  teams: { id: string; name: string }[]
  coordinatorTeams: { id: string; name: string }[]
  sessionCount: number
  form_sent: boolean
  form_sent_at: string | null
}

const ROLE_LABELS: Record<string, string> = {
  entrenador: 'Entrenador/a',
  coordinador: 'Coordinador/a',
  director_deportivo: 'Director Deportivo',
  fisio: 'Fisioterapeuta',
  admin: 'Admin',
  direccion: 'Dirección',
}

const ROLE_COLORS: Record<string, string> = {
  entrenador: 'bg-primary/15 text-primary',
  coordinador: 'bg-amber-100 text-amber-700',
  director_deportivo: 'bg-purple-100 text-purple-700',
}

export function CoachesGrid({
  coaches,
  allTeams,
  isAdmin,
  clubId,
}: {
  coaches: CoachWithDetails[]
  allTeams: { id: string; name: string }[]
  isAdmin: boolean
  clubId?: string
}) {
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [isSendingInvite, startInviteTransition] = useTransition()

  const filtered = coaches.filter(c => {
    const name = c.full_name.toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = !filterRole || c.roles.includes(filterRole)
    return matchSearch && matchRole
  })

  function handleSendInvite() {
    if (!inviteEmail.trim()) { toast.error('Introduce un email'); return }
    startInviteTransition(async () => {
      const r = await sendCoachInvitation(inviteEmail.trim(), inviteName.trim() || undefined)
      if (r.success) {
        toast.success(r.emailSent ? `Formulario enviado a ${inviteEmail}` : 'Guardado (sin email disponible)')
        setShowInviteModal(false)
        setInviteEmail('')
        setInviteName('')
      } else {
        toast.error(r.error ?? 'Error al enviar')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold">Cuerpo técnico</h2>
          <span className="text-sm text-muted-foreground">{coaches.length} miembro{coaches.length !== 1 ? 's' : ''}</span>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <UserPlus className="w-4 h-4" />
            Inscribir entrenador
          </button>
        )}
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) setShowInviteModal(false) }}>
          <div className="card p-6 w-full max-w-md mx-4 space-y-4">
            <h3 className="font-semibold text-lg">Inscribir nuevo entrenador</h3>
            <p className="text-sm text-muted-foreground">Se enviará el formulario de inscripción del cuerpo técnico al email indicado.</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Email *</label>
                <input
                  className="input w-full"
                  type="email"
                  placeholder="entrenador@email.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendInvite()}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Nombre (opcional)</label>
                <input
                  className="input w-full"
                  placeholder="Nombre completo"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowInviteModal(false)} className="btn-secondary text-sm">Cancelar</button>
              <button
                onClick={handleSendInvite}
                disabled={isSendingInvite || !inviteEmail.trim()}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                {isSendingInvite ? 'Enviando...' : 'Enviar formulario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <input
          className="input flex-1 min-w-48"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="input w-auto"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
        >
          <option value="">Todos los roles</option>
          <option value="entrenador">Entrenadores</option>
          <option value="coordinador">Coordinadores</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(coach => (
          <CoachCard
            key={coach.id}
            coach={coach}
            allTeams={allTeams}
            isAdmin={isAdmin}
            clubId={clubId}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card p-12 text-center text-muted-foreground">
          No se encontraron entrenadores
        </div>
      )}
    </div>
  )
}

function CoachCard({
  coach,
  allTeams,
  isAdmin,
  clubId: _clubId,
}: {
  coach: CoachWithDetails
  allTeams: { id: string; name: string }[]
  isAdmin: boolean
  clubId?: string
}) {
  const [showAssign, setShowAssign] = useState<'coach' | 'coord' | null>(null)
  const [isPending, startTransition] = useTransition()
  const [imgError, setImgError] = useState(false)
  const isCoordinator = coach.roles.includes('coordinador') || coach.roles.includes('director_deportivo')

  function handleAssign(teamId: string, type: 'coach' | 'coord') {
    startTransition(async () => {
      const r = type === 'coach'
        ? await assignCoachToTeam(coach.id, teamId)
        : await assignCoordinatorToTeam(coach.id, teamId)
      if (r.success) toast.success(type === 'coach' ? 'Equipo de entrenamiento asignado' : 'Coordinación asignada')
      else toast.error(r.error ?? 'Error')
      setShowAssign(null)
    })
  }

  function handleRemoveCoach(teamId: string) {
    if (!confirm('¿Quitar este equipo del entrenador?')) return
    startTransition(async () => {
      const r = await removeCoachFromTeam(coach.id, teamId)
      if (r.success) toast.success('Equipo eliminado')
      else toast.error(r.error ?? 'Error')
    })
  }

  function handleRemoveCoord(teamId: string) {
    if (!confirm('¿Quitar este equipo de la coordinación?')) return
    startTransition(async () => {
      const r = await removeCoordinatorFromTeam(coach.id, teamId)
      if (r.success) toast.success('Equipo eliminado de coordinación')
      else toast.error(r.error ?? 'Error')
    })
  }

  const assignableCoachTeams = allTeams.filter(t => !coach.teams.some(ct => ct.id === t.id))
  const assignableCoordTeams = allTeams.filter(t => !coach.coordinatorTeams.some(ct => ct.id === t.id))

  return (
    <div className={cn('card p-5 flex flex-col gap-4', !coach.active && 'opacity-60')}>
      {/* Header: avatar + name + roles */}
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {coach.avatar_url && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={driveImageUrl(coach.avatar_url)}
              alt={coach.full_name}
              className="rounded-full object-cover w-14 h-14"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <UserCircle2 className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/entrenadores/staff/${coach.id}`} className="font-semibold hover:underline truncate block">
            {coach.full_name}
          </Link>
          <p className="text-xs text-muted-foreground truncate">{coach.email}</p>
          {coach.phone && <p className="text-xs text-muted-foreground">{coach.phone}</p>}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {coach.roles.map(r => (
              <span key={r} className={cn('badge text-xs', ROLE_COLORS[r] ?? 'bg-muted text-muted-foreground')}>
                {ROLE_LABELS[r] ?? r}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-muted/40 rounded-lg p-2 text-center">
          <p className="text-lg font-bold">{coach.teams.length}</p>
          <p className="text-xs text-muted-foreground">Equipo{coach.teams.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-2 text-center">
          <p className="text-lg font-bold">{coach.sessionCount}</p>
          <p className="text-xs text-muted-foreground">Sesiones</p>
        </div>
      </div>

      {/* Coach teams */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" /> Entrena
          </p>
          {isAdmin && assignableCoachTeams.length > 0 && (
            <button
              onClick={() => setShowAssign(showAssign === 'coach' ? null : 'coach')}
              disabled={isPending}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
        {coach.teams.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {coach.teams.map(t => (
              <span key={t.id} className="flex items-center gap-1 badge bg-primary/10 text-primary text-xs">
                {t.name}
                {isAdmin && (
                  <button onClick={() => handleRemoveCoach(t.id)} disabled={isPending} className="hover:text-destructive transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Sin equipos</p>
        )}
        {showAssign === 'coach' && assignableCoachTeams.length > 0 && (
          <div className="mt-1.5 border rounded-md bg-background shadow-md max-h-36 overflow-y-auto">
            {assignableCoachTeams.map(t => (
              <button key={t.id} onClick={() => handleAssign(t.id, 'coach')} disabled={isPending}
                className="w-full text-left text-xs px-3 py-2 hover:bg-muted transition-colors">
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Coordinator teams — always show for admin, or if already coordinator */}
      {(isAdmin || isCoordinator || coach.coordinatorTeams.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Shield className="w-3 h-3" /> Coordina
            </p>
            {isAdmin && assignableCoordTeams.length > 0 && (
              <button
                onClick={() => setShowAssign(showAssign === 'coord' ? null : 'coord')}
                disabled={isPending}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
          {coach.coordinatorTeams.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {coach.coordinatorTeams.map(t => (
                <span key={t.id} className="flex items-center gap-1 badge bg-amber-100 text-amber-700 text-xs">
                  {t.name}
                  {isAdmin && (
                    <button onClick={() => handleRemoveCoord(t.id)} disabled={isPending} className="hover:text-destructive transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Sin equipos coordinados</p>
          )}
          {showAssign === 'coord' && assignableCoordTeams.length > 0 && (
            <div className="mt-1.5 border rounded-md bg-background shadow-md max-h-36 overflow-y-auto">
              {assignableCoordTeams.map(t => (
                <button key={t.id} onClick={() => handleAssign(t.id, 'coord')} disabled={isPending}
                  className="w-full text-left text-xs px-3 py-2 hover:bg-muted transition-colors">
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t">
        <Link
          href={`/entrenadores/staff/${coach.id}`}
          className="btn-secondary text-xs flex items-center gap-1 flex-1 justify-center"
        >
          <ClipboardList className="w-3.5 h-3.5" /> Ver ficha
        </Link>
      </div>
    </div>
  )
}
