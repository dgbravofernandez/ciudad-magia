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
  payment: { label: 'Al día' | 'Parcial' | 'Sin pagar' | 'Sin cuotas'; due: number; paid: number; pending: number }
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

function fmtEuro(n: number): string {
  return n === 0 ? '—' : `${n.toFixed(0)} €`
}

function payColor(label: PlayerListPdfRow['payment']['label']): string {
  if (label === 'Al día') return '#16A34A'
  if (label === 'Parcial') return '#F59E0B'
  if (label === 'Sin pagar') return '#DC2626'
  return '#94A3B8'
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
    c_name: { width: '20%', paddingRight: 4 },
    c_dni:  { width: '12%' },
    c_nac:  { width: '10%' },
    c_team: { width: '14%' },
    c_pos:  { width: '10%' },
    c_status: { width: '9%' },
    c_pay:  { width: '8%' },
    c_due:  { width: '8%', textAlign: 'right' as const },
    c_paid: { width: '8%', textAlign: 'right' as const },
    c_pending: { width: '8%', textAlign: 'right' as const },
    badge: { fontSize: 7, fontWeight: 700 },
    footer: { position: 'absolute', bottom: 20, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#94A3B8' },
    summary: { marginTop: 12, padding: 8, backgroundColor: '#FDF2F8', borderRadius: 4, flexDirection: 'row', justifyContent: 'space-around' },
    summaryItem: { alignItems: 'center' as const },
    summaryNum: { fontSize: 14, fontWeight: 700 },
    summaryLabel: { fontSize: 7, color: '#64748B', marginTop: 2 },
  })

  // KPIs
  const total = input.players.length
  const alDia = input.players.filter(p => p.payment.label === 'Al día').length
  const parcial = input.players.filter(p => p.payment.label === 'Parcial').length
  const sinPagar = input.players.filter(p => p.payment.label === 'Sin pagar').length
  const totalDue = input.players.reduce((s, p) => s + p.payment.due, 0)
  const totalPaid = input.players.reduce((s, p) => s + p.payment.paid, 0)
  const totalPending = input.players.reduce((s, p) => s + p.payment.pending, 0)

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
          <Text style={styles.c_pay}>Pago</Text>
          <Text style={styles.c_due}>Cuota</Text>
          <Text style={styles.c_paid}>Pagado</Text>
          <Text style={styles.c_pending}>Pendiente</Text>
        </View>

        {input.players.map((p, i) => (
          <View key={p.id} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
            <Text style={styles.c_name}>{p.fullName}</Text>
            <Text style={styles.c_dni}>{p.dni}</Text>
            <Text style={styles.c_nac}>{fmtDate(p.birthDate)}</Text>
            <Text style={styles.c_team}>{p.teamName}</Text>
            <Text style={styles.c_pos}>{p.position}</Text>
            <Text style={styles.c_status}>{p.status}</Text>
            <Text style={[styles.c_pay, styles.badge, { color: payColor(p.payment.label) }]}>{p.payment.label}</Text>
            <Text style={styles.c_due}>{fmtEuro(p.payment.due)}</Text>
            <Text style={styles.c_paid}>{fmtEuro(p.payment.paid)}</Text>
            <Text style={[styles.c_pending, { color: p.payment.pending > 0 ? '#DC2626' : '#16A34A' }]}>
              {fmtEuro(p.payment.pending)}
            </Text>
          </View>
        ))}

        {/* Resumen */}
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: accent }]}>{total}</Text>
            <Text style={styles.summaryLabel}>JUGADORES</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: '#16A34A' }]}>{alDia}</Text>
            <Text style={styles.summaryLabel}>AL DÍA</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: '#F59E0B' }]}>{parcial}</Text>
            <Text style={styles.summaryLabel}>PARCIAL</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: '#DC2626' }]}>{sinPagar}</Text>
            <Text style={styles.summaryLabel}>SIN PAGAR</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: '#0F172A' }]}>{totalDue.toFixed(0)}€</Text>
            <Text style={styles.summaryLabel}>CUOTA TOTAL</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: '#16A34A' }]}>{totalPaid.toFixed(0)}€</Text>
            <Text style={styles.summaryLabel}>COBRADO</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: '#DC2626' }]}>{totalPending.toFixed(0)}€</Text>
            <Text style={styles.summaryLabel}>PENDIENTE</Text>
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
