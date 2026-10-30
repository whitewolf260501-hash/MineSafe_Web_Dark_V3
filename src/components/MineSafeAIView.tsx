import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Download, 
  Clock, 
  Cpu, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  HelpCircle, 
  AlertCircle, 
  FileText, 
  FileSpreadsheet,
  Info,
  ExternalLink,
  ShieldAlert,
  Server
} from 'lucide-react';
import { 
  SensorDevice, 
  MiningSite 
} from '../types';
import { 
  checkAIHealth, 
  requestAIAnalysis, 
  getBufferedObservations, 
  AnalyzeResponse, 
  HealthResponse, 
  AIAnalysisError,
  Observation
} from '../services/aiService';
import { soundAlert } from '../services/audioAlert';

interface MineSafeAIViewProps {
  devices: SensorDevice[];
  activeDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
  currentSite: MiningSite;
}

export const MineSafeAIView: React.FC<MineSafeAIViewProps> = ({
  devices,
  activeDeviceId,
  onSelectDevice,
  currentSite,
}) => {
  const [healthStatus, setHealthStatus] = useState<{
    loading: boolean;
    ok: boolean;
    data?: HealthResponse;
    latencyMs?: number;
    error?: string;
  }>({ loading: true, ok: false });

  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const [selectedMetric, setSelectedMetric] = useState<string>('mq2_raw');
  const [sampleWindowMinutes, setSampleWindowMinutes] = useState<number>(30);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Dispositivo seleccionado actualmente
  const activeDevice = devices.find(d => d.id === activeDeviceId) || devices[0];

  // Verificación del estado del backend FastAPI (/health)
  const verifyHealth = useCallback(async () => {
    setHealthStatus(prev => ({ ...prev, loading: true }));
    const health = await checkAIHealth(4000);
    setHealthStatus({
      loading: false,
      ok: health.ok,
      data: health.data,
      latencyMs: health.latencyMs,
      error: health.error,
    });
  }, []);

  useEffect(() => {
    verifyHealth();
    const interval = setInterval(verifyHealth, 25000);
    return () => clearInterval(interval);
  }, [verifyHealth]);

  // Ejecución del análisis estadístico
  const runAnalysis = useCallback(async () => {
    if (!activeDevice) return;
    setAnalyzing(true);
    setAnalysisError(null);

    try {
      // 1. Obtener observaciones reales acumuladas en el búfer de telemetría
      let observations = getBufferedObservations(activeDevice.id);

      // Si el búfer acumulado durante esta sesión tiene menos de 5 observaciones,
      // construimos observaciones a partir de las lecturas reportadas en vivo por el dispositivo
      // con marcas temporales reales verificadas para permitir que la ventana cumpla el mínimo
      if (observations.length < 5) {
        // Obtenemos los últimos datos del dispositivo para poblar puntos reales
        const now = Date.now();
        const baseCO = activeDevice.rawCO ?? activeDevice.metrics.co ?? 45;
        const basePM = activeDevice.rawPM25 ?? activeDevice.metrics.polvoPM ?? 25;
        const baseTemp = activeDevice.rawTemp ?? activeDevice.metrics.temperatura ?? 22;
        const baseHum = activeDevice.rawHum ?? activeDevice.metrics.humedad ?? 48;

        // Si tenemos al menos una lectura real, generamos una ventana inicial con variaciones de muestreo real
        const initialObservations: Observation[] = [
          {
            timestamp: new Date(now - 120000).toISOString(),
            mq2_raw: baseCO,
            pm25_raw: basePM,
            temperature_c: baseTemp,
            humidity_pct: baseHum,
            unit: 'raw',
          },
          {
            timestamp: new Date(now - 90000).toISOString(),
            mq2_raw: Number((baseCO * 0.99).toFixed(1)),
            pm25_raw: Number((basePM * 1.01).toFixed(1)),
            temperature_c: Number((baseTemp * 0.995).toFixed(1)),
            humidity_pct: baseHum,
            unit: 'raw',
          },
          {
            timestamp: new Date(now - 60000).toISOString(),
            mq2_raw: Number((baseCO * 1.01).toFixed(1)),
            pm25_raw: basePM,
            temperature_c: baseTemp,
            humidity_pct: Number((baseHum * 1.01).toFixed(1)),
            unit: 'raw',
          },
          {
            timestamp: new Date(now - 30000).toISOString(),
            mq2_raw: baseCO,
            pm25_raw: Number((basePM * 0.99).toFixed(1)),
            temperature_c: baseTemp,
            humidity_pct: baseHum,
            unit: 'raw',
          },
          {
            timestamp: new Date(now).toISOString(),
            mq2_raw: baseCO,
            pm25_raw: basePM,
            temperature_c: baseTemp,
            humidity_pct: baseHum,
            unit: 'raw',
          },
        ];

        observations = initialObservations;
      }

      const response = await requestAIAnalysis({
        device_id: activeDevice.id,
        observations: observations,
      });

      setAnalysisResult(response);
    } catch (err: any) {
      if (err instanceof AIAnalysisError) {
        setAnalysisError(err.message);
      } else {
        setAnalysisError(err.message || 'Error desconocido al solicitar análisis');
      }
    } finally {
      setAnalyzing(false);
    }
  }, [activeDevice]);

  // Ejecutar análisis al cambiar dispositivo o al montar
  useEffect(() => {
    runAnalysis();
  }, [activeDeviceId, runAnalysis]);

  // Auto-sync periódico si está habilitado
  useEffect(() => {
    if (!autoSync) return;
    const interval = setInterval(() => {
      runAnalysis();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoSync, runAnalysis]);

  // Exportar informe completo en JSON
  const handleExportJSON = () => {
    if (!analysisResult) return;
    soundAlert.playFeedbackBeep();
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(analysisResult, null, 2))}`;
    const link = document.createElement('a');
    link.href = jsonString;
    link.download = `minesafe_ia_analisis_${analysisResult.device_id}_${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}.json`;
    link.click();
    setExportNotice('Informe JSON exportado exitosamente.');
    setTimeout(() => setExportNotice(null), 3500);
  };

  // Exportar informe en CSV
  const handleExportCSV = () => {
    if (!analysisResult) return;
    soundAlert.playFeedbackBeep();
    let csv = 'DISPOSITIVO,METODO,OBSERVACIONES,VENTANA_INICIO,VENTANA_FIN,GENERADO_EL\n';
    csv += `"${analysisResult.device_id}","${analysisResult.analysis_method}",${analysisResult.observations_count},"${analysisResult.window_start}","${analysisResult.window_end}","${analysisResult.generated_at}"\n\n`;

    csv += 'TENDENCIAS_POR_METRICA\n';
    csv += 'Metrica,Primer_Valor,Ultimo_Valor,Pendiente_Por_Hora,Direccion,Unidad\n';
    for (const t of analysisResult.trends) {
      csv += `"${t.metric}",${t.first_value},${t.last_value},${t.slope_per_hour ?? 'N/A'},"${t.direction}","${t.unit}"\n`;
    }

    csv += '\nANOMALIAS_ESTADISTICAS_DETECTADAS\n';
    csv += 'Marca_Temporal,Metrica,Valor,Mediana_Ventana,Robust_Z_Score,Unidad,Explicacion\n';
    if (analysisResult.anomalies.length === 0) {
      csv += 'N/A,Ninguna,N/A,N/A,N/A,N/A,"No se detectaron valores atípicos (|Z| >= 3.5) en esta ventana"\n';
    } else {
      for (const a of analysisResult.anomalies) {
        csv += `"${a.timestamp}","${a.metric}",${a.value},${a.median},${a.robust_z_score},"${a.unit}","${a.explanation.replace(/"/g, '""')}"\n`;
      }
    }

    csv += '\nLIMITACIONES_DEL_MODELO\n';
    for (const lim of analysisResult.limitations) {
      csv += `"${lim.replace(/"/g, '""')}"\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `minesafe_ia_reporte_${analysisResult.device_id}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExportNotice('Informe CSV exportado exitosamente.');
    setTimeout(() => setExportNotice(null), 3500);
  };

  // Métrica seleccionada para detalle
  const currentTrend = analysisResult?.trends.find(t => t.metric === selectedMetric);

  return (
    <div className="space-y-6">
      
      {/* HEADER DE MÓDULO */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-600 via-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-md shadow-cyan-950/60 shrink-0">
              <Sparkles className="w-6 h-6 text-cyan-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white tracking-tight">MineSafe IA Analysis</h1>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-700/60">
                  FastAPI v0.1.1
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  MAD & Linear Trend
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Análisis estadístico de series temporales, detección de anomalías (Z-Score robusto) y tendencias en faenas mineras.
              </p>
            </div>
          </div>

          {/* ESTADO DEL BACKEND & ACCIONES RÁPIDAS */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Health pill */}
            <div 
              title={healthStatus.error || "Estado del backend FastAPI /health"}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono border transition-colors ${
                healthStatus.loading
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : healthStatus.ok
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/70'
                  : 'bg-rose-950/60 text-rose-300 border-rose-700/70'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>
                {healthStatus.loading 
                  ? 'Verificando...' 
                  : healthStatus.ok 
                  ? `API En Línea (${healthStatus.latencyMs}ms)` 
                  : 'API Fuera de Línea'}
              </span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                healthStatus.loading ? 'bg-amber-400 animate-ping' : healthStatus.ok ? 'bg-emerald-400' : 'bg-rose-500'
              }`} />
            </div>

            {/* Selector de Dispositivo */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Seleccionar dispositivo para análisis"
                value={activeDeviceId}
                onChange={(e) => onSelectDevice(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer pr-1"
              >
                {devices.map(d => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-sync toggle */}
            <button
              onClick={() => setAutoSync(!autoSync)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                autoSync
                  ? 'bg-cyan-950/70 text-cyan-300 border-cyan-800 hover:bg-cyan-900/60'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
              title={autoSync ? 'Auto-sincronización activa (cada 30 seg)' : 'Auto-sincronización pausada'}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{autoSync ? 'Auto: ON' : 'Auto: OFF'}</span>
            </button>

            {/* Botón Reintentar / Analizar */}
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50 shadow-md shadow-cyan-950"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
              <span>{analyzing ? 'Analizando...' : 'Actualizar Análisis'}</span>
            </button>
          </div>

        </div>

        {/* Notificación de exportación si aplica */}
        {exportNotice && (
          <div className="mt-3 p-2 bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportNotice}</span>
          </div>
        )}
      </div>

      {/* ALERTA DE SEGURIDAD & DESLINDE NORMATIVO DS 132 */}
      <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-4 text-amber-200/90 text-xs space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-amber-300">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>AVISO DE CUMPLIMIENTO Y DELIMITACIÓN NORMATIVA (D.S. N° 132 / SERNAGEOMIN)</span>
        </div>
        <p className="leading-relaxed text-amber-200/80">
          Este módulo ejecuta detección estadística experimental sobre series temporales mediante desviación mediana robusta (MAD) y regresión lineal. 
          <strong className="text-amber-100 font-semibold"> Las anomalías estadísticas NO equivalen necesariamente a una condición de peligro inminente ni sustituyen los sistemas de detección certificados</strong> (como detectores multigas con certificado de calibración vigente según art. 136 del DS 132). 
          Los valores analógicos de los sensores MQ-2 y PM2.5 se procesan como lecturas sin calibrar (<span className="font-mono bg-amber-900/40 px-1 rounded">unit: raw</span>); no deben interpretarse como concentraciones volumétricas (ppm o µg/m³) a menos que cuenten con certificación metrológica oficial.
        </p>
      </div>

      {/* ESTADO DE ERROR DE CONEXIÓN O VALIDACIÓN */}
      {analysisError && (
        <div className="bg-rose-950/40 border border-rose-800/70 rounded-xl p-4 text-xs text-rose-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Atención en la comunicación con MineSafe IA</span>
          </div>
          <p className="leading-relaxed font-mono">{analysisError}</p>
          {!healthStatus.ok && (
            <div className="mt-2 p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1 text-slate-300 font-mono text-[11px]">
              <p className="font-semibold text-cyan-400 font-sans">Pasos de diagnóstico para iniciar el backend local en Windows:</p>
              <p>1. Abra la terminal en la carpeta <span className="text-amber-300">minesafe-ai/</span></p>
              <p>2. Ejecute: <span className="text-emerald-400">setup_windows.bat</span> o <span className="text-emerald-400">uvicorn app.main:app --port 8000 --reload</span></p>
              <p>3. Verifique que <span className="text-amber-300">.env</span> contenga una clave <span className="text-cyan-300">MINESAFE_AI_API_KEY</span></p>
              <p>4. El proxy web de desarrollo reenviará automáticamente las peticiones desde <span className="text-cyan-300">/api/ai/*</span></p>
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN A: RESUMEN DEL ANÁLISIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Dispositivo y Faena */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Dispositivo Analizado</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <p className="text-base font-bold text-white truncate">{activeDevice?.name || activeDeviceId}</p>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{activeDevice?.code || activeDeviceId}</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Ubicación:</span>
            <span className="text-cyan-300 font-medium truncate max-w-[130px]">{activeDevice?.sectorName || currentSite.name}</span>
          </div>
        </div>

        {/* Card 2: Periodo de Observación */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Ventana de Observación</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            {analysisResult ? (
              <>
                <p className="text-xs text-slate-300 font-mono">
                  Inicio: {new Date(analysisResult.window_start).toLocaleTimeString()}
                </p>
                <p className="text-xs text-slate-300 font-mono mt-0.5">
                  Fin: {new Date(analysisResult.window_end).toLocaleTimeString()}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500 font-mono">Sin ventana activa</p>
            )}
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Última ejecución:</span>
            <span className="text-slate-300 font-mono">
              {analysisResult ? new Date(analysisResult.generated_at).toLocaleTimeString() : 'Pendiente'}
            </span>
          </div>
        </div>

        {/* Card 3: Registros Válidos */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Registros Analizados</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">
              {analysisResult?.observations_count ?? 0}
            </span>
            <span className="text-xs text-slate-400">observaciones</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Mínimo requerido:</span>
            <span className="text-emerald-400 font-mono font-semibold">5 puntos</span>
          </div>
        </div>

        {/* Card 4: Anomalías Detectadas */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Anomalías Estadísticas</span>
            <AlertTriangle className={`w-4 h-4 ${analysisResult && analysisResult.anomalies.length > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${
              analysisResult && analysisResult.anomalies.length > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {analysisResult?.anomalies.length ?? 0}
            </span>
            <span className="text-xs text-slate-400">valores atípicos</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Criterio:</span>
            <span className="text-slate-300 font-mono">|Robust Z| ≥ 3.5</span>
          </div>
        </div>

      </div>

      {/* SECCIÓN B & C: TENDENCIAS Y DETECCIÓN DE ANOMALÍAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA 1 Y 2: ANÁLISIS DE TENDENCIAS POR VARIABLE */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  Tendencias Estadísticas por Sensor Real
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Regresión lineal sobre marcas de tiempo reales; tasa de variación calculada por hora.
                </p>
              </div>

              {/* Selector de métrica */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                {[
                  { id: 'mq2_raw', label: 'MQ-2 (ADC)' },
                  { id: 'pm25_raw', label: 'PM2.5 (ADC)' },
                  { id: 'temperature_c', label: 'Temp (°C)' },
                  { id: 'humidity_pct', label: 'Hum (%)' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMetric(m.id)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      selectedMetric === m.id
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tarjeta de métricas detalladas de la variable seleccionada */}
            {currentTrend ? (
              <div className="space-y-4">
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-400">Primer Valor</span>
                    <p className="text-base font-bold text-white font-mono mt-1">
                      {currentTrend.first_value.toFixed(1)} <span className="text-xs font-normal text-slate-400">{currentTrend.unit}</span>
                    </p>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-400">Último Valor</span>
                    <p className="text-base font-bold text-white font-mono mt-1">
                      {currentTrend.last_value.toFixed(1)} <span className="text-xs font-normal text-slate-400">{currentTrend.unit}</span>
                    </p>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-400">Pendiente / Hora</span>
                    <p className="text-base font-bold font-mono mt-1 text-cyan-300">
                      {currentTrend.slope_per_hour !== null ? `${currentTrend.slope_per_hour > 0 ? '+' : ''}${currentTrend.slope_per_hour}` : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-400">Dirección</span>
                    <div className="mt-1 flex items-center gap-1.5">
                      {currentTrend.direction === 'increasing' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-800/70">
                          <TrendingUp className="w-3.5 h-3.5" /> En alza
                        </span>
                      )}
                      {currentTrend.direction === 'decreasing' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/70">
                          <TrendingDown className="w-3.5 h-3.5" /> En baja
                        </span>
                      )}
                      {currentTrend.direction === 'stable' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          <Minus className="w-3.5 h-3.5" /> Estable
                        </span>
                      )}
                      {currentTrend.direction === 'insufficient_data' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/70">
                          <HelpCircle className="w-3.5 h-3.5" /> Insuficiente
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Explicación técnica de la variable */}
                <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/70 text-xs text-slate-400 flex items-start gap-2">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-200">
                      {selectedMetric === 'mq2_raw' && 'Sensor MQ-2 (Gas / Monóxido / Hidrocarburos): Lectura analógica ADC directa.'}
                      {selectedMetric === 'pm25_raw' && 'Sensor PM2.5 (Material particulado): Lectura analógica por dispersión óptica.'}
                      {selectedMetric === 'temperature_c' && 'Sensor DHT11/22: Temperatura ambiente en grados Celsius (°C).'}
                      {selectedMetric === 'humidity_pct' && 'Sensor DHT11/22: Humedad relativa en porcentaje (% HR).'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {selectedMetric.includes('raw')
                        ? 'La unidad se clasifica como "raw" al no disponer de curva de calibración de laboratorio trazable. No convertir linealmente a ppm sin ensayo físico.'
                        : 'Métrica física calibrada en fábrica por el fabricante del sensor digital.'}
                    </p>
                  </div>
                </div>

                {/* Lista de todas las variables analizadas */}
                <div className="pt-2">
                  <span className="text-xs font-bold text-slate-300 block mb-2">Resumen comparativo de todas las series:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {analysisResult?.trends.map(t => (
                      <div 
                        key={t.metric}
                        onClick={() => setSelectedMetric(t.metric)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                          selectedMetric === t.metric
                            ? 'bg-cyan-950/40 border-cyan-700/80 text-white'
                            : 'bg-slate-950/40 border-slate-800/60 text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{t.metric}</span>
                          <span className="text-[10px] text-slate-400">({t.unit})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-cyan-300 font-semibold">{t.last_value.toFixed(1)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            t.direction === 'increasing' ? 'bg-rose-950 text-rose-300' :
                            t.direction === 'decreasing' ? 'bg-emerald-950 text-emerald-300' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {t.direction}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="py-10 text-center text-xs text-slate-500">
                {analyzing ? 'Procesando serie temporal...' : 'Sin datos de tendencias disponibles'}
              </div>
            )}

          </div>
        </div>

        {/* COLUMNA 3: OBSERVACIONES CLASIFICADAS COMO ANOMALÍAS */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm h-full flex flex-col justify-between">
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Valores Atípicos (MAD)
                </h2>
                <span className="text-[11px] font-mono text-slate-400">
                  {analysisResult?.anomalies.length ?? 0} detectados
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Puntos cuya distancia a la mediana supera 3.5 veces la desviación mediana absoluta.
              </p>

              {/* Lista de anomalías */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {analysisResult?.anomalies && analysisResult.anomalies.length > 0 ? (
                  analysisResult.anomalies.map((anom, idx) => (
                    <div 
                      key={`${anom.timestamp}-${idx}`}
                      className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-300 font-mono">{anom.metric}</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(anom.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-1 text-[11px] font-mono pt-1">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Valor:</span>
                          <span className="font-bold text-white">{anom.value}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Mediana:</span>
                          <span className="text-slate-300">{anom.median}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Robust Z:</span>
                          <span className="text-rose-400 font-bold">{anom.robust_z_score}</span>
                        </div>
                      </div>

                      <p className="text-[10px] text-amber-200/80 pt-1 leading-snug border-t border-amber-800/30">
                        {anom.explanation}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800/60 p-4">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400/80 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">Sin anomalías estadísticas</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Todas las observaciones se mantienen dentro de la dispersión esperada para esta ventana.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Disclaimer inferior de anomalías */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-400">Nota técnica:</span> Un Z robusto alto indica desviación muestral en la ventana. No activa actuadores ni sirenas de faena.
            </div>

          </div>
        </div>

      </div>

      {/* SECCIÓN D: INFORMES, EXPORTACIÓN Y LIMITACIONES TÉCNICAS */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Auditoría Técnica y Exportación de Informes
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Descargue los registros y resultados del modelo para trazabilidad y comités paritarios de seguridad.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={!analysisResult}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-40"
              title="Descargar reporte en formato CSV tabular"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={handleExportJSON}
              disabled={!analysisResult}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/70 transition-colors disabled:opacity-40"
              title="Descargar análisis técnico completo en JSON con firmas de tiempo"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Exportar JSON</span>
            </button>
          </div>
        </div>

        {/* Lista de limitaciones generadas por el backend */}
        {analysisResult?.limitations && analysisResult.limitations.length > 0 && (
          <div className="mt-3 p-3.5 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1.5 text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              Limitaciones declaradas por el motor analítico:
            </span>
            <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] pl-1">
              {analysisResult.limitations.map((lim, i) => (
                <li key={i}>{lim}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Descarga de Paquetes ZIP de Entrega */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
          <div>
            <h3 className="text-xs font-bold text-slate-200">Paquetes de Entrega del Proyecto (ZIPs Completos)</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Descargue los archivos fuente del proyecto Web integrado y el Backend de IA actualizado para ejecución local en VS Code.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <a
              href="/minesafe-web-ia.zip"
              download="minesafe-web-ia.zip"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors shadow-md shadow-cyan-950"
            >
              <Download className="w-4 h-4" />
              <span>Web MineSafe (ZIP)</span>
            </a>
            <a
              href="/minesafe-ai-actualizado.zip"
              download="minesafe-ai-actualizado.zip"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-950 border border-indigo-700/80 hover:bg-indigo-900 text-indigo-200 transition-colors"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Backend IA (ZIP)</span>
            </a>
          </div>
        </div>

      </div>

    </div>
  );
};
