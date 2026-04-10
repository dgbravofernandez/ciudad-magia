'use client'

import { useState, useMemo, useTransition, useRef, useEffect } from 'react'
import { Search, Send, CheckCircle2, XCircle, Clock, ChevronDown, UserX, RefreshCw, RotateCcw, Download, ArrowUpDown, Copy, Link2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Player } from '@/types/database.types'
import {
  updateInscriptionStatus,
  sendEmail,
  dismissPlayerInscription,
  resetEmailFlag,
  sendTrialLetter,
} from '@/features/jugadores/actions/player.actions'
import {
  previewInscriptionSync,
  applyInscriptionSync,
  previewCoachSync,
  applyCoachSync,
} from '@/features/jugadores/actions/sync-inscriptions.actions'
import { INSCRIPTIONS_SHEET_ID, COACHES_SHEET_ID, COACHES_GID } from '@/features/jugadores/constants'
import { toast } from 'sonner'
import Link from 'next/link'

type PlayerWithTeam = Player & {
  teams?: { id: string; name: string } | null
  next_team?: { id: string; name: string } | null
}

type InscriptionStatus = 'pending' | 'continuing' | 'dismissed'

function getStatus(p: PlayerWithTeam): InscriptionStatus {
  if (p.wants_to_continue === false) return 'dismissed'
  if (p.meets_requirements === false) return 'dismissed'
  if (p.made_reservation === false) return 'dismissed'
  if (p.wants_to_continue === null) return 'pending'
  return 'continuing'
}

const STATUS_LABEL: Record<InscriptionStatus, string> = {
  pending: 'Pendiente',
  continuing: 'Continúa',
  dismissed: 'Baja',
}

