/** Número máximo de emails enviados por llamada a sendPendingReminders.
 *  15 × 2 s = 30 s — dentro del timeout de Vercel (60 s max).
 *  Exportado desde un módulo neutral (no 'use server') para que la UI pueda importarlo. */
export const EMAIL_BATCH_CAP = 15

/** IBAN del club — fuente única para emails HTML y texto plano. */
export const CLUB_IBAN = 'ES58 3067 0163 1028 0449 8729'

/** Mapeo de etiquetas de UI al valor enum que guarda la BD.
 *  Acepta tanto labels en español ('efectivo') como valores ya normalizados ('cash'). */
export const METHOD_MAP: Record<string, string> = {
  efectivo: 'cash',
  tarjeta: 'card',
  transferencia: 'transfer',
  // pass-through para valores ya normalizados
  cash: 'cash',
  card: 'card',
  transfer: 'transfer',
}

/** Convierte la etiqueta del formulario al valor enum de BD ('cash' | 'card' | 'transfer').
 *  Si el método no está en el mapa lo devuelve sin cambios (safe fallback). */
export function toDbMethod(method: string): string {
  return METHOD_MAP[method] ?? method
}
