'use client'

import { useState, useMemo } from 'react'
import { Calculator, Users, User, ChevronDown, ChevronUp, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/currency'

// ── Cuotas 26/27 ─────────────────────────────────────────────────────────────
type ModalidadKey = 'F11' | 'F7' | 'FEM' | 'CHU'

interface ModalidadFee {
  label: string
  reserva: number
  cuotas: number[]      // mensualidades exactas
  pcTotal: number       // pago completo ya con -5%
  totalBase: number     // suma reserva + cuotas
}

const MODALIDADES: Record<ModalidadKey, ModalidadFee> = {
  F11: { label: 'Fútbol 11',                       reserva: 60, cuotas: [130, 130, 130], pcTotal: 427.50, totalBase: 450 },
  F7:  { label: 'Fútbol 7 / Benjamín / Prebenjamín', reserva: 60, cuotas: [120, 120, 120], pcTotal: 399.00, totalBase: 420 },
  FEM: { label: 'Femenino',                          reserva: 60, cuotas: [80,  80,  90],  pcTotal: 294.50, totalBase: 310 },
  CHU: { label: 'Chupetes (Debutante)',               reserva: 60, cuotas: [75,  75],       pcTotal: 199.50, totalBase: 210 },
}
const MODALIDAD_OPTIONS: ModalidadKey[] = ['F11', 'F7', 'FEM', 'CHU']

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

// ── Lógica ───────────────────────────────────────────────────────────────────
function calcSingle(key: ModalidadKey) {
  const m = MODALIDADES[key]
  return {
    reserva: m.reserva,
    cuotas: m.cuotas,
    cuotasSum: m.cuotas.reduce((a, b) => a + b, 0),
    total: m.totalBase,
    pcTotal: m.pcTotal,
    ahorro: m.totalBase - m.pcTotal,
  }
}

// Prorrateo: los gastosFijos son la parte NO proratable dentro del total
// Variable = total - gastosFijos → se divide entre meses totales × meses restantes
// Total a pagar = variable_prorrateada + gastosFijos
function calcProrata(
  key: ModalidadKey,
  gastosFijos: number,
  mesesTotales: number,
  mesesRestantes: number,
) {
  const { totalBase } = MODALIDADES[key]
  const variable   = totalBase - gastosFijos
  const varProrrat = parseFloat(((variable / mesesTotales) * mesesRestantes).toFixed(2))
  const toPay      = parseFloat((varProrrat + gastosFijos).toFixed(2))
  return {
    totalAnual: totalBase,
    gastosFijos,
    variableTotal: variable,
    variableMensual: parseFloat((variable / mesesTotales).toFixed(2)),
    variableProrrat: varProrrat,
    toPay,
    ahorro: parseFloat((totalBase - toPay).toFixed(2)),
  }
}

function calcSibling(mayorKey: ModalidadKey, menorKey: ModalidadKey) {
  // 40% dto al de MENOR cuota total. Reserva (60€) no tiene descuento.
  const mayor = MODALIDADES[mayorKey]
  const menor = MODALIDADES[menorKey]

  // Total hermano menor con 40% dto sobre el TOTAL (incluye reserva)
  const menorTotalDto    = parseFloat((menor.totalBase * 0.6).toFixed(2))
  const menorCuotasDto   = parseFloat((menorTotalDto - menor.reserva).toFixed(2))
  const menorCuotaUnit   = parseFloat((menorCuotasDto / menor.cuotas.length).toFixed(2))
  const menorCuotasList  = Array(menor.cuotas.length).fill(menorCuotaUnit)
  const menorPC          = parseFloat((menorTotalDto * 0.95).toFixed(2))

  const mayorCuotasSum   = mayor.cuotas.reduce((a, b) => a + b, 0)

  const famCuotas        = mayor.totalBase + menorTotalDto
  const famPC            = mayor.pcTotal + menorPC
  const separadoCuotas   = mayor.totalBase + menor.totalBase
  const separadoPC       = mayor.pcTotal + menor.pcTotal

  return {
    mayor: { ...mayor, cuotasSum: mayorCuotasSum },
    menor: {
      ...menor,
      cuotasDto: menorCuotasList,
      cuotasDtoSum: menorCuotasDto,
      totalDto: menorTotalDto,
      pcDto: menorPC,
    },
    famCuotas,
    famPC,
    ahorroCuotas: parseFloat((separadoCuotas - famCuotas).toFixed(2)),
    ahorroPC: parseFloat((separadoPC - famPC).toFixed(2)),
  }
}

// ── Componente ───────────────────────────────────────────────────────────────
export function FeeCalculator() {
  const [expanded, setExpanded] = useState(true)
  const [tab, setTab] = useState<'single' | 'sibling' | 'prorata'>('single')

  // Single
  const [singleMod, setSingleMod] = useState<ModalidadKey>('F11')

  // Sibling
  const [mayorMod, setMayorMod] = useState<ModalidadKey>('F11')
  const [menorMod, setMenorMod] = useState<ModalidadKey>('CHU')

  // Prorrateo
  const [prorataMod, setProrataMod]     = useState<ModalidadKey>('F11')
  const [gastosFijos, setGastosFijos]   = useState(120)
  const [mesesTotales, setMesesTotales] = useState(10)
  const [mesIdx, setMesIdx]             = useState(4) // Enero por defecto

  const single  = useMemo(() => calcSingle(singleMod), [singleMod])
  const sibling = useMemo(() => calcSibling(mayorMod, menorMod), [mayorMod, menorMod])
  const prorata = useMemo(
    () => calcProrata(prorataMod, gastosFijos, mesesTotales, MESES_TEMP[mesIdx].restantes),
    [prorataMod, gastosFijos, mesesTotales, mesIdx],
  )

  const tabs = [
    { key: 'single',  icon: User,          label: 'Jugador único'  },
    { key: 'sibling', icon: Users,          label: 'Con hermano/a' },
    { key: 'prorata', icon: CalendarDays,   label: 'A mitad de temporada' },
  ] as const

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <span className="font-semibold">Calculadora de Cuotas 2026/27</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t">
          {/* Tabs */}
          <div className="flex border-b overflow-x-auto">
            {tabs.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                  tab === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* ── TAB: Jugador único ── */}
          {tab === 'single' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <label className="label whitespace-nowrap">Modalidad:</label>
                <select className="input flex-1 max-w-xs" value={singleMod} onChange={e => setSingleMod(e.target.value as ModalidadKey)}>
                  {MODALIDAD_OPTIONS.map(k => <option key={k} value={k}>{MODALIDADES[k].label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Por cuotas */}
                <div className="rounded-xl border bg-muted/10 p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Por cuotas</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reserva (oficina)</span>
                      <span className="font-medium">{formatCurrency(single.reserva)}</span>
                    </div>
                    {single.cuotas.map((c, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-muted-foreground">Cuota {i + 1} (0{9 + i}/sep)</span>
                        <span className="font-medium">{formatCurrency(c)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-2 flex justify-between items-center">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-primary">{formatCurrency(single.total)}</span>
                  </div>
                </div>

                {/* Pago completo */}
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Pago completo</p>
                    <span className="text-xs bg-green-700 text-white rounded-full px-2 py-0.5">−5%</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reserva (oficina)</span>
                      <span className="font-medium">{formatCurrency(single.reserva)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Resto (pago único, −5%)</span>
                      <span className="font-medium text-green-700">{formatCurrency(single.pcTotal - single.reserva)}</span>
                    </div>
                  </div>
                  <div className="border-t border-green-200 pt-2 flex justify-between items-center">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-green-700">{formatCurrency(single.pcTotal)}</span>
                  </div>
                  <p className="text-xs text-green-700">Ahorro: <strong>{formatCurrency(single.ahorro)}</strong></p>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Con hermano/a ── */}
          {tab === 'sibling' && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="label">Hermano/a mayor <span className="text-xs text-muted-foreground">(precio íntegro)</span></label>
                  <select className="input w-full" value={mayorMod} onChange={e => setMayorMod(e.target.value as ModalidadKey)}>
                    {MODALIDAD_OPTIONS.map(k => <option key={k} value={k}>{MODALIDADES[k].label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="label">Hermano/a menor <span className="text-xs text-muted-foreground">(40% dto sobre total)</span></label>
                  <select className="input w-full" value={menorMod} onChange={e => setMenorMod(e.target.value as ModalidadKey)}>
                    {MODALIDAD_OPTIONS.map(k => <option key={k} value={k}>{MODALIDADES[k].label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Mayor */}
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

                {/* Menor */}
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">{sibling.menor.label} — hermano/a</p>
                    <span className="text-xs bg-purple-700 text-white rounded-full px-2 py-0.5">−40%</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Reserva (sin dto)</span><span className="font-medium">{formatCurrency(sibling.menor.reserva)}</span></div>
                    {sibling.menor.cuotasDto.map((c, i) => (
                      <div key={i} className="flex justify-between"><span className="text-muted-foreground">Cuota {i+1} (−40%)</span><span className="font-medium text-purple-700">{formatCurrency(c)}</span></div>
                    ))}
                  </div>
                  <div className="border-t border-purple-200 pt-2 space-y-0.5">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Por cuotas:</span><span className="font-semibold text-purple-700">{formatCurrency(sibling.menor.totalDto)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pago completo:</span><span className="font-semibold text-green-700">{formatCurrency(sibling.menor.pcDto)}</span></div>
                  </div>
                </div>
              </div>

              {/* Total familia */}
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
              <p className="text-xs text-muted-foreground">* El 40% se aplica al jugador/a con cuota total menor. La reserva de 60 € no tiene descuento.</p>
            </div>
          )}

          {/* ── TAB: A mitad de temporada ── */}
          {tab === 'prorata' && (
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Para jugadores que se incorporan ya comenzada la temporada. Los gastos fijos (seguros, federación…) se pagan íntegros siempre; solo se prorratea la parte variable.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="label">Modalidad</label>
                  <select className="input w-full" value={prorataMod} onChange={e => setProrataMod(e.target.value as ModalidadKey)}>
                    {MODALIDAD_OPTIONS.map(k => <option key={k} value={k}>{MODALIDADES[k].label}</option>)}
                  </select>
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
                  <input
                    type="number" step="5" min="0"
                    className="input w-full"
                    value={gastosFijos}
                    onChange={e => setGastosFijos(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Cálculo paso a paso */}
              <div className="rounded-xl border bg-muted/10 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Desglose del cálculo</p>

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cuota anual total ({MODALIDADES[prorataMod].label})</span>
                    <span className="font-medium">{formatCurrency(prorata.totalAnual)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">− Gastos fijos (no prorateables)</span>
                    <span className="font-medium text-amber-700">− {formatCurrency(prorata.gastosFijos)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5">
                    <span className="text-muted-foreground">= Parte variable a prorratear</span>
                    <span className="font-semibold">{formatCurrency(prorata.variableTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      ÷ {mesesTotales} meses × {MESES_TEMP[mesIdx].restantes} restantes
                    </span>
                    <span className="font-medium">{formatCurrency(prorata.variableProrrat)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">+ Gastos fijos</span>
                    <span className="font-medium">{formatCurrency(prorata.gastosFijos)}</span>
                  </div>
                </div>

                <div className="border-t-2 pt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-lg">Total a pagar</span>
                    <p className="text-xs text-muted-foreground">({MESES_TEMP[mesIdx].label}, {MESES_TEMP[mesIdx].restantes} mes{MESES_TEMP[mesIdx].restantes !== 1 ? 'es' : ''})</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-bold text-primary">{formatCurrency(prorata.toPay)}</span>
                    <p className="text-xs text-green-700 mt-0.5">
                      vs. año completo: {formatCurrency(prorata.totalAnual)} — ahorro: <strong>{formatCurrency(prorata.ahorro)}</strong>
                    </p>
                  </div>
                </div>

                {/* Fórmula visual */}
                <div className="bg-white border rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono">
                  ({prorata.totalAnual} − {prorata.gastosFijos}) ÷ {mesesTotales} × {MESES_TEMP[mesIdx].restantes} + {prorata.gastosFijos} = <strong className="text-primary">{prorata.toPay} €</strong>
                </div>
              </div>

              {/* Nota sobre meses totales */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Meses totales de la temporada:</span>
                <input
                  type="number" min="1" max="12"
                  className="input w-16 text-center text-xs py-1"
                  value={mesesTotales}
                  onChange={e => setMesesTotales(Math.max(1, parseInt(e.target.value) || 10))}
                />
                <span>(por defecto 10: septiembre–junio)</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
