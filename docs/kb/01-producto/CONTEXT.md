# 01 · Producto

**Propósito:** qué hace la app hoy, módulo a módulo, con su estado real.
**Owner:** Diego · **Última actualización:** 2026-06-20

---

## Módulos (estado real verificado en migraciones 001–052 y rutas)

| Módulo | Ruta | Estado |
|--------|------|--------|
| **Jugadores** | `(app)/jugadores` | ✅ Maduro — lista, ficha, inscripciones, sanciones, lesiones, observaciones, trial letters, documentos, casos especiales |
| **Entrenadores** | `(app)/entrenadores` | ✅ Maduro — equipos, sesiones, asistencia con minutos, partidos live+diferidos, convocatorias (017), observaciones coord, scouting, ejercicios |
| **Contabilidad** | `(app)/contabilidad` | ✅ Maduro — pagos (incl. parciales 033), gastos, cierre de caja (038), avisos deuda, transferencias bancarias (023), verificación movimientos (045) |
| **Comunicaciones** | `(app)/comunicaciones` | ✅ Maduro — bulk + individual, plantillas, tracking, inbox fix (052) |
| **Configuración** | `(app)/configuracion` | ✅ Maduro — club, roles, cuotas por temporada (019), plantillas, temporada, branding (018), integraciones |
| **Torneos** | `(app)/torneos` | ✅ Grupos + eliminatorias (012) |
| **Ropa** | `(app)/ropa` | ✅ Pedidos + seguimiento + catálogo (037_clothing_catalog) |
| **Actividades** | `(app)/...` | ✅ (020, 039) |
| **Integración RFFM** | `lib/google` + crons | ✅ Sync federación: actas, goleadores, clasificaciones, enrich (021–027, 034) |
| **Superadmin / plataforma** | `(superadmin)` | ✅ Multi-tenant admin, platform_admins (029/047) |
| **Marketing / captación** | crons + `(app)` | ✅ Campañas, batch, follow-ups, trial emails, demo reminders (046, 048, 049) |
| **Servicios externos** | — | ✅ Contabilidad separada |
| **Personal** (fisio, infancia, redes, dirección) | `(app)/personal/*` | 🟡 Esqueleto / parcial |
| **Dashboard** | `(app)` | 🟡 Básico |

## SaaS multi-club: ya operativo

Migraciones `037_cluberly_saas`, `043_per_club_inscription_sheets`, `044_club_inscription_form_link`, `050_stripe_webhook_idempotency` indican que el aislamiento por `club_id`, los formularios por club y el cobro Stripe **ya están implementados**. El trabajo restante es **endurecer y des-hardcodear residuos** (ver [05-pre-saas](../05-pre-saas/CONTEXT.md)), no construir.

## Gaps de producto (lo que queda)

1. `/personal/*` — fisio, infancia, redes, dirección: esqueleto. Decidir si se completan o se ocultan para no enseñar features vacías a un comprador.
2. Dashboard básico — poco valor percibido en el primer login. Impacta conversión.
3. Cobertura de tests fina (ver [03-calidad](../03-calidad/CONTEXT.md)).

## Enlaces

- Prioridades vivas: [roadmap.md](roadmap.md)
- Plantilla de spec por feature: [features/_PLANTILLA.md](features/_PLANTILLA.md)
- Arquitectura: [02](../02-arquitectura/CONTEXT.md)
