"""
refill_patient.py  v2.0 — PNFG scraper mejorado
Mejoras vs v1:
  - 20+ User-Agents modernos (Chrome/Firefox/Edge/Safari 2024-2025)
  - Headers completos de navegador real (Sec-Fetch-*, Sec-CH-UA, etc.)
  - Session warm-up: visita homepage antes del listing (cookies + anti-bot)
  - CB_SLEEP adaptativo: crece exponencialmente (10→15→20→25 min) no fijo
  - Jitter aleatorio ±30% en todos los sleeps para evitar patrones detectables
  - Retry en errores de red/timeout, no solo en respuesta vacía
  - parse_email mejorado: busca mailto: links + texto completo además de h5
  - Rotate UA cada 20 fichas (antes 30)
  - Skip automático de federaciones ya 100% cubiertas
  - Blacklist de emails ampliada
"""
import os, re, sys, time, random, unicodedata, socket
from urllib.parse import urlparse, urljoin

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import openpyxl, requests
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(__file__))
from scraper_federaciones import (
    FEDERACIONES, COL_CLUB, COL_EMAIL, COL_TEL,
    atomic_save,
)

COL_WEB   = 3
RUTA      = r"C:\Users\dgbra\Ciudad Magia\docs\marketing\Seguimiento-Clubes-Multi-Federacion.xlsx"

# ─── TIEMPOS BASE (se aplica jitter ±30% sobre todos) ────────────────────────
# v2.2: SLEEP_FICHA 4s→5.5s (4s era demasiado agresivo, bloqueaba IPs),
#        CB_THRESHOLD 8→10 (menos trigger-happy), early-exit tras 80 fichas
SLEEP_FICHA    = 5.5   # 4s → IP block. 7s → demasiado lento. 5.5s equilibrio.
SLEEP_PAGE     = 6.0
SLEEP_FED      = 12.0
SLEEP_RETRY_Q  = 1200.0
SAVE_EVERY     = 10

def jitter(base: float, pct: float = 0.25) -> float:
    """Aplica ±pct de variación aleatoria para evitar patrones detectables."""
    return base * random.uniform(1 - pct, 1 + pct)

# CIRCUIT BREAKER
CB_THRESHOLD   = 10    # 8 disparaba demasiado rápido cuando server lento
CB_MAX_TRIPS   = 6

def cb_sleep_time(trips: int) -> float:
    """Sleep adaptativo: 8→12→18→25→35→45 min."""
    bases = [480, 720, 1080, 1500, 2100, 2700]
    return float(bases[min(trips - 1, len(bases) - 1)])

ROTATE_EVERY   = 20   # rotar UA cada 20 fichas

# Federaciones objetivo (baja cobertura)
TARGET_FEDS = {
    "FVF Euskadi",
    "RFAF Andalucia",
    "FFCM Castilla LM",
    "FEXF Extremadura",
    "IFCF Canarias",
    "FAF Aragon",
    "FFRM Murcia",
    "FFIB Baleares",
    "FNF Navarra",
    "FFPA Asturias",
    "FCYLF Castilla Leon",
    "FCF Cantabria",
    "FGF Galicia",
    "FRF La Rioja",
    "RFMF Melilla",
}

# ─── USER AGENTS modernos 2024-2025 ──────────────────────────────────────────
USER_AGENTS = [
    # Chrome Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    # Chrome Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    # Firefox Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    # Firefox Mac/Linux
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
    # Edge Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
    # Safari Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
    # Safari iPhone
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    # Opera
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/111.0.0.0",
    # Chrome Android
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    # Brave
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Brave/126",
    # Older but common
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
]

EMAIL_RE = re.compile(r"[\w.\-+]+@[\w.\-]+\.[a-z]{2,}", re.I)
EMAIL_BLACKLIST = {
    "contacto@ffcm.es", "info@rfaf.es", "info@rfef.es",
    "info@ffrm.es", "info@futgal.es", "contacto@rfcylf.es",
    "info@asturfutbol.es", "info@futnavarra.es", "info@ffib.es",
    "info@federacioncanariafutbol.es", "contacto@fexfutbol.es",
    "info@futbolaragon.com", "contact@example.com", "noreply@example.com",
    "club@ejemplo.es",
}


class AbortFederation(Exception):
    pass


def norm(s):
    if not s: return ""
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'\s+', ' ', re.sub(r'[.,;:"\'\(\)\[\]/\\]+', ' ', s.lower())).strip()


