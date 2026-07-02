# Plan — Alta pública de entrenadores + acceso solo lectura

## Contexto

Cluberly (Ciudad Magia) es un CRM multi-tenant para clubes de fútbol, en producción con
E.F. Ciudad de Getafe. Hoy los entrenadores no tienen usuario propio: los da de alta
Diego a mano vía `/configuracion/roles` y la mayoría no accede nunca a la app. Los
certificados legalmente obligatorios en España (**LO 8/2021, art. 57.1**: certificado
negativo de delitos sexuales para trabajar con menores) se gestionan por WhatsApp.

Este plan cierra ese hueco con un **formulario público de alta**, aprobación manual
del club, y una vista **solo lectura** para que el entrenador vea a sus jugadores.
Multi-club (Diego puede tener entrenadores compartidos con otros clubes) y
multi-equipo (un entrenador puede llevar varios equipos) están contemplados.

Reemplaza el patrón "alta manual + WhatsApp para docs" por: link único público del
club → familia rellena datos + sube docs → Diego aprueba con un click → entrenador
accede a la app en modo lectura → cron le avisa cuando el certificado va a caducar.

Divisiones en **4 días** (D3-D6 del plan de 15 días acordado). Cada día es una
entrega verificable en producción.

---

## Decisiones ya tomadas (respuestas de Diego)

1. **URL pública única por club** (patrón `/inscripcion/[slug]`, no tokens individuales).
2. **Aprobación manual** con asignación de equipo(s) por Diego, no auto.
3. **Roles independientes y multifunción:** un mismo miembro puede tener CUALQUIER
   combinación de los 8 roles en un mismo club (admin + coordinador + entrenador +
   director_deportivo simultáneamente si hace falta) y puede llevar varios equipos.
4. **Aviso a 11 meses** de la subida del certificado de delitos sexuales.
5. Multi-club: mismo email puede tener roles distintos en clubes distintos.

---

## Hallazgos del código actual (a tener en cuenta)

- Tabla `club_member_roles` (`supabase/migrations/001_initial_schema.sql:68-78`) con
  constraint `UNIQUE(member_id, role)` — **impide** que un miembro tenga el mismo rol
  (p.ej. `entrenador`) en dos equipos distintos. La migración D3 relaja esto.
- `createMember()` (`src/features/configuracion/actions/members.actions.ts:41-121`)
  llama `sb.auth.admin.createUser` y **falla** si el email ya existe en `auth.users`.
  Para multi-club hay que buscar en `sb.auth.admin.listUsers`, reutilizar el
  `user_id` existente y solo crear la fila `club_members` + roles.
- Sidebar (`src/components/layout/Sidebar.tsx:46-49`) hoy define
  `ENTRENADORES_ROLES = ['admin', 'direccion', 'director_deportivo']` — un
  `entrenador` puro no ve NADA. Hay que ampliar los sets para que vea jugadores +
  entrenadores en modo lectura.
- Middleware (`middleware.ts:21`) tiene array `PUBLIC_PREFIX` — añadir la nueva
  ruta pública ahí.
- Slug de club: campo `clubs.slug` ya existe (`001_initial_schema.sql:16`), único.
- `must_change_password` (`club_members.must_change_password`, migración 036) es
  consumido por `src/app/(app)/layout.tsx:67-69` que redirige a `/cambiar-password`.
- Storage bucket `player-docs` (migración 063) ya existe para docs de jugadores;
  seguiremos el mismo patrón para `trainer-docs`.

Ya existen patrones reutilizables:
- **Token público stateless**: `src/lib/utils/renewal-token.ts` (HMAC + namespace).
- **Signed upload URLs**: `getPlayerDocUploadTicket()` en
  `src/features/jugadores/actions/player-docs.actions.ts:80-100`.
- **Anti-spam público**: `submitInscription()` en
  `src/features/jugadores/actions/inscription.actions.ts` (honeypot + rate limit).
- **Ficha pública con branding**: `src/app/inscripcion/[slug]/page.tsx`.
- **RoleGuard**: `src/components/shared/RoleGuard.tsx`.

