import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { scoreLead } from "@/lib/lead-score";
import type { Lead, Erfscan, Aanbieder } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// HubSpot-sync (CRM -> HubSpot). Leads worden contacten + een deal; aanbieders
// worden companies. Erfcheck-data (score/conclusie/rapportstatus) komt als
// custom contact-properties mee. Idempotent: contacten/companies upserten op
// e-mail/domein, deals/companies-id's onthouden we in hubspot_sync-tabellen.
// ---------------------------------------------------------------------------

const BASE = "https://api.hubapi.com";

export function hubspotConfigured(): boolean {
  return Boolean(process.env.HUBSPOT_ACCESS_TOKEN);
}

async function hs<T = unknown>(
  path: string,
  init?: RequestInit & { method?: string },
): Promise<T | null> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN niet gezet.");
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `HubSpot ${init?.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 400)}`,
    );
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

// --- Custom properties (eenmalig per server-instance aanmaken) --------------
let contactPropsEnsured = false;
let companyPropsEnsured = false;

async function ensureGroup(objectType: string, name: string, label: string) {
  try {
    await hs(`/crm/v3/properties/${objectType}/groups`, {
      method: "POST",
      body: JSON.stringify({ name, label, displayOrder: -1 }),
    });
  } catch (e) {
    if (!String(e).includes("409")) throw e; // 409 = bestaat al
  }
}

async function ensureProperty(
  objectType: string,
  prop: Record<string, unknown>,
) {
  try {
    await hs(`/crm/v3/properties/${objectType}`, {
      method: "POST",
      body: JSON.stringify(prop),
    });
  } catch (e) {
    if (!String(e).includes("409")) throw e;
  }
}

async function ensureContactProperties() {
  if (contactPropsEnsured) return;
  await ensureGroup("contacts", "erfcheck", "Erfcheck");
  await ensureProperty("contacts", {
    name: "erfcheck_leadscore",
    label: "Erfcheck leadscore",
    type: "number",
    fieldType: "number",
    groupName: "erfcheck",
  });
  await ensureProperty("contacts", {
    name: "erfcheck_conclusie",
    label: "Erfcheck conclusie",
    type: "enumeration",
    fieldType: "select",
    groupName: "erfcheck",
    options: [
      { label: "Groen", value: "groen", displayOrder: 0 },
      { label: "Oranje", value: "oranje", displayOrder: 1 },
      { label: "Rood", value: "rood", displayOrder: 2 },
    ],
  });
  await ensureProperty("contacts", {
    name: "erfcheck_rapportstatus",
    label: "Erfcheck rapportstatus",
    type: "enumeration",
    fieldType: "select",
    groupName: "erfcheck",
    options: [
      { label: "Geen", value: "geen", displayOrder: 0 },
      { label: "Gegenereerd", value: "gegenereerd", displayOrder: 1 },
      { label: "Verzonden", value: "verzonden", displayOrder: 2 },
    ],
  });
  for (const [name, label] of [
    ["erfcheck_leadstatus", "Erfcheck leadstatus"],
    ["erfcheck_doelgroep", "Erfcheck doelgroep"],
  ]) {
    await ensureProperty("contacts", {
      name,
      label,
      type: "string",
      fieldType: "text",
      groupName: "erfcheck",
    });
  }
  await ensureProperty("contacts", {
    name: "erfcheck_perceel_m2",
    label: "Erfcheck perceel (m²)",
    type: "number",
    fieldType: "number",
    groupName: "erfcheck",
  });
  contactPropsEnsured = true;
}

