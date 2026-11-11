import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  ShieldAlert, 
  Bell, 
  Filter, 
  Check, 
  Clock, 
  Wind, 
  Volume2, 
  ArrowRight,
  ExternalLink,
  Search,
  Edit3,
  FileText,
  CheckCircle2,
  Flame,
  Cpu,
  Wrench,
  ShieldCheck,
  Download,
  FileSpreadsheet,
  Printer,
  Calendar,
  Radio,
  FileDown,
  Layers,
  Sparkles,
  HardHat
} from 'lucide-react';
import { 
  SafetyAlert, 
  AlertSeverity, 
  NavigationTab, 
  AlertResolutionDetails, 
  UserProfile, 
  SensorDevice, 
  AlarmAuditRecord 
} from '../types';
import { soundAlert } from '../services/audioAlert';
import { extractAlarmAuditRecords } from '../services/firebase';
import { AlertResolutionModal } from './AlertResolutionModal';

interface AlertsViewProps {
  alerts: SafetyAlert[];
  devices?: SensorDevice[];
  currentUser?: UserProfile | null;
  onAcknowledgeAlert: (alertId: string) => void;
  onResolveAlert: (alertId: string) => void;
  onResolveAlertWithDetails?: (alertId: string, details: AlertResolutionDetails) => void;
  onTriggerForcedVentilation: (sectorName: string) => void;
  onNavigateTab: (tab: NavigationTab) => void;
  onSelectSensor: (sensorId: string) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  devices = [],
  currentUser,
  onAcknowledgeAlert,
  onResolveAlert,
  onResolveAlertWithDetails,
  onTriggerForcedVentilation,
  onNavigateTab,
  onSelectSensor,
}) => {
  // Main view switcher: Alertas Activas vs Auditoría Registro de Alarmas (RTDB / ESP32)
  const [subTab, setSubTab] = useState<'alertas_activas' | 'auditoria_rtdb'>('alertas_activas');

  // Active alerts filters
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'active' | 'resolved' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [alertToResolve, setAlertToResolve] = useState<SafetyAlert | null>(null);

  // Auditoría RTDB filters
  const [filterAuditDevice, setFilterAuditDevice] = useState<string>('all');
  const [filterAuditOrigin, setFilterAuditOrigin] = useState<string>('all');
  const [searchAudit, setSearchAudit] = useState('');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Extract all alarm records from devices connected to Firebase RTDB
  const allAuditRecords: AlarmAuditRecord[] = extractAlarmAuditRecords(devices);

  // Filter audit records
  const filteredAuditRecords = allAuditRecords.filter((rec) => {
    const matchesDevice = filterAuditDevice === 'all' || rec.deviceId === filterAuditDevice;
    const matchesOrigin = filterAuditOrigin === 'all' || rec.origen === filterAuditOrigin;
    const matchesSearch = 
      rec.id.toLowerCase().includes(searchAudit.toLowerCase()) ||
      rec.deviceName.toLowerCase().includes(searchAudit.toLowerCase()) ||
      rec.descripcion.toLowerCase().includes(searchAudit.toLowerCase()) ||
      rec.fecha.includes(searchAudit) ||
      rec.hora.includes(searchAudit);
    return matchesDevice && matchesOrigin && matchesSearch;
  });

  // Filter regular alerts
  const filteredAlerts = alerts.filter((alert) => {
    const matchesSeverity = filterSeverity === 'all' || alert.severity === filterSeverity;
    const matchesStatus = 
      filterStatus === 'all' || 
      (filterStatus === 'active' && !alert.resolved) || 
      (filterStatus === 'resolved' && alert.resolved);
    const matchesSearch = 
      alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.sectorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.sensorCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.variableName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSeverity && matchesStatus && matchesSearch;
  });

  const activeAlertsCount = alerts.filter(a => !a.resolved).length;
  const criticalCount = alerts.filter(a => !a.resolved && a.severity === 'critico').length;
  const warningCount = alerts.filter(a => !a.resolved && a.severity === 'advertencia').length;

  const showExportToast = (msg: string) => {
    setExportNotice(msg);
    setTimeout(() => setExportNotice(null), 3500);
  };

  // 1. Exportar a Excel (.csv con UTF-8 BOM para máxima compatibilidad con Microsoft Excel)
  const handleExportAuditExcel = () => {
    soundAlert.playFeedbackBeep();
    const rowsToExport = filteredAuditRecords.length > 0 ? filteredAuditRecords : allAuditRecords;

    // Headers con estándar de auditoría minera DS 132
    const headers = [
      'ID_Registro',
      'ID_Dispositivo',
      'Nombre_Dispositivo',
      'Fecha',
      'Hora',
      'Origen_Alarma',
      'Gas_CO_ADC',
      'Polvo_PM25_ugm3',
      'Temperatura_C',
      'Humedad_Porc',
      'Via_Transmision',
      'Descripcion_Tecnica'
    ];

    const csvRows = [headers.join(';')];

    rowsToExport.forEach((rec) => {
      const cleanDesc = (rec.descripcion || '').replace(/[\r\n;]/g, ' ');
      const row = [
        rec.id,
        rec.deviceId,
        `"${rec.deviceName}"`,
        rec.fecha,
        rec.hora,
        rec.origen,
        rec.co,
        rec.pm25,
        rec.temperatura,
        rec.humedad,
        rec.via || 'WIFI_DIRECTO',
        `"${cleanDesc}"`
      ];
      csvRows.push(row.join(';'));
    });

    // \uFEFF fuerza a Excel a abrir el archivo con codificación UTF-8 correcta (tildes y caracteres especiales)
    const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    link.href = url;
    link.setAttribute('download', `Auditoria_Alarmas_ESP32_DS132_${nowStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showExportToast(`Archivo Excel (.csv) generado con ${rowsToExport.length} registros de auditoría.`);
  };

  // 2. Exportar / Imprimir PDF Oficial
  const handleExportAuditPDF = () => {
    soundAlert.playFeedbackBeep();
    const rowsToExport = filteredAuditRecords.length > 0 ? filteredAuditRecords : allAuditRecords;
    
    // Crear ventana imprimible estilizada con membrete de seguridad minera DS 132
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showExportToast('Por favor permita ventanas emergentes para generar el reporte PDF.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Informe Oficial de Auditoría y Registro de Alarmas - MineSafe DS 132</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; margin: 25px; font-size: 11px; }
          .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 18px; }
          .title { font-size: 18px; font-weight: bold; color: #0f172a; margin: 0; text-transform: uppercase; }
          .subtitle { font-size: 11px; color: #64748b; margin-top: 4px; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; }
          .meta-item strong { display: block; font-size: 9px; color: #64748b; text-transform: uppercase; }
          .meta-item span { font-size: 13px; font-weight: bold; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 10px; }
          th { background: #0f172a; color: #ffffff; padding: 7px 6px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; }
          td { padding: 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .badge { display: inline-block; padding: 2px 5px; border-radius: 3px; font-weight: bold; font-size: 8px; }
          .badge-danger { background: #fee2e2; color: #991b1b; border: 1px solid #f87171; }
          .badge-manual { background: #ffedd5; color: #9a3412; border: 1px solid #fb923c; }
          .badge-normal { background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; }
          .signatures { margin-top: 45px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; text-align: center; }
          .sig-line { border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 9px; color: #475569; }
          @media print {
            body { margin: 10mm; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h1 class="title">MINESAFE IOT • AUDITORÍA OFICIAL DE ALARMAS</h1>
              <div class="subtitle">Certificado de Cumplimiento Normativo Sernageomin DS 132 — Seguridad Minera</div>
            </div>
            <div style="text-align: right; font-size: 10px; color: #64748b;">
              Fecha Emisión: ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}<br>
              Auditor: ${currentUser?.name || 'Administrador de Faena'} (${currentUser?.roleLabel || 'Seguridad Minera'})
            </div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <strong>Total de Disparos</strong>
            <span>${rowsToExport.length}</span>
          </div>
          <div class="meta-item">
            <strong>Causa Natural (Sensores)</strong>
            <span>${rowsToExport.filter(r => r.origen.includes('NATURAL')).length}</span>
          </div>
          <div class="meta-item">
            <strong>Activación Manual / Pánico</strong>
            <span>${rowsToExport.filter(r => r.origen.includes('MANUAL')).length}</span>
          </div>
          <div class="meta-item">
            <strong>Nodos Transmisores</strong>
            <span>${Array.from(new Set(rowsToExport.map(r => r.deviceId))).length}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 14%;">Fecha / Hora</th>
              <th style="width: 18%;">Dispositivo</th>
              <th style="width: 16%;">Origen de Disparo</th>
              <th style="width: 18%;">Parámetros Registrados</th>
              <th style="width: 34%;">Descripción Técnica Emitida</th>
            </tr>
          </thead>
          <tbody>
            ${rowsToExport.map(r => `
              <tr>
                <td><strong>${r.fecha}</strong><br><span style="color:#64748b;">${r.hora}</span></td>
                <td><strong>${r.deviceName}</strong><br><span style="font-family:monospace; font-size:8px; color:#64748b;">${r.deviceId}</span></td>
                <td>
                  <span class="badge ${r.origen.includes('NATURAL') ? 'badge-danger' : 'badge-manual'}">
                    ${r.origen}
                  </span>
                  <div style="font-size:8px; color:#64748b; margin-top:2px;">Vía: ${r.via || 'WIFI_DIRECTO'}</div>
                </td>
                <td>
                  <strong>CO:</strong> ${r.co} ADC<br>
                  <strong>PM2.5:</strong> ${r.pm25} µg/m³<br>
                  <strong>Clima:</strong> ${r.temperatura}°C | ${r.humedad}%
                </td>
                <td style="line-height: 1.35; color:#334155;">
                  ${r.descripcion}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="signatures">
          <div>
            <div class="sig-line">
              <strong>${currentUser?.name || 'Manuel Crisostomo'}</strong><br>
              Prevencionista de Riesgos / SuperAdmin DS 132
            </div>
          </div>
          <div>
            <div class="sig-line">
              <strong>Jefe de Turno de Mina</strong><br>
              Supervisión de Operaciones y Rescate
            </div>
          </div>
          <div>
            <div class="sig-line">
              <strong>Auditor Técnico MineSafe IoT</strong><br>
              Validación Criptográfica y Firma Electrónica
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    showExportToast('Reporte PDF preparado. Se ha abierto el cuadro de impresión.');
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critico':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-300 bg-rose-950/90 px-2.5 py-1 rounded border border-rose-800">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            CRÍTICO
          </span>
        );
      case 'advertencia':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded border border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            ADVERTENCIA
          </span>
        );
      case 'desconectado':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-slate-900 px-2.5 py-1 rounded border border-slate-700">
            DESCONECTADO
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/60">
            NORMAL
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Summary Banner */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Gestión, Auditoría y Registro de Alertas de Seguridad
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Monitoreo centralizado de contingencias y auditoría de hardware ESP32 según normativa DS 132 (Sernageomin).
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => soundAlert.playCriticalAlert()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-cyan-400" />
              Probar Sirena
            </button>
          </div>
        </div>

        {/* View Switcher: Alertas Activas vs Auditoría de Alarmas ESP32 */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setSubTab('alertas_activas')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              subTab === 'alertas_activas'
                ? 'bg-rose-950 text-rose-200 border border-rose-700 shadow-md shadow-rose-950/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Bell className="w-4 h-4 text-rose-400" />
            <span>Alertas Activas de Faena</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-900/90 text-rose-200 font-mono font-bold">
              {activeAlertsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('auditoria_rtdb')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              subTab === 'auditoria_rtdb'
                ? 'bg-cyan-950 text-cyan-200 border border-cyan-700 shadow-md shadow-cyan-950/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>Auditoría y Registro de Alarmas (RTDB / ESP32)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-900/90 text-cyan-200 font-mono font-bold">
              {allAuditRecords.length}
            </span>
          </button>
        </div>

        {/* Export Feedback Toast */}
        {exportNotice && (
          <div className="mt-4 p-3 bg-cyan-950/90 border border-cyan-500/60 text-cyan-200 rounded-xl text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{exportNotice}</span>
            </div>
            <button 
              onClick={() => setExportNotice(null)} 
              className="text-cyan-400 hover:text-white text-[10px] font-bold"
            >
              Cerrar
            </button>
          </div>
        )}

      </div>

      {/* ==============================================================
          SUBTAB 1: ALERTAS ACTIVAS EN TIEMPO REAL
         ============================================================== */}
      {subTab === 'alertas_activas' && (
        <div className="space-y-6">
          {/* Severity Count Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">Total Activas</span>
                <span className="text-2xl font-bold text-white font-mono">{activeAlertsCount}</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-400">
                <Bell className="w-5 h-5" />
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-rose-900/40 flex items-center justify-between">
              <div>
                <span className="text-xs text-rose-300 block">Riesgo Crítico</span>
                <span className="text-2xl font-bold text-rose-400 font-mono">{criticalCount}</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-rose-950 flex items-center justify-center text-rose-400 border border-rose-800">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-amber-900/40 flex items-center justify-between">
              <div>
                <span className="text-xs text-amber-300 block">Advertencia</span>
                <span className="text-2xl font-bold text-amber-400 font-mono">{warningCount}</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-amber-950 flex items-center justify-center text-amber-400 border border-amber-800">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por sector, variable o sensor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Todas las severidades</option>
                <option value="critico">Solo Críticas</option>
                <option value="advertencia">Solo Advertencias</option>
                <option value="desconectado">Desconectadas</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="active">Solo Activas</option>
                <option value="resolved">Solo Resueltas</option>
                <option value="all">Todas</option>
              </select>
            </div>
          </div>

          {/* Active Alerts List */}
          <div className="space-y-3">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-xl">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-slate-200">No se encontraron alertas para los filtros seleccionados</p>
                <p className="text-xs text-slate-400 mt-1">Todos los sectores monitoreados operan dentro de los umbrales seguros.</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border transition-all ${
                    alert.resolved
                      ? 'bg-slate-900/40 border-slate-800/80 opacity-70'
                      : alert.severity === 'critico'
                      ? 'bg-rose-950/20 border-rose-800/70 hover:border-rose-600'
                      : 'bg-amber-950/20 border-amber-800/70 hover:border-amber-600'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(alert.severity)}
                        <span className="text-xs font-bold text-white tracking-wide">{alert.title}</span>
                        {alert.resolved && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                            RESUELTA
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300">
                        {alert.suggestedAction || `${alert.variableName}: ${alert.recordedValue} (Límite seguro: ${alert.safeLimit})`}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                        <span>Sector: <strong className="text-slate-200">{alert.sectorName}</strong></span>
                        <span>•</span>
                        <span>Sensor: <strong className="text-cyan-400 font-mono">{alert.sensorCode}</strong></span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono text-slate-400">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {alert.timestamp}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          onSelectSensor(alert.sensorId);
                          onNavigateTab('monitoreo');
                        }}
                        className="p-1.5 text-slate-400 hover:text-cyan-400 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                        title="Ver telemetría del sensor"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>

                      {!alert.acknowledged && (
                        <button
                          onClick={() => onAcknowledgeAlert(alert.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
                        >
                          Reconocer
                        </button>
                      )}

                      {!alert.resolved ? (
                        <button
                          onClick={() => setAlertToResolve(alert)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Describir y Dar por Resuelta
                        </button>
                      ) : (
                        <button
                          onClick={() => setAlertToResolve(alert)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                          Editar Bitácora
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==============================================================
          SUBTAB 2: AUDITORÍA Y REGISTRO DE ALARMAS (NODO registro_alarmas)
         ============================================================== */}
      {subTab === 'auditoria_rtdb' && (
        <div className="space-y-5 animate-in fade-in">
          
          {/* Auditoría Header & Export Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
                <h2 className="text-base font-bold text-white tracking-wide">
                  Bitácora de Auditoría de Alarmas en Firebase (ESP32)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  /registro_alarmas
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Registros históricos de disparos guardados directamente por el firmware del ESP32 Gateway y nodos sensores.
              </p>
            </div>

            {/* Export Buttons: Excel & PDF */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleExportAuditExcel}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-md shadow-emerald-950 cursor-pointer"
                title="Descargar tabla en Excel / CSV con formato UTF-8"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                <span>Exportar a Excel (.csv)</span>
              </button>

              <button
                type="button"
                onClick={handleExportAuditPDF}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors shadow-md shadow-cyan-950 cursor-pointer"
                title="Generar e imprimir informe oficial en PDF para Prevención de Riesgos"
              >
                <Printer className="w-4 h-4 text-cyan-100" />
                <span>Exportar a PDF / Imprimir</span>
              </button>
            </div>
          </div>

          {/* Audit Filters Bar */}
          <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por ID, dispositivo, descripción o fecha..."
                value={searchAudit}
                onChange={(e) => setSearchAudit(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Device */}
              <select
                value={filterAuditDevice}
                onChange={(e) => setFilterAuditDevice(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Todos los dispositivos ({allAuditRecords.length})</option>
                {Array.from(new Set(allAuditRecords.map(r => r.deviceId))).map((devId) => (
                  <option key={devId} value={devId}>
                    {devId}
                  </option>
                ))}
              </select>

              {/* Filter Origin */}
              <select
                value={filterAuditOrigin}
                onChange={(e) => setFilterAuditOrigin(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Todos los orígenes</option>
                <option value="CAUSA_NATURAL_SENSORES">Causa Natural (Sensores)</option>
                <option value="ACTIVACION_MANUAL_USUARIO">Activación Manual (Pánico)</option>
              </select>
            </div>
          </div>

          {/* Audit Records Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            {filteredAuditRecords.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Radio className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">No hay registros de alarmas que coincidan con los filtros.</p>
                <p className="text-xs text-slate-400 mt-1">Los disparos de alarma del ESP32 se registrarán automáticamente aquí.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/90 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Fecha / Hora</th>
                      <th className="py-3 px-4">Dispositivo</th>
                      <th className="py-3 px-4">Origen</th>
                      <th className="py-3 px-4">Mediciones Disparo</th>
                      <th className="py-3 px-4">Descripción de Monitoreo</th>
                      <th className="py-3 px-4">Vía</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredAuditRecords.map((rec) => {
                      const isNatural = rec.origen.includes('NATURAL');
                      return (
                        <tr key={`${rec.deviceId}-${rec.id}`} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-bold text-white block">{rec.fecha}</span>
                            <span className="text-[11px] font-mono text-cyan-400">{rec.hora}</span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-200 block truncate max-w-[160px]">{rec.deviceName}</span>
                            <span className="text-[10px] font-mono text-slate-400">{rec.deviceId}</span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${
                              isNatural 
                                ? 'bg-rose-950 text-rose-300 border-rose-800' 
                                : 'bg-amber-950 text-amber-300 border-amber-800'
                            }`}>
                              {isNatural ? <Flame className="w-2.5 h-2.5" /> : <HardHat className="w-2.5 h-2.5" />}
                              <span>{rec.origen}</span>
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="text-amber-300">CO: <strong>{rec.co} ADC</strong></span>
                              <span className="text-slate-600">|</span>
                              <span className="text-purple-300">PM2.5: <strong>{rec.pm25} µg/m³</strong></span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {rec.temperatura}°C • {rec.humedad}% Hum
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <p className="text-slate-300 text-[11px] leading-relaxed max-w-md">
                              {rec.descripcion}
                            </p>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                              {rec.via || 'WIFI_DIRECTO'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Modal para Clasificar y Describir la Alerta */}
      {alertToResolve && (
        <AlertResolutionModal
          alert={alertToResolve}
          currentUser={currentUser}
          onClose={() => setAlertToResolve(null)}
          onConfirmResolution={(alertId, details) => {
            if (onResolveAlertWithDetails) {
              onResolveAlertWithDetails(alertId, details);
            } else {
              onResolveAlert(alertId);
            }
            soundAlert.playFeedbackBeep();
            setAlertToResolve(null);
          }}
        />
      )}

    </div>
  );
};
