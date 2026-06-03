# Acuerdo de Encargado del Tratamiento (DPA)

> ⚠️ **PLANTILLA — REVISIÓN LEGAL OBLIGATORIA.** Este documento es un punto de partida
> redactado para el contexto de Cluberly (CRM de clubes con datos de menores). **Debe
> revisarlo un abogado especialista en protección de datos antes de usarlo con clientes.**
> No constituye asesoramiento legal.

Conforme al **art. 28 del RGPD** (Reglamento UE 2016/679) y a la **LOPDGDD** (Ley Orgánica 3/2018).

---

## 1. Partes

- **Responsable del tratamiento:** el Club (cliente que contrata Cluberly).
- **Encargado del tratamiento:** [Tu razón social / autónomo], titular de Cluberly (en adelante, "el Proveedor").

El Club decide los fines y medios del tratamiento. El Proveedor trata los datos **únicamente siguiendo las instrucciones documentadas del Club**.

---

## 2. Objeto y naturaleza del tratamiento

El Proveedor presta un servicio SaaS de gestión deportiva que trata datos personales por cuenta del Club para: gestión de socios/jugadores, cuotas y pagos, asistencia, comunicaciones, y documentación federativa.

**Duración:** mientras esté vigente la suscripción + el periodo de retención posterior (ver Política de Retención).

---

## 3. Categorías de interesados y de datos

| Interesados | Datos tratados |
|-------------|----------------|
| Jugadores (en su mayoría **menores**) | Nombre, apellidos, fecha de nacimiento, DNI/NIE, fotografía, equipo, datos deportivos |
| Tutores legales | Nombre, email, teléfono, datos de pago/recibo |
| Personal del club | Nombre, email, rol, documentación |

**⚠️ Categoría especial de datos (art. 9 RGPD):** los **certificados médicos de aptitud deportiva** son datos de salud. Requieren base jurídica reforzada (consentimiento explícito del tutor o cumplimiento de obligación federativa) y medidas de seguridad adicionales.

**⚠️ Menores (art. 8 RGPD + art. 7 LOPDGDD):** el tratamiento de datos de menores de 14 años requiere **consentimiento del titular de la patria potestad o tutela**. El Club es responsable de recabarlo.

---

## 4. Obligaciones del Proveedor (encargado)

1. Tratar los datos solo según instrucciones documentadas del Club.
2. Garantizar la **confidencialidad** (personas autorizadas con deber de secreto).
3. Aplicar las medidas de seguridad del **art. 32 RGPD** (ver sección 6).
4. No subcontratar sin autorización (ver sección 5).
5. Asistir al Club en: derechos de los interesados (acceso, rectificación, supresión, portabilidad), evaluaciones de impacto y consultas a la AEPD.
6. **Notificar al Club sin dilación indebida (máx. 24h)** cualquier violación de seguridad de la que tenga conocimiento.
7. A la finalización: **devolver o suprimir** todos los datos (a elección del Club) y eliminar copias, salvo obligación legal de conservación.

---

## 5. Subencargados

El Proveedor utiliza los siguientes subencargados, que el Club autoriza al firmar:

| Subencargado | Finalidad | Ubicación | Garantías |
|--------------|-----------|-----------|-----------|
| **Supabase** (base de datos, auth, storage) | Alojamiento de datos | UE (eu-west-1) | DPA propio + RGPD |
| **Vercel** (hosting de la aplicación) | Servidor web | UE/EEUU | SCC (cláusulas tipo) |
| **Resend / proveedor SMTP** | Envío de emails | UE/EEUU | SCC |
| **Google** (si el club activa Sheets/Gmail) | Integración opcional | UE/EEUU | SCC |

El Proveedor informará de cualquier cambio de subencargado con antelación, permitiendo al Club oponerse.

> **Nota:** verificar que Supabase está en región UE (eu-west-1, confirmado) y firmar el DPA de Supabase, Vercel y el proveedor de email.

---

## 6. Medidas de seguridad (art. 32 RGPD)

- **Aislamiento multi-tenant** a nivel de base de datos (Row Level Security) — cada club solo accede a sus datos.
- **Cifrado en tránsito** (HTTPS/TLS) y **en reposo** (cifrado de Supabase).
- **Control de acceso por roles** (8 roles diferenciados, principio de mínimo privilegio).
- Tokens de integración cifrados con clave de aplicación.
- Registro de auditoría de accesos y acciones.
- Copias de seguridad gestionadas por el proveedor de base de datos.

---

## 7. Transferencias internacionales

Si algún subencargado trata datos fuera del EEE, se ampara en **Cláusulas Contractuales Tipo (SCC)** aprobadas por la Comisión Europea.

---

## 8. Responsabilidad

Cada parte responde de los daños que cause por incumplimiento del RGPD conforme al art. 82.

---

**Fecha:** ______________
**Por el Club (Responsable):** ______________________
**Por el Proveedor (Encargado):** ______________________
