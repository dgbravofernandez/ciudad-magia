'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Calendar, Check, AlertCircle, Plug } from 'lucide-react'

interface Props {
  gcalConnected: boolean
  gcalEmail: string | null
  gcalSince: string | null
  banner: string | null
}

const BANNERS: Record<string, { type: 'success' | 'error'; text: string }> = {
  connected: { type: 'success', text: 'Google Calendar conectado correctamente. Las próximas reservas se agendarán automáticamente.' },
  denied: { type: 'error', text: 'Has cancelado la conexión con Google.' },
  invalid_state: { type: 'error', text: 'Sesión OAuth inválida. Vuelve a intentarlo.' },
  no_refresh: { type: 'error', text: 'Google no devolvió refresh_token. Revoca el acceso desde myaccount.google.com y vuelve a conectar.' },
  error: { type: 'error', text: 'Algo falló en la conexión. Intenta de nuevo.' },
  unauthenticated: { type: 'error', text: 'Sesión expirada. Inicia sesión y vuelve a conectar.' },
  forbidden: { type: 'error', text: 'Necesitas ser superadmin para conectar.' },
}

export function IntegrationsView({ gcalConnected, gcalEmail, gcalSince, banner }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleConnect() {
    window.location.href = '/api/platform/calendar/connect'
  }

  function handleDisconnect() {
    if (!confirm('¿Desconectar Google Calendar? Las próximas reservas dejarán de agendarse en tu calendario.')) return
    startTransition(async () => {
      const res = await fetch('/api/platform/calendar/disconnect', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success('Desconectado')
        router.refresh()
      } else {
        toast.error(data.error ?? 'Error')
      }
    })
  }

  const bannerData = banner ? BANNERS[banner] : null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Integraciones</h1>
        <p className="text-sm text-slate-400 mt-1">Conecta servicios externos para automatizar tu flujo comercial.</p>
      </div>

      {bannerData && (
        <div className={`rounded-lg p-4 flex items-start gap-3 ${
          bannerData.type === 'success' ? 'bg-emerald-900/40 border border-emerald-700 text-emerald-200' : 'bg-red-900/40 border border-red-700 text-red-200'
        }`}>
          {bannerData.type === 'success' ? <Check className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
          <p className="text-sm">{bannerData.text}</p>
        </div>
      )}

      {/* Google Calendar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0">
              <Calendar className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Google Calendar</h2>
              <p className="text-sm text-slate-400 mt-1 max-w-md">
                Cuando un club reserve demo, se creará un evento en tu calendario con
                <strong className="text-white"> link de Google Meet automático</strong>, recordatorio 24h antes
                e invitación enviada al cliente. Si cancelas la demo, el evento desaparece.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {gcalConnected ? (
              <>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/40 text-emerald-300 text-xs font-medium">
                  <Check className="w-3 h-3" /> Conectado
                </span>
                {gcalEmail && <span className="text-xs text-slate-500">{gcalEmail}</span>}
                {gcalSince && (
                  <span className="text-xs text-slate-500">Desde {new Date(gcalSince).toLocaleDateString('es-ES')}</span>
                )}
                <button
                  onClick={handleDisconnect}
                  disabled={isPending}
                  className="mt-2 px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs disabled:opacity-50"
                >
                  Desconectar
                </button>
              </>
            ) : (
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-900 hover:bg-slate-100 text-sm font-bold"
              >
                <Plug className="w-4 h-4" />
                Conectar Google Calendar
              </button>
            )}
          </div>
        </div>

        {!gcalConnected && (
          <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 space-y-1">
            <p><strong className="text-slate-300">Qué pasa cuando conectas:</strong></p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Te llevamos a Google para que autorices acceso a tu calendario.</li>
              <li>Cluberly podrá crear eventos en tu calendario principal (no leer otros eventos).</li>
              <li>Puedes desconectar cuando quieras desde aquí mismo.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
