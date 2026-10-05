# BW Energy Observatory

Source-transparent live energy intelligence for Baden-Wurttemberg. The dashboard displays published DE-LU electricity prices, German electricity load and generation, Stuttgart DWD weather context, [...]

**No synthetic values, forecasts, or fabricated fallbacks.** A source is either returned with its geography and timestamp, or marked unavailable with a reason.

## Verify

```bash
PYTHONPYCACHEPREFIX=/tmp/bw-energy-pycache python3 tests/test_server.py -v
node --check static/app.js
```

## Production notes

The built-in server is for local development and demonstration only. It sends a
restrictive Content Security Policy, anti-framing headers, and an in-memory
per-client API request limit, but it is not an internet-facing production
application server.

```bash
export API_RATE_LIMIT="30"
export API_RATE_WINDOW_SECONDS="60"
python3 app/server.py
```

For a public deployment, use a managed application platform or production WSGI/
ASGI server behind an HTTPS reverse proxy or CDN. Apply connection limits,
request timeouts, rate limiting, HSTS, and TLS at that edge. If a trusted proxy
removes client-supplied `X-Forwarded-For`, set `TRUST_PROXY_HEADERS=true` so
the local limiter can distinguish verified visitors.

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
