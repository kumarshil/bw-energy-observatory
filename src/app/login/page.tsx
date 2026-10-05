/**
 * app/login/page.tsx
 * Admin login preview — Sahil Kumar portfolio
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin login",
  description: "Private admin login for the portfolio dashboard.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 items-center px-6 py-12 sm:px-10 lg:px-12">
      <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">

        {/* Left — explanation */}
        <section className="surface-card bg-slate-950 text-white">
          <p className="section-label text-white/50">Admin access</p>
          <h1 className="section-title max-w-lg text-white">
            Private dashboard login
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
            This page will connect to Supabase authentication in Phase 2.
            Once connected, only you can open the analytics dashboard,
            review visitor data, and manage content.
          </p>

          <div className="mt-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm leading-6 text-amber-200">
            <strong>Phase 2 — not yet active.</strong>{" "}
            Authentication is planned. This is a visual preview of the login screen.
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-medium text-white">Dashboard access</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Private analytics, click data, page views, and visitor history.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-medium text-white">Content control</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Update project details, contact information, and downloadable files.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <Link className="secondary-link" href="/">
              Back to portfolio
            </Link>
          </div>
        </section>

        {/* Right — form preview */}
        <section className="surface-card" aria-labelledby="login-form-heading">
          <p className="section-label">Preview only</p>
          <h2 id="login-form-heading" className="text-2xl font-semibold text-slate-950">
            Sign in to your dashboard
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Form is visual only — no authentication is connected yet.
          </p>

          {/* Visual form — not wired, no action */}
          <div className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                className="form-input"
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                disabled
                aria-describedby="email-note"
              />
              <p id="email-note" className="mt-1 text-xs text-slate-400">
                Authentication not connected yet
              </p>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                className="form-input"
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
                disabled
                aria-describedby="password-note"
              />
              <p id="password-note" className="mt-1 text-xs text-slate-400">
                Will use Supabase auth in Phase 2
              </p>
            </div>

            <button
              className="primary-button w-full cursor-not-allowed opacity-50"
              type="button"
              disabled
              aria-disabled="true"
            >
              Sign in
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <strong>Phase 2 implementation plan:</strong>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-500">
              <li>Create Supabase project and add environment variables</li>
              <li>Install <code className="rounded bg-slate-200 px-1">@supabase/ssr</code></li>
              <li>Add server action for login and session handling</li>
              <li>Protect <code className="rounded bg-slate-200 px-1">/dashboard</code> with middleware</li>
            </ol>
          </div>

          <div className="mt-6">
            <Link className="secondary-link-dark" href="/dashboard">
              Continue to dashboard preview →
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
