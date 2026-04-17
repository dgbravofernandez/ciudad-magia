'use client'
import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Check, Euro, Users, Wallet, TrendingUp, TrendingDown, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import {
  upsertTournamentBudget,
  addBudgetItem,
  removeBudgetItem,
  markBudgetItemPaid,
  addAttendee,
  removeAttendee,
  updateAttendeeAmount,
  markAttendeePaid,
  refundAttendee,
  type PayMethod,
} from '@/features/torneos/actions/tournament.actions'

interface Tournament {
  id: string
  name: string
  category: string | null
  start_date: string | null
  end_date: string | null
  location: string | null
  status: 'upcoming' | 'in_progress' | 'finished'
}

interface Budget {
  id: string
  tournament_id: string
  organizer_cost: number
  margin_pct: number
  estimated_players: number
  price_mode: 'auto' | 'manual'
  price_manual: number | null
  notes: string | null
}

interface BudgetItem {
  id: string
  name: string
  amount: number
  is_paid: boolean
  payment_method: PayMethod | null
  paid_at: string | null
}

interface Player {
  id: string
  first_name: string
  last_name: string
  team_id: string | null
  teams: { name: string } | null
}

interface Attendee {
  id: string
  player_id: string
  amount_due: number
  payment_status: 'pending' | 'paid' | 'cancelled'
  payment_method: PayMethod | null
  paid_at: string | null
  player: Player
}

interface Props {
  torneo: Tournament
  budget: Budget | null
  items: BudgetItem[]
  attendees: Attendee[]
  allPlayers: Player[]
}

function eur(n: number): string {
  return `${Number(n || 0).toFixed(2)} €`
}

