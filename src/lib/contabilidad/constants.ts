/** Número máximo de emails enviados por llamada a sendPendingReminders.
 *  15 × 2 s = 30 s — dentro del timeout de Vercel (60 s max).
 *  Exportado desde un módulo neutral (no 'use server') para que la UI pueda importarlo. */
export const EMAIL_BATCH_CAP = 15

/** IBAN del club — fuente única para emails HTML y texto plano. */
export const CLUB_IBAN = 'ES58 3067 0163 1028 0449 8729'
