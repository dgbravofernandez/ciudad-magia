'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { KeyRound, Loader2, ShieldAlert, Eye, EyeOff } from 'lucide-react'
import { changeOwnPassword } from '@/features/configuracion/actions/account.actions'

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) {
      toast.error('Las contraseñas nuevas no coinciden')
      return
    }
    if (next.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres')
      return
    }
    startTransition(async () => {
      const res = await changeOwnPassword({ currentPassword: current, newPassword: next })
      if (res.success) {
        toast.success('Contraseña actualizada correctamente')
        // router.replace en lugar de push para que el botón Atrás no vuelva a /cambiar-password.
        // NO llamar router.refresh() aquí — causa una carrera con la navegación:
        // el refresh re-fetcha /cambiar-password antes de que complete el replace a /dashboard.
        router.replace('/dashboard')
      } else {
        toast.error(res.error ?? 'Error al cambiar la contraseña')
      }
    })
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-[#F5C400]/20 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-[#b89400]" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Cambiar contraseña</h1>
      </div>

      {forced ? (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-800 mb-5">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Por seguridad, debes establecer una contraseña personal antes de continuar. La contraseña temporal no volverá a funcionar.</span>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-5">Introduce tu contraseña actual y elige una nueva.</p>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
          <input
            type={show ? 'text' : 'password'}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5C400]"
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5C400] pr-10"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Mínimo 8 caracteres.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Repetir nueva contraseña</label>
          <input
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5C400]"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-[#1a1a1a] hover:bg-black text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          {isPending ? 'Guardando…' : 'Cambiar contraseña'}
        </button>

        {!forced && (
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
          >
            Cancelar
          </button>
        )}
      </form>
    </div>
  )
}
