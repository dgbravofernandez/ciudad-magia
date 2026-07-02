# Backlog de seguridad

**Owner:** Diego · **Última actualización:** 2026-06-20 (Acción 0 — auditoría verificada en código)
**Origen:** análisis en MEMORY.md, **verificado leyendo el código actual**. Resultado: la mayoría de los SEC originales **ya estaban arreglados** — confirmado, no asumido.

---

## SEC-1 · OAuth state sin CSRF binding — ✅ RESUELTO
- **Archivo:** `src/app/api/google/callback/route.ts:30-68`
- **Verificado:** el callback ya valida `nonce` CSRF contra cookie httpOnly (30-40) **y además** comprueba que el usuario autenticado pertenece al `clubId` del state vía `club_members` (42-68). Doble defensa. Nada que hacer.

## SEC-2 · Cron bypass si CRON_SECRET undefined — ✅ RESUELTO
- **Verificado:** los **9 crons** (`sync-sheets`, `weekly-sessions`, `rffm-sync`, `trial-emails`, `daily-recap`, `marketing-batch`, `marketing-followups`, `demo-reminders`, `enrich-federation`) tienen el guard `if (!cronSecret) return 500` antes de validar. Nada que hacer.

## SEC-3 · redirect_uri desde header Host — 🟡 CÓDIGO RESUELTO, falta env
- **Archivo:** `src/lib/google/oauth.ts:31-43`
- **Verificado:** el código prefiere `GOOGLE_REDIRECT_URI` y solo cae a host dinámico con `console.warn` si falta.
- **ACCIÓN (operativa, 5 min):** confirmar que `GOOGLE_REDIRECT_URI` está seteada en Vercel en **ambos** proyectos. No verificable desde código.

## SEC-4 · Aislamiento multi-tenant sin enforcement estructural — 🟢 BIEN EN PRÁCTICA, sweep pendiente
- **Verificado (cata):** `src/features/contabilidad/actions/accounting.actions.ts` — los **11 `insert` llevan `club_id: clubId`**. La disciplina multi-tenant está bien aplicada donde más importa (dinero).
- **Pendiente:** sweep completo de los 30 archivos de actions (246 ocurrencias de insert/single) con el subagente `revisor-multitenant` (sin presupuesto hasta reset de sesión). Mientras, RLS parcial (`041`) cubre como red.
- **Mejora estructural (deferred):** `getScopedClient()` central + lint `no-restricted-imports`; RLS por `club_id` con claims JWT.

## SEC-5 · Refresh tokens Google en texto plano — ✅ RESUELTO (2026-06-20)
- **Era:** los `google_refresh_token` se guardaban en **texto plano** y la desconexión no revocaba en Google.
- **Fix aplicado:** nuevo `src/lib/crypto/token-crypto.ts` (AES-256-GCM, clave derivada de `APP_SECRET` con scrypt). Se **cifra al escribir** (`callback/route.ts:99`) y se **descifra al leer** (las 3 lecturas en `backend-sheet.actions.ts:127,232,267`). `disconnectGoogle` ahora **revoca en Google** antes de limpiar la BD (`backend-sheet.actions.ts:195-198`).
- **Retrocompatibilidad:** `decryptToken` devuelve tal cual los tokens legados en texto plano → los clubes ya conectados siguen funcionando hasta reconectar (entonces se reescriben cifrados).
- **Pendiente menor (deferred):** clave derivada **por club** `HKDF(APP_SECRET + club_id)` (hoy clave global). Mejora, no bloqueante.
- **⚠️ Probar en staging:** un ciclo real de conectar/sincronizar/desconectar Google antes de confiar plenamente (no verificable en local sin credenciales).

## SEC-6 · APP_SECRET con fallback a secreto hardcodeado — ✅ RESUELTO (2026-06-20)
- **Era:** `process.env.APP_SECRET ?? 'dev-secret-replace-in-prod'` en 3 sitios → cookies/HMAC falsificables si `APP_SECRET` faltaba.
- **Fix aplicado:** fallo cerrado (sin secreto por defecto) en `select-club/actions.ts`, `marketing/campaign.actions.ts`, `api/marketing/unsubscribe/route.ts`. Consistente con `superadmin.actions.ts`.
- **Confirmado:** `APP_SECRET` está seteada en Vercel (Diego, 2026-06-20).

