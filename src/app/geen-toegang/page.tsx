import Link from "next/link";

export default function GeenToegangPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="opeigenerf.nl" className="mx-auto h-9 w-auto" />
        <h1 className="mt-4 text-lg font-semibold text-slate-900">Geen toegang</h1>
        <p className="mt-2 text-sm text-slate-500">
          Dit account is nog niet gekoppeld aan een aanbieder. Vraag toegang aan
          of neem contact op met opeigenerf.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/registreren"
            className="rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-700"
          >
            Toegang aanvragen
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Uitloggen
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
