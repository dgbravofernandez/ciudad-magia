'use client'

import {
  Document, Page, View, Text, StyleSheet, Image, pdf,
} from '@react-pdf/renderer'
import React from 'react'

export interface PlayerListPdfRow {
  id: string
  fullName: string
  dni: string
  birthDate: string | null
  teamName: string
  position: string
  status: string
}

export interface PlayerListPdfInput {
  clubName: string
  clubLogoUrl: string | null
  clubPrimaryColor: string
  season: string
  players: PlayerListPdfRow[]
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  const [y, m, day] = d.slice(0, 10).split('-')
  return y && m && day ? `${day}/${m}/${y}` : d
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo', trial: 'Prueba', low: 'Baja', injured: 'Lesión',
  suspended: 'Sancionado', registered: 'Alta', pending: 'Pendiente',
}
function fmtStatus(s: string): string {
  return STATUS_LABELS[s] ?? s
}

const POS_LABELS: Record<string, string> = {
  goalkeeper: 'Port.', defender: 'Def.', midfielder: 'Cent.',
  forward: 'Del.', portero: 'Port.', delantero: 'Del.',
  centrocampista: 'Cent.', defensa: 'Def.',
}
function fmtPos(p: string): string {
  return POS_LABELS[p.toLowerCase()] ?? p
}

export async function generatePlayerListPdf(input: PlayerListPdfInput): Promise<Blob> {
  const accent = input.clubPrimaryColor || '#EC4899'
  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  const styles = StyleSheet.create({
    page: { padding: 30, fontSize: 9, fontFamily: 'Helvetica', color: '#1F2937' },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: `2pt solid ${accent}` },
    logoBox: { width: 40, height: 40, borderRadius: 8, marginRight: 12, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' },
    logoLetter: { color: '#FFFFFF', fontSize: 22, fontWeight: 700 },
    headerText: { flex: 1 },
    clubName: { fontSize: 16, fontWeight: 700, color: '#0F172A' },
    subtitle: { fontSize: 10, color: '#64748B', marginTop: 2 },
    meta: { fontSize: 8, color: '#94A3B8', textAlign: 'right' },
    tableHeader: { flexDirection: 'row', backgroundColor: accent, color: '#FFFFFF', padding: 6, fontSize: 8, fontWeight: 700 },
    row: { flexDirection: 'row', padding: 5, fontSize: 8, borderBottom: '0.5pt solid #E5E7EB' },
    rowAlt: { backgroundColor: '#FDF2F8' },
    c_name: { width: '28%', paddingRight: 4 },
    c_dni:  { width: '16%' },
    c_nac:  { width: '14%' },
    c_team: { width: '18%' },
    c_pos:  { width: '12%' },
    c_status: { width: '12%' },
    badge: { fontSize: 7, fontWeight: 700 },
    footer: { position: 'absolute', bottom: 20, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#94A3B8' },
    summary: { marginTop: 12, padding: 8, backgroundColor: '#FDF2F8', borderRadius: 4, flexDirection: 'row', justifyContent: 'space-around' },
    summaryItem: { alignItems: 'center' as const },
    summaryNum: { fontSize: 14, fontWeight: 700 },
    summaryLabel: { fontSize: 7, color: '#64748B', marginTop: 2 },
  })

  // KPIs
  const total = input.players.length

  const initial = (input.clubName || 'C').slice(0, 1).toUpperCase()

  const doc = (
    <Document author="Cluberly" title={`Listado ${input.clubName} ${input.season}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          {input.clubLogoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={input.clubLogoUrl} style={{ width: 40, height: 40, marginRight: 12 }} />
          ) : (
            <View style={styles.logoBox}>
              <Text style={styles.logoLetter}>{initial}</Text>
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.clubName}>{input.clubName || 'Club'}</Text>
            <Text style={styles.subtitle}>Listado de jugadores · Temporada {input.season}</Text>
          </View>
          <Text style={styles.meta}>{today}{'\n'}{total} jugadores</Text>
        </View>

        {/* Tabla */}
        <View style={styles.tableHeader}>
          <Text style={styles.c_name}>Nombre</Text>
          <Text style={styles.c_dni}>DNI/NIE</Text>
          <Text style={styles.c_nac}>F. nac.</Text>
          <Text style={styles.c_team}>Equipo</Text>
          <Text style={styles.c_pos}>Pos.</Text>
          <Text style={styles.c_status}>Estado</Text>
        </View>

        {input.players.map((p, i) => (
          <View key={p.id} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
            <Text style={styles.c_name}>{p.fullName}</Text>
            <Text style={styles.c_dni}>{p.dni}</Text>
            <Text style={styles.c_nac}>{fmtDate(p.birthDate)}</Text>
            <Text style={styles.c_team}>{p.teamName}</Text>
            <Text style={styles.c_pos}>{fmtPos(p.position)}</Text>
            <Text style={styles.c_status}>{fmtStatus(p.status)}</Text>
          </View>
        ))}

        {/* Resumen */}
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: accent }]}>{total}</Text>
            <Text style={styles.summaryLabel}>JUGADORES</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Generado con Cluberly · cluberly.club</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )

  return await pdf(doc).toBlob()
}
