from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator


class Observation(BaseModel):
    timestamp: datetime
    pm25_raw: float | None = None
    mq2_raw: float | None = None
    temperature_c: float | None = None
    humidity_pct: float | None = None
    # `raw` es el valor predeterminado seguro mientras no se confirme calibración.
    unit: Literal["raw", "calibrated"] = "raw"

    @field_validator("timestamp")
    @classmethod
    def timestamp_must_be_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp debe incluir zona horaria; se recomienda UTC (Z)")
        return value


class AnalyzeRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=128)
    observations: list[Observation]

    @field_validator("observations")
    @classmethod
    def timestamps_must_be_unique(cls, values: list[Observation]) -> list[Observation]:
        timestamps = [item.timestamp for item in values]
        if len(timestamps) != len(set(timestamps)):
            raise ValueError("No se permiten timestamps duplicados en una misma solicitud")
        return values


class MetricTrend(BaseModel):
    metric: str
    first_value: float
    last_value: float
    slope_per_hour: float | None
    direction: Literal["increasing", "decreasing", "stable", "insufficient_data"]
    unit: str


class Anomaly(BaseModel):
    timestamp: datetime
    metric: str
    value: float
    median: float
    robust_z_score: float
    unit: str
    explanation: str


class AnalyzeResponse(BaseModel):
    device_id: str
    generated_at: datetime
    window_start: datetime
    window_end: datetime
    observations_count: int
    analysis_method: str
    trends: list[MetricTrend]
    anomalies: list[Anomaly]
    limitations: list[str]