def norm_words(s):
    STOP = {'cd','sd','ad','ud','ed','cf','sc','ac','fc','fs','rcd','rcf',
            'club','sociedad','asociacion','deportivo','deportiva','futbol',
            'sala','de','del','la','las','el','los','union','agrupacion','ce','ec',
            'at','atletico'}
    return {w for w in norm(s).split() if w and w not in STOP and len(w) >= 3}


def build_headers(ua: str, referer: str = "") -> dict:
    """Construye headers completos que imitan un navegador real."""
    is_firefox = "Firefox" in ua
    is_safari = "Safari" in ua and "Chrome" not in ua

    h = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=0",
    }
    if referer:
        h["Referer"] = referer

    if not is_firefox and not is_safari:
        # Headers Chromium
        h["Sec-Fetch-Dest"] = "document"
        h["Sec-Fetch-Mode"] = "navigate"
        h["Sec-Fetch-Site"] = "same-origin" if referer else "none"
        h["Sec-Fetch-User"] = "?1"
        h["Sec-CH-UA"] = '"Chromium";v="126", "Not/A)Brand";v="8"'
        h["Sec-CH-UA-Mobile"] = "?0"
        h["Sec-CH-UA-Platform"] = '"Windows"'
    return h


def make_fresh_session(base_url: str, ua_idx: int = 0) -> requests.Session:
    """
    Crea sesión con warm-up real: visita homepage primero, luego la URL base.
    Esto inicializa cookies anti-bot correctamente.
    """
    ua = USER_AGENTS[ua_idx % len(USER_AGENTS)]
    s = requests.Session()
    s.headers.update(build_headers(ua))

    # Warm-up 1: visita homepage del dominio
    parsed = urlparse(base_url)
    homepage = f"{parsed.scheme}://{parsed.netloc}/"
    try:
        s.get(homepage, timeout=20)
        time.sleep(jitter(1.5))
    except Exception:
        pass

    # Warm-up 2: visita la URL base (listing principal)
    try:
        s.headers.update(build_headers(ua, referer=homepage))
        s.get(base_url, timeout=20)
        time.sleep(jitter(1.0))
    except Exception:
        pass

    return s


def get_soup_with_retry(url: str, session: requests.Session,
                        retries: int = 3, timeout: int = 25) -> BeautifulSoup | None:
    """
    GET con retry en errores de red/timeout (no solo en respuesta vacía).
    """
    last_err = None
    for attempt in range(retries):
        try:
            if attempt > 0:
                time.sleep(jitter(5.0 * attempt))  # backoff entre reintentos
            r = session.get(url, timeout=timeout)
            r.raise_for_status()
            r.encoding = r.apparent_encoding
            if len(r.text) >= 500:
                return BeautifulSoup(r.text, "html.parser")
            # Respuesta demasiado corta = posible bloqueo
            if attempt < retries - 1:
                time.sleep(jitter(10.0))
        except (requests.exceptions.Timeout,
                requests.exceptions.ConnectionError) as e:
            last_err = e
            # Retry en errores de red
        except requests.exceptions.HTTPError as e:
            last_err = e
            if hasattr(e, 'response') and e.response is not None:
                if e.response.status_code in (429, 503):
                    # Rate limit o servicio no disponible — esperar más
                    time.sleep(jitter(30.0 * (attempt + 1)))
            break  # otros errores HTTP no tienen retry
        except Exception as e:
            last_err = e
            break
    return None


def parse_email_enhanced(soup: BeautifulSoup) -> str:
    """
    Búsqueda de email mejorada:
      1. h5 > strong con label "email" (patrón PNFG estándar)
      2. Links mailto:
      3. Regex en todo el texto visible de la página
    """
    if not soup:
        return ""

    # 1. Patrón PNFG estándar: <h5><strong>Email:</strong> xxx@xxx.es</h5>
    for h5 in soup.find_all("h5"):
        strong = h5.find("strong")
        if strong and "email" in strong.get_text(strip=True).lower():
            text = h5.get_text(separator=" ", strip=True)
            m = EMAIL_RE.search(text)
            if m:
                return m.group(0).strip().lower()

    # 2. Links mailto: en la página
    for a in soup.find_all("a", href=re.compile(r"^mailto:", re.I)):
        href = a.get("href", "")
        m = EMAIL_RE.search(href)
        if m:
            return m.group(0).strip().lower()

    # 3. Regex en todo el texto visible
    page_text = soup.get_text(separator=" ")
    candidates = EMAIL_RE.findall(page_text)
    for email in candidates:
        email = email.strip().lower()
        # Filtrar emails de sistema/librerías
        if any(bad in email for bad in ['wixpress', 'wordpress', 'example',
                                         'sentry', 'jquery', '.png', '.jpg',
                                         '.gif', '.css', '.js']):
            continue
        if len(email) > 6 and '.' in email.split('@')[-1]:
            return email

    return ""