---

## Arquitectura resumida

```
FAMILIA (público)                    ADMIN (dashboard)                ENTRENADOR
──────────────────                   ──────────────────               ──────────
/entrenador-alta/[slug]              /entrenadores/pendientes         /jugadores
  formulario + docs                    tabla + botón Aprobar            (solo su equipo,
      │                                     │                            solo lectura)
      ▼                                     ▼
club_members                          approveTrainer()
  pending_approval=true                  1. reusa/crea auth user
  doc_reciclaje_url                      2. inserta club_member_roles
  doc_delitos_sexuales_url                  (uno por rol, uno por equipo)
                                         3. email de bienvenida
                                         4. must_change_password=true
```

---

## D3 — Migración + formulario público (sin aprobación)

**Objetivo:** cualquiera puede rellenar el formulario. Los datos aparecen en BD como
"pendientes" pero aún no hay panel para aprobarlos.

### Migración `068_trainer_signup.sql`

```sql
-- 1. Relajar constraint para permitir mismo rol en varios equipos.
ALTER TABLE club_member_roles DROP CONSTRAINT club_member_roles_member_role_key;
ALTER TABLE club_member_roles
  ADD CONSTRAINT club_member_roles_member_role_team_key
  UNIQUE (member_id, role, team_id) NULLS NOT DISTINCT;
-- NULLS NOT DISTINCT: (X, 'coordinador', NULL) sigue siendo único, no se puede duplicar.

-- 2. Añadir columnas a club_members para docs + workflow de aprobación.
ALTER TABLE club_members
  ADD COLUMN pending_approval BOOLEAN DEFAULT FALSE,
  ADD COLUMN doc_reciclaje_url TEXT,
  ADD COLUMN doc_delitos_sexuales_url TEXT,
  ADD COLUMN delitos_sexuales_uploaded_at TIMESTAMPTZ,
  ADD COLUMN delitos_reminder_sent_at TIMESTAMPTZ;

-- 3. Flag opcional en club_settings para cerrar el formulario si el club quiere.
ALTER TABLE club_settings
  ADD COLUMN trainer_signup_open BOOLEAN DEFAULT TRUE;

-- 4. Storage bucket privado para docs de entrenadores (creado desde Supabase Dashboard,
--    la migración no puede crear buckets — anota para hacer manual).
```

Aplicar manualmente en SQL Editor + crear bucket `trainer-docs` (private) en Storage.

### Código nuevo

- `src/features/entrenadores/actions/trainer-signup.actions.ts` — server actions:
  - `getTrainerSignupInfo(slug)`: resuelve slug → devuelve `{clubName, clubLogo, brand, open}`.
  - `getTrainerDocUploadTicket(slug, docType, ext)`: signed upload URL a `trainer-docs`.
    `docType` ∈ `{'photo', 'dni_front', 'reciclaje', 'delitos_sexuales'}`. Reusar
    el patrón de `getPlayerDocUploadTicket()`.
  - `submitTrainerSignup(slug, input)`: valida (email, RGPD, honeypot, rate limit
    reusando el patrón de `submitInscription`), inserta `club_members` con
    `active=false, pending_approval=true, user_id=NULL`, firma URLs de docs
    (TTL 10 años) y las guarda en las columnas nuevas. Marca
    `delitos_sexuales_uploaded_at = NOW()`.

- `src/app/entrenador-alta/[slug]/page.tsx` — página pública corporativa (logo +
  primary_color, patrón de `/inscripcion/[slug]`).
- `src/app/entrenador-alta/[slug]/TrainerSignupForm.tsx` — cliente:
  formulario con foto, DNI, certificado reciclaje, certificado delitos sexuales +
  bloque RGPD obligatorio.
- Añadir `/entrenador-alta` a `PUBLIC_PREFIX` en `middleware.ts`.

### Verificación D3

