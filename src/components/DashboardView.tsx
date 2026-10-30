import React from 'react';
import { 
  Thermometer, 
  Droplets, 
  CloudRain, 
  Sun, 
  Zap, 
  Wind, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Activity, 
  ShieldCheck, 
  Eye, 
  Bell, 
  BarChart3, 
  Cpu, 
  Wrench, 
  Users, 
  FileSpreadsheet, 
  Layers, 
  Radio, 
  ArrowRight,
  ExternalLink,
  Flame,
  Volume2
} from 'lucide-react';
import { 
  TelemetryVariable, 
  SafetyAlert, 
  MiningSite, 
  NavigationTab, 
  SensorDevice,
  UserProfile 
} from '../types';
import { ESP32GatewaySection } from './ESP32GatewaySection';
import { DualReadingSensorCards } from './DualReadingSensorCards';
import { InteractiveDeviceChartAndUsers } from './InteractiveDeviceChartAndUsers';

interface DashboardViewProps {
  variables: TelemetryVariable[];
  activeAlerts: SafetyAlert[];
  currentSite: MiningSite;
  devices: SensorDevice[];
  activeTelemetryDeviceId?: string;
  onSelectTelemetryDevice?: (deviceId: string) => void;
  onNavigateTab: (tab: NavigationTab) => void;
  onSelectSensor: (sensorId: string) => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onResetPageLevels?: () => void;
  isAlarmActive?: boolean;
  onToggleAlarm?: () => void;
  isLightActive?: boolean;
  onToggleLight?: () => void;
  currentUser?: UserProfile | null;
  usersList?: UserProfile[];
  onChangeUserModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  variables,
  activeAlerts,
  currentSite,
  devices,
  activeTelemetryDeviceId,
  onSelectTelemetryDevice,
  onNavigateTab,
  onSelectSensor,
  onAcknowledgeAlert,
  onResetPageLevels,
  isAlarmActive,
  onToggleAlarm,
  isLightActive,
  onToggleLight,
  currentUser,
  usersList = [],
  onChangeUserModal,
}) => {
  const activeDevice = devices.find(d => d.id === activeTelemetryDeviceId) || devices[0];

  // Main 6 hero variables (matching reference image)
  const tempVar = variables.find(v => v.id === 'temp') || variables[0];
  const humVar = variables.find(v => v.id === 'hum') || variables[1];
  const co2Var = variables.find(v => v.id === 'co2') || variables[2];
  const luxVar = variables.find(v => v.id === 'lux') || variables[3];
  const kwhVar = variables.find(v => v.id === 'kwh') || variables[4];
  const airVar = variables.find(v => v.id === 'air_flow') || variables[5];

  // Helper for trend icons
  const renderTrendIcon = (trend: string) => {
    switch (trend) {
      case 'leve alza':
      case 'alza critica':
        return <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />;
      case 'leve caida':
        return <TrendingDown className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Minus className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Helper for status badge styling
  const getStatusBadge = (status: string, label: string) => {
    switch (status) {
      case 'critico':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            CRÍTICO: {label}
          </span>
        );
      case 'advertencia':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            ADVERTENCIA: {label}
          </span>
        );
      case 'desconectado':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
            SIN SEÑAL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            NORMAL · {label}
          </span>
        );
    }
  };

  const totalWorkers = currentSite.activeSectors.reduce((acc, s) => acc + s.activeWorkers, 0);
  const onlineDevicesCount = devices.filter(d => d.status !== 'desconectado').length;

  return (
    <div className="space-y-10 pb-16">
      
      {/* ==============================================================
          HERO & OPERATIONAL BANNER WITH METRIC CARDS (Direct from reference)
         ============================================================== */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 tech-grid-pattern p-6 sm:p-8 lg:p-10">
        <div className="tech-radial-glow absolute inset-0 pointer-events-none" />
        
        {/* Header Title & Subtitle */}
        <div className="relative z-10 max-w-3xl mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            Control Operacional en Tiempo Real · {currentSite.name}
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            MineSafe: Monitoreo IoT y Seguridad Minera
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
            Supervisión ambiental subterránea continua, control de gases críticos, ventilación de galerías y respuesta temprana ante incidentes.
          </p>
        </div>

        {/* Quick Operational Telemetry Summary */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
          <div>
            <span className="block text-slate-400">Personal en Turno:</span>
            <span className="text-sm font-semibold text-white tabular-nums">{totalWorkers} Operadores</span>
          </div>
          <div>
            <span className="block text-slate-400">Sensores IoT Activos:</span>
            <span className="text-sm font-semibold text-emerald-400 tabular-nums">{onlineDevicesCount} / {devices.length} Online</span>
          </div>
          <div>
            <span className="block text-slate-400">Profundidad Máxima:</span>
            <span className="text-sm font-semibold text-white tabular-nums">Nivel -510 metros</span>
          </div>
          <div>
            <span className="block text-slate-400">Alertas Activas:</span>
            <span className={`text-sm font-semibold tabular-nums ${activeAlerts.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {activeAlerts.length} Registradas
            </span>
          </div>
        </div>

        {/* ==============================================================
            MODERN DASHBOARD UI: BIENVENIDA, GRÁFICO CON SELECTOR DE DISPOSITIVO
            Y RECUADRO DE USUARIOS CON SCROLL
           ============================================================== */}
        <div className="relative z-10 mb-10">
          <InteractiveDeviceChartAndUsers
            currentUser={currentUser}
            usersList={usersList}
            devices={devices}
            activeDeviceId={activeTelemetryDeviceId || devices[0]?.id}
            onSelectDevice={(id) => onSelectTelemetryDevice?.(id)}
            onSelectUser={() => onNavigateTab('usuarios')}
            onChangeUserModal={onChangeUserModal}
            activeAlertCount={activeAlerts.length}
          />
        </div>

        {/* ==============================================================
            SECCIÓN DE ESTADO DEL GATEWAY (ESP32 Central de Enlace) - Req 2 & 1
           ============================================================== */}
        <ESP32GatewaySection
          devices={devices}
          activeDeviceId={activeTelemetryDeviceId || devices[0]?.id}
          onSelectDevice={(id) => onSelectTelemetryDevice?.(id)}
          onResetPageLevels={onResetPageLevels}
          isAlarmActive={isAlarmActive}
          onToggleAlarm={onToggleAlarm}
          isLightActive={isLightActive}
          onToggleLight={onToggleLight}
        />

        {/* ==============================================================
            VISUALIZACIÓN AMIGABLE VS. MEDICIÓN TÉCNICA (Sensores) - Req 3
           ============================================================== */}
        {activeDevice && (
          <DualReadingSensorCards device={activeDevice} />
        )}

        {/* ==============================================================
            THE 6 PRIMARY METRIC CARDS (Exact styling inspired by reference image)
           ============================================================== */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          
          {/* Card 1: TEMPERATURA AMBIENTE */}
          <div className="hero-card-gradient rounded-xl p-4 transition-all duration-200 flex flex-col justify-between min-h-[175px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider uppercase text-cyan-200/90 truncate">
                {tempVar.name}
              </span>
              <div className="w-7 h-7 rounded-lg bg-cyan-900/50 border border-cyan-700/60 flex items-center justify-center text-cyan-300">
                <Thermometer className="w-4 h-4 text-cyan-300" />
              </div>
            </div>
            
            <div className="my-2">
              <div className="text-3xl font-extrabold text-white tabular-nums tracking-tight">
                {tempVar.value} <span className="text-base font-semibold text-cyan-300">{tempVar.unit}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-cyan-200">
                {renderTrendIcon(tempVar.trend)}
                <span className="capitalize">{tempVar.trend}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-cyan-800/40 text-[10px] text-cyan-200/70 flex items-center justify-between">
              <span>Última act.: {tempVar.lastUpdateSeconds}s</span>
              <span className="text-emerald-400 font-medium">Estable</span>
            </div>
          </div>

          {/* Card 2: HUMEDAD RELATIVA */}
          <div className="hero-card-gradient rounded-xl p-4 transition-all duration-200 flex flex-col justify-between min-h-[175px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider uppercase text-cyan-200/90 truncate">
                {humVar.name}
              </span>
              <div className="w-7 h-7 rounded-lg bg-cyan-900/50 border border-cyan-700/60 flex items-center justify-center text-cyan-300">
                <Droplets className="w-4 h-4 text-cyan-300" />
              </div>
            </div>
            
            <div className="my-2">
              <div className="text-3xl font-extrabold text-white tabular-nums tracking-tight">
                {humVar.value} <span className="text-base font-semibold text-cyan-300">{humVar.unit}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-cyan-200">
                {renderTrendIcon(humVar.trend)}
                <span className="capitalize">{humVar.trend}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-cyan-800/40 text-[10px] text-cyan-200/70 flex items-center justify-between">
              <span>Última act.: {humVar.lastUpdateSeconds}s</span>
              <span className="text-emerald-400 font-medium">Normal</span>
            </div>
          </div>

          {/* Card 3: NIVEL DE CO2 / GASES */}
          <div className="hero-card-gradient rounded-xl p-4 transition-all duration-200 flex flex-col justify-between min-h-[175px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider uppercase text-cyan-200/90 truncate">
                {co2Var.name}
              </span>
              <div className="w-7 h-7 rounded-lg bg-cyan-900/50 border border-cyan-700/60 flex items-center justify-center text-cyan-300">
                <CloudRain className="w-4 h-4 text-cyan-300" />
              </div>
            </div>
            
            <div className="my-2">
              <div className="text-3xl font-extrabold text-white tabular-nums tracking-tight">
                {co2Var.value} <span className="text-base font-semibold text-cyan-300">{co2Var.unit}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-cyan-200">
                {renderTrendIcon(co2Var.trend)}
                <span className="capitalize">{co2Var.trend}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-cyan-800/40 text-[10px] text-cyan-200/70 flex items-center justify-between">
              <span>Última act.: {co2Var.lastUpdateSeconds}s</span>
              <span className="text-emerald-400 font-medium">Seguro</span>
            </div>
          </div>

          {/* Card 4: ILUMINACIÓN */}
          <div className="hero-card-gradient rounded-xl p-4 transition-all duration-200 flex flex-col justify-between min-h-[175px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider uppercase text-cyan-200/90 truncate">
                {luxVar.name}
              </span>
              <div className="w-7 h-7 rounded-lg bg-cyan-900/50 border border-cyan-700/60 flex items-center justify-center text-cyan-300">
                <Sun className="w-4 h-4 text-cyan-300" />
              </div>
            </div>
            
            <div className="my-2">
              <div className="text-3xl font-extrabold text-white tabular-nums tracking-tight">
                {luxVar.value} <span className="text-base font-semibold text-cyan-300">{luxVar.unit}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-cyan-200">
                {renderTrendIcon(luxVar.trend)}
                <span className="capitalize">{luxVar.trend}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-cyan-800/40 text-[10px] text-cyan-200/70 flex items-center justify-between">
              <span>Última act.: {luxVar.lastUpdateSeconds}s</span>
              <span className="text-emerald-400 font-medium">Adecuado</span>
            </div>
          </div>

          {/* Card 5: CONSUMO ENERGÉTICO (VENTILACIÓN) */}
          <div className="hero-card-gradient rounded-xl p-4 transition-all duration-200 flex flex-col justify-between min-h-[175px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider uppercase text-cyan-200/90 truncate">
                {kwhVar.name}
              </span>
              <div className="w-7 h-7 rounded-lg bg-cyan-900/50 border border-cyan-700/60 flex items-center justify-center text-cyan-300">
                <Zap className="w-4 h-4 text-cyan-300" />
              </div>
            </div>
            
            <div className="my-2">
              <div className="text-3xl font-extrabold text-white tabular-nums tracking-tight">
                {kwhVar.value} <span className="text-base font-semibold text-cyan-300">{kwhVar.unit}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-cyan-200">
                {renderTrendIcon(kwhVar.trend)}
                <span className="capitalize">{kwhVar.statusLabel}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-cyan-800/40 text-[10px] text-cyan-200/70 flex items-center justify-between">
              <span>Última act.: {kwhVar.lastUpdateSeconds}s</span>
              <span className="text-cyan-400 font-medium">Eficiente</span>
            </div>
          </div>

          {/* Card 6: FLUJO DE AIRE */}
          <div className="hero-card-gradient rounded-xl p-4 transition-all duration-200 flex flex-col justify-between min-h-[175px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider uppercase text-cyan-200/90 truncate">
                {airVar.name}
              </span>
              <div className="w-7 h-7 rounded-lg bg-cyan-900/50 border border-cyan-700/60 flex items-center justify-center text-cyan-300">
                <Wind className="w-4 h-4 text-cyan-300" />
              </div>
            </div>
            
            <div className="my-2">
              <div className="text-3xl font-extrabold text-white tabular-nums tracking-tight">
                {airVar.value} <span className="text-base font-semibold text-cyan-300">{airVar.unit}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-cyan-200">
                {renderTrendIcon(airVar.trend)}
                <span className="capitalize">{airVar.trend}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-cyan-800/40 text-[10px] text-cyan-200/70 flex items-center justify-between">
              <span>Última act.: {airVar.lastUpdateSeconds}s</span>
              <span className="text-emerald-400 font-medium">Circulación OK</span>
            </div>
          </div>

        </div>
      </section>

      {/* ==============================================================
          ACTIVE SAFETY ALERTS SECTION (Prioridad de Seguridad)
         ============================================================== */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${activeAlerts.length > 0 ? 'bg-amber-950 text-amber-400 border border-amber-800/80' : 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Incidencias y Alertas de Faena
                <span className="text-xs font-normal text-slate-400">({activeAlerts.length} activas)</span>
              </h2>
              <p className="text-xs text-slate-400">Supervisión continua con umbrales fijados según DS 132 de Seguridad Minera.</p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('alertas')}
            className="flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>Ver panel completo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeAlerts.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-sm bg-slate-950/40 rounded-lg border border-slate-800/60">
            <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            No existen alertas activas. Todas las variables ambientales y mecánicas se encuentran dentro de rangos seguros.
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeAlerts.slice(0, 3).map((alert) => (
              <div 
                key={alert.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getStatusBadge(alert.severity, alert.recordedValue)}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">{alert.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <span className="font-medium text-cyan-400">{alert.sectorName}</span> · Sensor: <span className="font-mono text-slate-300">{alert.sensorCode}</span> · Registrado: <span className="font-semibold text-rose-300">{alert.recordedValue}</span> (Límite: {alert.safeLimit}) · {alert.timestamp}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {!alert.acknowledged ? (
                    <button
                      onClick={() => onAcknowledgeAlert(alert.id)}
                      className="px-3 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors"
                    >
                      Reconocer
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      Reconocida
                    </span>
                  )}
                  <button
                    onClick={() => {
                      onSelectSensor(alert.sensorId);
                      onNavigateTab('monitoreo');
                    }}
                    className="p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                    title="Inspeccionar sensor"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ==============================================================
          THE 12 KEY CAPABILITIES GRID (Directly inspired by reference image)
         ============================================================== */}
      <section className="space-y-4">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="text-xs uppercase font-bold tracking-widest text-cyan-400">
            ARQUITECTURA DE CONTROL MINERO INTEGRADO
          </span>
          <h2 className="text-2xl font-extrabold text-white mt-1">
            Nuestras Capacidades Clave — Seguridad en Faena
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Ecosistema modular de prevención, telemetría IoT y optimización para faenas subterráneas y rajo abierto.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Monitoreo en Tiempo Real */}
          <div 
            onClick={() => onNavigateTab('monitoreo')}
            className="group cursor-pointer p-4 rounded-xl bg-slate-900/60 border border-cyan-900/30 hover:border-cyan-500/50 hover:bg-slate-900/90 transition-all duration-200 shadow-sm hover:shadow-cyan-950"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                <Eye className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                MONITOREO EN TIEMPO REAL
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Supervisión continua de temperatura, humedad, gases tóxicos y ventilación en socavones y chimeneas.
            </p>
          </div>

          {/* Card 2: Alertas Instantáneas */}
          <div 
            onClick={() => onNavigateTab('alertas')}
            className="group cursor-pointer p-4 rounded-xl bg-slate-900/60 border border-amber-900/30 hover:border-amber-500/50 hover:bg-slate-900/90 transition-all duration-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-950/80 border border-amber-700/60 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                ALERTAS INSTANTÁNEAS
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Notificaciones acústicas y visuales automáticas ante superación de umbrales críticos de gas y flujo.
            </p>
          </div>

          {/* Card 3: Análisis Predictivo */}
          <div 
            onClick={() => onNavigateTab('reportes')}
            className="group cursor-pointer p-4 rounded-xl bg-slate-900/60 border border-blue-900/30 hover:border-blue-500/50 hover:bg-slate-900/90 transition-all duration-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-950/80 border border-blue-700/60 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                ANÁLISIS PREDICTIVO
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Modelado de tendencias de acumulación de monóxido y calor para anticipar riesgos en galerías.
            </p>
          </div>

          {/* Card 4: Eficiencia Energética */}
          <div 
            onClick={() => onNavigateTab('monitoreo')}
            className="group cursor-pointer p-4 rounded-xl bg-slate-900/60 border border-emerald-900/30 hover:border-emerald-500/50 hover:bg-slate-900/90 transition-all duration-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                EFICIENCIA ENERGÉTICA
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Optimización de potencia en ventiladores axiales según presencia de personal y tronaduras activas.
            </p>
          </div>

          {/* Card 5: Automatización Inteligente */}
          <div 
            onClick={() => onNavigateTab('monitoreo')}
            className="group cursor-pointer p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/90 transition-all duration-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                AUTOMATIZACIÓN INTELIGENTE
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Activación autónoma de compuertas y mangas secundarias cuando el flujo de aire decae en el frente.
            </p>
          </div>

          {/* Card 6: Seguridad Avanzada */}
          <div 
            onClick={() => onNavigateTab('faenas')}
            className="group cursor-pointer p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/90 transition-all duration-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                SEGURIDAD AVANZADA
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Protocolos de evacuación con rutas guiadas, control de refugios mineros y monitoreo geomecánico.
            </p>
          </div>

          {/* Card 7: Informes Personalizados */}
          <div 
            onClick={() => onNavigateTab('reportes')}
            className="group cursor-pointer p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/90 transition-all duration-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                INFORMES PERSONALIZADOS
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Generación de bitácoras digitales auditables bajo norma Sernageomin y descarga directa en CSV/PDF.
            </p>
          </div>

          {/* Card 8: Gestión de Dispositivos y Arriendos */}
          <div 
            onClick={() => onNavigateTab('equipos')}
            className="group cursor-pointer p-4 rounded-xl bg-slate-900/60 border border-amber-900/30 hover:border-amber-500/50 hover:bg-slate-900/90 transition-all duration-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-950/80 border border-amber-700/60 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                GESTIÓN DE ARRIENDOS
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Supervisión de contratos de equipamiento IoT, cuotas de pago al día y estado de inventario arrendado.
            </p>
          </div>

          {/* Card 9: Facilidad de Integración IoT */}
          <div 
            onClick={() => onNavigateTab('equipos')}
            className="group cursor-pointer p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/90 transition-all duration-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform">
                <Radio className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                FACILIDAD DE INTEGRACIÓN
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Compatibilidad con redes LoRaWAN Subterráneas, LTE Privado, Modbus industrial y cable radiante.
            </p>
          </div>

          {/* Card 10: Mantenimiento Preventivo */}
          <div 
            onClick={() => onNavigateTab('equipos')}
            className="group cursor-pointer p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/90 transition-all duration-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform">
                <Wrench className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                MANTENIMIENTO PREVENTIVO
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Avisos tempranos de calibración de celdas electroquímicas y supervisión de batería remota.
            </p>
          </div>

          {/* Card 11: Asignación a Trabajadores */}
          <div 
            onClick={() => onNavigateTab('equipos')}
            className="group cursor-pointer p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/90 transition-all duration-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                ASIGNACIÓN A TRABAJADORES
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Asociación personal de detectores portátiles a operarios de perforación, cargadores y cuadrillas.
            </p>
          </div>

          {/* Card 12: Sostenibilidad Ambiental */}
          <div 
            onClick={() => onNavigateTab('reportes')}
            className="group cursor-pointer p-4 rounded-xl bg-slate-900/60 border border-emerald-900/30 hover:border-emerald-500/50 hover:bg-slate-900/90 transition-all duration-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <Wind className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                SOSTENIBILIDAD AMBIENTAL
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Monitoreo continuo de material particulado PM2.5/PM10 y minimización de huella energética.
            </p>
          </div>

        </div>
      </section>

      {/* ==============================================================
          ADDITIONAL GASES & CRITICAL METRICS ROW
         ============================================================== */}
      <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          Monitoreo Adicional de Atmósferas Explosivas y Ruido Subterráneo
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block">Metano (CH4)</span>
            <span className="text-xl font-bold text-white tabular-nums">1.2% LEL</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">Seguro (&lt; 5.0%)</span>
          </div>
          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block">Monóxido (CO)</span>
            <span className="text-xl font-bold text-white tabular-nums">9.4 ppm</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">Bajo (&lt; 25 ppm)</span>
          </div>
          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block">Polvo (PM2.5)</span>
            <span className="text-xl font-bold text-white tabular-nums">24 µg/m³</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">Norma cumplida</span>
          </div>
          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block">Presión Acústica</span>
            <span className="text-xl font-bold text-white tabular-nums">72 dB</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">Protección auditiva OK</span>
          </div>
        </div>
      </section>

    </div>
  );
};
