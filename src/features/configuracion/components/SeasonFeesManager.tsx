'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save } from 'lucide-react'
import {
  listSeasonFees,
  upsertSeasonFee,
  deleteSeasonFee,
  type SeasonFee,
} from '../actions/season-fees.actions'

interface Team {
  id: string
  name: string
}

interface Props {
  seasons: string[]
  teams: Team[]
}

export function SeasonFeesManager({ seasons, teams }: Props) {
  const router = useRouter()
  const [season, setSeason] = useState(seasons[0])
  const [fees, setFees] = useState<SeasonFee[]>([])
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  // form nuevo
  const [newConcept, setNewConcept] = useState('Reserva')
  const [newTeam, setNewTeam] = useState<string>('') // '' = cuota por defecto temporada
  const [newAmount, setNewAmount] = useState<number>(0)

  async function reload(s: string) {
    setLoading(true)
    try {
      const data = await listSeasonFees(s)
      setFees(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload(season)
  }, [season])

  function handleAdd() {
    if (!newConcept.trim()) {
      toast.error('Escribe un concepto')
      return
    }
    startTransition(async () => {
      const res = await upsertSeasonFee({
        season,
        team_id: newTeam || null,
        concept: newConcept.trim(),
        amount: Number(newAmount) || 0,
      })
      if (res.success) {
        toast.success('Cuota añadida')
        setNewConcept('Reserva')
        setNewTeam('')
        setNewAmount(0)
        await reload(season)
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  function handleUpdate(f: SeasonFee, amount: number) {
    startTransition(async () => {
      const res = await upsertSeasonFee({
        id: f.id,
        season: f.season,
        team_id: f.team_id,
        concept: f.concept,
        amount,
      })
      if (res.success) {
        toast.success('Guardado')
        await reload(season)
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta cuota?')) return
    startTransition(async () => {
      const res = await deleteSeasonFee(id)
      if (res.success) {
        toast.success('Eliminada')
        setFees((prev) => prev.filter((f) => f.id !== id))
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  const teamsById: Record<string, string> = {}
  for (const t of teams) teamsById[t.id] = t.name

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Cuotas por temporada</h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            Define importes por temporada y equipo (reservas, inscripción, mensualidades…).
            Deja &quot;Equipo&quot; vacío para que sea la cuota por defecto de la temporada.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium">Temporada</label>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="input w-auto"
          >
            {seasons.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="p-2">Concepto</th>
              <th className="p-2">Equipo</th>
              <th className="p-2 text-right">Importe</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Cargando…</td></tr>
            ) : fees.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Sin cuotas para {season}</td></tr>
            ) : (
              fees.map((f) => (
                <FeeRow
                  key={f.id}
                  fee={f}
                  teamName={f.team_id ? (teamsById[f.team_id] ?? '—') : 'Todos (por defecto)'}
                  disabled={isPending}
                  onSave={(amount) => handleUpdate(f, amount)}
                  onDelete={() => handleDelete(f.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Añadir */}
      <div className="border-t pt-4 space-y-2">
        <p className="text-sm font-medium">Añadir cuota</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            type="text"
            value={newConcept}
            onChange={(e) => setNewConcept(e.target.value)}
            placeholder="Concepto (ej: Reserva)"
            className="input"
          />
          <select
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            className="input"
          >
            <option value="">Todos (por defecto)</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            min="0"
            value={newAmount}
            onChange={(e) => setNewAmount(parseFloat(e.target.value) || 0)}
            placeholder="Importe"
            className="input"
          />
          <button
            onClick={handleAdd}
            disabled={isPending}
            className="btn-primary text-sm flex items-center gap-1.5 justify-center"
          >
            <Plus className="w-4 h-4" />
            Añadir
          </button>
        </div>
      </div>
    </section>
  )
}

function FeeRow({
  fee,
  teamName,
  disabled,
  onSave,
  onDelete,
}: {
  fee: SeasonFee
  teamName: string
  disabled: boolean
  onSave: (amount: number) => void
  onDelete: () => void
}) {
  const [amount, setAmount] = useState(fee.amount)
  const dirty = amount !== fee.amount

  return (
    <tr className="border-t">
      <td className="p-2 font-medium">{fee.concept}</td>
      <td className="p-2 text-muted-foreground">{teamName}</td>
      <td className="p-2 text-right">
        <div className="inline-flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="input w-28 text-right"
          />
          <span className="text-xs text-muted-foreground">€</span>
          {dirty && (
            <button
              onClick={() => onSave(amount)}
              disabled={disabled}
              className="text-blue-600 hover:bg-blue-50 p-1 rounded"
              title="Guardar"
            >
              <Save className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
      <td className="p-2">
        <button
          onClick={onDelete}
          disabled={disabled}
          className="text-red-600 hover:bg-red-50 p-1 rounded"
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  )
}
