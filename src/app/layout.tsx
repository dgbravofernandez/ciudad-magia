import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { MetaPixel } from '@/components/analytics/MetaPixel'
import { CookieBanner } from '@/components/analytics/CookieBanner'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://cluberly.club'),
  title: {
    default: 'Cluberly',
    template: '%s | Cluberly',
  },
  description: 'El software de gestión para clubes de fútbol base. Cuotas, inscripciones, asistencia y comunicaciones en un sitio.',
  openGraph: {
    title: 'Cluberly',
    description: 'Software de gestión para clubes de fútbol base. Prueba 14 días gratis.',
    url: 'https://cluberly.club',
    siteName: 'Cluberly',
    locale: 'es_ES',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <MetaPixel />
        {children}
        <CookieBanner />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
