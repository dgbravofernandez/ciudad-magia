# 05 · Pre-SaaS (des-hardcoding + onboarding multi-club)

**Propósito:** lo que falta para que cualquier club entre solo, sin que toquemos código ni demos soporte.
**Owner:** Diego · **Última actualización:** 2026-06-20

---

## Dónde estamos

El SaaS multi-club **ya funciona** (migraciones `037_cluberly_saas`, `043` sheets por club, `044` form por club, `050` Stripe). El cliente real (Getafe) corre en producción. Lo que queda son **residuos hardcodeados** y la **experiencia de onboarding self-serve** — clave para el objetivo cero-soporte.

> Detalle de la conversión está en `CORPORATIVIZACION_CLUBERLY.md` (raíz). Esta sección es el resumen vivo + el enlace.

## Residuos a des-hardcodear (verificar uno a uno)

- [ ] Emails de remitente / contacto hardcodeados (buscar `@gmail`, `dgbravofernandez`, dominios fijos).
- [ ] IDs de Google Drive / Forms / Sheets fijos.
- [ ] Referencias a "Getafe" / branding fijo en UI o plantillas de email.
- [ ] Cualquier `clubId` o ruta específica de Getafe en código.

> Buscar con grep antes de asumir. No des-hardcodear lo que aún dé valor a Getafe sin alternativa configurable lista.

## Onboarding self-serve (lo que reduce soporte)

Objetivo: un club nuevo se da de alta, configura lo mínimo y empieza **sin contactarnos**.

- [ ] Registro de club → creación de tenant + admin (¿automático tras pago Stripe?).
- [ ] Wizard de configuración inicial: datos del club, branding/logo (018), cuotas (019), temporada, primer equipo.
- [ ] Conexión Google opcional y guiada (no obligatoria para empezar).
- [ ] Estado "club vacío" con guía de primeros pasos en vez de pantallas en blanco.
- [ ] Datos de ejemplo o plantilla para que el dashboard no luzca vacío en el primer login (impacta conversión).

## Multi-tenant: confirmar antes de escalar

Antes de meter el cliente nº2 de pago, pasar el **checklist pre-cliente** de [04-seguridad](../04-seguridad/CONTEXT.md) y el **flujo crítico #2** (aislamiento).

## Enlaces

- `CORPORATIVIZACION_CLUBERLY.md` (raíz) · Soporte: [07](../07-soporte/CONTEXT.md) · Seguridad: [04](../04-seguridad/CONTEXT.md)
