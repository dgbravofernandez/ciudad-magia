import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// Register a clean font (Helvetica is built-in)

const styles = StyleSheet.create({
  page: {
    padding: 60,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.6,
    color: '#222',
  },
  header: {
    textAlign: 'center',
    marginBottom: 30,
  },
  clubName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 25,
    textTransform: 'uppercase',
    borderBottom: '2 solid #333',
    paddingBottom: 8,
  },
  dateLine: {
    textAlign: 'right',
    fontSize: 10,
    color: '#555',
    marginBottom: 20,
  },
  paragraph: {
    marginBottom: 12,
    textAlign: 'justify',
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  playerInfo: {
    marginVertical: 15,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderLeft: '3 solid #333',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    fontFamily: 'Helvetica-Bold',
    width: 140,
  },
  infoValue: {
    flex: 1,
  },
  disclaimer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#fff8e1',
    borderLeft: '3 solid #f5a623',
    fontSize: 10,
  },
  disclaimerTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 4,
    color: '#b7791f',
  },
  signature: {
    marginTop: 40,
    textAlign: 'center',
  },
  signatureLine: {
    borderTop: '1 solid #333',
    width: 200,
    marginHorizontal: 'auto',
    marginTop: 50,
    paddingTop: 5,
    textAlign: 'center',
    fontSize: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 60,
    right: 60,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
    borderTop: '1 solid #ddd',
    paddingTop: 8,
  },
})

interface TrialLetterPDFProps {
  clubName: string
  playerName: string
  playerDob: string | null
  tutorName: string | null
  trialDate: string
  clubDestino: string
  currentDate: string
}

export function TrialLetterPDF({
  clubName,
  playerName,
  playerDob,
  tutorName,
  trialDate,
  clubDestino,
  currentDate,
}: TrialLetterPDFProps) {
  const dobFormatted = playerDob
    ? new Date(playerDob).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'No registrada'
  const trialDateFormatted = new Date(trialDate).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.clubName}>{clubName}</Text>
          <Text style={{ fontSize: 9, color: '#666' }}>CIF: G-XXXXXXXX</Text>
        </View>

        <Text style={styles.dateLine}>
          Getafe, a {currentDate}
        </Text>

        <Text style={styles.title}>Carta de Pruebas Deportivas</Text>

        {/* Body */}
        <Text style={styles.paragraph}>
          Por medio de la presente, <Text style={styles.bold}>{clubName}</Text> hace constar
          que el/la jugador/a cuyos datos se detallan a continuacion es miembro de este club
          y se le autoriza a realizar pruebas deportivas con el club{' '}
          <Text style={styles.bold}>{clubDestino}</Text> en la fecha indicada.
        </Text>

        {/* Player Info Box */}
        <View style={styles.playerInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nombre del jugador/a:</Text>
            <Text style={styles.infoValue}>{playerName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha de nacimiento:</Text>
            <Text style={styles.infoValue}>{dobFormatted}</Text>
          </View>
          {tutorName && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tutor/a legal:</Text>
              <Text style={styles.infoValue}>{tutorName}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Club de destino:</Text>
            <Text style={styles.infoValue}>{clubDestino}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha de la prueba:</Text>
            <Text style={styles.infoValue}>{trialDateFormatted}</Text>
          </View>
        </View>

        <Text style={styles.paragraph}>
          Esta autorizacion se expide a efectos de que el/la jugador/a pueda participar
          en las pruebas deportivas organizadas por el club de destino, sin que ello suponga
          la baja o modificacion de su vinculacion actual con{' '}
          <Text style={styles.bold}>{clubName}</Text>, salvo que ambas partes acuerden
          lo contrario por escrito.
        </Text>

        <Text style={styles.paragraph}>
          Asimismo, se informa que la participacion en dichas pruebas es voluntaria y que
          el club de destino sera el responsable de la organizacion y supervision de las
          mismas durante su desarrollo.
        </Text>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerTitle}>EXENCION DE RESPONSABILIDAD</Text>
          <Text>
            {clubName} no se hace responsable de las lesiones, accidentes, percances
            o cualquier otro tipo de dano fisico o material que pudiera producirse durante
            la realizacion de las pruebas deportivas en las instalaciones del club de destino.
            La responsabilidad sobre la seguridad y cobertura del jugador/a durante las pruebas
            recae exclusivamente en el club organizador de las mismas y, en su caso, en los
            tutores legales del/la menor. Se recomienda verificar que el club de destino
            dispone de un seguro deportivo que cubra al jugador/a durante la actividad.
          </Text>
        </View>

        <Text style={[styles.paragraph, { marginTop: 20 }]}>
          Y para que conste a los efectos oportunos, se firma la presente en Getafe,
          a {currentDate}.
        </Text>

        {/* Signature */}
        <View style={styles.signature}>
          <View style={styles.signatureLine}>
            <Text>La Direccion</Text>
            <Text style={{ fontSize: 9, marginTop: 2 }}>{clubName}</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {clubName} — Documento generado automaticamente. Este documento tiene validez
          unicamente para la fecha y el club de destino indicados.
        </Text>
      </Page>
    </Document>
  )
}
