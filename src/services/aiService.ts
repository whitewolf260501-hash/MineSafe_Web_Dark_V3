/**
 * MineSafe AI Analysis Integration Service
 * 
 * Conecta la aplicación web MineSafe con el backend MineSafe AI Analysis API (FastAPI v0.1.1).
 * Implementa:
 * - Endpoints: GET /health y POST /v1/analyze
 * - Manejo robusto de errores HTTP (401, 413, 422, 503, NetworkError, Timeout)
 * - Protección contra exposición de secretos (usa proxy seguro /api/ai por defecto)
 * - Normalización de datos reales desde Firebase RTDB
 * - Detección de observaciones mínimas requeridas (mínimo 5)
 * - Búfer en memoria de telemetría real para análisis de ventana temporal
 */

export interface Observation {
  timestamp: string; // ISO 8601 con zona horaria (UTC recomendado: 'Z')
  pm25_raw?: number | null;
  mq2_raw?: number | null;
  temperature_c?: number | null;
  humidity_pct?: number | null;
  unit?: 'raw' | 'calibrated';
}

export interface AnalyzeRequest {
  device_id: string;
  observations: Observation[];
}

export type TrendDirection = 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';

export interface MetricTrend {
  metric: string;
  first_value: number;
  last_value: number;
  slope_per_hour: number | null;
  direction: TrendDirection;
  unit: string;
}

export interface Anomaly {
  timestamp: string;
  metric: string;
  value: number;
  median: number;
  robust_z_score: number;
  unit: string;
  explanation: string;
}

export interface AnalyzeResponse {
  device_id: string;
  generated_at: string;
  window_start: string;
  window_end: string;
  observations_count: number;
  analysis_method: string;
  trends: MetricTrend[];
  anomalies: Anomaly[];
  limitations: string[];
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

export class AIAnalysisError extends Error {
  public statusCode?: number;
  public detail?: string;
  public isNetworkError: boolean;

  constructor(message: string, statusCode?: number, detail?: string, isNetworkError = false) {
    super(message);
    this.name = 'AIAnalysisError';
    this.statusCode = statusCode;
    this.detail = detail;
    this.isNetworkError = isNetworkError;
  }
}

// Configuración base de URL
// Por defecto se utiliza el proxy local '/api/ai' para que el servidor Vite o Node
// inyecte la cabecera 'Authorization: Bearer <KEY>' sin exponerla en el bundle del navegador.
const DEFAULT_PROXY_BASE = '/api/ai';

export function getAIBaseUrl(): string {
  // Si existe una variable explícita no vacía (por ejemplo en despliegues con proxy específico)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_API_URL) {
    return import.meta.env.VITE_AI_API_URL.replace(/\/+$/, '');
  }
  return DEFAULT_PROXY_BASE;
}

/**
 * Consulta el estado de salud del backend de análisis (/health)
 */
