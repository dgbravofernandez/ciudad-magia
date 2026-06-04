'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Lock, CheckCircle, AlertTriangle, FileText, Download,
  Unlock, Pencil, Trash2, X, FileDown, Wallet, ChevronDown, Save,
  CreditCard, Banknote, ArrowLeftRight, Filter, BadgeCheck, BadgeAlert,
  PlusCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/currency'
import {
  closeCash,
  reopenCashClose,
  deletePayment,
  updatePayment,
  updateCashMovement,
  updateCashRegisterFloat,
  getClosedPeriodMovements,
  reclassifyMovement,
  registerExternalIncome,
} from '@/features/contabilidad/actions/accounting.actions'
import { useRouter } from 'next/navigation'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
}

const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Efectivo'       },
  { value: 'card',     label: 'Tarjeta'        },
  { value: 'transfer', label: 'Transferencia'  },
]

const SOURCE_LABELS: Record<string, string> = {
  cuota: 'Cuota',
  ropa: 'Ropa',
  torneo: 'Torneo',
  actividad: 'Actividad',
  gasto: 'Gasto',
  otro: 'Otro',
}

interface Movement {
  id: string
  type: string
  description: string
  amount: number
  payment_method: string
  movement_date: string
  related_payment_id: string | null
  related_expense_id: string | null
  related_activity_charge_id: string | null
  source: string | null
}

interface MovementDetail {
  id: string
  player_id: string
  player_name: string
  team_name: string
}

interface ActivityDetail {
  charge_id: string
  player_name: string
  activity_name: string
}

interface CashClose {
  id: string
  period_start: string
  period_end: string
  system_cash: number
  real_cash: number
  system_card: number
  real_card: number
  cash_difference: number
  card_difference: number
  cash_register_float: number
  notes: string | null
  closed_by: string
  created_at: string
}

interface Props {
  clubId: string
  memberId: string
  userEmail?: string
  systemCash: number
  systemCard: number
  periodStart: string
  periodEnd: string
  lastCloseAt: string | null
  closes: CashClose[]
  movements: Movement[]
  movementDetails: MovementDetail[]
  activityDetails: ActivityDetail[]
  cashRegisterFloat: number
}

const SUPER_EMAIL = 'dgbravofernandez@gmail.com'

const SOURCE_OPTIONS = [
  { value: 'cuota',     label: 'Cuota' },
  { value: 'torneo',    label: 'Torneo' },
  { value: 'actividad', label: 'Actividad' },
  { value: 'ropa',      label: 'Ropa' },
  { value: 'otro',      label: 'Otro' },
] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClosedMovement = any