async function ensureCompanyProperties() {
  if (companyPropsEnsured) return;
  await ensureGroup("companies", "erfcheck", "Erfcheck");
  await ensureProperty("companies", {
    name: "erfcheck_prijsklasse",
    label: "Erfcheck prijsklasse",
    type: "string",
    fieldType: "text",
    groupName: "erfcheck",
  });
  await ensureProperty("companies", {
    name: "erfcheck_contactpersoon",
    label: "Erfcheck contactpersoon",
    type: "string",
    fieldType: "text",
    groupName: "erfcheck",
  });
  await ensureProperty("companies", {
    name: "erfcheck_contact_email",
    label: "Erfcheck contact-e-mail",
    type: "string",
    fieldType: "text",
    groupName: "erfcheck",
  });
  await ensureProperty("companies", {
    name: "erfcheck_partner_status",
    label: "Erfcheck partnerstatus",
    type: "string",
    fieldType: "text",
    groupName: "erfcheck",
  });
  companyPropsEnsured = true;
}

function reportStatus(erfscan?: Erfscan | null): string {
  if (!erfscan) return "geen";
  if (erfscan.sent_at) return "verzonden";
  if (erfscan.report_pdf_path || erfscan.draft_email_body) return "gegenereerd";
  return "geen";
}

// HubSpot default-pipeline stages op basis van onze leadstatus.
function dealStage(status: string): string {
  if (status === "gewonnen") return "closedwon";
  if (status === "verloren") return "closedlost";
  return "appointmentscheduled";
}

function domainFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// --- Lead -> Contact + Deal --------------------------------------------------
export async function syncLeadToHubspot(
  leadId: string,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!hubspotConfigured()) return { ok: true, skipped: true };
  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single<Lead>();
  if (!lead) return { ok: false, error: "Lead niet gevonden." };
  const { data: erfscan } = await admin
    .from("erfscans")
    .select("*")
    .eq("lead_id", leadId)
    .maybeSingle<Erfscan>();
  const { data: mapping } = await admin
    .from("hubspot_sync")
    .select("*")
    .eq("lead_id", leadId)
    .maybeSingle();

  try {
    await ensureContactProperties();
    const score = scoreLead(lead, erfscan);
    const d = (erfscan?.dossier ?? {}) as { perceel?: { oppervlakte_m2?: number } };
    const naam =
      [lead.voornaam, lead.achternaam].filter(Boolean).join(" ") || lead.naam || "";

    const contactProps: Record<string, string> = {
      erfcheck_leadscore: String(score.score),
      erfcheck_conclusie: erfscan?.conclusie ?? "",
      erfcheck_rapportstatus: reportStatus(erfscan),
      erfcheck_leadstatus: lead.status ?? "",
      erfcheck_doelgroep: lead.audience ?? "",
    };
    if (lead.voornaam) contactProps.firstname = lead.voornaam;
    if (lead.achternaam) contactProps.lastname = lead.achternaam;
    if (!lead.voornaam && !lead.achternaam && lead.naam)
      contactProps.firstname = lead.naam;
    if (lead.telefoon) contactProps.phone = lead.telefoon;
    if (lead.postcode) contactProps.zip = lead.postcode;
    if (d.perceel?.oppervlakte_m2)
      contactProps.erfcheck_perceel_m2 = String(d.perceel.oppervlakte_m2);

    // Contact upserten op e-mail; zonder e-mail op onthouden id, anders nieuw.
    let contactId: string | undefined = mapping?.contact_id ?? undefined;
    if (lead.email) {
      const up = await hs<{ results: { id: string }[] }>(
        "/crm/v3/objects/contacts/batch/upsert",
        {
          method: "POST",
          body: JSON.stringify({
            inputs: [
              { idProperty: "email", id: lead.email, properties: { email: lead.email, ...contactProps } },
            ],
          }),
        },
      );
      contactId = up?.results?.[0]?.id ?? contactId;
    } else if (contactId) {
      await hs(`/crm/v3/objects/contacts/${contactId}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: contactProps }),
      });
    } else {
      const created = await hs<{ id: string }>("/crm/v3/objects/contacts", {
        method: "POST",
        body: JSON.stringify({ properties: contactProps }),
      });
      contactId = created?.id;
    }

    // Deal aanmaken/bijwerken en koppelen aan het contact.
    const dealProps = {
      dealname: `Erf Check — ${naam || lead.email || "lead"}`,
      pipeline: "default",
      dealstage: dealStage(lead.status),
    };
    let dealId: string | undefined = mapping?.deal_id ?? undefined;
    if (dealId) {
      await hs(`/crm/v3/objects/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: dealProps }),
      });
    } else {
      const created = await hs<{ id: string }>("/crm/v3/objects/deals", {
        method: "POST",
        body: JSON.stringify({
          properties: dealProps,
          associations: contactId
            ? [
                {
                  to: { id: contactId },
                  types: [
                    { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 },
                  ],
                },
              ]
            : [],
        }),
      });
      dealId = created?.id;
    }

    await admin.from("hubspot_sync").upsert(
      {
        lead_id: leadId,
        contact_id: contactId ?? null,
        deal_id: dealId ?? null,
        synced_at: new Date().toISOString(),
        error: null,
      },
      { onConflict: "lead_id" },
    );
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    await admin.from("hubspot_sync").upsert(
      { lead_id: leadId, synced_at: new Date().toISOString(), error: msg },
      { onConflict: "lead_id" },
    );
    return { ok: false, error: msg };
  }
}

