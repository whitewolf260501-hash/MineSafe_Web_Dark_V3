from datetime import datetime, timezone
from statistics import median
import math

from .schemas import AnalyzeRequest, AnalyzeResponse, Anomaly, MetricTrend

METRICS = {
    "pm25_raw": "raw ADC / unit from payload",
    "mq2_raw": "raw ADC / unit from payload",
    "temperature_c": "°C",
    "humidity_pct": "%",
}


def _finite_values(observations, metric):
    result = []
    for item in observations:
        value = getattr(item, metric)
        if value is not None and math.isfinite(value):
            result.append((item.timestamp, float(value), item.unit))
    return sorted(result, key=lambda x: x[0])


def _trend(points, metric):
    if len(points) < 2:
        return MetricTrend(
            metric=metric, first_value=points[0][1] if points else 0.0,
            last_value=points[-1][1] if points else 0.0, slope_per_hour=None,
            direction="insufficient_data", unit=METRICS[metric]
        )
    t0 = points[0][0]
    xs = [(p[0] - t0).total_seconds() / 3600 for p in points]
    ys = [p[1] for p in points]
    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)
    denominator = sum((x - mean_x) ** 2 for x in xs)
    slope = (sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / denominator) if denominator else 0.0
    spread = max(ys) - min(ys)
    tolerance = max(abs(mean_y) * 0.01, 1e-9)
    direction = "stable" if abs(ys[-1] - ys[0]) <= tolerance else ("increasing" if slope > 0 else "decreasing")
    return MetricTrend(
        metric=metric, first_value=ys[0], last_value=ys[-1],
        slope_per_hour=round(slope, 6), direction=direction, unit=METRICS[metric]
    )


def analyze(request: AnalyzeRequest, min_observations: int = 5) -> AnalyzeResponse:
    observations = sorted(request.observations, key=lambda item: item.timestamp)
    if len(observations) < min_observations:
        raise ValueError(f"Se requieren al menos {min_observations} observaciones")
    trends = []
    anomalies = []
    for metric, unit in METRICS.items():
        points = _finite_values(observations, metric)
        trends.append(_trend(points, metric))
        if len(points) < min_observations:
            continue
        values = [p[1] for p in points]
        center = median(values)
        deviations = [abs(value - center) for value in values]
        mad = median(deviations)
        # MAD=0 significa que no hay escala robusta estimable; no se inventa un umbral.
        if mad <= 0:
            continue
        for timestamp, value, point_unit in points:
            robust_z = 0.6745 * (value - center) / mad
            if abs(robust_z) >= 3.5:
                anomalies.append(Anomaly(
                    timestamp=timestamp, metric=metric, value=value, median=center,
                    robust_z_score=round(robust_z, 3),
                    unit=unit if point_unit == "calibrated" else "raw",
                    explanation="Valor atípico estadístico respecto de esta ventana; requiere revisión humana."
                ))
    units = {item.unit for item in observations}
    limitations = [
        "La detección estadística no está validada como alarma de seguridad ni como predicción de incidentes.",
        "No se aplican umbrales normativos: faltan calibración confirmada y configuración aprobada por variable.",
        "Las anomalías dependen de la ventana y pueden no detectarse si hay pocos datos o poca variación.",
        "El análisis no sustituye alarmas físicas, procedimientos de evacuación ni evaluación de prevención de riesgos."
    ]
    if "raw" in units:
        limitations.append("Hay observaciones marcadas como raw; no interpretar los valores como ppm o µg/m³.")
    return AnalyzeResponse(
        device_id=request.device_id,
        generated_at=datetime.now(timezone.utc),
        window_start=observations[0].timestamp,
        window_end=observations[-1].timestamp,
        observations_count=len(observations),
        analysis_method="robust_median_mad_and_linear_trend_v1",
        trends=trends,
        anomalies=sorted(anomalies, key=lambda item: abs(item.robust_z_score), reverse=True),
        limitations=limitations
    )
