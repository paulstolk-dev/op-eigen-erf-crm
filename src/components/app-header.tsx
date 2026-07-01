import Link from "next/link";

export function AppHeader({ email }: { email?: string | null }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.svg" alt="opeigenerf.nl" className="h-9 w-9" />
          <span className="text-base font-semibold tracking-tight text-navy">
            opeigenerf<span className="text-erf"> CRM</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          {email && <span className="hidden sm:inline">{email}</span>}
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
