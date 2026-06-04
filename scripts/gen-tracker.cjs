/* Genera el CRM-lite de seguimiento de clubes en .xlsx (abrir en Google Sheets/Excel). */
const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')

const ESTADOS = ['Nuevo', 'Email 1', 'Email 2', 'Email 3', 'Respondió', 'Demo agendada', 'En prueba', 'Cliente', 'Descartado']

// ── Hoja 1: Seguimiento ───────────────────────────────────────────────────────
const headers = [
  'Club', 'Federación / Liga', 'Persona contacto', 'Cargo', 'Email', 'Teléfono',
  'Estado', 'Fecha 1er contacto', 'Emails enviados', 'Fecha último contacto',
  'Próxima acción', 'Fecha próx. acción', 'Resultado', 'Notas',
]
const ejemplos = [
  ['E.F. Ciudad de Getafe', 'RFFM', 'Diego', 'Dirección', 'info@efciudaddegetafe.com', '', 'Cliente', '', '', '', '—', '', 'Referencia / caso de éxito', 'Cliente piloto'],
  ['CD Ejemplo', 'RFFM', 'Nombre Apellido', 'Secretario', 'secretaria@cdejemplo.es', '600000000', 'Email 1', '01/06/2026', '1', '01/06/2026', 'Enviar Email 2', '04/06/2026', '', 'Sin respuesta aún'],
  ['Club Demo', 'FFCM', '', 'Presidente', 'presi@clubdemo.es', '', 'Nuevo', '', '0', '', 'Enviar Email 1', '', '', ''],
]
const wsSeg = XLSX.utils.aoa_to_sheet([headers, ...ejemplos])
wsSeg['!cols'] = [
  { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 28 }, { wch: 13 },
  { wch: 15 }, { wch: 16 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 22 }, { wch: 30 },
]
wsSeg['!autofilter'] = { ref: 'A1:N1' }
wsSeg['!freeze'] = { xSplit: 0, ySplit: 1 }

// ── Hoja 2: Resumen (embudo con fórmulas) ─────────────────────────────────────
const resumen = [['EMBUDO DE VENTAS', ''], ['', '']]
ESTADOS.forEach((e) => resumen.push([e, null]))
resumen.push(['', ''])
resumen.push(['Total contactados', null])
resumen.push(['Demos agendadas', null])
resumen.push(['Clientes', null])
resumen.push(['', ''])
resumen.push(['Tasa contacto→demo', null])
resumen.push(['Tasa demo→cliente', null])
resumen.push(['', ''])
resumen.push(['OBJETIVO', 20])
resumen.push(['Faltan para objetivo', null])

const wsRes = XLSX.utils.aoa_to_sheet(resumen)
wsRes['!cols'] = [{ wch: 26 }, { wch: 12 }]
// Helper: SheetJS 0.18 solo persiste la fórmula si hay valor cacheado (v).
// Google Sheets/Excel recalculan al abrir, así que v:0 es solo placeholder.
const F = (f, z) => (z ? { t: 'n', f, v: 0, z } : { t: 'n', f, v: 0 })
// Fórmulas COUNTIF por estado (filas 3..11 → B3..B11)
ESTADOS.forEach((e, i) => {
  const r = 3 + i
  wsRes[`B${r}`] = F(`COUNTIF(Seguimiento!G:G,"${e}")`)
})
// Total contactados = filas con club menos cabecera
const rowTotal = 3 + ESTADOS.length + 1
wsRes[`B${rowTotal}`] = F('COUNTA(Seguimiento!A2:A1000)')
wsRes[`B${rowTotal + 1}`] = F('COUNTIF(Seguimiento!G:G,"Demo agendada")+COUNTIF(Seguimiento!G:G,"En prueba")+COUNTIF(Seguimiento!G:G,"Cliente")')
wsRes[`B${rowTotal + 2}`] = F('COUNTIF(Seguimiento!G:G,"Cliente")')
// Tasas
wsRes[`B${rowTotal + 4}`] = F(`IF(B${rowTotal}=0,0,(B${rowTotal + 1})/B${rowTotal})`, '0.0%')
wsRes[`B${rowTotal + 5}`] = F(`IF(B${rowTotal + 1}=0,0,B${rowTotal + 2}/B${rowTotal + 1})`, '0.0%')
// Objetivo
const rowObj = rowTotal + 7
wsRes[`B${rowObj + 1}`] = F(`MAX(0,B${rowObj}-B${rowTotal + 2})`)

