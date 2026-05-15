# Corporativización de Cluberly

Este documento lista todos los cambios necesarios para convertir la app actual en un producto SaaS vendible a cualquier club, bajo la marca **Cluberly**.

---

## 1. Renombrado de marca

### En el código
Buscar y reemplazar todas las ocurrencias de:
- `"Ciudad Magia CRM"` → `"Cluberly"`
- `"Ciudad Magia"` → `"Cluberly"`
- Archivos afectados:
  - `src/app/layout.tsx` — `metadata.title` y `metadata.description`
  - `src/components/sidebar/` — nombre y logo en la barra lateral
  - Cualquier `<title>`, `og:title`, `og:description` en páginas

### Logo
- Reemplazar `public/logo-cdg.png` con `public/logo-cluberly.svg` (nuevo logo)
- Actualizar todas las referencias en código (`<Image src="/logo-cdg.png"...`)
- Crear versiones: color, blanco, negro

### Favicon
- Reemplazar `src/app/favicon.ico` con el nuevo favicon de Cluberly

### Paleta de colores (globals.css)
Los colores actuales son del club de Getafe. Para Cluberly:
```css
--color-primary: #FF6B9D;       /* Rosa */
--color-primary-foreground: #FFFFFF;
--color-secondary: #E0FAF8;     /* Turquesa claro */
--color-secondary-foreground: #007A72;
--color-sidebar: #1A1A2E;       /* Dark navy */
--color-sidebar-foreground: #E2E8F0;
--color-sidebar-active: #FF6B9D; /* Rosa en activo */
```

---

## 2. Hardcodes a eliminar

### Google Drive / Sheets
Buscar en el código las siguientes constantes hardcodeadas y moverlas a `club_settings`:

| Hardcode | Campo en club_settings | Notas |
|---------|----------------------|-------|
| Google Drive folder ID del club | `google_drive_folder_id` | Ya parcialmente en settings |
| Google Form URL de inscripciones | `google_form_inscripciones_url` | Visible para padres |
| Google Sheets ID del club | `google_sheets_id` | Para la sync automática |
| Email remitente (sender) | `email_sender` | Actualmente hardcoded con cuenta específica |

### RFFM (Federación de Fútbol de Madrid)
Los IDs de equipo/competición de la RFFM son específicos del club actual. Moverlos a:
- `tracked_competitions` table — ya parcialmente diseñado para esto
- Panel de configuración en `/configuracion/integraciones` donde el admin pueda buscar y añadir sus competiciones

### Email / Nodemailer
- El email de envío (`dgbravofernandez@gmail.com`) debe ser configurable por club
- Mover a `club_settings.email_config` (ya como JSON)
- Documentar el proceso de configuración para nuevos clubs en el onboarding

### Archivos con hardcodes detectados (buscar con grep)
```bash
grep -r "getafe\|cdg\|ciudad-magia\|dgbravofernandez" src/ --include="*.ts" --include="*.tsx"
```

---

## 3. Onboarding de nuevos clubs

### Flujo actual
Actualmente no existe onboarding automatizado — los clubs se crean manualmente en la base de datos.

### Flujo a implementar

**Página: `/register-club`**
```
Paso 1: Datos del club
  - Nombre del club
  - Ciudad / Comunidad Autónoma
  - Federación regional (dropdown: RFFM, RFEF, RFCF...)
  - Número de equipos aproximado

Paso 2: Datos del administrador
  - Nombre completo
  - Email
  - Contraseña

Paso 3: Confirmación
  - Resumen + aceptar términos
  - Botón "Crear mi club"
```

**Server Action: `createClub()`**
1. Crear registro en `clubs` table
2. Crear `club_settings` con valores por defecto
3. Crear usuario en Supabase Auth
4. Crear `club_members` vinculando usuario al club
5. Asignar rol `admin` en `club_member_roles`
6. Enviar email de bienvenida (ver plantilla en PRESENTACION_VENTAS.md)
7. Redirigir a `/onboarding/paso-1` (wizard de configuración inicial)

**Wizard de onboarding post-registro:**
```
/onboarding/equipos         → Crear categorías y equipos
/onboarding/jugadores       → Importar jugadores desde Excel o añadir manualmente
/onboarding/integraciones   → Opcional: conectar Google, RFFM
/onboarding/completado      → Ir al dashboard
```

---

## 4. Multi-tenant checklist

Verificar que TODAS las queries tienen discriminación por `club_id`. El middleware ya inyecta `x-club-id` en los headers, y las server actions deben usarlo.

