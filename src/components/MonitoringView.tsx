import React, { useState } from 'react';
import { 
  Radio, 
  Search, 
  Filter, 
  Battery, 
  Wifi, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Layers, 
  Thermometer, 
  Wind, 
  Flame, 
  Droplets,
  Activity,
  Play,
  RotateCcw,
  User,
  Sliders,
  X
} from 'lucide-react';
import { SensorDevice, MiningSite, AlertSeverity } from '../types';
import { soundAlert } from '../services/audioAlert';

interface MonitoringViewProps {
  devices: SensorDevice[];
  currentSite: MiningSite;
  selectedSensorId: string | null;
  onSelectSensor: (sensorId: string | null) => void;
  onSimulateGasSpike: (sensorId: string) => void;
  onResetSensor: (sensorId: string) => void;
}

export const MonitoringView: React.FC<MonitoringViewProps> = ({
  devices,
  currentSite,
  selectedSensorId,
  onSelectSensor,
  onSimulateGasSpike,
  onResetSensor,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const selectedDevice = devices.find(d => d.id === selectedSensorId);

  // Available sectors from devices
  const availableSectors = Array.from(new Set(devices.map(d => d.sectorName))).filter(Boolean);

  // Filter devices
  const filteredDevices = devices.filter((device) => {
    const matchesSearch = 
      device.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (device.assignedTo && device.assignedTo.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSector = selectedSector === 'all' || device.sectorId === selectedSector || device.sectorName === selectedSector;
    const matchesStatus = selectedStatus === 'all' || device.status === selectedStatus;
    const matchesType = selectedType === 'all' || device.type === selectedType;

    return matchesSearch && matchesSector && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: AlertSeverity) => {
    switch (status) {
      case 'critico':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            CRÍTICO
          </span>
        );
      case 'advertencia':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            ADVERTENCIA
          </span>
        );
      case 'desconectado':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
            DESCONECTADO
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            NORMAL
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner and Filter Bar */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-cyan-400" />
              Monitoreo Telemetría IoT en Vivo
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Red de sensores de gas, ventilación y geomecánica en <span className="text-slate-200 font-medium">{currentSite.name}</span>.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono bg-emerald-950/70 border border-emerald-700/60 text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Base de Datos: minefase-fc5f5 (RTDB en tiempo real)</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Total dispositivos:</span>
            <span className="px-2.5 py-1 rounded bg-slate-800 text-white font-mono font-bold">
              {filteredDevices.length} / {devices.length}
            </span>
          </div>
        </div>

        {/* Filter controls row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por código, nombre u operador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Sector selector */}
          <div className="relative">
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">Todos los Sectores</option>
              {availableSectors.map((sectorName) => (
                <option key={sectorName} value={sectorName}>
                  {sectorName}
                </option>
              ))}
            </select>
          </div>

          {/* Status selector */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">Todos los Estados</option>
              <option value="normal">Normal (Operación Segura)</option>
              <option value="advertencia">Advertencia (Umbral Superado)</option>
              <option value="critico">Crítico (Peligro Inmediato)</option>
              <option value="desconectado">Desconectado / Sin Señal</option>
            </select>
          </div>

          {/* Device Type selector */}
          <div className="relative">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">Todos los Tipos de Sensor</option>
              <option value="multigas_portatil">Detector Portátil MultiGas</option>
              <option value="estacion_fija">Estación Fija de Galería</option>
              <option value="flujo_ventilacion">Anemómetro / Ventilación</option>
              <option value="sensor_geomecanico">Sensor Geomecánico</option>
              <option value="camara_termica">Cámara Térmica Infrarroja</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Sensors */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredDevices.map((device) => {
          const isSelected = selectedSensorId === device.id;
          return (
            <div
              key={device.id}
              onClick={() => {
                onSelectSensor(device.id);
                soundAlert.playFeedbackBeep();
              }}
              className={`cursor-pointer rounded-xl p-4 bg-slate-900/60 border transition-all duration-150 flex flex-col justify-between ${
                isSelected 
                  ? 'border-cyan-500 shadow-md shadow-cyan-950 bg-slate-900/90 ring-1 ring-cyan-500/50' 
                  : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
              }`}
            >
              <div>
                {/* Header: Code, Type & Status */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-800/60">
                      {device.code}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate max-w-[130px]">
                      {device.sectorName.split(' ')[0]}
                    </span>
                  </div>
                  <div>{getStatusBadge(device.status)}</div>
                </div>

                {/* Device Title */}
                <h3 className="text-sm font-semibold text-white mb-1 truncate">{device.name}</h3>

                {/* Operator Assigned */}
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-3">
                  <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{device.assignedTo || 'No asignado'}</span>
                </p>

                {/* Live Key Metrics Mini-Grid */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs mb-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Temp.</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {device.status === 'desconectado' ? '--' : `${device.metrics.temperatura}°C`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">CO (Gas)</span>
                    <span className={`font-mono font-bold tabular-nums ${device.metrics.co > 25 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {device.status === 'desconectado' ? '--' : `${device.metrics.co} ppm`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Ventilación</span>
                    <span className={`font-mono font-bold tabular-nums ${device.metrics.flujoAire < 0.5 ? 'text-amber-400' : 'text-slate-200'}`}>
                      {device.status === 'desconectado' ? '--' : `${device.metrics.flujoAire} m/s`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer: Battery, Signal & Last Ping */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Battery className={`w-3.5 h-3.5 ${device.batteryPct < 25 ? 'text-rose-400' : 'text-emerald-400'}`} />
                    <span className="tabular-nums">{device.batteryPct}%</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="capitalize">{device.signalStrength}</span>
                  </span>
                </div>
                <span>{device.lastPing}</span>
              </div>
            </div>
          );
        })}
      </div>

      {filteredDevices.length === 0 && (
        <div className="p-12 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-slate-400 text-sm">
          No se encontraron dispositivos que coincidan con los filtros aplicados.
        </div>
      )}

      {/* Sensor Detail Modal / Drawer */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                    {selectedDevice.code}
                  </span>
                  {getStatusBadge(selectedDevice.status)}
                </div>
                <h2 className="text-lg font-bold text-white">{selectedDevice.name}</h2>
                <p className="text-xs text-slate-400">
                  Ubicación: <span className="text-cyan-400 font-medium">{selectedDevice.sectorName}</span> · Asignado a: <span className="text-slate-200">{selectedDevice.assignedTo}</span>
                </p>
              </div>

              <button
                onClick={() => onSelectSensor(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Complete Environmental Metrics Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Temperatura</span>
                <span className="text-lg font-bold text-white font-mono tabular-nums">{selectedDevice.metrics.temperatura} °C</span>
                <span className="text-[10px] text-slate-400 block">Límite: &lt; 28.0 °C</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Humedad Relativa</span>
                <span className="text-lg font-bold text-white font-mono tabular-nums">{selectedDevice.metrics.humedad} %</span>
                <span className="text-[10px] text-slate-400 block">Rango: 30 - 75 %</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block">CO2 (Dióxido)</span>
                <span className="text-lg font-bold text-white font-mono tabular-nums">{selectedDevice.metrics.co2} ppm</span>
                <span className="text-[10px] text-slate-400 block">Límite: &lt; 1000 ppm</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block">CO (Monóxido)</span>
                <span className={`text-lg font-bold font-mono tabular-nums ${selectedDevice.metrics.co > 25 ? 'text-rose-400' : 'text-white'}`}>
                  {selectedDevice.metrics.co} ppm
                </span>
                <span className="text-[10px] text-slate-400 block">Límite: &lt; 25 ppm</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block">CH4 (Metano)</span>
                <span className="text-lg font-bold text-white font-mono tabular-nums">{selectedDevice.metrics.ch4} % LEL</span>
                <span className="text-[10px] text-slate-400 block">Límite: &lt; 5.0 %</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Oxígeno (O2)</span>
                <span className={`text-lg font-bold font-mono tabular-nums ${selectedDevice.metrics.o2 < 19.5 ? 'text-amber-400' : 'text-white'}`}>
                  {selectedDevice.metrics.o2} %
                </span>
                <span className="text-[10px] text-slate-400 block">Rango: 19.5 - 23.5 %</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Flujo de Aire</span>
                <span className="text-lg font-bold text-white font-mono tabular-nums">{selectedDevice.metrics.flujoAire} m/s</span>
                <span className="text-[10px] text-slate-400 block">Mínimo: &ge; 0.50 m/s</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Presión Sonora</span>
                <span className="text-lg font-bold text-white font-mono tabular-nums">{selectedDevice.metrics.ruido} dB</span>
                <span className="text-[10px] text-slate-400 block">Límite: 85 dB</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Polvo (PM2.5)</span>
                <span className="text-lg font-bold text-white font-mono tabular-nums">{selectedDevice.metrics.polvoPM} µg/m³</span>
                <span className="text-[10px] text-slate-400 block">Límite: 50 µg/m³</span>
              </div>
            </div>

            {/* Test Simulation Controls */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Simulador de Eventos de Seguridad (Testing de Telemetría)
              </h4>
              <p className="text-xs text-slate-400">
                Permite forzar condiciones ambientales anómalas en este dispositivo para validar la respuesta inmediata del sistema de alertas.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  onClick={() => onSimulateGasSpike(selectedDevice.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                >
                  <Flame className="w-3.5 h-3.5" />
                  Simular Alza de Monóxido (CO 52 ppm)
                </button>
                <button
                  onClick={() => onResetSensor(selectedDevice.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restablecer a Valores Nominales
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => onSelectSensor(null)}
                className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
              >
                Cerrar Detalle
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
