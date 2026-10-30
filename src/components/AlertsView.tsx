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
  Wrench
} from 'lucide-react';
import { SafetyAlert, AlertSeverity, NavigationTab, AlertResolutionDetails, UserProfile } from '../types';
import { soundAlert } from '../services/audioAlert';
import { AlertResolutionModal } from './AlertResolutionModal';

interface AlertsViewProps {
  alerts: SafetyAlert[];
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
  currentUser,
  onAcknowledgeAlert,
  onResolveAlert,
  onResolveAlertWithDetails,
  onTriggerForcedVentilation,
  onNavigateTab,
  onSelectSensor,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'active' | 'resolved' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [alertToResolve, setAlertToResolve] = useState<SafetyAlert | null>(null);


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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Gestión y Registro de Alertas de Seguridad
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Monitoreo centralizado de contingencias según normativa de seguridad minera (Sernageomin).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => soundAlert.playCriticalAlert()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors"
            >
              <Volume2 className="w-4 h-4 text-cyan-400" />
              Probar Sirena
            </button>
          </div>
        </div>

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
              <span className="text-xs text-amber-300 block">Advertencias Preventivas</span>
              <span className="text-2xl font-bold text-amber-400 font-mono">{warningCount}</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-950 flex items-center justify-center text-amber-400 border border-amber-800">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
        
        {/* Status Tabs: Activas / Resueltas / Todas */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 w-full sm:w-auto">
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              filterStatus === 'active' 
                ? 'bg-slate-800 text-cyan-300 shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Activas ({activeAlertsCount})
          </button>
          <button
            onClick={() => setFilterStatus('resolved')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              filterStatus === 'resolved' 
                ? 'bg-slate-800 text-cyan-300 shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Resueltas ({alerts.filter(a => a.resolved).length})
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              filterStatus === 'all' 
                ? 'bg-slate-800 text-cyan-300 shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todas ({alerts.length})
          </button>
        </div>

        {/* Severity and Search filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Buscar alerta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Cualquier Severidad</option>
            <option value="critico">Solo Críticas</option>
            <option value="advertencia">Solo Advertencias</option>
            <option value="desconectado">Solo Desconectadas</option>
          </select>
        </div>
      </div>

      {/* Alerts Incident List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-slate-400 text-sm">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            No existen alertas en esta categoría.
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-5 rounded-xl bg-slate-900/70 border transition-all duration-150 space-y-3 ${
                alert.resolved 
                  ? 'border-slate-800/60 opacity-70' 
                  : alert.severity === 'critico'
                    ? 'border-rose-800/80 bg-rose-950/10'
                    : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Row 1: Badges & Timestamp */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getSeverityBadge(alert.severity)}
                  <span className="font-mono text-xs font-bold text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {alert.code}
                  </span>
                  {alert.resolved && (
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                      Resuelta
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{alert.timestamp}</span>
                </div>
              </div>

              {/* Row 2: Title and context */}
              <div>
                <h3 className="text-base font-bold text-white">{alert.title}</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Sector: <span className="font-medium text-cyan-400">{alert.sectorName}</span> · Variable: <span className="font-medium text-slate-200">{alert.variableName}</span> · Sensor: <span className="font-mono text-slate-300">{alert.sensorCode}</span>
                </p>
              </div>

              {/* Row 3: Recorded Value vs Safe Limit and Suggested Protocol */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Lectura Registrada vs Límite:</span>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-rose-400 font-bold font-mono text-sm">{alert.recordedValue}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-emerald-400 font-medium">Límite Seguro: {alert.safeLimit}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px]">Acción Recomendada (DS 132):</span>
                  <p className="mt-0.5 text-slate-200">{alert.suggestedAction}</p>
                </div>
              </div>

              {/* Row 3.5: Bitácora de Cierre y Descripción de Resolución (si está resuelta) */}
              {alert.resolutionDetails && (
                <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="font-bold text-slate-200">Bitácora de Cierre de Contingencia (DS 132):</span>
                    </div>

                    {/* Insignia de Clasificación */}
                    {alert.resolutionDetails.resolutionType === 'emergencia_real' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-bold text-[11px] bg-rose-950 text-rose-300 border border-rose-700">
                        <Flame className="w-3 h-3 text-rose-400" />
                        EMERGENCIA REAL (VERDADERA)
                      </span>
                    )}
                    {alert.resolutionDetails.resolutionType === 'simulacro' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-bold text-[11px] bg-amber-950 text-amber-300 border border-amber-700">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        SIMULACRO PROGRAMADO
                      </span>
                    )}
                    {alert.resolutionDetails.resolutionType === 'falsa_alarma_sensor' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-bold text-[11px] bg-cyan-950 text-cyan-300 border border-cyan-700">
                        <Cpu className="w-3 h-3 text-cyan-400" />
                        FALSA ALARMA (FALLA TÉCNICA)
                      </span>
                    )}
                    {alert.resolutionDetails.resolutionType === 'prueba_operativa' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-bold text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-700">
                        <Wrench className="w-3 h-3 text-emerald-400" />
                        PRUEBA OPERATIVA / MANTENCIÓN
                      </span>
                    )}
                  </div>

                  <p className="text-slate-300 bg-slate-900/80 p-2.5 rounded border border-slate-800/80 italic leading-relaxed">
                    "{alert.resolutionDetails.comment}"
                  </p>

                  {alert.resolutionDetails.correctiveActions && (
                    <div className="text-[11px] text-slate-400">
                      <strong className="text-slate-300 font-semibold">Medidas Adoptadas:</strong> {alert.resolutionDetails.correctiveActions}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                    <span>Supervisor a cargo: <strong className="text-slate-200">{alert.resolutionDetails.resolvedBy}</strong></span>
                    <span>Cierre: {alert.resolutionDetails.resolvedAt}</span>
                  </div>
                </div>
              )}

              {/* Row 4: Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {alert.acknowledged ? (
                    <span className="flex items-center gap-1 text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Reconocida por {alert.acknowledgedBy || 'Supervisor'}
                    </span>
                  ) : (
                    <span className="text-amber-400 font-medium">Pendiente de confirmación</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Trigger forced ventilation */}
                  <button
                    onClick={() => onTriggerForcedVentilation(alert.sectorName)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded-lg transition-colors"
                  >
                    <Wind className="w-3.5 h-3.5 text-cyan-400" />
                    Forzar Ventilación
                  </button>

                  {/* Go to sensor */}
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

                  {/* Acknowledge button */}
                  {!alert.acknowledged && (
                    <button
                      onClick={() => onAcknowledgeAlert(alert.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
                    >
                      Reconocer
                    </button>
                  )}

                  {/* Resolve button (Opens modal to classify and write description) */}
                  {!alert.resolved ? (
                    <button
                      onClick={() => setAlertToResolve(alert)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-colors shadow-sm"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Describir y Dar por Resuelta
                    </button>
                  ) : (
                    <button
                      onClick={() => setAlertToResolve(alert)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors"
                      title="Editar o complementar descripción en la bitácora"
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
