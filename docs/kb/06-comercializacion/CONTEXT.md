# 06 · Comercialización

**Propósito:** a quién vendemos, cómo y por qué canales. La captación **ya está en marcha** (crons de marketing + scraping de federaciones).
**Owner:** Diego · **Última actualización:** 2026-06-20

---

## ICP (cliente ideal)

Clubes de fútbol base españoles (empezando por federaciones regionales — RFFM y otras). Quien hoy gestiona con Excel + WhatsApp + papel y sufre cobros, inscripciones, asistencia y comunicación con familias.

## Motor de captación ya construido (en la propia app)

Hay automatización de marketing **dentro del producto**, no solo en `docs/marketing`:

- Crons: `marketing-batch` (L–V 16:00), `marketing-followups` (10:00), `trial-emails` (9:00), `demo-reminders` (18:00), `enrich-federation` (cada 20 min).
- Migraciones `046` (acquisition tracking + trial emails), `048` (campaña), `049` (variante texto plano).
- `docs/marketing/`: scrapers de federaciones, enriquecimiento de leads, `Seguimiento-Clubes-Multi-Federacion.xlsx`, plantillas de email, guion de video demo, presentación y acuerdo comercial (PDF).

→ El trabajo de comercialización **no es construir el canal**, es **afinar conversión y retención** y no romper lo que ya capta.

## Material de ventas existente

- `PRESENTACION_VENTAS.md`, `docs/marketing/Presentacion-Cluberly.pdf`
- `docs/marketing/Acuerdo-Comercial-Cluberly.pdf`
- `docs/marketing/emails-captacion.md`, `guion-video-demo.md`, `OUTREACH-README.md`

## Pricing

Ver [pricing.md](pricing.md).

## Dónde trabajar esto (Code vs Project)

- **Claude Code:** cualquier cosa que toque la app (landing, crons de marketing, tracking, plantillas de email en código).
- **Claude.ai Project:** outreach diario, investigación de federaciones, redacción de campañas, gestión de leads del Excel. No contamina el contexto de código.

## Enlaces

- Pricing: [pricing.md](pricing.md) · Soporte/retención: [07](../07-soporte/CONTEXT.md) · `docs/marketing/`