### Queries a auditar
- [ ] `jugadores` — todas las queries filtran por `club_id`
- [ ] `teams` — filtran por `club_id`
- [ ] `sessions` y `session_attendance` — filtran por `club_id` vía team
- [ ] `payments` y `expenses` — filtran por `club_id`
- [ ] `email_logs` — filtran por `club_id`
- [ ] `tracked_competitions` — filtran por `club_id`

### RLS (Row Level Security)
Actualmente implementado parcialmente. Para producción multi-tenant real, activar RLS en todas las tablas:
```sql
-- Ejemplo para tabla players
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "club_isolation" ON players
  USING (club_id = (SELECT club_id FROM club_members WHERE user_id = auth.uid() LIMIT 1));
```

### Test de aislamiento
Crear dos clubs de prueba y verificar que no hay cross-contamination de datos entre ellos.

---

## 5. Configuración por club

### Panel `/configuracion/club`
Ampliar con campos:
- Logo del club (upload a Supabase Storage)
- Colores del club (para personalizar la sidebar)
- Federación regional a la que pertenece
- Configuración RFFM (IDs de equipos y competiciones)
- Configuración Google (estado de conexión OAuth)
- Email sender configuración

### Personalización visual por club (opcional, fase 2)
Permitir que cada club tenga su propio color primario en la sidebar:
```ts
// En middleware o layout
const { primary_color } = clubSettings
// Inyectar como CSS variable
```

---

## 6. Instancia demo pública

Para la web de marketing, necesitamos una URL demo accesible sin registro:

### Opción A: Club de demo con datos ficticios (recomendada)
1. Crear un club `demo` en la base de datos con datos ficticios (jugadores, pagos, sesiones inventados)
2. Crear usuario demo con credenciales públicas: `demo@cluberly.es` / `demo123`
3. Publicar en la web: "Prueba en vivo → accede con demo@cluberly.es / demo123"
4. Cron job que resetea los datos demo cada 24h (o usar una instancia de Supabase separada)

### Opción B: Storybook o screenshots animados
Si no quieres exponer la app, crear screenshots/vídeos del tour de la app y embeberlos en la landing.

---

## 7. Dominios personalizados (plan Enterprise, opcional)

Permitir a clubs con plan Enterprise usar `app.suclub.es` en lugar de `cluberly.es/app`:
- Configurar en Vercel: añadir dominio del cliente al proyecto
- Detectar el dominio en el middleware para extraer el `club_id` correspondiente
- Esto requiere que el club compre su propio dominio (~10€/año)

---

## 8. Cambios en base de datos necesarios

```sql
-- Añadir campos a club_settings que faltan
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT;
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS google_form_url TEXT;
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#FF6B9D';
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS federation_region TEXT DEFAULT 'RFFM';
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Tabla de suscripciones (para gestionar plan y pago)
CREATE TABLE IF NOT EXISTS club_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'trial', -- trial | starter | pro | enterprise
  status TEXT NOT NULL DEFAULT 'active', -- active | cancelled | past_due
  started_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  monthly_price INTEGER DEFAULT 100, -- en euros
  implantation_paid BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 9. Términos, privacidad y RGPD

Antes de vender a terceros, es obligatorio:
- [ ] Redactar **Aviso Legal** (razón social, NIF, dirección)
- [ ] Redactar **Política de Privacidad** — especialmente importante porque se tratan datos de menores
- [ ] Redactar **Términos y Condiciones** del servicio SaaS
- [ ] Añadir páginas `/legal`, `/privacidad`, `/terminos` en la app y en la web marketing
- [ ] Añadir banner de cookies (si usas analytics)
- [ ] Considerar DPO (Delegado de Protección de Datos) o al menos un formulario de contacto RGPD

> ⚠️ Los datos de menores de edad requieren atención especial bajo el RGPD y la LOPDGDD española.

---

## 10. Resumen de prioridades de implementación

| Prioridad | Tarea | Estimación |
|-----------|-------|-----------|
| 🔴 Alta | Renombrado de marca (logo, metadata) | 2h |
| 🔴 Alta | Eliminar hardcodes de email y Drive | 4h |
| 🔴 Alta | Crear instancia demo con datos ficticios | 3h |
| 🟡 Media | Página `/register-club` + Server Action | 6h |
| 🟡 Media | Wizard de onboarding post-registro | 8h |
| 🟡 Media | Documentos legales (RGPD) | 4h |
| 🟢 Baja | RLS completo en todas las tablas | 4h |
| 🟢 Baja | Personalización visual por club | 4h |
| 🟢 Baja | Tabla `club_subscriptions` | 2h |
| 🟢 Baja | Dominios personalizados (Enterprise) | 6h |

**Total estimado para lanzar a primeros clientes: ~15-20h de desarrollo**
