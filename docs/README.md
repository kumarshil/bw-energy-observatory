# Baden-Wuerttemberg Energy Observatory

A source-transparent dashboard for current German electricity generation and load, the DE-LU day-ahead price, Stuttgart DWD weather observations, and the 44 Baden-Wuerttemberg district boundaries.

## Run

```bash
cd "/Users/sahilsagwal/Documents/New project"
python3 app/server.py
```

Open `http://127.0.0.1:8000`. No package installation is needed.

## Data honesty

- Electricity price: DE-LU day-ahead market price, not a household or business tariff.
- Generation and electricity load: German national system data, not Baden-Wuerttemberg-only measurements.
- District boundaries: official BKG VG250 data. The service deduplicates repeated records and asserts exactly 44 official district codes.
- District-level real-time electricity consumption is not publicly published as one authoritative series; the map does not manufacture a district choropleth.
- A missing source is displayed as unavailable. There is no estimated or generated fallback.

See `PRD.md`, `architecture.md`, `rules.md`, `phascs.md`, `design.md`, and `memory.md` in this directory.
