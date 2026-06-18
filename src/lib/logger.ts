/**
 * Logger estructurado — compatible con Node.js y Edge Runtime.
 *
 * Emite JSON estructurado en producción y pretty-print en desarrollo.
 * Siempre incluye timestamp, nivel, club_id, member_id y action.
 *
 * Uso:
 *   import { logger } from '@/lib/logger'
 *
 *   logger.info({ action: 'registerPayment', clubId, memberId, amount: 50 })
 *   logger.warn({ action: 'sendBulkEmail', clubId, reason: 'template missing' })
 *   logger.error({ action: 'activateSeason', clubId, error: err.message })
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  action: string
  clubId?: string
  memberId?: string
  [key: string]: unknown
}

const isDev = process.env.NODE_ENV !== 'production'

/** Colores ANSI para desarrollo (solo terminales que los soporten) */
const COLOR: Record<LogLevel, string> = {
  debug: '\x1b[90m',  // grey
  info:  '\x1b[36m',  // cyan
  warn:  '\x1b[33m',  // yellow
  error: '\x1b[31m',  // red
}
const RESET = '\x1b[0m'

function emit(level: LogLevel, ctx: LogContext): void {
  const ts = new Date().toISOString()

  if (isDev) {
    const color = COLOR[level]
    const prefix = `${color}[${level.toUpperCase()}]${RESET} ${ts}`
    const { action, clubId, memberId, ...rest } = ctx
    const parts = [
      `action=${action}`,
      clubId   ? `club=${clubId.slice(0, 8)}…`   : null,
      memberId ? `member=${memberId.slice(0, 8)}…` : null,
      Object.keys(rest).length ? JSON.stringify(rest) : null,
    ].filter(Boolean).join(' ')
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'debug' : level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error'](
      `${prefix} ${parts}`
    )
  } else {
    // Producción: JSON en una línea (compatible con Vercel Log Drains / Datadog)
    const record: Record<string, unknown> = {
      ts,
      level,
      ...ctx,
    }
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'debug' : level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error'](
      JSON.stringify(record)
    )
  }
}

/**
 * OBS-1: en producción `logger.error()` también captura el evento en Sentry.
 * Dynamic import + fire-and-forget — no bloquea ni cambia la signature sync del logger.
 * Si Sentry no está disponible (edge runtime sin DSN, dev, etc.) falla silencioso.
 */
function reportToSentry(ctx: LogContext): void {
  if (isDev) return
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  import('@sentry/nextjs').then(Sentry => {
    const err = ctx.error instanceof Error
      ? ctx.error
      : new Error(String(ctx.error ?? ctx.action))
    Sentry.captureException(err, {
      tags: {
        action: ctx.action,
        club_id: ctx.clubId,
        member_id: ctx.memberId,
      },
      extra: ctx,
    })
  }).catch(() => {
    // Silent — si Sentry falla no rompemos la app
  })
}

export const logger = {
  debug: (ctx: LogContext) => emit('debug', ctx),
  info:  (ctx: LogContext) => emit('info',  ctx),
  warn:  (ctx: LogContext) => emit('warn',  ctx),
  error: (ctx: LogContext) => {
    emit('error', ctx)
    reportToSentry(ctx)
  },
}
