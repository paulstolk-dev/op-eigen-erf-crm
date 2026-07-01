import "server-only";

import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReportContent } from "@/lib/report-schema";
import type { Lead, Erfscan } from "@/lib/database.types";

const BRAND = "#0a1b2b";
const ERF = "#718d69";
const CONCLUSIE_COLOR: Record<string, string> = {
  groen: "#16a34a",
  oranje: "#d97706",
  rood: "#dc2626",
};
const DOEL_LABEL: Record<string, string> = {
  mantelzorg: "Mantelzorgwoning",
  familiewoning: "Familiewoning (eerstegraads)",
  pre_mantelzorg: "Pré-mantelzorg",
  regulier: "Reguliere bewoning",
  orientatie: "Oriëntatie",
  onbekend: "Nog te bepalen",
};
const VERVOLG_LABEL: Record<string, string> = {
  gratis_adviesgesprek: "Gratis adviesgesprek",
  haalbaarheidsscan: "Haalbaarheidsscan (€495)",
  begeleidingstraject: "Begeleidingstraject",
};

// Canonieke bronnen (naam + url) — voor bronvermelding per onderdeel + lijst.
const SRC = {
  pdok_kadaster: {
    n: "PDOK — Kadastrale kaart (Basisregistratie Kadaster)",
    u: "https://www.pdok.nl/introductie/-/article/kadastrale-kaart",
  },
  bag: { n: "BAG Viewer (Kadaster) — bouwjaar & oppervlakte", u: "https://bagviewer.kadaster.nl/" },
  pdok_luchtfoto: { n: "PDOK — Luchtfoto (Actueel orthoHR)", u: "https://www.pdok.nl/" },
  rce: {
    n: "Rijksdienst voor het Cultureel Erfgoed — monumenten & beschermde gezichten",
    u: "https://www.cultureelerfgoed.nl/onderwerpen/monumenten",
  },
  cbs_kom: { n: "CBS — Bevolkingskernen (indicatie bebouwde kom)", u: "https://www.cbs.nl/" },
  iplo_bijbehorend: {
    n: "IPLO — Vergunningvrije bijbehorende bouwwerken",
    u: "https://iplo.nl/thema/bouw/bouwen-vergunning-melding/bijbehorende-bouwwerken/",
  },
  iplo_stappenplan: {
    n: "IPLO — Stappenplan vergunningvrij bouwen (ruimtelijk deel)",
    u: "https://iplo.nl/thema/bouw/bouwen-vergunning-melding/bijbehorende-bouwwerken/stappenplan-bepaling-vergunningvrij-bouwen/",
  },
  iplo_mantelzorg: {
    n: "IPLO — Ruimtelijke inpassing mantelzorgwoning",
    u: "https://iplo.nl/thema/toepassing-regels-praktijk/mantelzorgwoning/ruimtelijke-inpassing/",
  },
  omgevingsloket_regels: {
    n: "Omgevingsloket — Regels op de kaart (omgevingsplan)",
    u: "https://omgevingswet.overheid.nl/regels-op-de-kaart/",
  },
  omgevingsloket_check: {
    n: "Omgevingsloket — Vergunningcheck",
    u: "https://omgevingswet.overheid.nl/vergunningcheck/",
  },
  volkshuisvesting: {
    n: "Volkshuisvesting Nederland — Wet versterking regie volkshuisvesting (familie-/mantelzorgwoning)",
    u: "https://www.volkshuisvestingnederland.nl/onderwerpen/aanpak-woningnood/wet-versterking-regie-volkshuisvesting/kortere-procedures",
  },
} as const;

type SrcKey = keyof typeof SRC;

const s = StyleSheet.create({
  page: { padding: 38, paddingBottom: 60, fontSize: 9.5, color: "#1f2937", lineHeight: 1.5 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingBottom: 8,
    marginBottom: 14,
  },
  brand: { fontSize: 15, fontWeight: 700, color: BRAND },
  docType: { fontSize: 10, color: "#6b7280" },
  h1: { fontSize: 17, fontWeight: 700, marginBottom: 2 },
  sub: { fontSize: 9.5, color: "#6b7280", marginBottom: 12 },
  badge: {
    alignSelf: "flex-start",
    color: "#fff",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: 700,
    color: ERF,
    marginTop: 12,
    marginBottom: 3,
  },
  bronTag: { fontSize: 7.5, color: "#9ca3af", marginBottom: 4 },
  body: { marginBottom: 4 },
  box: { backgroundColor: "#f3f4f6", borderRadius: 6, padding: 10, marginBottom: 8 },
  kortRow: { flexDirection: "row", marginBottom: 3 },
  kortQ: { width: 118, color: BRAND, fontWeight: 700 },
  kortA: { flex: 1 },
  factRow: { flexDirection: "row", marginBottom: 2 },
  factLabel: { width: 150, color: "#6b7280" },
  factValue: { flex: 1 },
  factBron: { fontSize: 7.5, color: "#9ca3af" },
  li: { flexDirection: "row", marginBottom: 2 },
  liDot: { width: 10 },
  cta: {
    borderWidth: 1,
    borderColor: ERF,
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
    backgroundColor: "#f2f5f0",
  },
  ctaTitle: { fontWeight: 700, color: ERF, marginBottom: 2 },
  srcItem: { flexDirection: "row", marginBottom: 2 },
  srcNum: { width: 14, color: "#6b7280" },
  srcLink: { flex: 1, fontSize: 8, color: "#374151", textDecoration: "none" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 38,
    right: 38,
    fontSize: 7.5,
    color: "#9ca3af",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 5,
  },
});

