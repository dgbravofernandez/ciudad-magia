# 03 · Calidad

**Propósito:** cómo mantenemos la app **infalible** (objetivo #1). Estrategia de testing y definición de "hecho".
**Owner:** Diego · **Última actualización:** 2026-06-20

---

## Estado real del testing

- **Unit (vitest):** ~10 tests, solo de utilidades puras (`tests/unit/`: season, accounting, currency, hmac, apply-payment, standings…).
- **E2E (Playwright):** 1 smoke (`tests/e2e/smoke.spec.ts`).
- **Cobertura de server actions, multi-tenant y flujos de negocio: prácticamente 0.**

→ El mayor riesgo de "infalibilidad" no es falta de infra (existe), es **falta de cobertura en los flujos que mueven dinero y datos de menores**.

## Definición de "HECHO" (regla obligatoria del proyecto)

Un cambio NO está hecho hasta que:
1. `npm run build` pasa.
2. `npm run lint` sin errores nuevos.
3. `npm run test` (si tocó lógica con tests) pasa.
4. El flujo afectado se **probó end-to-end con evidencia** (skill `qa-flujo-critico` → screenshot/logs). Nunca decir "listo" sin evidencia (Regla 1 del proyecto).
5. Sin regresión en [flujos críticos](flujos-criticos.md).

## Estrategia (orden de inversión)

1. **Blindar [flujos críticos](flujos-criticos.md)** con e2e Playwright — son los que un bug convierte en ticket de soporte o pérdida de confianza del cliente.
2. **Tests unit de las server actions de dinero** (pagos parciales, cierre de caja, verificación de movimientos) — lógica + presencia de `club_id`.
3. **Smoke multi-tenant**: un segundo club no ve datos del primero. Lo automatiza el espíritu del subagente `revisor-multitenant`.
4. Gate de release (`release-check` skill) antes de cada deploy.

## Herramientas a usar

- Skills: `qa-flujo-critico`, `release-check` (propias) · `senior-qa`, `webapp-testing` (existentes).
- Subagente `qa-getafe` para regresión a demanda.
- `/code-review` antes de mergear.

## Enlaces

- [flujos-criticos.md](flujos-criticos.md) · [bugs-conocidos.md](bugs-conocidos.md) · Seguridad: [04](../04-seguridad/CONTEXT.md)
