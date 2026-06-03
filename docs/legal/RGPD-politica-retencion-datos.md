# Política de Retención y Supresión de Datos

> ⚠️ **PLANTILLA — REVISIÓN LEGAL OBLIGATORIA.** Punto de partida para Cluberly.
> Revísela un abogado antes de aplicarla. No es asesoramiento legal.

Principio del RGPD (art. 5.1.e — *limitación del plazo de conservación*): los datos no se
conservan más tiempo del necesario para los fines del tratamiento.

---

## 1. Plazos de conservación por tipo de dato

| Dato | Plazo | Base |
|------|-------|------|
| Datos de jugador activo (nombre, DNI, foto, equipo) | Mientras esté inscrito + temporada en curso | Ejecución del servicio |
| **Certificados médicos** (dato de salud) | Fin de la temporada para la que se emitió; borrado en ≤ 60 días tras finalizar | Minimización — no conservar salud más de lo necesario |
| Datos de jugador dado de baja | 1 temporada (por si reinscripción) → luego anonimizar o borrar | Interés legítimo limitado |
| **Registros de pagos / facturación** | **4 años** | Obligación fiscal (LGT art. 66) |
| Comunicaciones enviadas (logs email) | 1 año | Interés legítimo (trazabilidad) |
| Datos de personal del club | Mientras dure la relación + plazos laborales aplicables | Obligación legal |
| Cuenta de usuario inactiva | Borrado tras 12 meses sin acceso (previo aviso) | Minimización |

---

## 2. Datos de menores

- Se aplica **minimización reforzada**: no recabar más datos del menor de los estrictamente necesarios.
- Al cumplir el jugador la mayoría de edad, revisar la base jurídica del tratamiento.
- El borrado de datos de menores dados de baja es **prioritario** (no acumular DNIs/fotos de exjugadores).

---

## 3. Procedimiento de supresión

1. **A petición del club** (responsable): exportación completa de sus datos + borrado en ≤ 30 días.
2. **A petición de un interesado** (derecho de supresión, art. 17): el club lo gestiona; el proveedor asiste técnicamente.
3. **Fin de contrato:** el club elige *devolución* (export) o *supresión*. Sin instrucción, supresión en 90 días.
4. **Backups:** los datos en copias de seguridad se purgan en el siguiente ciclo de rotación (máx. 35 días).

---

## 4. Derechos de los interesados (cómo se ejercen)

| Derecho | Cómo lo cubre Cluberly |
|---------|------------------------|
| Acceso | El club exporta los datos del interesado desde la app |
| Rectificación | Edición directa en la ficha |
| Supresión | Borrado de ficha + purga de documentos asociados |
| Portabilidad | Exportación en CSV/Excel/PDF |
| Oposición / limitación | Marcar como inactivo + cese de comunicaciones |

---

## 5. Pendiente de implementar (mejora del producto)

- [ ] **Borrado en cascada real:** al borrar un jugador, eliminar también sus documentos en Storage (fotos, DNIs, certificados), no solo la fila.
- [ ] **Job automático de retención:** purgar certificados médicos > 1 temporada y cuentas inactivas > 12 meses.
- [ ] **Export "todos mis datos"** con un clic (derecho de portabilidad RGPD) por club.
- [ ] **Registro de consentimientos** de tutores (quién consintió, cuándo, para qué).

> Estos 4 puntos convierten la política en algo *demostrable* ante la AEPD, no solo escrito.
> Recomendado implementarlos antes de superar ~10 clubes de pago.
