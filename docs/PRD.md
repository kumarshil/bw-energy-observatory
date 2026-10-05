# Product Requirements Document

## Product

BW Energy Observatory is a public-data dashboard for Baden-Wuerttemberg. It presents the latest published DE-LU electricity price, German electricity load and generation, raw-material benchmarks, and all 44 Baden-Wuerttemberg administrative districts.

## Users and decisions

- Energy analysts compare the most recently published market and operating signals.
- Public-sector users navigate the complete district geography without mistaking a state signal for district measurement.
- Technical operators can see which source, unit, time, and spatial coverage produced every displayed value.

## Requirements

1. Retrieve electricity price, generation, and load from verified public APIs without client-side secrets.
2. Render exactly 44 unique Baden-Wuerttemberg district boundaries from an official geographic source.
3. Mark every metric as available or unavailable. Do not use calculated, copied-forward, random, or profile-based substitutes as live data.
4. Show metric name, unit, timestamp, coverage, source, and source latency/meaning.
5. Offer preset and custom one-to-365-day views of actual published system time series.
6. Break the latest published generation observation into its actual energy-type categories and shares. Do not label it as consumption.
7. Selecting a district updates the detail panel, but may not transform non-district measurements into local estimates.
8. Include Brent crude, natural gas, thermal coal, EU ETS allowance, and uranium benchmark cards. A card only shows a value when its licensed source adapter returns one.
9. Provide a line/bar price-chart choice, an on-page source-data list, and a CSV export retaining original UTC timestamps.
10. Show DWD weather observations near Stuttgart for the selected energy-query range, up to the dashboard's 365-day maximum, clearly separating local weather coverage from Germany-wide electricity coverage.
11. Screen price and load observations for statistically unusual values with a documented robust method; never label a flag as a causal finding.
12. Provide rolling and explicit calendar-date ranges up to 365 days, with the exported rows bound to the same selected interval.
13. Use charts as the primary dashboard surface, including source-by-source generation and indexed price/load comparison; keep exact values in the optional table and CSV.
14. Work on desktop and mobile without a build step.

## Non-goals

- Retail electricity tariff comparison.
- A claim of live electricity consumption for each district.
- Forecasting and any demographic allocation of national load.
- A claim that local weather causes an observed market or system change.
- A district-level consumption prediction without a verified historical district time series.
- Scraping exchange websites or bypassing market-data licences.

## Acceptance checks

- `/api/districts` reports 44 features after deduplication by `ars`.
- If an upstream feed fails, the interface displays unavailable and a reason.
- The dashboard does not contain demo values or a data-generation fallback.
