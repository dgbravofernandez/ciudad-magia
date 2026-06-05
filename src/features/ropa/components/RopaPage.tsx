'use client'
import { Shirt, Plus, Package, DollarSign, Clock, CheckCircle, XCircle, Pencil, Trash2, Search, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { createClothingOrder, markClothingOrderPaid, refundClothingOrder, deleteClothingOrder, updateClothingOrder, updateClothingCatalog, type ClothingPaymentMethod, type ClothingCatalogItem } from '@/features/ropa/actions/clothing.actions'

interface OrderItem { count: number }
interface Player { first_name: string; last_name: string }
interface PlayerOption { id: string; first_name: string; last_name: string; tutor_phone?: string | null }
interface Order {
  id: string
  player_id: string | null
  player: Player | null
  description: string | null
  total_amount: number
  amount_paid: number
  payment_status: 'pending' | 'partial' | 'paid' | 'cancelled'
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

interface Props { pedidos: Order[]; players: PlayerOption[]; clubId: string; catalog: ClothingCatalogItem[] }

function buildPhoneMap(players: PlayerOption[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const p of players) {
    if (p.tutor_phone) m.set(p.id, p.tutor_phone)
  }
  return m
}

const ADULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const KID_SIZES = ['128', '140', '152', '164']
const SIZES = [...ADULT_SIZES, ...KID_SIZES]
const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: 'bg-yellow-50 text-yellow-700', icon: Clock },
  partial: { label: 'Parcial', color: 'bg-blue-50 text-blue-700', icon: Clock },
  paid: { label: 'Pagado', color: 'bg-green-50 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-50 text-red-700', icon: XCircle },
}

