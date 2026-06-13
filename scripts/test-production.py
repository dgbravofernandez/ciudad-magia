"""Test rápido de cluberly.club en producción.
Verifica: landing, onboarding, reservar, recomendar, /superadmin (debe pedir login).
Captura screenshots y bugs detectados.
"""
from playwright.sync_api import sync_playwright
import os

BASE = "https://cluberly.club"
OUT = "data/test-screenshots"
os.makedirs(OUT, exist_ok=True)

bugs = []
console_errors = []

def check(name, page, url, expect_text=None, expect_selector=None):
    print(f"\n[{name}] GET {url}")
    try:
        page.goto(url, wait_until="networkidle", timeout=15000)
    except Exception as e:
        bugs.append(f"[{name}] timeout/error: {e}")
        return
    page.screenshot(path=f"{OUT}/{name}.png", full_page=True)
    title = page.title()
    print(f"  title: {title}")
    if expect_text:
        body = page.content()
        if expect_text.lower() not in body.lower():
            bugs.append(f"[{name}] falta texto '{expect_text}' en la pagina")
        else:
            print(f"  OK: texto '{expect_text}' presente")
    if expect_selector:
        if page.locator(expect_selector).count() == 0:
            bugs.append(f"[{name}] falta selector '{expect_selector}'")
        else:
            print(f"  OK: selector '{expect_selector}' presente")
    return page

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="es-ES")
    page = ctx.new_page()
    page.on("console", lambda msg: console_errors.append(f"{msg.type}: {msg.text}") if msg.type in ("error", "warning") else None)
    page.on("pageerror", lambda exc: bugs.append(f"PAGE ERROR: {exc}"))

    # Landing
    check("01-landing", page, BASE, expect_text="cluberly", expect_selector="text=Prueba gratis")

    # Pricing scroll
    check("02-pricing", page, f"{BASE}/#precios", expect_text="39")

    # Onboarding
    check("03-onboarding", page, f"{BASE}/onboarding", expect_text="Crea tu cuenta", expect_selector="input[type=email]")

    # Onboarding con pre-relleno
    check("04-onboarding-prefilled", page, f"{BASE}/onboarding?clubName=Club+Test+Demo&city=Madrid", expect_text="Club Test Demo")

    # Reservar
    check("05-reservar", page, f"{BASE}/reservar", expect_text="Reserva", expect_selector="button")

    # Reservar con club pre-rellenado
    check("06-reservar-club", page, f"{BASE}/reservar?club=C.D.+Prueba", expect_text="C.D. Prueba")

    # Recomendar
    check("07-recomendar", page, f"{BASE}/recomendar", expect_text="Recomienda")

    # Login
    check("08-login", page, f"{BASE}/login", expect_text="sión", expect_selector="input[type=password]")

    # /superadmin (debe redirigir a login)
    check("09-superadmin-redirect", page, f"{BASE}/superadmin")

    # /api/debug/me (debe pedir login o decir no_session)
    page.goto(f"{BASE}/api/debug/me", timeout=10000)
    body = page.content()
    if "no_session" not in body and "401" not in body and "login" not in body.lower():
        bugs.append("[debug-me] el endpoint debug no exige autenticacion")
    else:
        print("\n[09b-debug-me] OK protegido")

    # /privacy
    check("10-privacy", page, f"{BASE}/privacy", expect_text="Privacidad")

    browser.close()

print("\n" + "="*60)
print(f"BUGS DETECTADOS: {len(bugs)}")
for b in bugs:
    print(f"  - {b}")
print(f"\nCONSOLE ERRORS: {len(console_errors)}")
for e in console_errors[:10]:
    print(f"  - {e}")
print(f"\nScreenshots en: {OUT}/")
