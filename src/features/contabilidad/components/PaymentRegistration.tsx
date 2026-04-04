'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
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
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatCurrency, formatDate } from '@/lib/utils/currency'
import { registerPayment, sendPendingReminders } from '@/features/contabilidad/actions/accounting.actions'

interface PlayerRow {
  id: string
  first_name: string
  last_name: string
  dni: string | null
  tutor_email: string | null
  tutor_name: string | null
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
  created_at: string
}

interface Props {
  clubId: string
  totalPaidThisMonth: number
  totalPending: number
  playersWithDebtCount: number
  players: PlayerRow[]
  payments: Payment[]
}

const PAYMENT_METHODS = [
  { value: 'transferencia', label: 'Transferencia 🏦' },
  { value: 'efectivo', label: 'Efectivo 💵' },
  { value: 'tarjeta', label: 'Tarjeta 💳' },
]

export function PaymentRegistration({
  clubId,
  totalPaidThisMonth,
  totalPending,
  playersWithDebtCount,
  players,
  payments,
}: Props) {
  const [search, setSearch] = useState('')
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<string>('transferencia')
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().slice(0, 10)

  // Pending players for table
  const pendingPlayers = useMemo(() => {
    const pendingByPlayer: Record<string, { amount: number; lastPayment: string | null }> = {}
    for (const p of payments) {
      if (p.status === 'pending') {
        if (!pendingByPlayer[p.player_id]) {
          pendingByPlayer[p.player_id] = { amount: 0, lastPayment: null }
        }
        pendingByPlayer[p.player_id].amount += p.amount_due - p.amount_paid
      }
    }
    // Get last payment date per player
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
      .map((pl) => ({ ...pl, pendingAmount: pendingByPlayer[pl.id].amount, lastPayment: pendingByPlayer[pl.id].lastPayment }))
  }, [players, payments])

  // Search results
  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return players.filter(
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

  function handleRegisterPayment(playerId: string, tutorEmail: string | null) {
    const form = document.getElementById(`payment-form-${playerId}`) as HTMLFormElement | null
    if (!form) return

    const amount = parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value)
    const date = (form.elements.namedItem('date') as HTMLInputElement).value
    const notes = (form.elements.namedItem('notes') as HTMLInputElement).value

    startTransition(async () => {
      const result = await registerPayment({
        playerId,
        amount,
        method: selectedMethod,
        date,
        notes,
        clubId,
      })

      if (result.success) {
        toast.success(`✅ Pago registrado. Email de confirmación enviado a ${tutorEmail ?? 'tutor'}`)
        setExpandedPlayerId(null)
      } else {
        toast.error(result.error ?? 'Error al registrar el pago')
      }
    })
  }

  function handleSendReminders() {
    const ids = Array.from(selectedPlayers)
    if (ids.length === 0) return

    startTransition(async () => {
      const result = await sendPendingReminders(ids)
      if (result.success) {
        toast.success(`Aviso de pago enviado a ${result.count} jugador(es)`)
        setSelectedPlayers(new Set())
      } else {
        toast.error(result.error ?? 'Error al enviar avisos')
      }
    })
  }

  return (
    <div className="space-y-6">
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

      {/* Search section */}
      <div className="card p-5 space-y-3">
        <h3 className="font-semibold">Buscar jugador</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="input pl-9 w-full"
            placeholder="Buscar jugador por nombre, equipo o DNI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {searchResults.length > 0 && (
          <div className="border rounded-lg divide-y">
            {searchResults.map((player) => {
              const pending = getPlayerPendingAmount(player.id)
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
                                <span className="text-muted-foreground capitalize">{p.payment_method ?? '—'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Register payment form */}
                      <form id={`payment-form-${player.id}`} className="space-y-3 border-t pt-3" onSubmit={(e) => e.preventDefault()}>
                        <p className="text-sm font-medium">Registrar pago</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="label">Importe (€)</label>
                            <input
                              name="amount"
                              type="number"
                              step="0.01"
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
                          <label className="label">Método de pago</label>
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

                        <button
                          type="button"
                          disabled={isPending}
                          className="btn-primary w-full"
                          onClick={() => handleRegisterPayment(player.id, player.tutor_email)}
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
      </div>

      {/* Pending payments table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold">Pagos pendientes</h3>
          {selectedPlayers.size > 0 && (
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleSelectAll}>
                    {selectedPlayers.size === pendingPlayers.length && pendingPlayers.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jugador</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pendiente</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Último pago</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email tutor</th>
              </tr>
            </thead>
            <tbody>
              {pendingPlayers.map((player) => (
                <tr key={player.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => toggleSelectPlayer(player.id)}>
                      {selectedPlayers.has(player.id) ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium">{player.first_name} {player.last_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{player.teams?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-red-600 font-semibold">{formatCurrency(player.pendingAmount)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{player.lastPayment ? formatDate(player.lastPayment) : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{player.tutor_email ?? '—'}</td>
                </tr>
              ))}
              {pendingPlayers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No hay pagos pendientes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