export function RopaPage({ pedidos, players, clubId: _clubId, catalog: initialCatalog }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const phoneMap = buildPhoneMap(players)
  const [filter, setFilter] = useState<'all' | 'pending' | 'partial' | 'paid' | 'cancelled'>('all')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ playerName: '', description: '', size: 'M', quantity: 1, price: 0, notes: '' })

  // Catalog state
  const [catalogItems, setCatalogItems] = useState<ClothingCatalogItem[]>(initialCatalog)
  const [showCatalogModal, setShowCatalogModal] = useState(false)
  const [catalogDraft, setCatalogDraft] = useState<ClothingCatalogItem[]>(initialCatalog)
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')

  // Player selector state for new order form
  const [playerQuery, setPlayerQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerOption | null>(null)
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false)
  const [useExternalPlayer, setUseExternalPlayer] = useState(false)
  const filteredPlayers = players.filter(p => {
    const q = playerQuery.toLowerCase()
    return q.length >= 1 && (
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      `${p.last_name} ${p.first_name}`.toLowerCase().includes(q)
    )
  }).slice(0, 8)
  // Pay-modal: ask payment method before registering to caja
  const [payTarget, setPayTarget] = useState<Order | null>(null)
  const [payMethod, setPayMethod] = useState<ClothingPaymentMethod>('cash')
  const [payAmount, setPayAmount] = useState<number>(0)
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
    const playerName = useExternalPlayer
      ? form.playerName.trim()
      : selectedPlayer
        ? `${selectedPlayer.first_name} ${selectedPlayer.last_name}`
        : playerQuery.trim()

    if (!playerName || !form.description) {
      toast.error('Completa los campos obligatorios')
      return
    }
    startTransition(async () => {
      const r = await createClothingOrder({
        playerName,
        playerId: !useExternalPlayer ? (selectedPlayer?.id ?? null) : null,
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
        setSelectedPlayer(null)
        setPlayerQuery('')
        setUseExternalPlayer(false)
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error al crear el pedido')
      }
    })
  }

  function handleSaveCatalog() {
    // filter out empty rows
    const valid = catalogDraft.filter(i => i.name.trim())
    startTransition(async () => {
      const r = await updateClothingCatalog(valid)
      if (r.success) {
        setCatalogItems(valid)
        setShowCatalogModal(false)
        toast.success('Catálogo guardado')
      } else {
        toast.error(r.error ?? 'Error al guardar catálogo')
      }
    })
  }

  function openCatalogModal() {
    setCatalogDraft(catalogItems.map(i => ({ ...i })))
    setNewItemName('')
    setNewItemPrice('')
    setShowCatalogModal(true)
  }

  function openPayModal(order: Order) {
    setPayTarget(order)
    setPayMethod('cash')
    const remaining = Number(order.total_amount) - Number(order.amount_paid ?? 0)
    setPayAmount(+remaining.toFixed(2))
  }

  function handleConfirmPay() {
    if (!payTarget) return
    const target = payTarget
    const remaining = Number(target.total_amount) - Number(target.amount_paid ?? 0)
    const amountToSend = Math.min(payAmount, remaining)
    startTransition(async () => {
      const r = await markClothingOrderPaid(target.id, payMethod, amountToSend < remaining ? amountToSend : undefined)
      if (r.success) {
        if (r.emailSent) {
          toast.success('Pago registrado y email enviado a la familia')
        } else {
          toast.warning(`Pago registrado, pero el email NO se envió: ${r.emailError ?? 'motivo desconocido'}`)
        }
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
        <div className="flex items-center gap-2">
          <button onClick={openCatalogModal} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50">
            <Shirt className="w-4 h-4" /> Catálogo
          </button>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
            <Plus className="w-4 h-4" /> Nuevo pedido
          </button>
        </div>
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
        {(['all', 'pending', 'partial', 'paid', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s as typeof filter)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'}`}>
            {s === 'all' ? 'Todos' : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label}
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
                {['Jugador', 'Teléfono', 'Descripción', 'Artículos', 'Total', 'Estado', 'Fecha', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => {
                const status = STATUS_CONFIG[p.payment_status]
                const StatusIcon = status.icon
                const remaining = Number(p.total_amount) - Number(p.amount_paid ?? 0)
                const isPartial = p.payment_status === 'partial'
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{fullName(p.player, p.notes)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {p.player_id && phoneMap.get(p.player_id)
                        ? <a href={`tel:${phoneMap.get(p.player_id)}`} className="hover:text-blue-600 font-medium">{phoneMap.get(p.player_id)}</a>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.description ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.clothing_order_items?.[0]?.count ?? 0} artículos</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {isPartial
                        ? <><span className="text-blue-600">{Number(p.amount_paid).toFixed(2)} €</span><span className="text-gray-400 font-normal"> / {Number(p.total_amount).toFixed(2)} €</span></>
                        : <>{Number(p.total_amount).toFixed(2)} €</>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />{status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{format(new Date(p.created_at), 'd MMM yyyy', { locale: es })}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {(p.payment_status === 'pending' || p.payment_status === 'partial') && (
                          <button
                            onClick={() => openPayModal(p)}
                            disabled={isPending}
                            className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 disabled:opacity-50"
                          >
                            {isPartial ? `Cobrar (${remaining.toFixed(2)} € pdte.)` : 'Cobrar'}
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
                  <input type="number" min={0} step={0.01} inputMode="decimal" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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

      {/* Pay modal — ask payment method + amount, then register to caja */}
      {payTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPayTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Registrar pago</h3>
              <p className="text-sm text-gray-500 mt-1">
                {fullName(payTarget.player, payTarget.notes)}
              </p>
              {payTarget.payment_status === 'partial' && (
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  Pagado: {Number(payTarget.amount_paid).toFixed(2)} € / Total: {Number(payTarget.total_amount).toFixed(2)} €
                </p>
              )}
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Importe a cobrar ahora (€)
                </label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  inputMode="decimal"
                  value={payAmount}
                  onChange={e => setPayAmount(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Pendiente: {(Number(payTarget.total_amount) - Number(payTarget.amount_paid ?? 0)).toFixed(2)} €
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pago</label>
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
              </div>
              <p className="text-xs text-gray-400">Se creará un movimiento de ingreso en caja ligado a este pedido.</p>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setPayTarget(null)} disabled={isPending} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50">Cancelar</button>
              <button onClick={handleConfirmPay} disabled={isPending || payAmount <= 0} className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
                {isPending ? 'Guardando...' : `Confirmar ${payAmount > 0 ? payAmount.toFixed(2) + ' €' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New order modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowNew(false); setSelectedPlayer(null); setPlayerQuery(''); setUseExternalPlayer(false) }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Nuevo pedido de ropa</h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Catálogo — selector rápido */}
              {catalogItems.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Artículo del catálogo</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value=""
                    onChange={e => {
                      const item = catalogItems.find(i => i.name === e.target.value)
                      if (item) setForm(f => ({ ...f, description: item.name, price: item.price }))
                    }}
                  >
                    <option value="">— Seleccionar del catálogo —</option>
                    {catalogItems.map(i => (
                      <option key={i.name} value={i.name}>{i.name} — {i.price.toFixed(2)} €</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Player selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Jugador</label>
                  <button
                    type="button"
                    onClick={() => { setUseExternalPlayer(v => !v); setSelectedPlayer(null); setPlayerQuery('') }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {useExternalPlayer ? '← Seleccionar del club' : 'Externo / manual'}
                  </button>
                </div>

                {useExternalPlayer ? (
                  /* Texto libre para externos */
                  <input
                    value={form.playerName}
                    onChange={e => setForm(f => ({ ...f, playerName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre completo"
                  />
                ) : (
                  /* Buscador con dropdown */
                  <div className="relative">
                    {selectedPlayer ? (
                      /* Jugador seleccionado — mostrar chip con teléfono */
                      <div className="border border-blue-300 bg-blue-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-blue-800 flex-1">
                            {selectedPlayer.last_name}, {selectedPlayer.first_name}
                          </span>
                          <button
                            type="button"
                            onClick={() => { setSelectedPlayer(null); setPlayerQuery('') }}
                            className="text-blue-400 hover:text-blue-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {selectedPlayer.tutor_phone && (
                          <p className="text-xs text-blue-600 mt-0.5">📞 {selectedPlayer.tutor_phone}</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            value={playerQuery}
                            onChange={e => { setPlayerQuery(e.target.value); setShowPlayerDropdown(true) }}
                            onFocus={() => setShowPlayerDropdown(true)}
                            onBlur={() => setTimeout(() => setShowPlayerDropdown(false), 150)}
                            className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Buscar jugador del club…"
                          />
                        </div>
                        {showPlayerDropdown && filteredPlayers.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredPlayers.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onMouseDown={() => { setSelectedPlayer(p); setPlayerQuery(''); setShowPlayerDropdown(false) }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-gray-800"
                              >
                                <span className="font-medium">{p.last_name}</span>, {p.first_name}
                              </button>
                            ))}
                          </div>
                        )}
                        {showPlayerDropdown && playerQuery.length >= 1 && filteredPlayers.length === 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
                            Sin resultados — usa &ldquo;Externo / manual&rdquo; si no está en el club
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
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
                  <input type="number" min={0} step={0.01} inputMode="decimal" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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

      {/* Catalog manager modal */}
      {showCatalogModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCatalogModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Catálogo de artículos</h3>
              <p className="text-xs text-gray-500 mt-1">Define artículos con precio estándar. Al crear un pedido se auto-rellena el precio.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {catalogDraft.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={item.name}
                    onChange={e => setCatalogDraft(d => d.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    placeholder="Nombre del artículo"
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    inputMode="decimal"
                    value={item.price}
                    onChange={e => setCatalogDraft(d => d.map((x, i) => i === idx ? { ...x, price: Number(e.target.value) } : x))}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    placeholder="€"
                  />
                  <button
                    type="button"
                    onClick={() => setCatalogDraft(d => d.filter((_, i) => i !== idx))}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {/* Add new item row */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <input
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  placeholder="Nuevo artículo..."
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newItemName.trim()) {
                      setCatalogDraft(d => [...d, { name: newItemName.trim(), price: Number(newItemPrice) || 0 }])
                      setNewItemName('')
                      setNewItemPrice('')
                    }
                  }}
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                  value={newItemPrice}
                  onChange={e => setNewItemPrice(e.target.value)}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  placeholder="€"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newItemName.trim()) return
                    setCatalogDraft(d => [...d, { name: newItemName.trim(), price: Number(newItemPrice) || 0 }])
                    setNewItemName('')
                    setNewItemPrice('')
                  }}
                  className="p-1 text-green-600 hover:text-green-800"
                  title="Añadir"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowCatalogModal(false)} disabled={isPending} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50">Cancelar</button>
              <button onClick={handleSaveCatalog} disabled={isPending} className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
                {isPending ? 'Guardando...' : 'Guardar catálogo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
