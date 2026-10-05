# Data Rules

## Truth rules

1. Do not label a value `live` unless it is directly returned by a source for the metric and geography shown.
2. Never turn a national, bidding-zone, or state measure into a district measure through population, area, demand profile, or any other allocation and call it observed.
3. If the provider has latency, label the provider's published timestamp and cadence rather than claiming real time.
4. Preserve original units in source payloads unless a conversion is explicit, reproducible, and displayed.
5. Do not ship access tokens in HTML, JavaScript, git history, screenshots, or logs.
6. Show co-movement between price, load, generation, and weather only as context. Do not present it as proof that one series caused another.

## Failure rules

1. Missing credentials means `not configured`, not `0` and not a demo number.
2. Network, schema, or integrity-check failures mean `unavailable` with a concise cause.
3. Cache only successful responses; a previous observation must not be presented as a newly observed value.
4. A failed district integrity check blocks the map instead of rendering a partial or ambiguous geography.
5. Statistical anomaly flags are screening results, not an explanation of the event. They require source and market context before operational use.
6. Weather and system data must state their different spatial coverage whenever they are placed side by side.
7. Do not fill a missing hourly weather point or infer weather for a period beyond the verified source response.
8. An indexed comparison chart must name its base point and must never be described as a physical or causal relationship.
9. A grouped generation chart may sum only explicitly named published technologies and must retain a technology list in the code and documentation.
10. Never write upstream operational observations to a file, database, browser storage, or server memory cache. A refresh must request the source again.

## Source rules

1. Prefer primary public authorities and documented APIs.
2. Attribute BKG under Datenlizenz Deutschland - Namensnennung 2.0 and retain its source reference.
