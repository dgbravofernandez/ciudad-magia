import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: process.env.NODE_ENV === 'production',

  // 10% de trazas de rendimiento en servidor
  tracesSampleRate: 0.1,

  // Añadir club_id al contexto de cada error para facilitar debugging
  beforeSend(event, hint) {
    // Enriquecer con contexto de club si está disponible
    const err = hint?.originalException
    if (err instanceof Error && 'clubId' in err) {
      event.tags = { ...event.tags, club_id: String((err as any).clubId) }
    }
    return event
  },
})
