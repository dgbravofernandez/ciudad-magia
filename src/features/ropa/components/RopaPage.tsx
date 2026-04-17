'use client'
import { Shirt, Plus, Package, DollarSign, Clock, CheckCircle, XCircle, Pencil, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { createClothingOrder, markClothingOrderPaid, refundClothingOrder, deleteClothingOrder, updateClothingOrder, type ClothingPaymentMethod } from '@/features/ropa/actions/clothing.actions'

interface OrderItem { count: number }
interface Player { first_name: string; last_name: string }
interface Order {
  id: string
  player_id: string | null
  player: Player | null
  description: string | null
  total_amount: number
  payment_status: 'pending' | 'paid' | 'cancelled'
  created_at: string
  clothing_order_items: OrderItem[]
  notes: string | null
}

function fullName(p: Player | null, notes: string | null): string {
  if (p) return `${p.first_name} ${p.last_name}`.trim()
  // Fallback: recover the manually typed name from notes when no player was matched
  const match = notes?.match(/Jugador \(manual\):\s*([^—]+)/)
  return match?.[1]?.trim() || 'N/A'
}

interface Props { pedidos: Order[]; clubId: string }

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '6', '8', '10', '12', '14', '16'] as const
const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: 'bg-yellow-50 text-yellow-700', icon: Clock },
  paid: { label: 'Pagado', color: 'bg-green-50 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-50 text-red-700', icon: XCircle },
}

