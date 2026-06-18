import { Document, Page, Text, View, StyleSheet, Image, Svg, Path } from '@react-pdf/renderer'

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
  cif?: string | null
  logoUrl?: string | null
  playerName: string
  playerDob: string | null
  tutorName: string | null
  trialDate: string
  clubDestino: string
  currentDate: string
}

export function TrialLetterPDF({
  clubName,
  cif,
  logoUrl,
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
          {logoUrl && <Image src={logoUrl} style={styles.logo} />}
          <View style={styles.headerText}>
            <Text style={styles.clubName}>{clubName}</Text>
            {cif ? <Text style={styles.cif}>CIF: {cif}</Text> : null}
          </View>
        </View>

        <Text style={styles.dateLine}>
          {currentDate}
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
          Y para que conste a los efectos oportunos, se firma la presente a {currentDate}.
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
