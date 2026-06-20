# Contexto: `src/app/api/cron/` — endpoints programados

Hay **20+ crons** (sync-sheets, weekly-sessions, trial-emails, marketing-batch/followups, demo-reminders, daily-recap, rffm-sync×varios, enrich-federation). Configurados en `vercel.json`.

## Auth (patrón obligatorio)

Header `x-vercel-cron` **o** `Authorization: Bearer ${CRON_SECRET}`.

⚠️ **SEC-2 — verificar en cada cron:** si `CRON_SECRET` está `undefined`, la comparación `Bearer ${undefined}` puede dejar pasar `Bearer undefined`. Patrón correcto:

```ts
const cronSecret = process.env.CRON_SECRET
if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
// luego validar el header
```

## Al tocar un cron

- Captura errores **por club** y continúa con los demás (un club no debe tumbar el batch).
- Idempotencia: Vercel garantiza at-least-once, no exactly-once (ver ARCH-4; Stripe ya cubierto en mig. `050`).

→ Backlog seguridad crons: [docs/kb/04-seguridad/backlog-seguridad.md](../../../../docs/kb/04-seguridad/backlog-seguridad.md)
