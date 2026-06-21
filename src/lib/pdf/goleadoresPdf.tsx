'use client'

import { Document, Page, View, Text, StyleSheet, pdf } from '@react-pdf/renderer'
import React from 'react'

export interface GoleadorPdfRow {
  id: string
  nombre: string
  equipo: string
  competicion: string
  modalidad: string        // 'F11' | 'F7' | ''
  genero: string           // 'Fem' | 'Masc' | ''
  anio: number | null
  goles: number
  partidos: number
  golesPorPartido: number
  division: number | null
}

export interface GoleadoresPdfInput {
  clubName: string
  filtros: string          // descripción de los filtros aplicados
  rows: GoleadorPdfRow[]
}

export async function generateGoleadoresPdf(input: GoleadoresPdfInput): Promise<Blob> {
  const accent = '#2563EB'
  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  const styles = StyleSheet.create({
    page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica', color: '#1F2937' },
    header: { marginBottom: 12, paddingBottom: 10, borderBottom: `2pt solid ${accent}` },
    title: { fontSize: 15, fontWeight: 700, color: '#0F172A' },
    sub: { fontSize: 9, color: '#64748B', marginTop: 3 },
    meta: { fontSize: 8, color: '#94A3B8', marginTop: 2 },
    tableHeader: { flexDirection: 'row', backgroundColor: accent, color: '#FFFFFF', padding: 5, fontSize: 8, fontWeight: 700 },
    row: { flexDirection: 'row', padding: 4, fontSize: 8, borderBottom: '0.5pt solid #E5E7EB' },
    rowAlt: { backgroundColor: '#EFF6FF' },
    cRank: { width: '5%' },
    cName: { width: '22%', paddingRight: 3 },
    cTeam: { width: '23%', paddingRight: 3 },
    cComp: { width: '20%', paddingRight: 3 },
    cMod: { width: '8%' },
    cAnio: { width: '7%', textAlign: 'right' as const },
    cGoles: { width: '7%', textAlign: 'right' as const, fontWeight: 700 },
    cPj: { width: '5%', textAlign: 'right' as const },
    cRatio: { width: '8%', textAlign: 'right' as const },
    footer: { position: 'absolute', bottom: 16, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#94A3B8' },
  })

  const doc = (
    <Document author="Cluberly" title={`Goleadores ${input.clubName}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.title}>{input.clubName || 'Club'} · Goleadores RFFM</Text>
          <Text style={styles.sub}>{input.filtros || 'Todos'}</Text>
          <Text style={styles.meta}>{today} · {input.rows.length} jugadores</Text>
        </View>

        <View style={styles.tableHeader} fixed>
          <Text style={styles.cRank}>#</Text>
          <Text style={styles.cName}>Jugador</Text>
          <Text style={styles.cTeam}>Equipo</Text>
          <Text style={styles.cComp}>Competición</Text>
          <Text style={styles.cMod}>Modal.</Text>
          <Text style={styles.cAnio}>Año</Text>
          <Text style={styles.cGoles}>Goles</Text>
          <Text style={styles.cPj}>PJ</Text>
          <Text style={styles.cRatio}>G/PJ</Text>
        </View>

        {input.rows.map((r, i) => (
          <View key={r.id} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
            <Text style={styles.cRank}>{i + 1}</Text>
            <Text style={styles.cName}>{r.nombre}{r.genero ? ` (${r.genero})` : ''}</Text>
            <Text style={styles.cTeam}>{r.equipo}</Text>
            <Text style={styles.cComp}>{r.competicion}</Text>
            <Text style={styles.cMod}>{r.modalidad}</Text>
            <Text style={styles.cAnio}>{r.anio ?? '—'}</Text>
            <Text style={styles.cGoles}>{r.goles}</Text>
            <Text style={styles.cPj}>{r.partidos}</Text>
            <Text style={styles.cRatio}>{Number(r.golesPorPartido).toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>Generado con Cluberly · cluberly.club</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )

  return await pdf(doc).toBlob()
}
