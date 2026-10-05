/**
 * BW Energy Observatory — Frontend
 * Author: Sahil Kumar
 *
 * Pure vanilla JS. No framework, no build step.
 * Fetches from the same-origin Python server (/api/*) and renders
 * SVG charts directly into the DOM.
 *
 * Data sources (all fetched server-side):
 *   Fraunhofer ISE Energy-Charts — German load + generation
 *   SMARD / Bundesnetzagentur — DE-LU day-ahead price (CC BY 4.0)
 *   DWD via Bright Sky — Stuttgart hourly weather (DWD open data)
 *   BKG VG250 — 44 Baden-Württemberg district boundaries (CC BY 4.0)
 *
 * Fixes applied vs v1:
 *   - Event delegation on district list prevents duplicate handlers on SVG map
 *   - Zero-line in bar chart only rendered when price range crosses zero
 *   - Indexed comparison uses first non-zero base point; does not exclude
 *     valid zero prices from the series itself
 */

"use strict";

// ─── DOM shorthand ────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ─── App state ────────────────────────────────────────────────────────────────
const state = {
  days:          30,     // rolling lookback in days
  rangeStart:    null,   // explicit calendar start (overrides days)
  rangeEnd:      null,   // explicit calendar end
  priceMode:     "line", // "line" | "bars"
  weatherMetric: "temperature_c",
  latest:        null,   // last /api/overview response
  requestController: null,
};

// ─── Security ─────────────────────────────────────────────────────────────────

/**
 * Escape a value before inserting it into innerHTML.
 * Called on every string that originates from an API response.
 */
function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]
  );
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format a numeric value with its unit for display.
 * Returns "Not available" for null / undefined so the UI is always honest.
 */
