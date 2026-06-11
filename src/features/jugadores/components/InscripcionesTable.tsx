'use client'

import { useState, useMemo, useTransition, useRef, useEffect } from 'react'
import { Search, Send, CheckCircle2, XCircle, Clock, ChevronDown, UserX, RefreshCw, RotateCcw, Download, ArrowUpDown, Copy, Link2, FileText, Mail, MailCheck, MailX } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Player } from '@/types/database.types'
import {
  updateInscriptionStatus,
  sendEmail,
  dismissPlayerInscription,
  resetEmailFlag,
  sendTrialLetter,
} from '@/features/jugadores/actions/player.actions'
import { sendTeamAssignmentEmail } from '@/features/configuracion/actions/assignment-email.actions'
import {
  previewInscriptionSync,
  applyInscriptionSync,
  previewCoachSync,
  applyCoachSync,
  assignUnmatchedToPlayer,
  createPlayerFromUnmatched,
  type UnmatchedRow,
} from '@/features/jugadores/actions/sync-inscriptions.actions'
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
  draftTeams,
  coachMap = {},
  isAdmin = false,
  trialLetterPlayerIds = [],
  paid26Status = {},
  nextSeason = '',
  inscriptionsSheetId = null,
  inscriptionsFormGids = [],
  coachesSheetId = null,
  coachesGid = null,
}: {
  players: PlayerWithTeam[]
  teams: { id: string; name: string }[]
  /** Equipos borrador de la próxima temporada (active=false). Se usan en el dropdown next_team_id. */
  draftTeams?: { id: string; name: string; season: string }[]
  coachMap?: Record<string, string>
  isAdmin?: boolean
  trialLetterPlayerIds?: string[]
  /** Estado de pago en la próxima temporada por player_id: 'none' | 'reserva' | 'cuota' */
  paid26Status?: Record<string, 'none' | 'reserva' | 'cuota'>
  nextSeason?: string
  /** Hoja de Google de inscripciones de ESTE club (null = no configurada → sync deshabilitado) */
  inscriptionsSheetId?: string | null
  /** GIDs de las hojas de respuestas de formularios de ESTE club */
  inscriptionsFormGids?: string[]
  /** Hoja de entrenadores de ESTE club */
  coachesSheetId?: string | null
  coachesGid?: string | null
}) {
  const [search, setSearch] = useState('')
  const [filterTeam, setFilterTeam] = useState('')
  const [filterStatus, setFilterStatus] = useState<'' | InscriptionStatus>('')
  const [filterPaid26, setFilterPaid26] = useState<'' | 'none' | 'reserva' | 'cuota'>('')
  const [filterEmailSent, setFilterEmailSent] = useState<'' | 'sent' | 'not_sent'>('')
  const [filterNextTeams, setFilterNextTeams] = useState<Set<string>>(new Set())
  const [sortDate, setSortDate] = useState<'newest' | 'oldest' | ''>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [syncingCoaches, setSyncingCoaches] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [trialLetterIds, setTrialLetterIds] = useState<Set<string>>(new Set(trialLetterPlayerIds))
  const [trialModalPlayer, setTrialModalPlayer] = useState<PlayerWithTeam | null>(null)
  const [trialMode, setTrialMode] = useState<'generic' | 'specific'>('generic')
  const [trialClub, setTrialClub] = useState('')
  const [trialDate, setTrialDate] = useState('2026-06-30')
  const [sendingTrial, setSendingTrial] = useState(false)

  // Inscripciones sin coincidencia
  const [unmatchedRows, setUnmatchedRows] = useState<UnmatchedRow[]>([])
  const [showUnmatched, setShowUnmatched] = useState(false)

  const stats = useMemo(() => {
    const counts = { pending: 0, continuing: 0, dismissed: 0, total: players.length }
    players.forEach(p => counts[getStatus(p)]++)
    return counts
  }, [players])

  const filtered = useMemo(() => {
    const result = players.filter(p => {
      const name = `${p.first_name} ${p.last_name}`.toLowerCase()
      const status = getStatus(p)
      const nextTeamId = p.next_team_id ?? p.next_team?.id ?? null

      // Next team multi-select filter
      let passNextTeam = true
      if (filterNextTeams.size > 0) {
        if (nextTeamId === null) {
          passNextTeam = filterNextTeams.has('none')
        } else {
          passNextTeam = filterNextTeams.has(nextTeamId)
        }
      }

      return (
        (!search ||
          name.includes(search.toLowerCase()) ||
          p.tutor_name?.toLowerCase().includes(search.toLowerCase()) ||
          p.tutor_email?.toLowerCase().includes(search.toLowerCase())) &&
        (!filterTeam || p.team_id === filterTeam) &&
        (!filterStatus || status === filterStatus) &&
        (!filterPaid26 || (paid26Status[p.id] ?? 'none') === filterPaid26) &&
        (!filterEmailSent || (filterEmailSent === 'sent' ? p.email_team_assignment_sent === true : !p.email_team_assignment_sent)) &&
        passNextTeam
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
  }, [players, search, filterTeam, filterStatus, filterPaid26, filterEmailSent, filterNextTeams, sortDate, paid26Status])

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
    if (!inscriptionsSheetId) {
      toast.error('Este club no tiene hoja de inscripciones configurada. Configúrala en Configuración → Integraciones.')
      return
    }
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

      // Hoja principal (gid=0) + hojas de respuestas de formularios (gids del club)
      const gids = inscriptionsFormGids.length > 0 ? inscriptionsFormGids : []
      const [mainRes, ...formResults] = await Promise.all([
        fetch(`https://docs.google.com/spreadsheets/d/${inscriptionsSheetId}/export?format=csv&gid=0`),
        ...gids.map(gid =>
          fetch(`https://docs.google.com/spreadsheets/d/${inscriptionsSheetId}/export?format=csv&gid=${gid}`)
        ),
      ])
      const form1Res = formResults[0]
      const form2Res = formResults[1]

      if (!mainRes.ok) throw new Error('No se pudo descargar la hoja principal')

      const mainRows = parseCSV(await mainRes.text())
      const formRows1 = form1Res?.ok ? parseCSV(await form1Res.text()) : []
      const formRows2 = form2Res?.ok ? parseCSV(await form2Res.text()) : []

      const preview = await previewInscriptionSync(mainRows, formRows1, formRows2)
      if (preview.error) { toast.error(`Error: ${preview.error}`); return }

      // Guardar los unmatched para que el usuario pueda asignarlos
      setUnmatchedRows(preview.unmatchedDetails ?? [])
      if ((preview.unmatchedDetails ?? []).length > 0) setShowUnmatched(true)

      if (preview.matches.length === 0 && preview.unmatched === 0) {
        toast.info('Sin cambios pendientes')
        return
      }
      if (preview.matches.length === 0) {
        toast.info(`${preview.unmatched} respuestas sin coincidencia (revísalas abajo)`)
        return
      }

      const { updated } = await applyInscriptionSync(preview.matches)
      const withForm = preview.matches.filter(m => m.forms_link).length
      const withResp = preview.matches.filter(m => m.wants_to_continue !== null).length
      toast.success(
        `Sync: ${updated} actualizados · ${withForm} links · ${withResp} respuestas${preview.unmatched > 0 ? ` · ${preview.unmatched} sin coincidencia (revísalas abajo)` : ''}`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  async function handleSyncCoaches() {
    if (!coachesSheetId || !coachesGid) {
      toast.error('Este club no tiene hoja de entrenadores configurada. Configúrala en Configuración → Integraciones.')
      return
    }
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
        `https://docs.google.com/spreadsheets/d/${coachesSheetId}/export?format=csv&gid=${coachesGid}`
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

  async function sendBulkEmails(emailType: 'fill_form' | 'team_assignment' | 'wants_to_continue_yes' | 'request_docs', ids?: string[]) {
    const targetIds = ids ?? Array.from(selected)
    if (targetIds.length === 0) return
    startTransition(async () => {
      let sent = 0
      let noEmail = 0
      let fail = 0
      for (const playerId of targetIds) {
        // team_assignment uses the new configurable email action
        if (emailType === 'team_assignment') {
          const result = await sendTeamAssignmentEmail(playerId)
          if (!result.success) {
            if (result.error?.includes('email de tutor') || result.error?.includes('no tiene email')) noEmail++
            else fail++
          } else sent++
          continue
        }
        const result = await sendEmail(playerId, emailType)
        if (!result.success) { fail++; continue }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((result as any).emailSent) sent++
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else if (!(result as any).recipientEmail) noEmail++
        else sent++
      }
      const label = emailType === 'fill_form' ? 'formulario' : emailType === 'team_assignment' ? 'asignación' : emailType === 'request_docs' ? 'solicitud de documentos' : 'confirmación'
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
        if ((result as { warning?: string }).warning) {
          toast.warning((result as { warning?: string }).warning)
        }
      } else {
        toast.error(result.error ?? 'Error al procesar la baja')
      }
    })
  }

  async function handleSendTrialLetter() {
    if (!trialModalPlayer || !trialDate) return
    if (trialMode === 'specific' && !trialClub) return
    setSendingTrial(true)
    const effectiveClub = trialMode === 'generic' ? 'al club que considere oportuno' : trialClub
    try {
      const result = await sendTrialLetter(trialModalPlayer.id, effectiveClub, trialDate, trialMode === 'generic')
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
      setTrialMode('generic')
      setTrialClub('')
      setTrialDate('2026-06-30')
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
            disabled={syncingCoaches || !coachesSheetId || !coachesGid}
            className="btn-secondary gap-2 flex items-center text-sm disabled:opacity-50"
            title={!coachesSheetId || !coachesGid
              ? 'Configura la hoja de entrenadores en Configuración → Integraciones'
              : 'Leer hoja de entrenadores y asignarlos a sus equipos'}
          >
            <RefreshCw className={cn('w-4 h-4', syncingCoaches && 'animate-spin')} />
            {syncingCoaches ? 'Leyendo...' : 'Sync Entrenadores'}
          </button>
          <button
            onClick={handleSyncSheet}
            disabled={syncing || !inscriptionsSheetId}
            className="btn-secondary gap-2 flex items-center text-sm disabled:opacity-50"
            title={!inscriptionsSheetId
              ? 'Configura la hoja de inscripciones en Configuración → Integraciones'
              : 'Sincronizar links de formulario y respuestas desde Google Sheets'}
          >
            <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
            {syncing ? 'Sincronizando...' : 'Sync Sheets'}
          </button>
          {unmatchedRows.length > 0 && (
            <button
              onClick={() => setShowUnmatched(v => !v)}
              className="btn-secondary gap-2 flex items-center text-sm border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              title="Respuestas del Sheets que no encontraron jugador"
            >
              ⚠️ Sin coincidencia: {unmatchedRows.length}
            </button>
          )}
        </div>
      </div>

      {/* Panel de respuestas sin coincidencia */}
      {showUnmatched && unmatchedRows.length > 0 && (
        <UnmatchedPanel
          rows={unmatchedRows}
          players={players}
          onClose={() => setShowUnmatched(false)}
          onResolve={(rowKey) => setUnmatchedRows(prev => prev.filter(r => `${r.source}_${r.rowIndex}_${r.nameRaw}` !== rowKey))}
        />
      )}

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

        {/* Pago 26/27 filter */}
        {nextSeason && Object.keys(paid26Status).length > 0 && (
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {([
              ['', 'Todos'],
              ['cuota', '✓ Cuota'],
              ['reserva', '◐ Reserva'],
              ['none', '✗ Sin pago'],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterPaid26(val)}
                className={cn(
                  'px-2 py-1 text-xs rounded-md transition-colors',
                  filterPaid26 === val
                    ? val === 'cuota'   ? 'bg-white text-green-700 font-semibold shadow-sm'
                    : val === 'reserva' ? 'bg-white text-amber-700 font-semibold shadow-sm'
                    : val === 'none'    ? 'bg-white text-red-700 font-semibold shadow-sm'
                    : 'bg-white text-slate-900 font-medium shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title={`Filtrar por pago ${nextSeason}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Email asignación filter */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setFilterEmailSent('')}
            className={cn(
              'px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1',
              filterEmailSent === '' ? 'bg-white text-slate-900 font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
            title="Todos"
          >
            <Mail className="w-3.5 h-3.5" />
            Todos
          </button>
          <button
            onClick={() => setFilterEmailSent(filterEmailSent === 'sent' ? '' : 'sent')}
            className={cn(
              'px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1',
              filterEmailSent === 'sent' ? 'bg-white text-emerald-700 font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
            title="Solo con email de asignación enviado"
          >
            <MailCheck className="w-3.5 h-3.5" />
            Enviado
          </button>
          <button
            onClick={() => setFilterEmailSent(filterEmailSent === 'not_sent' ? '' : 'not_sent')}
            className={cn(
              'px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1',
              filterEmailSent === 'not_sent' ? 'bg-white text-amber-700 font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
            title="Solo sin email de asignación enviado"
          >
            <MailX className="w-3.5 h-3.5" />
            Sin enviar
          </button>
        </div>

        {/* Next team multi-select */}
        <NextTeamMultiSelect
          draftTeams={draftTeams ?? teams}
          selected={filterNextTeams}
          onChange={setFilterNextTeams}
        />

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
              onClick={() => sendBulkEmails('request_docs')}
              disabled={isPending}
              className="btn-secondary gap-2 flex items-center text-sm"
              title="Solicitar DNI, foto, certificado médico y justificante de reserva"
            >
              <Send className="w-4 h-4" />
              Solicitar documentos ({selected.size})
            </button>
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
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Docs. solic.</th>
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
                        {(draftTeams ?? teams).map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name}{'season' in t ? ` (${(t as { season: string }).season.replace('20', '')})` : ''}
                          </option>
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
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn('badge text-xs', STATUS_BADGE[status])}>
                          {STATUS_LABEL[status]}
                        </span>
                        {nextSeason && (() => {
                          const ps = paid26Status[player.id] ?? 'none'
                          return (
                            <span className={cn(
                              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                              ps === 'cuota'   ? 'bg-green-100 text-green-700'
                            : ps === 'reserva' ? 'bg-amber-100 text-amber-700'
                            :                    'bg-red-100 text-red-600'
                            )}>
                              {ps === 'cuota' ? '✓ Cuota' : ps === 'reserva' ? '◐ Reserva' : '✗ Sin pago'}
                            </span>
                          )
                        })()}
                      </div>
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

                    {/* Email solicitar documentos */}
                    <td className="px-3 py-2 text-center">
                      {player.email_request_docs_sent ? (
                        <div className="flex items-center justify-center gap-1">
                          <span title="Documentos solicitados"><CheckCircle2 className="w-4 h-4 text-success" /></span>
                          {isAdmin && (
                            <button
                              onClick={() => startTransition(async () => {
                                await resetEmailFlag(player.id, 'email_request_docs_sent')
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
                              const r = await sendEmail(player.id, 'request_docs')
                              if (r.success) toast.success('Solicitud de documentos enviada')
                              else toast.error(r.error ?? 'Error')
                            })
                          }}
                          disabled={isDismissed || isPending}
                          className="mx-auto flex text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                          title={player.forms_link ? 'Solicitar documentación al tutor' : 'Sin enlace de formulario — se enviará sin link'}
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
                              const r = await sendTeamAssignmentEmail(player.id)
                              if (r.success) toast.success('Email de asignación enviado')
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
                            setTrialMode('generic')
                            setTrialClub('')
                            setTrialDate('2026-06-30')
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

            {/* Modo toggle */}
            <div className="flex rounded-lg border overflow-hidden mb-4 text-sm font-medium">
              <button
                type="button"
                onClick={() => { setTrialMode('generic'); setTrialDate('2026-06-30') }}
                className={`flex-1 py-2 transition-colors ${trialMode === 'generic' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}
              >
                Genérica
              </button>
              <button
                type="button"
                onClick={() => { setTrialMode('specific'); setTrialClub(''); setTrialDate('') }}
                className={`flex-1 py-2 transition-colors border-l ${trialMode === 'specific' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}
              >
                Club específico
              </button>
            </div>

            <div className="space-y-3">
              {trialMode === 'generic' ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Club de destino</label>
                    <div className="input w-full mt-1 bg-muted/40 text-muted-foreground text-sm cursor-not-allowed select-none">
                      Al club que la familia considere oportuno
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Válida hasta</label>
                    <input
                      type="date"
                      className="input w-full mt-1"
                      value={trialDate}
                      onChange={e => setTrialDate(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}

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
                disabled={(trialMode === 'specific' && !trialClub) || !trialDate || sendingTrial}
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

// ─── NextTeamMultiSelect ──────────────────────────────────────────────────────

function NextTeamMultiSelect({
  draftTeams,
  selected,
  onChange,
}: {
  draftTeams: { id: string; name: string; season?: string }[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  function clear() { onChange(new Set()) }

  const label = selected.size === 0
    ? 'Equipo 26/27'
    : selected.size === 1
      ? selected.has('none') ? 'Sin equipo (26/27)' : (draftTeams.find(t => t.id === [...selected][0])?.name ?? '1 equipo')
      : `${selected.size} equipos`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'input w-auto flex items-center gap-2 text-sm cursor-pointer',
          selected.size > 0 && 'border-primary/60 bg-primary/5 text-primary font-medium'
        )}
      >
        <span className="truncate max-w-36">{label}</span>
        {selected.size > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); clear() }}
            onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), clear())}
            className="ml-auto text-muted-foreground hover:text-destructive shrink-0"
            title="Limpiar filtro"
          >
            <XCircle className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg border shadow-lg min-w-52 max-h-72 overflow-y-auto p-1">
          <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={selected.has('none')}
              onChange={() => toggle('none')}
              className="cursor-pointer"
            />
            <span className="italic text-muted-foreground">Sin equipo</span>
          </label>
          {draftTeams.length > 0 && (
            <div className="border-t my-1" />
          )}
          {draftTeams.map(t => (
            <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selected.has(t.id)}
                onChange={() => toggle(t.id)}
                className="cursor-pointer"
              />
              <span className="truncate">{t.name}</span>
              {'season' in t && t.season && (
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {(t.season as string).replace('20', '').replace('/', '/')}
                </span>
              )}
            </label>
          ))}
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
  const [confirming, setConfirming] = useState<'requirements' | 'non_payment' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setConfirming(null)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const reasonLabel = confirming === 'requirements' ? 'no cumplir requisitos' : 'impago de reserva'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(v => !v); setConfirming(null) }}
        disabled={disabled}
        className="flex items-center gap-0.5 text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-40 px-1"
        title="Dar de baja"
      >
        <UserX className="w-3.5 h-3.5" />
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 card min-w-52 shadow-lg p-1 border">
          {confirming === null ? (
            <>
              <p className="text-xs text-muted-foreground px-2 py-1 font-medium">
                Dar baja a {playerName.split(' ')[0]}
              </p>
              <button
                onClick={() => setConfirming('requirements')}
                className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted rounded transition-colors"
              >
                Por requisitos
              </button>
              <button
                onClick={() => setConfirming('non_payment')}
                className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted rounded transition-colors"
              >
                Por impago de reserva
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground px-2 py-1 font-medium">
                ¿Dar de baja por {reasonLabel}?
              </p>
              <p className="text-xs text-muted-foreground px-2 pb-1">
                Se enviará email al tutor.
              </p>
              <div className="flex gap-1 px-1 pb-1">
                <button
                  onClick={() => { setOpen(false); setConfirming(null); onDismiss(confirming) }}
                  className="flex-1 text-xs px-2 py-1.5 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="flex-1 text-xs px-2 py-1.5 hover:bg-muted rounded transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Panel de respuestas sin coincidencia ──────────────────────────────────────
function UnmatchedPanel({
  rows,
  players,
  onClose,
  onResolve,
}: {
  rows: UnmatchedRow[]
  players: PlayerWithTeam[]
  onClose: () => void
  onResolve: (rowKey: string) => void
}) {
  return (
    <div className="card border-amber-300 bg-amber-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-amber-900">⚠️ Respuestas sin coincidencia ({rows.length})</h3>
          <p className="text-xs text-amber-700">
            Asigna cada respuesta a un jugador existente o crea uno nuevo con esos datos.
          </p>
        </div>
        <button onClick={onClose} className="text-amber-700 hover:text-amber-900 text-sm">Cerrar</button>
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const rowKey = `${row.source}_${row.rowIndex}_${row.nameRaw}`
          return (
            <UnmatchedRowCard
              key={rowKey}
              row={row}
              players={players}
              onResolve={() => onResolve(rowKey)}
            />
          )
        })}
      </div>
    </div>
  )
}

function UnmatchedRowCard({
  row,
  players,
  onResolve,
}: {
  row: UnmatchedRow
  players: PlayerWithTeam[]
  onResolve: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [busy, setBusy] = useState(false)

  const candidates = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return players.slice(0, 30)
    return players.filter((p) => {
      const name = `${p.first_name} ${p.last_name}`.toLowerCase()
      return name.includes(q) || (p.tutor_email ?? '').toLowerCase().includes(q) || (p.dni ?? '').toLowerCase().includes(q)
    }).slice(0, 50)
  }, [players, searchTerm])

  async function handleAssign(playerId: string) {
    setBusy(true)
    try {
      const r = await assignUnmatchedToPlayer(playerId, {
        formLink: row.formLink,
        respuestaParsed: row.respuestaParsed,
        email: row.email,
      })
      if (r.success) { toast.success('Asignado'); onResolve() }
      else toast.error(r.error ?? 'Error')
    } finally {
      setBusy(false)
      setPickerOpen(false)
    }
  }

  async function handleCreate() {
    setBusy(true)
    try {
      const r = await createPlayerFromUnmatched({
        nameRaw: row.nameRaw,
        email: row.email,
        formLink: row.formLink,
        respuestaParsed: row.respuestaParsed,
      })
      if (r.success) { toast.success(`Jugador creado: ${row.nameRaw}`); onResolve() }
      else toast.error(r.error ?? 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-md border border-amber-200 p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{row.nameRaw}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
            {row.email && <span>📧 {row.email}</span>}
            {row.respuestaRaw && (
              <span>
                Respuesta: <strong className={row.respuestaParsed === true ? 'text-green-600' : row.respuestaParsed === false ? 'text-red-600' : ''}>
                  {row.respuestaRaw}
                </strong>
              </span>
            )}
            {row.formLink && <span>🔗 form link</span>}
            <span className="text-muted-foreground/60">{row.source} · fila {row.rowIndex}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPickerOpen(v => !v)}
            disabled={busy}
            className="btn-secondary text-xs"
          >
            Asignar a jugador
          </button>
          <button
            onClick={handleCreate}
            disabled={busy}
            className="btn-primary text-xs"
          >
            Crear nuevo
          </button>
        </div>
      </div>

      {pickerOpen && (
        <div className="mt-3 border-t border-amber-100 pt-3">
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            autoFocus
            placeholder="Buscar jugador por nombre, email o DNI..."
            className="input text-sm w-full mb-2"
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {candidates.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">Sin resultados</p>
            )}
            {candidates.map(p => (
              <button
                key={p.id}
                onClick={() => handleAssign(p.id)}
                disabled={busy}
                className="w-full text-left p-2 rounded text-xs hover:bg-muted transition-colors flex items-center justify-between"
              >
                <span>
                  <span className="font-medium">{p.first_name} {p.last_name}</span>
                  {p.tutor_email && <span className="text-muted-foreground ml-2">{p.tutor_email}</span>}
                </span>
                <span className="text-muted-foreground text-xs">{p.teams?.name ?? ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
