# Delivery Phases

## Phase 1: Truthful core ✅ COMPLETE

Delivered: same-origin Python service, public electricity feed via
Fraunhofer ISE Energy-Charts, BKG district map, source-transparency UI,
unavailable states everywhere, and 12 passing unit tests.

No synthetic data anywhere. Every metric either has a verified source
or is explicitly marked unavailable with a reason.

## Phase 2: Authenticated regional data

Add an ENTSO-E adapter after a token is provided. Document each EIC domain,
query type, publication delay, and the exact regional coverage.
Keep it separate from the public Germany-wide Energy-Charts signal.

Prerequisites:
- Register at transparency.entsoe.eu for a free security token
- Set `ENTSO_API_TOKEN` in the environment
- Test with TransnetBW domain `10YDE-VE-------2`

## Phase 3: Licensed commodity coverage

Choose and contract a provider whose licence permits the intended display
for TTF gas, EU ETS allowances, coal, and uranium.

Add provider-specific payload validation and timestamp tests before
enabling a card. Currently these five cards show "Feed unavailable"
with an honest reason.

## Phase 4: Historical district statistics

Add annual or monthly official district statistics only in a clearly
labelled historical layer. Never blend these with live operational
measurements.

Candidate source: Statistisches Landesamt Baden-Württemberg
(annual energy statistics per Landkreis).

## Phase 5: Production deployment

- Deploy behind HTTPS with a reverse proxy (nginx or Caddy)
- Replace the in-memory `TimedCache` with Redis or a persistent store
- Add structured logging and source-health alerts
- Record source-version metadata in every API response
- Set `HOST=0.0.0.0` and use a process manager (systemd or Docker)
