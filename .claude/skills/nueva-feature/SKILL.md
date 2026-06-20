---
name: nueva-feature
description: Andamia un módulo de feature nuevo en src/features/<modulo>/ (carpetas actions/ y components/) siguiendo los patrones de Cluberly, y crea la spec en docs/kb/01-producto/features/. Úsala al empezar una feature nueva.
---

# nueva-feature

Crea el esqueleto de un módulo de feature respetando la estructura y patrones del proyecto.

## Pasos
1. **Escribir la spec primero**: copia `docs/kb/01-producto/features/_PLANTILLA.md` a `docs/kb/01-producto/features/<modulo>.md` y rellénala (problema, objetivo, no-objetivos, flujo, criterios de aceptación). No escribas código sin spec mínima.
2. **Crear estructura**:
   ```
   src/features/<modulo>/
   ├── actions/index.ts        # server actions (usa la skill `server-action`)
   ├── components/             # UI del módulo
   └── hooks/                  # si aplica
   ```
3. **Página** (si lleva ruta): `src/app/(app)/<modulo>/page.tsx` con `export const dynamic = 'force-dynamic'` y datos vía `createAdminClient()` filtrados por `clubId` de `getClubContext()`.
4. **Migración** (si lleva tablas): usar la skill `nueva-migracion`. Toda tabla con `club_id` + política RLS.
5. **Permisos**: envolver UI sensible en `<RoleGuard roles={[...]}>`.

## Reglas
- Multi-tenant: `club_id` en todo (ver `docs/kb/02-arquitectura/CONTEXT.md`).
- Mutaciones cliente: `useTransition` + toast + `router.refresh()`.
- Actualizar `docs/kb/01-producto/CONTEXT.md` (tabla de módulos) y el roadmap.

## Al terminar
- `npm run build` + `npm run lint` pasan.
- Probar con la skill `qa-flujo-critico`.
- Añadir el flujo a `docs/kb/03-calidad/flujos-criticos.md` si es crítico.
