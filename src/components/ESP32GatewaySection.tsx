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
  VolumeX
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
  isLightActive?: boolean;
  onToggleLight?: () => void;
}

export const ESP32GatewaySection: React.FC<ESP32GatewaySectionProps> = ({
  devices,
  activeDeviceId,
  onSelectDevice,
  onResetPageLevels,
  isAlarmActive = false,
  onToggleAlarm,
  isLightActive = false,
  onToggleLight,
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

  // Filter two main ESP32 devices
  const esp32Devices = devices.filter(
    d => d.id === 'device_A4CB2F124B00' || d.id === 'device_38A839E81F84' || d.id.startsWith('device_') || d.id.startsWith('NODO')
  );

  const currentDevice = devices.find(d => d.id === activeDeviceId) || esp32Devices[0] || devices[0];

  // 15 seconds rule calculation
  const serverTime = currentDevice?.lastUpdateServer || (currentDevice ? nowTimestamp - 6000 : 0);
  const diffSeconds = serverTime > 0 ? Math.floor(Math.abs(nowTimestamp - serverTime) / 1000) : 999;
  
  // Connection status: must be under 15 seconds
  const isOnline = diffSeconds <= 15 || isSimulatingHeartbeat;

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

  // 1. Resetear niveles de la página
  const handleResetPageLevels = () => {
    soundAlert.playFeedbackBeep();
    onResetPageLevels?.();
    showNotification('Niveles de la página restablecidos a condiciones basales seguras (DS 132).');
  };

  // 2. Resetear datos del Gateway (Firebase RTDB)
  const handleResetGatewayData = async () => {
    if (!currentDevice) return;
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

  // 3. Activar y desactivar la alarma
  const handleToggleAlarmClick = async () => {
    if (onToggleAlarm) {
      onToggleAlarm();
    } else {
      const nextState = !isAlarmActive;
      if (nextState) {
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
                Arquitectura de doble nodo con enlace RF/WiFi y sincronización a Firebase Realtime Database.
              </p>
            </div>
          </div>
        </div>

        {/* Dual Device Architecture Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start lg:self-center">
          <button
            type="button"
            onClick={() => onSelectDevice('device_A4CB2F124B00')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeDeviceId === 'device_A4CB2F124B00'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Dispositivo 1: 4B00 (San José)</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectDevice('device_38A839E81F84')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeDeviceId === 'device_38A839E81F84'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Dispositivo 2: 1F84 (Chuquicamata)</span>
          </button>

          {devices.some(d => d.id === 'NODO_U-01') && (
            <button
              type="button"
              onClick={() => onSelectDevice('NODO_U-01')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all hidden sm:flex items-center gap-1 ${
                activeDeviceId === 'NODO_U-01'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Nodo U-01</span>
            </button>
          )}
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
                {currentDevice?.id || 'device_A4CB2F124B00'}
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

          {/* Botón 3: Activar / Desactivar Alarma (Sirena Sonora y Baliza) */}
          <button
            type="button"
            onClick={handleToggleAlarmClick}
            className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between shadow-md ${
              isAlarmActive
                ? 'border-rose-500 bg-rose-950/80 text-rose-200 animate-pulse ring-1 ring-rose-400'
                : 'border-slate-700 bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:border-rose-500/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                isAlarmActive ? 'bg-rose-900 text-rose-200 animate-bounce' : 'bg-slate-900 text-slate-400'
              }`}>
                {isAlarmActive ? <BellRing className="w-4 h-4 text-rose-300" /> : <BellOff className="w-4 h-4 text-slate-400" />}
              </div>
              <div>
                <span className={`text-xs font-bold block ${isAlarmActive ? 'text-white' : 'text-white'}`}>
                  {isAlarmActive ? 'Desactivar Alarma' : 'Activar Alarma'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {isAlarmActive ? 'Sirena sonora activa' : 'Sirena / Baliza apagada'}
                </span>
              </div>
            </div>
            {isAlarmActive ? (
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-900 text-rose-100 border border-rose-600">
                ON
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