// --- Aanbieder-funnel als aparte HubSpot deal-pipeline -----------------------
// Stage-labels ↔ onze partner_status. De pipeline heet 'Aanbieders' en heeft de
// funnel-stadia + de terminale 'Afgewezen'.
const AANBIEDER_STAGES: {
  status: string;
  label: string;
  isClosed: boolean;
  probability: string;
}[] = [
  { status: "nieuw", label: "Nieuw", isClosed: false, probability: "0.1" },
  { status: "benaderd", label: "Benaderd", isClosed: false, probability: "0.3" },
  { status: "afspraak_gepland", label: "Afspraak gepland", isClosed: false, probability: "0.6" },
  { status: "partner", label: "Partner", isClosed: true, probability: "1.0" },
  { status: "afgewezen", label: "Afgewezen", isClosed: true, probability: "0.0" },
];
const LABEL_TO_STATUS: Record<string, string> = Object.fromEntries(
  AANBIEDER_STAGES.map((s) => [s.label, s.status]),
);

type PipelineInfo = { pipelineId: string; stageByStatus: Record<string, string> };
// undefined = nog niet geprobeerd, null = niet beschikbaar (bv. geen scope).
let aanbiederPipeline: PipelineInfo | null | undefined;

type HsPipeline = { id: string; label: string; stages?: { id: string; label: string }[] };

// Zorgt (idempotent) voor de 'Aanbieders'-deal-pipeline en cachet id + stages.
// Faalt zacht (null) als de HubSpot-token geen pipelines mag lezen/aanmaken.
async function getAanbiederPipeline(): Promise<PipelineInfo | null> {
  if (aanbiederPipeline !== undefined) return aanbiederPipeline;
  try {
    const list = await hs<{ results?: HsPipeline[] }>("/crm/v3/pipelines/deals");
    let pipe = (list?.results ?? []).find((p) => p.label === "Aanbieders");
    if (!pipe) {
      pipe = await hs<HsPipeline>("/crm/v3/pipelines/deals", {
        method: "POST",
        body: JSON.stringify({
          label: "Aanbieders",
          displayOrder: 1,
          stages: AANBIEDER_STAGES.map((s, i) => ({
            label: s.label,
            displayOrder: i,
            metadata: { isClosed: String(s.isClosed), probability: s.probability },
          })),
        }),
      }) ?? undefined;
    }
    if (!pipe) {
      aanbiederPipeline = null;
      return null;
    }
    const stageByStatus: Record<string, string> = {};
    for (const st of pipe.stages ?? []) {
      const status = LABEL_TO_STATUS[st.label];
      if (status) stageByStatus[status] = st.id;
    }
    aanbiederPipeline = { pipelineId: pipe.id, stageByStatus };
    return aanbiederPipeline;
  } catch (e) {
    console.error("HubSpot: aanbieder-pipeline niet beschikbaar:", e);
    aanbiederPipeline = null;
    return null;
  }
}

