# Roadmap — Now / Next / Later

**Owner:** Diego · **Última actualización:** 2026-06-20
**Regla:** prioridad = infalibilidad y cero-soporte por encima de features. Mantener esta lista corta y viva.

> Se regenera/actualiza con la skill `release-check` y el agente programado semanal (ver [05-automatizaciones en KB raíz]).

---

## 🔴 NOW (estabilidad y venta-readiness)

- **Auditoría inicial** (`/security-review` + `/code-review` + `revisor-multitenant`) sobre el código en producción → volcar a [bugs-conocidos](../03-calidad/bugs-conocidos.md) y [backlog-seguridad](../04-seguridad/backlog-seguridad.md).
- **Verificar fixes de seguridad** ya iniciados (commit `0249ea9` añadió guard de `club_id` en pagos). Confirmar que SEC-1..SEC-5 están cerrados o abiertos de verdad — no asumir.
- **Cobertura de tests de flujos críticos** (hoy solo ~10 unit de utils). Ver [flujos-criticos](../03-calidad/flujos-criticos.md).
- **Actualizar `CLAUDE.md` raíz** (estado decía migración 016, real 052).

## 🟡 NEXT (reducir soporte / conversión)

- Dashboard con valor real en el primer login (impacta conversión y retención).
- Onboarding self-serve guiado para club nuevo (reduce soporte — ver [05-pre-saas](../05-pre-saas/CONTEXT.md)).
- Pestaña "Rendimiento" en ficha de jugador (% asistencia + minutos reales por temporada).
- Decidir destino de `/personal/*` (completar u ocultar).

## 🟢 LATER (escala / deferred)

- Des-hardcoding completo de residuos (emails, Drive IDs, Forms) — pre-venta.
- Notificaciones, backup a Sheets maestro, PWA/mobile, calendario mensual.
- RLS endurecida con claims JWT (hoy multi-tenant depende de disciplina + RLS parcial 041).

---

## Backlog técnico-arquitectónico (de MEMORY.md, migrado aquí)

- **ARCH-1** Sin capa de dominio — lógica en actions. Extraer `lib/domain/*.service.ts`.
- **ARCH-2** RLS parcial — migrar actions sensibles a anon+RLS con `app.club_id`.
- **ARCH-3** Activación de temporada no transaccional → función SQL `activate_next_season`.
- **ARCH-4** Cron sin idempotencia → tabla `cron_locks` (parcialmente cubierto por 050 en Stripe).

> Detalle completo de cada ítem: ver historial de `MEMORY.md` y [04-seguridad](../04-seguridad/CONTEXT.md).
