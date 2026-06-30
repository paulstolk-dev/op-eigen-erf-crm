import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "opeigenerf CRM",
  description: "Leadbeheer voor opeigenerf.nl",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