// Maakt/updatet de deal van deze aanbieder in de 'Aanbieders'-pipeline op de
// stage die bij partner_status hoort. Best-effort; geeft het deal-id terug (of
// het bestaande) zodat het in hubspot_company_sync bewaard kan worden.
async function syncAanbiederDeal(
  a: Aanbieder,
  companyId: string | undefined,
  bestaandeDealId: string | undefined,
): Promise<string | undefined> {
  const pipe = await getAanbiederPipeline();
  if (!pipe) return bestaandeDealId;
  const stageId =
    pipe.stageByStatus[a.partner_status] ?? pipe.stageByStatus["nieuw"];
  if (!stageId) return bestaandeDealId;
  const dealProps = {
    dealname: `Partner — ${a.naam}`,
    pipeline: pipe.pipelineId,
    dealstage: stageId,
  };
  if (bestaandeDealId) {
    await hs(`/crm/v3/objects/deals/${bestaandeDealId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties: dealProps }),
    });
    return bestaandeDealId;
  }
  const created = await hs<{ id: string }>("/crm/v3/objects/deals", {
    method: "POST",
    body: JSON.stringify({
      properties: dealProps,
      // Deal → Company (HUBSPOT_DEFINED associationTypeId 5).
      associations: companyId
        ? [
            {
              to: { id: companyId },
              types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 5 }],
            },
          ]
        : [],
    }),
  });
  return created?.id ?? bestaandeDealId;
}

// --- Aanbieder -> Company ----------------------------------------------------
export async function syncAanbiederToHubspot(
  aanbiederId: string,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!hubspotConfigured()) return { ok: true, skipped: true };
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("aanbieders")
    .select("*")
    .eq("id", aanbiederId)
    .single<Aanbieder>();
  if (!a) return { ok: false, error: "Aanbieder niet gevonden." };
  const { data: mapping } = await admin
    .from("hubspot_company_sync")
    .select("*")
    .eq("aanbieder_id", aanbiederId)
    .maybeSingle();

  try {
    await ensureCompanyProperties();
    const domain = domainFromUrl(a.website_url);
    const props: Record<string, string> = { name: a.naam };
    if (domain) props.domain = domain;
    if (a.vestigingsplaats) props.city = a.vestigingsplaats;
    if (a.beschrijving) props.description = a.beschrijving.slice(0, 5000);
    if (a.prijsklasse) props.erfcheck_prijsklasse = a.prijsklasse;
    if (a.contact_naam) props.erfcheck_contactpersoon = a.contact_naam;
    if (a.contact_email) props.erfcheck_contact_email = a.contact_email;
    if (a.partner_status) props.erfcheck_partner_status = a.partner_status;

    // 'domain' is in HubSpot geen unieke property → niet via batch/upsert.
    // Zoek daarom eerst een bestaande company op domein; anders aanmaken.
    let companyId: string | undefined = mapping?.company_id ?? undefined;
    if (!companyId && domain) {
      const found = await hs<{ results?: { id: string }[] }>(
        "/crm/v3/objects/companies/search",
        {
          method: "POST",
          body: JSON.stringify({
            filterGroups: [
              { filters: [{ propertyName: "domain", operator: "EQ", value: domain }] },
            ],
            properties: ["domain"],
            limit: 1,
          }),
        },
      );
      companyId = found?.results?.[0]?.id;
    }
    if (companyId) {
      await hs(`/crm/v3/objects/companies/${companyId}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: props }),
      });
    } else {
      const created = await hs<{ id: string }>("/crm/v3/objects/companies", {
        method: "POST",
        body: JSON.stringify({ properties: props }),
      });
      companyId = created?.id;
    }

    // Contactpersoon als echt HubSpot-contact aanmaken en aan de company koppelen,
    // zodat de e-mail zichtbaar ónder de company verschijnt. Best-effort: een
    // fout hier mag de geslaagde company-sync niet ongedaan maken.
    if (a.contact_email && companyId) {
      try {
        await ensureContactProperties();
        const delen = (a.contact_naam ?? "").trim().split(/\s+/).filter(Boolean);
        const cprops: Record<string, string> = {
          email: a.contact_email,
          erfcheck_doelgroep: "aanbieder-contact",
        };
        if (delen[0]) cprops.firstname = delen[0];
        if (delen.length > 1) cprops.lastname = delen.slice(1).join(" ");
        const upc = await hs<{ results?: { id: string }[] }>(
          "/crm/v3/objects/contacts/batch/upsert",
          {
            method: "POST",
            body: JSON.stringify({
              inputs: [
                { idProperty: "email", id: a.contact_email, properties: cprops },
              ],
            }),
          },
        );
        const contactId = upc?.results?.[0]?.id;
        if (contactId) {
          await hs(
            `/crm/v4/objects/companies/${companyId}/associations/default/contacts/${contactId}`,
            { method: "PUT" },
          );
        }
      } catch (e) {
        console.error("HubSpot: contactpersoon koppelen mislukt:", e);
      }
    }

    // Aanbieder-deal in de aparte 'Aanbieders'-pipeline op de juiste stage
    // (best-effort; een pipeline-/deal-fout mag de company-sync niet breken).
    let dealId: string | undefined = mapping?.deal_id ?? undefined;
    try {
      dealId = await syncAanbiederDeal(a, companyId, dealId);
    } catch (e) {
      console.error("HubSpot: aanbieder-deal sync mislukt:", e);
    }

    await admin.from("hubspot_company_sync").upsert(
      {
        aanbieder_id: aanbiederId,
        company_id: companyId ?? null,
        deal_id: dealId ?? null,
        synced_at: new Date().toISOString(),
        error: null,
      },
      { onConflict: "aanbieder_id" },
    );
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    await admin.from("hubspot_company_sync").upsert(
      { aanbieder_id: aanbiederId, synced_at: new Date().toISOString(), error: msg },
      { onConflict: "aanbieder_id" },
    );
    return { ok: false, error: msg };
  }
}

