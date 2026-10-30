import React, { useState } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Volume2, 
  Wind, 
  Radio, 
  CheckCircle, 
  X,
  PhoneCall,
  Flame,
  RotateCcw,
  Sliders,
  Play,
  StopCircle,
  Crown,
  Shield,
  Activity,
  FileText,
  CheckCircle2,
  Edit3
} from 'lucide-react';
import { soundAlert } from '../services/audioAlert';
import { UserProfile, DrillDebriefRecord } from '../types';

export type DrillType = 'gas_critico' | 'incendio_polvo' | 'evacuacion_sirena';

interface EmergencyModalProps {
  onClose: () => void;
  onConfirmEvacuation: () => void;
  currentUser?: UserProfile | null;
  onTriggerSimulationEmergency?: (type: DrillType) => void;
  isSimulatingDrill?: boolean;
  onStopDrill?: () => void;
  onSaveDrillDebrief?: (record: DrillDebriefRecord) => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  onClose,
  onConfirmEvacuation,
  currentUser,
  onTriggerSimulationEmergency,
  isSimulatingDrill = false,
  onStopDrill,
  onSaveDrillDebrief,
}) => {
  const isAdminOrSuper = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
  const [modalTab, setModalTab] = useState<'simulacro' | 'real'>(isAdminOrSuper ? 'simulacro' : 'real');
  const [protocolStep, setProtocolStep] = useState<'confirm' | 'broadcasting' | 'active'>('confirm');
  const [selectedProtocol, setSelectedProtocol] = useState<'total' | 'galeria_sur' | 'gases'>('total');
  const [selectedDrillType, setSelectedDrillType] = useState<DrillType>('gas_critico');

  // Debriefing / Cuadro de texto de cierre del simulacro
  const [showDrillDebrief, setShowDrillDebrief] = useState<boolean>(false);
  const [drillClassification, setDrillClassification] = useState<'simulacro_exitoso' | 'simulacro_con_observaciones' | 'falsa_alarma' | 'emergencia_real'>('simulacro_exitoso');
  const [drillNotes, setDrillNotes] = useState<string>('');
  const [drillActions, setDrillActions] = useState<string>('');
  const [debriefSupervisor, setDebriefSupervisor] = useState<string>(currentUser?.name || 'Supervisor de Faena');
  const [debriefSavedNotice, setDebriefSavedNotice] = useState<boolean>(false);


  const handleExecuteEvacuation = () => {
    setProtocolStep('broadcasting');
    soundAlert.playCriticalAlert();
    setTimeout(() => {
      setProtocolStep('active');
      onConfirmEvacuation();
    }, 1500);
  };

  const handleExecuteDrill = () => {
    if (onTriggerSimulationEmergency) {
      onTriggerSimulationEmergency(selectedDrillType);
      soundAlert.playCriticalAlert();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in">
      <div className="min-h-full flex items-center justify-center py-4">
        <div className="bg-slate-900 border border-rose-700/80 rounded-2xl max-w-lg w-full shadow-2xl shadow-rose-950/50 flex flex-col max-h-[min(90vh,760px)]">
          
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-rose-900/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                modalTab === 'simulacro'
                  ? 'bg-amber-950 text-amber-400 border-amber-700 animate-pulse'
                  : 'bg-rose-950 text-rose-400 border-rose-700 animate-pulse'
              }`}>
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  {modalTab === 'simulacro' ? 'Simulacro de Emergencia Minera' : 'Protocolo de Evacuación Real'}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    modalTab === 'simulacro'
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : 'bg-rose-950 text-rose-300 border-rose-800'
                  }`}>
                    DS 132
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  {modalTab === 'simulacro' 
                    ? 'Entrenamiento de seguridad y prueba de respuesta de sensores' 
                    : 'Activación de contingencia operacional de faena'}
                </p>
              </div>
            </div>

            <button onClick={onClose} aria-label="Cerrar modal" className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switch Tabs (Simulacro vs Real) */}
          <div className="px-5 sm:px-6 pt-3 shrink-0">
            <div className="flex items-center p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setModalTab('simulacro')}
                className={`flex-1 py-1.5 font-bold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                  modalTab === 'simulacro'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Simulacro (Admin / Prevención)</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('real')}
                className={`flex-1 py-1.5 font-bold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                  modalTab === 'real'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Emergencia Real de Faena</span>
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="p-5 sm:p-6 pt-4 overflow-y-auto space-y-5">

            {/* ==============================================================
                TAB: SIMULACRO DE EMERGENCIA (Para SuperAdmin / Admin)
               ============================================================== */}
            {modalTab === 'simulacro' && (
              <div className="space-y-4">
                
                {/* Status banner if drill is already active */}
                {isSimulatingDrill ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-amber-950/70 border border-amber-600/80 text-amber-200 space-y-2 animate-pulse">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
                        <span className="font-black text-sm uppercase text-white tracking-wide">
                          ¡Simulacro de Emergencia en Progreso!
                        </span>
                      </div>
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        El sistema está emitiendo lecturas críticas forzadas, sirenas de alerta y el banner de emergencia para entrenar la respuesta del personal minero según norma DS 132.
                      </p>
                    </div>

                    {!showDrillDebrief ? (
                      <div className="space-y-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowDrillDebrief(true);
                            soundAlert.playFeedbackBeep();
                          }}
                          className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          Finalizar Simulacro y Describir Resultado en Bitácora (DS 132)
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (onStopDrill) onStopDrill();
                            soundAlert.playFeedbackBeep();
                          }}
                          className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restablecer Faena Inmediatamente (Sin Bitácora)
                        </button>
                      </div>
                    ) : (
                      /* FORMULARIO DE EVALUACIÓN Y CUADRO DE TEXTO */
                      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-700 space-y-3.5 text-xs text-slate-200">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-cyan-400" />
                            Bitácora de Cierre del Simulacro
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                            Informe Técnico Sernageomin
                          </span>
                        </div>

                        {/* Clasificación */}
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                            1. Clasificación del Ejercicio:
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'simulacro_exitoso', label: 'Simulacro Exitoso', sub: 'Tiempos cumplidos sin novedades' },
                              { id: 'simulacro_con_observaciones', label: 'Con Observaciones', sub: 'Retardos o fallas de comunicación' },
                              { id: 'falsa_alarma', label: 'Falsa Alarma', sub: 'Activación accidental o no planificada' },
                              { id: 'emergencia_real', label: 'Emergencia Verdadera', sub: 'Peligro real constatado' },
                            ].map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setDrillClassification(c.id as any)}
                                className={`p-2 rounded-lg border text-left text-xs transition-colors ${
                                  drillClassification === c.id
                                    ? 'bg-cyan-950 text-cyan-200 border-cyan-500 font-bold ring-1 ring-cyan-500'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                <span className="block">{c.label}</span>
                                <span className="text-[9px] font-normal text-slate-500 block">{c.sub}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Cuadro de Texto de Descripción del Simulacro */}
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                            2. Descripción del Evento / Comportamiento de Cuadrillas: <span className="text-rose-400">*</span>
                          </label>
                          <textarea
                            value={drillNotes}
                            onChange={(e) => setDrillNotes(e.target.value)}
                            rows={3}
                            placeholder="Describa tiempos de evacuación registrados, respuesta del personal hacia refugios mineros, efectividad de ventilación forzada..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                          />
                        </div>

                        {/* Cuadro de Medidas Correctivas */}
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                            3. Medidas Correctivas / Mejoras Recomendadas:
                          </label>
                          <input
                            type="text"
                            value={drillActions}
                            onChange={(e) => setDrillActions(e.target.value)}
                            placeholder="Ej: Reprogramar entrenamiento de cuadrilla Bravo, sustitución de batería en sensor N°2..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                          />
                        </div>

                        {/* Supervisor */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <span>Supervisor responsable: <strong className="text-white">{debriefSupervisor}</strong></span>
                          <span>Fecha: {new Date().toLocaleDateString('es-CL')}</span>
                        </div>

                        {/* Botones de confirmación */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => setShowDrillDebrief(false)}
                            className="w-1/3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                          >
                            Volver
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (onSaveDrillDebrief) {
                                onSaveDrillDebrief({
                                  id: `DEBRIEF-${Date.now().toString().slice(-6)}`,
                                  drillType: selectedDrillType,
                                  classification: drillClassification,
                                  notes: drillNotes.trim() || 'Simulacro finalizado según protocolo de contingencia minera DS 132.',
                                  correctiveActions: drillActions.trim(),
                                  supervisorName: debriefSupervisor,
                                  timestamp: Date.now(),
                                });
                              }
                              if (onStopDrill) onStopDrill();
                              soundAlert.playFeedbackBeep();
                              setShowDrillDebrief(false);
                            }}
                            className="w-2/3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md shadow-emerald-950 flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Guardar Bitácora y Restablecer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="p-3.5 bg-amber-950/40 border border-amber-900/60 rounded-xl text-xs text-amber-200 leading-relaxed space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-amber-300">
                        {currentUser?.role === 'superadmin' ? (
                          <Crown className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Shield className="w-4 h-4 text-cyan-400" />
                        )}
                        <span>Autorización de Mando: {currentUser?.name || 'Administrador'}</span>
                      </div>
                      <p className="text-slate-300">
                        Esta función permite a SuperAdmins y Administradores de Faena simular incidentes críticos para verificar tiempos de evacuación, sirenas del ESP32 y conmutación de mangas de ventilación.
                      </p>
                      <div className="pt-1 flex items-center gap-2 text-[11px] font-bold text-emerald-300 bg-emerald-950/60 p-2 rounded-lg border border-emerald-800/80">
                        <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Actuadores Físicos: Se activan de forma automática la ALARMA (Buzzer) y la LUZ (Baliza LED) en el ESP32.</span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                        Seleccione Tipo de Incidente para el Simulacro:
                      </label>

                      {/* Option 1: Gas Spike */}
                      <div
                        onClick={() => setSelectedDrillType('gas_critico')}
                        className={`p-3 rounded-xl border cursor-pointer text-xs transition-all flex items-start gap-3 ${
                          selectedDrillType === 'gas_critico'
                            ? 'bg-amber-950/60 border-amber-500 ring-1 ring-amber-500 shadow-md'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-900/80 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                          <Flame className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs">Simulacro de Fuga de Monóxido de Carbono (CO)</span>
                            <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800">
                              MQ-2 &gt; 1200 ADC
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Fuerza niveles de gas tóxico sobre el límite crítico (DS 132). Activa sirena continua y alerta roja en consola.
                          </p>
                        </div>
                      </div>

                      {/* Option 2: Dust / Smoke Spike */}
                      <div
                        onClick={() => setSelectedDrillType('incendio_polvo')}
                        className={`p-3 rounded-xl border cursor-pointer text-xs transition-all flex items-start gap-3 ${
                          selectedDrillType === 'incendio_polvo'
                            ? 'bg-amber-950/60 border-amber-500 ring-1 ring-amber-500 shadow-md'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-900/80 text-red-300 flex items-center justify-center shrink-0 mt-0.5">
                          <Wind className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs">Simulacro de Incendio / Densidad de Humo y Polvo</span>
                            <span className="text-[10px] font-mono font-bold text-red-400 bg-red-950 px-1.5 py-0.5 rounded border border-red-800">
                              PM2.5 &gt; 500 µg/m³
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Simula principio de incendio en socavón con saturación extrema de material particulado y baliza estroboscópica.
                          </p>
                        </div>
                      </div>

                      {/* Option 3: General Evacuation Siren */}
                      <div
                        onClick={() => setSelectedDrillType('evacuacion_sirena')}
                        className={`p-3 rounded-xl border cursor-pointer text-xs transition-all flex items-start gap-3 ${
                          selectedDrillType === 'evacuacion_sirena'
                            ? 'bg-amber-950/60 border-amber-500 ring-1 ring-amber-500 shadow-md'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-900/80 text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                          <Volume2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs">Simulacro de Evacuación General Inmediata</span>
                            <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-950 px-1.5 py-0.5 rounded border border-purple-800">
                              Sirena + Baliza ESP32
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Dispara sirena de evacuación forzada en los detectores portátiles y commuta extractores al 100%.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteDrill}
                        className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-lg shadow-amber-950 transition-all flex items-center gap-2"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        INICIAR SIMULACRO CONTROLADO
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ==============================================================
                TAB: EMERGENCIA REAL DE FAENA
               ============================================================== */}
            {modalTab === 'real' && (
              <>
                {protocolStep === 'confirm' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs text-slate-200 leading-relaxed space-y-2">
                      <p className="font-semibold text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        ADVERTENCIA OPERACIONAL — EMERGENCIA REAL
                      </p>
                      <p>
                        Al confirmar esta acción se emitirá una alerta sonora de evacuación prioritaria en las radios de cuadrilla, se conmutarán los extractores de ventilación a régimen forzado y se notificará al Centro de Despacho de Rescate.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                        Alcance del Protocolo
                      </label>
                      
                      <div 
                        onClick={() => setSelectedProtocol('total')}
                        className={`p-3 rounded-lg border cursor-pointer text-xs transition-colors flex items-center justify-between ${
                          selectedProtocol === 'total' ? 'bg-rose-950/50 border-rose-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div>
                          <span className="font-bold block">Evacuación Total de Faena Subterránea</span>
                          <span className="text-[11px] text-slate-400">Todos los niveles hacia superficie y refugios mineros herméticos.</span>
                        </div>
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      </div>

                      <div 
                        onClick={() => setSelectedProtocol('galeria_sur')}
                        className={`p-3 rounded-lg border cursor-pointer text-xs transition-colors flex items-center justify-between ${
                          selectedProtocol === 'galeria_sur' ? 'bg-rose-950/50 border-rose-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div>
                          <span className="font-bold block">Repliegue Sectorial Galería 4-Sur</span>
                          <span className="text-[11px] text-slate-400">Aislamiento por emanación de gas CO/CO2 y confinamiento.</span>
                        </div>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                      <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleExecuteEvacuation}
                        className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-lg shadow-rose-950 transition-all flex items-center gap-2"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        CONFIRMAR Y ACTIVAR EVACUACIÓN
                      </button>
                    </div>
                  </div>
                )}

                {protocolStep === 'broadcasting' && (
                  <div className="py-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-rose-900/60 border border-rose-600 text-rose-300 flex items-center justify-center mx-auto animate-spin">
                      <Radio className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Transmitiendo Señal de Emergencia LoRa / LTE</h3>
                      <p className="text-xs text-slate-400 mt-1">Conmutando mangas de ventilación y encendiendo sirenas...</p>
                    </div>
                  </div>
                )}

                {protocolStep === 'active' && (
                  <div className="py-4 text-center space-y-4">
                    <div className="w-14 h-14 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-300 flex items-center justify-center mx-auto">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Alarma de Evacuación Difundida en Faena</h3>
                      <p className="text-xs text-slate-300 mt-1">
                        Todas las cuadrillas han recibido la orden de evacuación a sus detectores portátiles. La ventilación forzada está operando al 100%.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-left text-xs text-slate-300 space-y-1">
                      <span className="font-semibold text-cyan-400 block">Contactos de Soporte Minero:</span>
                      <div>· Central de Emergencia Mina: anexo #2222</div>
                      <div>· Rescate Sernageomin: 1404</div>
                    </div>

                    <button
                      onClick={onClose}
                      className="w-full py-2.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
                    >
                      Volver a la Consola de Monitoreo
                    </button>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
