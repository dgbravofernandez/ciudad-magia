# Base de Conocimiento — Cluberly (Ciudad Magia)

> Punto de entrada único. Si abres una sesión de Claude Code o entras como comprador en *due-diligence*, **empieza aquí**.

Cluberly es un CRM multi-tenant para clubes de fútbol, **ya en producción** (https://ciudad-magia-qj91.vercel.app) con dominio propio, cliente real (E.F. Ciudad de Getafe) y captación de leads en marcha. El objetivo de esta KB **no es construir el SaaS** — es **revisarlo, endurecerlo y hacerlo infalible**, reducir el soporte a casi cero y dejarlo vendible.

## Los 4 objetivos (orden de prioridad)

1. 🛡️ **App limpia y sin fallos** — auditoría continua, regresión de flujos críticos, patrones forzados.
2. 🤖 **Mínimo soporte técnico** — self-serve, monitoring (Sentry), deflexión documentada.
3. 💶 **Monetizar pronto** (dejar de trabajar) — apoyar el marketing ya en marcha.
4. 🏷️ **Vender con rédito** — esta KB ES el paquete de due-diligence.

## Mapa de secciones

| # | Sección | Para qué |
|---|---------|----------|
| [00](00-vision/CONTEXT.md) | **Visión** | Objetivos, North Star metrics, modelo de negocio |
| [01](01-producto/CONTEXT.md) | **Producto** | Módulos, estado real, [roadmap](01-producto/roadmap.md) |
| [02](02-arquitectura/CONTEXT.md) | **Arquitectura** | Stack, patrones obligatorios, [modelo de datos](02-arquitectura/data-model.md), [ADRs](02-arquitectura/decisiones/) |
| [03](03-calidad/CONTEXT.md) | **Calidad** | Testing, [flujos críticos](03-calidad/flujos-criticos.md), [bugs conocidos](03-calidad/bugs-conocidos.md) |
| [04](04-seguridad/CONTEXT.md) | **Seguridad** | Multi-tenant, RLS, [backlog de seguridad](04-seguridad/backlog-seguridad.md) |
| [05](05-pre-saas/CONTEXT.md) | **Pre-SaaS** | Des-hardcoding, onboarding multi-club |
| [06](06-comercializacion/CONTEXT.md) | **Comercialización** | ICP, [pricing](06-comercializacion/pricing.md), canales |
| [07](07-soporte/CONTEXT.md) | **Soporte** | Estrategia cero-soporte, [FAQ](07-soporte/faq.md) |
| [08](08-exit/CONTEXT.md) | **Exit** | Métricas de valoración, due-diligence, venta |

## Cómo usar esta KB

- **Cada sección tiene un `CONTEXT.md`** — léelo antes de tocar esa área.
- Claude Code **auto-carga** los `CLAUDE.md` anidados (`src/features/`, `src/lib/supabase/`, `supabase/migrations/`, `src/app/api/cron/`) que enlazan a la sección correcta. No tienes que cargar nada a mano.
- **Skills** propias en `.claude/skills/` codifican los patrones obligatorios. **Subagentes** en `.claude/agents/` (revisor-multitenant, qa-getafe) hacen auditoría y regresión.
- Mantén los docs **vivos**: si cambias el estado de un módulo, actualiza su `CONTEXT.md` en el mismo commit.

## ⚠️ Nota de estado (2026-06-20)

El `CLAUDE.md` raíz tenía datos desactualizados (decía "última migración 016"). El estado **real** verificado: migración **052**, RLS activo (`041`), audit log (`040`), Stripe + webhook idempotente (`050`), multi-club SaaS (`037`/`043`/`044`), Sentry instalado. Esta KB refleja el estado real; el `CLAUDE.md` raíz queda como índice de reglas y apunta aquí.
