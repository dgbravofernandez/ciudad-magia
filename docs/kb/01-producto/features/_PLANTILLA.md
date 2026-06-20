# Spec — <nombre de la feature>

**Estado:** propuesta | en curso | hecha · **Owner:** · **Fecha:**

## Problema / necesidad
Qué duele hoy y para quién (club, entrenador, padre, admin).

## Objetivo
Resultado medible. Cómo sabremos que funciona.

## No-objetivos
Qué explícitamente NO entra (evita scope creep).

## Flujo de usuario
1. …

## Cambios técnicos
- **Migración:** ¿nueva tabla/columna? (numerar `NNN_*.sql`, aplicar manual en SQL Editor)
- **Server actions:** `src/features/<x>/actions/…` (patrón obligatorio, ver [02](../../02-arquitectura/CONTEXT.md))
- **UI:** `src/features/<x>/components/…`
- **Multi-tenant:** confirmar `club_id` en todo insert/select.

## Criterios de aceptación
- [ ] …
- [ ] `npm run build` y `npm run lint` pasan
- [ ] Flujo probado con evidencia (skill `qa-flujo-critico`)
- [ ] Sin regresión en [flujos críticos](../../03-calidad/flujos-criticos.md)

## Impacto en soporte
¿Genera dudas/tickets? ¿Necesita texto de ayuda in-app o entrada en [FAQ](../../07-soporte/faq.md)?
