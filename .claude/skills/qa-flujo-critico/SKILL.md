---
name: qa-flujo-critico
description: Prueba un flujo de Cluberly end-to-end con el navegador/preview y devuelve evidencia (screenshot, logs, network). Cumple la Regla 1 del proyecto ("probar antes de dar por hecho"). Úsala tras cualquier cambio que afecte a un flujo de usuario.
---

# qa-flujo-critico

Verifica que un flujo funciona de verdad y deja **evidencia**. Nunca se dice "listo" sin esto.

## Cuándo usar
Tras tocar cualquier cosa observable en la app (UI, server action de un flujo, página). Si el cambio no es observable en el navegador (tipos, tooling), no aplica.

## Flujo de trabajo
1. Levanta el dev server (`npm run dev`, **sin `--turbopack`**) o usa las preview tools.
2. Recorre el flujo objetivo. Por defecto cubre los de `docs/kb/03-calidad/flujos-criticos.md` relevantes al cambio. Prioridad: login→club, aislamiento multi-tenant, pagos, cierre de caja, inscripción.
3. Revisa **consola y network** por errores. Ningún error técnico crudo debe llegar al usuario.
4. Para flujos multi-tenant: verifica con **dos clubes** que uno no ve datos del otro.
5. Captura **evidencia**: screenshot del estado final + logs relevantes.

## Salida esperada
- ✅/❌ por cada paso del flujo.
- Evidencia adjunta (screenshot/logs).
- Si ❌: diagnóstico (archivo + causa) y fix propuesto; reabrir entrada en `docs/kb/03-calidad/bugs-conocidos.md`.

## Herramientas
Preview tools (`preview_*`) o las skills existentes `webapp-testing` / `senior-qa` para casos Playwright. Para regresión amplia, el subagente `qa-getafe`.
