import Link from 'next/link'
import { SearchX, Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <SearchX className="w-8 h-8 text-yellow-600" />
        </div>
        <p className="text-6xl font-bold text-slate-200 mb-4">404</p>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">
          Página no encontrada
        </h1>
        <p className="text-slate-500 text-sm mb-8">
          La página que buscas no existe o ha sido movida.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Home className="w-4 h-4" />
            Ir al Dashboard
          </Link>
          <Link
            href="javascript:history.back()"
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
        </div>
      </div>
    </div>
  )
}
