from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.analyzer import analyze
from app.main import app
from app.config import settings
from app.schemas import AnalyzeRequest, Observation


def make_payload(values):
    start = datetime(2026, 10, 29, 12, tzinfo=timezone.utc)
    observations = [
        Observation(
            timestamp=start + timedelta(minutes=i),
            pm25_raw=value,
            mq2_raw=100 + i,
            temperature_c=20 + i * 0.1,
            humidity_pct=45 + i,
            unit="raw",
        )
        for i, value in enumerate(values)
    ]
    return AnalyzeRequest(device_id="NODO_U-01", observations=observations)


def test_analyzer_returns_window_and_trends():
    result = analyze(make_payload([10, 11, 12, 13, 14]))
    assert result.device_id == "NODO_U-01"
    assert result.observations_count == 5
    assert result.window_end > result.window_start
    assert result.analysis_method == "robust_median_mad_and_linear_trend_v1"
    assert any(item.metric == "temperature_c" for item in result.trends)


def test_timestamps_must_include_timezone():
    with pytest.raises(ValueError):
        Observation(timestamp="2026-10-29T12:00:00", pm25_raw=1)


def test_api_requires_key(monkeypatch):
    monkeypatch.setattr(settings, "api_key", "test-secret")
    client = TestClient(app)
    response = client.post("/v1/analyze", json={"device_id": "node", "observations": []})
    assert response.status_code == 401


def test_api_health():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_root_redirects_to_docs():
    client = TestClient(app)
    response = client.get("/", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/docs"


def test_api_analyze_with_key(monkeypatch):
    monkeypatch.setattr(settings, "api_key", "test-secret")
    client = TestClient(app)
    payload = {
        "device_id": "NODO_U-01",
        "observations": [
            {"timestamp": f"2026-10-29T12:00:{i*5:02d}Z", "pm25_raw": v, "unit": "raw"}
            for i, v in enumerate([450, 452, 453, 454, 900, 455])
        ],
    }
    response = client.post(
        "/v1/analyze", json=payload,
        headers={"Authorization": "Bearer test-secret"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["device_id"] == "NODO_U-01"
    assert body["observations_count"] == 6
    assert "anomalies" in body
    assert "trends" in body
