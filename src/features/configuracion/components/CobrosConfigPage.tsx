'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CreditCard, ExternalLink, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import {
  getCobrosConfig,
  startStripeOnboarding,
  setCobrosEnabled,
  getStripeDashboardLink,
  type CobrosConfig,
} from '@/features/configuracion/actions/stripe-connect.actions'

// Texto humano del fee — fuente de verdad: src/lib/stripe-connect.ts.
// Repetido aquí para mostrarlo SIN llamar al server (la página renderiza en SSR
// + hidrata, no queremos pegar otra ida-vuelta solo por el texto).
const FEE_TXT = '0,50 € + 0,5 % por cobro procesado'

export function CobrosConfigPage() {
  const [config, setConfig] = useState<CobrosConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  async function reload() {
    const r = await getCobrosConfig()
    if (r.success && r.config) setConfig(r.config)
    else if (r.error) toast.error(r.error)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const r = await getCobrosConfig()
      if (cancelled) return
      if (r.success && r.config) setConfig(r.config)
      else if (r.error) toast.error(r.error)
      setLoading(false)
      // Detectar vuelta del onboarding de Stripe (?stripe=return) y refrescar
      const params = new URLSearchParams(window.location.search)
      if (params.get('stripe') === 'return' || params.get('stripe') === 'refresh') {
        toast.info('Verificando estado de Stripe…')
        window.history.replaceState({}, '', window.location.pathname)
        // Pequeño delay para dar tiempo a Stripe a procesar
        setTimeout(reload, 1500)
      }
    })()
    return () => { cancelled = true }
  }, [])

  function handleStartOnboarding() {
    startTransition(async () => {
      const r = await startStripeOnboarding()
      if (r.success && r.url) {
        window.location.href = r.url
      } else {
        toast.error(r.error ?? 'No se pudo iniciar el onboarding')
      }
    })
  }

  function handleToggle(next: boolean) {
    startTransition(async () => {
      const r = await setCobrosEnabled(next)
      if (r.success) {
        toast.success(next ? 'Cobros con tarjeta activados' : 'Cobros con tarjeta desactivados')
        await reload()
      } else {
        toast.error(r.error ?? 'Error guardando')
      }
    })
  }

  function handleOpenDashboard() {
    startTransition(async () => {
      const r = await getStripeDashboardLink()
      if (r.success && r.url) window.open(r.url, '_blank')
      else toast.error(r.error ?? 'No se pudo abrir el panel de Stripe')
    })
  }

  if (loading) return <p className="text-sm text-slate-500">Cargando…</p>
  if (!config) return <p className="text-sm text-amber-700">No se pudo cargar la configuración.</p>

  // ── Bloque "qué te llevas Cluberly" (TRANSPARENCIA SIEMPRE VISIBLE) ─────────
  const transparencyBlock = (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-900 space-y-2">
          <p className="font-semibold">Transparencia: cómo se reparte cada cobro</p>
          <p>
            Cluberly aplica una <strong>tasa de procesamiento de pago</strong> de{' '}
            <strong>{FEE_TXT}</strong>. Cubre la infraestructura de pagos, soporte y desarrollo
            continuo de la plataforma.
          </p>
          <p>
            Además, Stripe (el procesador) cobra su tarifa estándar (~1,5 % + 0,25 € por
            cobro con tarjeta EU, ver{' '}
            <a
              href="https://stripe.com/es/pricing"
              target="_blank"
              rel="noreferrer"
              className="underline font-medium"
            >
              precios de Stripe
            </a>
            ).
          </p>
          <p className="text-xs text-amber-800">
            Ejemplo sobre una cuota de 60 €: Cluberly 0,80 € · Stripe ~1,15 € · neto a tu club ≈ 58,05 €.
            <br />
            Verás cada cobro con su desglose en tu panel Stripe.
          </p>
        </div>
      </div>
    </div>
  )

  // ── Renderizado por estado ────────────────────────────────────────────────
  const noAccount = !config.accountId
  const onboardingIncomplete = config.accountId && !config.chargesEnabled
  const ready = config.accountId && config.chargesEnabled
  const restricted = config.status === 'restricted'
  const rejected = config.status === 'rejected'

  return (
    <div className="max-w-3xl space-y-5">
      {/* Cabecera */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-pink-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Cobra cuotas con tarjeta
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Envía links de pago a las familias y olvídate de perseguir transferencias. El
              dinero entra directo a la cuenta bancaria de tu club a través de{' '}
              <a href="https://stripe.com" target="_blank" rel="noreferrer" className="text-pink-700 underline">
                Stripe
              </a>
              . Es opcional: lo activas tú cuando quieras.
            </p>
          </div>
        </div>
      </div>

      {transparencyBlock}

      {/* Estado actual */}
      {noAccount && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-600 mb-4">
            Cuando le des al botón, te llevamos a Stripe para que crees tu cuenta de cobros (5-10 min,
            te piden CIF del club, IBAN y DNI del representante legal). Después podrás emitir links de
            pago a las familias.
          </p>
          <button
            type="button"
            onClick={handleStartOnboarding}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pink-600 text-white font-semibold text-sm hover:bg-pink-700 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Empezar configuración con Stripe
          </button>
        </div>
      )}

      {onboardingIncomplete && !rejected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900 mb-1">Onboarding sin terminar</p>
              <p className="text-sm text-amber-800 mb-3">
                Tu cuenta Stripe está creada pero aún no puede cobrar. Termina el onboarding (KYC +
                cuenta bancaria) para activar.
              </p>
              <button
                type="button"
                onClick={handleStartOnboarding}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Continuar onboarding
              </button>
            </div>
          </div>
        </div>
      )}

      {restricted && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-700 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-orange-900 mb-1">Stripe pide información adicional</p>
              <p className="text-sm text-orange-800 mb-3">
                Para evitar interrupciones en los cobros, entra en tu panel Stripe y completa lo que te pide.
              </p>
              <button
                type="button"
                onClick={handleOpenDashboard}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 disabled:opacity-50"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir mi panel Stripe
              </button>
            </div>
          </div>
        </div>
      )}

      {rejected && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-700 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-900 mb-1">Cuenta rechazada por Stripe</p>
              <p className="text-sm text-red-800">
                Tu cuenta no superó la verificación de Stripe. Contacta con soporte:{' '}
                <a href="mailto:hello@cluberly.club" className="underline font-medium">
                  hello@cluberly.club
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {ready && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-slate-900">Tu cuenta Stripe está lista</p>
              <p className="text-sm text-slate-500">
                Ya puedes activar los cobros con tarjeta. Es opcional: actívalo y desactívalo cuando quieras.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-slate-100">
            <input
              type="checkbox"
              checked={config.enabled}
              disabled={isPending}
              onChange={(e) => handleToggle(e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <span className="text-sm font-medium text-slate-900">
                Cobros con tarjeta {config.enabled ? 'ACTIVADOS' : 'desactivados'}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                {config.enabled
                  ? 'Las familias pueden recibir links de pago por email.'
                  : 'No se podrán crear nuevos links de pago. Los ya enviados siguen funcionando hasta caducar.'}
              </p>
            </div>
          </label>

          <button
            type="button"
            onClick={handleOpenDashboard}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir mi panel Stripe
          </button>
        </div>
      )}

      {/* Términos */}
      <div className="text-xs text-slate-500 px-1">
        Al activar los cobros aceptas los{' '}
        <a href="/legal/cobros" className="underline text-pink-700">
          Términos del servicio de cobros
        </a>{' '}
        y la{' '}
        <a href="/privacy" className="underline text-pink-700">
          política de privacidad
        </a>
        . Stripe gestiona los pagos, KYC y disputas.
      </div>
    </div>
  )
}
