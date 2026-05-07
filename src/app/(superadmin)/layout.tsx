import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Shield, LayoutGrid, LogOut, Zap } from 'lucide-react'
import { stopImpersonation } from '@/features/superadmin/actions/superadmin.actions'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Superadmin — Ciudad Magia',
}

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const platformRole = headersList.get('x-platform-role')
  const userEmail = headersList.get('x-user-email') ?? ''

  if (platformRole !== 'superadmin') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top navbar */}
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-black" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Ciudad Magia</p>
            <p className="text-xs text-yellow-400 leading-none">Superadmin</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 ml-6">
          <Link
            href="/superadmin"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Clubs
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-400">{userEmail}</span>
          <form action={stopImpersonation}>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Salir
            </button>
          </form>
        </div>
      </header>

      {/* Warning banner cuando hay impersonación activa */}
      <ImpersonationBanner />

      {/* Contenido */}
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  )
}

async function ImpersonationBanner() {
  // Este banner se muestra en la app normal, no en /superadmin
  return null
}
