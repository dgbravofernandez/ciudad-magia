import { Document, Page, Text, View, StyleSheet, Image, Svg, Path } from '@react-pdf/renderer'

// Club logo as base64 data URI
const LOGO_BASE64 = 'data:image/png;base64,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'

const styles = StyleSheet.create({
  page: {
    padding: 60,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.6,
    color: '#222',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
    gap: 15,
  },
  logo: {
    width: 55,
    height: 55,
  },
  headerText: {
    textAlign: 'center',
  },
  clubName: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  cif: {
    fontSize: 9,
    color: '#666',
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 22,
    textTransform: 'uppercase',
    borderBottom: '2 solid #333',
    paddingBottom: 8,
  },
  dateLine: {
    textAlign: 'right',
    fontSize: 10,
    color: '#555',
    marginBottom: 18,
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
    marginTop: 18,
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
  signatureBlock: {
    marginTop: 35,
    alignItems: 'center',
  },
  signatureScribble: {
    marginBottom: 4,
  },
  signatureLine: {
    borderTop: '1 solid #333',
    width: 200,
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
        {/* Header with logo */}
        <View style={styles.header}>
          <Image src={LOGO_BASE64} style={styles.logo} />
          <View style={styles.headerText}>
            <Text style={styles.clubName}>{clubName}</Text>
            <Text style={styles.cif}>CIF: G-79896478</Text>
          </View>
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

        <Text style={[styles.paragraph, { marginTop: 18 }]}>
          Y para que conste a los efectos oportunos, se firma la presente en Getafe,
          a {currentDate}.
        </Text>

        {/* Signature with scribble */}
        <View style={styles.signatureBlock}>
          <View style={styles.signatureScribble}>
            <Svg width={120} height={40} viewBox="0 0 120 40">
              {/* Simulated handwritten signature scribble */}
              <Path
                d="M 8 30 C 12 10, 18 8, 25 18 S 30 32, 38 22 S 42 8, 50 16 S 55 28, 62 20 C 68 12, 72 14, 75 22 S 82 30, 88 18 C 92 10, 96 14, 100 22 S 106 28, 112 20"
                stroke="#1a1a1a"
                strokeWidth={1.2}
                fill="none"
              />
              <Path
                d="M 15 26 C 20 18, 28 16, 35 24 S 45 30, 52 20 C 58 14, 65 18, 70 24 S 80 28, 90 16"
                stroke="#1a1a1a"
                strokeWidth={0.8}
                fill="none"
              />
              {/* Underline stroke */}
              <Path
                d="M 10 35 Q 60 32, 110 35"
                stroke="#1a1a1a"
                strokeWidth={0.6}
                fill="none"
              />
            </Svg>
          </View>
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