function format(value, unit) {
  if (value === null || value === undefined) return "Not available";
  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: unit === "%" ? 1 : 0,
  }).format(value)} ${unit}`;
}

/**
 * Convert a UTC ISO timestamp to a readable Berlin-timezone label.
 */
function timeLabel(ts) {
  if (!ts) return "No timestamp";
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? `Published ${ts}`
    : new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone:  "Europe/Berlin",
      }).format(d);
}

/**
 * Update a KPI card (id + "-value" and id + "-meta").
 */
function metric(id, source) {
  $(id + "-value").textContent = source.available
    ? format(source.value, source.unit)
    : "Not available";
  $(id + "-meta").textContent = source.available
    ? `${timeLabel(source.timestamp)} | ${source.coverage}`
    : source.reason;
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

const CHART_W = 900;
const CHART_H = 250;
const PAD_TOP = 18;
const PAD_BOT = 24;

/**
 * Downsample an array to at most `max` evenly-spaced items.
 * Keeps the browser comfortable when there are thousands of 15-min points.
 */
function downsample(arr, max = 220) {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)]);
}

function timeBounds(series) {
  const times = series
    .flatMap((item) => item.values)
    .map((point) => Date.parse(point.timestamp))
    .filter(Number.isFinite);
  return times.length ? { min: Math.min(...times), max: Math.max(...times) } : null;
}

function pointX(point, index, length, bounds, width) {
  const timestamp = Date.parse(point.timestamp);
  if (!bounds || !Number.isFinite(timestamp) || bounds.min === bounds.max) {
    return (index / Math.max(1, length - 1)) * width;
  }
  return ((timestamp - bounds.min) / (bounds.max - bounds.min)) * width;
}

function makeTimeAxis(bounds, width, height) {
  if (!bounds) return "";
  const formatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "Europe/Berlin" });
  return [0, 0.5, 1].map((fraction) => {
    const x = width * fraction;
    const anchor = fraction === 0 ? "start" : fraction === 1 ? "end" : "middle";
    return `<text class="axis-label" x="${x}" y="${height - 4}" text-anchor="${anchor}">${formatter.format(new Date(bounds.min + (bounds.max - bounds.min) * fraction))}</text>`;
  }).join("");
}

/**
 * Build an SVG "d" attribute for a line series.
 * Y-axis runs from `bounds.min` (bottom) to `bounds.max` (top).
 */
function makePath(points, key, bounds, time, w, h, padTop, padBot) {
  const plotH = h - padTop - padBot;
  return points
    .map((p, i) => {
      const x = pointX(p, i, points.length, time, w);
      const y = h - padBot - ((p[key] - bounds.min) / (bounds.max - bounds.min || 1)) * plotH;
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Generate horizontal grid lines and Y-axis labels.
 */
function makeGrid(bounds, w, h, padTop, padBot) {
  return [0, 0.25, 0.5, 0.75, 1].map((frac) => {
    const y   = padTop + frac * (h - padTop - padBot);
    const val = bounds.max - frac * (bounds.max - bounds.min);
    return (
      `<line class="grid" x1="0" x2="${w}" y1="${y}" y2="${y}"/>` +
      `<text class="axis-label" x="4" y="${y - 4}">` +
      `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(val)}</text>`
    );
  }).join("");
}

/**
 * Render one or more line series into a container element.
 * Uses role="img" + aria-label set in the HTML; this function
 * only populates the SVG content.
 */
function lineChart(targetId, series, legendItems) {
  const el      = $(targetId);
  const cleaned = series
    .map((s) => ({
      ...s,
      values: downsample(s.values.filter((p) => p[s.key] !== null && Number.isFinite(p[s.key]))),
    }))
    .filter((s) => s.values.length > 0);

  if (!cleaned.length) {
    el.textContent = "No published observations available for this range.";
    return;
  }

  const allVals = cleaned.flatMap((s) => s.values.map((p) => p[s.key]));
  const bounds  = { min: Math.min(...allVals), max: Math.max(...allVals) };
  // Ensure min ≠ max to avoid division-by-zero in makePath
  if (bounds.min === bounds.max) { bounds.min -= 1; bounds.max += 1; }

  const time   = timeBounds(cleaned);
  const grid   = makeGrid(bounds, CHART_W, CHART_H, PAD_TOP, PAD_BOT);
  const paths  = cleaned
    .map((s) => `<path class="${s.className}" d="${makePath(s.values, s.key, bounds, time, CHART_W, CHART_H, PAD_TOP, PAD_BOT)}"/>`)
    .join("");
  const legend = legendItems
    .map((l, i) => `<text class="legend" x="${i * 160}" y="32" fill="${l.colour}">&#9679; ${l.text}</text>`)
    .join("");

  el.setAttribute("aria-label", `${legendItems.map((item) => item.text).join("; ")}. Values range from ${format(bounds.min, "")} to ${format(bounds.max, "")}.`);
  el.innerHTML =
    `<svg viewBox="0 0 ${CHART_W} ${CHART_H}" preserveAspectRatio="none" aria-hidden="true">` +
    grid + paths + legend + makeTimeAxis(time, CHART_W, CHART_H) +
    `</svg>`;
}

/**
 * Render a bar chart (used for the price panel to make negative bars visible).
 *
 * FIX: Zero-line is only drawn when the value range actually crosses zero.
 *      When all prices are positive there is no zero to mark.
 */
