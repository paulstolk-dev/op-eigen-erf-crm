import "server-only";

import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { LOGO_PNG } from "@/lib/logo-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReportContent } from "@/lib/report-schema";
import type { Lead, Erfscan } from "@/lib/database.types";

const BRAND = "#0a1b2b";
const ERF = "#718d69";
const SCAN_URL = "https://opeigenerf.nl/haalbaarheidsscan";
const KENNISMAKING_URL = "https://opeigenerf.nl/kennismaking";

// Uitslag (intern groen/oranje/rood) → begrijpelijk woord + kleur + toelichting.
const CONCLUSIE: Record<
  string,
  { woord: string; kleur: string; uitleg: string }
> = {
  groen: {
    woord: "Kansrijk",
    kleur: "#16a34a",
    uitleg:
      "Geautomatiseerde indicatie op basis van je perceelgrootte. Dit is nog geen bouwoordeel — de exacte ruimte in je achtererf volgt in de uitgebreide scan.",
  },
  oranje: {
    woord: "Twijfelachtig",
    kleur: "#d97706",
    uitleg:
      "Er zijn aandachtspunten die eerst uitgezocht moeten worden. De uitgebreide scan geeft zekerheid over de regels, ruimte en risico's.",
  },
  rood: {
    woord: "Complex",
    kleur: "#dc2626",
    uitleg:
      "Er spelen beperkingen die je plan kunnen blokkeren. Een gratis adviesgesprek of de uitgebreide scan brengt de risico's scherp in beeld.",
  },
};

const SCAN_PUNTEN = [
  "luchtfoto met de bestaande bebouwing ingemeten",
  "exacte berekening van de ruimte in jóuw achtererf",
  "kostenindicatie in prijsbanden",
  "advies over passende woningtypes",
  "de route die bij jouw situatie past",
  "een concreet stappenplan",
];

const s = StyleSheet.create({
  page: { padding: 30, paddingBottom: 46, fontSize: 9.5, color: "#1f2937", lineHeight: 1.4 },
  disclaimerTop: { fontSize: 7, color: "#9ca3af", marginBottom: 7, lineHeight: 1.35 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  logo: { height: 22 },
  tagline: { fontSize: 7.5, color: "#6b7280", textAlign: "right" },
  taglineStrong: { color: BRAND, fontWeight: 700 },
  eyebrow: { fontSize: 8.5, fontWeight: 700, color: ERF, letterSpacing: 1, marginBottom: 2 },
  adres: { fontSize: 15, fontWeight: 700, color: BRAND, lineHeight: 1.15, marginBottom: 3 },
  datum: { fontSize: 8.5, color: "#6b7280", marginBottom: 8 },
  h1: { fontSize: 13, fontWeight: 700, color: BRAND, lineHeight: 1.15, marginBottom: 2 },
  intro: { fontSize: 9.5, color: "#4b5563", marginBottom: 8 },
  foto: { width: "100%", height: 150, objectFit: "cover", borderRadius: 6 },
  fotoBron: { fontSize: 7, color: "#9ca3af", marginTop: 2, marginBottom: 10 },
  row: { flexDirection: "row", gap: 10, marginBottom: 10 },
  card: { flex: 1, backgroundColor: "#f3f4f6", borderRadius: 8, padding: 10 },
  cardLabel: { fontSize: 7.5, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, marginBottom: 2 },
  opp: { fontSize: 20, fontWeight: 700, color: BRAND, lineHeight: 1.1, marginBottom: 4 },
  cardBron: { fontSize: 7, color: "#9ca3af" },
  badge: {
    alignSelf: "flex-start",
    color: "#fff",
    paddingVertical: 2,
    paddingHorizontal: 9,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 4,
  },
  cardUitleg: { fontSize: 8, color: "#4b5563", lineHeight: 1.4 },
  sectie: { fontSize: 9.5, fontWeight: 700, color: ERF, letterSpacing: 0.5, marginBottom: 5 },
  regelRow: { flexDirection: "row", marginBottom: 5, alignItems: "flex-start" },
  regelKop: { width: 122 },
  regelNaam: { fontWeight: 700, color: BRAND, fontSize: 9.5 },
  regelWanneer: { fontSize: 7.5, color: ERF, fontWeight: 700 },
  regelTekst: { flex: 1, fontSize: 8.5, color: "#4b5563" },
  scanBox: {
    borderWidth: 1.5,
    borderColor: ERF,
    borderRadius: 8,
    padding: 11,
    marginTop: 6,
    backgroundColor: "#f2f5f0",
  },
  scanTitle: { fontSize: 10.5, fontWeight: 700, color: BRAND, marginBottom: 6, textDecoration: "none" },
  scanBullet: {
    flexDirection: "row",
    marginBottom: 3,
    color: "#374151",
    textDecoration: "none",
    fontSize: 9,
  },
  scanArrow: { width: 13, color: ERF, fontWeight: 700 },
  scanCta: { fontSize: 8.5, color: ERF, fontWeight: 700, marginTop: 6, textDecoration: "none" },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 30,
    right: 30,
    fontSize: 7,
    color: "#9ca3af",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 4,
    lineHeight: 1.35,
  },
});

