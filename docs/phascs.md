# Delivery Phases

## Phase 1: Truthful core

Completed in this project: same-origin service, public electricity feed, BKG map, provenance UI, unavailable states, and minimum integrity tests.

## Phase 2: Authenticated regional data

Add an ENTSO-E adapter after a token is provided. Document each EIC domain, query type, publication delay, and the exact regional coverage. Keep it separate from the public Germany-wide Energy-Charts signal.

## Phase 3: Historical district statistics

Add annual or monthly official district statistics only in a clearly labelled historical layer. Never blend these with live operational measurements.

## Phase 4: Operations

Deploy behind HTTPS, replace the in-memory cache with persistent cache/observability, add source health alerts, and record source-version metadata.
