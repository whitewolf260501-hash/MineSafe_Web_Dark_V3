import React from 'react';
import { 
  Flame, 
  Wind, 
  Thermometer, 
  Droplets, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Activity,
  Gauge
} from 'lucide-react';
import { SensorDevice } from '../types';

interface DualReadingSensorCardsProps {
  device: SensorDevice;
}

export const DualReadingSensorCards: React.FC<DualReadingSensorCardsProps> = ({ device }) => {
  const faultSet = new Set(device?.faultFields || []);
  const coFault = faultSet.has('CO');
  const pmFault = faultSet.has('PM2_5');
  const tempFault = faultSet.has('temperatura');
  const humFault = faultSet.has('humedad');

  const coVal = !coFault
    ? (typeof device?.rawCO === 'number' ? device.rawCO : device.metrics.co)
    : undefined;
  const pmVal = !pmFault
    ? (typeof device?.rawPM25 === 'number' ? device.rawPM25 : device.metrics.polvoPM)
    : undefined;
  const tempVal = !tempFault
    ? (typeof device?.rawTemp === 'number' ? device.rawTemp : device.metrics.temperatura)
    : undefined;
  const humVal = !humFault
    ? (typeof device?.rawHum === 'number' ? device.rawHum : device.metrics.humedad)
    : undefined;

  const isOnline = Boolean(device?.gatewayOnline);

  // 1. Monóxido de Carbono / Gases (MQ-2) Evaluation
  let coStatusColor: 'verde' | 'amarillo' | 'rojo' = 'verde';
  let coFriendlyLabel = 'Aire Limpio / Seguro';

  if (coFault || coVal === undefined || !Number.isFinite(coVal)) {
    coStatusColor = 'amarillo';
    coFriendlyLabel = 'Falla de Sensor / Sin Lectura Válida';
  } else if (!isOnline) {
    if (coVal === 4095) {
      coStatusColor = 'amarillo';
      coFriendlyLabel = 'Sensor No Conectado (Pin Flotante 4095 ADC)';
    } else {
      coStatusColor = 'amarillo';
      coFriendlyLabel = 'Gateway Desconectado (En Espera de Señal)';
    }
  } else if (coVal === 4095) {
    coStatusColor = 'amarillo';
    coFriendlyLabel = 'Pin al Aire / Sensor Desconectado (4095 ADC)';
  } else if (coVal >= 1000) {
    coStatusColor = 'rojo';
    coFriendlyLabel = '¡PELIGRO: Nivel Crítico! (Baliza y Alarma activadas)';
  } else if (coVal >= 300) {
    coStatusColor = 'amarillo';
    coFriendlyLabel = 'Precaución: Presencia de gas';
  }

  // 2. Calidad de Aire / Polvo en suspensión (PM2.5) Evaluation
  let pmStatusColor: 'verde' | 'amarillo' | 'rojo' = 'verde';
  let pmFriendlyLabel = 'Baja densidad de partículas';

  if (pmFault || pmVal === undefined || !Number.isFinite(pmVal)) {
    pmStatusColor = 'amarillo';
    pmFriendlyLabel = 'Falla de Sensor / Sin Lectura Válida';
  } else if (!isOnline) {
    if (pmVal === 4095) {
      pmStatusColor = 'amarillo';
      pmFriendlyLabel = 'Sensor No Conectado (Pin Flotante 4095 ADC)';
    } else {
      pmStatusColor = 'amarillo';
      pmFriendlyLabel = 'Gateway Desconectado (Sin Transmisión)';
    }
  } else if (pmVal === 4095) {
    pmStatusColor = 'amarillo';
    pmFriendlyLabel = 'Pin al Aire / Sensor Desconectado (4095 ADC)';
  } else if (pmVal >= 500) {
    pmStatusColor = 'rojo';
    pmFriendlyLabel = '¡Atmósfera saturada / Peligro respiratorio!';
  } else if (pmVal >= 150) {
    pmStatusColor = 'amarillo';
    pmFriendlyLabel = 'Polvo moderado';
  }

  // 3. Confort Térmico (DHT11) Evaluation
  let thermalFriendlyLabel = 'Ambiente Agradable';
  let thermalStatusColor: 'verde' | 'amarillo' | 'rojo' = 'verde';

  if (tempFault || humFault || tempVal === undefined || humVal === undefined) {
    thermalFriendlyLabel = 'Falla Lectura DHT11 (null/NaN)';
    thermalStatusColor = 'amarillo';
  } else if (tempVal > 30) {
    thermalFriendlyLabel = 'Calor Excesivo';
    thermalStatusColor = 'rojo';
  } else if (tempVal < 10 && tempVal > 0) {
    thermalFriendlyLabel = 'Ambiente Frío';
    thermalStatusColor = 'amarillo';
  } else if (humVal < 25 && humVal > 0) {
    thermalFriendlyLabel = 'Ambiente Muy Seco';
    thermalStatusColor = 'amarillo';
  } else if (humVal > 80) {
    thermalFriendlyLabel = 'Humedad Saturada';
    thermalStatusColor = 'amarillo';
  }

  return (
    <div className="space-y-3 mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span>Monitoreo Atmosférico: Lectura Rápida &amp; Datos Técnicos</span>
          </h3>
          <p className="text-xs text-slate-400">
            Doble interpretación de sensores para operadores en terreno y supervisores de ventilación.
          </p>
        </div>
        <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950 px-2.5 py-1 rounded-lg border border-cyan-800">
          Dispositivo: {device.name}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* ==============================================================
            CARD 1: MONÓXIDO DE CARBONO / GASES (MQ-2)
           ============================================================== */}
        <div className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
          coStatusColor === 'verde'
            ? 'bg-gradient-to-br from-emerald-950/40 to-slate-900 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
            : coStatusColor === 'amarillo'
            ? 'bg-gradient-to-br from-amber-950/40 to-slate-900 border-amber-500/50 shadow-lg shadow-amber-950/20'
            : 'bg-gradient-to-br from-rose-950/70 to-slate-900 border-rose-500/80 shadow-xl shadow-rose-950/40 ring-1 ring-rose-50 animate-pulse'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                coStatusColor === 'verde' ? 'bg-emerald-900/60 text-emerald-300' :
                coStatusColor === 'amarillo' ? 'bg-amber-900/60 text-amber-300' :
                'bg-rose-900/80 text-rose-200'
              }`}>
                <Flame className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Monóxido / Gases (MQ-2)
              </span>
            </div>

            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
              coStatusColor === 'verde' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
              coStatusColor === 'amarillo' ? 'bg-amber-950 text-amber-300 border border-amber-700' :
              'bg-rose-950 text-rose-200 border border-rose-600 animate-bounce'
            }`}>
              {coStatusColor === 'verde' ? 'Verde' : coStatusColor === 'amarillo' ? 'Amarillo' : 'Rojo Crítico'}
            </span>
          </div>

          <div className="my-2">
            <div className={`text-lg sm:text-xl font-black tracking-tight leading-snug ${
              coStatusColor === 'verde' ? 'text-emerald-300' :
              coStatusColor === 'amarillo' ? 'text-amber-300' :
              'text-rose-200'
            }`}>
              {coFriendlyLabel}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px]">Dato Técnico:</span>
            <div className="text-right">
              <span className="font-mono font-bold text-white text-sm">
                {coFault || coVal === undefined ? 'Sin lectura válida (null/NaN)' : `Valor ADC: ${coVal}`}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                {coFault || coVal === undefined
                  ? 'Revisar cableado/ADC de MQ-2'
                  : 'Señal bruta 12-bit (0–4095) sin curva ppm'}
              </span>
            </div>
          </div>
        </div>

        {/* ==============================================================
            CARD 2: CALIDAD DE AIRE / POLVO EN SUSPENSIÓN (PM2.5)
           ============================================================== */}
        <div className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
          pmStatusColor === 'verde'
            ? 'bg-gradient-to-br from-emerald-950/40 to-slate-900 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
            : pmStatusColor === 'amarillo'
            ? 'bg-gradient-to-br from-amber-950/40 to-slate-900 border-amber-500/50 shadow-lg shadow-amber-950/20'
            : 'bg-gradient-to-br from-rose-950/70 to-slate-900 border-rose-500/80 shadow-xl shadow-rose-950/40 ring-1 ring-rose-500 animate-pulse'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                pmStatusColor === 'verde' ? 'bg-emerald-900/60 text-emerald-300' :
                pmStatusColor === 'amarillo' ? 'bg-amber-900/60 text-amber-300' :
                'bg-rose-900/80 text-rose-200'
              }`}>
                <Wind className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Polvo PM2.5 / Suspensión
              </span>
            </div>

            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
              pmStatusColor === 'verde' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
              pmStatusColor === 'amarillo' ? 'bg-amber-950 text-amber-300 border border-amber-700' :
              'bg-rose-950 text-rose-200 border border-rose-600 animate-bounce'
            }`}>
              {pmStatusColor === 'verde' ? 'Verde' : pmStatusColor === 'amarillo' ? 'Amarillo' : 'Rojo Crítico'}
            </span>
          </div>

          <div className="my-2">
            <div className={`text-lg sm:text-xl font-black tracking-tight leading-snug ${
              pmStatusColor === 'verde' ? 'text-emerald-300' :
              pmStatusColor === 'amarillo' ? 'text-amber-300' :
              'text-rose-200'
            }`}>
              {pmFriendlyLabel}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px]">Dato Técnico:</span>
            <div className="text-right">
              <span className="font-mono font-bold text-white text-sm">
                {pmFault || pmVal === undefined ? 'Sin lectura válida (null/NaN)' : `Lectura ADC 12-bit: ${pmVal}`}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                {pmFault || pmVal === undefined
                  ? 'Revisar sensor óptico de polvo'
                  : 'Señal óptica bruta (sin conversión µg/m³)'}
              </span>
            </div>
          </div>
        </div>

        {/* ==============================================================
            CARD 3: CONFORT TÉRMICO (DHT11)
           ============================================================== */}
        <div className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
          thermalStatusColor === 'verde'
            ? 'bg-gradient-to-br from-emerald-950/40 to-slate-900 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
            : thermalStatusColor === 'amarillo'
            ? 'bg-gradient-to-br from-amber-950/40 to-slate-900 border-amber-500/50 shadow-lg shadow-amber-950/20'
            : 'bg-gradient-to-br from-rose-950/70 to-slate-900 border-rose-500/80 shadow-xl shadow-rose-950/40 ring-1 ring-rose-500'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                thermalStatusColor === 'verde' ? 'bg-emerald-900/60 text-emerald-300' :
                thermalStatusColor === 'amarillo' ? 'bg-amber-900/60 text-amber-300' :
                'bg-rose-900/80 text-rose-200'
              }`}>
                <Thermometer className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Confort Térmico (DHT11)
              </span>
            </div>

            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
              thermalStatusColor === 'verde' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
              thermalStatusColor === 'amarillo' ? 'bg-amber-950 text-amber-300 border border-amber-700' :
              'bg-rose-950 text-rose-200 border border-rose-600'
            }`}>
              {thermalStatusColor === 'verde' ? 'Óptimo' : 'Revisión'}
            </span>
          </div>

          <div className="my-2">
            <div className={`text-lg sm:text-xl font-black tracking-tight leading-snug ${
              thermalStatusColor === 'verde' ? 'text-emerald-300' :
              thermalStatusColor === 'amarillo' ? 'text-amber-300' :
              'text-rose-200'
            }`}>
              {thermalFriendlyLabel}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px]">Dato Técnico:</span>
            <div className="text-right">
              <span className="font-mono font-bold text-white text-sm">
                {tempFault ? '--' : tempVal} °C y {humFault ? '--' : humVal} % Humedad
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                Sensor Digital DHT11
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
