"""
hot_leads.py — Lista priorizada de leads CALIENTES para WhatsApp/llamada.

Clubes que han CLICADO un email (interés real) con su teléfono y email, ordenados
por clic más reciente. Es la lista que Diego trabaja a mano cada día (multicanal:
el email abre, el teléfono/WhatsApp cierra).

Uso:  python hot_leads.py            # todos los que clicaron y aún no son cliente
      python hot_leads.py --csv      # exporta hot_leads.csv
"""
import sys, csv
import requests

SUPABASE_URL = "https://mcjmguvkcseyfhsyvdhd.supabase.co"
SERVICE_KEY  = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jam1n"
                "dXZrY3NleWZoc3l2ZGhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MjczNCwiZXhw"
                "IjoyMDkwNjQ4NzM0fQ.1nBVmV2tQQyOj9EzER1UEXHEv2C-oIND_ItZIrNpcQs")
H = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def get(path):
    r = requests.get(SUPABASE_URL + "/rest/v1/" + path, headers=H, timeout=30)
    r.raise_for_status()
    return r.json()


def main():
    # Sends con clic, más recientes primero
    sends = get("marketing_email_sends?clicked_at=not.is.null&select=club_id,clicked_at,opened_at"
                "&order=clicked_at.desc&limit=1000")
    if not sends:
        print("Aún no hay clics registrados.")
        return

    # Dedup por club (un club puede tener varios sends); nos quedamos con el clic más reciente
    seen, club_ids = set(), []
    first_click = {}
    for s in sends:
        cid = s["club_id"]
        if cid not in seen:
            seen.add(cid); club_ids.append(cid)
            first_click[cid] = s["clicked_at"]

    # Datos de los clubes
    ids = ",".join(f'"{c}"' for c in club_ids)
    clubs = get(f"marketing_clubs?id=in.({ids})&select=id,name,email,phone,federation,status")
    by_id = {c["id"]: c for c in clubs}

    rows = []
    for cid in club_ids:
        c = by_id.get(cid)
        if not c:
            continue
        # Excluir los que ya son cliente / baja / rebote
        if c.get("status") in ("unsubscribed", "bounced", "replied"):
            continue
        rows.append({
            "clicado": first_click[cid][:16].replace("T", " "),
            "club": c.get("name", ""),
            "telefono": c.get("phone") or "—",
            "email": c.get("email") or "",
            "federacion": c.get("federation") or "",
        })

    print(f"\n{'='*86}")
    print(f"  LEADS CALIENTES — {len(rows)} clubes clicaron (llámalos / WhatsApp en <24h)")
    print(f"{'='*86}")
    print(f"  {'CLICADO':<17}{'CLUB':<34}{'TELEFONO':<22}EMAIL")
    print(f"  {'-'*84}")
    for r in rows:
        print(f"  {r['clicado']:<17}{r['club'][:32]:<34}{r['telefono'][:20]:<22}{r['email']}")

    con_tel = sum(1 for r in rows if r["telefono"] != "—")
    print(f"\n  {con_tel}/{len(rows)} tienen teléfono → empieza por esos (WhatsApp/llamada).")

    if "--csv" in sys.argv:
        with open("hot_leads.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=["clicado", "club", "telefono", "email", "federacion"])
            w.writeheader(); w.writerows(rows)
        print("  → exportado a hot_leads.csv")


if __name__ == "__main__":
    main()
