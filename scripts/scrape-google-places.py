"""
Scraper de clubes amateur via Google Places API (Text Search + Place Details).

USO:
  1. Crea API key en https://console.cloud.google.com (Places API New habilitada).
     Coste: $0.017 por Place Details (primeros $200/mes gratis). Para 5000 clubes ≈ 85$.
  2. export GOOGLE_PLACES_API_KEY=AIzaXXXXX
  3. python scripts/scrape-google-places.py

PROVINCIAS ESPAÑA: el script itera por las 50 provincias buscando "club futbol [provincia]"
y de cada resultado pide details (web + telefono). Email no devuelve Places API; se busca
en la web del club via regex después (un fetch por club que tenga web).

OUTPUT:
  data/google-places-clubs.json - JSON con {name, location, web, phone, email}
  data/google-places-import.json - ya formateado para upsert a marketing_clubs
"""
import os
import sys
import json
import time
import requests
import re
from urllib.parse import quote_plus

API_KEY = os.environ.get('GOOGLE_PLACES_API_KEY')
if not API_KEY:
    print('ERROR: define GOOGLE_PLACES_API_KEY')
    sys.exit(1)

PROVINCIAS = [
    'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia',
    'Palma', 'Las Palmas', 'Bilbao', 'Alicante', 'Córdoba', 'Valladolid', 'Vigo',
    'Gijón', 'A Coruña', 'Granada', 'Vitoria', 'Elche', 'Oviedo', 'Pamplona',
    'Cartagena', 'Almería', 'Castellón', 'Burgos', 'Santander', 'Logroño', 'Badajoz',
    'Salamanca', 'Huelva', 'Lleida', 'Tarragona', 'León', 'Cádiz', 'Lugo', 'Ourense',
    'Toledo', 'Albacete', 'Ciudad Real', 'Cuenca', 'Guadalajara', 'Jaén', 'Cáceres',
    'Pontevedra', 'Mérida', 'Soria', 'Segovia', 'Teruel', 'Huesca', 'Ávila',
]

def search_text(query):
    """Text Search New API."""
    url = 'https://places.googleapis.com/v1/places:searchText'
    headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.id,places.websiteUri,places.internationalPhoneNumber',
    }
    body = {'textQuery': query, 'pageSize': 20, 'languageCode': 'es', 'regionCode': 'ES'}
    r = requests.post(url, headers=headers, json=body, timeout=15)
    if not r.ok: return []
    return r.json().get('places', [])

def email_from_website(url):
    """Busca email en la home del club (regex)."""
    try:
        r = requests.get(url, timeout=8, headers={'User-Agent': 'Mozilla/5.0'})
        # Buscar emails (excluir falsos positivos comunes)
        emails = set(re.findall(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', r.text))
        emails = {e for e in emails if not any(b in e.lower() for b in [
            'sentry', 'wixsupport', 'wix.com', 'example', 'gmail.com/', 'googleapis',
        ])}
        return next(iter(emails), None)
    except Exception:
        return None

def main():
    results = []
    seen = set()
    for i, prov in enumerate(PROVINCIAS, 1):
        for query in [
            f'club futbol amateur {prov}',
            f'escuela futbol base {prov}',
            f'CD futbol {prov}',
        ]:
            places = search_text(query)
            for p in places:
                pid = p.get('id')
                if pid in seen: continue
                seen.add(pid)
                name = p.get('displayName', {}).get('text', '').strip()
                if not name: continue
                results.append({
                    'name': name,
                    'address': p.get('formattedAddress'),
                    'web': p.get('websiteUri'),
                    'phone': p.get('internationalPhoneNumber'),
                    'province': prov,
                })
            time.sleep(0.3)
        print(f'  [{i}/{len(PROVINCIAS)}] {prov}: {len(results)} total')

    # Enriquecer con email desde web
    print(f'\nBuscando emails en webs de {len(results)} clubes...')
    for j, club in enumerate(results, 1):
        if club.get('web'):
            club['email'] = email_from_website(club['web'])
        if j % 50 == 0:
            print(f'  Email lookup: {j}/{len(results)}, con email: {sum(1 for c in results if c.get("email"))}')

    # Guardar
    out = 'data/google-places-clubs.json'
    os.makedirs('data', exist_ok=True)
    json.dump(results, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'\nGUARDADO: {out}')
    print(f'  Total clubs encontrados: {len(results)}')
    print(f'  Con web: {sum(1 for c in results if c.get("web"))}')
    print(f'  Con email: {sum(1 for c in results if c.get("email"))}')
    print(f'  Con telefono: {sum(1 for c in results if c.get("phone"))}')

if __name__ == '__main__':
    main()