export function TorneoExternoDetail({ torneo, budget, items, attendees, allPlayers }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Budget form state
  const [bForm, setBForm] = useState({
    organizerCost: budget?.organizer_cost ?? 0,
    marginPct: budget?.margin_pct ?? 10,
    estimatedPlayers: budget?.estimated_players ?? 0,
    priceMode: (budget?.price_mode ?? 'auto') as 'auto' | 'manual',
    priceManual: budget?.price_manual ?? 0,
    notes: budget?.notes ?? '',
  })

  // New budget item
  const [newItem, setNewItem] = useState({ name: '', amount: 0 })

  // Attendee add
  const [addingAttendee, setAddingAttendee] = useState(false)
  const [newAttendee, setNewAttendee] = useState({ playerId: '', amountDue: 0 })

  // Pay modals
  const [payItemTarget, setPayItemTarget] = useState<BudgetItem | null>(null)
  const [payItemMethod, setPayItemMethod] = useState<PayMethod>('transfer')
  const [payAttTarget, setPayAttTarget] = useState<Attendee | null>(null)
  const [payAttMethod, setPayAttMethod] = useState<PayMethod>('cash')

  // Computed values
  const totalExpenses = useMemo(
    () => Number(bForm.organizerCost || 0) + items.reduce((s, i) => s + Number(i.amount || 0), 0),
    [bForm.organizerCost, items]
  )

  const pricePerPlayerAuto = useMemo(() => {
    const est = Math.max(1, bForm.estimatedPlayers || 1)
    return (totalExpenses * (1 + (bForm.marginPct || 0) / 100)) / est
  }, [totalExpenses, bForm.estimatedPlayers, bForm.marginPct])

  const effectivePrice = bForm.priceMode === 'manual' ? Number(bForm.priceManual || 0) : pricePerPlayerAuto

  const totalIncome = useMemo(
    () => attendees.filter(a => a.payment_status === 'paid').reduce((s, a) => s + Number(a.amount_due || 0), 0),
    [attendees]
  )
  const totalPending = useMemo(
    () => attendees.filter(a => a.payment_status === 'pending').reduce((s, a) => s + Number(a.amount_due || 0), 0),
    [attendees]
  )
  const paidExpenses = useMemo(
    () => items.filter(i => i.is_paid).reduce((s, i) => s + Number(i.amount || 0), 0),
    [items]
  )
  const balance = totalIncome - paidExpenses

  // Players not yet attending
  const availablePlayers = allPlayers.filter(p => !attendees.some(a => a.player_id === p.id))

  // ----- Actions -----
  function saveBudget() {
    startTransition(async () => {
      const r = await upsertTournamentBudget({
        tournamentId: torneo.id,
        organizerCost: Number(bForm.organizerCost || 0),
        marginPct: Number(bForm.marginPct || 0),
        estimatedPlayers: Number(bForm.estimatedPlayers || 0),
        priceMode: bForm.priceMode,
        priceManual: bForm.priceMode === 'manual' ? Number(bForm.priceManual || 0) : null,
        notes: bForm.notes || null,
      })
      if (r.success) { toast.success('Presupuesto guardado'); router.refresh() }
      else toast.error(r.error ?? 'Error')
    })
  }

  function handleAddItem() {
    if (!newItem.name.trim()) { toast.error('Nombre obligatorio'); return }
    startTransition(async () => {
      const r = await addBudgetItem({
        tournamentId: torneo.id,
        name: newItem.name,
        amount: Number(newItem.amount || 0),
      })
      if (r.success) { setNewItem({ name: '', amount: 0 }); router.refresh() }
      else toast.error(r.error ?? 'Error')
    })
  }

  function handleRemoveItem(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    startTransition(async () => {
      const r = await removeBudgetItem(id, torneo.id)
      if (r.success) router.refresh()
      else toast.error(r.error ?? 'Error')
    })
  }

  function handlePayItem() {
    if (!payItemTarget) return
    const target = payItemTarget
    startTransition(async () => {
      const r = await markBudgetItemPaid(target.id, torneo.id, payItemMethod)
      if (r.success) {
        toast.success('Gasto registrado en contabilidad')
        setPayItemTarget(null)
        router.refresh()
      } else toast.error(r.error ?? 'Error')
    })
  }

  function handleAddAttendee() {
    if (!newAttendee.playerId) { toast.error('Elige un jugador'); return }
    const amount = Number(newAttendee.amountDue || 0) || effectivePrice
    startTransition(async () => {
      const r = await addAttendee({
        tournamentId: torneo.id,
        playerId: newAttendee.playerId,
        amountDue: amount,
      })
      if (r.success) {
        setNewAttendee({ playerId: '', amountDue: 0 })
        setAddingAttendee(false)
        router.refresh()
      } else toast.error(r.error ?? 'Error')
    })
  }

  function handleRemoveAttendee(id: string) {
    if (!confirm('¿Quitar jugador del torneo?')) return
    startTransition(async () => {
      const r = await removeAttendee(id, torneo.id)
      if (r.success) router.refresh()
      else toast.error(r.error ?? 'Error')
    })
  }

  function handleUpdateAmount(id: string, amount: number) {
    startTransition(async () => {
      const r = await updateAttendeeAmount(id, torneo.id, amount)
      if (!r.success) toast.error(r.error ?? 'Error')
    })
  }

  function handlePayAttendee() {
    if (!payAttTarget) return
    const target = payAttTarget
    startTransition(async () => {
      const r = await markAttendeePaid(target.id, torneo.id, payAttMethod)
      if (r.success) {
        toast.success('Pago registrado en caja')
        setPayAttTarget(null)
        router.refresh()
      } else toast.error(r.error ?? 'Error')
    })
  }

  function handleRefundAttendee(id: string) {
    if (!confirm('¿Devolver el pago? Se creará un movimiento negativo en caja.')) return
    startTransition(async () => {
      const r = await refundAttendee(id, torneo.id)
      if (r.success) { toast.success('Devolución registrada'); router.refresh() }
      else toast.error(r.error ?? 'Error')
    })
  }

  const budgetDirty =
    Number(bForm.organizerCost) !== Number(budget?.organizer_cost ?? 0) ||
    Number(bForm.marginPct) !== Number(budget?.margin_pct ?? 10) ||
    Number(bForm.estimatedPlayers) !== Number(budget?.estimated_players ?? 0) ||
    bForm.priceMode !== (budget?.price_mode ?? 'auto') ||
    Number(bForm.priceManual) !== Number(budget?.price_manual ?? 0) ||
    (bForm.notes || '') !== (budget?.notes || '')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <Link href="/torneos" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-3">
        <ArrowLeft className="w-4 h-4" /> Torneos
      </Link>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{torneo.name}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-700">✈️ Externo</span>
          </div>
          <p className="text-sm text-gray-500">
            {torneo.category ?? '—'}
            {torneo.location && ` · ${torneo.location}`}
            {torneo.start_date && ` · ${torneo.start_date}`}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi label="Gastos totales" value={eur(totalExpenses)} color="#dc2626" bg="#fee2e2" icon={TrendingDown} />
        <Kpi label="Precio/jugador" value={eur(effectivePrice)} color="#2563eb" bg="#dbeafe" icon={Euro} />
        <Kpi label="Cobrado" value={eur(totalIncome)} color="#059669" bg="#d1fae5" icon={TrendingUp} />
        <Kpi label="Balance" value={eur(balance)} color={balance >= 0 ? '#059669' : '#dc2626'} bg={balance >= 0 ? '#d1fae5' : '#fee2e2'} icon={Wallet} />
      </div>

      {/* Budget card */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Euro className="w-4 h-4" /> Presupuesto</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Field label="Coste organizador (€)">
            <input type="number" min={0} step={0.01} value={bForm.organizerCost} onChange={e => setBForm(f => ({ ...f, organizerCost: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Nº jugadores estimados">
            <input type="number" min={0} value={bForm.estimatedPlayers} onChange={e => setBForm(f => ({ ...f, estimatedPlayers: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Margen (%)">
            <input type="number" min={0} step={0.5} value={bForm.marginPct} onChange={e => setBForm(f => ({ ...f, marginPct: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" disabled={bForm.priceMode === 'manual'} />
          </Field>
          <Field label="Modo precio">
            <select value={bForm.priceMode} onChange={e => setBForm(f => ({ ...f, priceMode: e.target.value as 'auto' | 'manual' }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="auto">Automático (fórmula)</option>
              <option value="manual">Manual (fijo)</option>
            </select>
          </Field>
        </div>
        {bForm.priceMode === 'manual' && (
          <Field label="Precio manual por jugador (€)">
            <input type="number" min={0} step={0.01} value={bForm.priceManual} onChange={e => setBForm(f => ({ ...f, priceManual: Number(e.target.value) }))} className="w-full md:w-60 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
        )}
        <div className="mt-3 bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
          <div>Suma gastos totales: <strong>{eur(totalExpenses)}</strong></div>
          <div>Con margen {bForm.marginPct}%: <strong>{eur(totalExpenses * (1 + (bForm.marginPct || 0) / 100))}</strong></div>
          <div>Precio/jugador auto ({bForm.estimatedPlayers || 0} jugadores): <strong>{eur(pricePerPlayerAuto)}</strong></div>
          <div className="mt-1 pt-1 border-t border-gray-200">Precio efectivo aplicado: <strong className="text-blue-700">{eur(effectivePrice)}</strong></div>
        </div>
        {budgetDirty && (
          <button onClick={saveBudget} disabled={isPending} className="mt-4 px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
            {isPending ? 'Guardando...' : 'Guardar presupuesto'}
          </button>
        )}
      </section>

      {/* Expenses list */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Gastos adicionales (bus, hotel, comidas…)</h2>
        <div className="space-y-2 mb-4">
          {items.length === 0 && <p className="text-sm text-gray-400">Sin gastos adicionales.</p>}
          {items.map(i => (
            <div key={i.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{i.name}</div>
                <div className="text-xs text-gray-500">
                  {i.is_paid ? `Pagado (${i.payment_method}) el ${i.paid_at?.slice(0, 10)}` : 'Pendiente'}
                </div>
              </div>
              <div className="font-semibold">{eur(i.amount)}</div>
              {!i.is_paid ? (
                <button onClick={() => { setPayItemTarget(i); setPayItemMethod('transfer') }} disabled={isPending} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100">
                  <Check className="w-3 h-3 inline" /> Marcar pagado
                </button>
              ) : (
                <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">Pagado</span>
              )}
              <button onClick={() => handleRemoveItem(i.id)} disabled={isPending} className="text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Field label="Concepto" className="flex-1">
            <input value={newItem.name} onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Ej: Autobús ida/vuelta" />
          </Field>
          <Field label="Importe (€)">
            <input type="number" min={0} step={0.01} value={newItem.amount} onChange={e => setNewItem(n => ({ ...n, amount: Number(e.target.value) }))} className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <button onClick={handleAddItem} disabled={isPending} className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50">
            <Plus className="w-4 h-4 inline" /> Añadir
          </button>
        </div>
      </section>

      {/* Attendees */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4" /> Jugadores apuntados ({attendees.length})</h2>
          {!addingAttendee && (
            <button onClick={() => { setNewAttendee({ playerId: '', amountDue: effectivePrice }); setAddingAttendee(true) }} className="text-sm px-3 py-1.5 rounded-lg text-white font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
              <Plus className="w-4 h-4 inline" /> Apuntar jugador
            </button>
          )}
        </div>

        {addingAttendee && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg flex items-end gap-2">
            <Field label="Jugador" className="flex-1">
              <select value={newAttendee.playerId} onChange={e => setNewAttendee(n => ({ ...n, playerId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">— Elige —</option>
                {availablePlayers.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name}{p.teams?.name ? ` · ${p.teams.name}` : ''}</option>
                ))}
              </select>
            </Field>
            <Field label="Importe (€)">
              <input type="number" min={0} step={0.01} value={newAttendee.amountDue} onChange={e => setNewAttendee(n => ({ ...n, amountDue: Number(e.target.value) }))} className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </Field>
            <button onClick={handleAddAttendee} disabled={isPending} className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm disabled:opacity-50">Añadir</button>
            <button onClick={() => setAddingAttendee(false)} disabled={isPending} className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm">Cancelar</button>
          </div>
        )}

        {attendees.length === 0 ? (
          <p className="text-sm text-gray-400">Sin jugadores apuntados aún.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Jugador', 'Equipo', 'Importe', 'Estado', 'Método', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {attendees.map(a => {
                const isPaid = a.payment_status === 'paid'
                const isCancelled = a.payment_status === 'cancelled'
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{a.player.first_name} {a.player.last_name}</td>
                    <td className="px-3 py-2 text-gray-500">{a.player.teams?.name ?? '—'}</td>
                    <td className="px-3 py-2">
                      {isPaid || isCancelled ? (
                        <span className="font-semibold">{eur(a.amount_due)}</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          defaultValue={a.amount_due}
                          onBlur={e => {
                            const v = Number(e.target.value || 0)
                            if (v !== Number(a.amount_due)) handleUpdateAmount(a.id, v)
                          }}
                          className="w-24 border border-gray-200 rounded px-2 py-1 text-sm"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isPaid ? 'bg-green-50 text-green-700' :
                        isCancelled ? 'bg-gray-100 text-gray-500' :
                        'bg-yellow-50 text-yellow-700'
                      }`}>
                        {isPaid ? 'Pagado' : isCancelled ? 'Cancelado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{a.payment_method ?? '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {a.payment_status === 'pending' && (
                          <button onClick={() => { setPayAttTarget(a); setPayAttMethod('cash') }} disabled={isPending} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100">
                            Cobrar
                          </button>
                        )}
                        {isPaid && (
                          <button onClick={() => handleRefundAttendee(a.id)} disabled={isPending} className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100">
                            <RotateCcw className="w-3 h-3 inline" /> Devolver
                          </button>
                        )}
                        <button onClick={() => handleRemoveAttendee(a.id)} disabled={isPending} className="text-gray-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-3 py-2 font-semibold" colSpan={2}>Totales</td>
                <td className="px-3 py-2 font-semibold">{eur(totalIncome + totalPending)}</td>
                <td className="px-3 py-2 text-xs text-gray-500">Cobrado: {eur(totalIncome)} / Pendiente: {eur(totalPending)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      {/* Pay item modal */}
      {payItemTarget && (
        <PayModal
          title="Pagar gasto del torneo"
          subtitle={`${payItemTarget.name} · ${eur(payItemTarget.amount)}`}
          method={payItemMethod}
          setMethod={setPayItemMethod}
          defaultMethod="transfer"
          hint="Por defecto transferencia (no afecta al cierre de caja). Cámbialo si pagas en efectivo/tarjeta."
          onCancel={() => setPayItemTarget(null)}
          onConfirm={handlePayItem}
          pending={isPending}
        />
      )}

      {/* Pay attendee modal */}
      {payAttTarget && (
        <PayModal
          title="Cobrar a la familia"
          subtitle={`${payAttTarget.player.first_name} ${payAttTarget.player.last_name} · ${eur(payAttTarget.amount_due)}`}
          method={payAttMethod}
          setMethod={setPayAttMethod}
          defaultMethod="cash"
          hint="Efectivo/tarjeta → entra en cierre de caja. Transferencia → solo aparece en balance del torneo."
          onCancel={() => setPayAttTarget(null)}
          onConfirm={handlePayAttendee}
          pending={isPending}
        />
      )}
    </div>
  )
}

function Kpi({ label, value, color, bg, icon: Icon }: { label: string; value: string; color: string; bg: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: bg }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function PayModal({
  title, subtitle, method, setMethod, hint, onCancel, onConfirm, pending,
}: {
  title: string
  subtitle: string
  method: PayMethod
  setMethod: (m: PayMethod) => void
  defaultMethod: PayMethod
  hint: string
  onCancel: () => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className="p-6 space-y-3">
          <label className="block text-sm font-medium text-gray-700">Forma de pago</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: 'cash', label: 'Efectivo' },
              { v: 'card', label: 'Tarjeta' },
              { v: 'transfer', label: 'Transferencia' },
            ] as const).map(m => (
              <button
                key={m.v}
                onClick={() => setMethod(m.v)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${method === m.v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">{hint}</p>
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onCancel} disabled={pending} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50">Cancelar</button>
          <button onClick={onConfirm} disabled={pending} className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
            {pending ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
