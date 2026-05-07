import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Solo capturar errores en producción por defecto
  enabled: process.env.NODE_ENV === 'production',

  // Capturar el 100% de errores, 10% de trazas de rendimiento
  tracesSampleRate: 0.1,

  // Reproducción de sesión para debugging: 10% normal, 100% en error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Integración de replay solo en cliente
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,      // Ocultar texto para privacidad (GDPR)
      blockAllMedia: true,    // No capturar imágenes/videos
    }),
  ],

  // No enviar datos sensibles
  beforeSend(event) {
    // Eliminar cookies y headers del scope
    if (event.request) {
      delete event.request.cookies
      delete event.request.headers
    }
    return event
  },
})
