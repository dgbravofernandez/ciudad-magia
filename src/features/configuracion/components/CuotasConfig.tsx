'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Save, Euro, Calendar, Percent } from 'lucide-react'
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

// quota_amounts JSONB structure:
// { annual: 360, earlyPayDiscount: 5, installments: [{ label, amount, deadline }], teams: { "id": 400 } }
type QuotaAmounts = {
  annual: number
  earlyPayDiscount: number
  installments: { label: string; amount: number; deadline: string }[]
  teams: Record<string, number>
}

const DEFAULT_INSTALLMENTS = [
  { label: '1er plazo', amount: 120, deadline: '07-01' },
  { label: '2do plazo', amount: 120, deadline: '09-01' },
  { label: '3er plazo', amount: 120, deadline: '11-01' },
]

export function CuotasConfig({ clubId, settings, teams }: Props) {
  const raw = (settings?.quota_amounts as QuotaAmounts) ?? {
    annual: 360,
    earlyPayDiscount: 5,
    installments: DEFAULT_INSTALLMENTS,
    teams: {},
  }

  const [annual, setAnnual] = useState(raw.annual ?? 360)
  const [earlyDiscount, setEarlyDiscount] = useState(raw.earlyPayDiscount ?? 5)
  const [installments, setInstallments] = useState(
    raw.installments?.length ? raw.installments : DEFAULT_INSTALLMENTS
  )
  const [teamAmounts, setTeamAmounts] = useState<Record<string, number>>(raw.teams ?? {})
  const [siblingDiscount] = useState((settings?.sibling_discount_percent as number) ?? 40)
  const [isPending, startTransition] = useTransition()

  function updateInstallment(index: number, field: 'amount' | 'deadline' | 'label', value: string) {
    setInstallments((prev) => {
      const next = [...prev]
      if (field === 'amount') {
        next[index] = { ...next[index], amount: parseFloat(value) || 0 }
      } else {
        next[index] = { ...next[index], [field]: value }
      }
      return next
    })
  }

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
        quotaAmounts: {
          annual,
          earlyPayDiscount: earlyDiscount,
          installments,
          teams: teamAmounts,
        },
        deadlineDay: (settings?.quota_deadline_day as number) ?? 5,
      })
      if (result.success) {
        toast.success('Cuotas guardadas correctamente')
      } else {
        toast.error(result.error ?? 'Error al guardar')
      }
    })
  }

  const discountedTotal = annual * (1 - earlyDiscount / 100)
  const installmentTotal = installments.reduce((s, i) => s + i.amount, 0)

  const MONTH_NAMES: Record<string, string> = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
  }

  function deadlineLabel(deadline: string) {
    const [mm, dd] = deadline.split('-')
    return `${dd} de ${MONTH_NAMES[mm] ?? mm}`
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Annual quota */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Euro className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Cuota anual</h3>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            step="1"
            min="0"
            className="input w-32"
            value={annual || ''}
            onChange={(e) => setAnnual(parseFloat(e.target.value) || 0)}
            placeholder="360"
          />
          <span className="text-sm text-muted-foreground">EUR / temporada</span>
        </div>
      </div>

      {/* Early payment discount */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Descuento por pago anticipado</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Porcentaje de descuento si el jugador paga la cuota anual completa de una vez.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            max="100"
            className="input w-20"
            value={earlyDiscount}
            onChange={(e) => setEarlyDiscount(parseInt(e.target.value) || 0)}
          />
          <span className="text-sm text-muted-foreground">%</span>
          <span className="text-sm text-muted-foreground ml-4">
            Pago completo: <strong>{formatCurrency(discountedTotal)}</strong> (ahorra {formatCurrency(annual - discountedTotal)})
          </span>
        </div>
      </div>

      {/* Installments */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Plazos de pago</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Los jugadores pueden pagar en plazos. Configura el importe y la fecha limite de cada plazo.
        </p>
        <div className="space-y-3">
          {installments.map((inst, i) => (
            <div key={i} className="flex items-center gap-3 flex-wrap">
              <input
                type="text"
                className="input w-28"
                value={inst.label}
                onChange={(e) => updateInstallment(i, 'label', e.target.value)}
                placeholder={`Plazo ${i + 1}`}
              />
              <input
                type="number"
                step="1"
                min="0"
                className="input w-24"
                value={inst.amount || ''}
                onChange={(e) => updateInstallment(i, 'amount', e.target.value)}
                placeholder="120"
              />
              <span className="text-xs text-muted-foreground">EUR antes del</span>
              <input
                type="text"
                className="input w-24"
                value={inst.deadline}
                onChange={(e) => updateInstallment(i, 'deadline', e.target.value)}
                placeholder="MM-DD"
              />
              <span className="text-xs text-muted-foreground">{deadlineLabel(inst.deadline)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Total plazos:</span>
          <strong className={installmentTotal !== annual ? 'text-amber-600' : 'text-green-600'}>
            {formatCurrency(installmentTotal)}
          </strong>
          {installmentTotal !== annual && (
            <span className="text-xs text-amber-600">(no coincide con la cuota anual de {formatCurrency(annual)})</span>
          )}
        </div>
      </div>

      {/* Per-team override */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-lg">Cuota anual por equipo</h3>
        <p className="text-sm text-muted-foreground">
          Deja en blanco para usar la cuota por defecto ({formatCurrency(annual)}).
        </p>
        <div className="space-y-3">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center gap-3">
              <span className="text-sm font-medium w-48 truncate">{team.name}</span>
              <input
                type="number"
                step="1"
                min="0"
                className="input w-28"
                value={teamAmounts[team.id] ?? ''}
                onChange={(e) => handleTeamAmount(team.id, e.target.value)}
                placeholder={String(annual)}
              />
              <span className="text-xs text-muted-foreground">EUR/temporada</span>
            </div>
          ))}
          {teams.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No hay equipos activos configurados.</p>
          )}
        </div>
      </div>

      {/* Sibling discount info */}
      <div className="card p-6 space-y-2">
        <h3 className="font-semibold text-lg">Descuento hermanos</h3>
        <p className="text-sm text-muted-foreground">
          Actualmente configurado al <strong>{siblingDiscount}%</strong> de descuento sobre la cuota del hermano mas barato.
          Puedes modificar este valor en <em>Configuracion &gt; Ajustes generales</em>.
        </p>
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
