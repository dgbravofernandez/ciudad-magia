import { Topbar } from '@/components/layout/Topbar'
import { previewLegacyCuotaReconciliation } from '@/features/contabilidad/actions/reconciliacion.actions'
import { ReconciliacionTable } from '@/features/contabilidad/components/ReconciliacionTable'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Reconciliación de cuotas' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function ReconciliacionPage() {
  const res = await previewLegacyCuotaReconciliation()

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Reconciliación de cuotas (previsualización)" />
      <main className="flex-1 p-4 md:p-6 space-y-4 max-w-7xl mx-auto w-full">
        <p className="text-sm text-muted-foreground">
          Jugadores con el concepto legado <strong>&quot;Cuota mensual&quot;</strong> en la temporada{' '}
          <strong>{res.season ?? '—'}</strong>, comparados con la tarifa correcta de su equipo.
        </p>
        {!res.success ? (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {res.error ?? 'No se pudo cargar la previsualización'}
          </div>
        ) : (
          <ReconciliacionTable rows={res.rows ?? []} season={res.season ?? ''} totals={res.totals ?? { jugadores: 0, emitidoActual: 0, pagadoReal: 0, tarifaCorrecta: 0 }} />
        )}
      </main>
    </div>
  )
}
