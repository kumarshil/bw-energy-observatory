import Link from "next/link";
import { PROJECTS, SKILLS, SITE } from "@/lib/site-data";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Energy data engineering projects by Sahil Kumar — " +
    "source-transparent analytics, live dashboards, and open data.",
};

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 pb-20 pt-6 sm:px-10 lg:px-12">

      {/* ── Hero ── */}
      <section
        aria-labelledby="hero-heading"
        className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,176,120,0.28),_transparent_32%),linear-gradient(135deg,_#101826_0%,_#15273b_46%,_#f5eee2_170%)] px-6 py-10 text-white shadow-[0_32px_80px_rgba(10,15,25,0.3)] sm:px-10 sm:py-12"
      >
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/60">
          Energy data engineer
        </p>
        <h1
          id="hero-heading"
          className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
        >
          {SITE.name}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
          {SITE.tagline}
        </p>
        <p className="mt-2 text-sm text-slate-400">
          {SITE.location}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            className="primary-link"
            href={SITE.contact.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub profile (opens in new tab)"
          >
            GitHub ↗
          </a>
          <a
            className="secondary-link"
            href={SITE.contact.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn profile (opens in new tab)"
          >
            LinkedIn ↗
          </a>
          <a
            className="secondary-link"
            href={`mailto:${SITE.contact.email}`}
            aria-label="Send email"
          >
            Contact
          </a>
        </div>
      </section>

      {/* ── Featured project ── */}
      <section
        className="mt-10"
        aria-labelledby="projects-heading"
      >
        <p className="section-label">Projects</p>
        <h2 id="projects-heading" className="section-title">
          What I have built
        </h2>

        <div className="mt-8 flex flex-col gap-8">
          {PROJECTS.map((project) => (
            <article
              key={project.id}
              className="surface-card"
              aria-labelledby={`project-${project.id}-title`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3
                      id={`project-${project.id}-title`}
                      className="text-xl font-semibold text-slate-950"
                    >
                      {project.title}
                    </h3>
                    {project.status === "live" && (
                      <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                          aria-hidden="true"
                        />
                        Live
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{project.subtitle}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.repo && (
                    <a
                      className="secondary-link-dark text-sm"
                      href={project.repo}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View ${project.title} source code on GitHub (opens in new tab)`}
                    >
                      Source ↗
                    </a>
                  )}
                  {project.demo && (
                    <a
                      className="primary-link text-sm"
                      href={project.demo}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${project.title} live demo (opens in new tab)`}
                    >
                      Live demo ↗
                    </a>
                  )}
                </div>
              </div>

              <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-600">
                {project.description}
              </p>

              <ul className="mt-6 space-y-2" aria-label="Project highlights">
                {project.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex items-start gap-3 text-sm text-slate-600"
                  >
                    <span
                      className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400"
                      aria-hidden="true"
                    />
                    {highlight}
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-wrap gap-2" aria-label="Technologies used">
                {project.stack.map((tech) => (
                  <span
                    key={tech}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Skills ── */}
      <section
        id="skills"
        className="mt-10 grid gap-6 lg:grid-cols-3"
        aria-labelledby="skills-heading"
      >
        <div className="surface-card">
          <p className="section-label">Primary skills</p>
          <h2 id="skills-heading" className="section-title text-2xl">
            What I work with daily
          </h2>
          <ul className="mt-4 space-y-2" aria-label="Primary skills list">
            {SKILLS.primary.map((skill) => (
              <li
                key={skill}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm font-medium text-slate-800"
              >
                <span
                  className="h-2 w-2 rounded-full bg-amber-400"
                  aria-hidden="true"
                />
                {skill}
              </li>
            ))}
          </ul>
        </div>

        <div className="surface-card">
          <p className="section-label">Working knowledge</p>
          <h2 className="section-title text-2xl">Also comfortable with</h2>
          <ul className="mt-4 space-y-2" aria-label="Working skills list">
            {SKILLS.working.map((skill) => (
              <li
                key={skill}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600"
              >
                <span
                  className="h-2 w-2 rounded-full bg-slate-300"
                  aria-hidden="true"
                />
                {skill}
              </li>
            ))}
          </ul>
        </div>

        <div className="surface-card">
          <p className="section-label">Currently learning</p>
          <h2 className="section-title text-2xl">In progress</h2>
          <ul className="mt-4 space-y-2" aria-label="Learning list">
            {SKILLS.learning.map((skill) => (
              <li
                key={skill}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500"
              >
                <span
                  className="h-2 w-2 rounded-full bg-blue-300"
                  aria-hidden="true"
                />
                {skill}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── What I am building next ── */}
      <section
        className="mt-10 surface-card bg-slate-950 text-white"
        aria-labelledby="next-heading"
      >
        <p className="section-label text-white/50">What is next</p>
        <h2 id="next-heading" className="section-title max-w-2xl text-white">
          Building deeper into energy data engineering
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
          The BW Energy Observatory covers national-level data honestly.
          The next phase adds authenticated regional data (ENTSO-E TransnetBW)
          and licensed commodity feeds — but only when a verified, licensed
          source is in place. No placeholders, no invented numbers.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "ENTSO-E TransnetBW integration",
              description:
                "TSO-level actual load for Baden-Württemberg once an " +
                "authenticated token is configured. Kept separate from national data.",
            },
            {
              title: "Licensed commodity feeds",
              description:
                "TTF gas, EU ETS allowances, coal, and uranium — " +
                "when a provider with the right licence is selected.",
            },
            {
              title: "This portfolio",
              description:
                "Real visitor analytics and admin dashboard once " +
                "Supabase authentication and tracking events are wired in.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-5"
            >
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                {item.description}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="primary-link" href="/dashboard">
            Dashboard preview
          </Link>
          <a
            className="secondary-link"
            href={SITE.contact.github}
            target="_blank"
            rel="noopener noreferrer"
          >
            See all code ↗
          </a>
        </div>
      </section>

    </div>
  );
}
