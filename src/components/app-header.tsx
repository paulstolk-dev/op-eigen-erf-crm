import Link from "next/link";

export function AppHeader({ email }: { email?: string | null }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="opeigenerf.nl" className="h-8 w-auto" />
          <span className="rounded bg-navy/10 px-1.5 py-0.5 text-xs font-medium text-navy">
            CRM
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
