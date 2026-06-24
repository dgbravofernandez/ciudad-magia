"""Cobertura actual por hoja: total clubes / con email / sin email / % """
import sys, openpyxl
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
RUTA = r"C:\Users\dgbra\Ciudad Magia\docs\marketing\Seguimiento-Clubes-Multi-Federacion.xlsx"
wb = openpyxl.load_workbook(RUTA, read_only=True, data_only=True)
print(f"{'HOJA':<26}{'TOTAL':>7}{'EMAIL':>7}{'VACIO':>7}{'%':>6}")
print("-"*53)
gt=ge=0
for sn in wb.sheetnames:
    ws = wb[sn]
    rows = ws.iter_rows(values_only=True)
    next(rows, None)
    tot=em=0
    for row in rows:
        if not row or not row[0] or str(row[0]).strip() in ('-','None'): continue
        tot+=1
        e = row[3] if len(row)>3 else None
        if e and '@' in str(e): em+=1
    if tot==0: continue
    gt+=tot; ge+=em
    pct = em/tot*100 if tot else 0
    print(f"{sn:<26}{tot:>7}{em:>7}{tot-em:>7}{pct:>5.0f}%")
print("-"*53)
print(f"{'TOTAL':<26}{gt:>7}{ge:>7}{gt-ge:>7}{ge/gt*100 if gt else 0:>5.0f}%")
wb.close()