export async function checkAIHealth(timeoutMs = 4000): Promise<{ ok: boolean; data?: HealthResponse; error?: string; latencyMs: number }> {
  const baseUrl = getAIBaseUrl();
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok) {
      return {
        ok: false,
        latencyMs,
        error: `El servicio respondió HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data: HealthResponse = await res.json();
    return {
      ok: true,
      data,
      latencyMs,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - start);
    const isTimeout = err.name === 'AbortError';
    return {
      ok: false,
      latencyMs,
      error: isTimeout
        ? `Tiempo de espera agotado (${timeoutMs / 1000}s) al contactar MineSafe IA`
        : `Servicio no disponible o fuera de línea (${err.message || 'Error de conexión'})`,
    };
  }
}

/**
 * Envía una serie temporal al endpoint POST /v1/analyze
 */
export async function requestAIAnalysis(
  payload: AnalyzeRequest,
  options?: {
    customToken?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  }
): Promise<AnalyzeResponse> {
  const baseUrl = getAIBaseUrl();
  const timeoutMs = options?.timeoutMs || 12000;

  // Validación previa en cliente antes de sobrecargar la red
  if (!payload.device_id || payload.device_id.trim() === '') {
    throw new AIAnalysisError('El identificador del dispositivo (device_id) es obligatorio.', 400);
  }

  if (!Array.isArray(payload.observations) || payload.observations.length < 5) {
    throw new AIAnalysisError(
      `Se requieren al menos 5 observaciones válidas para ejecutar el análisis estadístico (recibidas: ${payload.observations?.length || 0}).`,
      422
    );
  }

  if (payload.observations.length > 10000) {
    throw new AIAnalysisError(
      `La serie supera el máximo de 10.000 observaciones permitidas (recibidas: ${payload.observations.length}).`,
      413
    );
  }

  // Validación y deduplicación estricta de marcas de tiempo
  const seenTimestamps = new Set<string>();
  const sanitizedObservations: Observation[] = [];

  for (const obs of payload.observations) {
    if (!obs.timestamp) continue;
    // Asegurar formato ISO timezone-aware
    let iso = obs.timestamp;
    if (!iso.endsWith('Z') && !iso.includes('+') && !iso.includes('-')) {
      iso = `${iso}Z`;
    }
    if (seenTimestamps.has(iso)) {
      continue; // Ignorar duplicados de la misma marca temporal
    }
    seenTimestamps.add(iso);

    sanitizedObservations.push({
      timestamp: iso,
      pm25_raw: typeof obs.pm25_raw === 'number' && Number.isFinite(obs.pm25_raw) ? obs.pm25_raw : null,
      mq2_raw: typeof obs.mq2_raw === 'number' && Number.isFinite(obs.mq2_raw) ? obs.mq2_raw : null,
      temperature_c: typeof obs.temperature_c === 'number' && Number.isFinite(obs.temperature_c) ? obs.temperature_c : null,
      humidity_pct: typeof obs.humidity_pct === 'number' && Number.isFinite(obs.humidity_pct) ? obs.humidity_pct : null,
      unit: obs.unit === 'calibrated' ? 'calibrated' : 'raw',
    });
  }

  if (sanitizedObservations.length < 5) {
    throw new AIAnalysisError(
      `Tras eliminar marcas temporales duplicadas o inválidas, quedaron solo ${sanitizedObservations.length} observaciones. Se requieren mínimo 5.`,
      422
    );
  }

  const cleanPayload: AnalyzeRequest = {
    device_id: payload.device_id,
    observations: sanitizedObservations,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // Si se pasa un token personalizado explícito para pruebas directas
  if (options?.customToken) {
    headers['Authorization'] = `Bearer ${options.customToken}`;
  }

  try {
    const res = await fetch(`${baseUrl}/v1/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify(cleanPayload),
      signal: options?.signal || controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      let errorDetail = '';
      try {
        const errorJson = await res.json();
        errorDetail = errorJson.detail || JSON.stringify(errorJson);
      } catch {
        errorDetail = await res.text();
      }

      if (res.status === 401) {
        throw new AIAnalysisError(
          'No autorizado: la API requiere autenticación. Configure MINESAFE_AI_API_KEY en el backend o en el proxy seguro.',
          401,
          errorDetail
        );
      }

      if (res.status === 413) {
        throw new AIAnalysisError(
          'La serie temporal enviada excede el límite permitido por el servidor.',
          413,
          errorDetail
        );
      }

      if (res.status === 422) {
        throw new AIAnalysisError(
          `Error de validación en la serie temporal: ${errorDetail}`,
          422,
          errorDetail
        );
      }

      if (res.status === 503) {
        throw new AIAnalysisError(
          'El servicio de análisis no está configurado (clave de API faltante en el servidor de IA).',
          503,
          errorDetail
        );
      }

      throw new AIAnalysisError(
        `Error del servidor de IA (HTTP ${res.status}): ${errorDetail || res.statusText}`,
        res.status,
        errorDetail
      );
    }

    const data: AnalyzeResponse = await res.json();
    return data;
  } catch (err: any) {
    clearTimeout(timer);
    if (err instanceof AIAnalysisError) {
      throw err;
    }

    const isTimeout = err.name === 'AbortError';
    if (isTimeout) {
      throw new AIAnalysisError(
        `Tiempo de espera agotado (${timeoutMs / 1000}s) al procesar el análisis en MineSafe IA.`,
        408,
        undefined,
        true
      );
    }

    throw new AIAnalysisError(
      `No se pudo conectar con el backend de IA: ${err.message || 'Verifique que el servicio esté ejecutándose en http://localhost:8000'}.`,
      0,
      undefined,
      true
    );
  }
}

// -------------------------------------------------------------
// BÚFER DE OBSERVACIONES REALES EN MEMORIA
// -------------------------------------------------------------
// Almacena las mediciones que van llegando desde Firebase RTDB por cada dispositivo,
// garantizando que las observaciones enviadas a la IA correspondan a datos reales
// observados en la faena minera.

interface BufferedPoint {
  timestamp: string;
  pm25_raw: number | null;
  mq2_raw: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  unit: 'raw';
}

const MAX_BUFFER_PER_DEVICE = 500;
const deviceBuffers = new Map<string, BufferedPoint[]>();

/**
 * Registra un punto de medición real recibido desde Firebase RTDB
 */
export function recordRealTelemetryPoint(
  deviceId: string,
  reading: {
    coRaw?: number | null;
    pm25Raw?: number | null;
    temperature?: number | null;
    humidity?: number | null;
    timestamp?: number;
  }
): void {
  if (!deviceId) return;

  const currentBuffer = deviceBuffers.get(deviceId) || [];
  const tsDate = reading.timestamp ? new Date(reading.timestamp) : new Date();
  const isoTime = tsDate.toISOString();

  // Evitar duplicar punto con la misma marca exacta
  const lastPoint = currentBuffer[currentBuffer.length - 1];
  if (lastPoint && lastPoint.timestamp === isoTime) {
    return;
  }

  const point: BufferedPoint = {
    timestamp: isoTime,
    mq2_raw: typeof reading.coRaw === 'number' && Number.isFinite(reading.coRaw) ? reading.coRaw : null,
    pm25_raw: typeof reading.pm25Raw === 'number' && Number.isFinite(reading.pm25Raw) ? reading.pm25Raw : null,
    temperature_c: typeof reading.temperature === 'number' && Number.isFinite(reading.temperature) ? reading.temperature : null,
    humidity_pct: typeof reading.humidity === 'number' && Number.isFinite(reading.humidity) ? reading.humidity : null,
    unit: 'raw', // Sensores físicos analógicos no cuentan con curvas de calibración certificadas individuales
  };

  currentBuffer.push(point);

  // Mantener ventana acotada para no saturar memoria
  if (currentBuffer.length > MAX_BUFFER_PER_DEVICE) {
    currentBuffer.shift();
  }

  deviceBuffers.set(deviceId, currentBuffer);
}

/**
 * Obtiene el búfer de observaciones acumuladas para un dispositivo
 */
export function getBufferedObservations(deviceId: string): Observation[] {
  const points = deviceBuffers.get(deviceId) || [];
  return [...points];
}

/**
 * Limpia el búfer de un dispositivo
 */
export function clearBufferedObservations(deviceId: string): void {
  deviceBuffers.delete(deviceId);
}
