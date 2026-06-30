import "server-only";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReportContent } from "@/lib/report-schema";
import type { Lead, Erfscan } from "@/lib/database.types";

const BRAND = "#1f6f54";
const CONCLUSIE_COLOR: Record<string, string> = {
  groen: "#16a34a",
  oranje: "#d97706",
  rood: "#dc2626",
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1f2937", lineHeight: 1.5 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingBottom: 10,
    marginBottom: 16,
  },
  brand: { fontSize: 16, fontWeight: 700, color: BRAND },
  docType: { fontSize: 11, color: "#6b7280" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  sub: { fontSize: 10, color: "#6b7280", marginBottom: 14 },
  badge: {
    alignSelf: "flex-start",
    color: "#fff",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 12,
  },
  intro: { marginBottom: 14 },
  factsBox: {
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  factRow: { flexDirection: "row", marginBottom: 3 },
  factLabel: { width: 130, color: "#6b7280" },
  factValue: { flex: 1, fontWeight: 700 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: BRAND,
    marginTop: 10,
    marginBottom: 4,
  },
  sectionBody: { marginBottom: 6 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#9ca3af",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
  },
});

function Fact({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={s.factRow}>
      <Text style={s.factLabel}>{label}</Text>
      <Text style={s.factValue}>{String(value)}</Text>
    </View>
  );
}

function ReportPdf({
  lead,
  erfscan,
  content,
}: {
  lead: Lead;
  erfscan: Erfscan;
  content: ReportContent;
}) {
  const d = (erfscan.dossier ?? {}) as Record<string, any>;
  const color = CONCLUSIE_COLOR[content.conclusie] ?? "#6b7280";
  const naam =
    lead.naam ||
    [lead.voornaam, lead.achternaam].filter(Boolean).join(" ") ||
    "—";

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>opeigenerf</Text>
          <Text style={s.docType}>Erf Check — indicatief rapport</Text>
        </View>

        <Text style={s.h1}>Erf Check voor {naam}</Text>
        <Text style={s.sub}>
          {d.locatie?.weergavenaam || ""} · {d.locatie?.gemeente || ""}
        </Text>

        <Text style={[s.badge, { backgroundColor: color }]}>
          {content.conclusie.toUpperCase()} — {content.conclusie_reden}
        </Text>

        <Text style={s.intro}>{content.samenvatting}</Text>

        <View style={s.factsBox}>
          <Fact label="Adres" value={d.locatie?.weergavenaam} />
          <Fact label="Gemeente" value={d.locatie?.gemeente} />
          <Fact label="Kadastraal perceel" value={d.perceel?.kadastrale_aanduiding} />
          <Fact
            label="Perceeloppervlakte"
            value={d.perceel?.oppervlakte_m2 ? `${d.perceel.oppervlakte_m2} m²` : null}
          />
          <Fact label="Bouwjaar hoofdgebouw" value={d.bag?.bouwjaar} />
          <Fact
            label="Vergunningvrij (indicatie)"
            value={
              d.ruimtelijk?.max_vergunningvrij_m2
                ? `± ${d.ruimtelijk.max_vergunningvrij_m2} m²`
                : null
            }
          />
        </View>

        {content.secties.map((sec, i) => (
          <View key={i} wrap={false}>
            <Text style={s.sectionTitle}>{sec.titel}</Text>
            <Text style={s.sectionBody}>{sec.inhoud}</Text>
          </View>
        ))}

        <Text style={s.footer} fixed>
          Dit rapport is een indicatieve Erf Check op basis van open data (PDOK,
          Kadaster/BAG, RCE) en is geen juridisch advies of vergunning. Definitieve
          haalbaarheid vraagt om verificatie bij de gemeente en de officiële
          Vergunningcheck. © opeigenerf.nl
        </Text>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(
  lead: Lead,
  erfscan: Erfscan,
  content: ReportContent,
): Promise<Buffer> {
  return renderToBuffer(
    <ReportPdf lead={lead} erfscan={erfscan} content={content} />,
  );
}
