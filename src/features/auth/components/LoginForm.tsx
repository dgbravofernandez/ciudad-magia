'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    router.push(redirectTo ?? '/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide" htmlFor="email">
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            id="email"
            type="email"
            placeholder="entrenador@ciudaddegetafe.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F5C400]/40 focus:border-[#F5C400] transition-colors"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide" htmlFor="password">
          Contraseña
        </label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F5C400]/40 focus:border-[#F5C400] transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="group relative w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-black bg-[#F5C400] hover:bg-[#FFD500] active:bg-[#E0B200] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[#F5C400]/20 hover:shadow-[#F5C400]/40 transition-all"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Accediendo…</>
          : <>Acceder <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
        }
      </button>

      <p className="text-xs text-center text-slate-500 pt-1">
        ¿Problemas para entrar? Contacta con el administrador del club.
      </p>
    </form>
  )
}
