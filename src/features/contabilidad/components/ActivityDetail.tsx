'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Check, Euro, Receipt } from 'lucide-react'
import {
  addCharge,
  deleteCharge,
  markChargePaid,
  addActivityExpense,
  deleteActivityExpense,
  type Activity,
  type ActivityCharge,
  type ActivityExpense,
} from '../actions/activities.actions'
import { formatCurrency, formatDate } from '@/lib/utils/currency'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
}

interface Props {
  activity: Activity
  charges: ActivityCharge[]
  expenses: ActivityExpense[]
  players: Array<{ id: string; first_name: string; last_name: string }>
}

export function ActivityDetail({ activity, charges, expenses, players }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'charges' | 'expenses'>('charges')
  const [isPending, startTransition] = useTransition()

  // Charge form
  const [useExisting, setUseExisting] = useState(true)
  const [playerId, setPlayerId] = useState('')
  const [participantName, setParticipantName] = useState('')
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState('')
  const [markPaid, setMarkPaid] = useState(true)
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))

  // Expense form
  const [expConcept, setExpConcept] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expCategory, setExpCategory] = useState('')
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10))

  const totals = useMemo(() => {
    let income = 0, paid = 0, pending = 0, expense = 0
    for (const c of charges) {
      const a = Number(c.amount)
      income += a
      if (c.paid) paid += a
      else pending += a
    }
    for (const e of expenses) expense += Number(e.amount)
    return { income, paid, pending, expense, balance: paid - expense }
  }, [charges, expenses])

  const playerMap: Record<string, string> = {}
  for (const p of players) playerMap[p.id] = `${p.first_name} ${p.last_name}`

  function handleAddCharge() {
    const amt = parseFloat(amount)
    if (!amt || amt < 0) {
      toast.error('Importe inválido')
      return
    }
    if (useExisting && !playerId) {
      toast.error('Selecciona jugador')
      return
    }
    if (!useExisting && !participantName.trim()) {
      toast.error('Escribe el nombre del participante')
      return
    }
    startTransition(async () => {
      const res = await addCharge({
        activityId: activity.id,
        playerId: useExisting ? playerId : null,
        participantName: useExisting ? null : participantName,
        concept: concept || undefined,
        amount: amt,
        paid: markPaid,
        paymentMethod: markPaid ? method : null,
        paymentDate: markPaid ? paymentDate : null,
      })
      if (res.success) {
        toast.success('Cobro añadido')
        setParticipantName('')
        setPlayerId('')
        setConcept('')
        setAmount('')
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  function handleMarkPaid(c: ActivityCharge) {
    const m = prompt('Método de pago: cash, card, transfer', 'cash')
    if (!m || !['cash', 'card', 'transfer'].includes(m)) return
    startTransition(async () => {
      const res = await markChargePaid(c.id, m as 'cash' | 'card' | 'transfer')
      if (res.success) {
        toast.success('Marcado como pagado')
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  function handleDeleteCharge(c: ActivityCharge) {
    if (!confirm('¿Eliminar este cobro?')) return
    startTransition(async () => {
      const res = await deleteCharge(c.id)
      if (res.success) {
        toast.success('Eliminado')
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  function handleAddExpense() {
    const amt = parseFloat(expAmount)
    if (!expConcept.trim() || !amt || amt <= 0) {
      toast.error('Datos inválidos')
      return
    }
    startTransition(async () => {
      const res = await addActivityExpense({
        activityId: activity.id,
        concept: expConcept,
        amount: amt,
        category: expCategory || undefined,
        expenseDate: expDate,
      })
      if (res.success) {
        toast.success('Gasto añadido')
        setExpConcept('')
        setExpAmount('')
        setExpCategory('')
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  function handleDeleteExpense(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    startTransition(async () => {
      const res = await deleteActivityExpense(id)
      if (res.success) {
        toast.success('Eliminado')
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/contabilidad/actividades" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Cobrado" value={formatCurrency(totals.paid)} color="emerald" icon={Euro} />
        <KPI label="Pendiente" value={formatCurrency(totals.pending)} color="amber" icon={Euro} />
        <KPI label="Gastos" value={formatCurrency(totals.expense)} color="red" icon={Receipt} />
        <KPI
          label="Balance"
          value={formatCurrency(totals.balance)}
          color={totals.balance >= 0 ? 'emerald' : 'red'}
          icon={Euro}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-6">
        <button
          onClick={() => setTab('charges')}
          className={`pb-2 text-sm font-medium ${tab === 'charges' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'}`}
        >
          Cobros ({charges.length})
        </button>
        <button
          onClick={() => setTab('expenses')}
          className={`pb-2 text-sm font-medium ${tab === 'expenses' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'}`}
        >
          Gastos ({expenses.length})
        </button>
      </div>

      {tab === 'charges' && (
        <>
          {/* Add charge */}
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-sm">Añadir cobro</h3>
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => setUseExisting(true)}
                className={`px-3 py-1 rounded ${useExisting ? 'bg-primary text-white' : 'bg-gray-100'}`}
              >
                Jugador del club
              </button>
              <button
                onClick={() => setUseExisting(false)}
                className={`px-3 py-1 rounded ${!useExisting ? 'bg-primary text-white' : 'bg-gray-100'}`}
              >
                Participante externo
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {useExisting ? (
                <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="input">
                  <option value="">— Selecciona jugador —</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Nombre del participante"
                  className="input"
                />
              )}
              <input
                type="text"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Concepto"
                className="input"
              />
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Importe"
                className="input"
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={markPaid}
                  onChange={(e) => setMarkPaid(e.target.checked)}
                />
                Marcar como pagado
              </label>
              {markPaid && (
                <>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as typeof method)}
                    className="input w-auto text-sm"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="card">Tarjeta</option>
                    <option value="transfer">Transferencia</option>
                  </select>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="input w-auto text-sm"
                  />
                </>
              )}
              <button onClick={handleAddCharge} disabled={isPending} className="btn-primary ml-auto flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Añadir
              </button>
            </div>
          </div>

          {/* List */}
          <div className="card divide-y">
            {charges.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Sin cobros todavía.</p>
            ) : (
              charges.map((c) => (
                <div key={c.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {c.player_id ? playerMap[c.player_id] ?? '—' : c.participant_name}
                      {c.concept && <span className="text-muted-foreground"> · {c.concept}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.paid
                        ? `Pagado ${formatDate(c.payment_date ?? '')} · ${METHOD_LABELS[c.payment_method ?? ''] ?? ''}`
                        : 'Pendiente'}
                    </p>
                  </div>
                  <p className="font-semibold">{formatCurrency(Number(c.amount))}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      c.paid
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {c.paid ? 'Pagado' : 'Pendiente'}
                  </span>
                  {!c.paid && (
                    <button
                      onClick={() => handleMarkPaid(c)}
                      disabled={isPending}
                      className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded"
                      title="Marcar pagado"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteCharge(c)}
                    disabled={isPending}
                    className="text-red-600 hover:bg-red-50 p-1.5 rounded"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === 'expenses' && (
        <>
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-sm">Añadir gasto</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                type="text"
                value={expConcept}
                onChange={(e) => setExpConcept(e.target.value)}
                placeholder="Concepto"
                className="input"
              />
              <input
                type="text"
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                placeholder="Categoría (opcional)"
                className="input"
              />
              <input
                type="number"
                step="0.01"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="Importe"
                className="input"
              />
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="input"
              />
            </div>
            <div className="flex justify-end">
              <button onClick={handleAddExpense} disabled={isPending} className="btn-primary flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Añadir gasto
              </button>
            </div>
          </div>

          <div className="card divide-y">
            {expenses.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Sin gastos todavía.</p>
            ) : (
              expenses.map((e) => (
                <div key={e.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{e.concept}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.expense_date)}
                      {e.category && ` · ${e.category}`}
                    </p>
                  </div>
                  <p className="font-semibold text-red-700">{formatCurrency(Number(e.amount))}</p>
                  <button
                    onClick={() => handleDeleteExpense(e.id)}
                    disabled={isPending}
                    className="text-red-600 hover:bg-red-50 p-1.5 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

function KPI({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string
  value: string
  color: 'emerald' | 'amber' | 'red'
  icon: typeof Euro
}) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}
