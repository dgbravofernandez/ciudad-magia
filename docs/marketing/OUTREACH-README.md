# Outreach Cluberly — instrucciones rápidas

Tres scripts trabajando contra `Seguimiento-Clubes-Cluberly.xlsx`:

```
scripts/scrape-rffm-clubs.cjs       → trae los ~700 clubes RFFM al Excel
scripts/outreach-send.cjs           → envía la secuencia de 3 emails con tu Gmail
scripts/outreach-check-replies.cjs  → marca como "Respondió" quien conteste
```

---

## 1. Configuración inicial (solo una vez, ~10 min)

### 1.1. Activa **2FA en tu cuenta Google**
- https://myaccount.google.com/security
- "Verificación en dos pasos" → activar.

### 1.2. Genera una **App Password** de Gmail
- https://myaccount.google.com/apppasswords
- Nombre: `Cluberly Outreach`
- Copia la contraseña de 16 caracteres (formato `xxxx xxxx xxxx xxxx`).

### 1.3. Activa IMAP en Gmail (para detectar respuestas)
- Gmail → Configuración → "Reenvío y POP/IMAP" → IMAP: habilitado.

### 1.4. Crea `.env.outreach` (NO se commitea, está en .gitignore)
En la raíz del proyecto:

```bash
cp .env.outreach.example .env.outreach
```

Edita con tus valores:
```
GMAIL_USER=tu.email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
FROM_NAME=Diego — Cluberly
```

---

## 2. Flujo de uso típico (semana de outreach)

### Lunes — actualizar la lista (opcional, 1 vez/mes)
```bash
node scripts/scrape-rffm-clubs.cjs
```
Trae los ~700 clubes RFFM Madrid con email/teléfono. Dedup automático: no duplica los que ya tengas.

### Día a día — enviar
**Primero un dry-run** (no envía nada, solo muestra los 5 primeros):
```bash
node scripts/outreach-send.cjs --dry-run
```
Si el contenido es correcto, envío real con cap de 30/día:
```bash
node scripts/outreach-send.cjs
```
O un test pequeño primero:
```bash
node scripts/outreach-send.cjs --max 3
```

El script:
- Envía solo a filas con `Estado ∈ {Nuevo, Email 1, Email 2}` y email válido.
- Hace pausa **30-60s entre envíos** (no quemes Gmail).
- Avanza el estado: `Nuevo` → `Email 1` → `Email 2` → `Email 3`.
- Actualiza fechas y contador en el Excel.
- Guarda el Excel cada 5 envíos (resistente a interrupción).

### Cada 1-2 días — revisar respuestas
```bash
node scripts/outreach-check-replies.cjs
```
- Se conecta a tu Gmail por IMAP.
- Mira los emails no leídos del INBOX.
- Si el emisor está en el Excel con estado `Email 1/2/3`, lo marca **`Respondió`** y deja una nota.
- Marca el email como leído en Gmail (evita procesarlo dos veces).

**Tras detectar respuestas → atiéndelas tú a mano** (agendar demos, mandar dossier, etc.).

---

## 3. Cadencia recomendada por el plan

| Día | Acción | Estado tras enviar |
|-----|--------|---------------------|
| 0   | Email 1 (presentación + CdG) | `Nuevo` → `Email 1` |
| +3  | Email 2 (beneficio concreto) | `Email 1` → `Email 2` |
| +7  | Email 3 (último toque) | `Email 2` → `Email 3` |

El script **automáticamente** salta lo que ya esté en `Email 3`, `Respondió`, `Cliente`, o `Descartado`.

Por ahora, **tú controlas la cadencia** corriendo el script cuando toque (puedes ejecutarlo cada día y solo enviará 30 nuevos, los que estén "Nuevo" o que toque saltar al siguiente toque).

---

## 4. Cosas importantes

- **Cap diario default: 30 emails.** Gmail SMTP sin Workspace tiene un límite de ~500/día pero usar más de 100/día es arriesgado para reputación. 30 es seguro.
- **Si Gmail te bloquea** (mensaje "Daily sending quota exceeded"): espera 24h. Si pasa más de una vez, baja el cap a 15-20/día con `--max 15`.
- **El Excel se actualiza in-place.** Si lo tienes abierto en Excel/Sheets, el script falla con `EBUSY`. **Ciérralo antes de correr el script.**
- **Para deshacer un estado** (p.ej. marcaste `Cliente` por error): edita la celda directamente y guarda el Excel.

---

## 5. Métricas que puedes mirar

En la hoja **`Resumen`** del Excel (fórmulas COUNTIF automáticas):
- Cuántos en cada estado.
- Total contactados, demos agendadas, clientes.
- Tasas de conversión.
- Cuántos te faltan para el objetivo (20 clientes).
