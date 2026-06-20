# Contexto: `supabase/migrations/`

SQL numerado `001..NNN`. **Última real: 052** (no 016 como decía el CLAUDE.md viejo).

## Reglas al crear una migración

1. **Numera con un número claramente nuevo y descriptivo.** Hay colisiones históricas (varios `037_*`, `038_*`, `033_*`) — no añadas más.
2. **Se aplica A MANO en el SQL Editor de Supabase.** No hay pipeline. **Avisa al usuario** de que debe aplicarla; no se aplica sola.
3. Si añades tabla nueva → **define su política RLS** (no la dejes abierta; ver mig. `041`).
4. Tras aplicar, regenerar tipos: `npm run db:types`.
5. Usa la skill **`nueva-migracion`** para el andamiaje + recordatorios.

→ Mapa de dominios y migraciones: [docs/kb/02-arquitectura/data-model.md](../../docs/kb/02-arquitectura/data-model.md)
