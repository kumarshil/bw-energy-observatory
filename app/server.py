"""Dependency-free server for the Baden-Wuerttemberg Energy Observatory.

The service deliberately returns an unavailable state instead of manufacturing a
fallback value when an upstream source fails or a credential is absent.
"""

from __future__ import annotations

import csv
import ipaddress
import io
import json
import logging
import math
import os
import re
import statistics
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = ROOT / "static"
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))
USER_AGENT = "BW-Energy-Observatory/1.0 (transparent public-data dashboard)"
LOGGER = logging.getLogger(__name__)
BKG_WFS = "https://sg.geodatenzentrum.de/wfs_vg250"
ENERGY_CHARTS = "https://api.energy-charts.info"
BRIGHT_SKY = "https://api.brightsky.dev/weather"
MAX_RANGE_DAYS = 365
MAX_JSON_BYTES = 20 * 1024 * 1024
API_RATE_LIMIT = int(os.getenv("API_RATE_LIMIT", "30"))
API_RATE_WINDOW_SECONDS = int(os.getenv("API_RATE_WINDOW_SECONDS", "60"))
TRUST_PROXY_HEADERS = os.getenv("TRUST_PROXY_HEADERS", "false").lower() == "true"
NON_GENERATION_TYPES = {
    "Load",
    "Residual load",
    "Renewable share of load",
    "Renewable share of generation",
    "Cross border electricity trading",
    "Hydro pumped storage consumption",
}
UPSTREAM_DATA_ERRORS = (RuntimeError, ValueError, TypeError, KeyError, IndexError)


class TimedCache:
    def __init__(self) -> None:
        self._items: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str, seconds: int, loader: Callable[[], Any]) -> Any:
        with self._lock:
            cached = self._items.get(key)
            if cached and time.monotonic() - cached[0] < seconds:
                return cached[1]
        value = loader()
        with self._lock:
            self._items[key] = (time.monotonic(), value)
        return value


CACHE = TimedCache()


class ClientInputError(ValueError):
    """A request that cannot be fulfilled because the client input is invalid."""


class SlidingWindowRateLimiter:
    """Keep a short, in-memory request budget without retaining source data."""

    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def allow(self, client: str) -> bool:
        if self.limit <= 0:
            return True
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            # Prune every client key so a distributed request flood cannot make
            # this non-persistent limiter grow without bound.
            self._requests = {
                key: [requested_at for requested_at in timestamps if requested_at > cutoff]
                for key, timestamps in self._requests.items()
                if any(requested_at > cutoff for requested_at in timestamps)
            }
            requests = self._requests.get(client, [])
            if len(requests) >= self.limit:
                self._requests[client] = requests
                return False
            requests.append(now)
            self._requests[client] = requests
            return True


RATE_LIMITER = SlidingWindowRateLimiter(API_RATE_LIMIT, API_RATE_WINDOW_SECONDS)

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; "
        "connect-src 'self'; object-src 'none'; base-uri 'self'; "
        "form-action 'self'; frame-ancestors 'none'"
    ),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}


def client_identifier(remote_address: str, forwarded_for: str | None = None) -> str:
    """Return a rate-limit key, trusting proxy headers only when configured."""
    if TRUST_PROXY_HEADERS and forwarded_for:
        candidate = forwarded_for.split(",", 1)[0].strip()
        try:
            return str(ipaddress.ip_address(candidate))
        except ValueError:
            pass
    return remote_address


def fetch_json(url: str, timeout: int = 25) -> dict[str, Any]:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read(MAX_JSON_BYTES + 1)
            if len(body) > MAX_JSON_BYTES:
                raise RuntimeError("Upstream response exceeded the safety limit")
            return json.loads(body.decode("utf-8"))
    except HTTPError as error:
        raise RuntimeError(f"Upstream HTTP {error.code}") from error
    except (URLError, TimeoutError) as error:
        raise RuntimeError(f"Upstream connection failed: {error.reason if hasattr(error, 'reason') else error}") from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RuntimeError("Upstream returned invalid JSON") from error


