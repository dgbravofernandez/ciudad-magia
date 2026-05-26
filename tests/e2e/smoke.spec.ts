/**
 * Smoke tests — Ciudad Magia
 *
 * Cubren los flujos críticos que históricamente han fallado en producción.
 * Se ejecutan contra http://localhost:3000 (dev) o PLAYWRIGHT_BASE_URL (staging/prod).
 *
 * Variables de entorno requeridas para tests autenticados:
 *   TEST_EMAIL     — email de una cuenta admin de prueba
 *   TEST_PASSWORD  — contraseña de esa cuenta
 */
import { test, expect, type Page } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function login(page: Page) {
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD
  if (!email || !password) {
    test.skip(true, 'TEST_EMAIL / TEST_PASSWORD no configurados — test autenticado omitido')
    return
  }
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard/, { timeout: 15_000 })
}

// ---------------------------------------------------------------------------
// 1. Páginas públicas
// ---------------------------------------------------------------------------

test.describe('Páginas públicas', () => {
  test('login page carga y muestra formulario', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('ruta raíz responde (no 500)', async ({ page }) => {
    const res = await page.goto(BASE)
    expect(res?.status()).not.toBe(500)
  })

  test('ruta inexistente devuelve 404 o redirige (no 500)', async ({ page }) => {
    const res = await page.goto(`${BASE}/ruta-que-no-existe-zzzz`)
    expect(res?.status()).not.toBe(500)
  })
})

// ---------------------------------------------------------------------------
// 2. Endpoints de API
// ---------------------------------------------------------------------------

test.describe('API — cron endpoints', () => {
  test('sync-sheets sin token devuelve 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/cron/sync-sheets`)
    expect([401, 403]).toContain(res.status())
  })

  test('sync-sheets con token incorrecto devuelve 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/cron/sync-sheets`, {
      headers: { Authorization: 'Bearer wrong-token' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('rffm-sync sin token devuelve 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/cron/rffm-sync`)
    expect([401, 403]).toContain(res.status())
  })

  test('weekly-sessions sin token devuelve 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/cron/weekly-sessions`)
    expect([401, 403]).toContain(res.status())
  })

  // Test SEC-2 fix: "Bearer undefined" ya NO es válido
  test('sync-sheets con "Bearer undefined" devuelve 401 (SEC-2)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/cron/sync-sheets`, {
      headers: { Authorization: 'Bearer undefined' },
    })
    expect([401, 403, 500]).toContain(res.status())
    // No debe ser 200 — eso significaría que el bypass sigue activo
    expect(res.status()).not.toBe(200)
  })
})

// ---------------------------------------------------------------------------
// 3. Autenticación — rutas protegidas sin auth
// ---------------------------------------------------------------------------

test.describe('Rutas protegidas', () => {
  const protectedRoutes = [
    '/dashboard',
    '/jugadores',
    '/jugadores/inscripciones',
    '/contabilidad',
    '/contabilidad/pagos',
    '/configuracion',
    '/comunicaciones',
    '/entrenadores',
  ]

  for (const route of protectedRoutes) {
    test(`${route} redirige a login sin auth`, async ({ page }) => {
      await page.goto(`${BASE}${route}`)
      await page.waitForLoadState('networkidle')
      // Debe acabar en /login o mostrar formulario de login
      const url = page.url()
      const hasLoginForm = await page.locator('input[type="email"]').isVisible().catch(() => false)
      const isOnLogin = url.includes('/login')
      expect(isOnLogin || hasLoginForm).toBe(true)
    })
  }
})

// ---------------------------------------------------------------------------
// 4. Flujos autenticados (requieren TEST_EMAIL + TEST_PASSWORD)
// ---------------------------------------------------------------------------

