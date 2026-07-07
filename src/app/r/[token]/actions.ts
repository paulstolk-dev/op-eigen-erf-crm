"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

// Publieke acties voor de Erf Check-pagina. GEEN auth — de report_token in de URL
// is de toegangsgrens. Alle writes via de service-role admin-client.

// Bezoek stempelen: eerste view + laatste view + teller.
export async function trackView(token: string): Promise<void> {
  if (!token) return;
  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("id")
    .eq("report_token", token)
    .maybeSingle();
  if (!lead) return;
  const { data: scan } = await admin
    .from("erfscans")
    .select("view_count, viewed_at")
    .eq("lead_id", lead.id)
    .maybeSingle();
  if (!scan) return;
  const now = new Date().toISOString();
  await admin
    .from("erfscans")
    .update({
      view_count: (scan.view_count ?? 0) + 1,
      viewed_at: scan.viewed_at ?? now,
      last_viewed_at: now,
    })
    .eq("lead_id", lead.id);
}

// Terugbel-/afspraakverzoek van de bezoeker vastleggen op de lead + notificatie.
export async function submitContact(
  token: string,
  telefoon: string,
  notitie: string,
): Promise<{ ok: boolean; error?: string }> {
  const tel = (telefoon || "").trim();
  if (tel.replace(/[^0-9]/g, "").length < 8) {
    return { ok: false, error: "Vul een geldig telefoonnummer in." };
  }
  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("id, naam, voornaam, achternaam, email, postcode, huisnummer")
    .eq("report_token", token)
    .maybeSingle();
  if (!lead) return { ok: false, error: "Onbekende link." };

  const notitieClean = (notitie || "").trim().slice(0, 1000) || null;
  const { error } = await admin
    .from("leads")
    .update({
      telefoon: tel,
      terugbel_verzoek_at: new Date().toISOString(),
      terugbel_notitie: notitieClean,
    })
    .eq("id", lead.id);
  if (error) return { ok: false, error: "Opslaan mislukt, probeer het later opnieuw." };

  // Interne notificatie (best-effort — blokkeert de opslag niet).
  const naam =
    lead.naam ||
    [lead.voornaam, lead.achternaam].filter(Boolean).join(" ") ||
    lead.email ||
    "Onbekend";
  const adres = [lead.postcode, lead.huisnummer].filter(Boolean).join(" ");
  await sendEmail({
    to: process.env.LEAD_NOTIFY_EMAIL || "info@opeigenerf.nl",
    subject: `📞 Terugbelverzoek — ${naam} (${tel})`,
    html: `<p>Nieuw terugbelverzoek via de Erf Check-pagina.</p>
      <p><strong>${naam}</strong>${adres ? ` — ${adres}` : ""}<br>
      Telefoon: <strong>${tel}</strong>${lead.email ? `<br>E-mail: ${lead.email}` : ""}</p>
      ${notitieClean ? `<p>Bericht: ${notitieClean}</p>` : ""}`,
  }).catch(() => {});

  return { ok: true };
}
