'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Upload, FileText, Search, Check, X, RotateCcw, Trash2, AlertCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/currency'
import {
  uploadBankTransfersPdf,
  assignBankTransfer,
  ignoreBankTransfer,
  resetBankTransfer,
  deleteBankTransferUpload,
} from '@/features/contabilidad/actions/bank-transfers.actions'

interface Transfer {
  id: string
  upload_id: string | null
  transfer_date: string
  amount: number
  concept: string
  payer: string | null
  status: 'pending' | 'assigned' | 'ignored'
  matched_player_id: string | null
  matched_payment_id: string | null
  match_confidence: number | null
  notes: string | null
}

interface Upload {
  id: string
  filename: string
  total_rows: number
  total_amount: number
  created_at: string
}

interface PlayerOpt {
  id: string
  first_name: string
  last_name: string
  tutor_name: string | null
  team_name: string | null
}

interface Props {
  canManage: boolean
  transfers: Transfer[]
  uploads: Upload[]
  players: PlayerOpt[]
}

type Tab = 'pending' | 'assigned' | 'ignored' | 'uploads'

export function BankTransfersPage({ canManage, transfers, uploads, players }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('pending')
  const [isPending, startTransition] = useTransition()
  const [assignTarget, setAssignTarget] = useState<Transfer | null>(null)
  const [search, setSearch] = useState('')

  const counts = useMemo(() => ({
    pending: transfers.filter(t => t.status === 'pending').length,
    assigned: transfers.filter(t => t.status === 'assigned').length,
    ignored: transfers.filter(t => t.status === 'ignored').length,
  }), [transfers])

  const visible = useMemo(() => {
    if (tab === 'uploads') return []
    const filtered = transfers.filter(t => t.status === tab)
    if (!search.trim()) return filtered
    const s = search.toLowerCase()
    return filtered.filter(t =>
      t.concept.toLowerCase().includes(s) ||
      (t.payer ?? '').toLowerCase().includes(s) ||
      String(t.amount).includes(s),
    )
  }, [transfers, tab, search])

  const playerById = useMemo(() => {
    const m = new Map<string, PlayerOpt>()
    for (const p of players) m.set(p.id, p)
    return m
  }, [players])

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const file = fd.get('file') as File | null
    if (!file || !file.name) { toast.error('Selecciona un PDF'); return }

    startTransition(async () => {
      const res = await uploadBankTransfersPdf(fd)
      if (res.success) {
        toast.success(`Procesado: ${res.parsed} transferencias, ${res.autoMatched} con match automático`)
        form.reset()
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error al procesar PDF')
      }
    })
  }

  function handleIgnore(t: Transfer) {
    if (!confirm(`Ignorar transferencia de ${formatCurrency(t.amount)}?`)) return
    startTransition(async () => {
      const res = await ignoreBankTransfer(t.id)
      if (res.success) { toast.success('Ignorada'); router.refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  function handleReset(t: Transfer) {
    startTransition(async () => {
      const res = await resetBankTransfer(t.id)
      if (res.success) { toast.success('Restaurada a pendiente'); router.refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  function handleDeleteUpload(u: Upload) {
    if (!confirm(`Borrar el upload "${u.filename}" y todas sus ${u.total_rows} transferencias? Esta acción no se puede deshacer.`)) return
    startTransition(async () => {
      const res = await deleteBankTransferUpload(u.id)
      if (res.success) { toast.success('Upload borrado'); router.refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  if (!canManage) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex items-center gap-3 text-amber-900">
        <AlertCircle className="h-5 w-5" />
        Solo admin / dirección puede gestionar transferencias bancarias.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      <form onSubmit={handleUpload} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Upload className="h-4 w-4" />
          Subir PDF de transferencias del banco
        </div>
        <input
          type="file"
          name="file"
          accept="application/pdf"
          required
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white file:cursor-pointer"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? 'Procesando…' : 'Procesar'}
        </button>
        <p className="text-xs text-slate-500 basis-full">
          Sube el extracto en PDF. Se detectan automáticamente las transferencias entrantes y se intenta cruzar con los nombres de jugadores/tutores.
        </p>
      </form>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <TabBtn active={tab==='pending'} onClick={() => setTab('pending')} label={`Pendientes (${counts.pending})`} />
        <TabBtn active={tab==='assigned'} onClick={() => setTab('assigned')} label={`Asignadas (${counts.assigned})`} />
        <TabBtn active={tab==='ignored'} onClick={() => setTab('ignored')} label={`Ignoradas (${counts.ignored})`} />
        <TabBtn active={tab==='uploads'} onClick={() => setTab('uploads')} label={`Uploads (${uploads.length})`} />
      </div>

      {tab !== 'uploads' && (
        <>
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar concepto, ordenante o importe…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* List */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-right px-3 py-2">Importe</th>
                  <th className="text-left px-3 py-2">Concepto</th>
                  <th className="text-left px-3 py-2">Ordenante</th>
                  <th className="text-left px-3 py-2">Match</th>
                  <th className="text-right px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500">No hay transferencias en esta vista.</td></tr>
                )}
                {visible.map(t => {
                  const matched = t.matched_player_id ? playerById.get(t.matched_player_id) : null
                  return (
                    <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(t.transfer_date)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatCurrency(t.amount)}</td>
                      <td className="px-3 py-2 max-w-[420px] truncate" title={t.concept}>{t.concept}</td>
                      <td className="px-3 py-2 text-slate-600">{t.payer ?? '—'}</td>
                      <td className="px-3 py-2">
                        {matched ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{matched.first_name} {matched.last_name}</span>
                            <span className="text-xs text-slate-500">
                              {matched.team_name ?? 'Sin equipo'}
                              {t.match_confidence != null && ` · ${(t.match_confidence * 100).toFixed(0)}%`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Sin asignar</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {t.status === 'pending' && (
                            <>
                              <button
                                onClick={() => setAssignTarget(t)}
                                className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 text-xs flex items-center gap-1"
                              >
                                <Check className="h-3 w-3" /> Asignar
                              </button>
                              <button
                                onClick={() => handleIgnore(t)}
                                disabled={isPending}
                                className="rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 text-xs flex items-center gap-1"
                              >
                                <X className="h-3 w-3" /> Ignorar
                              </button>
                            </>
                          )}
                          {t.status !== 'pending' && (
                            <button
                              onClick={() => handleReset(t)}
                              disabled={isPending}
                              className="rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 text-xs flex items-center gap-1"
                            >
                              <RotateCcw className="h-3 w-3" /> Reabrir
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
        </>
      )}

      {tab === 'uploads' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Fichero</th>
                <th className="text-left px-3 py-2">Subido</th>
                <th className="text-right px-3 py-2">Filas</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-right px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {uploads.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Aún no se ha subido ningún PDF.</td></tr>
              )}
              {uploads.map(u => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="font-medium">{u.filename}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{formatDate(u.created_at)}</td>
                  <td className="px-3 py-2 text-right">{u.total_rows}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(u.total_amount)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleDeleteUpload(u)}
                      disabled={isPending}
                      className="rounded-md bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1 text-xs inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignTarget && (
        <AssignModal
          transfer={assignTarget}
          players={players}
          onClose={() => setAssignTarget(null)}
          onDone={() => { setAssignTarget(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
        active ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  )
}

function AssignModal({
  transfer, players, onClose, onDone,
}: {
  transfer: Transfer
  players: PlayerOpt[]
  onClose: () => void
  onDone: () => void
}) {
  const [search, setSearch] = useState('')
  const [playerId, setPlayerId] = useState<string>(transfer.matched_player_id ?? '')
  const [createPayment, setCreatePayment] = useState(true)
  const [paymentMonth, setPaymentMonth] = useState<string>(transfer.transfer_date.slice(0, 7))
  const [notes, setNotes] = useState<string>(`Transferencia: ${transfer.concept}`.slice(0, 500))
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim()
    if (!s) return players.slice(0, 50)
    return players.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(s) ||
      (p.tutor_name ?? '').toLowerCase().includes(s) ||
      (p.team_name ?? '').toLowerCase().includes(s),
    ).slice(0, 100)
  }, [players, search])

  function handleSave() {
    if (!playerId) { toast.error('Selecciona un jugador'); return }
    startTransition(async () => {
      const res = await assignBankTransfer({
        transferId: transfer.id,
        playerId,
        createPayment,
        paymentMonth: createPayment ? paymentMonth : undefined,
        paymentNotes: createPayment ? notes : undefined,
      })
      if (res.success) { toast.success('Transferencia asignada'); onDone() }
      else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-lg font-semibold">Asignar transferencia</h3>
          <p className="text-sm text-slate-500 mt-1">
            {formatDate(transfer.transfer_date)} · <span className="font-semibold text-emerald-700">{formatCurrency(transfer.amount)}</span>
          </p>
          <p className="text-xs text-slate-600 mt-2 bg-slate-50 rounded p-2">{transfer.concept}</p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Buscar jugador</label>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nombre del jugador, tutor o equipo…"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="border border-slate-200 rounded-md max-h-60 overflow-y-auto">
            {filtered.length === 0 && <p className="text-sm text-slate-500 p-3">Sin resultados</p>}
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => setPlayerId(p.id)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-slate-100 last:border-b-0 hover:bg-slate-50 ${playerId === p.id ? 'bg-emerald-50' : ''}`}
              >
                <div className="font-medium">{p.first_name} {p.last_name}</div>
                <div className="text-xs text-slate-500">
                  {p.team_name ?? 'Sin equipo'}{p.tutor_name ? ` · Tutor: ${p.tutor_name}` : ''}
                </div>
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={createPayment} onChange={e => setCreatePayment(e.target.checked)} />
            Crear pago de cuota asociado ({formatCurrency(transfer.amount)})
          </label>

          {createPayment && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mes (YYYY-MM)</label>
                <input
                  value={paymentMonth}
                  onChange={e => setPaymentMonth(e.target.value)}
                  placeholder="2025-10"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
                <input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={isPending || !playerId}
            className="px-4 py-2 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
          >
            {isPending ? 'Guardando…' : 'Asignar'}
          </button>
        </div>
      </div>
    </div>
  )
}