// --- Verstuurde e-mail loggen als HubSpot-activiteit --------------------------
// "Naam <mail@x.nl>" of "mail@x.nl" -> { email, firstName?, lastName? }
function parseAddress(input: string): {
  email: string;
  firstName?: string;
  lastName?: string;
} {
  const m = input.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : input).trim();
  const naam = (m ? m[1] : "").replace(/^"|"$/g, "").trim();
  if (!naam) return { email };
  const delen = naam.split(/\s+/);
  return { email, firstName: delen[0], lastName: delen.slice(1).join(" ") || undefined };
}

function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|tr|h[1-6]|li)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Logt een verstuurde e-mail als HubSpot-engagement (v1) en koppelt die aan de
// opgegeven contacten/deals/companies. De v1 Engagements-API zet het type correct
// op EMAIL (verzonden) en vult afzender/ontvanger in metadata — waardoor de mail
// als nette activiteit op de tijdlijn verschijnt. (De v3 objects/emails-route met
// hs_email_headers deed dat niet: die werd INCOMING_EMAIL met lege ontvanger.)
async function createEmailEngagement(opts: {
  subject: string;
  html: string;
  from: string;
  to: string;
  sentAtIso: string;
  contactIds?: string[];
  dealIds?: string[];
  companyIds?: string[];
}): Promise<string | undefined> {
  const to = parseAddress(opts.to);
  const from = parseAddress(opts.from);
  const toNum = (ids?: string[]) =>
    (ids ?? []).map((x) => Number(x)).filter((n) => Number.isFinite(n));

  const created = await hs<{ engagement?: { id: number } }>(
    "/engagements/v1/engagements",
    {
      method: "POST",
      body: JSON.stringify({
        engagement: {
          active: true,
          type: "EMAIL",
          timestamp: new Date(opts.sentAtIso).getTime(),
        },
        associations: {
          contactIds: toNum(opts.contactIds),
          dealIds: toNum(opts.dealIds),
          companyIds: toNum(opts.companyIds),
        },
        metadata: {
          from: {
            email: from.email,
            ...(from.firstName ? { firstName: from.firstName } : {}),
            ...(from.lastName ? { lastName: from.lastName } : {}),
          },
          to: [{ email: to.email }],
          subject: opts.subject,
          html: opts.html,
          text: htmlToText(opts.html),
        },
      }),
    },
  );
  const id = created?.engagement?.id;
  return id ? String(id) : undefined;
}

