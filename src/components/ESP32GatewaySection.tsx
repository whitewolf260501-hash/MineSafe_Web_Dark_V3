import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Cpu, 
  ExternalLink, 
  Pause, 
  Play, 
  RefreshCw, 
  Activity, 
  Clock, 
  Server, 
  Settings, 
  CheckCircle2, 
  AlertTriangle,
  Radio,
  Sliders,
  Copy,
  Check,
  RotateCcw,
  BellRing,
  BellOff,
  Lightbulb,
  LightbulbOff,
  Sparkles,
  Zap,
  Volume2,
  VolumeX,
  Download,
  Lock
} from 'lucide-react';
import { SensorDevice } from '../types';
import { 
  sendESP32Command, 
  resetGatewayDataInRTDB, 
  toggleGatewayAlarmInRTDB, 
  toggleGatewayLightInRTDB 
} from '../services/firebase';
import { soundAlert } from '../services/audioAlert';

interface ESP32GatewaySectionProps {
  devices: SensorDevice[];
  activeDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
  onResetPageLevels?: () => void;
  isAlarmActive?: boolean;
  onToggleAlarm?: () => void;
  onShutdownAlarmCompletely?: () => void;
  isLightActive?: boolean;
  onToggleLight?: () => void;
  isSuperAdmin?: boolean;
}

