'use client'

import { useState, useMemo } from 'react'
import { Calculator, Users, User, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/currency'

// ── Estructura de cuotas 26/27 ────────────────────────────────────────────────
type ModalidadKey = 'F11' | 'F7' | 'FEM' | 'CHU'

interface ModalidadFee {
  label: string
  reserva: number
  cuotas: number[]          // [C1, C2, C3?]
  pcTotal: number           // pago completo (ya incluye -5%)
  totalBase: number         // total si se paga por cuotas
}

const MODALIDADES: Record<ModalidadKey, ModalidadFee> = {
  F11: { label: 'Fútbol 11', reserva: 60, cuotas: [130, 130, 130], pcTotal: 427.50, totalBase: 450 },
  F7:  { label: 'Fútbol 7 / Benjamín / Prebenjamín', reserva: 60, cuotas: [120, 120, 120], pcTotal: 399.00, totalBase: 420 },
  FEM: { label: 'Femenino', reserva: 60, cuotas: [80, 80, 90], pcTotal: 294.50, totalBase: 310 },
  CHU: { label: 'Chupetes (Debutante)', reserva: 60, cuotas: [75, 75], pcTotal: 199.50, totalBase: 210 },
}

const MODALIDAD_OPTIONS: ModalidadKey[] = ['F11', 'F7', 'FEM', 'CHU']

// ── Cálculos ────────────────────────────────────────────────────────────────
function calcSingle(key: ModalidadKey, gastos: number) {
  const m = MODALIDADES[key]
  const cuotasSum = m.cuotas.reduce((a, b) => a + b, 0)
  return {
    reserva: m.reserva,
    cuotas: m.cuotas,
    cuotasSum,
    porCuotasTotal: m.reserva + cuotasSum + gastos,
    pagoCompletoTotal: m.pcTotal + gastos,
    gastos,
    ahorroPagoCompleto: (m.reserva + cuotasSum + gastos) - (m.pcTotal + gastos),
  }
}

function calcSibling(mayorKey: ModalidadKey, menorKey: ModalidadKey, gastos: number) {
  // El 40% se aplica al TOTAL del menor, reserva incluida (imagen muestra 450*0.6=270 para F11)
  const mayor = MODALIDADES[mayorKey]
  const menor = MODALIDADES[menorKey]

  // Hermano menor con 40% dto
  const menorTotalConDto = menor.totalBase * 0.6         // ej. 210*0.6=126
  const menorReserva     = menor.reserva                  // 60€ (aunque esté en el total)
  const menorCuotasSum   = menorTotalConDto - menorReserva // 126-60=66
  // Repartir entre el número de cuotas del menor
  const menorNumCuotas   = menor.cuotas.length
  const menorCuotaUnit   = parseFloat((menorCuotasSum / menorNumCuotas).toFixed(2))
  const menorCuotas      = Array(menorNumCuotas).fill(menorCuotaUnit)
  const menorPCConDto    = parseFloat((menorTotalConDto * 0.95).toFixed(2))

  // Hermano mayor: precio íntegro
  const mayorCuotasSum   = mayor.cuotas.reduce((a, b) => a + b, 0)
  const mayorCuotasTotal = mayor.reserva + mayorCuotasSum + gastos
  const mayorPCTotal     = mayor.pcTotal + gastos

  // Totales familia
  const famCuotasTotal   = mayorCuotasTotal + (menorReserva + menorCuotasSum + gastos)
  const famPCTotal       = mayorPCTotal + (menorPCConDto + gastos)

  // Ahorro vs pagar separados (sin descuento)
  const separadoCuotas   = calcSingle(mayorKey, gastos).porCuotasTotal + calcSingle(menorKey, gastos).porCuotasTotal
  const separadoPC       = calcSingle(mayorKey, gastos).pagoCompletoTotal + calcSingle(menorKey, gastos).pagoCompletoTotal
  const ahorroCuotas     = separadoCuotas - famCuotasTotal
  const ahorroPC         = separadoPC - famPCTotal

  return {
    mayor: {
      label: mayor.label,
      reserva: mayor.reserva,
      cuotas: mayor.cuotas,
      cuotasSum: mayorCuotasSum,
      porCuotasTotal: mayorCuotasTotal,
      pagoCompletoTotal: mayorPCTotal,
    },
    menor: {
      label: menor.label,
      reserva: menorReserva,
      cuotas: menorCuotas,
      cuotasSum: menorCuotasSum,
      porCuotasTotal: menorReserva + menorCuotasSum + gastos,
      pagoCompletoTotal: menorPCConDto + gastos,
      descuentoPct: 40,
    },
    famCuotasTotal,
    famPCTotal,
    ahorroCuotas,
    ahorroPC,
  }
}

// ── Componente ───────────────────────────────────────────────────────────────
export function FeeCalculator() {
  const [tab, setTab] = useState<'single' | 'sibling'>('single')
  const [expanded, setExpanded] = useState(true)

  // Single
  const [singleMod, setSingleMod] = useState<ModalidadKey>('F11')
  const [gastos, setGastos]       = useState(120)

  // Sibling
  const [mayorMod, setMayorMod] = useState<ModalidadKey>('F11')
  const [menorMod, setMenorMod] = useState<ModalidadKey>('CHU')

  const single  = useMemo(() => calcSingle(singleMod, gastos), [singleMod, gastos])
  const sibling = useMemo(() => calcSibling(mayorMod, menorMod, gastos), [mayorMod, menorMod, gastos])

  return (
    <div className="card overflow-hidden">
      {/* Header colapsable */}
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
          {/* Gastos fijos + tabs */}
          <div className="px-5 pt-4 pb-3 flex flex-wrap items-center gap-4 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Gastos fijos (seguros, federación…):</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="5"
                  min="0"
                  className="input w-24 text-sm text-right"
                  value={gastos}
                  onChange={e => setGastos(parseFloat(e.target.value) || 0)}
                />
                <span className="text-sm text-muted-foreground">€</span>
              </div>
            </div>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm ml-auto">
              <button
                type="button"
                onClick={() => setTab('single')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors',
                  tab === 'single' ? 'bg-primary text-white' : 'hover:bg-muted text-muted-foreground')}
              >
                <User className="w-3.5 h-3.5" /> Jugador único
              </button>
              <button
                type="button"
                onClick={() => setTab('sibling')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors',
                  tab === 'sibling' ? 'bg-primary text-white' : 'hover:bg-muted text-muted-foreground')}
              >
                <Users className="w-3.5 h-3.5" /> Con hermano/a
              </button>
            </div>
          </div>

          {/* TAB: Jugador único */}
          {tab === 'single' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <label className="label whitespace-nowrap">Modalidad:</label>
                <select
                  className="input flex-1 max-w-xs"
                  value={singleMod}
                  onChange={e => setSingleMod(e.target.value as ModalidadKey)}
                >
                  {MODALIDAD_OPTIONS.map(k => (
                    <option key={k} value={k}>{MODALIDADES[k].label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Por cuotas */}
                <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-2">
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
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gastos fijos</span>
                      <span className="font-medium">{formatCurrency(gastos)}</span>
                    </div>
                  </div>
                  <div className="border-t pt-2 flex justify-between items-center">
                    <span className="font-semibold">Total por cuotas</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(single.porCuotasTotal)}</span>
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
                      <span className="text-muted-foreground">Cuotas (pago único, −5%)</span>
                      <span className="font-medium text-green-700">{formatCurrency(MODALIDADES[singleMod].pcTotal - MODALIDADES[singleMod].reserva)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gastos fijos</span>
                      <span className="font-medium">{formatCurrency(gastos)}</span>
                    </div>
                  </div>
                  <div className="border-t border-green-200 pt-2 flex justify-between items-center">
                    <span className="font-semibold">Total pago completo</span>
                    <span className="text-lg font-bold text-green-700">{formatCurrency(single.pagoCompletoTotal)}</span>
                  </div>
                  <p className="text-xs text-green-700">
                    Ahorro vs. cuotas: <strong>{formatCurrency(single.ahorroPagoCompleto)}</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Con hermano/a */}
          {tab === 'sibling' && (
            <div className="p-5 space-y-4">
              {/* Selector hermanos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="label">Hermano/a mayor <span className="text-xs text-muted-foreground">(paga precio íntegro)</span></label>
                  <select
                    className="input w-full"
                    value={mayorMod}
                    onChange={e => setMayorMod(e.target.value as ModalidadKey)}
                  >
                    {MODALIDAD_OPTIONS.map(k => (
                      <option key={k} value={k}>{MODALIDADES[k].label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="label">Hermano/a menor <span className="text-xs text-muted-foreground">(descuento 40%)</span></label>
                  <select
                    className="input w-full"
                    value={menorMod}
                    onChange={e => setMenorMod(e.target.value as ModalidadKey)}
                  >
                    {MODALIDAD_OPTIONS.map(k => (
                      <option key={k} value={k}>{MODALIDADES[k].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nota si mismo tipo */}
              {mayorMod === menorMod && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Misma modalidad — el descuento se aplica al jugador/a registrado después. Puedes elegir quién paga íntegro y quién con descuento.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Hermano mayor */}
                <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {sibling.mayor.label} — precio íntegro
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Reserva</span><span className="font-medium">{formatCurrency(sibling.mayor.reserva)}</span></div>
                    {sibling.mayor.cuotas.map((c, i) => (
                      <div key={i} className="flex justify-between"><span className="text-muted-foreground">Cuota {i + 1}</span><span className="font-medium">{formatCurrency(c)}</span></div>
                    ))}
                    <div className="flex justify-between"><span className="text-muted-foreground">Gastos fijos</span><span className="font-medium">{formatCurrency(gastos)}</span></div>
                  </div>
                  <div className="border-t pt-2 space-y-0.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Por cuotas:</span>
                      <span className="font-semibold">{formatCurrency(sibling.mayor.porCuotasTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pago completo:</span>
                      <span className="font-semibold text-green-700">{formatCurrency(sibling.mayor.pagoCompletoTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Hermano menor */}
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                      {sibling.menor.label} — hermano/a
                    </p>
                    <span className="text-xs bg-purple-700 text-white rounded-full px-2 py-0.5">−40%</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Reserva (sin dto)</span><span className="font-medium">{formatCurrency(sibling.menor.reserva)}</span></div>
                    {sibling.menor.cuotas.map((c, i) => (
                      <div key={i} className="flex justify-between"><span className="text-muted-foreground">Cuota {i + 1} (−40%)</span><span className="font-medium text-purple-700">{formatCurrency(c)}</span></div>
                    ))}
                    <div className="flex justify-between"><span className="text-muted-foreground">Gastos fijos</span><span className="font-medium">{formatCurrency(gastos)}</span></div>
                  </div>
                  <div className="border-t border-purple-200 pt-2 space-y-0.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Por cuotas:</span>
                      <span className="font-semibold text-purple-700">{formatCurrency(sibling.menor.porCuotasTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pago completo:</span>
                      <span className="font-semibold text-green-700">{formatCurrency(sibling.menor.pagoCompletoTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Totales familia */}
              <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Total familia
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Por cuotas</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(sibling.famCuotasTotal)}</p>
                    <p className="text-xs text-green-700 font-medium">
                      Ahorro vs. separados: {formatCurrency(sibling.ahorroCuotas)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pago completo (ambos)</p>
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(sibling.famPCTotal)}</p>
                    <p className="text-xs text-green-700 font-medium">
                      Ahorro vs. separados: {formatCurrency(sibling.ahorroPC)}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                * El 40% se aplica siempre al jugador/a con cuota menor. El primer hermano paga precio íntegro. La reserva de 60 € no tiene descuento y se abona en oficina.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
