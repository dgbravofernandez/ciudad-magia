'use client'

import { useState, useMemo } from 'react'
import { FileDown } from 'lucide-react'
import type { ReconRow, ReconDiag } from '@/features/contabilidad/actions/reconciliacion.actions'

function fmt(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

const DIAG_LABEL: Record<ReconDiag, string> = {
  al_dia: 'Al día',
  infra: 'Infra-facturado',
  sobre: 'Sobre-facturado',
  sin_tarifa: 'Sin tarifa de equipo',
  revisar: 'Revisar (pagó de más)',
  manual_hno: 'Revisar (3+ hermanos)',
}
const DIAG_CLASS: Record<ReconDiag, string> = {
  al_dia: 'bg-green-100 text-green-700',
  infra: 'bg-red-100 text-red-700',
  sobre: 'bg-amber-100 text-amber-700',
  sin_tarifa: 'bg-gray-200 text-gray-700',
  revisar: 'bg-purple-100 text-purple-700',
  manual_hno: 'bg-purple-100 text-purple-700',
}

type Filter = 'todos' | ReconDiag

export function ReconciliacionTable({
  rows, season, totals,
}: {
  rows: ReconRow[]
  season: string
  totals: { jugadores: number; pagadoReal: number; tarifaCorrecta: number; revisar: number }
}) {
  const [filter, setFilter] = useState<Filter>('todos')

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: rows.length, al_dia: 0, infra: 0, sobre: 0, revisar: 0, manual_hno: 0, sin_tarifa: 0 }
    for (const r of rows) c[r.diagnostico]++
    return c
  }, [rows])

  const filtered = filter === 'todos' ? rows : rows.filter(r => r.diagnostico === filter)

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const data = filtered.map(r => ({
      Jugador: r.nombre,
      Equipo: r.equipo,
      Hermanos: r.hermanos || '',
      'Conceptos actuales': r.conceptosActuales,
      'Emitido actual (€)': r.emitidoActual,
      'Pagado real (€)': r.pagadoReal,
      'Tarifa base (€)': r.tarifaBase,
      'Tarifa correcta (€)': r.tarifaCorrecta,
      'PP 5%': r.ppAplicado ? 'Sí' : '',
      'Pendiente nuevo (€)': r.pendienteNuevo,
      Diagnóstico: DIAG_LABEL[r.diagnostico],
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    if (data.length > 0) ws['!cols'] = Object.keys(data[0]).map(k => ({ wch: Math.max(11, k.length + 2) }))
    XLSX.utils.book_append_sheet(wb, ws, 'Reconciliación')
    XLSX.writeFile(wb, `Reconciliacion_Cuotas_${season}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Solo previsualización.</strong> No se ha modificado ningún dato. La <strong>tarifa correcta</strong> ya
        aplica el descuento de hermanos (40% al más barato) y la columna PP marca a quién se le aplica el 5% por pronto
        pago. Los marcados <strong>&quot;Revisar&quot;</strong> (pagó de más → posible campamento/torneo dentro de la cuota,
        o familias de 3+) se dejarán fuera del proceso automático para tratarlos a mano.
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3"><p className="text-xs text-muted-foreground">Jugadores afectados</p><p className="text-lg font-bold">{totals.jugadores}</p></div>
        <div className="card p-3"><p className="text-xs text-muted-foreground">Pagado real</p><p className="text-lg font-bold text-green-600">{fmt(totals.pagadoReal)}</p></div>
        <div className="card p-3"><p className="text-xs text-muted-foreground">Tarifa correcta (total)</p><p className="text-lg font-bold">{fmt(totals.tarifaCorrecta)}</p></div>
        <div className="card p-3"><p className="text-xs text-muted-foreground">A revisar a mano</p><p className="text-lg font-bold text-purple-700">{totals.revisar}</p></div>
      </div>

      {/* Filtros + export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {(['todos', 'al_dia', 'infra', 'sobre', 'revisar', 'manual_hno', 'sin_tarifa'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${filter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary text-muted-foreground'}`}>
              {f === 'todos' ? 'Todos' : DIAG_LABEL[f as ReconDiag]} ({counts[f]})
            </button>
          ))}
        </div>
        <button onClick={exportExcel} className="btn btn-ghost text-sm flex items-center gap-1.5">
          <FileDown className="w-4 h-4" /> Excel
        </button>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium text-muted-foreground">Jugador</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Equipo</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Conceptos actuales (debido/pagado)</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Pagado</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Tarifa OK</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-center">PP</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Pend. nuevo</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-center">Diagnóstico</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Sin resultados</td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.playerId} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">{r.nombre}{r.hermanos >= 2 && <span className="ml-1 text-[10px] text-blue-600">({r.hermanos} hnos)</span>}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{r.equipo}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{r.conceptosActuales}</td>
                  <td className="px-3 py-2 text-right text-green-600">{fmt(r.pagadoReal)}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmt(r.tarifaCorrecta)}{r.tarifaCorrecta !== r.tarifaBase && <span className="block text-[10px] text-muted-foreground">base {fmt(r.tarifaBase)}</span>}</td>
                  <td className="px-3 py-2 text-center">{r.ppAplicado ? '✓' : ''}</td>
                  <td className={`px-3 py-2 text-right ${r.pendienteNuevo > 0 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>{fmt(r.pendienteNuevo)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`badge text-xs ${DIAG_CLASS[r.diagnostico]}`}>{DIAG_LABEL[r.diagnostico]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