def parse_phone_enhanced(soup: BeautifulSoup) -> str:
    """Parse teléfono con patrón estándar PNFG."""
    if not soup:
        return ""
    for h5 in soup.find_all("h5"):
        strong = h5.find("strong")
        if not strong:
            continue
        label = strong.get_text(strip=True).lower()
        if re.search(r"tel|tfno|telf|movil|m[oó]vil|phone|fax", label):
            text = h5.get_text(separator=" ", strip=True)
            m = re.search(r"(\+?[\d][\d\s\-\.]{6,})", text)
            if m:
                return re.sub(r"\s+", " ", m.group(1)).strip()
    return ""


def build_mapping_with_retry(fed: dict, session: requests.Session):
    """Build club→ref mapping, retry hasta 4 veces con pausa si está vacío."""
    for attempt in range(4):
        if attempt > 0:
            print(f"  [map retry #{attempt}] Pausa {120 * attempt}s antes de reintentar listing...")
            time.sleep(jitter(120.0 * attempt))
            session = make_fresh_session(
                fed["list_url"] + f"?cod_primaria={fed['cod_primaria']}",
                attempt
            )

        pairs = []
        page = 1
        while True:
            url = (f"{fed['list_url']}?cod_primaria={fed['cod_primaria']}"
                   f"&NPcd_PageLines=999&NPcd_Page={page}&Buscar=1")
            soup = get_soup_with_retry(url, session)
            if not soup:
                break
            found = 0
            if fed["tipo"] == "A":
                for a in soup.find_all("a", href=re.compile(r"javascript:Ver\(\d+\)", re.I)):
                    nombre = a.get_text(strip=True)
                    m = re.search(r"Ver\((\d+)\)", a["href"], re.I)
                    if nombre and m:
                        pairs.append((nombre, m.group(1)))
                        found += 1
            else:
                for a in soup.find_all("a", href=re.compile(r"NFG_VisEquipos", re.I)):
                    nombre = a.get_text(strip=True)
                    href = a.get("href", "")
                    if nombre and href:
                        if not href.startswith("http"):
                            href = fed.get("base_domain", "") + href
                        pairs.append((nombre, href))
                        found += 1
            print(f"  [map] pagina {page}: {found} clubes")
            if found == 0:
                break
            page += 1
            time.sleep(jitter(SLEEP_PAGE))

        if pairs:
            return pairs, session
    return [], session


class FuzzyMatcher:
    def __init__(self, pairs):
        self.exact = {}
        self.full = []
        for nombre, ref in pairs:
            n = norm(nombre)
            self.exact.setdefault(n, ref)
            self.full.append((n, norm_words(nombre), ref))

    def find(self, query):
        q = norm(query)
        if not q: return (None, 'none')
        if q in self.exact: return (self.exact[q], 'exact')
        if len(q) >= 8:
            for n, _, ref in self.full:
                if q in n or n in q:
                    return (ref, 'contains')
        qw = norm_words(query)
        if len(qw) >= 2:
            best_ref, best_score = None, 0
            for _, nw, ref in self.full:
                if not nw: continue
                inter = len(qw & nw)
                if inter >= 2:
                    score = inter / len(qw | nw)
                    if score > best_score and score >= 0.5:
                        best_score = score
                        best_ref = ref
            if best_ref: return (best_ref, 'overlap')
        return (None, 'none')