def iso_timestamp(unix_seconds: int | float) -> str:
    return datetime.fromtimestamp(unix_seconds, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def resolve_time_bounds(days: int = 2, start: datetime | None = None, end: datetime | None = None) -> tuple[datetime, datetime]:
    """Return a validated UTC interval for published 15-minute source data."""
    if start is not None or end is not None:
        if start is None or end is None or start >= end:
            raise RuntimeError("Provide both a valid start and end date.")
        if (end - start).days > MAX_RANGE_DAYS:
            raise RuntimeError(f"Choose a range of up to {MAX_RANGE_DAYS} days.")
        return start, end
    if not 1 <= days <= MAX_RANGE_DAYS:
        raise RuntimeError(f"Choose a range of 1 to {MAX_RANGE_DAYS} days.")
    end = datetime.now(timezone.utc)
    return end - timedelta(days=days), end


def unavailable(name: str, reason: str, coverage: str, unit: str) -> dict[str, Any]:
    return {
        "name": name,
        "available": False,
        "value": None,
        "unit": unit,
        "coverage": coverage,
        "reason": reason,
        "timestamp": None,
    }


def generation_mix(types: dict[str, list[Any]], index: int) -> list[dict[str, Any]]:
    """Return only measured, positive electricity-generation categories."""
    entries = []
    for name, values in types.items():
        if name in NON_GENERATION_TYPES or len(values) <= index:
            continue
        value = values[index]
        if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0:
            entries.append({"name": name, "value": round(value, 1)})
    return sorted(entries, key=lambda entry: entry["value"], reverse=True)


def generation_value(types: dict[str, list[Any]], index: int) -> float:
    return round(sum(entry["value"] for entry in generation_mix(types, index)), 1)


def technology_value(types: dict[str, list[Any]], names: tuple[str, ...], index: int) -> float | None:
    """Sum only published values for a group of named technologies."""
    values = [
        types[name][index]
        for name in names
        if len(types.get(name, [])) > index
        and isinstance(types[name][index], (int, float))
        and not isinstance(types[name][index], bool)
        and math.isfinite(types[name][index])
    ]
    return round(sum(values), 1) if values else None


def robust_anomalies(observations: list[dict[str, Any]], key: str, metric: str, window: int = 96) -> list[dict[str, Any]]:
    """Flag extreme values with a rolling median/MAD robust z-score.

    A flag is a statistical screening result, not a causal explanation. The
    96-point window represents one day of 15-minute source intervals.
    """
    findings = []
    for index in range(window, len(observations)):
        baseline = [item[key] for item in observations[index - window:index] if item.get(key) is not None]
        if len(baseline) < window // 2:
            continue
        center = statistics.median(baseline)
        mad = statistics.median([abs(value - center) for value in baseline])
        if mad == 0:
            continue
        score = 0.6745 * (observations[index][key] - center) / mad
        if abs(score) >= 3.5:
            findings.append({"metric": metric, "timestamp": observations[index]["timestamp"], "value": observations[index][key], "score": round(score, 1)})
    return findings[-8:]


def weather_overview(days: int, start: datetime | None = None, end: datetime | None = None) -> dict[str, Any]:
    """Return observed DWD weather for Stuttgart, without treating it as causal data.

    Bright Sky exposes DWD observations for the complete selected dashboard
    interval.  Keep its query bounds identical to the energy-query bounds so
    a longer historical energy comparison does not silently lose its local
    weather context.
    """
    start, end = resolve_time_bounds(days, start, end)
    query = urlencode({
        "lat": "48.7758",
        "lon": "9.1829",
        "date": start.date().isoformat(),
        "last_date": end.date().isoformat(),
    })
    source_url = f"{BRIGHT_SKY}?{query}"
    response = fetch_json(source_url)
    history = []
    for row in response.get("weather", []):
        timestamp = row.get("timestamp") if isinstance(row, dict) else None
        if not isinstance(timestamp, str):
            continue
        try:
            observed_at = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).astimezone(timezone.utc)
        except ValueError:
            continue
        if not start <= observed_at < end:
            continue
        history.append({
            "timestamp": observed_at.isoformat().replace("+00:00", "Z"),
            "temperature_c": row.get("temperature"),
            "wind_speed_ms": row.get("wind_speed"),
            "sunshine_min": row.get("sunshine"),
            "solar_kw_m2": row.get("solar"),
        })
    if not history:
        raise RuntimeError("Bright Sky returned no weather observations")
    latest = history[-1]
    station = next(
        (source for source in response.get("sources", []) if isinstance(source, dict) and source.get("station_name")),
        {},
    )
    return {
        "available": True,
        "name": "Stuttgart weather context",
        "coverage": f"{station.get('station_name', 'nearest DWD station')} (about {round(station.get('distance', 0) / 1000, 1)} km from Stuttgart centre)",
        "timestamp": latest["timestamp"],
        "source": "DWD observations via Bright Sky",
        "source_url": source_url,
        "history": history,
    }


