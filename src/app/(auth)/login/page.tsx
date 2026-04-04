import { LoginForm } from '@/features/auth/components/LoginForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>
}) {
  const params = await searchParams

  return (
    <div className="space-y-6">
      {/* Logo / Branding */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-primary mx-auto flex items-center justify-center">
          <span className="text-white text-2xl font-bold">CM</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Ciudad Magia CRM</h1>
        <p className="text-slate-400 text-sm">Accede a tu panel de gestión</p>
      </div>

      <div className="bg-white rounded-xl shadow-2xl p-8">
        {params.error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
            {params.error === 'unauthorized'
              ? 'No tienes permisos para acceder.'
              : 'Ha ocurrido un error. Inténtalo de nuevo.'}
          </div>
        )}
        <LoginForm redirectTo={params.redirectTo} />
      </div>
    </div>
  )
}
