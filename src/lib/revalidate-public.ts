import "server-only";

// Revalidatie van de PUBLIEKE site (aparte repo) na een mutatie op aanbieders/
// woningen. De publieke site cachet /aanbieders via ISR; wij kunnen alleen via
// HTTP revalideren. Faalt STIL — een mislukte revalidatie mag de CRM-mutatie
// nooit blokkeren.
export async function revalidatePublicSite(
  paths: string[] = ["/aanbieders"],
): Promise<void> {
  const url =
    process.env.PUBLIC_SITE_REVALIDATE_URL ||
    "https://opeigenerf.nl/api/revalidate";
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    console.warn(
      "[revalidate] REVALIDATE_SECRET niet gezet — publieke site niet gerevalideerd.",
    );
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, paths }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(
        "[revalidate] mislukt:",
        res.status,
        await res.text().catch(() => ""),
      );
    }
  } catch (e) {
    console.error("[revalidate] fout:", e);
  }
}
