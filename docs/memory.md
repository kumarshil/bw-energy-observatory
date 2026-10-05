# Project Memory

## Decisions

- Scope is Baden-Wuerttemberg's 44 districts, not 44 European countries.
- The previous project was not used as a runtime base because it generated BDEW/profile estimates whenever a source failed and labelled them as operational data.
- Fraunhofer ISE Energy-Charts was selected for a no-key public core because it returns current German production/load and its price route identifies SMARD/Bundesnetzagentur attribution.
- BKG VG250 was selected as the boundary authority. Its current Baden-Wuerttemberg WFS result contains 46 features but only 44 distinct `ars` district codes, so deduplication and a hard count check are mandatory.
- District consumption remains intentionally unavailable because an authoritative public live series was not found for all 44 districts.
- Forecasting is intentionally skipped: no verified live or historical operational-consumption series exists for all 44 districts, so a model would not satisfy the project's scientific-data rule.
- The anomaly screen uses a 96-interval rolling median/MAD robust z-score on observed German load and DE-LU price data. It highlights unusual values only; it does not attribute causes to fuel prices, weather, or renewables.
- Bright Sky supplies DWD observations for the station nearest Stuttgart centre across the selected query interval, up to the dashboard's 365-day limit. Weather remains local context alongside national/DE-LU energy observations.
- CSV export retains published timestamps and values; no source is resampled or allocated to a district.
- Calendar dates are accepted up to 365 days. The visual layer adds an indexed price/load view and a direct named-technology generation trend; neither is a forecast or causal attribution.
- The dashboard does not persist operational data. Overview and CSV requests directly query the configured publishers; only static BKG boundary geometry is held in process memory for efficiency.

## Follow-up inputs needed

- An ENTSO-E token if TSO-level actual-load data is required.
- Deployment target and preferred cache/monitoring stack.
