'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // App Router NO captura solo: hay que reportar el error del boundary a mano.
    Sentry.captureException(error)
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            Algo ha ido mal
          </h1>
          <p className="text-slate-500 text-sm mb-6">
            Ha ocurrido un error inesperado. El equipo técnico ha sido notificado.
            {error.digest && (
              <span className="block mt-1 font-mono text-xs text-slate-400">
                Referencia: {error.digest}
              </span>
            )}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Home className="w-4 h-4" />
              Ir al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
