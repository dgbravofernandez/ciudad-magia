'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Bell, BellOff, Send, Loader2, Search, Users } from 'lucide-react'
import { sendMilestoneReminder } from '@/features/contabilidad/actions/accounting.actions'

export interface AvisoPlayerRow {
  id: string
  name: string
  teamName: string
  tutorEmail: string | null
}

interface Installment {
  label: string
  amount: number
  deadline?: string
}

interface Props {
  players: AvisoPlayerRow[]
  installments: Installment[]       // de quota_amounts.installments
  reminderHistory: Record<string, Record<string, string[]>>  // playerId→milestone→sentAt[]
  season: string
}

type AvisoFilter = 'todos' | 'avisados' | 'sin_avisar'

const RESERVA_MILESTONE = 'Reserva de plaza'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function AvisosPanel({ players, installments, reminderHistory, season }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<AvisoFilter>('todos')

  // Milestone seleccionado — reserva siempre disponible + los installments configurados
  const milestones: Installment[] = [
    { label: RESERVA_MILESTONE, amount: 0 },  // importe 0 = usuario lo fija
    ...installments,
  ]
  const [selectedIdx, setSelectedIdx] = useState(0)
  const selected = milestones[selectedIdx]

  // Importe del aviso — editable, pre-rellena con el del milestone
  const [amount, setAmount] = useState<string>(selected.amount > 0 ? String(selected.amount) : '')

  // Sync amount al cambiar milestone
  function selectMilestone(idx: number) {
    setSelectedIdx(idx)
    const ms = milestones[idx]
    setAmount(ms.amount > 0 ? String(ms.amount) : '')
  }

  // Historial local (se actualiza optimistamente al enviar)
  const [localHistory, setLocalHistory] = useState<Record<string, Record<string, string[]>>>(reminderHistory)

  function lastSent(playerId: string): string | null {
    const dates = localHistory[playerId]?.[selected.label]
    return dates?.[0] ?? null
  }

  function markSent(playerIds: string[]) {
    const now = new Date().toISOString()
    setLocalHistory(prev => {
      const next = { ...prev }
      for (const id of playerIds) {
        if (!next[id]) next[id] = {}
        next[id][selected.label] = [now, ...(next[id][selected.label] ?? [])]
      }
      return next
    })
  }

  const parsedAmount = parseFloat(amount)
  const amountValid = !isNaN(parsedAmount) && parsedAmount > 0

  const filteredPlayers = useMemo(() => {
    const q = search.toLowerCase()
    return players.filter(p => {
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q)
      const sent = !!lastSent(p.id)
      const matchFilter =
        filter === 'todos' ? true :
        filter === 'avisados' ? sent :
        !sent
      return matchSearch && matchFilter
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, search, filter, localHistory, selectedIdx])

  const withEmail = filteredPlayers.filter(p => p.tutorEmail)
  const withoutEmail = filteredPlayers.filter(p => !p.tutorEmail)
  const notYetSent = filteredPlayers.filter(p => p.tutorEmail && !lastSent(p.id))

  async function sendToPlayers(playerIds: string[]) {
    if (!amountValid) { toast.error('Introduce el importe antes de enviar'); return }
    setSendingIds(prev => new Set([...prev, ...playerIds]))
    startTransition(async () => {
      const res = await sendMilestoneReminder({
        playerIds,
        milestone: selected.label,
        amount: parsedAmount,
        season,
      })
      if (res.success || (res.sent ?? 0) > 0) {
        markSent(playerIds)
        const msgs = [`✉ ${res.sent} enviado${res.sent !== 1 ? 's' : ''}`]
        if (res.skippedNoEmail) msgs.push(`${res.skippedNoEmail} sin email`)
        if (res.failed) msgs.push(`${res.failed} fallidos`)
        toast.success(msgs.join(' · '))
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error al enviar')
      }
      setSendingIds(prev => {
        const s = new Set(prev); playerIds.forEach(id => s.delete(id)); return s
      })
    })
  }

  const sentCount = players.filter(p => !!lastSent(p.id)).length
  const pendingCount = players.filter(p => p.tutorEmail && !lastSent(p.id)).length

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-yellow-500" />
          <h3 className="font-semibold text-sm">Avisos de pago</h3>
          <span className="text-xs text-muted-foreground">
            {sentCount} avisados · {pendingCount} sin avisar
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Selector de hito */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Concepto del aviso</p>
          <div className="flex flex-wrap gap-2">
            {milestones.map((ms, idx) => (
              <button key={ms.label} onClick={() => selectMilestone(idx)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedIdx === idx
                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                    : 'bg-muted text-muted-foreground border border-transparent hover:border-border'
                }`}>
                {ms.label}
                {ms.amount > 0 && <span className="ml-1 opacity-70 text-xs">{ms.amount}€</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Importe */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Importe del aviso (€)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-32 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
              />
              {!amountValid && amount !== '' && (
                <span className="text-xs text-red-400">Importe no válido</span>
              )}
            </div>
          </div>

          {/* Botón envío en bloque */}
          {notYetSent.length > 0 && (
            <div className="flex flex-col gap-1 ml-auto">
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Envío masivo
              </label>
              <button
                onClick={() => {
                  if (!amountValid) { toast.error('Introduce el importe antes de enviar'); return }
                  if (!confirm(`¿Enviar aviso "${selected.label}" (${amount}€) a ${notYetSent.length} jugadores sin avisar?`)) return
                  sendToPlayers(notYetSent.map(p => p.id))
                }}
                disabled={isPending || !amountValid}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-black text-sm font-medium disabled:opacity-50">
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                Avisar a {notYetSent.length} sin avisar
              </button>
            </div>
          )}
        </div>

        {/* Filtros + búsqueda */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {(['todos', 'sin_avisar', 'avisados'] as AvisoFilter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  filter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {f === 'todos' ? 'Todos' : f === 'sin_avisar' ? 'Sin avisar' : 'Avisados'}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar jugador..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-yellow-500/30" />
          </div>
        </div>

        {/* Lista */}
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          {filteredPlayers.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">Sin jugadores para este filtro.</p>
          )}
          {filteredPlayers.map(p => {
            const sent = lastSent(p.id)
            const isSending = sendingIds.has(p.id)
            return (
              <div key={p.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                  sent ? 'border-green-500/20 bg-green-900/10' : 'border-border bg-muted/30'
                }`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{p.teamName}</span>
                  </div>
                  {sent && (
                    <p className="text-xs text-green-400 mt-0.5">
                      ✓ Avisado el {fmtDate(sent)}
                      {(localHistory[p.id]?.[selected.label]?.length ?? 0) > 1 &&
                        ` · ${localHistory[p.id][selected.label].length}× total`}
                    </p>
                  )}
                  {!p.tutorEmail && (
                    <p className="text-xs text-orange-400 mt-0.5">Sin email de tutor</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {sent
                    ? <BellOff className="w-3.5 h-3.5 text-green-500" />
                    : <Bell className="w-3.5 h-3.5 text-yellow-500" />}
                  {p.tutorEmail && (
                    <button
                      onClick={() => sendToPlayers([p.id])}
                      disabled={isSending || isPending || !amountValid}
                      title={sent ? 'Reenviar aviso' : 'Enviar aviso'}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs disabled:opacity-40 ${
                        sent
                          ? 'bg-muted hover:bg-muted/80 text-muted-foreground'
                          : 'bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-300'
                      }`}>
                      {isSending
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Send className="w-3 h-3" />}
                      {sent ? 'Reenviar' : 'Avisar'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {withoutEmail.length > 0 && (
          <p className="text-xs text-muted-foreground">
            ⚠ {withoutEmail.length} jugador{withoutEmail.length > 1 ? 'es' : ''} sin email de tutor no recibirán aviso.
          </p>
        )}
      </div>
    </div>
  )
}
