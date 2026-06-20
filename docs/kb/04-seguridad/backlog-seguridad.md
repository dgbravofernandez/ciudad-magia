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