test.describe('Flujos autenticados', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('dashboard carga con métricas', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    // El dashboard muestra al menos el título
    const body = page.locator('body')
    await expect(body).not.toContainText('Error')
    await expect(body).not.toContainText('500')
    // Debe haber contenido real (no pantalla en blanco)
    const text = await body.innerText()
    expect(text.length).toBeGreaterThan(100)
  })

  test('lista de jugadores carga sin error', async ({ page }) => {
    await page.goto(`${BASE}/jugadores`)
    await page.waitForLoadState('networkidle')
    const body = page.locator('body')
    await expect(body).not.toContainText('Error interno')
    // No debe estar vacía
    const text = await body.innerText()
    expect(text.length).toBeGreaterThan(50)
  })

  test('inscripciones carga sin error', async ({ page }) => {
    await page.goto(`${BASE}/jugadores/inscripciones`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Error interno')
  })

  test('contabilidad/pagos carga sin error', async ({ page }) => {
    await page.goto(`${BASE}/contabilidad/pagos`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Error interno')
  })

  test('configuracion/planificacion carga sin error', async ({ page }) => {
    await page.goto(`${BASE}/configuracion/planificacion`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Error interno')
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error')
  })

  // ── Flujo crítico: formulario "Nuevo jugador" ───────────────────────────────
  test('nuevo jugador: formulario renderiza con los campos requeridos', async ({ page }) => {
    await page.goto(`${BASE}/jugadores/nuevo`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Error interno')
    await expect(page.locator('body')).not.toContainText('500')

    // El formulario debe tener inputs de nombre, apellidos y un botón de envío
    const inputs = page.locator('input[type="text"], input:not([type])')
    await expect(inputs.first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('button[type="submit"], button:has-text("Guardar"), button:has-text("Crear")').first())
      .toBeVisible({ timeout: 5_000 })
  })

  // ── Flujo crítico: panel de pagos interactivo ────────────────────────────────
  test('contabilidad/pagos: botón "Registrar pago" abre un formulario con campo importe', async ({ page }) => {
    await page.goto(`${BASE}/contabilidad/pagos`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Error interno')

    // Buscar cualquier botón de "Registrar pago"
    const registerBtn = page.getByRole('button', { name: /registrar pago/i }).first()
    const btnVisible = await registerBtn.isVisible({ timeout: 3_000 }).catch(() => false)

    if (!btnVisible) {
      // Si no hay jugadores con deuda en este entorno, el test pasa trivialmente
      test.skip(true, 'No hay jugadores con pago pendiente para testear el flujo de registro')
      return
    }

    await registerBtn.click()

    // El diálogo/panel debe tener un input de importe
    const amountInput = page.locator('input[name="amount"], input[type="number"], input[inputmode="decimal"]').first()
    await expect(amountInput).toBeVisible({ timeout: 5_000 })

    // Cerrar sin enviar (Escape o botón cancelar)
    await page.keyboard.press('Escape')
  })

  // ── Flujo crítico: cron con token válido devuelve 200 ───────────────────────
  test('cron sync-sheets con CRON_SECRET correcto devuelve 200', async ({ request }) => {
    const cronSecret = process.env.TEST_CRON_SECRET
    if (!cronSecret) {
      test.skip(true, 'TEST_CRON_SECRET no configurado — test de cron autenticado omitido')
      return
    }
    const res = await request.get(`${BASE}/api/cron/sync-sheets`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    expect(res.status()).toBe(200)
  })

  test('baja por requisitos: botón muestra confirmación inline (no confirm())', async ({ page }) => {
    await page.goto(`${BASE}/jugadores/inscripciones`)
    await page.waitForLoadState('networkidle')

    // Si no hay jugadores activos el test pasa trivialmente
    const menuTrigger = page.locator('[data-testid="dismiss-menu-trigger"]').first()
    if (!(await menuTrigger.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, 'No hay jugadores con inscripción activa para testear')
      return
    }

    // Interceptar window.confirm — nunca debe llamarse
    let confirmCalled = false
    await page.addInitScript(() => {
      window.confirm = () => { (window as any).__confirmCalled = true; return false }
    })

    await menuTrigger.click()
    const bajaBtn = page.getByText('Dar de baja por requisitos').first()
    if (await bajaBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await bajaBtn.click()
      // Debe aparecer confirmación inline, NO llamar a window.confirm
      confirmCalled = await page.evaluate(() => !!(window as any).__confirmCalled)
      expect(confirmCalled).toBe(false)
      // Debe aparecer botón "Confirmar" en la UI
      await expect(page.getByText('Confirmar').first()).toBeVisible({ timeout: 3_000 })
    }
  })
})