const STATUS_BADGE: Record<InscriptionStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  continuing: 'bg-success/15 text-success',
  dismissed: 'bg-destructive/15 text-destructive',
}

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers, ...rows.map(r => headers.map(h => {
    const v = r[h] ?? ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }))].map(row => row.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function InscripcionesTable({
  players,
  teams,
  coachMap = {},
  isAdmin = false,
  trialLetterPlayerIds = [],
}: {
  players: PlayerWithTeam[]
  teams: { id: string; name: string }[]
  coachMap?: Record<string, string>
  isAdmin?: boolean
  trialLetterPlayerIds?: string[]
}) {
  const [search, setSearch] = useState('')
  const [filterTeam, setFilterTeam] = useState('')
  const [filterStatus, setFilterStatus] = useState<'' | InscriptionStatus>('')
  const [sortDate, setSortDate] = useState<'newest' | 'oldest' | ''>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [syncingCoaches, setSyncingCoaches] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [trialLetterIds, setTrialLetterIds] = useState<Set<string>>(new Set(trialLetterPlayerIds))
  const [trialModalPlayer, setTrialModalPlayer] = useState<PlayerWithTeam | null>(null)
  const [trialClub, setTrialClub] = useState('')
  const [trialDate, setTrialDate] = useState('')
  const [sendingTrial, setSendingTrial] = useState(false)

  const stats = useMemo(() => {
    const counts = { pending: 0, continuing: 0, dismissed: 0, total: players.length }
    players.forEach(p => counts[getStatus(p)]++)
    return counts
  }, [players])

  const filtered = useMemo(() => {
    const result = players.filter(p => {
      const name = `${p.first_name} ${p.last_name}`.toLowerCase()
      const status = getStatus(p)
      return (
        (!search ||
          name.includes(search.toLowerCase()) ||
          p.tutor_name?.toLowerCase().includes(search.toLowerCase()) ||
          p.tutor_email?.toLowerCase().includes(search.toLowerCase())) &&
        (!filterTeam || p.team_id === filterTeam) &&
        (!filterStatus || status === filterStatus)
      )
    })
    if (sortDate) {
      result.sort((a, b) => {
        const da = new Date(a.updated_at).getTime()
        const db = new Date(b.updated_at).getTime()
        return sortDate === 'newest' ? db - da : da - db
      })
    }
    return result
  }, [players, search, filterTeam, filterStatus, sortDate])

  const selectableIds = useMemo(
    () => filtered.filter(p => getStatus(p) !== 'dismissed').map(p => p.id),
    [filtered]
  )

  const selectedContinuing = useMemo(
    () => Array.from(selected).filter(id => {
      const p = players.find(x => x.id === id)
      return p?.wants_to_continue === true
    }),
    [selected, players]
  )

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === selectableIds.length && selectableIds.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectableIds))
    }
  }

  async function handleSyncSheet() {
    setSyncing(true)
    try {
      function parseCSV(text: string): string[][] {
        return text.split('\n').map(line => {
          const result: string[] = []
          let cur = ''
          let inQuotes = false
          for (const ch of line) {
            if (ch === '"') { inQuotes = !inQuotes; continue }
            if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; continue }
            cur += ch
          }
          result.push(cur.trim())
          return result
        })
      }

      // Fetch main sheet + both form response sheets in parallel
      const [mainRes, form1Res, form2Res] = await Promise.all([
        fetch(`https://docs.google.com/spreadsheets/d/${INSCRIPTIONS_SHEET_ID}/export?format=csv&gid=0`),
        fetch(`https://docs.google.com/spreadsheets/d/${INSCRIPTIONS_SHEET_ID}/export?format=csv&gid=1234867596`),
        fetch(`https://docs.google.com/spreadsheets/d/${INSCRIPTIONS_SHEET_ID}/export?format=csv&gid=1385952206`),
      ])

      if (!mainRes.ok) throw new Error('No se pudo descargar la hoja principal')

      const mainRows = parseCSV(await mainRes.text())
      const formRows1 = form1Res.ok ? parseCSV(await form1Res.text()) : []
      const formRows2 = form2Res.ok ? parseCSV(await form2Res.text()) : []

      const preview = await previewInscriptionSync(mainRows, formRows1, formRows2)
      if (preview.error) { toast.error(`Error: ${preview.error}`); return }
      if (preview.matches.length === 0) { toast.info('Sin cambios pendientes'); return }

      const { updated } = await applyInscriptionSync(preview.matches)
      const withForm = preview.matches.filter(m => m.forms_link).length
      const withResp = preview.matches.filter(m => m.wants_to_continue !== null).length
      toast.success(
        `Sync: ${updated} actualizados · ${withForm} links · ${withResp} respuestas${preview.unmatched > 0 ? ` · ${preview.unmatched} sin coincidencia` : ''}`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  async function handleSyncCoaches() {
    setSyncingCoaches(true)
    try {
      function parseCSV(text: string): string[][] {
        return text.split('\n').map(line => {
          const result: string[] = []
          let cur = ''
          let inQuotes = false
          for (const ch of line) {
            if (ch === '"') { inQuotes = !inQuotes; continue }
            if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; continue }
            cur += ch
          }
          result.push(cur.trim())
          return result
        })
      }

      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${COACHES_SHEET_ID}/export?format=csv&gid=${COACHES_GID}`
      )
      if (!res.ok) throw new Error('No se pudo descargar la hoja de entrenadores')
      const rows = parseCSV(await res.text())

      const preview = await previewCoachSync(rows)
      if (preview.error) { toast.error(`Error: ${preview.error}`); return }

      if (preview.toAssign.length === 0) {
        toast.info('Sin entrenadores que importar')
        return
      }

      const { created, assigned, error } = await applyCoachSync(preview.toAssign)
      if (error) { toast.error(`Error al aplicar: ${error}`); return }

      const parts: string[] = []
      if (created > 0) parts.push(`${created} creado${created !== 1 ? 's' : ''}`)
      if (assigned > 0) parts.push(`${assigned} asignado${assigned !== 1 ? 's' : ''}`)
      if (preview.unknownTeams.length > 0) parts.push(`${preview.unknownTeams.length} equipos no encontrados`)
      toast.success(`Entrenadores: ${parts.join(' · ')}`)
      if (preview.unknownTeams.length > 0) {
        toast.warning(`Equipos sin coincidencia: ${preview.unknownTeams.slice(0, 4).join(', ')}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al sincronizar entrenadores')
    } finally {
      setSyncingCoaches(false)
    }
  }

  async function sendBulkEmails(emailType: 'fill_form' | 'team_assignment' | 'wants_to_continue_yes', ids?: string[]) {
    const targetIds = ids ?? Array.from(selected)
    if (targetIds.length === 0) return
    startTransition(async () => {
      let sent = 0
      let noEmail = 0
      let fail = 0
      for (const playerId of targetIds) {
        const result = await sendEmail(playerId, emailType)
        if (!result.success) { fail++; continue }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((result as any).emailSent) sent++
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else if (!(result as any).recipientEmail) noEmail++
        else sent++
      }
      const label = emailType === 'fill_form' ? 'formulario' : emailType === 'team_assignment' ? 'asignación' : 'confirmación'
      if (sent > 0) toast.success(`${sent} email${sent > 1 ? 's' : ''} de ${label} enviado${sent > 1 ? 's' : ''}`)
      if (noEmail > 0) toast.warning(`${noEmail} jugador${noEmail > 1 ? 'es' : ''} sin email de tutor`)
      if (fail > 0) toast.error(`${fail} error${fail > 1 ? 'es' : ''}`)
      setSelected(new Set())
    })
  }

  function handleStatusChange(
    playerId: string,
    field: 'wants_to_continue' | 'meets_requirements' | 'made_reservation',
    value: boolean
  ) {
    startTransition(async () => {
      await updateInscriptionStatus(playerId, { [field]: value })
    })
  }

  function handleNextTeamChange(playerId: string, teamId: string | null) {
    startTransition(async () => {
      await updateInscriptionStatus(playerId, { next_team_id: teamId ?? null })
    })
  }

  function handleDismiss(playerId: string, playerName: string, reason: 'requirements' | 'non_payment') {
    startTransition(async () => {
      const result = await dismissPlayerInscription(playerId, reason)
      if (result.success) {
        toast.success(`Baja procesada: ${playerName}`)
      } else {
        toast.error(result.error ?? 'Error al procesar la baja')
      }
    })
  }

  async function handleSendTrialLetter() {
    if (!trialModalPlayer || !trialClub || !trialDate) return
    setSendingTrial(true)
    try {
      const result = await sendTrialLetter(trialModalPlayer.id, trialClub, trialDate)
      if (result.success) {
        setTrialLetterIds(prev => new Set([...prev, trialModalPlayer.id]))
        if (result.emailSent) {
          toast.success(`Carta de pruebas enviada a ${trialModalPlayer.tutor_email}`)
        } else {
          toast.success('Carta de pruebas registrada (sin email de tutor)')
        }
      } else {
        toast.error(result.error ?? 'Error al enviar carta de pruebas')
      }
    } catch {
      toast.error('Error inesperado')
    } finally {
      setSendingTrial(false)
      setTrialModalPlayer(null)
      setTrialClub('')
      setTrialDate('')
    }
  }

  const allSelectableSelected =
    selectableIds.length > 0 && selectableIds.every(id => selected.has(id))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Seguimiento de inscripciones</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => downloadCsv(filtered.map(p => ({
              Nombre: p.first_name,
              Apellidos: p.last_name,
              'Email tutor': p.tutor_email ?? '',
              'Equipo 25/26': p.teams?.name ?? '',
              'Equipo 26/27': p.next_team?.name ?? (teams.find(t => t.id === (p.next_team_id ?? p.next_team?.id))?.name ?? ''),
              Estado: STATUS_LABEL[getStatus(p)],
              Continúa: p.wants_to_continue === true ? 'Sí' : p.wants_to_continue === false ? 'No' : 'Pendiente',
              Requisitos: p.meets_requirements === true ? 'Sí' : p.meets_requirements === false ? 'No' : '—',
              Reserva: p.made_reservation === true ? 'Sí' : p.made_reservation === false ? 'No' : '—',
            })), `inscripciones_${new Date().toISOString().slice(0, 10)}.csv`)}
            className="btn-secondary gap-2 flex items-center text-sm"
            title="Exportar inscripciones filtradas a CSV"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button
            onClick={handleSyncCoaches}
            disabled={syncingCoaches}
            className="btn-secondary gap-2 flex items-center text-sm"
            title="Leer hoja de entrenadores y asignarlos a sus equipos"
          >
            <RefreshCw className={cn('w-4 h-4', syncingCoaches && 'animate-spin')} />
            {syncingCoaches ? 'Leyendo...' : 'Sync Entrenadores'}
          </button>
          <button
            onClick={handleSyncSheet}
            disabled={syncing}
            className="btn-secondary gap-2 flex items-center text-sm"
            title="Sincronizar links de formulario y respuestas desde Google Sheets"
          >
            <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
            {syncing ? 'Sincronizando...' : 'Sync Sheets'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Pendientes" value={stats.pending} variant="muted" />
        <StatCard label="Continúan" value={stats.continuing} variant="success" />
        <StatCard label="Bajas" value={stats.dismissed} variant="destructive" />
      </div>

      {/* Filters + bulk actions */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="input pl-9 w-full"
            placeholder="Buscar jugador, tutor o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={filterTeam}
          onChange={e => setFilterTeam(e.target.value)}
        >
          <option value="">Todos los equipos</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as '' | InscriptionStatus)}
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="continuing">Continúan</option>
          <option value="dismissed">Bajas</option>
        </select>
        <select
          className="input w-auto"
          value={sortDate}
          onChange={e => setSortDate(e.target.value as 'newest' | 'oldest' | '')}
        >
          <option value="">Orden: Apellido</option>
          <option value="newest">Más recientes primero</option>
          <option value="oldest">Más antiguos primero</option>
        </select>
        {selected.size > 0 && (
          <div className="flex flex-wrap gap-2 ml-auto">
            <button
              onClick={() => sendBulkEmails('fill_form')}
              disabled={isPending}
              className="btn-secondary gap-2 flex items-center text-sm"
            >
              <Send className="w-4 h-4" />
              Enviar formulario ({selected.size})
            </button>
            {selectedContinuing.length > 0 && (
              <button
                onClick={() => sendBulkEmails('wants_to_continue_yes', selectedContinuing)}
                disabled={isPending}
                className="btn-secondary gap-2 flex items-center text-sm"
              >
                <Send className="w-4 h-4" />
                Enviar confirmación ({selectedContinuing.length})
              </button>
            )}
            <button
              onClick={() => sendBulkEmails('team_assignment')}
              disabled={isPending}
              className="btn-primary gap-2 flex items-center text-sm"
            >
              <Send className="w-4 h-4" />
              Enviar asignación ({selected.size})
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs">
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelectableSelected}
                    onChange={toggleSelectAll}
                    disabled={selectableIds.length === 0}
                    className="cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jugador</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo 25/26</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo 26/27</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Continúa</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Requisitos</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Reserva</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Form. enviado</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Email asig.</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Carta pruebas</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(player => {
                const status = getStatus(player)
                const isDismissed = status === 'dismissed'
                return (
                  <tr
                    key={player.id}
                    className={cn(
                      'border-b last:border-0 transition-colors',
                      isDismissed
                        ? 'bg-destructive/5 hover:bg-destructive/8'
                        : status === 'continuing' && player.made_reservation
                        ? 'bg-success/5 hover:bg-success/8'
                        : 'hover:bg-muted/30'
                    )}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2 text-center">
                      {!isDismissed && (
                        <input
                          type="checkbox"
                          checked={selected.has(player.id)}
                          onChange={() => toggleSelect(player.id)}
                          className="cursor-pointer"
                        />
                      )}
                    </td>

                    {/* Jugador */}
                    <td className="px-4 py-2">
                      <Link href={`/jugadores/${player.id}`} className="hover:underline">
                        <p className="font-medium">
                          {player.first_name} {player.last_name}
                        </p>
                      </Link>
                      {player.tutor_email && (
                        <p className="text-xs text-muted-foreground">{player.tutor_email}</p>
                      )}
                    </td>

                    {/* Equipo 25/26 — read only */}
                    <td className="px-3 py-2">
                      <span className="text-sm text-muted-foreground">
                        {player.teams?.name ?? '—'}
                      </span>
                    </td>

                    {/* Equipo 26/27 — editable */}
                    <td className="px-3 py-2">
                      <select
                        className="input text-xs py-1 w-36"
                        value={(player.next_team_id ?? player.next_team?.id) ?? ''}
                        onChange={e => handleNextTeamChange(player.id, e.target.value || null)}
                        disabled={isDismissed || isPending}
                      >
                        <option value="">Sin equipo</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      {(player.next_team_id ?? player.next_team?.id) && coachMap[(player.next_team_id ?? player.next_team?.id)!] && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate w-36">
                          {coachMap[(player.next_team_id ?? player.next_team?.id)!]}
                        </p>
                      )}
                    </td>

                    {/* Estado badge */}
                    <td className="px-3 py-2 text-center">
                      <span className={cn('badge text-xs', STATUS_BADGE[status])}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>

                    {/* Continúa (wants_to_continue) */}
                    <td className="px-3 py-2 text-center">
                      <ThreeStateToggle
                        value={player.wants_to_continue}
                        onChange={v => handleStatusChange(player.id, 'wants_to_continue', v)}
                        disabled={isPending}
                      />
                    </td>

                    {/* Requisitos (meets_requirements) */}
                    <td className="px-3 py-2 text-center">
                      <BoolToggle
                        value={player.meets_requirements}
                        onChange={v => handleStatusChange(player.id, 'meets_requirements', v)}
                        disabled={isPending}
                        nullLabel="N/A"
                      />
                    </td>

                    {/* Reserva (made_reservation) */}
                    <td className="px-3 py-2 text-center">
                      <BoolToggle
                        value={player.made_reservation}
                        onChange={v => handleStatusChange(player.id, 'made_reservation', v)}
                        disabled={isPending}
                        nullLabel="—"
                      />
                    </td>

                    {/* Email formulario de inscripción */}
                    <td className="px-3 py-2 text-center">
                      {player.email_fill_form_sent ? (
                        <div className="flex items-center justify-center gap-1">
                          <span title="Formulario enviado"><CheckCircle2 className="w-4 h-4 text-success" /></span>
                          {isAdmin && (
                            <button
                              onClick={() => startTransition(async () => {
                                await resetEmailFlag(player.id, 'email_fill_form_sent')
                                toast.info('Marcado como no enviado')
                              })}
                              disabled={isPending}
                              className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                              title="Deshacer (admin)"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            startTransition(async () => {
                              const r = await sendEmail(player.id, 'fill_form')
                              if (r.success) toast.success('Formulario enviado')
                              else toast.error(r.error ?? 'Error')
                            })
                          }}
                          disabled={isDismissed || isPending}
                          className="mx-auto flex text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                          title={player.forms_link ? 'Enviar formulario de inscripción' : 'Sin enlace de formulario'}
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                    </td>

                    {/* Email asignación */}
                    <td className="px-3 py-2 text-center">
                      {player.email_team_assignment_sent ? (
                        <div className="flex items-center justify-center gap-1">
                          <span title="Email enviado"><CheckCircle2 className="w-4 h-4 text-success" /></span>
                          {isAdmin && (
                            <button
                              onClick={() => startTransition(async () => {
                                await resetEmailFlag(player.id, 'email_team_assignment_sent')
                                toast.info('Marcado como no enviado')
                              })}
                              disabled={isPending}
                              className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                              title="Deshacer (admin)"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            startTransition(async () => {
                              const r = await sendEmail(player.id, 'team_assignment')
                              if (r.success) toast.success('Email de asignación registrado')
                              else toast.error(r.error ?? 'Error')
                            })
                          }}
                          disabled={isDismissed || isPending}
                          className="mx-auto flex text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                          title="Enviar email de asignación"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                    </td>

                    {/* Carta de pruebas */}
                    <td className="px-3 py-2 text-center">
                      {trialLetterIds.has(player.id) ? (
                        <span title="Carta de pruebas enviada">
                          <FileText className="w-4 h-4 text-amber-500 mx-auto" />
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setTrialModalPlayer(player)
                            setTrialClub('')
                            setTrialDate('')
                          }}
                          disabled={isDismissed || isPending}
                          className="mx-auto flex text-muted-foreground hover:text-amber-500 transition-colors disabled:opacity-40"
                          title="Enviar carta de pruebas"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-center">
                        {player.forms_link && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(player.forms_link!)
                              toast.success('Link del formulario copiado')
                            }}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Copiar link del formulario"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!isDismissed && (
                          <DismissMenu
                            playerName={`${player.first_name} ${player.last_name}`}
                            onDismiss={reason =>
                              handleDismiss(
                                player.id,
                                `${player.first_name} ${player.last_name}`,
                                reason
                              )
                            }
                            disabled={isPending}
                          />
                        )}
                        <Link
                          href={`/jugadores/${player.id}`}
                          className="text-xs text-primary hover:underline px-1"
                        >
                          Ficha
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No se encontraron jugadores
            </div>
          )}
        </div>
      </div>

      {/* Trial Letter Modal */}
      {trialModalPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card p-6 w-full max-w-md shadow-xl border">
            <h3 className="text-lg font-semibold mb-4">
              Carta de pruebas — {trialModalPlayer.first_name} {trialModalPlayer.last_name}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Club de destino</label>
                <input
                  className="input w-full mt-1"
                  placeholder="Nombre del club donde hará la prueba"
                  value={trialClub}
                  onChange={e => setTrialClub(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Fecha de la prueba</label>
                <input
                  type="date"
                  className="input w-full mt-1"
                  value={trialDate}
                  onChange={e => setTrialDate(e.target.value)}
                />
              </div>
              {trialModalPlayer.tutor_email ? (
                <p className="text-xs text-muted-foreground">
                  Se enviará a: <strong>{trialModalPlayer.tutor_email}</strong> con PDF adjunto
                </p>
              ) : (
                <p className="text-xs text-amber-600">
                  Este jugador no tiene email de tutor. La carta se registrará pero no se enviará email.
                </p>
              )}
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={() => setTrialModalPlayer(null)}
                className="btn-secondary text-sm"
                disabled={sendingTrial}
              >
                Cancelar
              </button>
              <button
                onClick={handleSendTrialLetter}
                disabled={!trialClub || !trialDate || sendingTrial}
                className="btn-primary gap-2 flex items-center text-sm"
              >
                <FileText className="w-4 h-4" />
                {sendingTrial ? 'Enviando...' : 'Enviar carta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: number
  variant?: 'default' | 'muted' | 'success' | 'destructive'
}) {
  const colors = {
    default: 'text-foreground',
    muted: 'text-muted-foreground',
    success: 'text-success',
    destructive: 'text-destructive',
  }
  return (
    <div className="card p-4 text-center">
      <p className={cn('text-2xl font-bold', colors[variant])}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

function ThreeStateToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean | null
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  if (value === null || value === undefined) {
    return (
      <button
        onClick={() => onChange(true)}
        disabled={disabled}
        className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 mx-auto flex"
        title="Sin respuesta — clic para marcar Sí"
      >
        <Clock className="w-4 h-4" />
      </button>
    )
  }
  return (
    <button
      onClick={() => onChange(!value)}
      disabled={disabled}
      className="mx-auto flex transition-colors disabled:opacity-40"
      title={value ? 'Sí — clic para cambiar' : 'No — clic para cambiar'}
    >
      {value ? (
        <CheckCircle2 className="w-4 h-4 text-success" />
      ) : (
        <XCircle className="w-4 h-4 text-destructive" />
      )}
    </button>
  )
}

function BoolToggle({
  value,
  onChange,
  disabled,
  nullLabel = '—',
}: {
  value: boolean | null
  onChange: (v: boolean) => void
  disabled?: boolean
  nullLabel?: string
}) {
  if (value === null || value === undefined) {
    return (
      <button
        onClick={() => onChange(true)}
        disabled={disabled}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        title="Sin datos — clic para marcar OK"
      >
        {nullLabel}
      </button>
    )
  }
  return (
    <button
      onClick={() => onChange(!value)}
      disabled={disabled}
      className="mx-auto flex transition-colors disabled:opacity-40"
      title={value ? 'OK — clic para cambiar' : 'No — clic para cambiar'}
    >
      {value ? (
        <CheckCircle2 className="w-4 h-4 text-success" />
      ) : (
        <XCircle className="w-4 h-4 text-destructive" />
      )}
    </button>
  )
}

function DismissMenu({
  playerName,
  onDismiss,
  disabled,
}: {
  playerName: string
  onDismiss: (reason: 'requirements' | 'non_payment') => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        className="flex items-center gap-0.5 text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-40 px-1"
        title="Dar de baja"
      >
        <UserX className="w-3.5 h-3.5" />
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 card min-w-44 shadow-lg p-1 border">
          <p className="text-xs text-muted-foreground px-2 py-1 font-medium">
            Dar baja a {playerName.split(' ')[0]}
          </p>
          <button
            onClick={() => {
              setOpen(false)
              if (confirm(`¿Dar de baja a ${playerName} por no cumplir requisitos?\nSe registrará un email de notificación.`)) {
                onDismiss('requirements')
              }
            }}
            className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted rounded transition-colors"
          >
            Por requisitos
          </button>
          <button
            onClick={() => {
              setOpen(false)
              if (confirm(`¿Dar de baja a ${playerName} por impago de reserva?\nSe registrará un email de notificación.`)) {
                onDismiss('non_payment')
              }
            }}
            className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted rounded transition-colors"
          >
            Por impago de reserva
          </button>
        </div>
      )}
    </div>
  )
}