def refill_fed(fed: dict, wb, ws) -> dict:
    print(f"\n{'='*70}")
    print(f">> {fed['hoja']}  (tipo {fed['tipo']})")
    print(f"{'='*70}")

    rows_sin: list[tuple[int, str, str]] = []
    for r in range(2, ws.max_row + 1):
        nombre = ws.cell(row=r, column=COL_CLUB).value
        email  = ws.cell(row=r, column=COL_EMAIL).value
        web    = ws.cell(row=r, column=COL_WEB).value
        if not nombre: continue
        n = str(nombre).strip()
        if not n or n in ('-', 'None'): continue
        e = str(email).strip() if email else ""
        if e in ("", "-", "None", "club@ejemplo.es"):
            w = str(web).strip() if web else ""
            if w in ("", "-", "None"): w = ""
            rows_sin.append((r, n, w))

    if not rows_sin:
        print(f"  Sin filas que rellenar — federacion ya completa.")
        return {'encontrados': 0}

    total_filas = ws.max_row - 1
    cobertura = (total_filas - len(rows_sin)) / total_filas * 100 if total_filas > 0 else 0
    print(f"  Filas SIN email: {len(rows_sin)} / {total_filas}  (cobertura actual: {cobertura:.0f}%)")

    base_url = fed["list_url"] + f"?cod_primaria={fed['cod_primaria']}"
    print(f"  Inicializando sesion con warm-up...")
    session = make_fresh_session(base_url, ua_idx=0)

    print(f"  Construyendo mapping desde {fed['list_url']}...")
    pairs, session = build_mapping_with_retry(fed, session)
    print(f"  Mapping construido: {len(pairs)} entradas")
    if not pairs:
        print(f"  [SKIP] Mapping vacio tras 4 intentos. Servidor bloqueado activamente.")
        return {'encontrados': 0}

    matcher = FuzzyMatcher(pairs)
    stats = {'exact': 0, 'fuzzy': 0, 'sin': 0}
    total = 0
    since_save = 0
    retry_q: list[tuple[int, str, str, str]] = []
    cb = {
        'empties': 0, 'trips': 0, 'session': session,
        'ua': 0, 'done': 0
    }

    def fetch_ficha(row_idx: int, nombre: str, website: str, ref: str, modo: str) -> bool:
        nonlocal total, since_save
        if fed["tipo"] == "A":
            url = (f"{fed['ficha_url']}?cod_primaria={fed['cod_primaria']}"
                   f"&codigo_club={ref}")
        else:
            url = ref
        time.sleep(jitter(SLEEP_FICHA))
        soup = get_soup_with_retry(url, cb['session'])
        cb['done'] += 1

        if soup is None:
            cb['empties'] += 1
            if cb['empties'] >= CB_THRESHOLD:
                cb['trips'] += 1
                if cb['trips'] > CB_MAX_TRIPS:
                    print(f"  [CB] {cb['trips']} trips alcanzados. Abortando federacion.")
                    raise AbortFederation()
                sleep_s = cb_sleep_time(cb['trips'])
                print(f"  [CB #{cb['trips']}] {CB_THRESHOLD} vacios consecutivos. "
                      f"Pausa {sleep_s/60:.0f} min + UA nuevo...")
                time.sleep(sleep_s)
                cb['ua'] += 1
                cb['session'] = make_fresh_session(base_url, cb['ua'])
                cb['empties'] = 0
            return False

        cb['empties'] = 0
        # Rotar UA cada ROTATE_EVERY fichas exitosas
        if cb['done'] % ROTATE_EVERY == 0:
            cb['ua'] += 1
            cb['session'] = make_fresh_session(base_url, cb['ua'])

        email = parse_email_enhanced(soup)
        phone = parse_phone_enhanced(soup)
        if email and email.lower() in EMAIL_BLACKLIST:
            email = ""
        updated = False
        if email:
            ws.cell(row=row_idx, column=COL_EMAIL).value = email
            stats['exact' if modo == 'exact' else 'fuzzy'] += 1
            updated = True
        if phone:
            ws.cell(row=row_idx, column=COL_TEL).value = phone
            updated = True
        if updated:
            total += 1
            since_save += 1
        hits = stats['exact'] + stats['fuzzy']
        # Mostrar progreso solo cuando hay resultado o cada 10 fichas
        if updated or cb['done'] % 10 == 0:
            rate_pct = hits / cb['done'] * 100 if cb['done'] > 0 else 0
            print(f"  [{cb['done']}/{len(rows_sin)}] [{modo}] {nombre[:34]:<34} "
                  f"email: {email or '-':<26} tel: {phone or '-'}"
                  f"  (hit rate: {rate_pct:.1f}%)")
        # Early-exit: si tras 80 fichas el hit rate < 3%, esta federación no tiene datos útiles
        if cb['done'] == 80:
            rate = hits / cb['done']
            if rate < 0.03:
                print(f"  [EARLY-EXIT] Hit rate {rate*100:.1f}% tras 80 fichas — "
                      f"la federación no expone emails. Abortando.")
                raise AbortFederation()
        if since_save >= SAVE_EVERY:
            atomic_save(wb, RUTA)
            since_save = 0
        return bool(email)

    # ── PASE 1 ────────────────────────────────────────────────────────────────
    abort1 = False
    i = -1
    try:
        for i, (row_idx, nombre, website) in enumerate(rows_sin):
            ref, modo = matcher.find(nombre)
            if not ref:
                stats['sin'] += 1
                retry_q.append((row_idx, nombre, website, ''))
                continue
            ok = fetch_ficha(row_idx, nombre, website, ref, modo)
            if not ok:
                retry_q.append((row_idx, nombre, website, ref))
    except AbortFederation:
        abort1 = True
        for j in range(i + 1, len(rows_sin)):
            row_idx, nombre, website = rows_sin[j]
            ref, modo = matcher.find(nombre)
            retry_q.append((row_idx, nombre, website, ref or ''))
            if not ref: stats['sin'] += 1

    atomic_save(wb, RUTA)
    print(f"  -- Pase 1 {'[ABORTADO]' if abort1 else 'OK'}: "
          f"{total} encontrados, {len(retry_q)} en retry_q")

    # ── PASE 2 — solo los que tenian ref ─────────────────────────────────────
    pnfg_retries = [(ri, n, w, r) for ri, n, w, r in retry_q if r]
    web_only     = [(ri, n, w)   for ri, n, w, r in retry_q if not r]

    if pnfg_retries:
        print(f"\n  [PASE 2] Pausa {SLEEP_RETRY_Q/60:.0f} min antes de reintentar "
              f"{len(pnfg_retries)} fichas...")
        time.sleep(jitter(SLEEP_RETRY_Q))
        cb['ua'] += 1
        cb['session'] = make_fresh_session(base_url, cb['ua'])
        cb['empties'] = 0
        cb['trips'] = 0
        try:
            for row_idx, nombre, website, ref in pnfg_retries:
                ok = fetch_ficha(row_idx, nombre, website, ref, 'retry')
                if not ok:
                    web_only.append((row_idx, nombre, website))
        except AbortFederation:
            print(f"  [CB] Pase 2 abortado.")
        atomic_save(wb, RUTA)
        print(f"  -- Pase 2 OK: total {total} encontrados")

    # ── PASE 3 — website fallback ─────────────────────────────────────────────
    web_cands = [(ri, n, w) for ri, n, w in web_only if w]
    if web_cands:
        print(f"\n  [PASE 3] Website fallback en {len(web_cands)} clubes...")
        ua = USER_AGENTS[cb['ua'] % len(USER_AGENTS)]
        web_headers = build_headers(ua)
        for row_idx, nombre, website in web_cands:
            time.sleep(jitter(2.0))
            try:
                url = ('https://' + website
                       if not website.startswith('http') else website)
                r = requests.get(url, headers=web_headers,
                                 timeout=12, allow_redirects=True)
                if r.status_code == 200:
                    r.encoding = r.apparent_encoding
                    soup = BeautifulSoup(r.text, "html.parser")
                    email = parse_email_enhanced(soup)
                    if email and email not in EMAIL_BLACKLIST:
                        ws.cell(row=row_idx, column=COL_EMAIL).value = email
                        total += 1
                        print(f"  [web] {nombre[:38]} -> {email}")
            except Exception:
                pass
        atomic_save(wb, RUTA)

    print(f"\n  -- TOTAL {fed['hoja']}: {total} emails nuevos  "
          f"(exact={stats['exact']} fuzzy={stats['fuzzy']} sin_match={stats['sin']})")
    return {'encontrados': total}


