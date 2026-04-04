'use client'
import { Shirt, Plus, Package, DollarSign, Clock, CheckCircle, XCircle, Eye } from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

interface OrderItem { count: number }
interface Player { full_name: string }
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

interface Props { pedidos: Order[]; clubId: string }

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '6', '8', '10', '12', '14', '16'] as const
const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: 'bg-yellow-50 text-yellow-700', icon: Clock },
  paid: { label: 'Pagado', color: 'bg-green-50 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-50 text-red-700', icon: XCircle },
}

export function RopaPage({ pedidos, clubId }: Props) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'cancelled'>('all')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ playerName: '', description: '', size: 'M', quantity: 1, price: 0, notes: '' })
  const [localPedidos, setLocalPedidos] = useState(pedidos)

  const filtered = filter === 'all' ? localPedidos : localPedidos.filter(p => p.payment_status === filter)
  const totalRevenue = localPedidos.filter(p => p.payment_status === 'paid').reduce((s, p) => s + Number(p.total_amount), 0)
  const pending = localPedidos.filter(p => p.payment_status === 'pending').length
  const paid = localPedidos.filter(p => p.payment_status === 'paid').length

  const kpis = [
    { label: 'Total pedidos', value: localPedidos.length, icon: Package, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Pendientes', value: pending, icon: Clock, color: '#d97706', bg: '#fffbeb' },
    { label: 'Pagados', value: paid, icon: CheckCircle, color: '#059669', bg: '#ecfdf5' },
    { label: 'Ingresos ropa', value: `${totalRevenue.toFixed(2)} €`, icon: DollarSign, color: '#059669', bg: '#ecfdf5' },
  ]

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
                    <td className="px-4 py-3 font-medium text-gray-900">{p.player?.full_name ?? 'N/A'}</td>
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
                          <button onClick={() => {
                            setLocalPedidos(prev => prev.map(x => x.id === p.id ? { ...x, payment_status: 'paid' } : x))
                            toast.success('Pedido marcado como pagado')
                          }} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100">
                            Marcar pagado
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

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
              <button onClick={() => setShowNew(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancelar</button>
              <button onClick={() => {
                if (!form.playerName || !form.description) { toast.error('Completa los campos obligatorios'); return }
                const newOrder: Order = {
                  id: Date.now().toString(), player_id: null,
                  player: { full_name: form.playerName }, description: form.description,
                  total_amount: form.price * form.quantity, payment_status: 'pending',
                  created_at: new Date().toISOString(), clothing_order_items: [{ count: form.quantity }], notes: form.notes
                }
                setLocalPedidos(prev => [newOrder, ...prev])
                setShowNew(false)
                setForm({ playerName: '', description: '', size: 'M', quantity: 1, price: 0, notes: '' })
                toast.success('Pedido creado')
              }} className="px-4 py-2 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
                Crear pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