- SQL: `SELECT * FROM club_members WHERE pending_approval=true` tras rellenar.
- Descargar los docs desde Supabase Dashboard → confirmar que se subieron a
  `trainer-docs/{club_id}/{trainer_id}/*`.
- Honeypot: enviar `website=x` desde curl → rechazado.
- `npm run build` + `npm run lint` limpios.

---

## D4 — Panel admin de pendientes + aprobación multi-club/multi-equipo

**Objetivo:** Diego aprueba con un click, se crea el usuario Auth (o se reutiliza si
ya existía), se envía el email de bienvenida.

### Server actions admin

`src/features/entrenadores/actions/trainer-approval.actions.ts`:

- `listPendingTrainers()` — admin/dirección → filas con
  `pending_approval=true`, orden por `created_at DESC`, incluye URLs firmadas de docs
  para preview en el panel.

- `approveTrainer(memberId, config)`:
  ```ts
  // Roles son independientes: Diego marca cada uno con un toggle.
  // Solo 'entrenador' requiere team_ids. El resto aplica al club entero (team_id=NULL).
  config: {
    roles: {
      admin?: boolean
      direccion?: boolean
      director_deportivo?: boolean
      coordinador?: boolean
      entrenador?: { teamIds: string[] }   // 1+ equipos si activo
      fisio?: boolean
      infancia?: boolean
      redes?: boolean
    }
  }
  ```
  Flujo:
  1. Fetch `club_members` fila pendiente (por `memberId` + `clubId` del admin).
  2. Buscar email en `sb.auth.admin.listUsers()` (paginado — hay
     `perPage` param). Si existe → `existingUserId`. Si no → llamar
     `sb.auth.admin.createUser({ email, password: randomPassword(), email_confirm: true })`.
  3. UPDATE `club_members` SET `user_id = <auth_id>, active=true, pending_approval=false,
     must_change_password=<true si nuevo user, false si reutilizado>`.
  4. INSERT `club_member_roles` — una fila por rol activado:
     - Para cada rol booleano activo (admin, direccion, director_deportivo,
       coordinador, fisio, infancia, redes): `{member_id, role, team_id: NULL}`.
     - Para `entrenador` (si activo): N filas
       `{member_id, role: 'entrenador', team_id: <cada teamId>}`.
     Usar `onConflict: 'member_id,role,team_id', ignoreDuplicates: true`.
  5. Validación server-side: al menos 1 rol tiene que estar activo. Si
     `entrenador` activo, `teamIds.length >= 1`.
  6. Enviar email con `sendHtmlEmail` (patrón `createMember`) — plantilla nueva
     `trainer_welcome` con credenciales temporales (si nuevo) o "ya tienes cuenta,
     entra con tu email de siempre y selecciona el club" (si reutilizado).

- `rejectTrainer(memberId, reason?)`:
  DELETE `club_members` + borrar objetos en Storage `trainer-docs/{club_id}/{trainer_id}/`.

### UI admin

- `/entrenadores/pendientes/page.tsx` — nueva ruta. Tabla con foto pequeña, nombre,
  fecha, botones "Ver docs" (modal con las 4 imágenes/PDFs firmados), "Aprobar",
  "Rechazar". Aprobar abre modal con:
  - **8 toggles**, uno por rol (admin, dirección, director deportivo, coordinador,
    entrenador, fisio, infancia, redes) — cualquier combinación válida.
  - Si el toggle "entrenador" está activo, se despliega debajo un multi-select de
    equipos activos del club (obligatorio ≥1).
  - Validación cliente: al menos un rol activo. Si entrenador, ≥1 equipo.
- Añadir enlace "Pendientes (N)" con badge en la sidebar dentro de
  `Entrenadores → Cuerpo técnico`, visible solo para `admin`/`direccion`.

### Verificación D4

- Aprobar un pendiente con `isEntrenador=true, teamIds=[A,B]`, `isCoordinator=false` →
  ver 2 filas en `club_member_roles`.
- Aprobar un mismo email en un club distinto (usar SQL para insertar pendiente en otro
  club) → confirmar que reutiliza el `user_id` existente.
