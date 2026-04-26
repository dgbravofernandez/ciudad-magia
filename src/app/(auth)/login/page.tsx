import Image from 'next/image'
import { LoginForm } from '@/features/auth/components/LoginForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Iniciar sesión — Ciudad Magia' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>
}) {
  const params = await searchParams

  return (
    <div className="space-y-8">
      {/* Branding header */}
      <div className="text-center space-y-3">
        <div className="relative inline-flex items-center justify-center">
          {/* Glow ring detrás del escudo */}
          <div className="absolute inset-0 rounded-full bg-[#F5C400]/30 blur-2xl scale-110" />
          <div className="relative w-28 h-28 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-2 shadow-2xl">
            <Image
              src="/logo-cdg.png"
              alt="E.F. Ciudad de Getafe"
              width={120}
              height={120}
              priority
              className="w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(245,196,0,0.25)]"
            />
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            E.F. <span className="text-[#F5C400]">Ciudad de Getafe</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            Panel de gestión deportiva · Temporada 2025/26
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="relative">
        {/* Yellow accent bar */}
        <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#F5C400] to-transparent" />

        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.7)] border border-white/10 p-8">
          {params.error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>
                {params.error === 'unauthorized'
                  ? 'No tienes permisos para acceder.'
                  : 'Ha ocurrido un error. Inténtalo de nuevo.'}
              </span>
            </div>
          )}
          <LoginForm redirectTo={params.redirectTo} />
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-500 space-y-0.5">
        <p>© {new Date().getFullYear()} E.F. Ciudad de Getafe</p>
        <p className="text-slate-600">Powered by Ciudad Magia CRM</p>
      </div>
    </div>
  )
}
