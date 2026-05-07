'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AppError]', error)
  }, [error])

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Error al cargar esta sección
        </h2>
        <p className="text-slate-500 text-sm mb-6">
          Ha ocurrido un error inesperado. Puedes intentarlo de nuevo o volver al inicio.
          {error.digest && (
            <span className="block mt-1 font-mono text-xs text-slate-400">
              Ref: {error.digest}
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
            Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
