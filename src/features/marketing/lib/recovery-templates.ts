// Plantillas de recuperación disponibles para envío manual desde el panel CRM.
// Whitelist: el comercial solo puede disparar estas keys.
export const RECOVERY_TEMPLATES = ['recover_click', 'recover_reservar', 'recover_hot'] as const
export type RecoveryTemplateKey = typeof RECOVERY_TEMPLATES[number]
