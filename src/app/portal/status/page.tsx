import { redirect } from "next/navigation";
import { getAanbiederContext } from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function PortalStatusPage() {
  const { user, membership } = await getAanbiederContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/geen-toegang");
  if (membership.status === "approved") redirect("/portal");

  const geweigerd = membership.status === "geweigerd";

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="opeigenerf.nl" className="mx-auto h-9 w-auto" />
        <h1 className="mt-4 text-lg font-semibold text-slate-900">
          {geweigerd ? "Aanvraag afgewezen" : "Wacht op goedkeuring"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {geweigerd
            ? "Je toegangsaanvraag is afgewezen. Neem contact op met opeigenerf als je denkt dat dit niet klopt."
            : "Je aanvraag is ontvangen en wacht op goedkeuring door opeigenerf. Je krijgt bericht zodra je toegang hebt."}
        </p>
        <form action="/auth/signout" method="post" className="mt-5">
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Uitloggen
          </button>
        </form>
      </div>
    </main>
  );
}
