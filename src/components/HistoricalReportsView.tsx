import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  CheckCircle,
  Info
} from 'lucide-react';
import {
  TelemetryVariable,
  MiningSite,
  TelemetryHistoryPoint,
  AlertEventRecord,
  SafetyAlert,
} from '../types';
import { soundAlert } from '../services/audioAlert';

interface HistoricalReportsViewProps {
  variables: TelemetryVariable[];
  currentSite: MiningSite;
  telemetryHistory?: TelemetryHistoryPoint[];
  alertEvents?: AlertEventRecord[];
  alerts?: SafetyAlert[];
}

const RANGE_HOURS: Record<'1h' | '6h' | '24h' | '7d' | '30d', number> = {
  '1h': 1,
  '6h': 6,
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

export const HistoricalReportsView: React.FC<HistoricalReportsViewProps> = ({
  variables,
  currentSite,
  telemetryHistory = [],
  alertEvents = [],
  alerts = [],
}) => {
  const [selectedVarId, setSelectedVarId] = useState<string>('temp');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h');
  const [showExportSuccess, setShowExportSuccess] = useState(false);

  const currentVar = variables.find((v) => v.id === selectedVarId) || variables[0];

  const series = useMemo(() => {
    const cutoff = Date.now() - RANGE_HOURS[timeRange] * 3600 * 1000;
    const filtered = telemetryHistory.filter((pt) => pt.timestamp >= cutoff);

    const mappedFromRTDB = filtered
      .map((pt) => {
        let val: number | null = null;
        if (currentVar?.id === 'temp') val = pt.temperatura;
        else if (currentVar?.id === 'hum') val = pt.humedad;
        else if (currentVar?.id === 'co2' || currentVar?.id === 'co') val = pt.co;
        else if (currentVar?.id === 'lux' || currentVar?.id === 'pm25') val = pt.pm25;

        if (typeof val !== 'number' || !Number.isFinite(val)) return null;
        return {
          label: new Date(pt.timestamp).toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          value: Number(val.toFixed(1)),
        };
      })
      .filter((item): item is { label: string; value: number } => item !== null);

    if (mappedFromRTDB.length >= 2) {
      return mappedFromRTDB.slice(-36);
    }
    if (currentVar?.historical && currentVar.historical.length >= 2) {
      return currentVar.historical.map((h) => ({
        label: h.timestamp,
        value: Number(h.value.toFixed(1)),
      }));
    }
    return [
      {
        label: 'Actual',
        value: Number((currentVar?.value ?? 0).toFixed(1)),
      },
    ];
  }, [telemetryHistory, timeRange, currentVar]);

  const isSufficientHistory = series.length >= 3;
  const values = series.map((s) => s.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const avgVal = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);

  const width = 800;
  const height = 260;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const yRange = maxVal - minVal || 1;

  const getCoord = (ptValue: number, index: number) => {
    const ratioX = series.length > 1 ? index / (series.length - 1) : 0.5;
    const x = padding + ratioX * chartWidth;
    const y = height - padding - ((ptValue - minVal) / yRange) * chartHeight;
    return { x, y };
  };

  const points = series
    .map((pt, index) => {
      const { x, y } = getCoord(pt.value, index);
      return `${x},${y}`;
    })
    .join(' ');

  const auditTableRows = useMemo(() => {
    const fromEvents = alertEvents.map((ev) => ({
      id: `ev-${ev.id}`,
      sortTs: ev.timestamp || 0,
      fechaHora: ev.fecha_hora || new Date(ev.timestamp || Date.now()).toLocaleString('es-CL'),
      variable: ev.variable_label,
      sector: ev.sector_nombre || ev.dispositivo_nombre,
      valor: `${ev.valor_detectado} ${ev.unidad}`,
      umbral: `${ev.umbral_superado} ${ev.unidad}`,
      dictamen:
        ev.estado === 'recuperada'
          ? 'Recuperada a rango normal'
          : ev.nivel === 'critico'
          ? 'Crítico Activo'
          : ev.nivel === 'advertencia'
          ? 'Advertencia Activa'
          : 'Preventivo Activo',
      tone:
        ev.estado === 'recuperada'
          ? 'text-emerald-400'
          : ev.nivel === 'critico'
          ? 'text-rose-400'
          : 'text-amber-400',
    }));

    const fromAlerts = alerts.map((al) => ({
      id: `al-${al.id}`,
      sortTs: al.timestampMs || 0,
      fechaHora: al.timestamp,
      variable: al.variableName,
      sector: al.sectorName,
      valor: al.recordedValue,
      umbral: al.safeLimit,
      dictamen: al.resolved
        ? `Resuelta (${al.resolutionDetails?.resolutionType || 'bitácora'})`
        : al.severity === 'critico'
        ? 'Crítica Activa'
        : al.severity === 'desconectado'
        ? 'Nodo Desconectado'
        : 'Observación Activa',
      tone: al.resolved
        ? 'text-emerald-400'
        : al.severity === 'critico'
        ? 'text-rose-400'
        : 'text-amber-400',
    }));

    return [...fromEvents, ...fromAlerts]
      .sort((a, b) => b.sortTs - a.sortTs)
      .slice(0, 25);
  }, [alertEvents, alerts]);

  const handleExportCSV = () => {
    soundAlert.playFeedbackBeep();
    const headers = 'Marca_Temporal,Variable,Unidad,Valor_Registrado,Faena,Sector\n';
    const rows = series
      .map(
        (pt) =>
          `${pt.label},${currentVar.name},${currentVar.unit},${pt.value},"${currentSite.name}","Nivel Subterráneo"\n`
      )
      .join('');
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `minesafe_reporte_${currentVar.id}_${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowExportSuccess(true);
    setTimeout(() => setShowExportSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Historial de Mediciones y Reportes Técnicos
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Serie histórica real persistida en Firebase RTDB (/historial_telemetria) y auditoría de eventos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Exportar Datos CSV
            </button>
          </div>
        </div>

        {showExportSuccess && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Archivo CSV generado exitosamente con el registro histórico de telemetría.</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-6 border-t border-slate-800/80 mt-6">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {variables.slice(0, 6).map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setSelectedVarId(v.id);
                  soundAlert.playFeedbackBeep();
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  selectedVarId === v.id
                    ? 'bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {v.shortName}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 self-start md:self-auto">
            {(['1h', '6h', '24h', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  timeRange === r
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400 block font-semibold">
              Evolución Temporal de {currentVar.name} ({series.length} muestras reales)
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-white font-mono tabular-nums">
                {currentVar.value} <span className="text-base text-cyan-300 font-sans">{currentVar.unit}</span>
              </span>
              <span className="text-xs text-slate-400 font-medium">Lectura actual en boca de sensor</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Mínimo</span>
              <span className="font-mono font-bold text-white tabular-nums">{minVal} {currentVar.unit}</span>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Promedio</span>
              <span className="font-mono font-bold text-cyan-400 tabular-nums">{avgVal} {currentVar.unit}</span>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Máximo</span>
              <span className="font-mono font-bold text-amber-400 tabular-nums">{maxVal} {currentVar.unit}</span>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <div className="min-w-[650px] relative">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64 overflow-visible">
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = padding + ratio * chartHeight;
                const val = (maxVal - ratio * yRange).toFixed(1);
                return (
                  <g key={i}>
                    <line
                      x1={padding}
                      y1={y}
                      x2={width - padding}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding - 8}
                      y={y + 3}
                      fill="#64748b"
                      fontSize="10"
                      textAnchor="end"
                      fontFamily="JetBrains Mono"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {series.length >= 2 && (
                <>
                  <polygon
                    points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
                    fill="url(#chartGradient)"
                  />
                  <polyline
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                  />
                </>
              )}

              {series.map((pt, i) => {
                const { x, y } = getCoord(pt.value, i);
                return (
                  <g key={i} className="group">
                    <circle
                      cx={x}
                      cy={y}
                      r={series.length === 1 ? '5' : '3.5'}
                      fill="#06b6d4"
                      stroke="#0f172a"
                      strokeWidth="2"
                      className="hover:scale-150 transition-transform duration-100"
                    />
                    <text
                      x={x}
                      y={height - padding + 16}
                      fill="#64748b"
                      fontSize="9"
                      textAnchor="middle"
                      fontFamily="JetBrains Mono"
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {!isSufficientHistory ? (
            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  <strong>Aviso Metrológico:</strong> Sin suficiente historial acumulado en RTDB para la ventana{' '}
                  <strong>{timeRange}</strong>. Se muestra únicamente la lectura real actual sin rellenar con curvas ficticias.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-950/20 rounded-lg border border-emerald-800/40 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Registros históricos reales acumulados desde Firebase RTDB (/historial_telemetria).</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">
              Bitácora de Inspección y Eventos Registrados (DS 132)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {auditTableRows.length} eventos reales trazables
          </span>
        </div>

        {auditTableRows.length === 0 ? (
          <div className="p-6 text-center bg-slate-950/50 rounded-xl border border-slate-800 text-xs text-slate-400">
            No existen eventos en <span className="font-mono text-slate-300">/alertas_eventos</span> ni alertas emitidas aún en esta sesión/organización.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Fecha / Hora</th>
                  <th className="px-4 py-3">Variable</th>
                  <th className="px-4 py-3">Punto / Sector</th>
                  <th className="px-4 py-3">Valor Detectado</th>
                  <th className="px-4 py-3">Umbral</th>
                  <th className="px-4 py-3">Estado / Dictamen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {auditTableRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{row.fechaHora}</td>
                    <td className="px-4 py-3 font-medium text-white">{row.variable}</td>
                    <td className="px-4 py-3 text-slate-400">{row.sector}</td>
                    <td className="px-4 py-3 font-mono text-cyan-300">{row.valor}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{row.umbral}</td>
                    <td className={`px-4 py-3 font-semibold ${row.tone}`}>{row.dictamen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

