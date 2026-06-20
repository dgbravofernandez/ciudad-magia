# Contexto: `src/features/` — módulos de negocio

Cada módulo: `<modulo>/actions/` (server actions) + `<modulo>/components/` (UI).

## Antes de escribir una server action

Sigue el **patrón obligatorio** (no te desvíes): `getClubContext()` → validar roles → `createAdminClient() as any` → **filtrar/insertar SIEMPRE con `club_id`** → devolver `{ success, error? }`. Nunca lanzar al cliente.

→ Patrón completo y comandos: [docs/kb/02-arquitectura/CONTEXT.md](../../docs/kb/02-arquitectura/CONTEXT.md)
→ Genera la action sin boilerplate con la skill **`server-action`**.

## El fallo nº1 a evitar

Olvidar `club_id` en un `insert`/`select` = fuga entre clubes (GDPR, mata la venta). Antes de dar por hecho, pasa el subagente **`revisor-multitenant`** sobre tu diff.

## "Hecho" = build + lint + test + evidencia

Ver definición de hecho en [docs/kb/03-calidad/CONTEXT.md](../../docs/kb/03-calidad/CONTEXT.md). No digas "listo" sin probar el flujo.
