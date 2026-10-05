import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sahil Kumar — Energy Data Engineer",
    template: "%s — Sahil Kumar",
  },
  description:
    "Portfolio of Sahil Kumar — energy data engineering, " +
    "source-transparent analytics, and open-data dashboards. " +
    "Based in Pforzheim, Baden-Württemberg.",
  authors: [{ name: "Sahil Kumar" }],
  openGraph: {
    type: "website",
    title: "Sahil Kumar — Energy Data Engineer",
    description:
      "Energy data engineering portfolio. " +
      "Featuring BW Energy Observatory — a live, source-transparent " +
      "dashboard for Baden-Württemberg electricity and weather data.",
    siteName: "Sahil Kumar",
  },
  twitter: {
    card: "summary",
    title: "Sahil Kumar — Energy Data Engineer",
    description:
      "Live energy analytics for Baden-Württemberg. " +
      "Real data sources, no synthetic values.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased scroll-smooth">
      <body className="min-h-full bg-[linear-gradient(180deg,_#f5efe4_0%,_#f8fafc_35%,_#eef2f7_100%)] text-slate-950">
        <div className="flex min-h-full flex-col">

          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-white"
          >
            Skip to main content
          </a>

          <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 sm:px-10 lg:px-12">
            <Link
              className="text-base font-semibold tracking-tight text-slate-950"
              href="/"
              aria-label="Sahil Kumar — home"
            >
              Sahil Kumar
            </Link>
            <nav
              className="flex items-center gap-2 text-sm text-slate-600"
              aria-label="Main navigation"
            >
              <Link className="nav-link" href="/">Work</Link>
              <Link className="nav-link" href="/#skills">Skills</Link>
              <Link className="nav-link" href="/dashboard">Dashboard</Link>
              <a
                className="nav-link"
                href="https://github.com/sahilsagwal"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub profile (opens in new tab)"
              >
                GitHub ↗
              </a>
            </nav>
          </header>

          <main id="main-content" className="flex flex-1 flex-col">
            {children}
          </main>

          <footer className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-8 text-xs text-slate-400 sm:px-10 lg:px-12">
            <span>© 2026 Sahil Kumar</span>
            <span>Energy data engineering · Pforzheim, Baden-Württemberg</span>
          </footer>

        </div>
      </body>
    </html>
  );
}
