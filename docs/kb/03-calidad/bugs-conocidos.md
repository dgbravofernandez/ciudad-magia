# Bugs conocidos — registro vivo

**Owner:** Diego · **Última actualización:** 2026-06-20

Registro de bugs detectados pero no cerrados. Se llena con la **Acción 0** (auditoría: `/code-review` + `/security-review` + `revisor-multitenant`) y con lo que reporte Sentry. Cerrar = mover a "Resueltos" con el commit.

> Poblado en la **Acción 0** (2026-06-20). Casi todo el backlog de seguridad histórico resultó **ya arreglado**; quedan 2 hallazgos de seguridad abiertos + 1 sweep pendiente.

## Abiertos

| ID | Severidad | Área | Descripción | Detectado por | Estado |
|----|-----------|------|-------------|---------------|--------|
| INF-2 | — | Informes (cuotas 26/27) | **No es bug.** `getCuotasNextSeason` cuenta por `next_team_id` a propósito: con el selector de temporada en 26/27 deben salir los 648 que tienen equipo en 26/27. Comportamiento correcto. | Auditoría módulo | ✅ descartado |
| INFRA-1 | media | Tests / CI | `tests/unit/accounting-utils.test.ts:7` importa `CLUB_IBAN` que no existe en `@/lib/contabilidad/constants` → `tsc --noEmit` falla. Bloquea el typecheck del CI. | Verificación Acción 0 | ✅ resuelto |
| INFRA-2 | baja | Tooling | `npm run lint` usa `next lint` (deprecado en Next 16) y no hay ESLint configurado → abre prompt interactivo / falla en CI. Migrar a ESLint CLI o quitar del CI. | Verificación Acción 0 | abierto |

**Sweep completo (30 archivos): hecho.** 0 críticos, 0 fugas de lectura, 0 inserts sin `club_id`. Veredicto inicial REVISAR → **6 fugas de escritura corregidas**.

## Resueltos

| ID | Fix (resumen) | Fecha |
|----|---------------|-------|
| SEC-1/2/3 | Ya estaban resueltos (verificado en código) + envs confirmadas en Vercel | 2026-06-20 |
| A-1 | `saveQuotaSettings`: club del contexto + roles | 2026-06-20 |
| A-2 | `saveEvaluation`: contexto + roles + pertenencia de team/coach | 2026-06-20 |
| A-3 | `upsert/deleteSeasonFee`: `.eq('club_id', clubId)` | 2026-06-20 |
| M-1 | `activities.actions.ts`: `club_id` en los 5 sitios | 2026-06-20 |
| M-2 | `save/deleteTemplate`: validación de roles | 2026-06-20 |
| M-3 | asignaciones de staff: roles + pertenencia del member | 2026-06-20 |
| SEC-5 | Cifrado en reposo del token (AES-256-GCM) + revoke en Google | 2026-06-20 |
| SEC-6 | Fallo cerrado sin `APP_SECRET` (3 sitios) | 2026-06-20 |
| INF-1 | Informes cuenta pagos parciales (`amount_paid` de lo no-refunded, no solo `status='paid'`) en `getIncomeByMonth` y `getCuotasNextSeason`. Verificado: 2025-26 ahora €15.458 (antes €6.319) | 2026-06-20 |
| — | `0249ea9` guard `club_id` en deletePayment/updatePayment (previo) | 2026 |

Detalle de seguridad: [docs/kb/04-seguridad/backlog-seguridad.md](../04-seguridad/backlog-seguridad.md). **Build verificado tras los fixes.**

> Detalle y fixes: [docs/kb/04-seguridad/backlog-seguridad.md](../04-seguridad/backlog-seguridad.md).
> **Acción operativa rápida:** verificar en Vercel que `GOOGLE_REDIRECT_URI`, `APP_SECRET` y `CRON_SECRET` están seteadas (cierra SEC-3, mitiga SEC-6).

## Plantilla de entrada

```
| BUG-001 | alta/media/baja | módulo | qué pasa + cómo reproducir | Sentry/auditoría/cliente | abierto |
```

## Resueltos

| ID | Fix (commit) | Fecha |
|----|--------------|-------|
| — | `0249ea9` añadió guard `club_id` en deletePayment/updatePayment (verificar alcance) | 2026 |

## Fuentes de bugs a vigilar

- **Sentry** (`@sentry/nextjs`) — errores no capturados en prod. Configurar alertas → [07-soporte](../07-soporte/CONTEXT.md).
- **Auditorías** periódicas (`/code-review`, `/security-review`).
- **Reportes de cliente** (Getafe) — convertir cada uno en entrada aquí + test de regresión.
