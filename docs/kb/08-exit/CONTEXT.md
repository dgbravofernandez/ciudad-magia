# 08 · Exit (preparación para la venta)

**Propósito:** dejar la app vendible en cualquier momento y maximizar el múltiplo. Objetivo #4.
**Owner:** Diego · **Última actualización:** 2026-06-20

---

## Tesis

Múltiplo de referencia micro-SaaS sub-100k ARR: **~4x SDE**. Lo que mueve el múltiplo hacia arriba: ingreso recurrente creciente, churn bajo, **poco soporte/dependencia del fundador**, código limpio y seguridad documentada. Toda esta KB existe en parte para que la due-diligence sea un paseo.

## Qué pide un comprador (dossier de due-diligence)

| Área | Dónde vive | Estado |
|------|-----------|--------|
| Qué hace y para quién | [00](../00-vision/CONTEXT.md), [01](../01-producto/CONTEXT.md) | ✅ documentado |
| Arquitectura y decisiones | [02](../02-arquitectura/CONTEXT.md) + ADRs | ✅ base lista |
| Seguridad y aislamiento de datos | [04](../04-seguridad/CONTEXT.md) | 🟡 backlog por cerrar |
| Métricas (MRR, churn, CAC, soporte) | [00](../00-vision/CONTEXT.md) North Star | 🔴 instrumentar |
| Legal / RGPD | `docs/legal/` | ✅ plantillas |
| Estabilidad / cobertura de tests | [03](../03-calidad/CONTEXT.md) | 🔴 ampliar |
| Dependencia del fundador (¿se opera sin Diego?) | [07](../07-soporte/CONTEXT.md) cero-soporte | 🟡 en curso |

## Palancas de valor (orden)

1. **Bajar dependencia del fundador** — cero-soporte + onboarding self-serve. Es lo que más asusta a un comprador.
2. **Demostrar estabilidad** — tests de flujos críticos + Sentry limpio.
3. **Métricas creíbles** — instrumentar MRR/churn/soporte y tener histórico.
4. **Código limpio** — cerrar deuda (ARCH-1..4), seguridad (SEC-1..5), des-hardcoding.

## Cuándo listar

Regla de [00-vision](../00-vision/CONTEXT.md): MRR estancado 3+ meses → Acquire; decreciendo → vender rápido; >€1.500 creciendo → no vender. Plataforma de referencia: Acquire.com.

## Enlaces

- Visión/regla mantener-vender: [00](../00-vision/CONTEXT.md) · Estrategia portfolio Kevo: `C:\Users\dgbra\CLAUDE.md`
