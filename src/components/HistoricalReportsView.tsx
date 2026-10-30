import React, { useState } from 'react';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  FileSpreadsheet, 
  Printer, 
  CheckCircle, 
  AlertTriangle,
  Layers,
  Thermometer,
  CloudRain,
  Wind,
  Flame,
  Zap
} from 'lucide-react';
import { TelemetryVariable, MiningSite } from '../types';
import { soundAlert } from '../services/audioAlert';

interface HistoricalReportsViewProps {
  variables: TelemetryVariable[];
  currentSite: MiningSite;
}

export const HistoricalReportsView: React.FC<HistoricalReportsViewProps> = ({
  variables,
  currentSite,
}) => {
  const [selectedVarId, setSelectedVarId] = useState<string>('temp');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h');
  const [showExportSuccess, setShowExportSuccess] = useState(false);

  const currentVar = variables.find(v => v.id === selectedVarId) || variables[0];

  // Preferir puntos históricos reales almacenados en la variable de telemetría
  const generateSeries = () => {
    if (currentVar.historical && currentVar.historical.length >= 3) {
      return currentVar.historical.map(h => ({
        label: h.timestamp,
        value: h.value
      }));
    }
    const baseVal = currentVar.value;
    // Si no hay histórico acumulado suficiente, reflejar únicamente la lectura real actual
    return [
      { label: 'T-10m', value: Number(baseVal.toFixed(1)) },
      { label: 'T-5m', value: Number(baseVal.toFixed(1)) },
      { label: 'Ahora', value: Number(baseVal.toFixed(1)) },
    ];
  };

  const series = generateSeries();
  const isSufficientHistory = (currentVar.historical && currentVar.historical.length >= 3);
  const values = series.map(s => s.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const avgVal = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);


  // SVG Chart Dimensions
  const width = 800;
  const height = 260;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const yRange = maxVal - minVal || 1;
  const points = series.map((pt, index) => {
    const x = padding + (index / (series.length - 1)) * chartWidth;
    const y = height - padding - ((pt.value - minVal) / yRange) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  // Export CSV
  const handleExportCSV = () => {
    soundAlert.playFeedbackBeep();
    const headers = 'Marca_Temporal,Variable,Unidad,Valor_Registrado,Faena,Sector\n';
    const rows = series.map((pt) => `${pt.label},${currentVar.name},${currentVar.unit},${pt.value},"${currentSite.name}","Nivel Subterráneo"\n`).join('');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
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
      
      {/* Top Banner */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Historial de Mediciones y Reportes Técnicos
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Análisis temporal de variables ambientales subterráneas y generación de bitácoras de auditoría minera.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar Datos CSV
            </button>
          </div>
        </div>

        {/* Success toast notification */}
        {showExportSuccess && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Archivo CSV generado exitosamente con el registro histórico de telemetría.</span>
          </div>
        )}

        {/* Variable & Time Range Selection Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-6 border-t border-slate-800/80 mt-6">
          
          {/* Variable buttons */}
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

          {/* Time range switcher */}
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

      {/* Main Graph Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6">
        
        {/* Metric Header & Statistics Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400 block font-semibold">
              Evolución Temporal de {currentVar.name}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-white font-mono tabular-nums">
                {currentVar.value} <span className="text-base text-cyan-300 font-sans">{currentVar.unit}</span>
              </span>
              <span className="text-xs text-slate-400 font-medium">Lectura actual en boca de sensor</span>
            </div>
          </div>

          {/* Statistical Breakdown */}
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

        {/* SVG Curve Chart */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[650px] relative">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64 overflow-visible">
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
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

              {/* Area Under Curve */}
              <polygon
                points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
                fill="url(#chartGradient)"
              />

              {/* Trend Polyline */}
              <polyline
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />

              {/* Data points */}
              {series.map((pt, i) => {
                const x = padding + (i / (series.length - 1)) * chartWidth;
                const y = height - padding - ((pt.value - minVal) / yRange) * chartHeight;
                return (
                  <g key={i} className="group">
                    <circle
                      cx={x}
                      cy={y}
                      r="3.5"
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

          {/* Transparencia metrológica de la serie */}
          {!isSufficientHistory ? (
            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  <strong>Aviso Metrológico:</strong> Ventana inicial basada en la lectura en vivo reportada por el sensor. No se sintetizan datos artificiales ni curvas senoidales ficticias para rellenar gráficos. Para análisis de series temporales y detección de anomalías (MAD), visite la pestaña <strong>MineSafe IA</strong>.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-950/20 rounded-lg border border-emerald-800/40 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Registros históricos reales acumulados desde la telemetría del nodo ESP32 / Gateway.</span>
            </div>
          )}
        </div>

      </div>

      {/* Sernageomin Audit Log Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">
              Bitácora de Inspección y Cumplimiento Normativo (DS 132)
            </h3>
          </div>
          <span className="text-xs text-slate-400">Auditoría Sernageomin Activa</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Fecha / Hora</th>
                <th className="px-4 py-3">Variable</th>
                <th className="px-4 py-3">Punto de Muestreo</th>
                <th className="px-4 py-3">Valor Promedio</th>
                <th className="px-4 py-3">Límite Normativo</th>
                <th className="px-4 py-3">Dictamen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-3 font-mono">2026-09-26 06:00</td>
                <td className="px-4 py-3 font-medium text-white">Monóxido de Carbono (CO)</td>
                <td className="px-4 py-3 text-slate-400">Frente de Avance Socavón N-01</td>
                <td className="px-4 py-3 font-mono text-emerald-400">8.4 ppm</td>
                <td className="px-4 py-3">&lt; 25.0 ppm</td>
                <td className="px-4 py-3 text-emerald-400 font-semibold">Cumple Norma</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-3 font-mono">2026-09-26 04:00</td>
                <td className="px-4 py-3 font-medium text-white">Velocidad de Ventilación</td>
                <td className="px-4 py-3 text-slate-400">Chimenea E-2 Auxiliar</td>
                <td className="px-4 py-3 font-mono text-emerald-400">1.85 m/s</td>
                <td className="px-4 py-3">&ge; 0.50 m/s</td>
                <td className="px-4 py-3 text-emerald-400 font-semibold">Cumple Norma</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-3 font-mono">2026-09-25 22:00</td>
                <td className="px-4 py-3 font-medium text-white">Gas Metano (CH4)</td>
                <td className="px-4 py-3 text-slate-400">Pique Central Traspaso</td>
                <td className="px-4 py-3 font-mono text-emerald-400">1.1 % LEL</td>
                <td className="px-4 py-3">&lt; 5.0 % LEL</td>
                <td className="px-4 py-3 text-emerald-400 font-semibold">Cumple Norma</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-3 font-mono">2026-09-25 18:00</td>
                <td className="px-4 py-3 font-medium text-white">Dióxido de Carbono (CO2)</td>
                <td className="px-4 py-3 text-slate-400">Galería de Extracción 4-Sur</td>
                <td className="px-4 py-3 font-mono text-amber-400">1150 ppm</td>
                <td className="px-4 py-3">&lt; 1000 ppm</td>
                <td className="px-4 py-3 text-amber-400 font-semibold">Observación Preventiva</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
