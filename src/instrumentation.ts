/**
 * Next.js instrumentation — punto de entrada que inicializa Sentry en servidor y edge.
 * Con @sentry/nextjs v10 los archivos sentry.server.config / sentry.edge.config NO se
 * cargan automáticamente: hay que importarlos desde register().
 * Además onRequestError captura errores de Server Actions y React Server Components.
 *
 * Sentry solo hace algo si NEXT_PUBLIC_SENTRY_DSN está definido (ver sentry.*.config.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export async function onRequestError(...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>) {
  const Sentry = await import('@sentry/nextjs')
  return Sentry.captureRequestError(...args)
}
