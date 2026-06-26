# Guía paso a paso — Activar Stripe Connect para Cluberly

> **Tiempo total:** ~30 minutos. Sigue el orden EXACTO. No te saltes pasos.

Esto se hace UNA VEZ y queda configurado para siempre. Aquí no hablamos del onboarding del CLUB
(eso lo hace cada club desde la app); aquí hablamos de TU plataforma Cluberly.

---

## ANTES DE EMPEZAR

Necesitas tener a mano:
- Acceso a tu dashboard Stripe (https://dashboard.stripe.com) — la misma cuenta donde ya tienes
  las suscripciones de Cluberly (€19/mes).
- Acceso a Vercel para añadir variables de entorno (https://vercel.com).
- Acceso al SQL Editor de Supabase para aplicar la migración 066.
- 30 minutos sin interrupciones.

---

## PASO 1 — Activar Stripe Connect en tu cuenta (5 min)

1. Entra en https://dashboard.stripe.com
2. **Comprueba arriba a la derecha** que estás en **MODO TEST** (toggle "Test mode" activado).
   - Por ahora trabajamos en test. El paso a producción es al final.
3. Menú izquierdo → busca **"Connect"**. Si no aparece, ve a Settings → busca "Connect" y actívalo.
4. En la pantalla de bienvenida de Connect:
   - Tipo de plataforma: **"Software platform"**
   - Modelo: **"I want to facilitate transactions for my users"**
   - Pulsa **"Get started"** / **"Continue"** hasta el final
5. **Pestaña "Settings" de Connect** (https://dashboard.stripe.com/test/settings/connect):
   - **Platform branding:**
     - Sube el **logo de Cluberly** (PNG cuadrado, fondo transparente, mínimo 128×128)
     - **Brand color:** `#EC4899` (rosa Cluberly)
     - **Business name:** `Cluberly`
     - **Support email:** el tuyo (`diego@cluberly.club` o `hello@cluberly.club`)
   - **Onboarding options:**
     - Express onboarding: **activado**
     - Business types disponibles: deja **Non-profit** y **Company** marcados
   - Pulsa **"Save"** abajo.

✅ Resultado: si entras en un AccountLink ahora, el club verá "Cluberly" con tu logo y color.

---

## PASO 2 — Crear el endpoint de webhook (5 min)

> El webhook es lo que avisa a tu app cuando un pago se completa, una cuenta cambia de estado, etc.
> Sin esto, los cobros NO se reflejarán en la app.

1. En el dashboard Stripe (modo test todavía), menú izquierdo → **Developers** → **Webhooks**.
2. Pulsa **"+ Add endpoint"**.
3. **Endpoint URL:** `https://cluberly.club/api/stripe/connect/webhook`
4. **Listen to:** elige **"Events on Connected accounts"** (NO "Events on your account" —
   ese es el de suscripciones que ya tienes).
5. **Select events** → marca SOLO estos:
   - `account.updated`
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
6. **API version:** la que tengas por defecto (Stripe la pone bien).
7. **"Add endpoint"** → te lleva al detalle del endpoint.
8. **COPIA el "Signing secret"** (empieza por `whsec_...`). Lo necesitarás en el paso siguiente.
   👉 Pulsa "Reveal" y copia el valor completo.

✅ Resultado: webhook creado, listo para recibir eventos.

---

## PASO 3 — Variables de entorno en Vercel (5 min)

1. Entra en https://vercel.com → tu proyecto Cluberly.
2. **Settings** → **Environment Variables**.
3. **Añade DOS variables nuevas** (Environment: Production, Preview, Development):

| Variable | Valor |
|---|---|
| `STRIPE_CONNECT_WEBHOOK_SECRET` | el `whsec_...` que copiaste en paso 2.8 |
| `STRIPE_CONNECT_CLIENT_ID` | (déjala vacía por ahora; se usa más adelante para el dashboard embebido) |

> No necesitas añadir otra `STRIPE_SECRET_KEY` — Connect usa la MISMA key que ya tienes para
> suscripciones.

4. **Redeploy** la app (Vercel lo pide al guardar; pulsa "Redeploy").

✅ Resultado: env vars listas, el webhook ya autentica.

---

## PASO 4 — Aplicar la migración 066 en Supabase (2 min)

1. Entra en https://supabase.com → tu proyecto Cluberly.
2. **SQL Editor** → **New query**.
3. Copia y pega el contenido completo de:
   `supabase/migrations/066_stripe_connect_cobros.sql`
4. Pulsa **"Run"** (Cmd/Ctrl + Enter).
5. Comprueba que no hay errores rojos.
6. Verifica desde la pestaña **Table Editor**:
   - `club_settings` ahora tiene `stripe_account_id`, `stripe_account_status`, `stripe_cobros_enabled` y 2 fechas
   - Existe la tabla `stripe_application_fees`
   - Existe la tabla `stripe_connect_webhook_events`

✅ Resultado: BD lista para guardar accounts, cobros y fees.

---

## PASO 5 — Probar el onboarding como si fueras un club (10 min)

> Aquí simulas ser un club nuevo activando los cobros. Es el flujo que verán tus usuarios reales.

1. Abre tu app en producción: https://cluberly.club
2. Inicia sesión como admin de un club de prueba (puede ser uno tuyo de pruebas; **no uses Getafe** —
   no queremos que el flag se active en su BD).
3. Ve a **Configuración** (sidebar) → **Cobros con tarjeta** (entrada nueva que añadirá esta versión).
4. Verás la pantalla con:
   - Explicación
   - **Bloque amarillo de transparencia** con el desglose 0,50 € + 0,5 %
   - Botón **"Empezar configuración con Stripe"**
5. Pulsa el botón. Te llevará a Stripe (en modo test, banner azul "Test mode" arriba).
6. Rellena el onboarding con datos TEST de Stripe:
   - País: España
   - Nombre del club: el que sea
   - DNI representante: **`000000000A`** (acepta cualquier formato en test)
   - Fecha nacimiento: la que sea (>18 años)
   - Domicilio: cualquiera
   - **IBAN de prueba España: `ES89 0182 0001 8800 0000 1234`** (acepta cualquier IBAN en test mode)
7. Termina el onboarding. Vuelves a `/configuracion/cobros`.
8. La página debería mostrar:
   - **"Tu cuenta Stripe está lista"** con ✓ verde
   - Toggle **"Cobros con tarjeta desactivados"** (porque es OPT-IN, no se activa solo)
9. Activa el toggle. Confirma que el toast dice "Cobros con tarjeta activados".

✅ Resultado: has hecho el onboarding completo en modo test. Ya puedes simular cobros.

---

## PASO 6 — Pasar a producción (5 min, al final)

> ⚠️ Solo cuando todo funcione perfecto en test. No te apures.

1. Dashboard Stripe → toggle **"Test mode" OFF** (arriba a la derecha).
2. **Connect settings (en LIVE)** → REPITE el paso 1 (logo, color, etc.) en modo LIVE.
   - El branding en test NO se copia a producción.
3. **Webhooks (en LIVE)** → REPITE el paso 2 con la misma URL pero **en LIVE mode**.
   - Te dará un `whsec_...` DIFERENTE al de test.
4. **Vercel env vars:**
   - Sustituye `STRIPE_CONNECT_WEBHOOK_SECRET` por el secret LIVE.
   - O si quieres tener ambos (recomendado): añade `STRIPE_CONNECT_WEBHOOK_SECRET_TEST` y deja
     el LIVE como principal. (Te lo configuro yo si me dices que estás listo.)
5. **Redeploy.**

✅ Resultado: producción lista. Los clubes reales pueden empezar.

---

## Qué se ha quedado para más tarde (yo lo programo, tú solo configuras)

- **Webhook handler:** procesa los eventos de Stripe (lo escribo yo, queda en `/api/stripe/connect/webhook`).
- **Crear links de pago:** botón en `/contabilidad/pagos` por cada cuota pendiente.
- **Email plantilla `payment_link`:** con CTA tarjeta + nota legal de transparencia.
- **Panel `/superadmin/cobros`:** para que VEAS quién tiene activado, total fees, exportable.
- **Cron de reconciliación nocturna:** compara cobros Stripe vs BD, avisa de desajustes.

---

## Si algo falla

- **"El onboarding me dice que falta algo después de terminarlo":**
  Stripe puede tardar 1-2 minutos en marcar `charges_enabled=true`. Recarga la página
  `/configuracion/cobros` un par de veces.
- **El webhook no recibe eventos:**
  Comprueba el endpoint URL exacto y que copiaste el `whsec_` correcto. En Stripe Dashboard →
  Webhooks → el endpoint → "Recent deliveries" verás los intentos.
- **"No puedo activar el toggle":**
  Si dice "Tu cuenta Stripe aún no permite cobrar", el onboarding está incompleto. Pulsa
  "Continuar onboarding".

---

## Quien decide qué

| Acción | Quién |
|---|---|
| Branding plataforma | Diego (1 vez) |
| Webhook secret | Diego (1 vez, en Vercel) |
| Migración SQL | Diego (1 vez, en SQL Editor) |
| Onboarding por club | El propio club (admin del club) |
| Activar/desactivar flag por club | El propio club (toggle en `/configuracion/cobros`) |
| Subir fee, cambiar pricing | Diego (en `src/lib/stripe-connect.ts` constantes) |
| Ver lo que cobras | Diego (`/superadmin/cobros` cuando esté hecho) |

---

**Cuando hayas terminado los pasos 1-4, dime "listo" y arranco las piezas restantes
(webhook handler, links de pago, email, panel superadmin).**