def export_rows(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Create a transparent, timestamp-aligned source-data download."""
    electricity = data["electricity"]
    rows: dict[str, dict[str, Any]] = {}
    for point in electricity.get("price_history", []):
        rows.setdefault(point["timestamp"], {"timestamp": point["timestamp"]})["de_lu_price_eur_mwh"] = point["value"]
    for point in electricity.get("system_history", []):
        row = rows.setdefault(point["timestamp"], {"timestamp": point["timestamp"]})
        row["german_load_mw"] = point["load"]
        row["german_generation_mw"] = point["generation"]
    weather = data.get("weather", {})
    for point in weather.get("history", []):
        row = rows.setdefault(point["timestamp"], {"timestamp": point["timestamp"]})
        row["stuttgart_temperature_c"] = point.get("temperature_c")
        row["stuttgart_wind_speed_ms"] = point.get("wind_speed_ms")
        row["stuttgart_sunshine_min"] = point.get("sunshine_min")
        row["stuttgart_solar_kw_m2"] = point.get("solar_kw_m2")
    return [rows[timestamp] for timestamp in sorted(rows)]


def energy_overview(days: int = 2, start: datetime | None = None, end: datetime | None = None) -> dict[str, Any]:
    start, end = resolve_time_bounds(days, start, end)
    start_value = start.isoformat().replace("+00:00", "Z")
    end_value = end.isoformat().replace("+00:00", "Z")
    params = urlencode({"country": "de", "start": start_value, "end": end_value})
    power_url = f"{ENERGY_CHARTS}/public_power?{params}"
    price_url = f"{ENERGY_CHARTS}/price?{urlencode({'bzn': 'DE-LU', 'start': start_value, 'end': end_value})}"
    power = fetch_json(power_url)
    prices = fetch_json(price_url)

    timestamps = power.get("unix_seconds", [])
    types = {
        entry["name"]: entry["data"]
        for entry in power.get("production_types", [])
        if isinstance(entry, dict) and isinstance(entry.get("name"), str) and isinstance(entry.get("data"), list)
    }
    load = types.get("Load", [])
    if not timestamps or not load or len(timestamps) != len(load):
        raise RuntimeError("Energy-Charts returned no load observations")

    index = max((i for i, value in enumerate(load) if value is not None), default=-1)
    if index < 0:
        raise RuntimeError("Energy-Charts latest load observation is null")

    mix = generation_mix(types, index)
    generation = sum(entry["value"] for entry in mix)
    renewable_types = ("Hydro Run-of-River", "Biomass", "Geothermal", "Hydro water reservoir", "Wind offshore", "Wind onshore", "Solar")
    renewables = sum(
        max(0, value)
        for name in renewable_types
        if (value := technology_value(types, (name,), index)) is not None
    )
    price_values = prices.get("price", [])
    price_times = prices.get("unix_seconds", [])
    if len(price_values) != len(price_times):
        raise RuntimeError("Energy-Charts returned misaligned price observations")
    price_index = max((i for i, value in enumerate(price_values) if value is not None), default=-1)
    if price_index < 0:
        price = unavailable("DE-LU day-ahead electricity", "No published price in the requested interval.", "DE-LU bidding zone", "EUR/MWh")
    else:
        price = {
            "name": "DE-LU day-ahead electricity",
            "available": True,
            "value": price_values[price_index],
            "unit": "EUR/MWh",
            "coverage": "DE-LU bidding zone, not a retail tariff",
            "timestamp": iso_timestamp(price_times[price_index]),
            "source": "SMARD / Bundesnetzagentur via Fraunhofer ISE Energy-Charts",
            "source_url": price_url,
            "latency": "Published day-ahead market price",
        }

    price_history = [
        {"timestamp": iso_timestamp(timestamp), "value": value}
        for timestamp, value in zip(price_times, price_values)
        if value is not None
    ]
    system_history = []
    generation_profile = []
    profile_types = {
        "solar": ("Solar",),
        "wind": ("Wind onshore", "Wind offshore"),
        "hydro": ("Hydro Run-of-River", "Hydro water reservoir"),
        "biomass": ("Biomass",),
        "fossil": ("Fossil brown coal / lignite", "Fossil hard coal", "Fossil gas", "Fossil oil", "Fossil coal-derived gas"),
    }
    for point_index, timestamp in enumerate(timestamps):
        if point_index >= len(load) or load[point_index] is None:
            continue
        current_generation = generation_value(types, point_index)
        if current_generation:
            system_history.append({
                "timestamp": iso_timestamp(timestamp),
                "load": load[point_index],
                "generation": current_generation,
            })
            generation_profile.append({
                "timestamp": iso_timestamp(timestamp),
                **{name: technology_value(types, names, point_index) for name, names in profile_types.items()},
            })
    analysis = {
        "negative_price_intervals": sum(1 for point in price_history if point["value"] < 0),
        "anomalies": robust_anomalies(price_history, "value", "DE-LU price") + robust_anomalies(system_history, "load", "German load"),
        "method": "Rolling 96-interval median/MAD robust z-score; a flag is unusual behaviour, not a cause.",
    }

    return {
        "price": price,
        "load": {
            "name": "Electricity load",
            "available": True,
            "value": load[index],
            "unit": "MW",
            "coverage": "Germany, national electricity system",
            "timestamp": iso_timestamp(timestamps[index]),
            "source": "Fraunhofer ISE Energy-Charts",
            "source_url": power_url,
            "latency": "15-minute operational series",
        },
        "generation": {
            "name": "Observed generation",
            "available": True,
            "value": round(generation, 1),
            "unit": "MW",
            "coverage": "Germany, national electricity system",
            "timestamp": iso_timestamp(timestamps[index]),
            "source": "Fraunhofer ISE Energy-Charts",
            "source_url": power_url,
            "latency": "15-minute operational series; excludes imports/exports and pumping demand",
        },
        "renewable_share": {
            "name": "Renewable generation share",
            "available": generation > 0,
            "value": round(renewables / generation * 100, 1) if generation else None,
            "unit": "%",
            "coverage": "Germany, national electricity system",
            "timestamp": iso_timestamp(timestamps[index]),
            "source": "Calculated from published Energy-Charts generation technologies",
            "source_url": power_url,
            "latency": "Same as generation",
        },
        "generation_mix": [
            {**entry, "share": round(entry["value"] / generation * 100, 1)}
            for entry in mix
        ] if generation else [],
        "price_history": price_history,
        "system_history": system_history,
        "generation_profile": generation_profile,
        "analysis": analysis,
    }


def districts() -> dict[str, Any]:
    query = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": "vg250:vg250_krs",
        "outputFormat": "application/json",
        "srsName": "EPSG:4326",
        "CQL_FILTER": "sn_l='08'",
        "count": "100",
    }
    raw = fetch_json(f"{BKG_WFS}?{urlencode(query)}", timeout=45)
    unique: dict[str, dict[str, Any]] = {}
    for feature in raw.get("features", []):
        properties = feature.get("properties", {})
        district_code = properties.get("ars")
        geometry = feature.get("geometry")
        name = properties.get("gen")
        district_type = properties.get("bez")
        if (
            isinstance(district_code, str)
            and isinstance(name, str)
            and isinstance(district_type, str)
            and isinstance(geometry, dict)
            and geometry.get("type") in {"Polygon", "MultiPolygon"}
            and district_code not in unique
        ):
            unique[district_code] = {
                "type": "Feature",
                "id": district_code,
                "geometry": geometry,
                "properties": {
                    "code": district_code,
                    "name": name,
                    "type": district_type,
                },
            }
    features = sorted(unique.values(), key=lambda feature: feature["properties"]["name"])
    if len(features) != 44:
        raise RuntimeError(f"BKG district integrity check failed: expected 44 unique districts, got {len(features)}")
    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "count": len(features),
            "source": "Bundesamt fuer Kartographie und Geodaesie (BKG), VG250",
            "license": "Datenlizenz Deutschland - Namensnennung 2.0",
            "coverage": "Baden-Wuerttemberg: 35 Landkreise and 9 Stadtkreise",
        },
    }


def overview(days: int = 2, start: datetime | None = None, end: datetime | None = None) -> dict[str, Any]:
    start, end = resolve_time_bounds(days, start, end)
    errors: list[str] = []
    with ThreadPoolExecutor(max_workers=2) as executor:
        electricity_future = executor.submit(energy_overview, days, start, end)
        weather_future = executor.submit(weather_overview, days, start, end)
        try:
            electricity = electricity_future.result()
        except UPSTREAM_DATA_ERRORS as error:
            errors.append(str(error))
            electricity = {
                "price": unavailable("DE-LU day-ahead electricity", str(error), "DE-LU bidding zone", "EUR/MWh"),
                "load": unavailable("Electricity load", str(error), "Germany", "MW"),
                "generation": unavailable("Observed generation", str(error), "Germany", "MW"),
                "renewable_share": unavailable("Renewable generation share", str(error), "Germany", "%"),
                "generation_mix": [],
                "price_history": [],
                "system_history": [],
                "generation_profile": [],
                "analysis": {"negative_price_intervals": 0, "anomalies": [], "method": "No analysis while source data is unavailable."},
            }
        try:
            weather = weather_future.result()
        except UPSTREAM_DATA_ERRORS as error:
            errors.append(str(error))
            weather = {
                "available": False,
                "name": "Stuttgart weather context",
                "coverage": "Nearest DWD station to Stuttgart",
                "reason": str(error),
                "history": [],
            }
    display_end = (end - timedelta(days=1)).date().isoformat() if end.time() == datetime.min.time() else end.date().isoformat()
    return {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "range_days": (end - start).days,
        "range_start": start.date().isoformat(),
        "range_end": display_end,
        "electricity": electricity,
        "weather": weather,
        "notices": errors + [
            "Live public electricity data is published at German or DE-LU-bidding-zone level. There is no authoritative public live electricity consumption series for each of Baden-Wuerttemberg's 44 districts.",
        ],
    }


class ApiHandler(SimpleHTTPRequestHandler):
    server_version = "BW-Energy-Observatory"
    sys_version = ""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        for header, value in SECURITY_HEADERS.items():
            self.send_header(header, value)
        super().end_headers()

    def send_json(self, payload: Any, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_csv(self, rows: list[dict[str, Any]], filename: str) -> None:
        columns = [
            "timestamp",
            "de_lu_price_eur_mwh",
            "german_load_mw",
            "german_generation_mw",
            "stuttgart_temperature_c",
            "stuttgart_wind_speed_ms",
            "stuttgart_sunshine_min",
            "stuttgart_solar_kw_m2",
        ]
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
        body = buffer.getvalue().encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    @staticmethod
    def request_range(query: str) -> tuple[int, datetime | None, datetime | None]:
        values = parse_qs(query)
        start_value = values.get("start", [None])[0]
        end_value = values.get("end", [None])[0]
        if start_value or end_value:
            if not start_value or not end_value:
                raise ClientInputError("Provide both a start and end date in YYYY-MM-DD format.")
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", start_value) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", end_value):
                raise ClientInputError("Dates must use YYYY-MM-DD format.")
            try:
                start = datetime.strptime(start_value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                end = (datetime.strptime(end_value, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1))
            except ValueError as error:
                raise ClientInputError("Dates must use YYYY-MM-DD format.") from error
            if end.date() > (datetime.now(timezone.utc) + timedelta(days=1)).date():
                raise ClientInputError("The end date cannot be in the future.")
            try:
                resolve_time_bounds(1, start, end)
            except RuntimeError as error:
                raise ClientInputError(str(error)) from error
            return (end - start).days, start, end
        requested_days = values.get("days", ["2"])[0]
        try:
            days = int(requested_days)
        except ValueError:
            raise ClientInputError("days must be a whole number from 1 to 365.") from None
        if not 1 <= days <= MAX_RANGE_DAYS:
            raise ClientInputError("days must be a whole number from 1 to 365.")
        return days, None, None

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        route = parsed.path
        try:
            client = client_identifier(self.client_address[0], self.headers.get("X-Forwarded-For"))
            if route in {"/api/overview", "/api/export", "/api/districts"} and not RATE_LIMITER.allow(client):
                self.send_json(
                    {"error": "Too many requests. Please wait one minute before trying again."},
                    HTTPStatus.TOO_MANY_REQUESTS,
                )
                return
            if route == "/api/overview":
                days, start, end = self.request_range(parsed.query)
                self.send_json(overview(days, start, end))
                return
            if route == "/api/export":
                days, start, end = self.request_range(parsed.query)
                data = overview(days, start, end)
                self.send_csv(export_rows(data), f"bw-energy-observatory-{data['range_start']}-to-{data['range_end']}.csv")
                return
            if route == "/api/districts":
                self.send_json(CACHE.get("districts", 86400, districts))
                return
            if route == "/api/health":
                self.send_json({"status": "ok", "time": datetime.now(timezone.utc).isoformat()})
                return
            super().do_GET()
        except ClientInputError as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
        except RuntimeError as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_GATEWAY)
        except Exception:
            LOGGER.exception("Unhandled dashboard request error")
            self.send_json({"error": "The server could not process this request."}, HTTPStatus.INTERNAL_SERVER_ERROR)


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), ApiHandler)
    print(f"Baden-Wuerttemberg Energy Observatory running at http://{HOST}:{PORT}")
    server.serve_forever()
