import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer";

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    backgroundColor: "#0a1628",
    padding: 60,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  border: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderWidth: 2,
    borderColor: "#cc3d00",
    borderStyle: "solid",
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  logoPlaceholder: {
    width: 200,
    height: 40,
    marginBottom: 12,
  },
  academyName: {
    fontSize: 11,
    color: "#cc3d00",
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  divider: {
    height: 1,
    backgroundColor: "#cc3d00",
    marginVertical: 20,
    opacity: 0.4,
  },
  certLabel: {
    fontSize: 10,
    color: "#a0aec0",
    textAlign: "center",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  certTitle: {
    fontSize: 28,
    color: "#ffffff",
    textAlign: "center",
    fontWeight: "bold",
    marginBottom: 24,
  },
  bodyText: {
    fontSize: 12,
    color: "#a0aec0",
    textAlign: "center",
    marginBottom: 8,
  },
  recipientName: {
    fontSize: 24,
    color: "#ffffff",
    textAlign: "center",
    marginVertical: 8,
  },
  courseTitle: {
    fontSize: 16,
    color: "#cc3d00",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  metaBlock: {
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 8,
    color: "#718096",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 11,
    color: "#cbd5e0",
  },
  footer: {
    alignItems: "center",
    marginTop: 20,
  },
  verifyCode: {
    fontSize: 8,
    color: "#4a5568",
    letterSpacing: 1,
    marginTop: 8,
  },
  qrPlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: "#1a2a3a",
    marginBottom: 6,
  },
});

// ── Props ──────────────────────────────────────────────────────────────────
interface CertPDFProps {
  recipientName: string;
  courseTitle: string;
  issuerName: string;
  issuedAt: Date;
  expiresAt?: Date | null;
  verifyCode: string;
  qrDataUrl?: string;
}

// ── Component ──────────────────────────────────────────────────────────────
export function CertificatePDF({
  recipientName,
  courseTitle,
  issuerName,
  issuedAt,
  expiresAt,
  verifyCode,
  qrDataUrl,
}: CertPDFProps) {
  const issued = issuedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const expires = expiresAt
    ? expiresAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "No Expiration";

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.border} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.academyName}>Kirby Learning Academy</Text>
          <View style={styles.divider} />
          <Text style={styles.certLabel}>Certificate of Completion</Text>
          <Text style={styles.certTitle}>This is to certify that</Text>
        </View>

        {/* Recipient */}
        <View style={{ alignItems: "center" }}>
          <Text style={styles.recipientName}>{recipientName}</Text>
          <Text style={styles.bodyText}>has successfully completed</Text>
          <Text style={styles.courseTitle}>{courseTitle}</Text>
          <Text style={styles.bodyText}>
            as presented by {issuerName}
          </Text>
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Date Issued</Text>
            <Text style={styles.metaValue}>{issued}</Text>
          </View>
          {qrDataUrl && (
            <View style={styles.metaBlock}>
              <Image src={qrDataUrl} style={styles.qrPlaceholder} />
            </View>
          )}
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Valid Through</Text>
            <Text style={styles.metaValue}>{expires}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.divider} />
          <Text style={styles.verifyCode}>Verification Code: {verifyCode}</Text>
          <Text style={styles.verifyCode}>Verify at: {issuerName}/verify/{verifyCode}</Text>
        </View>
      </Page>
    </Document>
  );
}
