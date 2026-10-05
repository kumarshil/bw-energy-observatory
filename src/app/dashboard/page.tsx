/**
 * app/dashboard/page.tsx
 * Private dashboard preview — Sahil Kumar portfolio
 *
 * This page shows the STRUCTURE of what the dashboard will show.
 * All metric cards say "Not connected yet" until Supabase tracking is live.
 * No fake numbers anywhere.
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard preview",
  description:
    "Preview of the private analytics dashboard. " +
    "Real data will appear once tracking and authentication are connected.",
  robots: { index: false, follow: false }, // private page — keep out of search
};

/** Placeholder card shown until a real data source is connected. */
function PendingCard({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <article className="surface-card compact-card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 font-mono text-2xl font-semibold text-slate-300">
        —
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{description}</p>
    </article>
  );
}

/** Planned feature card — honest about what is not built yet. */
function PlannedFeature({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-slate-900">{title}</p>
        <span className="flex-shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 ring-1 ring-amber-200">
          {phase}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 pb-16 pt-8 sm:px-10 lg:px-12">

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="section-label">Private dashboard</p>
          <h1 className="section-title">Visitor and click analytics</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            This page shows the analytics structure. All metrics display a dash
            until Supabase tracking events and authentication are connected.
            No placeholder numbers are shown — a dash is more honest than an
            invented metric.
          </p>
        </div>
        <Link className="secondary-link-dark" href="/">
          Back to work
        </Link>
      </div>

      {/* Status banner */}
      <div className="mt-8 flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
        <span className="mt-0.5 flex-shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold">
          Phase 2
        </span>
        <div>
          <strong>Not yet connected.</strong>{" "}
          Tracking events and Supabase authentication are planned for Phase 2.
          Once connected, these cards will show real data visible only to you.
        </div>
      </div>

      {/* KPI cards — all pending */}
      <section
        className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        aria-label="Analytics overview"
      >
        <PendingCard
          label="Unique visitors"
          description="Requires tracking events — not yet connected"
        />
        <PendingCard
          label="GitHub profile clicks"
          description="Requires click-event tracking — not yet connected"
        />
        <PendingCard
          label="LinkedIn profile clicks"
          description="Requires click-event tracking — not yet connected"
        />
        <PendingCard
          label="Contact actions"
          description="Requires event capture — not yet connected"
        />
      </section>

      {/* Planned features */}
      <section className="mt-10" aria-labelledby="planned-heading">
        <p className="section-label">Roadmap</p>
        <h2 id="planned-heading" className="section-title text-2xl">
          What the dashboard will show once connected
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PlannedFeature
            title="Page view history"
            description="Which pages were visited, how long visitors stayed, and scroll depth on each page."
            phase="Phase 2"
          />
          <PlannedFeature
            title="Traffic sources"
            description="Where visitors came from — direct, LinkedIn, GitHub, search, or referral."
            phase="Phase 2"
          />
          <PlannedFeature
            title="Click events"
            description="GitHub, LinkedIn, email, and contact actions tracked individually."
            phase="Phase 2"
          />
          <PlannedFeature
            title="Resume / file requests"
            description="Track when someone requests a downloadable file."
            phase="Phase 2"
          />
          <PlannedFeature
            title="Return visitor detection"
            description="Count visitors who return on a second session."
            phase="Phase 2"
          />
          <PlannedFeature
            title="Export to CSV"
            description="Download your full visitor and event log."
            phase="Phase 3"
          />
        </div>
      </section>

      {/* Next step */}
      <section className="mt-10 surface-card bg-slate-950 text-white">
        <p className="section-label text-white/50">Next step</p>
        <h2 className="section-title max-w-xl text-white">
          Connect Supabase to make this real
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
          Phase 2 adds Supabase for authentication and event storage,
          plus server-side route handlers to record clicks and page views.
          The login page will then gate this dashboard so only you can see it.
        </p>
        <div className="mt-6 flex gap-3">
          <Link className="primary-link" href="/login">
            See login preview
          </Link>
          <Link className="secondary-link" href="/">
            Back to work
          </Link>
        </div>
      </section>

    </div>
  );
}
