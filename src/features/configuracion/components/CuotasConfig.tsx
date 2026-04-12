'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Save, Euro, Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { saveQuotaSettings } from '@/features/configuracion/actions/settings.actions'

interface Team {
  id: string
  name: string
}

interface Props {
  clubId: string
  settings: Record<string, unknown> | null
  teams: Team[]
}

// quota_amounts JSONB structure: { "default": 50, "teams": { "team-id": 60 } }
type QuotaAmounts = {
  default: number
  teams: Record<string, number>
}

export function CuotasConfig({ clubId, settings, teams }: Props) {
  const raw = (settings?.quota_amounts as QuotaAmounts) ?? { default: 0, teams: {} }
  const [defaultAmount, setDefaultAmount] = useState(raw.default ?? 0)
  const [teamAmounts, setTeamAmounts] = useState<Record<string, number>>(raw.teams ?? {})
  const [deadlineDay, setDeadlineDay] = useState((settings?.quota_deadline_day as number) ?? 5)
  const [isPending, startTransition] = useTransition()

  function handleTeamAmount(teamId: string, value: string) {
    const num = parseFloat(value)
    setTeamAmounts((prev) => {
      const next = { ...prev }
      if (!value || isNaN(num) || num <= 0) {
        delete next[teamId]
      } else {
        next[teamId] = num
      }
      return next
    })
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveQuotaSettings({
        clubId,
        quotaAmounts: { default: defaultAmount, teams: teamAmounts },
        deadlineDay,
      })
      if (result.success) {
        toast.success('Cuotas guardadas correctamente')
      } else {
        toast.error(result.error ?? 'Error al guardar')
      }
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Default quota */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Euro className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Cuota mensual por defecto</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Esta cantidad se aplica a todos los equipos salvo que se configure un importe especifico.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            step="0.01"
            min="0"
            className="input w-32"
            value={defaultAmount || ''}
            onChange={(e) => setDefaultAmount(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
          />
          <span className="text-sm text-muted-foreground">EUR / mes</span>
        </div>
      </div>

      {/* Per-team quotas */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-lg">Cuota por equipo</h3>
        <p className="text-sm text-muted-foreground">
          Deja en blanco para usar la cuota por defecto ({formatCurrency(defaultAmount)}).
        </p>
        <div className="space-y-3">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center gap-3">
              <span className="text-sm font-medium w-48 truncate">{team.name}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input w-28"
                value={teamAmounts[team.id] ?? ''}
                onChange={(e) => handleTeamAmount(team.id, e.target.value)}
                placeholder={String(defaultAmount)}
              />
              <span className="text-xs text-muted-foreground">EUR/mes</span>
            </div>
          ))}
          {teams.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No hay equipos activos configurados.</p>
          )}
        </div>
      </div>

      {/* Deadline */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Dia limite de pago</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Dia del mes hasta el que se puede pagar sin considerarse moroso.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            max="28"
            className="input w-20"
            value={deadlineDay}
            onChange={(e) => setDeadlineDay(parseInt(e.target.value) || 5)}
          />
          <span className="text-sm text-muted-foreground">de cada mes</span>
        </div>
      </div>

      <button
        disabled={isPending}
        onClick={handleSave}
        className="btn-primary gap-2 flex items-center"
      >
        <Save className="w-4 h-4" />
        {isPending ? 'Guardando...' : 'Guardar cuotas'}
      </button>
    </div>
  )
}