function barChart(targetId, points, key, unit) {
  const el     = $(targetId);
  const values = downsample(points.filter((p) => Number.isFinite(p[key])), 160);

  if (!values.length) {
    el.textContent = "No published observations available for this range.";
    return;
  }

  const raw = values.map((p) => p[key]);
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  const w   = CHART_W;
  const h   = CHART_H;
  const plotH = h - PAD_TOP - PAD_BOT;

  // Y-coordinate for the zero line.
  // Only rendered when the range spans negative AND positive values.
  const rangeSpansZero = min < 0 && max > 0;
  const effectiveMin   = Math.min(0, min);
  const effectiveMax   = Math.max(0, max);
  const zeroY          = h - PAD_BOT - ((0 - effectiveMin) / (effectiveMax - effectiveMin || 1)) * plotH;

  const bw = Math.max(1, w / values.length - 0.5);
  const time = timeBounds([{ values }]);

  const bars = values.map((p, i) => {
    const v     = p[key];
    const topY  = h - PAD_BOT - ((Math.max(v, 0) - effectiveMin) / (effectiveMax - effectiveMin || 1)) * plotH;
    const barH  = (Math.abs(v) / (effectiveMax - effectiveMin || 1)) * plotH;
    const x     = pointX(p, i, values.length, time, w);
    return (
      `<rect class="price-bar${v < 0 ? " negative" : ""}" ` +
      `x="${x.toFixed(1)}" y="${Math.min(topY, zeroY).toFixed(1)}" ` +
      `width="${bw.toFixed(1)}" height="${barH.toFixed(1)}">` +
      `<title>${escapeHtml(timeLabel(p.timestamp))}: ${escapeHtml(format(v, unit))}</title>` +
      `</rect>`
    );
  }).join("");

  const zeroLine = rangeSpansZero
    ? `<line class="grid zero-line" x1="0" x2="${w}" y1="${zeroY.toFixed(1)}" y2="${zeroY.toFixed(1)}"/>`
    : "";

  const legendText = rangeSpansZero
    ? `&#9679; ${escapeHtml(unit)} | teal bars = negative prices`
    : `&#9679; ${escapeHtml(unit)}`;

  el.setAttribute("aria-label", `DE-LU electricity price bars. Values range from ${format(min, unit)} to ${format(max, unit)}.`);
  el.innerHTML =
    `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">` +
    zeroLine + bars +
    `<text class="legend" x="0" y="14" fill="#5b94ff">${legendText}</text>` + makeTimeAxis(time, w, h) +
    `</svg>`;
}

// ─── Panel renderers ──────────────────────────────────────────────────────────

function renderPrice(history) {
  if (state.priceMode === "bars") {
    barChart("price-chart", history, "value", "EUR/MWh");
  } else {
    lineChart(
      "price-chart",
      [{ values: history, key: "value", className: "price-line" }],
      [{ text: "DE-LU price (EUR/MWh)", colour: "#5b94ff" }]
    );
  }

  const vals = history.map((p) => p.value).filter(Number.isFinite);
  const avg  = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

  $("price-statistics").innerHTML = vals.length
    ? [["Low", Math.min(...vals)], ["Average", avg], ["High", Math.max(...vals)]]
        .map(([lbl, v]) => `<div><span>${lbl}</span><strong>${format(v, "EUR/MWh")}</strong></div>`)
        .join("")
    : "";
}

function renderSystem(history) {
  lineChart(
    "system-chart",
    [
      { values: history, key: "load",       className: "load-line"       },
      { values: history, key: "generation", className: "generation-line" },
    ],
    [
      { text: "Load (MW)",       colour: "#5b94ff" },
      { text: "Generation (MW)", colour: "#3ad3bf" },
    ]
  );
}

/**
 * Align price and system histories by timestamp, then index both series
 * so the first valid (non-zero) matched point = 100.
 *
 * FIX: Previously filtered out any price === 0, discarding valid near-zero
 * and exactly-zero electricity prices.
 * Correct fix: find first pair where BOTH values are non-zero for the base,
 * then index ALL pairs against that base without further filtering.
 */
function buildIndexedSeries(priceHistory, systemHistory) {
  const byTs  = new Map(systemHistory.map((p) => [p.timestamp, p]));
  const pairs = priceHistory
    .map((price) => ({ price, system: byTs.get(price.timestamp) }))
    .filter((pair) => pair.system !== undefined);

  if (!pairs.length) return [];

  // Find first pair suitable as a base (non-zero in both dimensions)
  const base = pairs.find((p) => p.price.value !== 0 && p.system.load !== 0);
  if (!base) return [];

  const basePrice = base.price.value;
  const baseLoad  = base.system.load;

  // ALL pairs are included — even those with a price of exactly 0
  return pairs.map((pair) => ({
    timestamp:   pair.price.timestamp,
    price_index: (pair.price.value  / basePrice) * 100,
    load_index:  (pair.system.load  / baseLoad)  * 100,
  }));
}

function renderComparison(priceHistory, systemHistory) {
  const series = buildIndexedSeries(priceHistory, systemHistory);
  lineChart(
    "price-load-chart",
    [
      { values: series, key: "price_index", className: "comparison-price-line" },
      { values: series, key: "load_index",  className: "comparison-load-line"  },
    ],
    [
      { text: "Price index (base=100)",      colour: "#e7ad52" },
      { text: "Load index (base=100)",       colour: "#5b94ff" },
    ]
  );
}

