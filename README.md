# BW Energy Observatory

Source-transparent live energy intelligence for Baden-Württemberg. The dashboard displays published DE-LU electricity prices, German electricity load and generation, Stuttgart DWD weather context, and official BKG boundaries for all 44 Baden-Wurttemberg districts.

**No synthetic values, forecasts, or fabricated fallbacks.** A source is either returned with its geography and timestamp, or marked unavailable with a reason.

## Data coverage

| Metric | Source | Geography |
| --- | --- | --- |
| Day-ahead electricity price | SMARD via Fraunhofer ISE Energy-Charts | DE-LU bidding zone |
| Load and generation | Fraunhofer ISE Energy-Charts | Germany |
| Weather context | DWD observations via Bright Sky | nearest Stuttgart station |
| District boundaries | BKG VG250 WFS | 44 Baden-Wurttemberg Landkreise |

The map is an official geographic index, not a live district-consumption heat map: there is no authoritative public operational series for every Landkreis.

## Project Documents

- [Product requirements](docs/PRD.md)
- [Architecture](docs/architecture.md)
- [Data rules](docs/rules.md)
- [Design notes](docs/design.md)
- [Delivery phases](docs/phases.md)

## Licence

MIT. See [LICENSE](LICENSE). Data providers retain their respective licences and attribution requirements.