- Log-in con las credenciales del email de bienvenida → forzado a cambiar password.

---

## D5 — Vista solo lectura del entrenador

**Objetivo:** al entrenador solo se le muestra lo suyo y sin poder editar.

### Sidebar

`src/components/layout/Sidebar.tsx`:
- Ampliar `JUGADORES_ROLES` para incluir `'entrenador'`.
- Ampliar `ENTRENADORES_ROLES` para incluir `'entrenador'`.
- Ocultar submenu "Importar", "Inscripciones" para rol `entrenador` puro (dejar solo
  "Lista", "Sanciones").

### Filtrado por equipo

Nuevo helper `src/lib/permissions/trainer-teams.ts`:
```ts
export async function getTrainerAllowedTeams(): Promise<string[] | null>
// Devuelve null si el usuario es admin/direccion/coordinador (ve todo).
// Devuelve string[] con team_ids si es entrenador puro (limita a esos).
```
Se consume en:
- `src/app/(app)/jugadores/page.tsx`: si devuelve `string[]`, filtrar
  `players` por `team_id IN (allowedTeams) OR next_team_id IN (allowedTeams)`.
- `src/app/(app)/entrenadores/sesiones/page.tsx`: filtrar sesiones por `team_id IN`.
- Aplicar el mismo helper en `page.tsx` de cada ruta que un entrenador vea.

### Botones de edición (ocultos para rol entrenador puro)

Envolver los botones que hoy están sin guardia en `RoleGuard
roles={['admin','direccion','coordinador','director_deportivo']}`:
- Botón "Nuevo jugador" en `PlayerList.tsx`.
- Botón "Editar" en `PlayerCard.tsx`.
- Acciones destructivas (eliminar sanciones, lesiones, observaciones).

### Verificación D5

- Login como entrenador de test → ver solo jugadores de sus equipos.
- Ver que no aparecen botones "Nuevo jugador" ni "Editar".
- Cambiar a otro club (si tiene multi-membership) → ver los jugadores del otro club
  con los roles del otro club.

---

## D6 — Cron de recordatorio de caducidad + deploy final

**Objetivo:** cierra el bucle legal — el club nunca queda con un certificado caducado
sin darse cuenta.

### Cron

`src/app/api/cron/trainer-cert-expiry/route.ts`:
- Auth: patrón obligatorio (header `x-vercel-cron` **o** `Authorization: Bearer
  ${CRON_SECRET}`, guard si `CRON_SECRET` no configurado).
- Query:
  ```sql
  SELECT cm.id, cm.full_name, cm.email, cm.delitos_sexuales_uploaded_at,
         c.name AS club_name, c.primary_color, c.logo_url
  FROM club_members cm
  JOIN clubs c ON c.id = cm.club_id
  WHERE cm.doc_delitos_sexuales_url IS NOT NULL
    AND cm.delitos_sexuales_uploaded_at < NOW() - INTERVAL '11 months'
    AND cm.delitos_reminder_sent_at IS NULL
    AND cm.active = TRUE;
  ```
- Por cada fila: enviar email al entrenador + al admin del club con branding del club.
- UPDATE `delitos_reminder_sent_at = NOW()` para no reenviar.
- Añadir a `vercel.json`: `{ "path": "/api/cron/trainer-cert-expiry", "schedule": "0 9 * * *" }`.

### Deploy + prueba real

- Deploy a producción (todo lo de D3-D6).
- Diego rellena el formulario público como si fuera un entrenador real (con datos
  reales suyos), aprueba desde el panel, entra al login con las credenciales del
  email, confirma que solo ve lo que tiene que ver.

### Verificación D6

- SQL manual: `UPDATE club_members SET delitos_sexuales_uploaded_at = NOW() -
  INTERVAL '12 months' WHERE id='<test>'`.
- Ejecutar cron manualmente: `curl -H "Authorization: Bearer $CRON_SECRET"
  https://cluberly.club/api/cron/trainer-cert-expiry`.
