export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function getMonthName(month: number): string {
  return new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(
    new Date(2024, month - 1, 1)
  )
}

export function getCurrentSeason(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  // Season starts in September
  if (month >= 9) {
    return `${year}-${String(year + 1).slice(2)}`
  }
  return `${year - 1}-${String(year).slice(2)}`
}

/**
 * Devuelve la temporada siguiente en formato 'YYYY-YY'.
 * Ej: '2025-26' → '2026-27'
 */
export function getNextSeason(current?: string): string {
  const cur = current ?? getCurrentSeason()
  const m = cur.match(/^(\d{4})-(\d{2})$/)
  if (!m) return cur
  const start = parseInt(m[1], 10) + 1
  return `${start}-${String(start + 1).slice(2)}`
}

/** Devuelve [actual, siguiente] para selectores de doble temporada. */
export function getActiveSeasons(): string[] {
  const cur = getCurrentSeason()
  return [cur, getNextSeason(cur)]
}
