"""
refill_autoloop.py
Loop completamente automatico hasta llegar a TARGET emails en BD.

Comportamiento:
  1. Espera a que cualquier instancia previa de refill_patient.py termine
  2. Lanza refill_patient.py como subprocess (bloqueante, espera a que acabe)
  3. Importa el Excel a Supabase
  4. Ejecuta enrich_google.py (website scraping + Brave API si hay clave)
  5. Comprueba el conteo de emails en BD
  6. Si < TARGET: calcula segundos hasta 4:00am de manana, duerme, vuelve a 2
  7. Si >= TARGET o 0 nuevos: avisa y termina

Brave API (opcional, gratis):
  Registrate en https://brave.com/search/api/ (2000 busquedas/mes gratis)
  Luego setea: $env:BRAVE_API_KEY = "tu-clave-aqui"
  O añade al archivo .env en esta carpeta: BRAVE_API_KEY=tu-clave-aqui

Lanzar una sola vez:
    python -u refill_autoloop.py >> refill_autoloop.log 2>&1
"""
import os
import sys
import time
import subprocess
import requests
from datetime import datetime, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ─── CONFIG ───────────────────────────────────────────────────────────────────
TARGET      = 999_999  # sin limite real — para cuando no queden mas emails que encontrar
DIR         = os.path.dirname(os.path.abspath(__file__))
REFILL_PY   = os.path.join(DIR, "refill_patient.py")
IMPORT_PY   = os.path.join(DIR, "import_to_supabase.py")
ENRICH_PY   = os.path.join(DIR, "enrich_google.py")
LOCK_FILE   = os.path.join(DIR, ".refill_running.lock")
LOG_PREFIX  = os.path.join(DIR, "refill_patient_run")
ENV_FILE    = os.path.join(DIR, ".env")

# Cargar .env si existe (para BRAVE_API_KEY)
def load_dotenv():
    if not os.path.exists(ENV_FILE):
        return
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            k = k.strip(); v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v

load_dotenv()

SUPABASE_URL = "https://mcjmguvkcseyfhsyvdhd.supabase.co"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jam1ndXZrY3NleWZoc3l2ZGhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MjczNCwiZXhwIjoyMDkwNjQ4NzM0fQ.1nBVmV2tQQyOj9EzER1UEXHEv2C-oIND_ItZIrNpcQs"

WAKEUP_HOUR = 4   # hora local a la que lanzar el siguiente run


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def count_emails_in_db() -> int:
    try:
        h = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}",
             "Prefer": "count=exact"}
        r = requests.get(
            SUPABASE_URL + "/rest/v1/marketing_clubs?email=not.is.null&select=id&limit=1",
            headers=h, timeout=15)
        return int(r.headers.get("content-range", "0/0").split("/")[-1])
    except Exception as e:
        log(f"[WARN] No pude contar emails: {e}")
        return 0


def is_refill_running() -> bool:
    """True si hay un proceso python ejecutando refill_patient.py."""
    try:
        result = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq python.exe", "/FO", "CSV"],
            capture_output=True, text=True, timeout=10
        )
        # Buscamos en el LOCK FILE por si el proceso esta en otra shell
        if os.path.exists(LOCK_FILE):
            try:
                pid = int(open(LOCK_FILE).read().strip())
                # Verificar si ese PID sigue vivo
                result2 = subprocess.run(
                    ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV"],
                    capture_output=True, text=True, timeout=5
                )
                if str(pid) in result2.stdout:
                    return True
                # El proceso murio pero no borró el lock - limpiar
                os.remove(LOCK_FILE)
            except Exception:
                try: os.remove(LOCK_FILE)
                except: pass
        return False
    except Exception:
        return False


def wait_until_refill_done():
    """Si hay un run activo, espera a que termine comprobando el lock file."""
    if not is_refill_running():
        return
    log("Detectado run activo de refill_patient.py. Esperando a que termine...")
    while is_refill_running():
        time.sleep(60)
        log("  ... aun corriendo, recomprobando en 60s")
    log("Run anterior terminado.")


def run_refill(run_num: int) -> bool:
    """Lanza refill_patient.py y espera a que termine. Retorna True si OK."""
    log_file = f"{LOG_PREFIX}{run_num}.log"
    log(f"--- INICIANDO RUN #{run_num} -> {log_file}")

    # Escribir lock con nuestro PID futuro
    # (lo escribimos antes del Popen para que la deteccion funcione)
    proc = subprocess.Popen(
        [sys.executable, "-u", REFILL_PY],
        stdout=open(log_file, "w", encoding="utf-8", errors="replace"),
        stderr=subprocess.STDOUT,
        cwd=DIR
    )
    # Guardar PID en lock
    with open(LOCK_FILE, "w") as f:
        f.write(str(proc.pid))

    log(f"refill_patient.py corriendo (PID {proc.pid}), esperando...")
    proc.wait()  # bloqueante - espera hasta que termine

    # Borrar lock
    try: os.remove(LOCK_FILE)
    except: pass

    if proc.returncode == 0:
        log(f"Run #{run_num} completado (exit 0)")
        return True
    else:
        log(f"[WARN] Run #{run_num} exit code {proc.returncode} - puede que haya errores parciales")
        return True  # aun asi intentar importar lo que haya


def run_import() -> int:
    """Ejecuta import_to_supabase.py y devuelve nuevos importados."""
    log("Ejecutando import_to_supabase.py...")
    result = subprocess.run(
        [sys.executable, "-u", IMPORT_PY],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        cwd=DIR, timeout=300
    )
    if result.stdout:
        for line in result.stdout.strip().splitlines()[-8:]:
            log(f"  import> {line}")
    if result.returncode != 0 and result.stderr:
        log(f"  [import ERROR] {result.stderr[:300]}")
    return 0


