import Link from "next/link";

export function PortalHeader({
  aanbiederNaam,
  email,
}: {
  aanbiederNaam: string;
  email?: string | null;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/portal" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="opeigenerf.nl" className="h-8 w-auto" />
            <span className="rounded bg-erf/10 px-1.5 py-0.5 text-xs font-medium text-erf">
              Portaal
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <Link href="/portal/woningen" className="transition hover:text-navy">
              Woningen
            </Link>
            <Link href="/portal/leads" className="transition hover:text-navy">
              Leads
            </Link>
            <Link href="/portal/profiel" className="transition hover:text-navy">
              Profiel
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="hidden font-medium text-slate-700 sm:inline">
            {aanbiederNaam}
          </span>
          {email && <span className="hidden text-slate-400 md:inline">{email}</span>}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Uitloggen
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
