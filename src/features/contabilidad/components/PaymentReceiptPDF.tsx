import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

// Same club logo used in TrialLetterPDF
const LOGO_BASE64 = 'data:image/png;base64,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'

const CLUB_NAME = 'Escuela de Futbol Ciudad de Getafe'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
}

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#222',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    gap: 15,
  },
  logo: {
    width: 60,
    height: 60,
  },
  clubName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    marginVertical: 15,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1a1a1a',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 11,
    color: '#555',
    width: '40%',
  },
  value: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#222',
    width: '60%',
    textAlign: 'right',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#333',
  },
  amountLabel: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#222',
  },
  amountValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#16a34a',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 50,
    right: 50,
    textAlign: 'center',
    fontSize: 9,
    color: '#999',
    lineHeight: 1.5,
  },
})

interface PaymentReceiptProps {
  playerName: string
  teamName: string
  amount: number
  method: string
  date: string
  concept: string
  receiptNumber: string
}

export function PaymentReceiptPDF({
  playerName,
  teamName,
  amount,
  method,
  date,
  concept,
  receiptNumber,
}: PaymentReceiptProps) {
  const formattedAmount = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)

  const formattedDate = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with logo */}
        <View style={styles.header}>
          <Image src={LOGO_BASE64} style={styles.logo} />
          <View>
            <Text style={styles.clubName}>{CLUB_NAME}</Text>
            <Text style={styles.subtitle}>Justificante de pago</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.title}>RECIBO DE PAGO</Text>

        {/* Receipt details */}
        <View style={styles.row}>
          <Text style={styles.label}>N. Recibo:</Text>
          <Text style={styles.value}>{receiptNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Fecha:</Text>
          <Text style={styles.value}>{formattedDate}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Jugador:</Text>
          <Text style={styles.value}>{playerName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Equipo:</Text>
          <Text style={styles.value}>{teamName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Concepto:</Text>
          <Text style={styles.value}>{concept}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Forma de pago:</Text>
          <Text style={styles.value}>{METHOD_LABELS[method] ?? method}</Text>
        </View>

        {/* Amount */}
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>TOTAL PAGADO:</Text>
          <Text style={styles.amountValue}>{formattedAmount}</Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {CLUB_NAME}{'\n'}
          Este documento sirve como justificante de pago. Conservelo para sus registros.
        </Text>
      </Page>
    </Document>
  )
}
