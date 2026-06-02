'use client'

import React, { useState, useTransition, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Search,
  Euro,
  AlertCircle,
  Users,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Mail,
  ShieldAlert,
  Receipt,
  Pencil,
  Trash2,
  X,
  Check,
  Phone,
  Info,
  ExternalLink,
  FileDown,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatCurrency, formatDate } from '@/lib/utils/currency'
import {
  registerPayment,
  sendPendingReminders,
  deletePayment,
  updatePayment,
  refundPayment,
  updateQuotaPaymentComment,
  updatePlayerTeam,
  updatePendingPaymentAmount,
  toggleQuotaSpecialCase,
  getLinkedItems,
} from '@/features/contabilidad/actions/accounting.actions'
import { EMAIL_BATCH_CAP } from '@/lib/contabilidad/constants'
import Link from 'next/link'

interface PlayerRow {
  id: string
  first_name: string
  last_name: string
  dni: string | null
  tutor_email: string | null
  tutor_name: string | null
  tutor_phone?: string | null
  teams: { id: string; name: string } | null
}

interface Payment {
  id: string
  player_id: string
  amount_due: number
  amount_paid: number
  payment_date: string | null
  payment_method: string | null
  status: string
  notes: string | null
  admin_comment: string | null
  created_at: string
  concept: string | null
  email_sent?: boolean | null
  is_special_case?: boolean | null
  season?: string | null
}

interface Props {
  clubId: string
  season?: string
  isNextSeason?: boolean
  totalPaidThisMonth: number
  totalPending: number
  playersWithDebtCount: number
  players: PlayerRow[]
  payments: Payment[]
  canRegisterPayments: boolean
  quotaAmounts?: {
    annual?: number
    earlyPayDiscount?: number
    installments?: { label: string; amount: number; deadline: string }[]
    teams?: Record<string, number>
  }
  seasonFees?: Array<{ team_id: string | null; concept: string; amount: number }>
  teams?: { id: string; name: string }[]
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
]

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
}