function datumNL(): string {
  return new Date().toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ReportPdf({
  erfscan,
  content,
  luchtfoto,
}: {
  erfscan: Erfscan;
  content: ReportContent;
  luchtfoto: string | null;
}) {
  const d = (erfscan.dossier ?? {}) as Record<string, any>;
  const adres = d.locatie?.weergavenaam || "Onbekend adres";
  const opp = d.perceel?.oppervlakte_m2 as number | undefined;
  const c = CONCLUSIE[content.conclusie] ?? CONCLUSIE.oranje;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.disclaimerTop}>
          Geautomatiseerde eerste indicatie · geen juridisch advies. Perceel:
          Kadaster (BRK). Regelgeving: Volkshuisvesting Nederland, VNG. Laatst
          bijgewerkt: {datumNL()}.
        </Text>

        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={LOGO_PNG} style={s.logo} />
          <Text style={s.tagline}>
            <Text style={s.taglineStrong}>opeigenerf.nl</Text>
            {"\n"}Onafhankelijk — we bouwen zelf niet.
          </Text>
        </View>

        <Text style={s.eyebrow}>GRATIS ERFCHECK</Text>
        <Text style={s.adres}>{adres}</Text>
        <Text style={s.datum}>Opgesteld {datumNL()}</Text>

        <Text style={s.h1}>Wat lijkt er mogelijk op jouw erf?</Text>
        <Text style={s.intro}>
          Een eerste, geautomatiseerde indicatie op basis van je kadastrale perceel.
        </Text>

        {luchtfoto ? (
          <>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={luchtfoto} style={s.foto} />
            <Text style={s.fotoBron}>
              Luchtfoto · bron: PDOK (Beeldmateriaal Nederland)
            </Text>
          </>
        ) : null}

        <View style={s.row}>
          <View style={s.card}>
            <Text style={s.cardLabel}>PERCEELOPPERVLAKTE</Text>
            <Text style={s.opp}>{opp ? `± ${opp} m²` : "n.b."}</Text>
            <Text style={s.cardBron}>Bron: Kadaster (BRK)</Text>
          </View>
          <View style={s.card}>
            <Text style={[s.badge, { backgroundColor: c.kleur }]}>{c.woord}</Text>
            <Text style={s.cardUitleg}>{c.uitleg}</Text>
          </View>
        </View>

        <Text style={s.sectie}>WELKE REGELGEVING SPEELT</Text>
        <View style={s.regelRow}>
          <View style={s.regelKop}>
            <Text style={s.regelNaam}>Mantelzorgwoning</Text>
            <Text style={s.regelWanneer}>kan nú</Text>
          </View>
          <Text style={s.regelTekst}>
            Onder voorwaarden vergunningvrij mogelijk onder geldend recht (mits een
            aantoonbare zorgrelatie).
          </Text>
        </View>
        <View style={s.regelRow}>
          <View style={s.regelKop}>
            <Text style={s.regelNaam}>Familiewoning</Text>
            <Text style={s.regelWanneer}>aankomend</Text>
          </View>
          <Text style={s.regelTekst}>
            Zelfstandige woning zonder vergunning — via de Wet versterking regie
            volkshuisvesting, nog niet definitief in werking.
          </Text>
        </View>

        {/* Klikbaar CTA-blok → haalbaarheidsscan */}
        <View style={s.scanBox} wrap={false}>
          <Link src={SCAN_URL} style={s.scanTitle}>
            In de uitgebreide scan (€99) kijken we verder »
          </Link>
          {SCAN_PUNTEN.map((punt, i) => (
            <Link key={i} src={SCAN_URL} style={s.scanBullet}>
              <Text style={s.scanArrow}>• </Text>
              <Text>{punt}</Text>
            </Link>
          ))}
          <Link src={SCAN_URL} style={s.scanCta}>
            Start de Haalbaarheidsscan » opeigenerf.nl/haalbaarheidsscan
          </Link>
        </View>

        <Text style={s.footer} fixed>
          Deze gratis Erf Check is een geautomatiseerde, indicatieve eerste
          beoordeling op basis van open data (Kadaster/BRK, PDOK) en landelijke
          regels. Géén juridisch advies, vergunning of definitieve maatvoering. De
          exacte bouwruimte en lokale regels worden bepaald in de{" "}
          <Link src={SCAN_URL} style={{ color: ERF }}>
            Haalbaarheidsscan
          </Link>
          . Vragen? Plan een gratis gesprek: {KENNISMAKING_URL}. © opeigenerf.nl
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
  void lead;
  // Luchtfoto uit de privé-bucket ophalen en als data-URI insluiten.
  let luchtfoto: string | null = null;
  if (erfscan.luchtfoto_path) {
    try {
      const admin = createAdminClient();
      const { data: blob } = await admin.storage
        .from("erfscans")
        .download(erfscan.luchtfoto_path);
      if (blob) {
        const buf = Buffer.from(await blob.arrayBuffer());
        // Mime moet kloppen (engine slaat png óf jpg op), anders rendert de
        // afbeelding niet.
        const p = erfscan.luchtfoto_path.toLowerCase();
        const mime =
          blob.type && blob.type.startsWith("image/")
            ? blob.type
            : p.endsWith(".jpg") || p.endsWith(".jpeg")
              ? "image/jpeg"
              : "image/png";
        luchtfoto = `data:${mime};base64,${buf.toString("base64")}`;
      }
    } catch {
      luchtfoto = null;
    }
  }
  return renderToBuffer(
    <ReportPdf erfscan={erfscan} content={content} luchtfoto={luchtfoto} />,
  );
}