export function CashRegisterPage({
  clubId,
  memberId,
  userEmail,
  systemCash,
  systemCard,
  periodStart,
  periodEnd,
  lastCloseAt,
  closes,
  movements,
  movementDetails,
  activityDetails,
  cashRegisterFloat: initialFloat,
}: Props) {
  const router = useRouter()
  const [realCash, setRealCash]      = useState('')
  const [realCard, setRealCard]      = useState('')
  const [notes, setNotes]            = useState('')
  const [isPending, startTransition] = useTransition()

  // Fondo de caja (cambio) — solo informativo
  const [floatValue, setFloatValue]     = useState(initialFloat.toFixed(2))
  const [editingFloat, setEditingFloat] = useState(false)

  // Edit-movement modal state
  const [editMovement, setEditMovement] = useState<Movement | null>(null)
  const [editAmount, setEditAmount]     = useState('')
  const [editDate, setEditDate]         = useState('')
  const [editMethod, setEditMethod]     = useState('cash')

  function handleReopen(id: string, period: string) {
    if (!confirm(`¿Reabrir el cierre del periodo ${period}?\n\nPodrás modificar pagos y gastos de ese periodo otra vez. El cierre se borrará.`)) return
    startTransition(async () => {
      const r = await reopenCashClose(id)
      if (r.success) {
        toast.success('Cierre reabierto')
        router.refresh()
      } else toast.error(r.error ?? 'Error')
    })
  }

  function openEditMovement(m: Movement) {
    setEditMovement(m)
    setEditAmount(m.amount.toFixed(2))
    setEditDate(m.movement_date)
    setEditMethod(m.payment_method ?? 'cash')
  }

  function closeEditMovement() {
    setEditMovement(null)
  }

  function handleUpdateMovement() {
    if (!editMovement) return
    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0) { toast.error('Importe inválido'); return }
    startTransition(async () => {
      const result = await updateCashMovement({
        movementId: editMovement.id,
        amount,
        method: editMethod,
        date:   editDate,
      })
      if (result.success) {
        toast.success('Movimiento actualizado')
        closeEditMovement()
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al actualizar')
      }
    })
  }

  function handleDeleteMovement(m: Movement) {
    if (!m.related_payment_id) return
    const detail = m.related_payment_id ? detailMap[m.related_payment_id] : null
    const name   = detail?.player_name || m.description
    if (!confirm(`¿Borrar el pago de ${formatCurrency(m.amount)} de ${name}?\n\nEsta acción no se puede deshacer.`)) return
    startTransition(async () => {
      const result = await deletePayment(m.related_payment_id!)
      if (result.success) {
        toast.success('Pago borrado')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al borrar')
      }
    })
  }

  const realCashNum  = parseFloat(realCash) || 0
  const floatNum     = parseFloat(floatValue) || 0
  const realCardNum  = parseFloat(realCard) || 0
  const diffCash     = realCashNum - systemCash
  const diffCard     = realCardNum - systemCard
  const cashBalanced = Math.abs(diffCash) < 0.01
  const cardBalanced = Math.abs(diffCard) < 0.01
  const fullyBalanced = cashBalanced && cardBalanced

  // Build detail map for enriching movements (quota payments)
  const detailMap: Record<string, MovementDetail> = {}
  for (const d of movementDetails) detailMap[d.id] = d

  // Build activity detail map (activity charges)
  const activityDetailMap: Record<string, ActivityDetail> = {}
  for (const a of activityDetails) activityDetailMap[a.charge_id] = a

  function handleSaveFloat() {
    const amount = parseFloat(floatValue)
    if (isNaN(amount) || amount < 0) { toast.error('Importe inválido'); return }
    startTransition(async () => {
      const r = await updateCashRegisterFloat(amount)
      if (r.success) {
        toast.success('Fondo de caja actualizado')
        setEditingFloat(false)
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error')
      }
    })
  }

  function handleCloseCash() {
    // Compile card-by-day verification (only entries where user entered a real value)
    const cardByDay = dayBreakdown
      .filter(d => d.card !== 0)
      .map(d => {
        const realStr = realCardByDay[d.date] ?? ''
        const real    = parseFloat(realStr)
        return { date: d.date, system: d.card, real: isNaN(real) ? d.card : real }
      })

    startTransition(async () => {
      const result = await closeCash({
        clubId,
        periodStart,
        periodEnd,
        systemCash,
        realCash: realCashNum,
        systemCard,
        realCard: realCardNum,
        notes,
        closedBy: memberId,
        cashRegisterFloat: floatNum,
        cardByDay,
      })

      if (result.success) {
        toast.success('Caja cerrada correctamente')
        setRealCash('')
        setRealCard('')
        setNotes('')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al cerrar la caja')
      }
    })
  }

  const incomeMovements  = movements.filter(m => m.type === 'income')
  const expenseMovements = movements.filter(m => m.type === 'expense')
  const totalIncome  = incomeMovements.reduce((s, m) => s + m.amount, 0)
  const totalExpense = expenseMovements.reduce((s, m) => s + m.amount, 0)

  // Desglose por fuente para diagnóstico
  const SOURCES = ['cuota', 'ropa', 'torneo', 'actividad', 'gasto', 'otro'] as const
  type SourceKey = typeof SOURCES[number]
  const sourceBreakdown = SOURCES.reduce<Record<SourceKey, { cash: number; card: number; transfer: number; count: number }>>((acc, s) => {
    acc[s] = { cash: 0, card: 0, transfer: 0, count: 0 }
    return acc
  }, {} as Record<SourceKey, { cash: number; card: number; transfer: number; count: number }>)

  for (const m of movements) {
    const src = (m.source ?? 'otro') as SourceKey
    if (!sourceBreakdown[src]) continue
    const sign = m.type === 'income' ? 1 : -1
    if (m.payment_method === 'cash')     sourceBreakdown[src].cash     += sign * m.amount
    else if (m.payment_method === 'card') sourceBreakdown[src].card     += sign * m.amount
    else                                  sourceBreakdown[src].transfer += sign * m.amount
    sourceBreakdown[src].count++
  }

  const isSuperUser = userEmail === SUPER_EMAIL

  // ── Ingreso externo ───────────────────────────────────────────────────────────
  const [showExternalIncome, setShowExternalIncome] = useState(false)
  const [extConcept, setExtConcept] = useState('')
  const [extAmount, setExtAmount]   = useState('')
  const [extMethod, setExtMethod]   = useState<'cash' | 'card' | 'transfer'>('cash')
  const [extDate, setExtDate]       = useState(new Date().toISOString().slice(0, 10))

  function handleExternalIncome() {
    const amount = parseFloat(extAmount)
    if (!extConcept.trim()) { toast.error('El concepto es obligatorio'); return }
    if (!amount || amount <= 0) { toast.error('Importe inválido'); return }
    startTransition(async () => {
      const res = await registerExternalIncome({ concept: extConcept, amount, method: extMethod, date: extDate })
      if (res.success) {
        toast.success('Ingreso registrado en caja')
        setShowExternalIncome(false)
        setExtConcept(''); setExtAmount(''); setExtMethod('cash')
        setExtDate(new Date().toISOString().slice(0, 10))
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error al registrar')
      }
    })
  }

  // ── Panel de gestión de cierre histórico ─────────────────────────────────────
  const [managingClose, setManagingClose]     = useState<CashClose | null>(null)
  const [closedMovs, setClosedMovs]           = useState<ClosedMovement[]>([])
  const [loadingClosed, setLoadingClosed]     = useState(false)
  const [reclassifyMov, setReclassifyMov]     = useState<ClosedMovement | null>(null)
  const [reclassSource, setReclassSource]     = useState<string>('cuota')
  const [reclassDesc, setReclassDesc]         = useState('')
  const [reclasskConcept, setReclassConcept]  = useState('')

  async function openManageClose(c: CashClose) {
    setManagingClose(c)
    setClosedMovs([])
    setLoadingClosed(true)
    try {
      const res = await getClosedPeriodMovements(c.period_start, c.period_end)
      if (res.success && res.movements) setClosedMovs(res.movements)
      else toast.error(res.error ?? 'Error al cargar movimientos')
    } finally {
      setLoadingClosed(false)
    }
  }

  function openReclassify(m: ClosedMovement) {
    setReclassifyMov(m)
    setReclassSource(m.source ?? 'cuota')
    setReclassDesc(m.description ?? '')
    setReclassConcept(m.payment_concept ?? '')
  }

  function handleReclassify() {
    if (!reclassifyMov) return
    startTransition(async () => {
      const res = await reclassifyMovement({
        movementId:     reclassifyMov.id,
        paymentId:      reclassifyMov.related_payment_id ?? null,
        newSource:      reclassSource as 'cuota' | 'torneo' | 'actividad' | 'otro',
        newDescription: reclassDesc,
        newConcept:     reclassifyMov.related_payment_id ? reclasskConcept : undefined,
      })
      if (res.success) {
        toast.success('Movimiento reclasificado')
        setReclassifyMov(null)
        // Actualizar en el listado local sin recargar todo
        setClosedMovs(prev => prev.map(m =>
          m.id === reclassifyMov.id
            ? { ...m, source: reclassSource, description: reclassDesc, payment_concept: reclasskConcept }
            : m
        ))
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error al reclasificar')
      }
    })
  }

  const [showBreakdown, setShowBreakdown]       = useState(false)
  const [showDayBreakdown, setShowDayBreakdown] = useState(false)
  const [showCardVerify, setShowCardVerify]     = useState(false)

  // realCardByDay: date → string (lo que marca el datafono ese día)
  const [realCardByDay, setRealCardByDay] = useState<Record<string, string>>({})

  // ── Filters for movement detail table ───────────────────────────────────────
  const [filterMethod, setFilterMethod] = useState<'all' | 'cash' | 'card' | 'transfer'>('all')
  const [filterDate, setFilterDate]     = useState('')

  const filteredIncomeMovements = useMemo(() => {
    return incomeMovements.filter(m => {
      if (filterMethod !== 'all' && m.payment_method !== filterMethod) return false
      if (filterDate && m.movement_date !== filterDate) return false
      return true
    })
  }, [incomeMovements, filterMethod, filterDate])

  const filteredTotal = filteredIncomeMovements.reduce((s, m) => s + m.amount, 0)

  // ── Day-by-day breakdown ─────────────────────────────────────────────────────
  const dayBreakdown = useMemo(() => {
    const map: Record<string, { cash: number; card: number; transfer: number; total: number }> = {}
    for (const m of incomeMovements) {
      if (!map[m.movement_date]) map[m.movement_date] = { cash: 0, card: 0, transfer: 0, total: 0 }
      const sign = m.type === 'income' ? 1 : -1
      if (m.payment_method === 'cash')     map[m.movement_date].cash     += sign * m.amount
      else if (m.payment_method === 'card') map[m.movement_date].card     += sign * m.amount
      else                                  map[m.movement_date].transfer += sign * m.amount
      map[m.movement_date].total += sign * m.amount
    }
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a)) // Most recent first
      .map(([date, vals]) => ({ date, ...vals }))
  }, [incomeMovements])

  function exportCSV() {
    const BOM    = '﻿'
    const header = 'Nombre,Equipo,Cantidad,Forma de Pago,Fecha,Tipo\n'
    const rows   = movements.map((m) => {
      const detail    = m.related_payment_id ? detailMap[m.related_payment_id] : null
      const actDetail = m.related_activity_charge_id ? activityDetailMap[m.related_activity_charge_id] : null
      const name   = actDetail?.player_name || detail?.player_name || m.description
      const team   = actDetail ? actDetail.activity_name : (detail?.team_name || '')
      const amount = m.amount.toFixed(2)
      const method = METHOD_LABELS[m.payment_method] ?? m.payment_method
      const date   = m.movement_date
      const type   = m.type === 'income' ? 'Ingreso' : 'Gasto'
      return `"${name}","${team}",${amount},"${method}",${date},"${type}"`
    }).join('\n')

    const summary = [
      '',
      `"TOTAL INGRESOS",,${totalIncome.toFixed(2)},,,`,
      `"TOTAL GASTOS",,${totalExpense.toFixed(2)},,,`,
      `"EFECTIVO (SISTEMA)",,${systemCash.toFixed(2)},,,`,
      `"TARJETA (SISTEMA)",,${systemCard.toFixed(2)},,,`,
      `"PERIODO","${periodStart} a ${periodEnd}",,,,`,
    ].join('\n')

    const csv  = BOM + header + rows + '\n' + summary
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `Arqueo_${periodStart}_${periodEnd}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV descargado')
  }

  return (
    <div className="space-y-6">
      {/* Period info */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-lg">Resumen del periodo</h3>
          </div>
          {movements.length > 0 && (
            <button onClick={exportCSV} className="btn-secondary gap-2 flex items-center text-sm">
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Desde{' '}
          <strong>
            {lastCloseAt ? formatDateTime(lastCloseAt) : formatDate(periodStart)}
          </strong>
          {' '}hasta{' '}
          <strong>{formatDateTime(new Date().toISOString())}</strong>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-green-700">Total ingresos</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-xs text-red-700">Total gastos</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-700">Efectivo (sistema)</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(systemCash)}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-xs text-purple-700">Tarjeta (sistema)</p>
            <p className="text-xl font-bold text-purple-600">{formatCurrency(systemCard)}</p>
          </div>
        </div>
      </div>

      {/* Diagnóstico: desglose por fuente */}
      {movements.length > 0 && (
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBreakdown(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', showBreakdown && 'rotate-180')} />
              <span className="font-medium text-sm">Desglose por fuente — ¿de dónde vienen los {formatCurrency(systemCash)} en efectivo?</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {SOURCES.filter(s => sourceBreakdown[s].count > 0).length} fuentes activas
            </span>
          </button>
          {showBreakdown && (
            <div className="border-t overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">Fuente</th>
                    <th className="text-right px-4 py-2 font-medium">Movimientos</th>
                    <th className="text-right px-4 py-2 font-medium">Efectivo</th>
                    <th className="text-right px-4 py-2 font-medium">Tarjeta</th>
                    <th className="text-right px-4 py-2 font-medium">Transferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {SOURCES.filter(s => sourceBreakdown[s].count > 0).map(s => (
                    <tr key={s} className="border-t">
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {SOURCE_LABELS[s] ?? s}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{sourceBreakdown[s].count}</td>
                      <td className={cn('px-4 py-2.5 text-right font-medium', sourceBreakdown[s].cash !== 0 ? 'text-foreground' : 'text-muted-foreground/40')}>
                        {sourceBreakdown[s].cash !== 0 ? formatCurrency(sourceBreakdown[s].cash) : '—'}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right', sourceBreakdown[s].card !== 0 ? 'text-foreground' : 'text-muted-foreground/40')}>
                        {sourceBreakdown[s].card !== 0 ? formatCurrency(sourceBreakdown[s].card) : '—'}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right', sourceBreakdown[s].transfer !== 0 ? 'text-foreground' : 'text-muted-foreground/40')}>
                        {sourceBreakdown[s].transfer !== 0 ? formatCurrency(sourceBreakdown[s].transfer) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground uppercase tracking-wide">TOTAL</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{movements.length}</td>
                    <td className="px-4 py-2.5 text-right text-blue-700">{formatCurrency(systemCash)}</td>
                    <td className="px-4 py-2.5 text-right text-purple-700">{formatCurrency(systemCard)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {formatCurrency(
                        movements.reduce((s, m) => {
                          if (m.payment_method !== 'cash' && m.payment_method !== 'card') {
                            return s + (m.type === 'income' ? m.amount : -m.amount)
                          }
                          return s
                        }, 0)
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="px-4 py-3 bg-amber-50 border-t text-xs text-amber-700">
                <strong>¿Hay más dinero físico que efectivo de sistema?</strong>{' '}
                Lo más habitual es que la diferencia sea el fondo de caja (cambio) que quedó del periodo anterior.
                Configura el fondo arriba para que cuadre.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Desglose día a día */}
      {incomeMovements.length > 0 && (
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDayBreakdown(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', showDayBreakdown && 'rotate-180')} />
              <span className="font-medium text-sm">Ingresos día a día — cuadra con el datafono por fecha</span>
            </div>
            <span className="text-xs text-muted-foreground">{dayBreakdown.length} días con movimientos</span>
          </button>
          {showDayBreakdown && (
            <div className="border-t overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">Fecha</th>
                    <th className="text-right px-4 py-2 font-medium">
                      <span className="inline-flex items-center gap-1"><Banknote className="w-3 h-3" /> Efectivo</span>
                    </th>
                    <th className="text-right px-4 py-2 font-medium">
                      <span className="inline-flex items-center gap-1"><CreditCard className="w-3 h-3" /> Tarjeta</span>
                    </th>
                    <th className="text-right px-4 py-2 font-medium">
                      <span className="inline-flex items-center gap-1"><ArrowLeftRight className="w-3 h-3" /> Transfer.</span>
                    </th>
                    <th className="text-right px-4 py-2 font-medium">Total</th>
                    <th className="px-4 py-2 font-medium w-24 text-center">Filtrar</th>
                  </tr>
                </thead>
                <tbody>
                  {dayBreakdown.map(day => (
                    <tr key={day.date} className={cn('border-t', filterDate === day.date && 'bg-blue-50')}>
                      <td className="px-4 py-2.5 font-medium">{formatDate(day.date)}</td>
                      <td className={cn('px-4 py-2.5 text-right', day.cash ? 'text-foreground' : 'text-muted-foreground/40')}>
                        {day.cash ? formatCurrency(day.cash) : '—'}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold', day.card ? 'text-purple-700' : 'text-muted-foreground/40')}>
                        {day.card ? formatCurrency(day.card) : '—'}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right', day.transfer ? 'text-foreground' : 'text-muted-foreground/40')}>
                        {day.transfer ? formatCurrency(day.transfer) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-green-700">{formatCurrency(day.total)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setFilterDate(d => d === day.date ? '' : day.date)
                            setFilterMethod('all')
                          }}
                          className={cn(
                            'text-xs px-2 py-1 rounded border transition-colors',
                            filterDate === day.date
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-border hover:border-blue-400 text-muted-foreground hover:text-blue-700'
                          )}
                        >
                          {filterDate === day.date ? 'Limpar' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground uppercase tracking-wide">TOTAL</td>
                    <td className="px-4 py-2.5 text-right text-blue-700">{formatCurrency(systemCash)}</td>
                    <td className="px-4 py-2.5 text-right text-purple-700">{formatCurrency(systemCard)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {formatCurrency(movements.filter(m => m.payment_method !== 'cash' && m.payment_method !== 'card' && m.type === 'income').reduce((s, m) => s + m.amount, 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right text-green-700">{formatCurrency(totalIncome)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Verificación tarjeta día a día */}
      {dayBreakdown.some(d => d.card !== 0) && (
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCardVerify(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', showCardVerify && 'rotate-180')} />
              <CreditCard className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-sm">Verificación tarjeta — compara app vs datafono por día</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {Object.keys(realCardByDay).filter(d => realCardByDay[d]).length} / {dayBreakdown.filter(d => d.card !== 0).length} días verificados
            </span>
          </button>
          {showCardVerify && (
            <div className="border-t">
              <div className="px-5 py-3 bg-purple-50 border-b text-xs text-purple-700">
                Introduce el total de tarjeta que aparece en tu datafono para cada día. El sistema compara automáticamente.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-medium">Fecha</th>
                      <th className="text-right px-4 py-2.5 font-medium">App (sistema)</th>
                      <th className="text-center px-4 py-2.5 font-medium w-44">Datafono (real)</th>
                      <th className="text-center px-4 py-2.5 font-medium w-36">Estado</th>
                      <th className="text-right px-4 py-2.5 font-medium w-28">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayBreakdown.filter(d => d.card !== 0).map(day => {
                      const realStr  = realCardByDay[day.date] ?? ''
                      const realNum  = parseFloat(realStr)
                      const hasInput = realStr !== '' && !isNaN(realNum)
                      const diff     = hasInput ? realNum - day.card : null
                      const ok       = diff !== null && Math.abs(diff) < 0.01
                      return (
                        <tr key={day.date} className={cn(
                          'border-t transition-colors',
                          hasInput && ok  && 'bg-green-50',
                          hasInput && !ok && 'bg-red-50',
                        )}>
                          <td className="px-4 py-3 font-medium">{formatDate(day.date)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-purple-700">
                            {formatCurrency(day.card)}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.01"
                              inputMode="decimal"
                              min="0"
                              placeholder="0,00"
                              className={cn(
                                'input w-full text-right text-sm',
                                hasInput && ok  && 'border-green-400 bg-green-50',
                                hasInput && !ok && 'border-red-400 bg-red-50',
                              )}
                              value={realStr}
                              onChange={e => setRealCardByDay(prev => ({ ...prev, [day.date]: e.target.value }))}
                            />
                          </td>
                          <td className="px-4 py-3">
                            {!hasInput && (
                              <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                                — sin verificar
                              </span>
                            )}
                            {hasInput && ok && (
                              <span className="flex items-center justify-center gap-1 text-xs font-semibold text-green-700">
                                <BadgeCheck className="w-4 h-4" /> Cuadra ✓
                              </span>
                            )}
                            {hasInput && !ok && (
                              <span className="flex items-center justify-center gap-1 text-xs font-semibold text-red-700">
                                <BadgeAlert className="w-4 h-4" /> Descuadre
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {diff !== null && !ok && (
                              <span className={cn('font-semibold text-sm', diff > 0 ? 'text-amber-700' : 'text-red-700')}>
                                {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                              </span>
                            )}
                            {diff !== null && ok && (
                              <span className="text-green-600 text-sm">—</span>
                            )}
                            {diff === null && <span className="text-muted-foreground/40">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                    {/* Row totals */}
                    {(() => {
                      const verifiedDays  = dayBreakdown.filter(d => d.card !== 0 && realCardByDay[d.date] !== '' && !isNaN(parseFloat(realCardByDay[d.date] ?? '')))
                      const totalReal     = verifiedDays.reduce((s, d) => s + parseFloat(realCardByDay[d.date] ?? '0'), 0)
                      const totalApp      = dayBreakdown.filter(d => d.card !== 0).reduce((s, d) => s + d.card, 0)
                      const totalDiff     = verifiedDays.length > 0 ? totalReal - totalApp : null
                      const totalOk       = totalDiff !== null && Math.abs(totalDiff) < 0.01
                      if (verifiedDays.length === 0) return null
                      return (
                        <tr className={cn('border-t font-semibold', totalOk ? 'bg-green-100' : 'bg-red-100')}>
                          <td className="px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide">TOTAL ({verifiedDays.length} días)</td>
                          <td className="px-4 py-3 text-right text-purple-700">{formatCurrency(totalApp)}</td>
                          <td className="px-4 py-3 text-right text-purple-700">{formatCurrency(totalReal)}</td>
                          <td className="px-4 py-3 text-center">
                            {totalOk
                              ? <span className="flex items-center justify-center gap-1 text-xs text-green-700"><BadgeCheck className="w-4 h-4" /> Cuadra ✓</span>
                              : <span className="flex items-center justify-center gap-1 text-xs text-red-700"><BadgeAlert className="w-4 h-4" /> Descuadre</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-right">
                            {totalDiff !== null && !totalOk && (
                              <span className={cn('font-bold', totalDiff > 0 ? 'text-amber-700' : 'text-red-700')}>
                                {totalDiff > 0 ? '+' : ''}{formatCurrency(totalDiff)}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-muted/30 border-t text-xs text-muted-foreground">
                <strong>¿Hay diferencia?</strong> Si el datafono tiene más, puede haber pagos registrados con fecha incorrecta o en otro periodo. Usa el filtro de fecha en la tabla de abajo para investigar.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Movement detail table */}
      {incomeMovements.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-semibold">Detalle de ingresos del periodo</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Puedes modificar o borrar pagos antes de cerrar la caja</p>
              </div>
              <button
                type="button"
                onClick={() => setShowExternalIncome(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                Ingreso externo
              </button>
              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                {/* Method filter */}
                <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                  {([['all','Todo'],['cash','Efectivo'],['card','Tarjeta'],['transfer','Transfer.']] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFilterMethod(v)}
                      className={cn(
                        'px-2.5 py-1.5 font-medium transition-colors',
                        filterMethod === v
                          ? 'bg-primary text-white'
                          : 'hover:bg-muted text-muted-foreground'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Date filter */}
                <input
                  type="date"
                  className="input text-xs h-7 py-0 px-2 w-36"
                  value={filterDate}
                  min={periodStart}
                  max={periodEnd}
                  onChange={e => setFilterDate(e.target.value)}
                />
                {(filterMethod !== 'all' || filterDate) && (
                  <button
                    type="button"
                    onClick={() => { setFilterMethod('all'); setFilterDate('') }}
                    className="text-xs text-muted-foreground hover:text-primary underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
            {/* Filtered total pill */}
            {(filterMethod !== 'all' || filterDate) && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Mostrando {filteredIncomeMovements.length} movimientos —</span>
                <span className="text-sm font-bold text-green-700">{formatCurrency(filteredTotal)}</span>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jugador / Descripción</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cantidad</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">F. Pago</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filteredIncomeMovements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No hay movimientos para el filtro seleccionado
                    </td>
                  </tr>
                )}
                {filteredIncomeMovements.map((m) => {
                  const detail = m.related_payment_id ? detailMap[m.related_payment_id] : null
                  const actDetail = m.related_activity_charge_id ? activityDetailMap[m.related_activity_charge_id] : null
                  const sourceLabel = SOURCE_LABELS[m.source ?? ''] ?? (m.source ?? 'Otro')
                  const displayName = actDetail?.player_name || detail?.player_name || m.description
                  const displayTeam = actDetail ? actDetail.activity_name : (detail?.team_name || '—')
                  return (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {sourceLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{displayName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{displayTeam}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(m.amount)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{METHOD_LABELS[m.payment_method] ?? m.payment_method}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(m.movement_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => openEditMovement(m)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                            title="Modificar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {m.related_payment_id && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleDeleteMovement(m)}
                              className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                              title="Borrar pago"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cierre de caja section */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Cierre de caja</h3>
        </div>

        {/* System totals */}
        <div className="bg-muted/40 rounded-lg p-4">
          <p className="text-sm font-medium text-muted-foreground mb-2">Totales del sistema</p>
          <div className="flex gap-6 text-sm">
            <span>Efectivo: <strong>{formatCurrency(systemCash)}</strong></span>
            <span>Tarjeta: <strong>{formatCurrency(systemCard)}</strong></span>
          </div>
        </div>

        {/* Fondo de caja (cambio) — solo informativo */}
        <div className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Cambio en caja</span>
          </div>
          {!editingFloat ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{formatCurrency(floatNum)}</span>
              <button
                type="button"
                onClick={() => setEditingFloat(true)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                title="Editar cambio"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                min="0"
                className="input w-28 text-sm"
                value={floatValue}
                onChange={(e) => setFloatValue(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveFloat}
                disabled={isPending}
                className="p-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                title="Guardar"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { setFloatValue(initialFloat.toFixed(2)); setEditingFloat(false) }}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
                title="Cancelar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Real counts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="label">Efectivo contado físicamente</label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              min="0"
              className="input w-full"
              placeholder={`Sistema: ${formatCurrency(systemCash)}`}
              value={realCash}
              onChange={(e) => setRealCash(e.target.value)}
            />
            {realCash && (
              <div className={cn('flex items-center gap-1.5 text-sm mt-1', cashBalanced ? 'text-green-600' : 'text-red-600')}>
                {cashBalanced ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {cashBalanced ? 'Cuadre ✓' : `Descuadre: ${formatCurrency(Math.abs(diffCash))}`}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className="label">Total tarjeta verificado</label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              min="0"
              className="input w-full"
              placeholder={`Sistema: ${formatCurrency(systemCard)}`}
              value={realCard}
              onChange={(e) => setRealCard(e.target.value)}
            />
            {realCard && (
              <div className={cn('flex items-center gap-1.5 text-sm mt-1', cardBalanced ? 'text-green-600' : 'text-red-600')}>
                {cardBalanced ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {cardBalanced ? 'Cuadre ✓' : `Descuadre: ${formatCurrency(Math.abs(diffCard))}`}
              </div>
            )}
          </div>
        </div>

        {/* Overall balance indicator */}
        {realCash && realCard && (
          <div className={cn('flex items-center gap-2 p-3 rounded-lg text-sm font-medium', fullyBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
            {fullyBalanced ? (
              <><CheckCircle className="w-4 h-4" /> Caja cuadrada — puedes proceder al cierre</>
            ) : (
              <><AlertTriangle className="w-4 h-4" /> Hay descuadre en la caja</>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="label">Notas (opcional)</label>
          <textarea
            className="input w-full resize-none"
            rows={2}
            placeholder="Observaciones sobre el cierre..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button
          disabled={isPending || !realCash || !realCard}
          onClick={handleCloseCash}
          className="btn-primary gap-2 flex items-center"
        >
          <Lock className="w-4 h-4" />
          {isPending ? 'Cerrando...' : 'Cerrar caja'}
        </button>
      </div>

      {/* Close history */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold">Historial de cierres</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Periodo</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Efectivo sistema</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Efectivo real</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Diferencia</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Tarjeta sistema</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Tarjeta real</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Diferencia</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha cierre</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {closes.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(c.period_start)} — {formatDate(c.period_end)}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.system_cash)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.real_cash)}</td>
                  <td className={cn('px-4 py-3 text-right font-semibold', Math.abs(c.cash_difference) < 0.01 ? 'text-green-600' : 'text-red-600')}>
                    {c.cash_difference >= 0 ? '+' : ''}{formatCurrency(c.cash_difference)}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.system_card)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.real_card)}</td>
                  <td className={cn('px-4 py-3 text-right font-semibold', Math.abs(c.card_difference) < 0.01 ? 'text-green-600' : 'text-red-600')}>
                    {c.card_difference >= 0 ? '+' : ''}{formatCurrency(c.card_difference)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(c.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <a
                        href={`/api/pdf/cash-close/${c.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 hover:underline"
                        title="Descargar arqueo en PDF"
                      >
                        <FileDown className="w-3.5 h-3.5" /> PDF
                      </a>
                      <button
                        onClick={() => handleReopen(c.id, `${formatDate(c.period_start)} — ${formatDate(c.period_end)}`)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 text-xs text-yellow-700 hover:text-yellow-900 hover:underline"
                        title="Reabrir este cierre"
                      >
                        <Unlock className="w-3.5 h-3.5" /> Reabrir
                      </button>
                      {isSuperUser && (
                        <button
                          onClick={() => openManageClose(c)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 hover:underline font-semibold"
                          title="Ver y reclasificar movimientos"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Gestionar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {closes.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    No hay cierres registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit movement modal */}
      {editMovement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeEditMovement}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-movement-title"
        >
          <div
            className="bg-background rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 id="edit-movement-title" className="text-lg font-semibold">Modificar pago</h3>
              <button
                type="button"
                onClick={closeEditMovement}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const detail = editMovement.related_payment_id
                ? detailMap[editMovement.related_payment_id]
                : null
              const label = detail
                ? `${detail.player_name}${detail.team_name ? ` — ${detail.team_name}` : ''}`
                : editMovement.description
              return <p className="text-sm text-muted-foreground">{label}</p>
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
                        : 'border-border hover:border-muted-foreground',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={closeEditMovement}
                className="btn-secondary flex-1"
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpdateMovement}
                className="btn-primary flex-1"
                disabled={isPending}
              >
                {isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Ingreso externo ── */}
      {showExternalIncome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowExternalIncome(false)}>
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Ingreso externo</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Donativo, patrocinio, alquiler, etc. — se añade al cierre de caja</p>
              </div>
              <button type="button" onClick={() => setShowExternalIncome(false)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="label">Concepto *</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Ej: Patrocinio Empresa X, Alquiler campo, Donativo..."
                value={extConcept}
                onChange={e => setExtConcept(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="label">Importe (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className="input w-full"
                  placeholder="0,00"
                  value={extAmount}
                  onChange={e => setExtAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="label">Fecha</label>
                <input
                  type="date"
                  className="input w-full"
                  value={extDate}
                  onChange={e => setExtDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="label">Forma de pago</label>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setExtMethod(m.value as 'cash' | 'card' | 'transfer')}
                    className={cn(
                      'p-2 rounded-lg border text-sm font-medium transition-colors',
                      extMethod === m.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-muted-foreground'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowExternalIncome(false)} className="btn-secondary flex-1" disabled={isPending}>
                Cancelar
              </button>
              <button type="button" onClick={handleExternalIncome} className="btn-primary flex-1" disabled={isPending || !extConcept.trim() || !extAmount}>
                {isPending ? 'Registrando…' : 'Registrar ingreso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Gestionar cierre histórico (solo superuser) ── */}
      {managingClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setManagingClose(null)}>
          <div className="bg-background rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">Gestionar cierre: {formatDate(managingClose.period_start)} — {formatDate(managingClose.period_end)}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Puedes reclasificar la fuente de cada movimiento sin alterar importes ni fechas</p>
              </div>
              <button type="button" onClick={() => setManagingClose(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingClosed && <p className="text-center text-muted-foreground py-8">Cargando movimientos…</p>}
              {!loadingClosed && closedMovs.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No hay movimientos en este período</p>
              )}
              {!loadingClosed && closedMovs.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-xs text-muted-foreground">
                      <th className="text-left px-3 py-2 font-medium">Fecha</th>
                      <th className="text-left px-3 py-2 font-medium">Fuente</th>
                      <th className="text-left px-3 py-2 font-medium">Descripción / Jugador</th>
                      <th className="text-left px-3 py-2 font-medium">Concepto</th>
                      <th className="text-right px-3 py-2 font-medium">Importe</th>
                      <th className="px-3 py-2 w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedMovs.filter((m: ClosedMovement) => m.type === 'income').map((m: ClosedMovement, i: number) => (
                      <tr key={m.id} className={cn('border-t', i % 2 === 0 ? 'bg-white' : 'bg-muted/10')}>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(m.movement_date)}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                            m.source === 'torneo' ? 'bg-orange-100 text-orange-700' :
                            m.source === 'actividad' ? 'bg-teal-100 text-teal-700' :
                            m.source === 'ropa' ? 'bg-pink-100 text-pink-700' :
                            'bg-blue-100 text-blue-700'
                          )}>
                            {SOURCE_LABELS[m.source ?? ''] ?? m.source ?? 'Otro'}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium max-w-[200px] truncate">
                          {m.player_name || m.description}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{m.payment_concept || '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700">{formatCurrency(m.amount)}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => openReclassify(m)}
                            className="text-xs text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Cambiar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
              Solo visible para <strong>dgbravofernandez@gmail.com</strong> — los cambios de fuente no afectan los totales del arqueo cerrado
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Reclasificar movimiento ── */}
      {reclassifyMov && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setReclassifyMov(null)}>
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Reclasificar movimiento</h3>
              <button type="button" onClick={() => setReclassifyMov(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              <strong>{reclassifyMov.player_name || reclassifyMov.description}</strong> — {formatDate(reclassifyMov.movement_date)} — <strong>{formatCurrency(reclassifyMov.amount)}</strong>
            </p>

            <div className="space-y-1">
              <label className="label">Nueva fuente</label>
              <div className="grid grid-cols-3 gap-2">
                {SOURCE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setReclassSource(opt.value)}
                    className={cn(
                      'p-2 rounded-lg border text-sm font-medium transition-colors',
                      reclassSource === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-muted-foreground'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="label">Descripción del movimiento</label>
              <input
                type="text"
                className="input w-full"
                value={reclassDesc}
                onChange={e => setReclassDesc(e.target.value)}
                placeholder="Ej: Torneo - Madcup"
              />
            </div>

            {reclassifyMov.related_payment_id && (
              <div className="space-y-1">
                <label className="label">Concepto del pago (quota_payments)</label>
                <input
                  type="text"
                  className="input w-full"
                  value={reclasskConcept}
                  onChange={e => setReclassConcept(e.target.value)}
                  placeholder="Ej: Torneo - Madcup"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setReclassifyMov(null)} className="btn-secondary flex-1" disabled={isPending}>
                Cancelar
              </button>
              <button type="button" onClick={handleReclassify} className="btn-primary flex-1" disabled={isPending || !reclassDesc.trim()}>
                {isPending ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
