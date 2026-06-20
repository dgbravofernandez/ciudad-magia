---
name: server-action
description: Genera una server action de Cluberly siguiendo el patrón obligatorio multi-tenant (getClubContext, validación de roles, createAdminClient as any, filtrado por club_id, retorno {success,error}). Úsala al crear cualquier action nueva en src/features/<modulo>/actions/.
---

# server-action

Genera una server action que cumple el patrón **obligatorio** del proyecto. Nunca te desvíes de él: es lo que mantiene el aislamiento multi-tenant.

## Cuándo usar
Al crear o reescribir una función en `src/features/<modulo>/actions/*.ts`.

## Qué preguntar / inferir
1. Módulo y nombre de la action.
2. Tabla(s) afectadas.
3. Operación (insert/update/delete/select).
4. Roles que pueden ejecutarla (de los 8: admin, direccion, director_deportivo, coordinador, entrenador, fisio, infancia, redes).
5. Rutas a revalidar.

## Plantilla a producir

```ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

export async function <nombre>(input: <Tipo>) {
  try {
    const { clubId, memberId, roles } = await getClubContext()
    if (!roles.some(r => [<ROLES>].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data, error } = await sb.from('<tabla>')
      .<op>({ club_id: clubId, /* ...campos */ })
      // en select/update/delete: .eq('club_id', clubId) SIEMPRE
    if (error) return { success: false, error: error.message }
    revalidatePath('<ruta>')
    return { success: true, data }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

## Checklist antes de terminar
- [ ] `club_id` presente en TODO insert y en el filtro de TODO select/update/delete.
- [ ] Validación de roles.
- [ ] Retorno `{ success, error? }`, nunca throw al cliente.
- [ ] `revalidatePath` de las rutas afectadas.
- [ ] Sugerir pasar el subagente `revisor-multitenant` sobre el diff.

Referencia: `docs/kb/02-arquitectura/CONTEXT.md`.
