# Pricing

**Owner:** Diego · **Última actualización:** 2026-06-20

> ⚠️ Pendiente de confirmar contra la implementación real de Stripe (migraciones `037_cluberly_saas`, `050`). Verificar los `price_id` y planes activos en el dashboard de Stripe antes de comunicar precios.

## Marco

- Cobro recurrente por club vía **Stripe** (subs + webhook idempotente).
- Mercado: clubes base ES → sensibilidad a precio alta, pero el dolor (gestión manual) es real.

## A definir / documentar aquí

- [ ] Planes y precios vigentes (mensual/anual) y sus `price_id`.
- [ ] ¿Hay trial? (los crons `trial-emails` sugieren que sí — documentar duración y flujo).
- [ ] ¿LTD / oferta de lanzamiento para los primeros clubes?
- [ ] Política de descuento (hermanos, varios equipos) — ojo: eso es cuota del club a familias, distinto del precio de Cluberly al club. No confundir.

## Lógica de "vaca lechera"

Recordatorio de [00-vision](../00-vision/CONTEXT.md): MRR > €1.500 y creciendo → no vender. Pricing debe empujar hacia ese umbral con pocos clubes de calidad antes que muchos baratos que disparen soporte.

## Herramientas

- Skill `pricing-strategist` para modelar planes. `competitive-teardown` para comparar con alternativas (otros CRM de clubes).
