'use client'

import { useState, useMemo } from 'react'
import { Calculator, Users, User, ChevronDown, ChevronUp, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/currency'

// ── Tipos públicos ────────────────────────────────────────────────────────────

/**
 * Un plan de cuotas para una modalidad/equipo.
 * Se construye en la página a partir de season_fees de la BD.
 */
export interface FeePlan {
  key: string        // team_id o label normalizado
  label: string      // nombre del equipo / modalidad
  reserva: number    // importe que se paga en oficina (no sujeto a prorrateo)
  cuotas: number[]   // mensualidades exactas
  pcTotal: number    // importe total con descuento por pago completo
  totalBase: number  // suma reserva + cuotas (sin descuento)
}

interface Props {
  plans: FeePlan[]
  siblingDiscountPct: number    // % dto hermano — desde club_settings
  earlyPaymentDiscountPct: number  // % dto pago completo — desde club_settings
}

// Meses de la temporada (sep–jun = 10 meses)
const MESES_TEMP = [
  { label: 'Septiembre', restantes: 10 },
  { label: 'Octubre',    restantes: 9  },
  { label: 'Noviembre',  restantes: 8  },
  { label: 'Diciembre',  restantes: 7  },
  { label: 'Enero',      restantes: 6  },
  { label: 'Febrero',    restantes: 5  },
  { label: 'Marzo',      restantes: 4  },
  { label: 'Abril',      restantes: 3  },
  { label: 'Mayo',       restantes: 2  },
  { label: 'Junio',      restantes: 1  },
]

// ── Lógica de cálculo ─────────────────────────────────────────────────────────

function calcSingle(plan: FeePlan) {
  return {
    reserva:    plan.reserva,
    cuotas:     plan.cuotas,
    cuotasSum:  plan.cuotas.reduce((a, b) => a + b, 0),
    total:      plan.totalBase,
    pcTotal:    plan.pcTotal,
    ahorro:     plan.totalBase - plan.pcTotal,
  }
}

function calcSibling(mayor: FeePlan, menor: FeePlan, discountPct: number) {
  const factor = 1 - discountPct / 100          // 0.6 para 40%
  const menorTotalDto   = parseFloat((menor.totalBase * factor).toFixed(2))
  const menorCuotasDto  = parseFloat((menorTotalDto - menor.reserva).toFixed(2))
  const menorCuotaUnit  = parseFloat((menorCuotasDto / (menor.cuotas.length || 1)).toFixed(2))
  const menorCuotasList = Array(menor.cuotas.length || 1).fill(menorCuotaUnit)
  const menorPC         = parseFloat((menorTotalDto * (1 - (mayor.pcTotal < mayor.totalBase ? (mayor.totalBase - mayor.pcTotal) / (mayor.cuotas.reduce((a,b)=>a+b,0)||1) : 0.05))).toFixed(2))

  const famCuotas      = mayor.totalBase + menorTotalDto
  const famPC          = mayor.pcTotal + menorPC
  const separadoCuotas = mayor.totalBase + menor.totalBase
  const separadoPC     = mayor.pcTotal + menor.pcTotal

  return {
    mayor: { ...mayor, cuotasSum: mayor.cuotas.reduce((a, b) => a + b, 0) },
    menor: {
      ...menor,
      cuotasDto:    menorCuotasList,
      cuotasDtoSum: menorCuotasDto,
      totalDto:     menorTotalDto,
      pcDto:        menorPC,
    },
    famCuotas,
    famPC,
    ahorroCuotas: parseFloat((separadoCuotas - famCuotas).toFixed(2)),
    ahorroPC:     parseFloat((separadoPC - famPC).toFixed(2)),
  }
}

function calcProrata(plan: FeePlan, gastosFijos: number, mesesTotales: number, mesesRestantes: number) {
  const variable   = plan.totalBase - gastosFijos
  const varProrrat = parseFloat(((variable / mesesTotales) * mesesRestantes).toFixed(2))
  const toPay      = parseFloat((varProrrat + gastosFijos).toFixed(2))
  return {
    totalAnual:       plan.totalBase,
    gastosFijos,
    variableTotal:    variable,
    variableMensual:  parseFloat((variable / mesesTotales).toFixed(2)),
    variableProrrat:  varProrrat,
    toPay,
    ahorro:           parseFloat((plan.totalBase - toPay).toFixed(2)),
  }
}

// ── Modo manual (club sin season_fees configuradas) ───────────────────────────

function ManualCalculator({ siblingDiscountPct, earlyPaymentDiscountPct }: { siblingDiscountPct: number; earlyPaymentDiscountPct: number }) {
  const [total, setTotal]   = useState(0)
  const [deposito, setDeposito] = useState(0)

  const cuotas     = total - deposito
  const pc         = parseFloat((total * (1 - earlyPaymentDiscountPct / 100)).toFixed(2))
  const sibling    = parseFloat(((total * (1 - siblingDiscountPct / 100))).toFixed(2))
  const famTotal   = total + sibling

  return (
    <div className="p-5 space-y-4">
      <p className="text-sm text-muted-foreground">
        Este club no tiene cuotas de temporada configuradas. Configúralas en la sección <strong>Cuotas por temporada</strong> de abajo para ver el desglose detallado.
        Mientras tanto puedes usar esta calculadora rápida:
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="label">Cuota total anual (€)</label>
          <input type="number" min="0" step="5" className="input w-full"
            value={total || ''} onChange={e => setTotal(parseFloat(e.target.value) || 0)} placeholder="0" />
        </div>
        <div className="space-y-1">
          <label className="label">Depósito / reserva (€)</label>
          <input type="number" min="0" step="5" className="input w-full"
            value={deposito || ''} onChange={e => setDeposito(parseFloat(e.target.value) || 0)} placeholder="0" />
        </div>
      </div>
      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="rounded-xl border bg-muted/10 p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Cuotas</p>
            <p className="font-bold text-lg text-primary">{formatCurrency(cuotas)}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
            <p className="text-xs text-green-700 mb-1">Pago completo (−{earlyPaymentDiscountPct}%)</p>
            <p className="font-bold text-lg text-green-700">{formatCurrency(pc)}</p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-center">
            <p className="text-xs text-purple-700 mb-1">Hermano/a (−{siblingDiscountPct}%)</p>
            <p className="font-bold text-lg text-purple-700">{formatCurrency(sibling)}</p>
          </div>
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-3 text-center">
            <p className="text-xs text-primary mb-1">Total 2 hermanos</p>
            <p className="font-bold text-lg text-primary">{formatCurrency(famTotal)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FeeCalculator({ plans, siblingDiscountPct, earlyPaymentDiscountPct }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [tab, setTab] = useState<'single' | 'sibling' | 'prorata'>('single')

  // Deduplicar planes por label (grupos de mismo precio), tomando el primero como representante
  const uniquePlans = useMemo(() => {
    const seen = new Map<string, FeePlan>()
    for (const p of plans) {
      const key = `${p.totalBase}-${p.reserva}-${p.cuotas.join(',')}`
      if (!seen.has(key)) seen.set(key, { ...p, label: p.label })
    }
    return Array.from(seen.values())
  }, [plans])

  const firstKey = uniquePlans[0]?.key ?? ''
  const [singleKey,  setSingleKey]  = useState<string>(firstKey)
  const [mayorKey,   setMayorKey]   = useState<string>(firstKey)
  const [menorKey,   setMenorKey]   = useState<string>(uniquePlans[uniquePlans.length - 1]?.key ?? firstKey)
  const [prorataKey, setProrataKey] = useState<string>(firstKey)
  const [gastosFijos,    setGastosFijos]    = useState(120)
  const [mesesTotales,   setMesesTotales]   = useState(10)
  const [mesIdx,         setMesIdx]         = useState(4)

  const getPlan = (key: string) => uniquePlans.find(p => p.key === key) ?? uniquePlans[0]

  const single  = useMemo(() => { const p = getPlan(singleKey);  return p ? calcSingle(p) : null },   [singleKey, uniquePlans])
  const sibling = useMemo(() => { const ma = getPlan(mayorKey); const me = getPlan(menorKey); return ma && me ? calcSibling(ma, me, siblingDiscountPct) : null }, [mayorKey, menorKey, siblingDiscountPct, uniquePlans])
  const prorata = useMemo(() => { const p = getPlan(prorataKey); return p ? calcProrata(p, gastosFijos, mesesTotales, MESES_TEMP[mesIdx].restantes) : null }, [prorataKey, gastosFijos, mesesTotales, mesIdx, uniquePlans])

  const tabs = [
    { key: 'single',  icon: User,        label: 'Jugador único' },
    { key: 'sibling', icon: Users,        label: 'Con hermano/a' },
    { key: 'prorata', icon: CalendarDays, label: 'A mitad de temporada' },
  ] as const

  const PlanSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select className="input flex-1 max-w-xs" value={value} onChange={e => onChange(e.target.value)}>
      {uniquePlans.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
    </select>
  )

  return (
    <div className="card overflow-hidden">
      <button type="button" onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <span className="font-semibold">Calculadora de cuotas</span>
          {siblingDiscountPct > 0 && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              Hermanos −{siblingDiscountPct}%
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t">
          {/* Sin planes configurados → modo manual */}
          {uniquePlans.length === 0 ? (
            <ManualCalculator siblingDiscountPct={siblingDiscountPct} earlyPaymentDiscountPct={earlyPaymentDiscountPct} />
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b overflow-x-auto">
                {tabs.map(({ key, icon: Icon, label }) => (
                  <button key={key} type="button" onClick={() => setTab(key)}
                    className={cn('flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                      tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>

              {/* ── TAB: Jugador único ── */}
              {tab === 'single' && single && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <label className="label whitespace-nowrap">Equipo / modalidad:</label>
                    <PlanSelect value={singleKey} onChange={setSingleKey} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border bg-muted/10 p-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Por cuotas</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Reserva (oficina)</span><span className="font-medium">{formatCurrency(single.reserva)}</span></div>
                        {single.cuotas.map((c, i) => (
                          <div key={i} className="flex justify-between"><span className="text-muted-foreground">Cuota {i + 1}</span><span className="font-medium">{formatCurrency(c)}</span></div>
                        ))}
                      </div>
                      <div className="border-t pt-2 flex justify-between items-center">
                        <span className="font-semibold">Total</span>
                        <span className="text-xl font-bold text-primary">{formatCurrency(single.total)}</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Pago completo</p>
                        <span className="text-xs bg-green-700 text-white rounded-full px-2 py-0.5">−{earlyPaymentDiscountPct}%</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Reserva (oficina)</span><span className="font-medium">{formatCurrency(single.reserva)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Resto (pago único, −{earlyPaymentDiscountPct}%)</span><span className="font-medium text-green-700">{formatCurrency(single.pcTotal - single.reserva)}</span></div>
                      </div>
                      <div className="border-t border-green-200 pt-2 flex justify-between items-center">
                        <span className="font-semibold">Total</span><span className="text-xl font-bold text-green-700">{formatCurrency(single.pcTotal)}</span>
                      </div>
                      <p className="text-xs text-green-700">Ahorro: <strong>{formatCurrency(single.ahorro)}</strong></p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB: Con hermano/a ── */}
              {tab === 'sibling' && sibling && (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="label">Hermano/a mayor <span className="text-xs text-muted-foreground">(precio íntegro)</span></label>
                      <PlanSelect value={mayorKey} onChange={setMayorKey} />
                    </div>
                    <div className="space-y-1">
                      <label className="label">Hermano/a menor <span className="text-xs text-muted-foreground">(−{siblingDiscountPct}% sobre total)</span></label>
                      <PlanSelect value={menorKey} onChange={setMenorKey} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border bg-muted/10 p-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sibling.mayor.label} — íntegro</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Reserva</span><span className="font-medium">{formatCurrency(sibling.mayor.reserva)}</span></div>
                        {sibling.mayor.cuotas.map((c, i) => (
                          <div key={i} className="flex justify-between"><span className="text-muted-foreground">Cuota {i+1}</span><span className="font-medium">{formatCurrency(c)}</span></div>
                        ))}
                      </div>
                      <div className="border-t pt-2 space-y-0.5">
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Por cuotas:</span><span className="font-semibold">{formatCurrency(sibling.mayor.totalBase)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pago completo:</span><span className="font-semibold text-green-700">{formatCurrency(sibling.mayor.pcTotal)}</span></div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">{sibling.menor.label} — hermano/a</p>
                        <span className="text-xs bg-purple-700 text-white rounded-full px-2 py-0.5">−{siblingDiscountPct}%</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Reserva (sin dto)</span><span className="font-medium">{formatCurrency(sibling.menor.reserva)}</span></div>
                        {sibling.menor.cuotasDto.map((c, i) => (
                          <div key={i} className="flex justify-between"><span className="text-muted-foreground">Cuota {i+1} (−{siblingDiscountPct}%)</span><span className="font-medium text-purple-700">{formatCurrency(c)}</span></div>
                        ))}
                      </div>
                      <div className="border-t border-purple-200 pt-2 space-y-0.5">
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Por cuotas:</span><span className="font-semibold text-purple-700">{formatCurrency(sibling.menor.totalDto)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pago completo:</span><span className="font-semibold text-green-700">{formatCurrency(sibling.menor.pcDto)}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-bold text-primary mb-3 flex items-center gap-2"><Users className="w-4 h-4" />Total familia</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Por cuotas</p>
                        <p className="text-2xl font-bold text-primary">{formatCurrency(sibling.famCuotas)}</p>
                        <p className="text-xs text-green-700 font-medium mt-1">Ahorro: {formatCurrency(sibling.ahorroCuotas)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pago completo (ambos)</p>
                        <p className="text-2xl font-bold text-green-700">{formatCurrency(sibling.famPC)}</p>
                        <p className="text-xs text-green-700 font-medium mt-1">Ahorro: {formatCurrency(sibling.ahorroPC)}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    * El −{siblingDiscountPct}% se aplica al jugador/a con cuota total menor. La reserva no tiene descuento.
                  </p>
                </div>
              )}

              {/* ── TAB: A mitad de temporada ── */}
              {tab === 'prorata' && prorata && (
                <div className="p-5 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Para jugadores que se incorporan ya comenzada la temporada. Los gastos fijos (seguros, federación…) se pagan íntegros siempre; solo se prorratea la parte variable.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="label">Equipo / modalidad</label>
                      <PlanSelect value={prorataKey} onChange={setProrataKey} />
                    </div>
                    <div className="space-y-1">
                      <label className="label">Mes de incorporación</label>
                      <select className="input w-full" value={mesIdx} onChange={e => setMesIdx(Number(e.target.value))}>
                        {MESES_TEMP.map((m, i) => (
                          <option key={i} value={i}>{m.label} ({m.restantes} mes{m.restantes !== 1 ? 'es' : ''} restante{m.restantes !== 1 ? 's' : ''})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="label">Gastos fijos (€)</label>
                      <input type="number" step="5" min="0" className="input w-full"
                        value={gastosFijos} onChange={e => setGastosFijos(parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                  <div className="rounded-xl border bg-muted/10 p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Desglose del cálculo</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Cuota anual total ({getPlan(prorataKey)?.label})</span><span className="font-medium">{formatCurrency(prorata.totalAnual)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">− Gastos fijos (no prorateables)</span><span className="font-medium text-amber-700">− {formatCurrency(prorata.gastosFijos)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">= Parte variable</span><span className="font-medium">{formatCurrency(prorata.variableTotal)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">÷ {mesesTotales} meses × {MESES_TEMP[mesIdx].restantes} restantes</span><span className="font-medium text-blue-700">{formatCurrency(prorata.variableProrrat)}</span></div>
                      <div className="flex justify-between font-semibold border-t pt-1.5"><span>+ Gastos fijos</span><span>+ {formatCurrency(prorata.gastosFijos)}</span></div>
                    </div>
                    <div className="border-t pt-3 flex items-center justify-between">
                      <div><span className="font-bold text-lg">A pagar</span>{prorata.ahorro > 0 && <span className="ml-2 text-xs text-green-700">Ahorro: {formatCurrency(prorata.ahorro)}</span>}</div>
                      <span className="text-3xl font-bold text-primary">{formatCurrency(prorata.toPay)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="label whitespace-nowrap text-xs">Meses totales en temporada:</label>
                    <input type="number" min="1" max="12" className="input w-20 text-sm"
                      value={mesesTotales} onChange={e => setMesesTotales(parseInt(e.target.value) || 10)} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
