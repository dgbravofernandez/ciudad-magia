# Manual de Usuario — Ciudad Magia CRM

**Versión:** Mayo 2026  
**Audiencia:** Administradores, directores deportivos, coordinadores y entrenadores

---

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [Jugadores](#2-jugadores)
3. [Entrenadores y sesiones](#3-entrenadores-y-sesiones)
4. [Contabilidad](#4-contabilidad)
5. [Comunicaciones](#5-comunicaciones)
6. [Configuración](#6-configuración)
7. [Planificación de temporada](#7-planificación-de-temporada)
8. [RFFM (Federación)](#8-rffm-federación)
9. [Torneos](#9-torneos)

---

## 1. Primeros pasos

### 1.1. Acceder a la aplicación

1. Abre el navegador y ve a la dirección de la aplicación (tu administrador te la habrá proporcionado).
2. En la pantalla de login, introduce tu **correo electrónico** y **contraseña**.
3. Pulsa **Iniciar sesión**.

Si no recuerdas tu contraseña, contacta con el administrador del club para que te la restablezca desde el panel de Configuración → Roles y accesos.

### 1.2. Estructura de la aplicación

Una vez dentro, verás una barra lateral a la izquierda con los módulos principales. La navegación siempre está visible:

| Sección | Para qué sirve |
|---|---|
| **Jugadores** | Fichas, inscripciones, sanciones, lesiones |
| **Entrenadores** | Sesiones, asistencia, partidos, ejercicios |
| **Contabilidad** | Pagos, gastos, cierre de caja |
| **Comunicaciones** | Emails a tutores, plantillas |
| **Torneos** | Competiciones propias del club |
| **RFFM** | Seguimiento de competiciones de la federación |
| **Configuración** | Club, roles, cuotas, integraciones |

El logo del club aparece en la parte superior de la barra lateral. Al hacer clic en el nombre de tu perfil (esquina inferior izquierda), puedes cerrar sesión.

### 1.3. Roles del sistema

Cada usuario tiene uno o varios roles. Los roles determinan qué puede ver y hacer cada persona:

| Rol | Acceso principal |
|---|---|
| **admin** | Acceso completo a todo el sistema |
| **dirección** | Acceso completo excepto acciones técnicas avanzadas |
| **director_deportivo** | Jugadores, sesiones, partidos, scouting, RFFM |
| **coordinador** | Equipos a su cargo, sesiones, observaciones |
| **entrenador** | Sus sesiones, asistencia, partidos de sus equipos |
| **fisio** | Lesiones y estado físico de jugadores |
| **infancia** | Gestión de equipos de categorías inferiores |
| **redes** | Comunicaciones y contenido del club |

Un usuario puede tener varios roles simultáneamente (por ejemplo, alguien que es coordinador y entrenador a la vez).

---

## 2. Jugadores

### 2.1. Añadir un jugador manualmente

1. En el menú lateral, haz clic en **Jugadores**.
2. Pulsa el botón **Nuevo jugador** (esquina superior derecha).
3. Rellena el formulario por secciones:

**Datos personales**
- Nombre y apellidos (obligatorios)
- Fecha de nacimiento
- DNI / NIE
- Nacionalidad (por defecto ES)
- Posición: Portero, Defensa, Centrocampista o Delantero
- Pie dominante: Derecho, Izquierdo o Ambos
- Dorsal (número entre 1 y 99)
- Altura en cm y peso en kg (opcionales)

**Tutor / Contacto**
- Nombre, email y teléfono del tutor principal
- Datos de un segundo tutor (opcional)

> El email del tutor es importante: se usa para enviar comunicaciones, recordatorios de pago y solicitudes de documentación.

**Equipo y estado**
- Selecciona el equipo al que pertenece el jugador
- Notas internas (solo visible para el staff del club)

**Documentación (solo al crear)**
- Puedes incluir el enlace al formulario de Google Forms donde el tutor subirá los documentos (DNI, foto, certificado médico, justificante de reserva).
- Si marcas la casilla **Enviar email al tutor**, el sistema enviará automáticamente un correo al tutor con el enlace al formulario en el momento de crear el jugador.

4. Pulsa **Crear jugador**.

El sistema te llevará directamente a la ficha del jugador recién creado.

### 2.2. Importar jugadores desde Excel (formato RFFM)

Esta función permite importar masivamente jugadores desde el archivo Excel oficial de la federación madrileña.

1. Ve a **Jugadores** → **Importar** (botón o enlace en la parte superior).
2. Arrastra el archivo `.xlsx` al área de carga, o haz clic en **Seleccionar archivo .xlsx**.
3. La aplicación analiza el archivo y muestra una **previsualización** agrupada por equipo.
4. Revisa los grupos detectados. Verás una indicación de si el equipo se ha encontrado en el sistema o no.
5. Puedes desmarcar jugadores concretos si no quieres importarlos.
6. Pulsa **Importar N jugadores** para confirmar.

El sistema solo importa licencias en estado **Activa** y omite automáticamente técnicos, delegados y árbitros.

> **Nota:** Los Alevines se clasifican automáticamente en F7 (primer año) o F11 (segundo año) según el año de nacimiento dentro del grupo.

⚠️ **Atención:** Si pulsas **Borrar todos los jugadores** (botón en rojo dentro de la pantalla de importación), se eliminarán todos los jugadores del club. Esta acción no se puede deshacer. Úsala solo si necesitas reimportar desde cero.

### 2.3. Ficha del jugador

Haz clic sobre el nombre de cualquier jugador para acceder a su ficha. La ficha está organizada en varias pestañas:

**Datos**
Muestra toda la información personal y de contacto. Puedes editarla pulsando el botón **Editar** en la parte superior derecha.

**Lesiones**
Historial de lesiones del jugador: fecha de inicio, fecha de alta, diagnóstico y observaciones del fisio. Para añadir una lesión, pulsa **Nueva lesión** y rellena los campos.

**Sanciones**
Registro de tarjetas y sanciones. Se actualizan automáticamente al registrar eventos en partidos live. También puedes añadir sanciones manualmente.

**Observaciones**
Notas técnicas del coordinador o entrenador sobre el desarrollo del jugador. Cada observación queda fechada y firmada por quien la escribe.

**Documentos**
Muestra el estado de la documentación solicitada al tutor (si se usó Google Forms). Puedes reenviar la solicitud de documentos desde esta pestaña.

**Rendimiento**
Resumen estadístico de la temporada: porcentaje de asistencia a entrenamientos, minutos totales jugados en partidos y participación por equipo.

### 2.4. Cambiar el estado de un jugador

Desde la ficha del jugador, en la pestaña **Datos**, el campo **Estado** permite los siguientes valores:

- **Activo** — jugador en plantilla
- **Lesionado** — baja temporal por lesión
- **Inactivo** — no asiste pero no ha causado baja definitiva
- **Baja** — ha abandonado el club

⚠️ **Atención:** Marcar a un jugador como **Baja** no lo elimina del sistema. Queda en el historial para consulta futura.

### 2.5. Generar una trial letter en PDF

La trial letter es una carta oficial que certifica que un jugador está en período de prueba en el club.

1. Ve a la ficha del jugador.
2. En la pestaña **Datos**, busca el botón **Generar trial letter**.
3. La carta se genera como PDF y se descarga automáticamente.

La carta incluye los datos del club, el nombre del jugador, la fecha y la firma del director deportivo.

### 2.6. Gestión de inscripciones

El módulo de inscripciones permite hacer el seguimiento de qué jugadores han confirmado su continuidad para la próxima temporada.

1. Ve a **Jugadores** → **Inscripciones**.
2. Verás una tabla con todos los jugadores y su estado de inscripción:
   - **Pendiente** — no ha respondido todavía
   - **Continúa** — ha confirmado que sigue
   - **Baja** — no renovará

Para actualizar el estado de un jugador:
- Haz clic en su fila y selecciona el nuevo estado.
- También puedes enviar un email individual al tutor desde esta misma pantalla pulsando el icono de correo.

Desde la parte superior de la pantalla puedes **sincronizar con Google Sheets** si tienes configurada la hoja de inscripciones, lo que importa las respuestas del formulario de renovación.

---

## 3. Entrenadores y sesiones

### 3.1. Ver el staff por equipo

1. Ve a **Entrenadores** en el menú lateral.
2. La pantalla principal muestra todos los equipos activos con el número de entrenadores y la próxima sesión.
3. Haz clic en un equipo para ver el detalle del staff asignado: entrenadores, coordinadores y sus datos de contacto.

### 3.2. Crear una sesión de entrenamiento

1. Ve a **Entrenadores** → **Sesiones**.
2. Pulsa **Nueva sesión**.
3. Rellena el formulario:
   - **Equipo** — selecciona de la lista o introdúcelo manualmente
   - **Tipo de sesión** — Entrenamiento o Partido
   - **Fecha y hora** — por defecto se rellena con la fecha y hora actual
   - **Lugar** — instalación donde se celebra
   - **Objetivos** — añade uno o varios objetivos de la sesión (escribe y pulsa Añadir)
4. Pulsa **Crear sesión**.

Si el tipo es **Partido**, serás redirigido al modo de partido (live o diferido).  
Si el tipo es **Entrenamiento**, accederás a la pantalla de detalle de sesión donde puedes pasar lista.

### 3.3. Pasar lista y registrar minutos jugados

Dentro de una sesión de entrenamiento:

1. Verás la lista de todos los jugadores del equipo.
2. Para cada jugador, selecciona su estado:
   - **Presente** (verde)
   - **Ausente** (rojo)
   - **Justificado** (naranja) — falta con motivo válido
3. Si quieres registrar minutos jugados, introduces el número en el campo correspondiente de cada jugador.
4. También puedes añadir goles, asistencias, tarjetas y una valoración numérica.
5. Cuando hayas terminado, pulsa **Guardar asistencia**.
6. Para cerrar la sesión definitivamente, pulsa **Completar sesión**.

⚠️ **Atención:** Una vez completada la sesión, no se puede volver a editar la asistencia.

### 3.4. Registrar un partido en modo live (minuto a minuto)

El modo live permite registrar los eventos del partido en tiempo real.

1. Crea una nueva sesión de tipo **Partido**.
2. Serás redirigido a la pantalla del partido.
3. Pulsa **Iniciar partido** para comenzar el cronómetro.
4. Para registrar un evento, pulsa **+ Evento** y selecciona:
   - Tipo: Gol, Tarjeta amarilla, Tarjeta roja, Cambio o Lesión
   - Jugador implicado
   - Minuto del evento
5. El marcador se actualiza automáticamente con los goles.
6. Al final, pulsa **Finalizar partido** para cerrar el acta.

### 3.5. Registrar un partido en modo diferido (resultado final)

Si el partido ya ha terminado y solo quieres guardar el resultado:

1. Crea una sesión de tipo **Partido** con la fecha y hora reales del partido.
2. En la pantalla del partido, introduce directamente el resultado final (goles local y visitante).
3. Registra los eventos que recuerdes (tarjetas, goles por jugador) con el minuto aproximado.
4. Pulsa **Completar partido**.

### 3.6. Añadir observaciones sobre jugadores

Las observaciones permiten al coordinador o entrenador dejar anotaciones técnicas sobre el desarrollo de un jugador.

1. Ve a **Entrenadores** → **Observaciones**.
2. Pulsa **Nueva observación**.
3. Selecciona el jugador, escribe la observación y, si quieres, adjunta una valoración.
4. Guarda.

Las observaciones también se pueden añadir directamente desde la ficha del jugador (pestaña **Observaciones**).

### 3.7. Biblioteca de ejercicios

La biblioteca permite guardar ejercicios de entrenamiento para reutilizarlos en futuras sesiones.

**Crear un ejercicio:**
1. Ve a **Entrenadores** → **Ejercicios**.
2. Pulsa **Nuevo ejercicio**.
3. Rellena el nombre, categoría, descripción y objetivos.
4. Usa el **tablero táctico** interactivo para dibujar el ejercicio sobre el campo (puedes añadir jugadores, balones y flechas de movimiento). Al guardar el formulario, la imagen del tablero se guarda automáticamente.
5. Pulsa **Guardar ejercicio**.

**Añadir un ejercicio a una sesión:**
Dentro del detalle de una sesión, encontrarás la sección **Ejercicios de la sesión**. Pulsa **Añadir ejercicio** para buscar en la biblioteca y seleccionar los ejercicios que vayas a usar.

### 3.8. Horarios recurrentes del equipo

Los horarios recurrentes permiten definir los días y horas habituales de entrenamiento de cada equipo, de modo que el sistema puede generar automáticamente las sesiones de la semana.

1. Ve a **Entrenadores** → pantalla de equipos.
2. En la tarjeta de un equipo, pulsa el icono de calendario o **Horario**.
3. En el modal que aparece, pulsa **Añadir franja** y configura:
   - Día de la semana
   - Hora de inicio y fin
   - Lugar
4. Pulsa **Añadir**.
5. Con el botón **Generar sesiones de la semana**, el sistema creará automáticamente las sesiones correspondientes a esa semana para todos los equipos con horario configurado.

> Este proceso también se ejecuta automáticamente cada domingo a las 22:00 mediante el cron programado.

---

## 4. Contabilidad

### 4.1. Registrar el pago de una cuota

1. Ve a **Contabilidad** en el menú lateral.
2. La pantalla principal muestra un resumen: total cobrado este mes, total pendiente y número de jugadores con deuda.
3. Usa el buscador para encontrar al jugador por nombre.
4. Haz clic sobre el jugador para desplegar su detalle de pagos.
5. Pulsa **Registrar pago** y rellena:
   - Concepto (cuota mensual, matrícula, etc.)
   - Importe
   - Método de pago: Efectivo, Tarjeta o Transferencia
   - Fecha del pago
6. Pulsa **Guardar**.

El sistema actualiza automáticamente el estado del pago del jugador.

> Si tienes configuradas las cuotas estándar del club (en Configuración → Cuotas), puedes seleccionarlas desde un desplegable en lugar de introducir el importe manualmente.

### 4.2. Ver jugadores con deuda

En la pantalla principal de Contabilidad verás la estadística de jugadores con pagos pendientes. Para ver el listado completo:

1. Filtra la lista de jugadores por **Estado: Pendiente**.
2. También puedes enviar un recordatorio de pago por email directamente desde la lista: selecciona varios jugadores con la casilla de verificación y pulsa **Enviar recordatorio**.

### 4.3. Registrar un gasto del club

1. Ve a **Contabilidad** → **Gastos**.
2. Pulsa **Nuevo gasto**.
3. Rellena el formulario:
   - **Categoría:** Equipamiento, Desplazamiento, Instalaciones, Personal, Torneo u Otros
   - **Descripción** del gasto
   - **Importe**
   - **Fecha**
   - **Método de pago:** Efectivo, Tarjeta o Transferencia
   - **URL del justificante** (opcional, puedes pegar un enlace a la factura)
4. Pulsa **Guardar gasto**.

Los gastos quedan registrados y se incluyen en el cierre de caja mensual.

### 4.4. Cierre de caja mensual

El cierre de caja permite cuadrar los ingresos y gastos del mes y dejar constancia del estado real de la caja.

1. Ve a **Contabilidad** → **Caja**.
2. Verás el total del sistema (según los registros de pagos) desglosado por método de pago (efectivo y tarjeta).
3. Introduce el **importe real** que has contado en caja y en el datáfono.
4. El sistema calcula automáticamente la diferencia.
5. Añade las notas que consideres (diferencias, incidencias).
6. Pulsa **Cerrar período**.

⚠️ **Atención:** Una vez cerrado el período, no se puede modificar. Si necesitas reabrir un cierre ya realizado, hay un botón de **Reabrir** pero solo admin o dirección pueden usarlo.

### 4.5. Exportar datos a CSV

Desde la sección **Configuración** → **Temporada** puedes exportar todos los datos de la temporada actual en formato CSV:

1. Ve a **Configuración** → pestaña **Temporada**.
2. Pulsa **Exportar datos de temporada**.
3. Se descargarán varios archivos CSV automáticamente:
   - **Jugadores** con sus datos y equipo
   - **Pagos** con conceptos e importes
   - **Sesiones** con asistencia y estadísticas

---

## 5. Comunicaciones

### 5.1. Enviar un email masivo a tutores

1. Ve a **Comunicaciones** en el menú lateral.
2. En la sección **Redactar**, elige los destinatarios:
   - **Todos los jugadores activos** — se envía a todos los tutores con email registrado
   - **Cuota pendiente** — solo a tutores de jugadores que deben algún pago
   - **Equipo específico** — selecciona el equipo del desplegable
   - **Por categoría** — selecciona la categoría (Benjamín, Alevín, Infantil, etc.)
   - **Familia específica** — busca por nombre del jugador o tutor
3. Escribe el **asunto** y el **cuerpo** del email.
4. Puedes usar **variables dinámicas** en el texto que se sustituirán automáticamente para cada destinatario:
   - `{jugador_nombre}` — nombre del jugador
   - `{tutor_nombre}` — nombre del tutor
   - `{club_nombre}` — nombre del club
   - `{importe}` — importe pendiente
   - `{mes}` — mes en curso
   - `{temporada}` — temporada activa
   - `{equipo}` — nombre del equipo del jugador
5. Pulsa **Previsualizar** para ver cómo quedará el email con datos de ejemplo.
6. Pulsa **Enviar** para enviarlo.

### 5.2. Enviar un email individual

El proceso es el mismo que el masivo, pero en el paso de destinatarios selecciona **Familia específica** y busca al jugador o tutor concreto.

### 5.3. Crear y usar plantillas

Las plantillas permiten guardar modelos de email para reutilizarlos.

**Crear una plantilla:**
1. Ve a **Comunicaciones** → **Plantillas**.
2. Pulsa **Nueva plantilla**.
3. Dale un nombre (uso interno), escribe el asunto y el cuerpo.
4. Pulsa **Guardar**.

**Usar una plantilla:**
Cuando estés en la pantalla de redacción de un email, en la parte superior encontrarás el selector **Cargar plantilla**. Selecciona la plantilla y se rellenarán automáticamente el asunto y el cuerpo. Puedes editarlo antes de enviar.

### 5.4. Ver el historial de envíos

1. Ve a **Comunicaciones** → **Historial**.
2. Verás la lista de todos los emails enviados, con fecha, destinatarios, asunto y estado de entrega.
3. Puedes filtrar por fecha o por tipo de envío.

---

## 6. Configuración

### 6.1. Datos del club

1. Ve a **Configuración** en el menú lateral.
2. Haz clic en la pestaña **Club**.
3. Puedes modificar:
   - **Nombre del club** y ciudad
   - **Logo** — pulsa el botón de subir imagen para cargar el logo desde tu ordenador
   - **Color principal y secundario** del club (se aplican en toda la interfaz)
   - **Descuento por hermanos** — activa o desactiva y configura el porcentaje

4. Pulsa **Guardar configuración**.

En esta misma sección, más abajo, encontrarás la gestión de **Patrocinadores**: puedes añadir el nombre y logo de cada patrocinador del club.

### 6.2. Gestionar roles y accesos del staff

1. Ve a **Configuración** → **Roles y accesos**.
2. Verás la lista de todos los miembros del staff con su email y roles asignados.

**Añadir un miembro nuevo:**
1. Pulsa **Nuevo miembro**.
2. Introduce nombre completo, email y teléfono.
3. Asigna los roles que tendrá (puedes asignar varios).
4. Si el rol es **entrenador** o **coordinador**, puedes asociarlo a un equipo específico.
5. Pulsa **Crear**.
6. El sistema generará una contraseña temporal que se muestra en pantalla. Cópiala y entrégasela al nuevo miembro.

**Editar roles de un miembro:**
- Haz clic en el botón de edición (icono lápiz) junto al miembro.
- Modifica los roles y guarda.

**Restablecer contraseña:**
- Haz clic en el botón de llave junto al miembro.
- Confirma la acción. Se generará una contraseña temporal que deberás entregarle.

**Desactivar un miembro:**
- Haz clic en el botón de desactivar. El miembro ya no podrá iniciar sesión, pero sus datos y registros se conservan.

⚠️ **Atención:** Eliminar un miembro borra sus datos del sistema. Si solo quieres impedir el acceso, usa **desactivar** en lugar de eliminar.

### 6.3. Configurar cuotas y descuentos

1. Ve a **Configuración** → **Cuotas**.
2. Configura:
   - **Cuota anual estándar** — importe total por temporada
   - **Descuento por pronto pago** — porcentaje de descuento si se paga antes de la fecha límite
   - **Plazos de pago** — divide la cuota en hasta tres plazos, cada uno con su importe, etiqueta y fecha límite
   - **Cuotas por equipo** — si algún equipo tiene una cuota diferente (por ejemplo, equipos con más gastos de desplazamiento), puedes configurarlo aquí por separado

3. Pulsa **Guardar configuración de cuotas**.

### 6.4. Conectar Google Sheets

La integración con Google Sheets permite sincronizar automáticamente los datos del club (inscripciones, pagos, jugadores) con hojas de cálculo de Google Drive.

1. Ve a **Configuración** → **Integraciones**.
2. En la sección de Google Sheets, sigue las instrucciones para autorizar el acceso con tu cuenta de Google o con la cuenta de servicio del club.
3. Una vez conectado, el sistema sincronizará automáticamente dos veces al día (a las 00:00 y a las 12:00).

> Si la integración falla, aparecerá un aviso en la pantalla de Configuración con el error concreto. Lo más habitual es que el token haya expirado y haya que volver a autorizar.

---

## 7. Planificación de temporada

### 7.1. Concepto de temporadas solapadas

Ciudad Magia gestiona dos temporadas de forma simultánea:

- **Temporada activa** — la temporada en curso, con los equipos y jugadores que están compitiendo ahora.
- **Próxima temporada** — en paralelo, se puede ir preparando la siguiente temporada: crear los equipos, gestionar las renovaciones de jugadores y configurar cuotas.

Esto permite trabajar en la planificación de la siguiente temporada sin interrumpir el funcionamiento de la actual.

### 7.2. Iniciar la planificación de la próxima temporada

1. Ve a **Configuración** → **Planificación**.
2. Verás el resumen de la temporada actual: número de equipos, jugadores activos y estado de las renovaciones.
3. Pulsa **Iniciar planificación de temporada siguiente**.
4. El sistema creará automáticamente los equipos de la próxima temporada como copia de los actuales. Podrás añadir, renombrar o eliminar equipos según las necesidades del club.

**Añadir un equipo nuevo para la próxima temporada:**
- Escribe el nombre del equipo en el campo de texto y pulsa **Añadir**.
- Los equipos nuevos aparecerán con la etiqueta de la próxima temporada.

### 7.3. Gestionar la continuidad de jugadores

Durante la planificación, puedes ir gestionando qué jugadores renuevan y a qué equipo van:

1. En la pantalla de **Inscripciones** (desde el menú de Jugadores), cada jugador tiene un estado de renovación.
2. Para los jugadores que continúan, puedes asignarles el equipo de la próxima temporada desde su ficha o desde la vista de inscripciones.

También puedes importar nuevas inscripciones directamente desde una hoja de Google Sheets:
1. En la pantalla de Planificación, sección **Nuevas inscripciones**, pega el ID de la hoja de Google Sheets con las solicitudes recibidas.
2. Pulsa **Previsualizar** para ver qué jugadores se importarían.
3. Si todo es correcto, pulsa **Importar**.

### 7.4. Activar el cambio de temporada

⚠️ **Atención:** Esta es la acción más importante y delicada del ciclo de temporada. Una vez activado el cambio, la próxima temporada pasa a ser la temporada activa. Esta acción no se puede deshacer fácilmente.

Cuando estés listo para hacer el cambio oficial de temporada:

1. Ve a **Configuración** → **Planificación**.
2. Revisa el resumen: número de jugadores que continúan, jugadores sin equipo asignado, y jugadores que causan baja.
3. Asegúrate de que todo está correcto.
4. Pulsa **Activar temporada siguiente**.
5. Confirma la acción en el diálogo de confirmación.

A partir de ese momento, todos los módulos del sistema (pagos, sesiones, comunicaciones) funcionarán sobre la nueva temporada.

---

## 8. RFFM (Federación)

El módulo RFFM permite hacer seguimiento de las competiciones de la federación madrileña de fútbol directamente desde la aplicación: clasificaciones, calendarios, actas y alertas de tarjetas.

### 8.1. Añadir una competición

1. Ve a **RFFM** en el menú lateral.
2. Pulsa **Añadir competición**.
3. En el modal que aparece, pega la **URL de la competición** en la página de la RFFM (por ejemplo, la URL de la clasificación de uno de tus equipos).
4. Pulsa **Resolver URL**. El sistema identificará la competición y te mostrará los equipos participantes.
5. Selecciona cuál es **tu equipo** en la lista.
6. Pulsa **Añadir competición**.

La competición quedará guardada y empezará a sincronizarse automáticamente.

### 8.2. Ver clasificación, calendario y actas

Una vez añadida la competición:

1. En el panel principal de RFFM, verás todas tus competiciones con el estado de sincronización.
2. Haz clic en una competición para ver:
   - **Clasificación** actual
   - **Calendario** de partidos (jugados y pendientes)
   - **Actas** de los partidos jugados con los goles y tarjetas

### 8.3. Alertas de tarjetas

El sistema monitoriza automáticamente las tarjetas amarillas acumuladas en cada competición. Cuando un jugador esté cerca del umbral de sanción (por ejemplo, a una tarjeta de ser sancionado), aparecerá una **alerta naranja** en el panel de RFFM.

Estas alertas te permiten tomar decisiones antes del siguiente partido: si el jugador sigue, si conviene preservarlo, etc.

### 8.4. Sincronización automática

La sincronización con la RFFM se ejecuta automáticamente **dos veces al día** (a las 00:00 y a las 12:00). También puedes forzar una sincronización manual pulsando el botón **Sincronizar ahora** en el panel de RFFM.

El banner de estado en la parte superior de la pantalla indica cuándo fue la última sincronización y si hubo algún error.

---

## 9. Torneos

El módulo de Torneos permite gestionar competiciones organizadas por el propio club (torneos de verano, torneos de categorías inferiores, etc.).

### 9.1. Crear un torneo

1. Ve a **Torneos** en el menú lateral.
2. Pulsa **Nuevo torneo**.
3. Rellena el formulario:
   - **Nombre** del torneo (obligatorio)
   - **Categoría** (Benjamín, Alevín, etc.)
   - **Formato:**
     - Liga — todos contra todos
     - Copa — eliminatorias directas
     - Liga + Eliminatorias — fase de grupos seguida de fase eliminatoria
   - **Fechas** de inicio y fin
   - **Lugar** donde se celebra
4. Pulsa **Crear torneo**.

### 9.2. Gestionar equipos y grupos

Una vez creado el torneo, accede a su detalle para configurarlo:

**Pestaña Equipos:**
1. Pulsa **Añadir equipo** e introduce el nombre de cada equipo participante.
2. Puedes añadir un contacto de cada equipo.

**Pestaña Clasificación (Grupos):**
1. Crea los grupos necesarios (Grupo A, Grupo B, etc.).
2. Asigna los equipos a cada grupo.
3. La clasificación se calcula automáticamente a medida que registras resultados.

### 9.3. Registrar resultados de partidos

1. Ve a la pestaña **Partidos** del torneo.
2. Los partidos aparecen programados según los grupos.
3. Haz clic en un partido y registra el resultado (goles local y goles visitante).
4. Pulsa **Guardar resultado**.

La clasificación se actualizará automáticamente: puntos, diferencia de goles y posición.

### 9.4. Fase eliminatoria

Si el torneo es de formato **Liga + Eliminatorias** o **Copa**:

1. Ve a la pestaña **Eliminatorias**.
2. Configura el cuadro de eliminatorias: cuartos, semis y final.
3. Registra los resultados de cada eliminatoria igual que en la fase de grupos.
4. El cuadro avanza automáticamente con los clasificados de cada ronda.

⚠️ **Atención:** Eliminar un torneo borra todos sus partidos, clasificaciones y datos. Esta acción no se puede deshacer.

---

## Preguntas frecuentes

**¿Qué pasa si un jugador aparece duplicado tras una importación?**  
El sistema detecta duplicados por DNI/NIE y los omite automáticamente durante la importación. Si el duplicado existe por otro motivo (mismo nombre pero distinto DNI), tendrás que eliminarlo manualmente desde la ficha del jugador.

**¿Puedo tener un jugador en dos equipos a la vez?**  
No directamente: cada jugador tiene un equipo principal asignado. Para los casos en que un jugador sube puntualmente a otro equipo, registra su asistencia en la sesión correspondiente aunque no sea de su equipo habitual.

**¿El historial de pagos se borra al cambiar de temporada?**  
No. Los pagos quedan asociados a la temporada en que se registraron y siempre son consultables desde Contabilidad filtrando por temporada.

**¿Puedo deshacer el envío de un email masivo?**  
No. Una vez enviado, no es posible recuperar un email. Utiliza siempre la función de **Previsualizar** antes de enviar para asegurarte de que el contenido es correcto.

**¿Con qué frecuencia se sincronizan los datos de la RFFM?**  
Automáticamente dos veces al día: a medianoche y al mediodía. Fuera de esos horarios, puedes forzar una sincronización manual desde el panel de RFFM.

---

*Manual generado en mayo de 2026. Si detectas alguna funcionalidad que haya cambiado o algún paso que no coincide con lo que ves en pantalla, comunícalo al administrador del sistema.*
