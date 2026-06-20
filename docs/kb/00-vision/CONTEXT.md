# 00 · Visión

**Propósito:** el "por qué" del proyecto y los criterios que ordenan toda decisión.
**Owner:** Diego · **Última actualización:** 2026-06-20

---

## Qué es

Cluberly: CRM SaaS multi-tenant para clubes de fútbol base. Nace como herramienta interna para **E.F. Ciudad de Getafe** y ya está empaquetado como producto vendible a otros clubes. **En producción, con dominio y leads en captación.**

## Los 4 objetivos (en orden)

1. **Infalible.** La app ya está viva con un cliente real. Cada cambio debe dejarla más estable, nunca menos. Prioridad sobre features nuevas.
2. **Cero soporte.** Cada hora de soporte técnico es una hora que no quiero gastar. Todo lo que reduzca tickets (self-serve, onboarding guiado, mensajes de error claros, monitoring proactivo) tiene prioridad sobre cosmética.
3. **Monetizar pronto** para dejar de depender de otros ingresos. El motor de captación ya existe (ver [06](../06-comercializacion/CONTEXT.md)); el producto tiene que convertir y retener.
4. **Vender con rédito.** Múltiplo de referencia micro-SaaS sub-100k ARR: ~4x SDE. Una venta limpia exige código sin deuda, seguridad documentada y métricas creíbles. Esta KB es el dossier.

## North Star metrics (a instrumentar/seguir)

| Métrica | Por qué importa | Objetivo del año |
|---------|-----------------|------------------|
| Clubes de pago activos | Ingreso recurrente | Crecer mes a mes |
| MRR | Salud del negocio | €1.500+ = "vaca lechera", no vender |
| Tickets de soporte / club / mes | Objetivo cero-soporte | Tendencia a la baja |
| Errores no capturados (Sentry) | Infalibilidad | →0 en flujos críticos |
| Churn mensual | Retención | < 5% |

> Estas métricas hoy no están todas instrumentadas. Instrumentarlas es trabajo de [03-calidad](../03-calidad/CONTEXT.md) + [07-soporte](../07-soporte/CONTEXT.md).

## Regla de decisión "mantener o vender"

| Condición | Acción |
|-----------|--------|
| MRR creciendo >10%/mes | Mantener |
| MRR estancado 3+ meses | Listar en Acquire (ver [08](../08-exit/CONTEXT.md)) |
| MRR decreciendo | Vender rápido antes de que baje el múltiplo |
| MRR >€1.500 y creciendo | Nunca vender |

## Enlaces

- Estrategia de portfolio más amplia: `C:\Users\dgbra\CLAUDE.md` (Kevo).
- Estado del producto: [01-producto](../01-producto/CONTEXT.md).
- Plan de venta: [08-exit](../08-exit/CONTEXT.md).
