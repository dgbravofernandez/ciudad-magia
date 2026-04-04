'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Lock, CheckCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils/currency'
import { closeCash } from '@/features/contabilidad/actions/accounting.actions'

interface CashClose {
  id: string
  period_start: string
  period_end: string
  system_cash: number
  real_cash: number
  system_card: number
  real_card: number
  diff_cash: number
  diff_card: number
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
}

export function CashRegisterPage({
  clubId,
  memberId,
  systemCash,
  systemCard,
  periodStart,
  periodEnd,
  closes,
}: Props) {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`
  const firstOfMonth = `01/${pad(now.getMonth() + 1)}/${now.getFullYear()}`
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(todayStr)
  const [realCash, setRealCash] = useState('')
  const [realCard, setRealCard] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const realCashNum = parseFloat(realCash) || 0
  const realCardNum = parseFloat(realCard) || 0
  const diffCash = realCashNum - systemCash
  const diffCard = realCardNum - systemCard
  const cashBalanced = Math.abs(diffCash) < 0.01
  const cardBalanced = Math.abs(diffCard) < 0.01
  const fullyBalanced = cashBalanced && cardBalanced

  function parseDMY(dmy: string): string {
    const [d, m, y] = dmy.split('/')
    return `${y}-${m}-${d}`
  }

  function handleCloseCash() {
    const start = parseDMY(dateFrom)
    const end = parseDMY(dateTo)

    startTransition(async () => {
      const result = await closeCash({
        clubId,
        periodStart: start,
        periodEnd: end,
        systemCash,
        realCash: realCashNum,
        systemCard,
        realCard: realCardNum,
        notes,
        closedBy: memberId,
      })

      if (result.success) {
        toast.success('Caja cerrada correctamente')
        setRealCash('')
        setRealCard('')
        setNotes('')
      } else {
        toast.error(result.error ?? 'Error al cerrar la caja')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Cierre de caja section */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Cierre de caja</h3>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="space-y-1">
            <label className="label">Desde (DD/MM/YYYY)</label>
            <input
              type="text"
              className="input w-36"
              placeholder="01/01/2026"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              maxLength={10}
            />
          </div>
          <div className="space-y-1">
            <label className="label">Hasta (DD/MM/YYYY)</label>
            <input
              type="text"
              className="input w-36"
              placeholder="31/01/2026"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              maxLength={10}
            />
          </div>
        </div>

        {/* System totals */}
        <div className="bg-muted/40 rounded-lg p-4">
          <p className="text-sm font-medium text-muted-foreground mb-2">Sistema</p>
          <div className="flex gap-6 text-sm">
            <span>Efectivo: <strong>{formatCurrency(systemCash)}</strong></span>
            <span>Tarjeta: <strong>{formatCurrency(systemCard)}</strong></span>
          </div>
        </div>

        {/* Real counts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="label">Efectivo contado físicamente (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input w-full"
              placeholder={`Sistema: ${formatCurrency(systemCash)}`}
              value={realCash}
              onChange={(e) => setRealCash(e.target.value)}
            />
            {realCash && (
              <div className={cn('flex items-center gap-1.5 text-sm mt-1', cashBalanced ? 'text-green-600' : 'text-red-600')}>
                {cashBalanced ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {cashBalanced ? 'Cuadre ✅' : `Descuadre ⚠️ ${formatCurrency(Math.abs(diffCash))}`}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className="label">Total tarjeta verificado (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input w-full"
              placeholder={`Sistema: ${formatCurrency(systemCard)}`}
              value={realCard}
              onChange={(e) => setRealCard(e.target.value)}
            />
            {realCard && (
              <div className={cn('flex items-center gap-1.5 text-sm mt-1', cardBalanced ? 'text-green-600' : 'text-red-600')}>
                {cardBalanced ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {cardBalanced ? 'Cuadre ✅' : `Descuadre ⚠️ ${formatCurrency(Math.abs(diffCard))}`}
              </div>
            )}
          </div>
        </div>

        {/* Overall balance indicator */}
        {realCash && realCard && (
          <div className={cn('flex items-center gap-2 p-3 rounded-lg text-sm font-medium', fullyBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
            {fullyBalanced ? (
              <><CheckCircle className="w-4 h-4" /> Caja cuadrada ✅</>
            ) : (
              <><AlertTriangle className="w-4 h-4" /> Hay descuadre en la caja ⚠️</>
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Período</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Efectivo sistema</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Efectivo real</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Diferencia</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cerrado por</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
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
                  <td className={cn('px-4 py-3 text-right font-semibold', Math.abs(c.diff_cash) < 0.01 ? 'text-green-600' : 'text-red-600')}>
                    {c.diff_cash >= 0 ? '+' : ''}{formatCurrency(c.diff_cash)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{c.closed_by}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                </tr>
              ))}
              {closes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No hay cierres registrados
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