export const ESP32GatewaySection: React.FC<ESP32GatewaySectionProps> = ({
  devices,
  activeDeviceId,
  onSelectDevice,
  onResetPageLevels,
  isAlarmActive = false,
  onToggleAlarm,
  onShutdownAlarmCompletely,
  isLightActive = false,
  onToggleLight,
  isSuperAdmin = false,
}) => {
  const [localIp, setLocalIp] = useState('192.168.4.1');
  const [isEditingIp, setIsEditingIp] = useState(false);
  const [acquisitionState, setAcquisitionState] = useState<'activo' | 'pausado'>('activo');
  const [copiedId, setCopiedId] = useState(false);
  const [isSimulatingHeartbeat, setIsSimulatingHeartbeat] = useState(false);
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isResettingGateway, setIsResettingGateway] = useState(false);

  // Update clock every second for live 15-second calculation
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Todos los dispositivos activos (Sensores y Gateways registrados)
  const currentDevice = devices.find(d => d.id === activeDeviceId) || devices[0];

  useEffect(() => {
    if (currentDevice?.localIp) {
      setLocalIp(currentDevice.localIp);
    }
  }, [currentDevice?.id, currentDevice?.localIp]);

  // 20 seconds rule calculation
  const serverTime = currentDevice?.lastUpdateServer || 0;
  const diffSeconds = serverTime > 0 ? Math.floor(Math.abs(nowTimestamp - serverTime) / 1000) : 999;

  // Connection status: live RTDB packet within 20 seconds or gatewayOnline flag
  const isOnline = Boolean(currentDevice?.gatewayOnline) || (serverTime > 0 && diffSeconds <= 20) || isSimulatingHeartbeat;

  // Format date and time
  const formatReportDate = (timestamp: number) => {
    if (!timestamp || timestamp <= 0) return 'Sin sincronización previa';
    const date = new Date(timestamp);
    return date.toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const showNotification = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => {
      setActionFeedback(null);
    }, 3500);
  };

  const handleToggleAcquisition = async (newState: 'activo' | 'pausado') => {
    setAcquisitionState(newState);
    soundAlert.playFeedbackBeep();
    if (currentDevice) {
      await sendESP32Command(currentDevice.id, newState === 'activo' ? 'resume' : 'pause');
      showNotification(`Adquisición ${newState === 'activo' ? 'reanudada' : 'pausada'} en el ESP32.`);
    }
  };

  const handleTriggerPing = async () => {
    soundAlert.playFeedbackBeep();
    setIsSimulatingHeartbeat(true);
    if (currentDevice) {
      await sendESP32Command(currentDevice.id, 'ping');
      showNotification('Latido enviado: Dispositivo marcado "En línea" por 15 segundos.');
    }
    setTimeout(() => {
      setIsSimulatingHeartbeat(false);
    }, 15000);
  };

  const handleCopyId = () => {
    if (currentDevice?.id) {
      navigator.clipboard.writeText(currentDevice.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const effectiveAlarmActive = Boolean(isAlarmActive || currentDevice?.alarmaActiva);

  // 1. Resetear niveles de la página
  const handleResetPageLevels = () => {
    if (effectiveAlarmActive && !isSuperAdmin) {
      showNotification('Acción bloqueada: Solo el SuperAdministrador puede apagar o resetear una alarma activa.');
      return;
    }
    soundAlert.playFeedbackBeep();
    onResetPageLevels?.();
    showNotification('Niveles de la página restablecidos a condiciones basales seguras (DS 132).');
  };

  // 2. Resetear datos del Gateway (Firebase RTDB)
  const handleResetGatewayData = async () => {
    if (!currentDevice) return;
    if (effectiveAlarmActive && !isSuperAdmin) {
      showNotification('Acción bloqueada: Solo el SuperAdministrador puede apagar la alarma y resetear el Gateway.');
      return;
    }
    setIsResettingGateway(true);
    soundAlert.playFeedbackBeep();
    try {
      await resetGatewayDataInRTDB(currentDevice.id);
      showNotification(`Datos del Gateway (${currentDevice.id}) reseteados en Firebase RTDB a valores basales limpios.`);
    } catch {
      showNotification('Error al resetear datos en Firebase.');
    } finally {
      setIsResettingGateway(false);
    }
  };

  // Descarga directa de registro_alarmas para el dispositivo seleccionado
  const handleDownloadDeviceAlarmCSV = () => {
    if (!currentDevice?.registroAlarmas) return;
    soundAlert.playFeedbackBeep();
    const headers = 'ID_Registro;Fecha;Hora;Origen;Gas_CO_ADC;PM25_ugm3;Temp_C;Hum_Porc;Via;Descripcion\n';
    const rows = Object.keys(currentDevice.registroAlarmas).map((k) => {
      const item = currentDevice.registroAlarmas![k];
      const desc = (item.descripcion || '').replace(/[\r\n;]/g, ' ');
      return `${k};${item.fecha || ''};${item.hora || ''};${item.origen || ''};${item.CO || 0};${item.PM2_5 || 0};${item.temperatura || 0};${item.humedad || 0};${item.via || 'WIFI_DIRECTO'};"${desc}"`;
    }).join('\n');

    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Alarmas_${currentDevice.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Historial de alarmas descargado en formato Excel / CSV para ${currentDevice.id}.`);
  };

  // 3. Encender alarma (cualquiera con acceso) o Apagar alarma completamente (SOLO SuperAdmin)
  const handleToggleAlarmClick = async () => {
    if (effectiveAlarmActive) {
      if (!isSuperAdmin) {
        showNotification('Acceso denegado: Solo el usuario SuperAdministrador puede apagar la alarma completamente.');
        return;
      }
      if (onShutdownAlarmCompletely) {
        onShutdownAlarmCompletely();
        showNotification('Alarma apagada completamente (sirena web, baliza y Firebase RTDB) por SuperAdmin.');
        return;
      }
    }
    if (onToggleAlarm) {
      onToggleAlarm();
    } else {
      const nextState = !effectiveAlarmActive;
      if (nextState) {
        soundAlert.setMuted(false);
        soundAlert.startContinuousAlarm();
      } else {
        soundAlert.stopContinuousAlarm();
      }
      if (currentDevice) {
        await toggleGatewayAlarmInRTDB(currentDevice.id, nextState);
      }
      showNotification(nextState ? '¡Alarma sonora y baliza ACTIVADAS!' : 'Alarma silenciada y desactivada.');
    }
  };

  // 4. Encender y apagar la luz
  const handleToggleLightClick = async () => {
    soundAlert.playFeedbackBeep();
    if (onToggleLight) {
      onToggleLight();
    } else {
      const nextState = !isLightActive;
      if (currentDevice) {
        await toggleGatewayLightInRTDB(currentDevice.id, nextState);
      }
      showNotification(nextState ? 'Luz / Baliza LED encendida en el nodo.' : 'Luz / Baliza LED apagada.');
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 mb-8 shadow-xl backdrop-blur-md relative overflow-hidden">
      
      {/* Decorative background glow */}
      <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
        isLightActive ? 'bg-amber-400/15' : isAlarmActive ? 'bg-red-500/20' : 'bg-cyan-500/5'
      }`} />

      {/* Action feedback toast */}
      {actionFeedback && (
        <div className="mb-4 p-3 bg-cyan-950/90 border border-cyan-500/60 text-cyan-200 rounded-xl text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button 
            onClick={() => setActionFeedback(null)} 
            className="text-cyan-400 hover:text-white text-[10px] font-bold"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Top Header: Gateway Central de Enlace */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center shadow-md shadow-cyan-950/50">
              <Cpu className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Estado del Gateway IoT (ESP32 Central de Enlace)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  ESP-WROOM-32
                </span>
                {isLightActive && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 animate-pulse flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" /> Luz ON
                  </span>
                )}
                {isAlarmActive && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white animate-bounce flex items-center gap-1">
                    <BellRing className="w-3 h-3" /> Sirena ON
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {devices.length === 1
                  ? 'Nodo único activo con sincronización en tiempo real hacia Firebase Realtime Database (agrega más sensores o gateways desde Control Maestro).'
                  : `${devices.length} dispositivos activos (sensores y gateways) sincronizados en tiempo real con Firebase Realtime Database.`}
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Registered Devices Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start lg:self-center">
          {devices.map((dev) => {
            const isSelected = currentDevice?.id === dev.id;
            const catLabel =
              dev.deviceCategory === 'gateway'
                ? 'Gateway'
                : dev.deviceCategory === 'sensor'
                ? 'Sensor'
                : 'Gateway + Sensor';
            return (
              <button
                key={dev.id}
                type="button"
                onClick={() => onSelectDevice(dev.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {dev.deviceCategory === 'gateway' ? (
                  <Server className="w-3.5 h-3.5" />
                ) : (
                  <Radio className="w-3.5 h-3.5" />
                )}
                <span className="truncate max-w-[190px]">{dev.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                  isSelected ? 'bg-black/25 text-cyan-100' : 'bg-slate-800 text-slate-400'
                }`}>
                  {catLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: 4 Core Gateway Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
        
        {/* 1. Connection Status (15 seconds rule) */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Estado de Conexión
            </span>
            {isOnline ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-rose-400" />
            )}
          </div>

          <div className="my-2.5">
            {isOnline ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider">En línea</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/60 text-rose-300 shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Desconectado</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
            <span>Ventana &lt; 15s:</span>
            <span className={`font-mono font-bold ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
              {diffSeconds < 999 ? `${diffSeconds} seg transcurridos` : 'Sin latido reciente'}
            </span>
          </div>
        </div>

        {/* 2. Device Identifier */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Identificador ESP32
            </span>
            <Server className="w-4 h-4 text-cyan-400" />
          </div>

          <div className="my-2">
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-mono font-extrabold text-white tracking-wide truncate">
                {currentDevice?.id || 'device_38A839E81F84'}
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
                title="Copiar ID del dispositivo"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <span className="text-[11px] text-cyan-400/90 font-medium block truncate">
              {currentDevice?.name}
            </span>
          </div>

          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-900 flex items-center justify-between">
            <span>Ruta RTDB:</span>
            <span className="font-mono text-slate-300">/dispositivos/{currentDevice?.id}</span>
          </div>
        </div>

        {/* 3. Last Report Timestamp */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Último Reporte
            </span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>

          <div className="my-2">
            <div className="text-xs sm:text-sm font-semibold text-slate-200">
              {formatReportDate(serverTime)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {diffSeconds < 60 
                ? `Sincronizado hace ${diffSeconds} segundos` 
                : `Último sync hace ${Math.floor(diffSeconds / 60)} min`}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-900 flex items-center justify-between">
            <span>Timestamp Server:</span>
            <span className="font-mono text-slate-300">{serverTime || 'N/A'}</span>
          </div>
        </div>

        {/* 4. Local WebServer Link & Acquisition Control */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              WebServer Local ESP32
            </span>
            <button
              type="button"
              onClick={() => setIsEditingIp(!isEditingIp)}
              className="text-slate-400 hover:text-cyan-300"
              title="Configurar IP local"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="my-2">
            {isEditingIp ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={localIp}
                  onChange={(e) => setLocalIp(e.target.value)}
                  placeholder="192.168.4.1"
                  className="w-full px-2 py-1 text-xs bg-slate-900 border border-cyan-700 rounded text-cyan-200 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsEditingIp(false)}
                  className="px-2 py-1 text-[10px] font-bold bg-cyan-600 text-white rounded"
                >
                  OK
                </button>
              </div>
            ) : (
              <a
                href={`http://${localIp}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 group"
              >
                <span>http://{localIp}</span>
                <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            )}

            <div className="mt-2 flex items-center gap-2">
              {acquisitionState === 'activo' ? (
                <button
                  type="button"
                  onClick={() => handleToggleAcquisition('pausado')}
                  className="flex-1 py-1 px-2 text-[11px] font-bold bg-amber-950/70 hover:bg-amber-900 border border-amber-800 text-amber-300 rounded flex items-center justify-center gap-1 transition-colors"
                >
                  <Pause className="w-3 h-3" />
                  <span>Pausar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleAcquisition('activo')}
                  className="flex-1 py-1 px-2 text-[11px] font-bold bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded flex items-center justify-center gap-1 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  <span>Reanudar</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleTriggerPing}
                className="py-1 px-2 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center justify-center gap-1 transition-colors"
                title="Forzar latido / ping en línea"
              >
                <RefreshCw className={`w-3 h-3 ${isSimulatingHeartbeat ? 'animate-spin text-cyan-400' : ''}`} />
                <span>Ping</span>
              </button>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-900 flex items-center justify-between">
            <span>Estado ESP32:</span>
            <span className={acquisitionState === 'activo' ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {acquisitionState === 'activo' ? 'Adquisición Activa' : 'Adquisición Pausada'}
            </span>
          </div>
        </div>

      </div>

      {/* Detalle en Vivo de Monitoreo emitido por el firmware del ESP32 */}
      {(currentDevice?.descripcionMonitoreo || currentDevice?.origenAlarma) && (
        <div className={`mt-4 p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
          currentDevice?.alarmaActiva || currentDevice?.status === 'critico'
            ? 'bg-rose-950/50 border-rose-800/80 text-rose-200'
            : currentDevice?.status === 'advertencia'
            ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
            : 'bg-slate-950/80 border-slate-800 text-slate-300'
        }`}>
          <div className="flex items-start gap-2.5">
            <Radio className={`w-4 h-4 shrink-0 mt-0.5 ${
              currentDevice?.alarmaActiva ? 'text-rose-400 animate-pulse' : 'text-cyan-400'
            }`} />
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-white">Telemetría de Firmware ESP32:</span>
                {currentDevice?.origenAlarma && currentDevice.origenAlarma !== 'NINGUNO' && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-900/90 text-rose-200 border border-rose-700">
                    {currentDevice.origenAlarma}
                  </span>
                )}
                {currentDevice?.fecha && currentDevice?.hora && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    [{currentDevice.fecha} {currentDevice.hora}]
                  </span>
                )}
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {currentDevice?.descripcionMonitoreo}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {currentDevice?.registroAlarmas && (
              <button
                type="button"
                onClick={handleDownloadDeviceAlarmCSV}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Descargar historial de alarmas de este nodo en Excel / CSV"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Auditoría CSV</span>
              </button>
            )}
            {currentDevice?.alarmaActiva && (
              <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-900/80 border border-rose-600 text-rose-100 font-bold text-[11px] animate-pulse">
                <BellRing className="w-3.5 h-3.5" />
                <span>SIRENA ACTIVA</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==============================================================
          PANEL DE COMANDOS RÁPIDOS IOT Y CONTROL DE FAENA
          (4 Botones Solicitados: Reset Página, Reset Gateway, Alarma, Luz)
         ============================================================== */}
      <div className="mt-5 pt-4 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Panel de Comandos Rápidos IoT y Control de Faena
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Dispositivo Objetivo: <span className="text-white font-bold">{currentDevice?.id}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Botón 1: Resetear Niveles de la Página */}
          <button
            type="button"
            onClick={handleResetPageLevels}
            className="p-3 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-800 text-left transition-all group flex items-center justify-between hover:border-cyan-500 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center justify-center group-hover:rotate-180 transition-transform duration-500">
                <RotateCcw className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Resetear Página</span>
                <span className="text-[10px] text-slate-400">Valores seguros DS 132</span>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          </button>

          {/* Botón 2: Resetear Datos del Gateway (Firebase RTDB) */}
          <button
            type="button"
            onClick={handleResetGatewayData}
            disabled={isResettingGateway}
            className="p-3 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-800 text-left transition-all group flex items-center justify-between hover:border-emerald-500 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center justify-center">
                <RefreshCw className={`w-4 h-4 text-emerald-400 ${isResettingGateway ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Resetear Gateway</span>
                <span className="text-[10px] text-slate-400">Limpiar RTDB a 45 ADC</span>
              </div>
            </div>
            <Server className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Botón 3: Activar / Apagar Completamente Alarma (Solo SuperAdmin puede apagarla) */}
          <button
            type="button"
            onClick={handleToggleAlarmClick}
            className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between shadow-md ${
              effectiveAlarmActive
                ? isSuperAdmin
                  ? 'border-rose-500 bg-rose-950/90 hover:bg-rose-900/80 text-rose-100 animate-pulse ring-1 ring-rose-400 cursor-pointer'
                  : 'border-rose-800 bg-rose-950/60 text-rose-200 cursor-not-allowed opacity-90'
                : 'border-slate-700 bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:border-rose-500/60 cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                effectiveAlarmActive ? 'bg-rose-900 text-rose-200 animate-bounce' : 'bg-slate-900 text-slate-400'
              }`}>
                {effectiveAlarmActive ? (
                  isSuperAdmin ? <BellRing className="w-4 h-4 text-rose-300" /> : <Lock className="w-4 h-4 text-amber-300" />
                ) : (
                  <BellOff className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold block text-white">
                  {effectiveAlarmActive
                    ? isSuperAdmin
                      ? 'Apagar Alarma Completamente'
                      : 'Alarma Activa (Bloqueada)'
                    : 'Activar Alarma'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {effectiveAlarmActive
                    ? isSuperAdmin
                      ? 'Silenciar sirena, luz y Firebase'
                      : 'Solo SuperAdmin puede apagarla'
                    : 'Encender sirena sonora y baliza'}
                </span>
              </div>
            </div>
            {effectiveAlarmActive ? (
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${
                isSuperAdmin
                  ? 'bg-rose-900 text-rose-100 border-rose-500'
                  : 'bg-amber-950 text-amber-200 border-amber-700'
              }`}>
                {isSuperAdmin ? 'APAGAR' : 'SOLO SA'}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-900 text-slate-400 border border-slate-700">
                OFF
              </span>
            )}
          </button>

          {/* Botón 4: Encender / Apagar Luz (Baliza / Foco LED ESP32) */}
          <button
            type="button"
            onClick={handleToggleLightClick}
            className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between shadow-md ${
              isLightActive
                ? 'border-amber-400 bg-amber-950/80 text-amber-200 ring-1 ring-amber-400 shadow-amber-950/50'
                : 'border-slate-700 bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:border-amber-500/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isLightActive ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/50' : 'bg-slate-900 text-slate-400'
              }`}>
                {isLightActive ? <Lightbulb className="w-4 h-4 text-slate-950" /> : <LightbulbOff className="w-4 h-4 text-slate-400" />}
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  {isLightActive ? 'Apagar Luz' : 'Encender Luz'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {isLightActive ? 'Foco LED encendido' : 'Iluminación apagada'}
                </span>
              </div>
            </div>
            {isLightActive ? (
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-400 text-slate-950 font-black">
                ON
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-900 text-slate-400 border border-slate-700">
                OFF
              </span>
            )}
          </button>

        </div>
      </div>

    </div>
  );
};
