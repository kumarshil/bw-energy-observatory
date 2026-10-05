import importlib.util
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

SERVER_PATH = Path(__file__).parents[1] / "app" / "server.py"
SPEC = importlib.util.spec_from_file_location("server_under_test", SERVER_PATH)
server = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(server)


class DistrictTests(unittest.TestCase):
    def test_districts_deduplicates_and_requires_exactly_44(self):
        features = []
        for index in range(44):
            features.append({"geometry": {"type": "Polygon", "coordinates": []}, "properties": {"ars": f"08{index:03d}", "gen": f"District {index}", "bez": "Landkreis"}})
        features.extend([features[0], features[1]])
        with patch.object(server, "fetch_json", return_value={"features": features}):
            result = server.districts()
        self.assertEqual(result["metadata"]["count"], 44)
        self.assertEqual(len(result["features"]), 44)

    def test_districts_rejects_wrong_count(self):
        with patch.object(server, "fetch_json", return_value={"features": []}):
            with self.assertRaisesRegex(RuntimeError, "expected 44"):
                server.districts()


class EnergyTests(unittest.TestCase):
    def test_unavailable_never_contains_a_synthetic_value(self):
        result = server.unavailable("Example", "Source failed", "Germany", "MW")
        self.assertFalse(result["available"])
        self.assertIsNone(result["value"])

    def test_generation_mix_excludes_load_and_negative_pumping(self):
        result = server.generation_mix({"Load": [500], "Wind onshore": [200], "Hydro pumped storage consumption": [-80], "Solar": [100]}, 0)
        self.assertEqual(result, [{"name": "Wind onshore", "value": 200}, {"name": "Solar", "value": 100}])

    def test_generation_value_is_the_sum_of_valid_generation_categories(self):
        result = server.generation_value({"Load": [500], "Wind onshore": [200], "Solar": [100], "Hydro pumped storage consumption": [-50]}, 0)
        self.assertEqual(result, 300)

    def test_technology_value_sums_only_reported_technology_values(self):
        result = server.technology_value({"Wind onshore": [100], "Wind offshore": [None], "Solar": [30]}, ("Wind onshore", "Wind offshore"), 0)
        self.assertEqual(result, 100)

    def test_energy_overview_rejects_misaligned_source_series(self):
        power = {
            "unix_seconds": [1, 2],
            "production_types": [{"name": "Load", "data": [100, 110]}],
        }
        prices = {"unix_seconds": [1], "price": [30, 31]}
        with patch.object(server, "fetch_json", side_effect=[power, prices]):
            with self.assertRaisesRegex(RuntimeError, "misaligned price"):
                server.energy_overview(1)

    def test_time_bounds_rejects_a_range_longer_than_one_year(self):
        end = datetime(2026, 7, 20, tzinfo=timezone.utc)
        with self.assertRaisesRegex(RuntimeError, "up to 365"):
            server.resolve_time_bounds(start=end - timedelta(days=366), end=end)

    def test_request_range_rejects_invalid_client_input(self):
        with self.assertRaisesRegex(server.ClientInputError, "both a start and end"):
            server.ApiHandler.request_range("start=2026-07-01")
        with self.assertRaisesRegex(server.ClientInputError, "whole number"):
            server.ApiHandler.request_range("days=0")
        with self.assertRaisesRegex(server.ClientInputError, "YYYY-MM-DD"):
            server.ApiHandler.request_range("start=2026-7-01&end=2026-07-02")

    def test_rate_limiter_scopes_requests_to_a_short_in_memory_window(self):
        limiter = server.SlidingWindowRateLimiter(limit=2, window_seconds=60)
        self.assertTrue(limiter.allow("127.0.0.1"))
        self.assertTrue(limiter.allow("127.0.0.1"))
        self.assertFalse(limiter.allow("127.0.0.1"))
        self.assertTrue(limiter.allow("127.0.0.2"))

    def test_proxy_header_is_used_only_when_explicitly_trusted(self):
        with patch.object(server, "TRUST_PROXY_HEADERS", False):
            self.assertEqual(server.client_identifier("10.0.0.5", "203.0.113.5"), "10.0.0.5")
        with patch.object(server, "TRUST_PROXY_HEADERS", True):
            self.assertEqual(server.client_identifier("10.0.0.5", "203.0.113.5, 10.0.0.5"), "203.0.113.5")
            self.assertEqual(server.client_identifier("10.0.0.5", "not-an-ip"), "10.0.0.5")

    def test_security_headers_block_framing_and_untrusted_script_sources(self):
        self.assertEqual(server.SECURITY_HEADERS["X-Frame-Options"], "DENY")
        self.assertIn("script-src 'self'", server.SECURITY_HEADERS["Content-Security-Policy"])
        self.assertIn("frame-ancestors 'none'", server.SECURITY_HEADERS["Content-Security-Policy"])

    def test_robust_anomalies_flags_an_extreme_observation(self):
        observations = [{"timestamp": str(index), "value": 100 + index % 4} for index in range(96)]
        observations.append({"timestamp": "outlier", "value": 160})
        findings = server.robust_anomalies(observations, "value", "Test", window=96)
        self.assertEqual(findings[0]["timestamp"], "outlier")
        self.assertEqual(findings[0]["metric"], "Test")

    def test_weather_uses_the_full_supported_energy_range(self):
        payload = {
            "weather": [{"timestamp": "2026-01-01T00:00:00+00:00", "temperature": 4}],
            "sources": [],
        }
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        end = datetime(2027, 1, 1, tzinfo=timezone.utc)
        with patch.object(server, "fetch_json", return_value=payload) as fetch:
            result = server.weather_overview(365, start, end)
        self.assertTrue(result["available"])
        source_url = fetch.call_args.args[0]
        self.assertIn("date=2026-01-01", source_url)
        self.assertIn("last_date=2027-01-01", source_url)

    def test_weather_preserves_dwd_values_without_estimating_them(self):
        payload = {
            "weather": [{"timestamp": "2026-07-16T10:00:00+00:00", "temperature": 22.1, "wind_speed": 3.4, "sunshine": 60, "solar": 0.7}],
            "sources": [{"station_name": "Stuttgart Test", "distance": 6000}],
        }
        start = datetime(2026, 7, 16, tzinfo=timezone.utc)
        end = datetime(2026, 7, 17, tzinfo=timezone.utc)
        with patch.object(server, "fetch_json", return_value=payload):
            result = server.weather_overview(1, start, end)
        self.assertTrue(result["available"])
        self.assertEqual(result["history"][0]["sunshine_min"], 60)
        self.assertEqual(result["coverage"], "Stuttgart Test (about 6.0 km from Stuttgart centre)")

    def test_weather_excludes_rows_outside_an_explicit_calendar_range(self):
        payload = {
            "weather": [
                {"timestamp": "2026-07-01T00:00:00+00:00", "temperature": 20},
                {"timestamp": "2026-07-02T00:00:00+00:00", "temperature": 21},
            ],
            "sources": [],
        }
        start = datetime(2026, 7, 1, tzinfo=timezone.utc)
        end = datetime(2026, 7, 2, tzinfo=timezone.utc)
        with patch.object(server, "fetch_json", return_value=payload):
            result = server.weather_overview(1, start, end)
        self.assertEqual([item["timestamp"] for item in result["history"]], ["2026-07-01T00:00:00Z"])

    def test_export_rows_keeps_source_timestamps_and_values(self):
        data = {
            "electricity": {
                "price_history": [{"timestamp": "2026-07-16T10:00:00Z", "value": 42.5}],
                "system_history": [{"timestamp": "2026-07-16T10:00:00Z", "load": 50000, "generation": 45000}],
            },
            "weather": {"history": [{"timestamp": "2026-07-16T10:00:00Z", "temperature_c": 22.1, "wind_speed_ms": 3.4, "sunshine_min": 60, "solar_kw_m2": 0.7}]},
        }
        rows = server.export_rows(data)
        self.assertEqual(rows[0]["de_lu_price_eur_mwh"], 42.5)
        self.assertEqual(rows[0]["stuttgart_temperature_c"], 22.1)

    def test_overview_does_not_reuse_operational_source_data(self):
        electricity = {"price_history": [], "system_history": [], "generation_profile": [], "analysis": {}}
        weather = {"available": False, "history": [], "reason": "Not requested in test"}
        with patch.object(server, "energy_overview", return_value=electricity) as energy_source, patch.object(server, "weather_overview", return_value=weather) as weather_source:
            server.overview(1)
            server.overview(1)
        self.assertEqual(energy_source.call_count, 2)
        self.assertEqual(weather_source.call_count, 2)

    def test_overview_keeps_empty_visualisation_fields_during_an_upstream_outage(self):
        with patch.object(server, "energy_overview", side_effect=RuntimeError("Energy source offline")), patch.object(server, "weather_overview", return_value={"available": False, "history": [], "reason": "Not requested"}):
            result = server.overview(1)
        self.assertEqual(result["electricity"]["generation_mix"], [])


if __name__ == "__main__":
    unittest.main()
