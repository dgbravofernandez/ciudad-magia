---
name: release-check
description: Gate previo a deploy de Cluberly. Corre build + lint + tests, smoke de flujos críticos, comprueba migraciones pendientes de aplicar y recuerda no desplegar sin confirmación del usuario. Úsala antes de cualquier deploy o al cerrar una feature.
---

# release-check

Puerta de calidad antes de dar algo por terminado o desplegar. Nada va a producción sin pasar esto.

## Secuencia
1. **Build:** `npm run build` — debe pasar.
2. **Lint:** `npm run lint` — sin errores nuevos.
3. **Tests:** `npm run test` — verdes. (e2e `npm run test:e2e` si se tocaron flujos cubiertos.)
4. **Migraciones:** ¿hay `supabase/migrations/*.sql` nuevas sin aplicar? → recordar al usuario aplicarlas **a mano en el SQL Editor** antes de deploy.
5. **Smoke de flujos críticos:** al menos #1–#5 de `docs/kb/03-calidad/flujos-criticos.md` (login→club, aislamiento, pago, cierre de caja, inscripción), con la skill `qa-flujo-critico`.
6. **Multi-tenant:** confirmar que ningún cambio rompe el aislamiento (subagente `revisor-multitenant` sobre el diff).
7. **Sentry:** revisar que no hay errores nuevos disparándose.

## Salida
- Tabla ✅/❌ de los 7 pasos.
- Lista de migraciones pendientes (si las hay).
- Veredicto: **APTO / NO APTO para deploy**.

## Regla del proyecto
> ❌ **No desplegar sin confirmación del usuario** (Regla 2). Esta skill prepara y recomienda; el deploy lo autoriza Diego.