export function PaymentRegistration({
  clubId,
  season,
  isNextSeason = false,
  totalPaidThisMonth,
  totalPending,
  playersWithDebtCount,
  players,
  payments,
  canRegisterPayments,
  quotaAmounts,
  seasonFees,
  teams = [],
}: Props) {
  const [search, setSearch] = useState('')
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<string>('cash')
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set())
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editMethod, setEditMethod] = useState('cash')
  const [editNotes, setEditNotes] = useState('')
  const [editSeason, setEditSeason] = useState('')
  const [editSourceType, setEditSourceType] = useState<'cuota' | 'torneo' | 'actividad'>('cuota')
  const [editLinkedId, setEditLinkedId] = useState('')
  const [linkedItems, setLinkedItems] = useState<{ torneos: { id: string; name: string }[]; actividades: { id: string; name: string }[] } | null>(null)
  const [loadingLinkedItems, setLoadingLinkedItems] = useState(false)

  // Modal de reembolso — reemplaza prompt() (no funciona en iOS Safari)
  const [refundModal, setRefundModal] = useState<{ payment: Payment; method: string } | null>(null)

  // Comentarios inline en pagos pendientes
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null) // payment_id
  const [commentDraft, setCommentDraft] = useState('')
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null)
  const commentSaveInProgress = useRef(false)

  // Filtros y ordenación de pendientes
  const [pendingTeamFilters, setPendingTeamFilters] = useState<Set<string>>(new Set())  // nombres de equipo
  const [pendingConceptFilters, setPendingConceptFilters] = useState<Set<string>>(new Set())  // conceptos
  const [pendingSearch, setPendingSearch] = useState<string>('')
  const [pendingSort, setPendingSort] = useState<'name' | 'amount_desc' | 'amount_asc' | 'last_payment'>('amount_desc')
  const [filterComment, setFilterComment] = useState<'' | 'with' | 'without'>('')
  const [teamFilterOpen, setTeamFilterOpen] = useState(false)
  const [conceptFilterOpen, setConceptFilterOpen] = useState(false)

  // Edición inline de equipo/importe en pendientes
  const [editingPendingId, setEditingPendingId] = useState<string | null>(null) // player.id
  const [editPendingTeam, setEditPendingTeam] = useState<string>('')
  const [editPendingAmount, setEditPendingAmount] = useState<string>('')

  const today = new Date().toISOString().slice(0, 10)

  // Get annual quota amount for a player based on team.
  // Prioridad: season_fees (concept 'Cuota anual' o similar) → quotaAmounts.teams → quotaAmounts.annual
  function getAnnualQuota(player: PlayerRow): number {
    if (seasonFees && seasonFees.length > 0) {
      const tid = player.teams?.id ?? null
      // Busca 'Cuota anual' específica del equipo → por defecto de temporada
      const anualRows = seasonFees.filter((f) =>
        /anual|cuota$/i.test(f.concept) || f.concept.toLowerCase() === 'cuota anual',
      )
      const teamRow = tid ? anualRows.find((f) => f.team_id === tid) : null
      const defaultRow = anualRows.find((f) => f.team_id === null)
      if (teamRow) return Number(teamRow.amount)
      if (defaultRow) return Number(defaultRow.amount)
    }
    if (!quotaAmounts) return 0
    const teamsMap = quotaAmounts.teams ?? {}
    if (player.teams?.id && teamsMap[player.teams.id]) {
      return teamsMap[player.teams.id]
    }
    return quotaAmounts.annual ?? 0
  }

  const installments = quotaAmounts?.installments ?? []
  const earlyDiscount = quotaAmounts?.earlyPayDiscount ?? 0

  // Player lookup map
  const playerMap = useMemo(() => {
    const map: Record<string, PlayerRow> = {}
    for (const p of players) map[p.id] = p
    return map
  }, [players])

  // Recent paid payments for receipt history
  const recentPaidPayments = useMemo(() => {
    return payments.filter(p => p.status === 'paid').slice(0, 20)
  }, [payments])

  // Pending players for table
  const pendingPlayers = useMemo(() => {
    const pendingByPlayer: Record<string, {
      amount: number
      lastPayment: string | null
      firstPendingPaymentId: string | null
      adminComment: string | null
      specialCase: boolean
    }> = {}
    for (const p of payments) {
      if (p.status === 'pending') {
        if (!pendingByPlayer[p.player_id]) {
          pendingByPlayer[p.player_id] = {
            amount: 0,
            lastPayment: null,
            firstPendingPaymentId: p.id,
            adminComment: p.admin_comment ?? null,
            specialCase: false,
          }
        }
        pendingByPlayer[p.player_id].amount += p.amount_due - p.amount_paid
        if (p.is_special_case) pendingByPlayer[p.player_id].specialCase = true
      }
    }
    for (const p of payments) {
      if (p.status === 'paid' && p.payment_date) {
        const existing = pendingByPlayer[p.player_id]
        if (existing && (!existing.lastPayment || p.payment_date > existing.lastPayment)) {
          existing.lastPayment = p.payment_date
        }
      }
    }
    return players
      .filter((pl) => pendingByPlayer[pl.id])
      .map((pl) => ({
        ...pl,
        pendingAmount: pendingByPlayer[pl.id].amount,
        lastPayment: pendingByPlayer[pl.id].lastPayment,
        firstPendingPaymentId: pendingByPlayer[pl.id].firstPendingPaymentId,
        adminComment: pendingByPlayer[pl.id].adminComment,
        specialCase: pendingByPlayer[pl.id].specialCase,
      }))
  }, [players, payments])

  // Equipos disponibles para filtrar pendientes (sólo equipos con pendientes)
  const pendingTeams = useMemo(() => {
    const teamSet = new Set<string>()
    for (const pl of pendingPlayers) {
      if (pl.teams?.name) teamSet.add(pl.teams.name)
    }
    return Array.from(teamSet).sort()
  }, [pendingPlayers])

  // Conceptos disponibles para filtrar
  const pendingConcepts = useMemo(() => {
    const set = new Set<string>()
    for (const p of payments) {
      if (p.status === 'pending' && p.concept) set.add(p.concept)
    }
    return Array.from(set).sort()
  }, [payments])

  // Mapa de jugador → conceptos pendientes (para filtrar por concepto)
  const playerConceptsMap = useMemo(() => {
    const m: Record<string, Set<string>> = {}
    for (const p of payments) {
      if (p.status === 'pending' && p.concept) {
        if (!m[p.player_id]) m[p.player_id] = new Set()
        m[p.player_id].add(p.concept)
      }
    }
    return m
  }, [payments])

  // Pendientes filtrados y ordenados
  const filteredPendingPlayers = useMemo(() => {
    let result = pendingPlayers
    if (pendingTeamFilters.size > 0) {
      result = result.filter((pl) => pl.teams?.name && pendingTeamFilters.has(pl.teams.name))
    }
    if (pendingConceptFilters.size > 0) {
      result = result.filter((pl) => {
        const playerConcepts = playerConceptsMap[pl.id]
        if (!playerConcepts) return false
        for (const c of pendingConceptFilters) {
          if (playerConcepts.has(c)) return true
        }
        return false
      })
    }
    if (pendingSearch.trim()) {
      const q = pendingSearch.toLowerCase()
      result = result.filter((pl) =>
        `${pl.first_name} ${pl.last_name}`.toLowerCase().includes(q)
      )
    }
    if (filterComment === 'with') {
      result = result.filter((pl) => pl.adminComment && pl.adminComment.trim() !== '')
    } else if (filterComment === 'without') {
      result = result.filter((pl) => !pl.adminComment || pl.adminComment.trim() === '')
    }
    return [...result].sort((a, b) => {
      if (pendingSort === 'amount_desc') return b.pendingAmount - a.pendingAmount
      if (pendingSort === 'amount_asc') return a.pendingAmount - b.pendingAmount
      if (pendingSort === 'last_payment') {
        if (!a.lastPayment && !b.lastPayment) return 0
        if (!a.lastPayment) return 1
        if (!b.lastPayment) return -1
        return a.lastPayment < b.lastPayment ? 1 : -1
      }
      // name
      return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
    })
  }, [pendingPlayers, pendingTeamFilters, pendingConceptFilters, pendingSearch, pendingSort, filterComment, playerConceptsMap])

  // Search results — only players with assigned team
  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return players
      .filter((p) => p.teams !== null) // only players with team
      .filter(
        (p) =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          p.teams?.name?.toLowerCase().includes(q) ||
          p.dni?.toLowerCase().includes(q)
      )
  }, [players, search])

  function getPlayerPendingAmount(playerId: string) {
    return payments
      .filter((p) => p.player_id === playerId && p.status === 'pending')
      .reduce((sum, p) => sum + (p.amount_due - p.amount_paid), 0)
  }

  function getPlayerPaymentHistory(playerId: string) {
    return payments.filter((p) => p.player_id === playerId).slice(0, 10)
  }

  function togglePlayerExpand(playerId: string) {
    setExpandedPlayerId((prev) => (prev === playerId ? null : playerId))
  }

  function toggleSelectPlayer(playerId: string) {
    setSelectedPlayers((prev) => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
      } else {
        next.add(playerId)
      }
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedPlayers.size === pendingPlayers.length) {
      setSelectedPlayers(new Set())
    } else {
      setSelectedPlayers(new Set(pendingPlayers.map((p) => p.id)))
    }
  }

  function handleRegisterPayment(player: PlayerRow) {
    const form = document.getElementById(`payment-form-${player.id}`) as HTMLFormElement | null
    if (!form) return

    const amount = parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value)
    const date = (form.elements.namedItem('date') as HTMLInputElement).value
    const notes = (form.elements.namedItem('notes') as HTMLInputElement).value

    if (!amount || amount <= 0) {
      toast.error('Introduce un importe valido')
      return
    }

    startTransition(async () => {
      const result = await registerPayment({
        playerId: player.id,
        playerName: `${player.first_name} ${player.last_name}`,
        teamName: player.teams?.name ?? 'Sin equipo',
        tutorEmail: player.tutor_email,
        amount,
        method: selectedMethod,
        date,
        notes,
        clubId,
        season,
      })

      if (result.success) {
        const emailMsg = result.emailSent
          ? ` Recibo enviado a ${player.tutor_email}`
          : player.tutor_email
            ? ' (email no enviado)'
            : ''
        toast.success(`Pago registrado correctamente.${emailMsg}`)
        setExpandedPlayerId(null)
      } else {
        toast.error(result.error ?? 'Error al registrar el pago')
      }
    })
  }

  function openEditModal(p: Payment) {
    setEditingPayment(p)
    setEditAmount(p.amount_paid.toString())
    setEditDate(p.payment_date ?? today)
    setEditMethod(p.payment_method ?? 'cash')
    setEditNotes(p.notes ?? '')
    setEditSeason(p.season ?? season ?? '')
    setEditSourceType('cuota')
    setEditLinkedId('')
    // Lazy-load torneos/actividades once
    if (!linkedItems) {
      setLoadingLinkedItems(true)
      getLinkedItems().then((items) => {
        setLinkedItems(items)
        setLoadingLinkedItems(false)
      }).catch(() => setLoadingLinkedItems(false))
    }
  }

  function closeEditModal() {
    setEditingPayment(null)
  }

  function handleUpdatePayment() {
    if (!editingPayment) return
    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0) {
      toast.error('Introduce un importe valido')
      return
    }
    // Resolve linked item name
    let linkedName: string | undefined
    if (editSourceType === 'torneo' && editLinkedId && linkedItems) {
      linkedName = linkedItems.torneos.find(t => t.id === editLinkedId)?.name
    } else if (editSourceType === 'actividad' && editLinkedId && linkedItems) {
      linkedName = linkedItems.actividades.find(a => a.id === editLinkedId)?.name
    }

    startTransition(async () => {
      const result = await updatePayment({
        paymentId: editingPayment.id,
        amount,
        method: editMethod,
        date: editDate,
        notes: editNotes,
        season: editSeason.trim() || undefined,
        sourceType: editSourceType !== 'cuota' ? editSourceType : undefined,
        linkedName,
      })
      if (result.success) {
        toast.success('Pago modificado correctamente')
        closeEditModal()
      } else {
        toast.error(result.error ?? 'Error al modificar el pago')
      }
    })
  }

  function handleDeletePayment(p: Payment) {
    const player = playerMap[p.player_id]
    const name = player ? `${player.first_name} ${player.last_name}` : 'este jugador'
    if (!confirm(`Borrar el pago de ${formatCurrency(p.amount_paid)} de ${name}? Esta accion no se puede deshacer.`)) {
      return
    }
    startTransition(async () => {
      const result = await deletePayment(p.id)
      if (result.success) {
        toast.success('Pago borrado correctamente')
      } else {
        toast.error(result.error ?? 'Error al borrar el pago')
      }
    })
  }

  function handleRefundPayment(p: Payment) {
    setRefundModal({ payment: p, method: p.payment_method ?? 'transfer' })
  }

  function confirmRefund() {
    if (!refundModal) return
    const { payment, method } = refundModal
    setRefundModal(null)
    startTransition(async () => {
      const result = await refundPayment(payment.id, method)
      if (result.success) toast.success('Reembolso registrado')
      else toast.error(result.error ?? 'Error al reembolsar')
    })
  }

  function handleSendReminders() {
    const ids = Array.from(selectedPlayers)
    if (ids.length === 0) return

    const BATCH_SIZE = EMAIL_BATCH_CAP
    const totalBatches = Math.ceil(ids.length / BATCH_SIZE)
    const plural = ids.length === 1 ? 'familia' : 'familias'
    const batchMsg = totalBatches > 1 ? ` en ${totalBatches} lotes automáticos` : ''

    if (!confirm(`Enviar recordatorio de pago a ${ids.length} ${plural}?${batchMsg}\n\nLos marcados como "Caso especial" se omiten automáticamente.`)) {
      return
    }

    startTransition(async () => {
      let totalSent = 0
      let totalSkippedSpecial = 0
      let totalSkippedNoEmail = 0
      let totalSkippedNoDebt = 0
      let totalFailed = 0

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE)
        const batchNum = Math.floor(i / BATCH_SIZE) + 1

        if (totalBatches > 1) {
          toast.loading(`Enviando lote ${batchNum}/${totalBatches}…`, { id: 'reminder-progress' })
        }

        const r = await sendPendingReminders(batch)

        if (!r.success && !r.sent) {
          toast.dismiss('reminder-progress')
          toast.error(r.error ?? 'Error al enviar')
          return
        }

        totalSent += r.sent ?? 0
        totalSkippedSpecial += r.skippedSpecial ?? 0
        totalSkippedNoEmail += r.skippedNoEmail ?? 0
        totalSkippedNoDebt += r.skippedNoDebt ?? 0
        totalFailed += r.failed ?? 0
      }

      toast.dismiss('reminder-progress')

      const parts: string[] = []
      if (totalSent > 0) parts.push(`${totalSent} enviado(s)`)
      if (totalSkippedSpecial > 0) parts.push(`${totalSkippedSpecial} caso especial`)
      if (totalSkippedNoEmail > 0) parts.push(`${totalSkippedNoEmail} sin email`)
      if (totalSkippedNoDebt > 0) parts.push(`${totalSkippedNoDebt} sin deuda`)
      if (totalFailed > 0) parts.push(`${totalFailed} fallidos`)
      const summary = parts.join(' · ') || 'Sin envíos'

      if (totalFailed === 0 && totalSent > 0) {
        toast.success(`Recordatorios enviados: ${summary}`)
        setSelectedPlayers(new Set())
      } else if (totalSent > 0) {
        toast.warning(`Recordatorios parciales: ${summary}`)
        setSelectedPlayers(new Set())
      } else {
        toast.error(`Sin envíos: ${summary}`)
      }
    })
  }

  function handleDownloadPendingPdf() {
    // Mapear nombres de equipo seleccionados → IDs (la API espera IDs)
    const teamIds: string[] = []
    for (const teamName of pendingTeamFilters) {
      const t = teams.find(t => t.name === teamName)
      if (t) teamIds.push(t.id)
    }
    const params = new URLSearchParams()
    if (season) params.set('season', season)
    if (teamIds.length > 0) params.set('teams', teamIds.join(','))
    if (pendingConceptFilters.size > 0) {
      params.set('concepts', Array.from(pendingConceptFilters).join(','))
    }
    // Abrir en nueva pestaña — el navegador maneja la descarga
    window.open(`/api/pdf/pending-payments?${params.toString()}`, '_blank')
  }

  function handleToggleSpecialCase(playerId: string, currentValue: boolean) {
    startTransition(async () => {
      const res = await toggleQuotaSpecialCase(playerId, !currentValue)
      if (res.success) {
        toast.success(currentValue ? 'Desmarcado caso especial' : 'Marcado como caso especial')
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error al cambiar el estado')
      }
    })
  }

  function startEditComment(paymentId: string, currentComment: string | null) {
    setEditingCommentId(paymentId)
    setCommentDraft(currentComment ?? '')
    commentSaveInProgress.current = false
  }

  function cancelEditComment() {
    commentSaveInProgress.current = true
    setEditingCommentId(null)
    setCommentDraft('')
    // reset flag after blur event fires
    setTimeout(() => { commentSaveInProgress.current = false }, 100)
  }

  function doSaveComment(paymentId: string) {
    if (commentSaveInProgress.current) return
    commentSaveInProgress.current = true
    const value = commentDraft
    setSavingCommentId(paymentId)
    setEditingCommentId(null)
    startTransition(async () => {
      const result = await updateQuotaPaymentComment(paymentId, value)
      setSavingCommentId(null)
      commentSaveInProgress.current = false
      if (result.success) {
        toast.success('Comentario guardado')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al guardar comentario')
      }
    })
  }

  function openEditPending(player: { id: string; teams: { id: string; name: string } | null; pendingAmount: number }) {
    setEditingPendingId(player.id)
    setEditPendingTeam(player.teams?.id ?? '')
    setEditPendingAmount(player.pendingAmount.toFixed(2))
  }

  function closeEditPending() {
    setEditingPendingId(null)
  }

  function handleSavePendingRow(player: { id: string; firstPendingPaymentId: string | null }) {
    startTransition(async () => {
      const promises: Promise<{ success: boolean; error?: string }>[] = []

      // Cambio de equipo
      const currentPlayer = players.find((p) => p.id === player.id)
      const currentTeamId = currentPlayer?.teams?.id ?? ''
      if (editPendingTeam !== currentTeamId) {
        promises.push(updatePlayerTeam(player.id, editPendingTeam || null, isNextSeason))
      }

      // Cambio de importe pendiente
      if (player.firstPendingPaymentId) {
        const newAmount = parseFloat(editPendingAmount)
        if (!isNaN(newAmount) && newAmount > 0) {
          promises.push(updatePendingPaymentAmount(player.firstPendingPaymentId, newAmount))
        }
      }

      const results = await Promise.all(promises)
      const failed = results.find((r) => !r.success)
      if (failed) {
        toast.error(failed.error ?? 'Error al guardar')
      } else {
        toast.success('Guardado correctamente')
        closeEditPending()
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Role warning */}
      {!canRegisterPayments && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Solo los roles <strong>Admin</strong> y <strong>Director Deportivo</strong> pueden registrar pagos.
            Puedes consultar el historial pero no registrar nuevos pagos.
          </p>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Euro className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Recaudado este mes</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaidThisMonth)}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', totalPending > 0 ? 'bg-red-100' : 'bg-muted')}>
              <AlertCircle className={cn('w-5 h-5', totalPending > 0 ? 'text-red-600' : 'text-muted-foreground')} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendiente total</p>
              <p className={cn('text-2xl font-bold', totalPending > 0 ? 'text-red-600' : '')}>{formatCurrency(totalPending)}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Jugadores con deuda</p>
              <p className="text-2xl font-bold text-orange-600">{playersWithDebtCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search section — only if user can register */}
      {canRegisterPayments && (
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold">Buscar jugador para registrar pago</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="input pl-9 w-full"
              placeholder="Buscar por nombre, equipo o DNI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {searchResults.length > 0 && (
            <div className="border rounded-lg divide-y max-h-[600px] overflow-y-auto">
              {searchResults.map((player) => {
                const pending = getPlayerPendingAmount(player.id)
                const annualQuota = getAnnualQuota(player)
                const expanded = expandedPlayerId === player.id
                return (
                  <div key={player.id}>
                    <div
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => togglePlayerExpand(player.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                          {player.first_name.charAt(0)}{player.last_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{player.first_name} {player.last_name}</p>
                          <p className="text-xs text-muted-foreground">{player.teams?.name ?? 'Sin equipo'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {annualQuota > 0 && (
                          <span className="text-xs text-muted-foreground">Cuota anual: {formatCurrency(annualQuota)}</span>
                        )}
                        {pending > 0 ? (
                          <span className="badge badge-destructive">{formatCurrency(pending)} pendiente</span>
                        ) : (
                          <span className="badge badge-success">Al corriente</span>
                        )}
                        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {expanded && (
                      <div className="px-4 pb-4 bg-muted/20 space-y-4">
                        {/* Payment history */}
                        <div>
                          <p className="text-sm font-medium mb-2 pt-3">Historial de pagos</p>
                          {getPlayerPaymentHistory(player.id).length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin pagos registrados</p>
                          ) : (
                            <div className="space-y-1">
                              {getPlayerPaymentHistory(player.id).map((p) => (
                                <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                                  <span className="text-muted-foreground">{p.payment_date ? formatDate(p.payment_date) : '—'}</span>
                                  <span className={cn('badge', p.status === 'paid' ? 'badge-success' : 'badge-warning')}>
                                    {p.status === 'paid' ? 'Pagado' : 'Pendiente'}
                                  </span>
                                  <span className="font-medium">{formatCurrency(p.amount_paid)}</span>
                                  <span className="text-muted-foreground">{METHOD_LABELS[p.payment_method ?? ''] ?? p.payment_method ?? '—'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Register payment form */}
                        <form id={`payment-form-${player.id}`} className="space-y-3 border-t pt-3" onSubmit={(e) => e.preventDefault()}>
                          <p className="text-sm font-medium">Registrar pago</p>

                          {/* Quick amount buttons */}
                          {annualQuota > 0 && (
                            <div className="space-y-1">
                              <label className="label">Importe rapido</label>
                              <div className="flex flex-wrap gap-2">
                                {earlyDiscount > 0 && (
                                  <button
                                    type="button"
                                    className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:border-green-500 hover:bg-green-50 transition-colors"
                                    onClick={() => {
                                      const input = document.querySelector(`#payment-form-${player.id} [name="amount"]`) as HTMLInputElement
                                      if (input) input.value = (annualQuota * (1 - earlyDiscount / 100)).toFixed(2)
                                    }}
                                  >
                                    Pago completo (-{earlyDiscount}%): {formatCurrency(annualQuota * (1 - earlyDiscount / 100))}
                                  </button>
                                )}
                                {installments.map((inst, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:border-primary hover:bg-primary/5 transition-colors"
                                    onClick={() => {
                                      const input = document.querySelector(`#payment-form-${player.id} [name="amount"]`) as HTMLInputElement
                                      if (input) input.value = inst.amount.toFixed(2)
                                    }}
                                  >
                                    {inst.label}: {formatCurrency(inst.amount)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="label">Importe</label>
                              <input
                                name="amount"
                                type="number"
                                step="0.01"
                                inputMode="decimal"
                                min="0"
                                className="input w-full"
                                defaultValue={pending > 0 ? pending.toFixed(2) : ''}
                                placeholder="0.00"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="label">Fecha</label>
                              <input
                                name="date"
                                type="date"
                                className="input w-full"
                                defaultValue={today}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="label">Forma de pago</label>
                            <div className="grid grid-cols-3 gap-2">
                              {PAYMENT_METHODS.map((m) => (
                                <button
                                  key={m.value}
                                  type="button"
                                  onClick={() => setSelectedMethod(m.value)}
                                  className={cn(
                                    'p-3 rounded-lg border text-sm font-medium transition-colors',
                                    selectedMethod === m.value
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-border hover:border-muted-foreground'
                                  )}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="label">Notas (opcional)</label>
                            <input name="notes" type="text" className="input w-full" placeholder="Observaciones..." />
                          </div>

                          {player.tutor_email && (
                            <p className="text-xs text-muted-foreground">
                              Se enviara recibo PDF a: <strong>{player.tutor_email}</strong>
                            </p>
                          )}

                          <button
                            type="button"
                            disabled={isPending}
                            className="btn-primary w-full"
                            onClick={() => handleRegisterPayment(player)}
                          >
                            {isPending ? 'Registrando...' : 'Registrar pago'}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {search.trim() && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No se encontraron jugadores con equipo asignado
            </p>
          )}
        </div>
      )}

      {/* Recent payments (receipt history) */}
      {recentPaidPayments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold">Ultimos pagos registrados</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jugador</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Concepto</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Importe</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Forma pago</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Recibo</th>
                  {canRegisterPayments && (
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {recentPaidPayments.map((p) => {
                  const player = playerMap[p.player_id]
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {player ? `${player.first_name} ${player.last_name}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{player?.teams?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{p.concept ?? 'Cuota'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(p.amount_paid)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{METHOD_LABELS[p.payment_method ?? ''] ?? p.payment_method ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.payment_date ? formatDate(p.payment_date) : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {p.email_sent ? (
                          <span className="text-green-600 text-xs font-medium">Enviado</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      {canRegisterPayments && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => openEditModal(p)}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                              title="Modificar pago"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {p.status !== 'refunded' && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleRefundPayment(p)}
                                className="p-1.5 rounded hover:bg-yellow-50 text-muted-foreground hover:text-yellow-700 transition-colors text-xs font-medium"
                                title="Reembolsar (genera movimiento negativo en caja)"
                              >
                                ↩
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleDeletePayment(p)}
                              className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                              title="Borrar pago"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending payments table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold">Pagos pendientes ({filteredPendingPlayers.length}{filteredPendingPlayers.length !== pendingPlayers.length ? ` de ${pendingPlayers.length}` : ''})</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleDownloadPendingPdf()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
                title="Descargar PDF con los pendientes filtrados"
              >
                <FileDown className="w-4 h-4" />
                PDF ({filteredPendingPlayers.length})
              </button>
              {selectedPlayers.size > 0 && canRegisterPayments && (
                <button
                  disabled={isPending}
                  onClick={handleSendReminders}
                  className="btn-secondary gap-2 flex items-center text-sm"
                >
                  <Mail className="w-4 h-4" />
                  Enviar aviso ({selectedPlayers.size})
                </button>
              )}
            </div>
          </div>
          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              className="input text-sm py-1.5 px-3 w-44"
              placeholder="Buscar jugador..."
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
            />

            {/* Multi-select equipos */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setTeamFilterOpen(o => !o); setConceptFilterOpen(false) }}
                className="input text-sm py-1.5 px-3 w-52 text-left flex items-center justify-between hover:border-primary/40"
              >
                <span className="truncate">
                  {pendingTeamFilters.size === 0
                    ? 'Todos los equipos'
                    : pendingTeamFilters.size === 1
                      ? Array.from(pendingTeamFilters)[0]
                      : `${pendingTeamFilters.size} equipos seleccionados`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" />
              </button>
              {teamFilterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setTeamFilterOpen(false)} />
                  <div className="absolute z-20 mt-1 w-64 max-h-72 overflow-auto bg-background border rounded-md shadow-lg">
                    <div className="sticky top-0 bg-background border-b px-3 py-2 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => setPendingTeamFilters(new Set(pendingTeams))}
                        className="text-primary hover:underline"
                      >Seleccionar todos</button>
                      <button
                        type="button"
                        onClick={() => setPendingTeamFilters(new Set())}
                        className="text-muted-foreground hover:underline"
                      >Limpiar</button>
                    </div>
                    {pendingTeams.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3">Sin equipos con pendientes</p>
                    ) : (
                      pendingTeams.map(t => {
                        const checked = pendingTeamFilters.has(t)
                        return (
                          <label key={t} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/40 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setPendingTeamFilters(prev => {
                                  const next = new Set(prev)
                                  if (checked) next.delete(t)
                                  else next.add(t)
                                  return next
                                })
                              }}
                              className="rounded"
                            />
                            <span className="truncate">{t}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Multi-select conceptos */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setConceptFilterOpen(o => !o); setTeamFilterOpen(false) }}
                className="input text-sm py-1.5 px-3 w-52 text-left flex items-center justify-between hover:border-primary/40"
                disabled={pendingConcepts.length === 0}
              >
                <span className="truncate">
                  {pendingConceptFilters.size === 0
                    ? `Todas las cuotas${pendingConcepts.length === 0 ? '' : ` (${pendingConcepts.length})`}`
                    : pendingConceptFilters.size === 1
                      ? Array.from(pendingConceptFilters)[0]
                      : `${pendingConceptFilters.size} cuotas`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" />
              </button>
              {conceptFilterOpen && pendingConcepts.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setConceptFilterOpen(false)} />
                  <div className="absolute z-20 mt-1 w-72 max-h-72 overflow-auto bg-background border rounded-md shadow-lg">
                    <div className="sticky top-0 bg-background border-b px-3 py-2 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => setPendingConceptFilters(new Set(pendingConcepts))}
                        className="text-primary hover:underline"
                      >Seleccionar todos</button>
                      <button
                        type="button"
                        onClick={() => setPendingConceptFilters(new Set())}
                        className="text-muted-foreground hover:underline"
                      >Limpiar</button>
                    </div>
                    {pendingConcepts.map(c => {
                      const checked = pendingConceptFilters.has(c)
                      return (
                        <label key={c} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/40 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setPendingConceptFilters(prev => {
                                const next = new Set(prev)
                                if (checked) next.delete(c)
                                else next.add(c)
                                return next
                              })
                            }}
                            className="rounded"
                          />
                          <span className="truncate">{c}</span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            <select
              className="input text-sm py-1.5 px-3 w-44"
              value={pendingSort}
              onChange={(e) => setPendingSort(e.target.value as typeof pendingSort)}
            >
              <option value="amount_desc">Mayor deuda primero</option>
              <option value="amount_asc">Menor deuda primero</option>
              <option value="name">Nombre A→Z</option>
              <option value="last_payment">Último pago reciente</option>
            </select>

            {/* Filtro comentarios */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                type="button"
                onClick={() => setFilterComment('')}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${filterComment === '' ? 'bg-white text-slate-900 font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFilterComment(filterComment === 'with' ? '' : 'with')}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${filterComment === 'with' ? 'bg-white text-primary font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                title="Solo con comentario"
              >
                💬 Con comentario
              </button>
              <button
                type="button"
                onClick={() => setFilterComment(filterComment === 'without' ? '' : 'without')}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${filterComment === 'without' ? 'bg-white text-slate-700 font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                title="Solo sin comentario"
              >
                Sin comentario
              </button>
            </div>

            {(pendingTeamFilters.size > 0 || pendingConceptFilters.size > 0 || pendingSearch || filterComment) && (
              <button
                type="button"
                onClick={() => { setPendingTeamFilters(new Set()); setPendingConceptFilters(new Set()); setPendingSearch(''); setFilterComment('') }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {canRegisterPayments && (
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleSelectAll}>
                      {selectedPlayers.size === pendingPlayers.length && pendingPlayers.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </th>
                )}
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jugador</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pendiente</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ultimo pago</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contacto</th>
                {canRegisterPayments && (
                  <th className="text-center px-2 py-3 font-medium text-muted-foreground" title="Caso especial: no se envía recordatorio bulk">
                    Esp.
                  </th>
                )}
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Comentario</th>
                {canRegisterPayments && <th className="w-10 px-2 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {filteredPendingPlayers.map((player) => {
                const isEditingRow = editingPendingId === player.id
                return (
                  <React.Fragment key={player.id}>
                    <tr className={cn(
                      'border-b hover:bg-muted/20 transition-colors',
                      player.specialCase && 'bg-amber-50/50 opacity-80'
                    )}>
                      {canRegisterPayments && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleSelectPlayer(player.id)}
                            disabled={player.specialCase}
                            title={player.specialCase ? 'Caso especial — excluido del bulk' : ''}
                          >
                            {selectedPlayers.has(player.id) ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className={cn(
                                'w-4 h-4',
                                player.specialCase ? 'text-muted-foreground/30' : 'text-muted-foreground'
                              )} />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/jugadores/${player.id}`}
                          className="hover:text-primary hover:underline inline-flex items-center gap-1"
                          title="Ver ficha del jugador"
                        >
                          {player.first_name} {player.last_name}
                          <ExternalLink className="w-3 h-3 opacity-40" />
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{player.teams?.name ?? <span className="text-amber-600 text-xs font-medium">Sin equipo</span>}</td>
                      <td className="px-4 py-3 text-red-600 font-semibold">{formatCurrency(player.pendingAmount)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{player.lastPayment ? formatDate(player.lastPayment) : '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="space-y-0.5">
                          {player.tutor_name && (
                            <div className="text-foreground font-medium truncate max-w-[160px]" title={player.tutor_name}>
                              {player.tutor_name}
                            </div>
                          )}
                          {player.tutor_email ? (
                            <a
                              href={`mailto:${player.tutor_email}`}
                              className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 truncate max-w-[180px]"
                              title={player.tutor_email}
                            >
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate">{player.tutor_email}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground/60">Sin email</span>
                          )}
                          {player.tutor_phone && (
                            <a
                              href={`tel:${player.tutor_phone}`}
                              className="text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                              title="Llamar"
                            >
                              <Phone className="w-3 h-3 shrink-0" />
                              {player.tutor_phone}
                            </a>
                          )}
                        </div>
                      </td>
                      {canRegisterPayments && (
                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSpecialCase(player.id, player.specialCase)}
                            disabled={isPending}
                            className={cn(
                              'inline-flex items-center justify-center w-6 h-6 rounded transition-colors',
                              player.specialCase
                                ? 'bg-amber-500 text-white hover:bg-amber-600'
                                : 'border border-muted-foreground/30 text-muted-foreground/40 hover:border-amber-500 hover:text-amber-500'
                            )}
                            title={player.specialCase
                              ? 'Caso especial — clic para desmarcar y permitir bulk reminder'
                              : 'Marcar como caso especial (no se envía recordatorio bulk)'}
                            aria-label={player.specialCase ? 'Caso especial activo' : 'Marcar caso especial'}
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-2 min-w-[180px]">
                        {player.firstPendingPaymentId && (
                          editingCommentId === player.firstPendingPaymentId ? (
                            <input
                              autoFocus
                              type="text"
                              className="input text-xs w-full"
                              value={commentDraft}
                              onChange={(e) => setCommentDraft(e.target.value)}
                              onBlur={() => doSaveComment(player.firstPendingPaymentId!)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); doSaveComment(player.firstPendingPaymentId!) }
                                if (e.key === 'Escape') cancelEditComment()
                              }}
                              placeholder="Escribe una nota..."
                            />
                          ) : savingCommentId === player.firstPendingPaymentId ? (
                            <span className="text-xs text-muted-foreground italic">Guardando...</span>
                          ) : (
                            <button
                              type="button"
                              className="text-xs text-left w-full min-h-[28px] px-2 py-1 rounded hover:bg-muted/50 transition-colors group"
                              onClick={() => startEditComment(player.firstPendingPaymentId!, player.adminComment)}
                              title="Haz clic para añadir o editar el comentario"
                            >
                              {player.adminComment ? (
                                <span className="text-foreground">{player.adminComment}</span>
                              ) : (
                                <span className="text-muted-foreground/40 italic group-hover:text-muted-foreground transition-colors">Añadir nota...</span>
                              )}
                            </button>
                          )
                        )}
                      </td>
                      {canRegisterPayments && (
                        <td className="px-2 py-3">
                          <button
                            type="button"
                            onClick={() => isEditingRow ? closeEditPending() : openEditPending(player)}
                            className={cn(
                              'p-1.5 rounded transition-colors',
                              isEditingRow
                                ? 'bg-muted text-primary'
                                : 'hover:bg-muted text-muted-foreground hover:text-primary'
                            )}
                            title={isEditingRow ? 'Cancelar edición' : 'Editar equipo e importe'}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                    {/* Fila de edición expandida */}
                    {isEditingRow && (
                      <tr className="border-b bg-blue-50/50">
                        <td colSpan={canRegisterPayments ? 9 : 7} className="px-4 py-3">
                          <div className="flex flex-wrap items-end gap-3">
                            {/* Selector de equipo */}
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">Equipo</label>
                              <select
                                className="input text-sm py-1.5 px-3 min-w-[180px]"
                                value={editPendingTeam}
                                onChange={(e) => setEditPendingTeam(e.target.value)}
                              >
                                <option value="">Sin equipo</option>
                                {teams.map((t) => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                            {/* Importe pendiente */}
                            {player.firstPendingPaymentId && (
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Importe pendiente (€)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  inputMode="decimal"
                                  min="0"
                                  className="input text-sm py-1.5 px-3 w-32"
                                  value={editPendingAmount}
                                  onChange={(e) => setEditPendingAmount(e.target.value)}
                                />
                              </div>
                            )}
                            {/* Botones */}
                            <div className="flex gap-2 pb-0.5">
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleSavePendingRow(player)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                                {isPending ? 'Guardando…' : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                onClick={closeEditPending}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm text-muted-foreground hover:bg-muted transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                                Cancelar
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
              {filteredPendingPlayers.length === 0 && (
                <tr>
                  <td colSpan={canRegisterPayments ? 9 : 7} className="px-4 py-12 text-center text-muted-foreground">
                    {pendingPlayers.length === 0 ? 'No hay pagos pendientes' : 'Ningún resultado para los filtros aplicados'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit payment modal */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeEditModal} role="dialog" aria-modal="true" aria-labelledby="edit-payment-modal-title">
          <div
            className="bg-background rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 id="edit-payment-modal-title" className="text-lg font-semibold">Modificar pago</h3>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const player = playerMap[editingPayment.player_id]
              return player ? (
                <p className="text-sm text-muted-foreground">
                  {player.first_name} {player.last_name} — {player.teams?.name ?? 'Sin equipo'}
                </p>
              ) : null
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="label">Importe</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  min="0"
                  className="input w-full"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="label">Fecha</label>
                <input
                  type="date"
                  className="input w-full"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="label">Forma de pago</label>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setEditMethod(m.value)}
                    className={cn(
                      'p-2 rounded-lg border text-sm font-medium transition-colors',
                      editMethod === m.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-muted-foreground'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="label">Notas</label>
              <input
                type="text"
                className="input w-full"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Observaciones..."
              />
            </div>

            <div className="space-y-1">
              <label className="label">Temporada</label>
              <input
                type="text"
                className="input w-full font-mono"
                value={editSeason}
                onChange={(e) => setEditSeason(e.target.value)}
                placeholder="p.ej. 2025/26"
              />
              <p className="text-xs text-muted-foreground">Cambiar la temporada no reenvía ningún email.</p>
            </div>

            <div className="space-y-1">
              <label className="label">Reasignar como</label>
              <div className="grid grid-cols-3 gap-2">
                {(['cuota', 'torneo', 'actividad'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { setEditSourceType(type); setEditLinkedId('') }}
                    className={cn(
                      'p-2 rounded-lg border text-sm font-medium capitalize transition-colors',
                      editSourceType === type
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-muted-foreground'
                    )}
                  >
                    {type === 'cuota' ? 'Cuota' : type === 'torneo' ? 'Torneo' : 'Actividad'}
                  </button>
                ))}
              </div>
              {editSourceType !== 'cuota' && (
                <div className="mt-2">
                  {loadingLinkedItems ? (
                    <p className="text-xs text-muted-foreground">Cargando...</p>
                  ) : (
                    <select
                      className="input w-full"
                      value={editLinkedId}
                      onChange={(e) => setEditLinkedId(e.target.value)}
                    >
                      <option value="">— Seleccionar {editSourceType} —</option>
                      {editSourceType === 'torneo'
                        ? (linkedItems?.torneos ?? []).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))
                        : (linkedItems?.actividades ?? []).map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))
                      }
                    </select>
                  )}
                  {!loadingLinkedItems && editSourceType === 'torneo' && (linkedItems?.torneos ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">No hay torneos activos.</p>
                  )}
                  {!loadingLinkedItems && editSourceType === 'actividad' && (linkedItems?.actividades ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">No hay actividades activas.</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={closeEditModal}
                className="btn-secondary flex-1"
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpdatePayment}
                className="btn-primary flex-1"
                disabled={isPending || (editSourceType !== 'cuota' && !editLinkedId)}
              >
                {isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Reembolso — reemplaza prompt() */}
      {refundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRefundModal(null)} role="dialog" aria-modal="true" aria-labelledby="refund-modal-title">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 id="refund-modal-title" className="font-semibold text-gray-900 mb-1">Registrar reembolso</h3>
            {(() => {
              const p = refundModal.payment
              const pl = playerMap[p.player_id]
              return (
                <p className="text-sm text-gray-500 mb-4">
                  {formatCurrency(p.amount_paid)} → {pl ? `${pl.first_name} ${pl.last_name}` : 'jugador'}
                </p>
              )
            })()}
            <p className="text-xs font-medium text-gray-600 mb-2">Método del reembolso</p>
            <div className="flex gap-2 mb-5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setRefundModal({ ...refundModal, method: m.value })}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${refundModal.method === m.value ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 hover:border-primary/50'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRefundModal(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">Cancelar</button>
              <button onClick={confirmRefund} disabled={isPending} className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50">Reembolsar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