def run_enrich(brave_key: str) -> int:
    """
    Ejecuta enrich_google.py (website scraping + Brave API si hay clave).
    Devuelve emails encontrados en esta ejecucion.
    """
    enrich_log = os.path.join(DIR, "enrich_google.log")
    brave_mode = "COMPLETO (Brave API)" if brave_key else "WEBSITES ONLY"
    log(f"Ejecutando enrich_google.py [{brave_mode}]...")

    env = os.environ.copy()
    if brave_key:
        env["BRAVE_API_KEY"] = brave_key

    # Timeout corto (20 min): el enrich web se cuelga en webs que no responden y
    # antes el timeout de 2h mataba al autoloop entero. Si caduca, lo saltamos y
    # el siguiente ciclo lo intenta otra vez — NO bloqueamos el resto del scraper.
    try:
        with open(enrich_log, "a", encoding="utf-8", errors="replace") as lf:
            del lf  # solo aseguramos que el log exista; el resultado va a capture_output
            result = subprocess.run(
                [sys.executable, "-u", ENRICH_PY],
                capture_output=True, text=True, encoding="utf-8", errors="replace",
                cwd=DIR, timeout=1200, env=env
            )
    except subprocess.TimeoutExpired:
        log("  [enrich TIMEOUT] 20min agotados — salto enrich este ciclo y sigo")
        return 0
    except Exception as e:
        log(f"  [enrich CRASH] {str(e)[:200]} — salto y sigo")
        return 0
    if result.stdout:
        lines = result.stdout.strip().splitlines()
        for line in lines[-12:]:
            log(f"  enrich> {line}")
        for line in reversed(lines):
            if "emails este run:" in line:
                try:
                    return int(line.split("+")[-1].strip())
                except Exception:
                    pass
    if result.returncode != 0 and result.stderr:
        log(f"  [enrich ERROR] {result.stderr[:300]}")
    return 0


def seconds_until_next_4am() -> float:
    """Segundos hasta las 4:00am del dia siguiente."""
    now = datetime.now()
    next_run = now.replace(hour=WAKEUP_HOUR, minute=0, second=0, microsecond=0)
    if now.hour >= WAKEUP_HOUR:
        next_run += timedelta(days=1)
    secs = (next_run - now).total_seconds()
    return max(secs, 60)  # minimo 1 minuto


def main():
    log(f"{'='*60}")
    log(f"AUTOLOOP iniciado. Objetivo: {TARGET:,} emails en BD")
    log(f"{'='*60}")

    # Comprobar estado inicial
    current = count_emails_in_db()
    log(f"Emails en BD ahora: {current:,} / {TARGET:,}")

    if current >= TARGET:
        log(f"OBJETIVO YA ALCANZADO ({current:,}). Nada que hacer.")
        return

    # Esperar al run activo si hay uno
    wait_until_refill_done()

    brave_key = os.environ.get("BRAVE_API_KEY", "")
    if brave_key:
        log(f"Brave Search API: CONFIGURADA ({brave_key[:8]}...)")
    else:
        log("Brave Search API: NO configurada (solo PNFG + website scraping)")
        log("  -> Para activar busqueda web gratuita:")
        log("     1. Registrate en https://brave.com/search/api/")
        log("     2. Crea un archivo .env en esta carpeta con: BRAVE_API_KEY=tu_clave")

    run_num = 1
    zero_streak = 0
    MAX_ZERO_STREAK = 4         # parar solo tras 4 ciclos seguidos sin emails nuevos
    PAUSE_BETWEEN_CYCLES = 180  # 24/7: pausa corta entre ciclos (NO dormir hasta las 4am)
    while True:
        log(f"\n{'='*60}")
        log(f"RUN #{run_num} — emails actuales: {current:,} / objetivo 80-90% de 11.560")
        log(f"{'='*60}")

        count_antes = current

        # 1. Refill PNFG
        run_refill(run_num)

        # 2. Import a BD
        run_import()

        # 3. Enriquecimiento web (website scraping + Brave API si hay clave)
        run_enrich(brave_key)

        # 4. Contar total nuevos este run
        nuevo_count = count_emails_in_db()
        nuevos_este_run = nuevo_count - count_antes
        current = nuevo_count
        pct = current / 11560 * 100
        log(f"Emails en BD tras run #{run_num}: {current:,}  (+{nuevos_este_run:,} nuevos | {pct:.1f}% de 11.560)")

        if current >= TARGET:
            log(f"\nOBJETIVO ALCANZADO: {current:,} emails ({pct:.1f}%). Autoloop terminado.")
            break

        # 24/7: tolerar ciclos vacíos (los dominios se enfrían entre vueltas y el
        # siguiente ciclo puede recuperar más). Solo parar tras MAX_ZERO_STREAK seguidos.
        if nuevos_este_run == 0:
            zero_streak += 1
            log(f"\nRun #{run_num} sin emails nuevos (racha {zero_streak}/{MAX_ZERO_STREAK}).")
            if zero_streak >= MAX_ZERO_STREAK:
                log(f"MAXIMO ALCANZADO: {current:,} emails ({pct:.1f}%). {MAX_ZERO_STREAK} ciclos seguidos sin novedad — paro.")
                if not brave_key and pct < 80:
                    log("Para ampliar el universo: configura BRAVE_API_KEY (gratis, https://brave.com/search/api/) en docs/marketing/.env")
                break
        else:
            zero_streak = 0   # hubo progreso: resetear la racha

        log(f"Pausa {PAUSE_BETWEEN_CYCLES}s y siguiente ciclo (24/7)...")
        time.sleep(PAUSE_BETWEEN_CYCLES)
        run_num += 1


if __name__ == "__main__":
    main()
