# 04 · Seguridad

**Propósito:** mantener el aislamiento multi-tenant y la postura de seguridad. Una fuga = problema GDPR = mata la venta.
**Owner:** Diego · **Última actualización:** 2026-06-20

---

## Modelo de aislamiento (cómo está hoy)

- Multi-tenant por `club_id` en cada tabla de negocio.
- Permisos vía `club_member_roles` + `<RoleGuard>`.
- **RLS parcial** activado (migración `041_rls_policies`) + Storage RLS para logos (`051`).
- **Audit log** por triggers (`040`) — trazabilidad de cambios sensibles.
- Pero gran parte del acceso usa `createAdminClient()` (service role, bypassa RLS) → el aislamiento aún **depende de disciplina del código**. El `as any` masivo elimina el type-safety que detectaría un olvido de `club_id`.

## Defensa en capas (objetivo)

1. **Código:** todo insert/select con `club_id`. Lo vigila el subagente **`revisor-multitenant`** en cada diff.
2. **BD:** completar RLS para que la BD rechace queries sin filtro aunque el código lo olvide (ARCH-2). Camino largo: claims JWT con `app.club_id`.
3. **Monitoring:** Sentry + audit log para detectar accesos anómalos.

## Checklist pre-cliente nuevo

- [ ] Verificado que un club nuevo no ve datos de otro (flujo crítico #2).
- [ ] `CRON_SECRET` y `GOOGLE_REDIRECT_URI` definidos en Vercel (ambos proyectos).
- [ ] RLS revisada en cualquier tabla añadida desde el último cliente.
- [ ] Backup/export disponible (ver [05](../05-pre-saas/CONTEXT.md)).
- [ ] RGPD: acuerdo de encargado de tratamiento firmado (ver `docs/legal/`).

## ⚠️ Importante: verificar antes de actuar

El [backlog](backlog-seguridad.md) viene de un análisis previo (MEMORY.md). Desde entonces hay RLS (`041`), webhook idempotente (`050`) y un commit reciente de guards (`0249ea9`). **Antes de "arreglar" un SEC, comprueba si ya está resuelto** — no rehacer trabajo ni asumir que sigue abierto.

## Enlaces

- [backlog-seguridad.md](backlog-seguridad.md) · Arquitectura: [02](../02-arquitectura/CONTEXT.md) · Legal: `docs/legal/`
