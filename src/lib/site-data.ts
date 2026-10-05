/**
 * site-data.ts — Single source of truth for all portfolio content
 * Author: Sahil Kumar
 *
 * RULE: Every value shown on the portfolio must be real and verifiable.
 * No placeholder numbers. No fake metrics. If something is not tracked,
 * show a descriptive label.
 */

// ─── TypeScript types ─────────────────────────────────────────────────────────

export interface SiteOwner {
  readonly name:     string;
  readonly title:    string;
  readonly tagline:  string;
  readonly location: string;
  readonly contact: {
    readonly github:   string;
    readonly linkedin: string;
    readonly email:    string;
  };
}

export interface Project {
  readonly id:          string;
  readonly title:       string;
  readonly subtitle:    string;
  readonly description: string;
  readonly stack:       readonly string[];
  readonly status:      "live" | "in-progress" | "planned";
  readonly repo:        string;
  readonly demo:        string;
  readonly highlights:  readonly string[];
}

export interface Skills {
  readonly primary:  readonly string[];
  readonly working:  readonly string[];
  readonly learning: readonly string[];
}

export interface ExperienceEntry {
  readonly role:        string;
  readonly company:     string;
  readonly period:      string;
  readonly description: string;
}

export interface EducationEntry {
  readonly degree:      string;
  readonly institution: string;
  readonly year:        string;
  readonly relevant:    readonly string[];
}

// ─── Content ──────────────────────────────────────────────────────────────────

export const SITE: SiteOwner = {
  name:     "Sahil Kumar",
  title:    "Energy Data Engineer",
  tagline:
    "Building transparent, source-verified energy intelligence tools " +
    "for the German electricity market.",
  location: "Pforzheim, Baden-Württemberg, Germany",
  contact: {
    github:   "https://github.com/sahilsagwal",
    linkedin: "https://linkedin.com/in/sahilkumar",
    email:    "sahil@example.com", // replace with real address before publishing
  },
} as const;

/**
 * Projects — only list work that is real, complete, and verifiable.
 * Do not add a project until its own acceptance criteria pass.
 */
export const PROJECTS: readonly Project[] = [
  {
    id:       "bw-energy-observatory",
    title:    "BW Energy Observatory",
    subtitle: "Live energy intelligence for Baden-Württemberg",
    description:
      "Source-transparent dashboard for the DE-LU day-ahead electricity market, " +
      "German generation mix and grid load, Stuttgart DWD weather context, " +
      "and official BKG boundaries for all 44 Baden-Württemberg districts. " +
      "No synthetic values, no forecasting, no fabricated fallbacks. " +
      "Every unavailable metric is explicitly labelled with its reason.",
    stack: [
      "Python 3 (stdlib only)",
      "Vanilla JavaScript",
      "SVG charts",
      "Fraunhofer ISE Energy-Charts API",
      "SMARD / Bundesnetzagentur (CC BY 4.0)",
      "DWD via Bright Sky (open data)",
      "BKG VG250 WFS (CC BY 4.0)",
      "EIA Open Data (optional)",
    ],
    status:     "live",
    repo:       "https://github.com/sahilsagwal/bw-energy-observatory",
    demo:       "", // fill in when deployed to Railway / Render / Fly.io
    highlights: [
      "Zero synthetic values — every unavailable source is explicitly labelled with reason and source",
      "44 BW Landkreise from official BKG VG250 WFS; deduplicated by ARS code, hard-asserts exactly 44",
      "Robust median/MAD anomaly detection on 96-interval rolling window — flags unusual observations without claiming a cause",
      "CSV export retains original UTC timestamps aligned across price, load, generation, and weather",
      "Dependency-free Python server — runs with python3 app/server.py, no pip install needed",
      "12 unit tests cover data integrity contracts — no synthetic value can pass",
    ],
  },
] as const;

/**
 * Skills — list what you actually use.
 * Honest proficiency levels: primary (daily) | working | learning.
 */
export const SKILLS: Skills = {
  primary: [
    "Python",
    "Energy market data (SMARD, Energy-Charts, ENTSO-E)",
    "Data analysis and visualisation",
    "HTML / CSS / JavaScript",
    "REST API design",
    "SQL",
  ],
  working: [
    "TypeScript",
    "Next.js / React",
    "Git and GitHub Actions",
    "Linux command line",
    "Data pipeline design",
  ],
  learning: [
    "Machine learning (scikit-learn)",
    "Containerisation (Docker)",
    "Supabase (auth + database)",
  ],
} as const;

/**
 * Experience — real roles with accurate dates.
 * Leave empty until there are real roles to list.
 */
export const EXPERIENCE: readonly ExperienceEntry[] = [] as const;

/**
 * Education — real qualifications.
 * Fill in your actual degree, institution, and year.
 */
export const EDUCATION: readonly EducationEntry[] = [
  {
    degree:      "",   // e.g. "B.Eng. Energy and Building Technology"
    institution: "",   // e.g. "Hochschule Pforzheim"
    year:        "",   // e.g. "2024"
    relevant: [
      "Energy systems",
      "Building energy performance",
      "Data engineering",
      "Programming",
    ],
  },
] as const;