function renderGenerationTrend(profile) {
  lineChart(
    "generation-trend-chart",
    [
      { values: profile, key: "solar",   className: "solar-line"            },
      { values: profile, key: "wind",    className: "wind-generation-line"  },
      { values: profile, key: "hydro",   className: "hydro-line"            },
      { values: profile, key: "biomass", className: "biomass-line"          },
      { values: profile, key: "fossil",  className: "fossil-line"           },
    ],
    [
      { text: "Solar",   colour: "#e7ad52" },
      { text: "Wind",    colour: "#5b94ff" },
      { text: "Hydro",   colour: "#3ad3bf" },
      { text: "Biomass", colour: "#76be76" },
      { text: "Fossil",  colour: "#b68071" },
    ]
  );
}

/**
 * Find the DWD weather observation nearest to `ts`.
 * Returns null if no observation is within 90 minutes.
 */
function nearestWeather(history, ts) {
  const target  = new Date(ts).getTime();
  let bestRow   = null;
  let bestGap   = Infinity;
  for (const row of history) {
    const gap = Math.abs(new Date(row.timestamp).getTime() - target);
    if (gap < bestGap) { bestGap = gap; bestRow = row; }
  }
  return bestRow && bestGap <= 90 * 60_000 ? bestRow : null;
}

function renderAnalysis(analysis, weather) {
  $("negative-price-count").textContent = analysis.negative_price_intervals;
  $("analysis-method").textContent      = analysis.method;

  const wHistory = weather.available ? weather.history : [];

  if (!analysis.anomalies.length) {
    $("anomaly-list").innerHTML =
      `<p class="anomaly-empty">No values exceeded the robust statistical threshold in this range.</p>`;
    return;
  }

  $("anomaly-list").innerHTML = analysis.anomalies
    .slice()
    .reverse()
    .map((item) => {
      const ctx  = nearestWeather(wHistory, item.timestamp);
      const unit = item.metric === "DE-LU price" ? "EUR/MWh" : "MW";
      const wx   = ctx
        ? ` | Stuttgart ${format(ctx.temperature_c, "°C")}, wind ${format(ctx.wind_speed_ms, "m/s")}`
        : "";
      return (
        `<div class="anomaly-item" role="listitem">` +
        `<time>${escapeHtml(timeLabel(item.timestamp))}</time>` +
        `<span>${escapeHtml(item.metric)}: ${escapeHtml(format(item.value, unit))}${escapeHtml(wx)}</span>` +
        `<strong>z ${item.score >= 0 ? "+" : ""}${item.score}</strong>` +
        `</div>`
      );
    })
    .join("");
}

function renderWeather(weather) {
  if (!weather.available) {
    $("weather-chart").textContent = "Weather context is unavailable for this range.";
    $("weather-title").textContent = "Stuttgart weather context";
    $("weather-note").textContent  = weather.reason;
    return;
  }

  const m    = state.weatherMetric;
  const meta = m === "temperature_c"
    ? { key: m, label: "Temperature (°C)", className: "temperature-line", colour: "#e7ad52" }
    : { key: m, label: "Wind speed (m/s)", className: "wind-line",        colour: "#3ad3bf" };

  lineChart("weather-chart", [{ values: weather.history, key: meta.key, className: meta.className }],
    [{ text: meta.label, colour: meta.colour }]);

  $("weather-title").textContent = "Stuttgart DWD observations";
  $("weather-note").textContent  =
    `${weather.coverage}. Hourly weather is local Stuttgart context beside Germany-wide ` +
    `power data — it does not establish a causal relationship.`;
}

// ─── Source data table ────────────────────────────────────────────────────────