function BronTag({ keys }: { keys: SrcKey[] }) {
  const namen = [...new Set(keys.map((k) => SRC[k].n.split(" — ")[0]))];
  return <Text style={s.bronTag}>Bron: {namen.join(", ")}</Text>;
}

function Fact({
  label,
  value,
  bron,
}: {
  label: string;
  value?: string | number | null;
  bron?: string;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={s.factRow}>
      <Text style={s.factLabel}>{label}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.factValue}>{String(value)}</Text>
        {bron ? <Text style={s.factBron}>bron: {bron}</Text> : null}
      </View>
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((t, i) => (
        <View key={i} style={s.li}>
          <Text style={s.liDot}>•</Text>
          <Text style={{ flex: 1 }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

const TIER3_LABEL: Record<string, string> = {
  bebouwde_kom: "Bebouwde kom",
  zorgvraag: "Zorgvraag (mantelzorg)",
  beschermd_dorpsgezicht: "Beschermd gezicht / monument",
  vergunningcheck: "Vergunningcheck",
  welstand_principeverzoek: "Welstand / principeverzoek",
};

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
  const t3 = (erfscan.tier3 ?? {}) as Record<string, string>;
  const sug = (d.tier3_suggesties ?? {}) as Record<string, { bron?: string; zekerheid?: string }>;
  const color = CONCLUSIE_COLOR[content.conclusie] ?? "#6b7280";
  const naam =
    lead.naam || [lead.voornaam, lead.achternaam].filter(Boolean).join(" ") || "—";
  const grootte =
    (lead.details as any)?.grootte ||
    (lead.details as any)?.gewenste_grootte ||
    "n.b. (navragen)";

  // Bronnenlijst achteraan (alleen wat relevant is).
  const bronLijst: SrcKey[] = [
    "pdok_kadaster",
    "bag",
    "pdok_luchtfoto",
    "iplo_bijbehorend",
    "iplo_stappenplan",
    "iplo_mantelzorg",
    "omgevingsloket_regels",
    "omgevingsloket_check",
    "volkshuisvesting",
    "rce",
    "cbs_kom",
  ];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>opeigenerf</Text>
          <Text style={s.docType}>Gratis Erf Check — indicatief</Text>
        </View>

        <Text style={s.h1}>Erf Check voor {naam}</Text>
        <Text style={s.sub}>
          {d.locatie?.weergavenaam || ""}
          {d.locatie?.gemeente ? ` · gemeente ${d.locatie.gemeente}` : ""}
        </Text>

        {/* 1. Samenvatting */}
        <Text style={s.sectionTitle}>1. Samenvatting</Text>
        <View style={s.box}>
          <Fact label="Adres" value={d.locatie?.weergavenaam} />
          <Fact label="Doel" value={DOEL_LABEL[content.doel_type] ?? content.doel_type} />
          <Fact label="Gewenste grootte" value={grootte} />
          <View style={s.factRow}>
            <Text style={s.factLabel}>Eerste conclusie</Text>
            <Text style={[s.badge, { backgroundColor: color }]}>
              {content.conclusie.toUpperCase()}
            </Text>
          </View>
          <Fact
            label="Advies"
            value={VERVOLG_LABEL[content.advies_vervolgstap] ?? content.advies_vervolgstap}
          />
        </View>
        <Text style={s.body}>{content.samenvatting}</Text>

        {/* In het kort — 5 kernvragen */}
        <Text style={s.sectionTitle}>In het kort</Text>
        <View style={s.box}>
          <View style={s.kortRow}>
            <Text style={s.kortQ}>Ruimte achtererf</Text>
            <Text style={s.kortA}>{content.kort.ruimte_achtererf}</Text>
          </View>
          <View style={s.kortRow}>
            <Text style={s.kortQ}>Vergunningvrij?</Text>
            <Text style={s.kortA}>{content.kort.vergunningvrij}</Text>
          </View>
          <View style={s.kortRow}>
            <Text style={s.kortQ}>Route</Text>
            <Text style={s.kortA}>{content.kort.route}</Text>
          </View>
          <View style={s.kortRow}>
            <Text style={s.kortQ}>Risico's</Text>
            <Text style={s.kortA}>{content.kort.risicos}</Text>
          </View>
          <View style={s.kortRow}>
            <Text style={s.kortQ}>Vervolgstap</Text>
            <Text style={s.kortA}>{content.kort.vervolgstap}</Text>
          </View>
        </View>

        {/* 2. Locatie & perceel */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>2. Locatie &amp; perceel</Text>
          <BronTag keys={["pdok_kadaster", "bag", "pdok_luchtfoto"]} />
          <Text style={s.body}>{content.locatie_perceel}</Text>
          <View style={s.box}>
            <Fact
              label="Kadastraal perceel"
              value={d.perceel?.kadastrale_aanduiding}
              bron="PDOK Kadastrale kaart"
            />
            <Fact
              label="Perceeloppervlakte"
              value={d.perceel?.oppervlakte_m2 ? `${d.perceel.oppervlakte_m2} m²` : null}
              bron="PDOK Kadaster"
            />
            <Fact label="Bouwjaar hoofdgebouw" value={d.bag?.bouwjaar} bron="BAG" />
            <Fact
              label="Footprint hoofdgebouw"
              value={
                d.ruimtelijk?.footprint_hoofdgebouw_m2
                  ? `${d.ruimtelijk.footprint_hoofdgebouw_m2} m²`
                  : null
              }
              bron="BAG"
            />
          </View>
        </View>

        {/* 3. Regelcheck */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>3. Regelcheck — wat mag nu?</Text>
          <BronTag
            keys={[
              "iplo_stappenplan",
              "omgevingsloket_regels",
              "omgevingsloket_check",
              "volkshuisvesting",
            ]}
          />
          <Text style={s.body}>{content.regelcheck}</Text>
          <View style={s.box}>
            <Fact
              label="Vergunningvrij (indicatie)"
              value={
                d.ruimtelijk?.max_vergunningvrij_m2
                  ? `± ${d.ruimtelijk.max_vergunningvrij_m2} m²`
                  : null
              }
              bron="IPLO-staffel + eigen berekening (indicatie)"
            />
            {Object.entries(t3).map(([k, v]) =>
              v ? (
                <Fact
                  key={k}
                  label={TIER3_LABEL[k] ?? k}
                  value={v}
                  bron={
                    sug[k]?.bron
                      ? `${sug[k].bron}${sug[k].zekerheid ? ` (${sug[k].zekerheid})` : ""}`
                      : "handmatig bevestigd"
                  }
                />
              ) : null,
            )}
          </View>
        </View>

        {/* 4. Kansen */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>4. Kansen</Text>
          <Bullets items={content.kansen} />
        </View>

        {/* 5. Aandachtspunten */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>5. Aandachtspunten</Text>
          <Bullets items={content.aandachtspunten} />
        </View>

        {/* 6. Advies & vervolgstap */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>6. Advies &amp; vervolgstap</Text>
          <Text style={s.body}>{content.advies_tekst}</Text>
          <View style={s.cta}>
            <Text style={s.ctaTitle}>Aanbevolen: {VERVOLG_LABEL[content.advies_vervolgstap]}</Text>
            <Text>Plan een gratis adviesgesprek, of start de Haalbaarheidsscan (€495) —</Text>
            <Text>dit bedrag wordt verrekend bij afname van een begeleidingstraject.</Text>
          </View>
        </View>

        {/* Bronnen */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>Geraadpleegde bronnen</Text>
          {bronLijst.map((k, i) => (
            <View key={k} style={s.srcItem}>
              <Text style={s.srcNum}>{i + 1}.</Text>
              <Link style={s.srcLink} src={SRC[k].u}>
                {SRC[k].n}
              </Link>
            </View>
          ))}
        </View>

        <Text style={s.footer} fixed>
          Deze gratis Erf Check is een indicatieve eerste beoordeling op basis van
          open data (PDOK, Kadaster/BAG, RCE, CBS) en de landelijke regels (IPLO,
          Omgevingsloket). Het is géén juridisch advies, vergunning of definitieve
          maatvoering. Exacte bouwruimte en lokale regels worden getoetst in de
          Haalbaarheidsscan. © opeigenerf.nl
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
