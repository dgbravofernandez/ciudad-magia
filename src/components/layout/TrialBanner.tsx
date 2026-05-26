'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { useClub } from '@/context/ClubContext'

export function TrialBanner() {
  const { club } = useClub() as { club: { subscription_status?: string; trial_ends_at?: string } }
  const searchParams = useSearchParams()
  const router = useRouter()

  // Toast de pago exitoso
  useEffect(() => {
    if (searchParams.get('billing') === 'success') {
      toast.success('¡Pago completado! Tu plan ya está activo. 🎉')
      // Limpiar el param de la URL sin recargar
      const params = new URLSearchParams(searchParams.toString())
      params.delete('billing')
      router.replace('/dashboard' + (params.size > 0 ? `?${params}` : ''))
    }
    if (searchParams.get('trial_expired') === '1') {
      toast.warning('Tu período de prueba ha finalizado. Elige un plan para continuar.')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Solo mostrar banner si está en trial activo
  if (club.subscription_status !== 'trial') return null

  const trialEndsAt = club.trial_ends_at ? new Date(club.trial_ends_at) : null
  if (!trialEndsAt) return null

  const now = new Date()
  const daysLeft = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysLeft <= 0) return null // El middleware ya redirige, esto es por si acaso

  const isUrgent = daysLeft <= 3

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2 text-xs font-medium"
      style={{
        background: isUrgent ? '#FEF2F2' : '#EFF6FF',
        borderBottom: `1px solid ${isUrgent ? '#FECACA' : '#BFDBFE'}`,
        color: isUrgent ? '#991B1B' : '#1E40AF',
      }}
    >
      <span className="flex items-center gap-1.5">
        <AlertTriangle size={13} />
        {isUrgent
          ? `⚠️ Tu prueba gratuita expira en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}. Elige un plan para no perder el acceso.`
          : `🕐 Prueba gratuita — ${daysLeft} días restantes`}
      </span>
      <Link
        href="/upgrade"
        className="flex items-center gap-1 font-bold whitespace-nowrap underline-offset-2 hover:underline"
        style={{ color: isUrgent ? '#DC2626' : '#2563EB' }}
      >
        <Zap size={12} />
        {isUrgent ? 'Activar ahora' : 'Ver planes'}
      </Link>
    </div>
  )
}
