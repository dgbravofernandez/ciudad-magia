'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Club { id: string; name: string; city: string | null; plan: string }

export default function SelectClubPage() {
  const router = useRouter()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Fetch clubs via API route to use service role
      const res = await fetch('/api/user-clubs')
      if (res.ok) {
        const data = await res.json()
        setClubs(data.clubs ?? [])
      }
      setLoading(false)
    }
    load()
  }, [router])

  function selectClub(clubId: string) {
    document.cookie = `preferred_club_id=${clubId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax; Secure`
    window.location.href = '/dashboard'
  }

  const isCluberlyBrand = process.env.NEXT_PUBLIC_APP_BRAND === 'cluberly'

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center mb-3">
          {isCluberlyBrand ? (
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'linear-gradient(135deg,#EC4899,#BE185D)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: '1.25rem',
            }}>C</div>
          ) : null}
        </div>
        <h1 className="text-2xl font-bold text-white">Selecciona tu club</h1>
        <p className="text-slate-400 text-sm">Tu cuenta está vinculada a varios clubs</p>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center text-slate-400 py-8">Cargando clubs…</div>
        ) : clubs.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            No tienes clubs activos.{' '}
            <a href="/onboarding" className="text-indigo-400 underline">Crear uno</a>
          </div>
        ) : clubs.map(club => (
          <button
            key={club.id}
            onClick={() => selectClub(club.id)}
            className="w-full text-left bg-white/95 rounded-2xl p-5 border border-white/10 shadow hover:shadow-md transition-all hover:-translate-y-0.5 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900 text-base group-hover:text-indigo-600 transition-colors">
                  {club.name}
                </div>
                {club.city && (
                  <div className="text-sm text-gray-500 mt-0.5">{club.city}</div>
                )}
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