- Verificar email recibido + `delitos_reminder_sent_at` actualizado.

---

## Archivos que se tocan

**Nuevos:**
- `supabase/migrations/068_trainer_signup.sql`
- `src/features/entrenadores/actions/trainer-signup.actions.ts` (público)
- `src/features/entrenadores/actions/trainer-approval.actions.ts` (admin)
- `src/app/entrenador-alta/[slug]/page.tsx` + `TrainerSignupForm.tsx`
- `src/app/(app)/entrenadores/pendientes/page.tsx`
- `src/app/api/cron/trainer-cert-expiry/route.ts`
- `src/lib/permissions/trainer-teams.ts` (helper de filtrado)

**Modificados (mínimos):**
- `middleware.ts` — añadir `/entrenador-alta` a `PUBLIC_PREFIX`.
- `src/components/layout/Sidebar.tsx` — ampliar sets `JUGADORES_ROLES` y
  `ENTRENADORES_ROLES`; añadir enlace "Pendientes".
- `src/app/(app)/jugadores/page.tsx` — aplicar filtro por equipos del entrenador.
- `src/app/(app)/entrenadores/sesiones/page.tsx` — mismo filtro.
- `src/features/jugadores/components/PlayerList.tsx` — envolver botón "Nuevo jugador"
  con `RoleGuard` que excluya rol entrenador puro.
- `src/features/jugadores/components/PlayerCard.tsx` — igual con botón "Editar".
- `vercel.json` — nuevo cron.

**Storage (manual desde Supabase Dashboard):**
- Bucket `trainer-docs` privado.

---

## Riesgos y contramedidas

1. **Constraint DB relajada afecta a otras partes del código.**
   Contramedida: buscar todos los `upsert(...club_member_roles..., onConflict:
   'member_id,role')` y actualizarlos a `member_id,role,team_id`. Búsqueda:
   `grep -rn "member_id,role" src/`.

2. **Multi-club: el email `dgbravofernandez@gmail.com` ya existe y falla el signup.**
   Contramedida: en D4 el `approveTrainer` maneja el caso reusando el `user_id`.
   Verificar en el test cruzando dos clubes.

3. **RLS parcial + servicio role.** El endpoint público `submitTrainerSignup`
   se ejecuta sin sesión (patrón como `submitInscription`) → usa `createAdminClient`.
   Contramedida: validar el `slug` y filtrar SIEMPRE por `club_id` resuelto del slug,
   nunca aceptar `clubId` del cliente.

4. **Storage bucket `trainer-docs` no existe al desplegar.** Se cae el submit
   con 400. Contramedida: crear el bucket manualmente en Supabase Dashboard
   ANTES del deploy de D3 (misma nota que las migraciones).

5. **Certificado renovación anual vs. 11 meses.** La LO 8/2021 no fija el plazo
   exacto de renovación pero la RFEF y muchas federaciones piden anual. 11 meses da
   1 mes de margen para renovar.

---

## Cómo verificar todo end-to-end (día 6, con un entrenador real)

1. Diego comparte `https://cluberly.club/entrenador-alta/ciudad-de-getafe` en el
   grupo de WhatsApp de entrenadores.
2. Un entrenador (por ejemplo, dgbravofernandez@gmail.com como test) lo rellena
   desde el móvil: sube foto, DNI, reciclaje, delitos sexuales, acepta RGPD.
3. Diego entra a `/entrenadores/pendientes`, ve la fila con las 4 miniaturas,
   pulsa "Aprobar" → marca los 2 equipos que llevará + toggle Entrenador → confirmar.
4. El entrenador recibe email con credenciales.
5. Login en `cluberly.club` → forzado a cambiar password → dashboard → ve sidebar
   reducido → click en "Jugadores" → ve solo los de sus 2 equipos, sin botones
   de edición.
6. 11 meses después (test manual con SQL), cron manda recordatorio.

**Definición de "hecho":** los 6 pasos anteriores completados en producción con un
entrenador real, sin intervención manual en Supabase.
