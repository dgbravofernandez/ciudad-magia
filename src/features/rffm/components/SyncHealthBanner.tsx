'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  triggerRffmSync,
  enrichSignalsNow,
} from '@/features/rffm/actions/rffm.actions'
import type { RffmHealth } from '@/features/rffm/actions/health.actions'

interface Props {
  health: RffmHealth
  onOpenWizard: () => void
}

const STATUS_COLORS: Record<RffmHealth['status'], { bg: string; border: string; text: string; icon: string; label: string }> = {
  green: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', icon: '✓', label: 'Todo al día' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', icon: '⚠', label: 'Algunas tareas pendientes' },
  red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', icon: '✕', label: 'Atención requerida' },
  empty: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', icon: '○', label: 'Sin configurar' },
}

export function SyncHealthBanner({ health, onOpenWizard }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_COLORS[health.status]

  function syncNow(type: 'full' | 'enrich' | 'standings' | 'actas') {
    startTransition(async () => {
      const toastId = toast.loading('Sincronizando…')
      const r = await triggerRffmSync(type)
      toast.dismiss(toastId)
      if (r.success) {
        toast.success('Sincronizado')
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error')
      }
    })
  }

  function enrichBatch() {
    startTransition(async () => {
      const toastId = toast.loading('Enriqueciendo perfiles…')
      const r = await enrichSignalsNow(50)
      toast.dismiss(toastId)
      if (r.success && r.result) {
        toast.success(`Enriquecidos ${r.result.enriched}/${r.result.attempted} · Quedan ${r.result.pending}`)
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error')
      }
    })
  }

  // Estado vacío: solo mostrar CTA al wizard
  if (health.status === 'empty') {
    return (
      <div className={`mb-4 rounded-lg border ${cfg.border} ${cfg.bg} p-4 flex items-center justify-between gap-3 flex-wrap`}>
        <div>
          <p className={`font-medium ${cfg.text}`}>{cfg.icon} {cfg.label}</p>
          <p className={`text-sm ${cfg.text} opacity-80`}>{health.summary}</p>
        </div>
        <button
          onClick={onOpenWizard}
          className="px-4 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium"
        >
          ⚡ Empezar configuración
        </button>
      </div>
    )
  }

  return (
    <div className={`mb-4 rounded-lg border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      {/* Cabecera siempre visible */}
      <div className="p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${cfg.text}`}>
            <span className="mr-1">{cfg.icon}</span>
            {cfg.label}
          </p>
          <p className={`text-xs ${cfg.text} opacity-80 truncate`} title={health.summary}>
            {health.summary}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {health.status === 'green' ? (
            <button
              onClick={() => syncNow('full')}
              disabled={isPending}
              className="px-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50"
            >
              {isPending ? 'Sincronizando…' : 'Actualizar'}
            </button>
          ) : (
            <button
              onClick={() => setExpanded(v => !v)}
              className={`px-3 py-1.5 text-xs rounded-md border bg-white hover:bg-slate-50 ${cfg.text}`}
            >
              {expanded ? 'Ocultar detalle' : 'Ver detalle'}
            </button>
          )}
        </div>
      </div>

      {/* Detalle expandible (solo cuando no es green) */}
      {expanded && (
        <div className={`border-t ${cfg.border} p-3 space-y-2 bg-white/60 text-xs`}>
          {health.trackedMissingTeamCode > 0 && (
            <DetailItem
              icon="⚠"
              text={`${health.trackedMissingTeamCode} competiciones sin código de equipo configurado`}
              cta="Reconfigurar desde RFFM"
              onCta={onOpenWizard}
              ctaDisabled={isPending}
              hint="El wizard volverá a detectar y rellenará los códigos faltantes."
            />
          )}
          {health.trackedNeverSynced > 0 && (
            <DetailItem
              icon="🕓"
              text={`${health.trackedNeverSynced} competiciones sin sincronizar hace más de 7 días`}
              cta="Actualizar partidos ahora"
              onCta={() => syncNow('full')}
              ctaDisabled={isPending}
            />
          )}
          {health.actasPending > 30 && (
            <DetailItem
              icon="📋"
              text={`${health.actasPending} actas pendientes de procesar`}
              cta="Sincronizar actas"
              onCta={() => syncNow('actas')}
              ctaDisabled={isPending}
              hint="El cron diario (01:00) las procesa, pero puedes acelerar."
            />
          )}
          {health.enrichPending > 200 && (
            <DetailItem
              icon="👤"
              text={`${health.enrichPending} perfiles sin año de nacimiento`}
              cta="Enriquecer 50 ahora"
              onCta={enrichBatch}
              ctaDisabled={isPending}
              hint="El cron 3×día completa el resto en ~2-3 días."
            />
          )}
          {health.enrichExhausted > 0 && (
            <DetailItem
              icon="❌"
              text={`${health.enrichExhausted} perfiles fallaron tras 3 intentos`}
              hint="No se reintentan automáticamente. Contacta soporte si crees que es un bug."
            />
          )}
          {health.hasZombies && (
            <DetailItem
              icon="🧟"
              text="Hay sincronizaciones colgadas (timeout). Se limpiarán al iniciar la próxima."
              hint="No requiere acción."
            />
          )}
          {(health.lastFullSyncStatus === 'error' || health.lastFullSyncStatus === 'timeout') && (
            <DetailItem
              icon="✕"
              text={`Último sync falló: ${health.lastFullSyncStatus}`}
              cta="Reintentar"
              onCta={() => syncNow('full')}
              ctaDisabled={isPending}
              hint={health.lastFullSyncErrorDetail ?? undefined}
            />
          )}
        </div>
      )}
    </div>
  )
}

function DetailItem({
  icon, text, cta, onCta, ctaDisabled, hint,
}: {
  icon: string
  text: string
  cta?: string
  onCta?: () => void
  ctaDisabled?: boolean
  hint?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <p className="text-slate-800">
          <span className="mr-1.5">{icon}</span>{text}
        </p>
        {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
      </div>
      {cta && onCta && (
        <button
          onClick={onCta}
          disabled={ctaDisabled}
          className="px-2.5 py-1 text-[11px] rounded-md bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 whitespace-nowrap"
        >
          {cta}
        </button>
      )}
    </div>
  )
}