# ─── DB CHECK ─────────────────────────────────────────────────────────────────

def check_email_count_in_db() -> int:
    try:
        url = "https://mcjmguvkcseyfhsyvdhd.supabase.co/rest/v1/marketing_clubs"
        key = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI"
               "6Im1jam1ndXZrY3NleWZoc3l2ZGhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI"
               "6MTc3NTA3MjczNCwiZXhwIjoyMDkwNjQ4NzM0fQ.1nBVmV2tQQyOj9EzER1UEXHEv2C"
               "-oIND_ItZIrNpcQs")
        h = {"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "count=exact"}
        r = requests.get(url + "?email=not.is.null&select=id",
                         headers=h, params={"limit": 1}, timeout=10)
        return int(r.headers.get("content-range", "0/0").split("/")[-1])
    except Exception as e:
        print(f"  [DB] Error: {e}")
        return 0


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    # Priorizar por número de clubs sin email (mayor primero)
    priority = {
        "RFAF Andalucia":     2640,
        "FFCM Castilla LM":   1974,
        "FEXF Extremadura":    973,
        "IFCF Canarias":       853,
        "FAF Aragon":          539,
        "FFRM Murcia":         421,
        "FVF Euskadi":         400,
        "FFPA Asturias":       260,
        "FNF Navarra":         274,
        "FFIB Baleares":       225,
        "FCYLF Castilla Leon": 217,
        "FCF Cantabria":       116,
        "FGF Galicia":          41,
        "RFMF Melilla":         41,
        "FRF La Rioja":          5,
    }
    feds_to_run = [f for f in FEDERACIONES if f["hoja"] in TARGET_FEDS]
    feds_to_run.sort(key=lambda f: priority.get(f["hoja"], 0), reverse=True)

    # TCP-level timeout: prevents OS-level hangs where a club website never responds
    # even after the HTTP timeout fires (Windows TCP keepalive can hold connections open)
    socket.setdefaulttimeout(45)

    print(f"Abriendo Excel: {RUTA}")
    wb = openpyxl.load_workbook(RUTA)

    def run_import_now(fed_name: str) -> None:
        """Import Excel → Supabase after each federation so data is safe even if killed."""
        import subprocess
        print(f"\n  [sync] Importando {fed_name} a Supabase...")
        r = subprocess.run(
            [sys.executable, "import_to_supabase.py"],
            capture_output=True, text=True, encoding='utf-8',
            cwd=os.path.dirname(os.path.abspath(__file__)),
            timeout=120,
        )
        # Print last few lines of output (totals)
        if r.stdout:
            for line in r.stdout.strip().splitlines()[-5:]:
                print(f"    {line}")
        if r.returncode != 0 and r.stderr:
            print(f"    [WARN import] {r.stderr[-200:]}")

    total_nuevos = 0
    for fed in feds_to_run:
        ws = wb[fed["hoja"]]

        # Skip si la hoja no existe (Cataluña, etc.)
        if ws is None:
            continue

        # Skip automático si cobertura >= 95%
        total_filas = ws.max_row - 1
        if total_filas > 0:
            sin_email = sum(
                1 for r in range(2, ws.max_row + 1)
                if not (ws.cell(row=r, column=COL_EMAIL).value or "").strip()
                or str(ws.cell(row=r, column=COL_EMAIL).value).strip() in ("-","None","club@ejemplo.es")
            )
            cobertura = (total_filas - sin_email) / total_filas * 100
            if cobertura >= 95.0:
                print(f"\n[SKIP] {fed['hoja']} — cobertura {cobertura:.0f}% >= 95%, ya completa.")
                continue

        result = refill_fed(fed, wb, ws)
        encontrados = result.get('encontrados', 0)
        total_nuevos += encontrados
        # Sync to Supabase immediately after each federation — data safe even if killed
        if encontrados > 0:
            run_import_now(fed["hoja"])
        print(f"\n  Pausa entre federaciones {SLEEP_FED}s...")
        time.sleep(jitter(SLEEP_FED))

    wb.close()

    print(f"\n{'='*70}")
    print(f"TOTAL emails nuevos encontrados en este run: {total_nuevos}")
    print(f"{'='*70}")

    # Importar a BD
    print("\nEjecutando import a Supabase...")
    import subprocess
    result = subprocess.run(
        [sys.executable, "import_to_supabase.py"],
        capture_output=True, text=True, encoding='utf-8',
        cwd=os.path.dirname(os.path.abspath(__file__))
    )
    if result.stdout:
        print(result.stdout[-2000:])
    if result.returncode != 0 and result.stderr:
        print(f"[ERROR import] {result.stderr[-500:]}")

    count = check_email_count_in_db()
    pct = count / 11560 * 100
    print(f"\n>>> EMAILS EN BD AHORA: {count:,} ({pct:.1f}% de 11.560)")
    if pct >= 80:
        print(f">>> OBJETIVO 80% ALCANZADO!")
    else:
        print(f">>> Faltan {int(11560 * 0.8) - count:,} emails para llegar al 80%")
        print(f">>> Relanza esta noche a las 4am: python refill_patient.py")


if __name__ == "__main__":
    main()
