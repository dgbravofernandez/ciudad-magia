# Flujos críticos — los que NUNCA deben romperse

**Owner:** Diego · **Última actualización:** 2026-06-20

Si uno de estos falla, hay ticket de soporte, pérdida de confianza o riesgo legal. Son la **lista de regresión** del subagente `qa-getafe` y el objetivo prioritario de cobertura e2e.

| # | Flujo | Por qué es crítico | ¿Cubierto por test? |
|---|-------|--------------------|---------------------|
| 1 | **Login → contexto de club correcto** | Si falla, nadie entra; si el club es incorrecto = fuga de datos | 🔴 No (solo smoke) |
| 2 | **Aislamiento multi-tenant**: club B no ve datos de club A | Fuga = problema GDPR + mata la venta | 🔴 No |
| 3 | **Registrar un pago** (completo y parcial) | Mueve dinero; error = descuadre contable | 🔴 No |
| 4 | **Cierre de caja diario** | Cuadre del club; base de su confianza | 🔴 No |
| 5 | **Inscripción de jugador** (form por club → alta) | Puerta de entrada de datos; menores | 🔴 No |
| 6 | **Asistencia de sesión + minutos** | Uso diario del entrenador; dato de rendimiento | 🔴 No |
| 7 | **Generación de sesiones semanales** (cron weekly-sessions) | Si falla, semana sin sesiones | 🔴 No |
| 8 | **Avisos de deuda / comunicaciones bulk** | Email masivo mal = daño reputacional del club | 🔴 No |
| 9 | **Cobro Stripe + webhook** (alta/baja de club de pago) | Es el ingreso; webhook idempotente (050) | 🔴 No |
| 10 | **Sync RFFM** (actas, goleadores, clasificaciones) | Valor diferencial; muchos crons | 🔴 No |

## Plan

- Empezar por #1, #2, #3 (los de mayor daño). Un e2e Playwright por flujo + datos de prueba de 2 clubes.
- Cada vez que se toque un módulo, añadir/actualizar su flujo aquí y su test.
- El `release-check` corre al menos el smoke de #1–#5 antes de deploy.

> Marcar la columna "¿Cubierto?" a 🟢 a medida que se escriben tests. Hoy todo 🔴 — es el trabajo más rentable para el objetivo "infalible".
