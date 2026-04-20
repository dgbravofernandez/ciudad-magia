'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TrendingDown, Plus, Paperclip, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatCurrency, formatDate } from '@/lib/utils/currency'
import { addExpense, deleteExpense, updateExpense } from '@/features/contabilidad/actions/accounting.actions'

interface Expense {
  id: string
  category: string
  description: string
  amount: number
  expense_date: string
  registered_by: string | null
  receipt_url?: string | null
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
  { value: 'Torneo', label: 'Torneo' },
  { value: 'otros', label: 'Otros' },
]

const CATEGORY_COLORS: Record<string, string> = {
  equipamiento: 'badge-primary',
  desplazamiento: 'badge-warning',
  instalaciones: 'badge-muted',
  personal: 'badge-success',
  Torneo: 'badge-primary',
  otros: 'badge-muted',
}

export function ExpensesPage({ expenses, totalExpensesThisMonth }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const today = new Date().toISOString().slice(0, 10)

  // Edit state
  const [editTarget, setEditTarget] = useState<Expense | null>(null)
  const [editForm, setEditForm] = useState({
    category: '',
    description: '',
    amount: 0,
    date: '',
    method: 'transfer',
    receipt_url: '',
  })

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

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto? Se quitará también del cierre de caja.')) return
    startTransition(async () => {
      const r = await deleteExpense(id)
      if (r.success) {
        toast.success('Gasto eliminado')
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error')
      }
    })
  }

  function openEdit(ex: Expense) {
    setEditForm({
      category: ex.category,
      description: ex.description,
      amount: Number(ex.amount),
      date: ex.expense_date,
      method: 'transfer',
      receipt_url: ex.receipt_url ?? '',
    })
    setEditTarget(ex)
  }

  function handleUpdate() {
    if (!editTarget) return
    const target = editTarget
    startTransition(async () => {
      const r = await updateExpense({
        expenseId: target.id,
        amount: editForm.amount,
        date: editForm.date,
        category: editForm.category,
        description: editForm.description,
        method: editForm.method,
        receipt_url: editForm.receipt_url?.trim() || null,
      })
      if (r.success) {
        toast.success('Gasto actualizado')
        setEditTarget(null)
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error')
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
                <label className="label">Método de pago</label>
                <select name="method" defaultValue="transfer" className="input w-full">
                  <option value="transfer">Transferencia</option>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="label flex items-center gap-2">
                  <Paperclip className="w-3.5 h-3.5" />
                  URL del justificante (Drive / Dropbox)
                </label>
                <input
                  name="receipt_url"
                  type="url"
                  placeholder="https://drive.google.com/…"
                  className="input w-full"
                />
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
                <th className="px-4 py-3 font-medium text-muted-foreground text-center">Recibo</th>
                <th className="px-4 py-3"></th>
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
                  <td className="px-4 py-3 text-center">
                    {expense.receipt_url ? (
                      <a
                        href={expense.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                        title="Ver justificante"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Ver
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(expense)}
                        disabled={isPending}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-50"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        disabled={isPending}
                        className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No hay gastos registrados este mes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Editar gasto</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Categoría</label>
                <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className="input w-full">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Descripción</label>
                <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="input w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Importe (€)</label>
                  <input type="number" min={0} step={0.01} value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: Number(e.target.value) }))} className="input w-full" />
                </div>
                <div>
                  <label className="label">Fecha</label>
                  <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className="input w-full" />
                </div>
              </div>
              <div>
                <label className="label">Método</label>
                <select value={editForm.method} onChange={e => setEditForm(f => ({ ...f, method: e.target.value }))} className="input w-full">
                  <option value="transfer">Transferencia</option>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                </select>
              </div>
              <div>
                <label className="label">URL del justificante</label>
                <input
                  type="url"
                  value={editForm.receipt_url}
                  onChange={e => setEditForm(f => ({ ...f, receipt_url: e.target.value }))}
                  className="input w-full"
                  placeholder="https://…"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setEditTarget(null)} disabled={isPending} className="btn-ghost">Cancelar</button>
              <button onClick={handleUpdate} disabled={isPending} className="btn-primary">
                {isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
