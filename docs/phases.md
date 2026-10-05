# Delivery Phases

## Phase 1: Truthful Core

Complete: same-origin service, published electricity price/load/generation data, official BKG map, source transparency, explicit unavailable states, CSV export, and integrity tests.

## Phase 2: Authenticated Regional Data

Add an ENTSO-E adapter only after a token is supplied. Document the EIC domain, query type, publication delay, and geographic coverage. Keep it separate from the public Germany-wide Energy-Charts signals.

## Phase 3: Historical District Statistics

Add annual or monthly official district statistics only as a labelled historical layer. Never blend them with live operational measurements.

## Phase 4: Operations

Deploy behind HTTPS, add source-health checks and structured logs, and publish source-version metadata. Do not persist or replay operational observations as current data.