export function RopaPage({ pedidos, clubId: _clubId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'cancelled'>('all')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ playerName: '', description: '', size: 'M', quantity: 1, price: 0, notes: '' })
  // Pay-modal: ask payment method before registering to caja
  const [payTarget, setPayTarget] = useState<Order | null>(null)
  const [payMethod, setPayMethod] = useState<ClothingPaymentMethod>('cash')
  // Edit-modal
  const [editTarget, setEditTarget] = useState<Order | null>(null)
  const [editForm, setEditForm] = useState({ description: '', size: 'M', quantity: 1, price: 0, notes: '' })

  const filtered = filter === 'all' ? pedidos : pedidos.filter(p => p.payment_status === filter)
  const totalRevenue = pedidos.filter(p => p.payment_status === 'paid').reduce((s, p) => s + Number(p.total_amount), 0)
  const pending = pedidos.filter(p => p.payment_status === 'pending').length
  const paid = pedidos.filter(p => p.payment_status === 'paid').length

  const kpis = [
    { label: 'Total pedidos', value: pedidos.length, icon: Package, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Pendientes', value: pending, icon: Clock, color: '#d97706', bg: '#fffbeb' },
    { label: 'Pagados', value: paid, icon: CheckCircle, color: '#059669', bg: '#ecfdf5' },
    { label: 'Ingresos ropa', value: `${totalRevenue.toFixed(2)} €`, icon: DollarSign, color: '#059669', bg: '#ecfdf5' },
  ]

  function handleCreate() {
    if (!form.playerName || !form.description) {
      toast.error('Completa los campos obligatorios')
      return
    }
    startTransition(async () => {
      const r = await createClothingOrder({
        playerName: form.playerName,
        description: form.description,
        size: form.size,
        quantity: form.quantity,
        price: form.price,
        notes: form.notes,
      })
      if (r.success) {
        toast.success('Pedido creado')
        setShowNew(false)
        setForm({ playerName: '', description: '', size: 'M', quantity: 1, price: 0, notes: '' })
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error al crear el pedido')
      }
    })
  }

  function openPayModal(order: Order) {
    setPayTarget(order)
    setPayMethod('cash')
  }

  function handleConfirmPay() {
    if (!payTarget) return
    const target = payTarget
    startTransition(async () => {
      const r = await markClothingOrderPaid(target.id, payMethod)
      if (r.success) {
        toast.success('Pago registrado en caja')
        setPayTarget(null)
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error al marcar como pagado')
      }
    })
  }

  function handleRefund(id: string) {
    if (!confirm('¿Devolver el pago? Se creará un movimiento negativo en caja y el pedido quedará cancelado.')) return
    startTransition(async () => {
      const r = await refundClothingOrder(id)
      if (r.success) {
        toast.success('Devolución registrada')
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error al devolver')
      }
    })
  }

  function handleDelete(o: Order) {
    const warn = o.payment_status === 'paid'
      ? '¿Eliminar este pedido? También se quitará el ingreso de caja asociado.'
      : '¿Eliminar este pedido?'
    if (!confirm(warn)) return
    startTransition(async () => {
      const r = await deleteClothingOrder(o.id)
      if (r.success) { toast.success('Pedido eliminado'); router.refresh() }
      else toast.error(r.error ?? 'Error al eliminar')
    })
  }

  function openEdit(o: Order) {
    // Parse current notes: strip the "Jugador (manual):" prefix for display
    const cleanNotes = (o.notes ?? '').replace(/^Jugador \(manual\):[^—]+(?:—\s*)?/, '').trim()
    setEditForm({
      description: o.description ?? '',
      size: 'M',
      quantity: 1,
      price: Number(o.total_amount) || 0,
      notes: cleanNotes,
    })
    setEditTarget(o)
  }

  function handleUpdate() {
    if (!editTarget) return
    const target = editTarget
    if (!editForm.description.trim()) { toast.error('La descripción es obligatoria'); return }
    startTransition(async () => {
      const r = await updateClothingOrder({
        orderId: target.id,
        description: editForm.description,
        size: editForm.size,
        quantity: editForm.quantity,
        price: editForm.price,
        notes: editForm.notes,
      })
      if (r.success) {
        toast.success('Pedido actualizado')
        setEditTarget(null)
        router.refresh()
      } else toast.error(r.error ?? 'Error')
    })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos de ropa</h1>
          <p className="text-sm text-gray-500">Gestión de equipaciones y merchandising</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
          <Plus className="w-4 h-4" /> Nuevo pedido
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">{k.label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: k.bg }}>
                <k.icon className="w-3.5 h-3.5" style={{ color: k.color }} />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'paid', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'}`}>
            {s === 'all' ? 'Todos' : STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Shirt className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No hay pedidos</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Jugador', 'Descripción', 'Artículos', 'Total', 'Estado', 'Fecha', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => {
                const status = STATUS_CONFIG[p.payment_status]
                const StatusIcon = status.icon
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{fullName(p.player, p.notes)}</td>
                    <td className="px-4 py-3 text-gray-500">{p.description ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.clothing_order_items?.[0]?.count ?? 0} artículos</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{Number(p.total_amount).toFixed(2)} €</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />{status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{format(new Date(p.created_at), 'd MMM yyyy', { locale: es })}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {p.payment_status === 'pending' && (
                          <button
                            onClick={() => openPayModal(p)}
                            disabled={isPending}
                            className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 disabled:opacity-50"
                          >
                            Marcar pagado
                          </button>
                        )}
                        {p.payment_status === 'paid' && (
                          <button
                            onClick={() => handleRefund(p.id)}
                            disabled={isPending}
                            className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 disabled:opacity-50"
                          >
                            Devolver
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(p)}
                          disabled={isPending}
                          className="text-xs p-1 text-gray-400 hover:text-gray-700 disabled:opacity-50"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          disabled={isPending}
                          className="text-xs p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Editar pedido</h3>
              <p className="text-xs text-gray-500 mt-1">
                {fullName(editTarget.player, editTarget.notes)}
                {editTarget.payment_status === 'paid' && ' · pagado (se actualizará también el movimiento de caja)'}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Talla</label>
                  <select value={editForm.size} onChange={e => setEditForm(f => ({ ...f, size: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                  <input type="number" min={1} value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio (€)</label>
                  <input type="number" min={0} step={0.01} value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-500">Nuevo total: </span>
                <span className="font-bold text-gray-900">{(editForm.price * editForm.quantity).toFixed(2)} €</span>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setEditTarget(null)} disabled={isPending} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50">Cancelar</button>
              <button onClick={handleUpdate} disabled={isPending} className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
                {isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay modal — ask payment method, then register to caja */}
      {payTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPayTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Registrar pago</h3>
              <p className="text-sm text-gray-500 mt-1">
                {fullName(payTarget.player, payTarget.notes)} · {Number(payTarget.total_amount).toFixed(2)} €
              </p>
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
                    onClick={() => setPayMethod(m.v)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${payMethod === m.v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">Se creará un movimiento de ingreso en caja ligado a este pedido.</p>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setPayTarget(null)} disabled={isPending} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50">Cancelar</button>
              <button onClick={handleConfirmPay} disabled={isPending} className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
                {isPending ? 'Guardando...' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New order modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Nuevo pedido de ropa</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jugador</label>
                <input value={form.playerName} onChange={e => setForm(f => ({ ...f, playerName: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nombre del jugador" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del artículo</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Camiseta oficial primera equipación" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Talla</label>
                  <select value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                  <input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio (€)</label>
                  <input type="number" min={0} step={0.01} value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Notas adicionales..." />
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-500">Total: </span>
                <span className="font-bold text-gray-900">{(form.price * form.quantity).toFixed(2)} €</span>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} disabled={isPending} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50">Cancelar</button>
              <button
                onClick={handleCreate}
                disabled={isPending}
                className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {isPending ? 'Guardando...' : 'Crear pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