// ── Hoja 3: Cómo usar ─────────────────────────────────────────────────────────
const guia = [
  ['CÓMO USAR ESTE SEGUIMIENTO'],
  [''],
  ['1) Sube tu lista de clubes a la hoja "Seguimiento" (una fila por club).'],
  ['2) Cada vez que envías un email, actualiza la columna "Estado" y "Fecha último contacto".'],
  ['3) La hoja "Resumen" calcula el embudo automáticamente.'],
  [''],
  ['CADENCIA DE EMAILS (3 toques, paran al responder):'],
  ['  · Día 0  → Email 1 (presentación + caso Ciudad de Getafe)'],
  ['  · Día 3  → Email 2 (recordatorio corto + beneficio concreto)'],
  ['  · Día 7  → Email 3 (último toque + oferta de demo de 20 min)'],
  [''],
  ['ESTADOS POSIBLES (cópialos como desplegable):'],
  ['  ' + ESTADOS.join('  ·  ')],
  [''],
  ['AÑADIR DESPLEGABLE DE COLOR EN GOOGLE SHEETS (30 seg):'],
  ['  a) Selecciona la columna G (Estado).'],
  ['  b) Menú: Datos → Validación de datos → Añadir regla → "Lista de elementos".'],
  ['  c) Pega los estados de arriba separados por comas.'],
  ['  d) Activa "Mostrar como chips de colores" para ver el embudo de un vistazo.'],
  [''],
  ['RUTINA SEMANAL (15 min/día):'],
  ['  · Lunes: cargar 100 clubes nuevos + enviar Email 1.'],
  ['  · Mar-Vie: enviar seguimientos (Email 2 y 3) según fechas.'],
  ['  · Responder en <2h a cualquiera que conteste → agendar demo.'],
]
const wsGuia = XLSX.utils.aoa_to_sheet(guia)
wsGuia['!cols'] = [{ wch: 95 }]

// ── Hoja 4: Fuentes de clubes (de dónde sacar 100-200 reales) ─────────────────
const fuentes = [
  ['DE DÓNDE SACAR 100-200 CLUBES REALES (CON WEB, EMAIL Y TELÉFONO)'],
  [''],
  ['⚠️ No inventes correos ni teléfonos: rebotan, queman tu dominio y es spam. Usa solo datos verificados de estas fuentes.'],
  [''],
  ['1) DIRECTORIOS DE FEDERACIONES (la mejor fuente — clubes federados con contacto)'],
  ['   · Madrid (RFFM):  https://www.rffm.es/competiciones/directorio-de-clubs'],
  ['   · Cada comunidad tiene su federación con su "directorio de clubes". Busca en Google:'],
  ['        "directorio de clubes" + [tu federación]  (ej: FCF Cataluña, RFAF Andalucía, FFCV Valencia, FGF Galicia...)'],
  ['   · Agregador nacional por federación:  https://www.futbol-regional.es'],
  [''],
  ['2) GOOGLE MAPS (rápido y con teléfono + web públicos)'],
  ['   · Busca: "club de fútbol" + provincia/ciudad  (ej: "club de futbol Getafe").'],
  ['   · Cada ficha trae nombre, web y teléfono. El email suele estar en la web del club (sección Contacto).'],
  ['   · Para exportar en bloque a CSV usa la extensión gratis de Chrome "Instant Data Scraper".'],
  [''],
  ['3) RFEF / FUTBOL-NET'],
  ['   · Las webs de competición listan los clubes de cada liga; entra a cada club para su contacto.'],
  [''],
  ['FLUJO RECOMENDADO (≈1 hora para 100-200 clubes):'],
  ['   a) Abre el directorio de tu federación + Google Maps de tu provincia.'],
  ['   b) Copia a la hoja "Seguimiento": nombre, ubicación, web, email y teléfono (verificados).'],
  ['   c) Prioriza clubes de 6-20 equipos (los que más sufren el papeleo y mejor pagan).'],
  ['   d) Cuando tengas ~100, arranca la secuencia de emails (ver hoja "Cómo usar").'],
]
const wsFuentes = XLSX.utils.aoa_to_sheet(fuentes)
wsFuentes['!cols'] = [{ wch: 110 }]

// ── Construir libro ───────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, wsSeg, 'Seguimiento')
XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen')
XLSX.utils.book_append_sheet(wb, wsGuia, 'Cómo usar')
XLSX.utils.book_append_sheet(wb, wsFuentes, 'Fuentes de clubes')

const outDir = path.join(__dirname, '..', 'docs', 'marketing')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'Seguimiento-Clubes-Cluberly.xlsx')
XLSX.writeFile(wb, outPath)
console.log('OK →', outPath)