---

## Resumen Acción 0 (cerrado)

| Ítem | Estado |
|------|--------|
| SEC-1 | ✅ ya estaba resuelto |
| SEC-2 | ✅ ya estaba resuelto |
| SEC-3 | ✅ código ok + env confirmada en Vercel |
| SEC-4 | ✅ 6 fugas de escritura corregidas (A-1..A-3, M-1..M-3); sweep limpio del resto |
| SEC-5 | ✅ resuelto — cifrado en reposo + revoke |
| SEC-6 | ✅ resuelto — fallo cerrado |

**Build verificado:** `npm run build` pasa tras todos los fixes.

## Deferred (no bloqueante)
- SEC-4 estructural: `getScopedClient()` central + lint `no-restricted-imports` para `createAdminClient` → previene esta clase de bug de raíz.
- SEC-5: clave por club (HKDF).
- Probar SEC-5 end-to-end en staging con Google real.

---

## Auditoría multi-tenant 2026-07-01 (revisor-multitenant)

### SEC-7 · CRÍTICO — Escalada a superadmin por inyección de `x-platform-role` — ✅ RESUELTO
- **Era:** el middleware copiaba TODAS las cabeceras del cliente (`new Headers(request.headers)`) y solo sobreescribía `x-platform-role` condicionalmente. Un usuario autenticado podía inyectar `x-platform-role: superadmin` y pasar `assertSuperAdmin()` → lectura/escritura cross-tenant de todos los clubes (PII, toggleClubActive, notas).
- **Fix aplicado (doble):**
  1. `middleware.ts`: helper `sanitizedHeaders()` que borra los 7 headers de confianza (`x-club-id`, `x-member-id`, `x-user-roles`, `x-user-email`, `x-user-id`, `x-platform-role`, `x-impersonating`) al entrar, en los 4 caminos (`public`, `/superadmin`, impersonación, flujo normal).
  2. `superadmin.actions.ts` `assertSuperAdmin()`: el header solo puede DENEGAR; para conceder se verifica SIEMPRE contra `platform_admins` por `user_id` de sesión.
- Los `requireSuperadmin` de marketing (campaign/demos/import-leads) ya tenían fallback a BD; con el saneado del middleware su fast-path por header deja de ser inyectable.

### SEC-8 · MEDIO — `/api/stripe/portal` sin validación de rol — ✅ RESUELTO
- Cualquier miembro del club (entrenador, fisio…) podía abrir el portal de facturación Stripe del club. Añadido gate `admin`/`direccion` (mismo que `/api/stripe/checkout`).

### Pendientes menores de la misma auditoría
- **B-1:** `api/scouting/rffm/verify` consulta cross-club (datos públicos de federación; además ya está marcado como código muerto SCT-1 en bugs-conocidos — eliminar ruta).
- **B-2:** `src/lib/supabase/middleware.ts:37-38` — `console.log` con nombres de cookies y `user.id` en cada request. Quitar.

### Áreas verificadas LIMPIAS (misma auditoría)
Server actions recientes (sync-new-inscriptions, player-docs, stripe-connect), Server Components de negocio, API routes (documentos-zip, PDFs, user-clubs), ClubProvider (force-dynamic, sin caché cross-tenant), `.single()` con `club_id`, flujo cookie `preferred_club_id` firmada (el diff de onboarding MEJORA la seguridad), aplicación de impersonación respaldada por BD.

**Nota sobre el "bug multi-tenant variante 2":** la explicación más plausible NO es fuga del data layer (auditado limpio) sino que el tester creó el club B logueado como el mismo usuario → `createClub` (onboarding) lo dio de alta como admin del club B → 2 memberships → `members[0]` (más reciente) = club B. Confirmar con Diego si el usuario de test pudo haber creado el club él mismo.