function buildMergedRows(priceHistory, systemHistory, weather) {
  const rows = new Map();
  for (const p of priceHistory) {
    rows.set(p.timestamp, { ...(rows.get(p.timestamp) || {}), timestamp: p.timestamp, price: p.value });
  }
  for (const p of systemHistory) {
    rows.set(p.timestamp, { ...(rows.get(p.timestamp) || {}), timestamp: p.timestamp, load: p.load, gen: p.generation });
  }
  if (weather.available) {
    for (const p of weather.history) {
      rows.set(p.timestamp, { ...(rows.get(p.timestamp) || {}), timestamp: p.timestamp, temp: p.temperature_c, wind: p.wind_speed_ms });
    }
  }
  return [...rows.values()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function renderSourceTable(priceHistory, systemHistory, weather) {
  const rows = buildMergedRows(priceHistory, systemHistory, weather).slice(0, 24);
  $("source-table").innerHTML = rows.length
    ? rows.map((r) =>
        `<tr>` +
        `<td>${escapeHtml(timeLabel(r.timestamp))}</td>` +
        `<td>${r.price === undefined ? "--" : escapeHtml(format(r.price, "EUR/MWh"))}</td>` +
        `<td>${r.load  === undefined ? "--" : escapeHtml(format(r.load,  "MW"))}</td>` +
        `<td>${r.gen   === undefined ? "--" : escapeHtml(format(r.gen,   "MW"))}</td>` +
        `<td>${r.temp  === undefined ? "--" : escapeHtml(format(r.temp,  "°C"))}</td>` +
        `<td>${r.wind  === undefined ? "--" : escapeHtml(format(r.wind,  "m/s"))}</td>` +
        `</tr>`
      ).join("")
    : `<tr><td colspan="6">No published observations available.</td></tr>`;
}

// ─── Generation mix ───────────────────────────────────────────────────────────

function fuelColour(name) {
  const n = name.toLowerCase();
  if (n.includes("solar"))                        return "#e7ad52";
  if (n.includes("wind"))                         return "#5b94ff";
  if (n.includes("hydro"))                        return "#3ad3bf";
  if (n.includes("biomass"))                      return "#76be76";
  if (n.includes("gas"))                          return "#b68071";
  if (n.includes("coal") || n.includes("lignite")) return "#677383";
  if (n.includes("nuclear"))                      return "#9a79bd";
  return "#8fa0b4";
}

function renderMix(entries = [], ts) {
  const safeEntries = entries
    .filter((entry) => entry && typeof entry.name === "string" && Number.isFinite(entry.value) && Number.isFinite(entry.share))
    .map((entry) => ({ ...entry, share: Math.min(100, Math.max(0, entry.share)) }));
  const primary = safeEntries.slice(0, 8);
  const rest    = safeEntries.slice(8);

  const bar = `<div class="mix-bar">` +
    safeEntries.map((e) =>
      `<span title="${escapeHtml(e.name)}: ${e.share}%" ` +
      `style="width:${e.share}%;background:${fuelColour(e.name)}"></span>`
    ).join("") +
    `</div>`;

  const item = (e) =>
    `<div class="mix-item">` +
    `<span class="mix-dot" style="background:${fuelColour(e.name)}"></span>` +
    `<span class="mix-name">${escapeHtml(e.name)}</span>` +
    `<strong>${format(e.value, "MW")}</strong>` +
    `<small>${e.share.toFixed(1)}% of reported generation</small>` +
    `</div>`;

  const overflow = rest.length
    ? `<details class="more-mix"><summary>Show ${rest.length} smaller categories</summary>` +
      `<div class="mix-list secondary-mix">${rest.map(item).join("")}</div></details>`
    : "";

  $("generation-mix").innerHTML = bar +
    `<div class="mix-list">${primary.map(item).join("")}</div>` +
    overflow;

  $("mix-time").textContent = timeLabel(ts);
}

// ─── District map (SVG projection) ───────────────────────────────────────────

function projectCoord(coord, bounds, w, h) {
  return [
    ((coord[0] - bounds.minX) / (bounds.maxX - bounds.minX)) * w,
    h - ((coord[1] - bounds.minY) / (bounds.maxY - bounds.minY)) * h,
  ];
}

function featurePath(geometry, bounds, w, h) {
  const polys = geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates;
  return polys.map((poly) =>
    poly.map((ring) =>
      ring.map((coord, i) => {
        const [x, y] = projectCoord(coord, bounds, w, h);
        return `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(" ") + "Z"
    ).join(" ")
  ).join(" ");
}

function renderMap(data) {
  // Compute bounding box from all coordinates
  const coords = data.features.flatMap((f) => {
    const polys = f.geometry.type === "Polygon"
      ? [f.geometry.coordinates]
      : f.geometry.coordinates;
    return polys.flatMap((poly) => poly.flat());
  });

  const lons   = coords.map((c) => c[0]);
  const lats   = coords.map((c) => c[1]);
  const margin = 0.12;
  const bounds = {
    minX: Math.min(...lons) - margin,
    maxX: Math.max(...lons) + margin,
    minY: Math.min(...lats) - margin,
    maxY: Math.max(...lats) + margin,
  };

  const W = 900, H = 500;

  const paths = data.features.map((f) =>
    `<path class="district" ` +
    `d="${featurePath(f.geometry, bounds, W, H)}">` +
    `</path>`
  ).join("");

  $("district-map").innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="group" ` +
    `aria-label="BKG boundaries for 44 Baden-Württemberg districts">` +
    paths + `</svg>`;

  $("map-status").textContent = `${data.metadata.count} verified districts`;
  $("bkg-access-year").textContent = new Date().getUTCFullYear();

}

// ─── API layer ────────────────────────────────────────────────────────────────

function buildQuery() {
  return state.rangeStart && state.rangeEnd
    ? `start=${encodeURIComponent(state.rangeStart)}&end=${encodeURIComponent(state.rangeEnd)}`
    : `days=${state.days}`;
}

function renderOverview(data) {
  const energy = data.electricity;

  // KPI cards
  metric("price",      energy.price);
  metric("load",       energy.load);
  metric("generation", energy.generation);
  metric("renewable",  energy.renewable_share);

  // Charts
  renderPrice(energy.price_history);
  renderSystem(energy.system_history);
  renderComparison(energy.price_history, energy.system_history);
  renderGenerationTrend(energy.generation_profile);
  renderMix(energy.generation_mix, energy.generation.timestamp);

  // Weather + analysis
  renderWeather(data.weather);
  renderAnalysis(energy.analysis, data.weather);

  // Source table
  renderSourceTable(energy.price_history, energy.system_history, data.weather);

  // CSV links — keep in sync with current range
  const query = buildQuery();
  $("download-csv").href  = `/api/export?${query}`;
  $("table-download").href = `/api/export?${query}`;

  // Topbar
  $("updated").textContent  = `Last updated ${timeLabel(data.generated_at)}`;
  $("coverage-copy").textContent = data.notices[0];

  // Sync calendar inputs to actual returned range
  $("range-start").value = data.range_start;
  $("range-end").value   = data.range_end;
}

// ─── Responsive grid + chart redraws ────────────────────────────────────────

let dashboardGrid;
let redrawFrame;

function scheduleChartRedraw() {
  if (!state.latest || redrawFrame) return;
  redrawFrame = requestAnimationFrame(() => {
    redrawFrame = undefined;
    renderOverview(state.latest);
  });
}

function initDashboardGrid() {
  if (typeof GridStack === "undefined") {
    $("updated").textContent = "Dashboard layout controls could not be loaded.";
    return;
  }

  dashboardGrid = GridStack.init({
    column: 12,
    cellHeight: 76,
    margin: 12,
    float: true,
    animate: true,
    disableOneColumnMode: false,
    draggable: { handle: ".panel-head" },
    resizable: { handles: "all" },
  }, "#dashboard-grid");

  dashboardGrid.on("resizestop dragstop dropped change", scheduleChartRedraw);
  new ResizeObserver(scheduleChartRedraw).observe($("dashboard-grid"));
  window.addEventListener("resize", scheduleChartRedraw, { passive: true });
}

async function loadData() {
  state.requestController?.abort();
  const controller = new AbortController();
  state.requestController = controller;
  try {
    const resp = await fetch(`/api/overview?${buildQuery()}`, { cache: "no-store", signal: controller.signal });
    if (!resp.ok) throw new Error(`Data request failed (HTTP ${resp.status})`);
    const data = await resp.json();
    if (state.requestController !== controller) return;
    state.latest = data;
    $("dashboard-error").hidden = true;
    renderOverview(data);
  } finally {
    if (state.requestController === controller) state.requestController = null;
  }
}

async function refresh() {
  const btn = $("refresh");
  btn.disabled    = true;
  btn.textContent = "Refreshing…";
  try {
    await loadData();
  } catch (err) {
    if (err.name !== "AbortError") {
      $("updated").textContent = err.message;
      $("dashboard-error").textContent = `Live data could not be refreshed. ${err.message}. Please try Refresh again.`;
      $("dashboard-error").hidden = false;
    }
  } finally {
    if (!state.requestController) {
      btn.disabled    = false;
      btn.textContent = "Refresh";
    }
  }
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

// Preset day buttons
document.querySelectorAll("[data-days]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.days       = Number(btn.dataset.days);
    state.rangeStart = null;
    state.rangeEnd   = null;
    $("custom-days").value = state.days;
    document.querySelectorAll("[data-days]").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    refresh();
  });
});

// Custom day-count input
$("apply-custom").addEventListener("click", () => {
  const v = Number($("custom-days").value);
  if (!Number.isInteger(v) || v < 1 || v > 365) {
    $("updated").textContent = "Enter a whole number from 1 to 365.";
    return;
  }
  state.days       = v;
  state.rangeStart = null;
  state.rangeEnd   = null;
  document.querySelectorAll("[data-days]").forEach((b) => b.classList.remove("active"));
  refresh();
});

// Calendar range
$("apply-date-range").addEventListener("click", () => {
  const start = $("range-start").value;
  const end   = $("range-end").value;
  if (!start || !end) { $("updated").textContent = "Set both start and end date."; return; }
  const span = Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86_400_000) + 1;
  if (span < 1 || span > 365) { $("updated").textContent = "Range must be 1–365 days."; return; }
  state.rangeStart = start;
  state.rangeEnd   = end;
  document.querySelectorAll("[data-days]").forEach((b) => b.classList.remove("active"));
  refresh();
});

// Price chart type toggle
$("price-line").addEventListener("click", () => {
  state.priceMode = "line";
  $("price-line").classList.add("active");
  $("price-bars").classList.remove("active");
  $("price-line").setAttribute("aria-pressed", "true");
  $("price-bars").setAttribute("aria-pressed", "false");
  if (state.latest) renderOverview(state.latest);
});
$("price-bars").addEventListener("click", () => {
  state.priceMode = "bars";
  $("price-bars").classList.add("active");
  $("price-line").classList.remove("active");
  $("price-bars").setAttribute("aria-pressed", "true");
  $("price-line").setAttribute("aria-pressed", "false");
  if (state.latest) renderOverview(state.latest);
});

// Weather metric toggle
$("weather-temperature").addEventListener("click", () => {
  state.weatherMetric = "temperature_c";
  $("weather-temperature").classList.add("active");
  $("weather-wind").classList.remove("active");
  $("weather-temperature").setAttribute("aria-pressed", "true");
  $("weather-wind").setAttribute("aria-pressed", "false");
  if (state.latest) renderOverview(state.latest);
});
$("weather-wind").addEventListener("click", () => {
  state.weatherMetric = "wind_speed_ms";
  $("weather-wind").classList.add("active");
  $("weather-temperature").classList.remove("active");
  $("weather-wind").setAttribute("aria-pressed", "true");
  $("weather-temperature").setAttribute("aria-pressed", "false");
  if (state.latest) renderOverview(state.latest);
});

// Refresh button
$("refresh").addEventListener("click", refresh);

// ─── Bootstrap ────────────────────────────────────────────────────────────────

initDashboardGrid();

// Fetch energy data
refresh();

// Fetch map in parallel (independent of energy data)
fetch("/api/districts", { cache: "no-store" })
  .then((r) => {
    if (!r.ok) throw new Error(`Districts request failed (HTTP ${r.status})`);
    return r.json();
  })
  .then(renderMap)
  .catch((err) => { $("map-status").textContent = err.message; });
