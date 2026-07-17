"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/socials", label: "Socials" },
  { href: "/website", label: "Website" },
  { href: "/regelgeving", label: "Regelgeving" },
];

export function ContentMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const actief = ITEMS.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));

  // Sluiten bij klik buiten het menu.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Sluiten na navigatie.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1 transition hover:text-navy ${
          actief ? "text-navy" : ""
        }`}
      >
        Content
        <svg
          viewBox="0 0 20 20"
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1.5 min-w-[10rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {ITEMS.map((i) => {
            const isActive = pathname === i.href || pathname.startsWith(i.href + "/");
            return (
              <Link
                key={i.href}
                href={i.href}
                role="menuitem"
                className={`block px-3 py-2 text-sm transition hover:bg-slate-50 ${
                  isActive ? "font-medium text-navy" : "text-slate-600"
                }`}
              >
                {i.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
