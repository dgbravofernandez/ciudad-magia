'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { TrendingDown, Plus, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatCurrency, formatDate } from '@/lib/utils/currency'
import { addExpense } from '@/features/contabilidad/actions/accounting.actions'

interface Expense {
  id: string
  category: string
  description: string
  amount: number
  expense_date: string
  registered_by: string | null
}

interface Props {
  clubId: string
  expenses: Expense[]
  totalExpensesThisMonth: number
}

const CATEGORIES = [
  { value: 'equipamiento', label: 'Equipamiento' },
  { value: 'desplazamiento', label: 'Desplazamiento' },
  { value: 'instalaciones', label: 'Instalaciones' },
  { value: 'personal', label: 'Personal' },
  { value: 'otros', label: 'Otros' },
]

const CATEGORY_COLORS: Record<string, string> = {
  equipamiento: 'badge-primary',
  desplazamiento: 'badge-warning',
  instalaciones: 'badge-muted',
  personal: 'badge-success',
  otros: 'badge-muted',
}

export function ExpensesPage({ expenses, totalExpensesThisMonth }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const today = new Date().toISOString().slice(0, 10)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await addExpense(formData)
      if (result.success) {
        toast.success('Gasto registrado correctamente')
        setShowForm(false)
        ;(e.target as HTMLFormElement).reset()
      } else {
        toast.error(result.error ?? 'Error al registrar el gasto')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total gastos del mes</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpensesThisMonth)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* New expense form */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Nuevo gasto</h3>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="btn-primary gap-2 flex items-center text-sm"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Cerrar' : 'Añadir gasto'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="label">Categoría *</label>
                <select name="category" required className="input w-full">
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="label">Importe (€) *</label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="input w-full"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="label">Descripción *</label>
                <input
                  name="description"
                  type="text"
                  required
                  className="input w-full"
                  placeholder="Descripción del gasto..."
                />
              </div>
              <div className="space-y-1">
                <label className="label">Fecha *</label>
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={today}
                  className="input w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="label">Justificante</label>
                <button
                  type="button"
                  className="btn-ghost gap-2 flex items-center text-sm w-full justify-center"
                  onClick={() => toast.info('Función de subida de archivos próximamente')}
                >
                  <Paperclip className="w-4 h-4" />
                  Adjuntar recibo
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={isPending} className="btn-primary">
                {isPending ? 'Guardando...' : 'Registrar gasto'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Expenses table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold">Gastos del mes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Categoría</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Descripción</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Importe</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(expense.expense_date)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('badge', CATEGORY_COLORS[expense.category] ?? 'badge-muted')}>
                      {CATEGORIES.find((c) => c.value === expense.category)?.label ?? expense.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">{expense.description}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(expense.amount)}</td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    No hay gastos registrados este mes
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
