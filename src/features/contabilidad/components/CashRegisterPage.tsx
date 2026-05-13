'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Lock, CheckCircle, AlertTriangle, FileText, Download,
  Unlock, Pencil, Trash2, X, FileDown,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatCurrency, formatDate } from '@/lib/utils/currency'
import {
  closeCash,
  reopenCashClose,
  deletePayment,
  updatePayment,
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

interface Movement {
  id: string
  type: string
  description: string
  amount: number
  payment_method: string
  movement_date: string
  related_payment_id: string | null
}

interface MovementDetail {
  id: string
  player_id: string
  player_name: string
  team_name: string
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
  notes: string | null
  closed_by: string
  created_at: string
}

interface Props {
  clubId: string
  memberId: string
  systemCash: number
  systemCard: number
  periodStart: string
  periodEnd: string
  closes: CashClose[]
  movements: Movement[]
  movementDetails: MovementDetail[]
}

export function CashRegisterPage({
  clubId,
  memberId,
  systemCash,
  systemCard,
  periodStart,
  periodEnd,
  closes,
  movements,
  movementDetails,
}: Props) {
  const router = useRouter()
  const [realCash, setRealCash]   = useState('')
  const [realCard, setRealCard]   = useState('')
  const [notes, setNotes]         = useState('')
  const [isPending, startTransition] = useTransition()

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
    if (!editMovement?.related_payment_id) return
    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0) { toast.error('Importe inválido'); return }
    startTransition(async () => {
      const result = await updatePayment({
        paymentId: editMovement.related_payment_id!,
        amount,
        method:    editMethod,
        date:      editDate,
        notes:     '',
      })
      if (result.success) {
        toast.success('Pago actualizado')
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

  const realCashNum = parseFloat(realCash) || 0
  const realCardNum = parseFloat(realCard) || 0
  const diffCash    = realCashNum - systemCash
  const diffCard    = realCardNum - systemCard
  const cashBalanced  = Math.abs(diffCash) < 0.01
  const cardBalanced  = Math.abs(diffCard) < 0.01
  const fullyBalanced = cashBalanced && cardBalanced

  // Build detail map for enriching movements
  const detailMap: Record<string, MovementDetail> = {}
  for (const d of movementDetails) detailMap[d.id] = d

  function handleCloseCash() {
    startTransition(async () => {
      const result = await closeCash({
        clubId,
        periodStart,
        periodEnd,
        systemCash,
        realCash:  realCashNum,
        systemCard,
        realCard:  realCardNum,
        notes,
        closedBy:  memberId,
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

  function exportCSV() {
    const BOM    = '﻿'
    const header = 'Nombre,Equipo,Cantidad,Forma de Pago,Fecha,Tipo\n'
    const rows   = movements.map((m) => {
      const detail = m.related_payment_id ? detailMap[m.related_payment_id] : null
      const name   = detail?.player_name || m.description
      const team   = detail?.team_name   || ''
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
          Desde <strong>{formatDate(periodStart)}</strong> hasta <strong>{formatDate(periodEnd)}</strong>
          {closes.length > 0 && <span className="ml-1">(desde el último cierre)</span>}
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

      {/* Movement detail table */}
      {incomeMovements.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3 className="font-semibold">Detalle de ingresos del periodo</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Puedes modificar o borrar pagos antes de cerrar la caja</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jugador</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cantidad</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">F. Pago</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {incomeMovements.map((m) => {
                  const detail = m.related_payment_id ? detailMap[m.related_payment_id] : null
                  const canEdit = !!m.related_payment_id
                  return (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{detail?.player_name || m.description}</td>
                      <td className="px-4 py-3 text-muted-foreground">{detail?.team_name || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(m.amount)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{METHOD_LABELS[m.payment_method] ?? m.payment_method}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(m.movement_date)}</td>
                      <td className="px-4 py-3">
                        {canEdit && (
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => openEditMovement(m)}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                              title="Modificar pago"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleDeleteMovement(m)}
                              className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                              title="Borrar pago"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
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

        {/* Real counts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="label">Efectivo contado fisicamente</label>
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
                {cashBalanced ? 'Cuadre' : `Descuadre: ${formatCurrency(Math.abs(diffCash))}`}
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
                {cardBalanced ? 'Cuadre' : `Descuadre: ${formatCurrency(Math.abs(diffCard))}`}
              </div>
            )}
          </div>
        </div>

        {/* Overall balance indicator */}
        {realCash && realCard && (
          <div className={cn('flex items-center gap-2 p-3 rounded-lg text-sm font-medium', fullyBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
            {fullyBalanced ? (
              <><CheckCircle className="w-4 h-4" /> Caja cuadrada</>
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
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
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
              return detail ? (
                <p className="text-sm text-muted-foreground">
                  {detail.player_name}
                  {detail.team_name ? ` — ${detail.team_name}` : ''}
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
    </div>
  )
}