// Contact-id ophalen/aanmaken op e-mail (idempotent).
async function contactIdForEmail(email: string): Promise<string | undefined> {
  const upc = await hs<{ results?: { id: string }[] }>(
    "/crm/v3/objects/contacts/batch/upsert",
    {
      method: "POST",
      body: JSON.stringify({
        inputs: [{ idProperty: "email", id: email, properties: { email } }],
      }),
    },
  );
  return upc?.results?.[0]?.id;
}

// Logt een verstuurde e-mail op de HubSpot-tijdlijn van het contact + de company
// van deze aanbieder. Best-effort: gebruikt de al-gesyncte company-id en (her)vindt
// het contact op e-mail. Faalt stil als HubSpot niet is geconfigureerd.
export async function logAanbiederEmail(
  aanbiederId: string,
  opts: { subject: string; html: string; from: string; to: string; sentAtIso: string },
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!hubspotConfigured()) return { ok: true, skipped: true };
  const admin = createAdminClient();
  const { data: cs } = await admin
    .from("hubspot_company_sync")
    .select("company_id")
    .eq("aanbieder_id", aanbiederId)
    .maybeSingle();
  const companyId = cs?.company_id ?? undefined;

  try {
    const to = parseAddress(opts.to);
    const contactId = await contactIdForEmail(to.email);

    const emailId = await createEmailEngagement({
      ...opts,
      contactIds: contactId ? [contactId] : [],
      companyIds: companyId ? [companyId] : [],
    });
    if (!emailId) return { ok: false, error: "Geen email-id van HubSpot." };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    console.error("HubSpot: aanbieder-e-mail loggen mislukt:", msg);
    return { ok: false, error: msg };
  }
}

// Logt een verstuurde lead-mail (nurture) op de HubSpot-tijdlijn van het contact
// + de deal van de lead. Best-effort; faalt stil zonder HubSpot-config.
export async function logLeadEmail(
  leadId: string,
  opts: { subject: string; html: string; from: string; to: string; sentAtIso: string },
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!hubspotConfigured()) return { ok: true, skipped: true };
  const admin = createAdminClient();
  const { data: map } = await admin
    .from("hubspot_sync")
    .select("contact_id, deal_id")
    .eq("lead_id", leadId)
    .maybeSingle();

  try {
    const to = parseAddress(opts.to);
    const contactId = map?.contact_id ?? (await contactIdForEmail(to.email));
    const dealId = map?.deal_id ?? undefined;

    const emailId = await createEmailEngagement({
      ...opts,
      contactIds: contactId ? [contactId] : [],
      dealIds: dealId ? [dealId] : [],
    });
    if (!emailId) return { ok: false, error: "Geen email-id van HubSpot." };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    console.error("HubSpot: lead-e-mail loggen mislukt:", msg);
    return { ok: false, error: msg };
  }
}
