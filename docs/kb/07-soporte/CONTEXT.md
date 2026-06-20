# 07 · Soporte (estrategia cero-soporte)

**Propósito:** objetivo #2 — gastar el **mínimo tiempo posible** en soporte técnico. Cada decisión de producto debe restar tickets, no sumarlos.
**Owner:** Diego · **Última actualización:** 2026-06-20

---

## Principio

El mejor ticket es el que no se abre. Orden de prevención:
1. **Que no falle** (objetivo #1, [03-calidad](../03-calidad/CONTEXT.md)).
2. **Que se entienda solo** (UI clara, mensajes de error útiles, onboarding guiado).
3. **Que se resuelva solo** (FAQ/ayuda in-app, self-serve).
4. **Que nos enteremos antes que el cliente** (monitoring).

## Palancas (estado)

| Palanca | Estado | Acción |
|---------|--------|--------|
| **Monitoring de errores** | Sentry instalado (`@sentry/nextjs`) | Verificar que captura en prod, configurar alertas a email, revisar semanalmente |
| **Mensajes de error claros** | Parcial (toasts) | Auditar que ningún error técnico crudo llega al usuario |
| **Estados vacíos guiados** | Débil (dashboard básico) | Convertir pantallas en blanco en guías de "primer paso" |
| **Onboarding self-serve** | Pendiente | Wizard de alta de club (ver [05](../05-pre-saas/CONTEXT.md)) |
| **FAQ / ayuda in-app** | No existe | Empezar por [faq.md](faq.md), luego exponerla en la app |
| **Avisos automáticos** | Crons de deuda/recap existen | Que el club se auto-gestione sin pedirnos cosas |

## Bucle de mejora continua

Cada ticket real de Getafe →
1. Entrada en [bugs-conocidos](../03-calidad/bugs-conocidos.md) (si es bug) o en [faq.md](faq.md) (si es duda).
2. Arreglo de raíz + test de regresión, o texto de ayuda in-app.
3. Objetivo: que ese ticket no se repita nunca.

## Métrica

Tickets / club / mes con tendencia a la baja (ver North Star en [00](../00-vision/CONTEXT.md)). Si sube al meter un cliente nuevo → el onboarding falla, priorizarlo.

## Enlaces

- [faq.md](faq.md) · Calidad: [03](../03-calidad/CONTEXT.md) · Pre-SaaS/onboarding: [05](../05-pre-saas/CONTEXT.md)
