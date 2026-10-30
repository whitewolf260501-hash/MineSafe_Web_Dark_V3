import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Flame, 
  Cpu, 
  Wrench, 
  X, 
  CheckCircle2, 
  FileText,
  UserCheck,
  Clock
} from 'lucide-react';
import { SafetyAlert, AlertResolutionType, AlertResolutionDetails, UserProfile } from '../types';

interface AlertResolutionModalProps {
  alert: SafetyAlert | null;
  currentUser?: UserProfile | null;
  onClose: () => void;
  onConfirmResolution: (alertId: string, details: AlertResolutionDetails) => void;
}

export const AlertResolutionModal: React.FC<AlertResolutionModalProps> = ({
  alert,
  currentUser,
  onClose,
  onConfirmResolution,
}) => {
  const [resolutionType, setResolutionType] = useState<AlertResolutionType>('simulacro');
  const [comment, setComment] = useState('');
  const [correctiveActions, setCorrectiveActions] = useState('');
  const [supervisorName, setSupervisorName] = useState(currentUser?.name || 'Manuel Crisostomo');
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  if (!alert) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setErrorNotice('Debe ingresar una descripción de lo ocurrido para la bitácora de seguridad.');
      return;
    }

    const details: AlertResolutionDetails = {
      resolutionType,
      comment: comment.trim(),
      correctiveActions: correctiveActions.trim() || 'Verificación visual y restablecimiento de condición basal normal.',
      resolvedBy: supervisorName.trim() || 'Prevencionista de Turno',
      resolvedAt: new Date().toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    onConfirmResolution(alert.id, details);
    onClose();
  };

  const resolutionOptions: {
    id: AlertResolutionType;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    colorClasses: string;
    activeClasses: string;
  }[] = [
    {
      id: 'emergencia_real',
      label: 'Emergencia Real / Fuga Verdadera',
      sublabel: 'Riesgo inminente comprobado (emanación de gas, humo o polvo peligroso en socavón).',
      icon: <Flame className="w-5 h-5 text-rose-400" />,
      colorClasses: 'border-slate-800 hover:border-rose-700/60',
      activeClasses: 'border-rose-500 bg-rose-950/70 text-rose-100 ring-1 ring-rose-500',
    },
    {
      id: 'simulacro',
      label: 'Simulacro / Entrenamiento de Faena',
      sublabel: 'Ejercicio planificado o prueba de respuesta de evacuación según DS 132.',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      colorClasses: 'border-slate-800 hover:border-amber-700/60',
      activeClasses: 'border-amber-500 bg-amber-950/70 text-amber-100 ring-1 ring-amber-500',
    },
    {
      id: 'falsa_alarma_sensor',
      label: 'Falsa Alarma / Falla Técnica de Sensor',
      sublabel: 'Pin flotante (4095 ADC), desconexión de cable, ruido eléctrico o saturación momentánea.',
      icon: <Cpu className="w-5 h-5 text-cyan-400" />,
      colorClasses: 'border-slate-800 hover:border-cyan-700/60',
      activeClasses: 'border-cyan-500 bg-cyan-950/70 text-cyan-100 ring-1 ring-cyan-500',
    },
    {
      id: 'prueba_operativa',
      label: 'Prueba Operativa / Mantenimiento',
      sublabel: 'Inspección técnica programada, calibración en terreno o prueba de mangas de ventilación.',
      icon: <Wrench className="w-5 h-5 text-emerald-400" />,
      colorClasses: 'border-slate-800 hover:border-emerald-700/60',
      activeClasses: 'border-emerald-500 bg-emerald-950/70 text-emerald-100 ring-1 ring-emerald-500',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in flex items-center justify-center">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full shadow-2xl shadow-black/70 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Cierre y Clasificación de Alerta
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Bitácora DS 132
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Identifique la naturaleza del evento y describa lo sucedido para trazabilidad Sernageomin.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCROLLABLE FORM BODY */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4">
          
          {/* CONTEXTO DE LA ALERTA */}
          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>ID: <strong className="text-white font-mono">{alert.code}</strong></span>
              <span className="flex items-center gap-1 font-mono text-slate-400">
                <Clock className="w-3 h-3" />
                {alert.timestamp}
              </span>
            </div>
            <p className="font-bold text-white text-sm">{alert.title}</p>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-slate-300">
              <div>Sector: <span className="text-cyan-400 font-semibold">{alert.sectorName}</span></div>
              <div>Sensor: <span className="font-mono text-slate-300">{alert.sensorCode} ({alert.variableName})</span></div>
              <div>Lectura: <span className="text-rose-400 font-mono font-bold">{alert.recordedValue}</span></div>
              <div>Límite Seguro: <span className="text-emerald-400 font-mono">{alert.safeLimit}</span></div>
            </div>
          </div>

          {/* CLASIFICACIÓN DEL EVENTO */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              1. Clasificación del Evento (¿Fue verdadera, simulacro o falla?):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {resolutionOptions.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setResolutionType(opt.id)}
                  className={`p-3 rounded-xl border cursor-pointer text-xs transition-all flex items-start gap-2.5 ${
                    resolutionType === opt.id
                      ? opt.activeClasses
                      : `bg-slate-950 ${opt.colorClasses}`
                  }`}
                >
                  <div className="shrink-0 mt-0.5">{opt.icon}</div>
                  <div>
                    <span className="font-bold text-white block text-xs">{opt.label}</span>
                    <span className="text-[10px] text-slate-400 leading-snug block mt-0.5">{opt.sublabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CUADRO DE TEXTO 1: DESCRIPCIÓN DE LO OCURRIDO */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              2. Descripción del Suceso y Hallazgos en Faena: <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (errorNotice) setErrorNotice(null);
              }}
              rows={3}
              placeholder={
                resolutionType === 'emergencia_real'
                  ? 'Describa la magnitud de la fuga/incendio, cuadrillas evacuadas, concentración de gases medida...'
                  : resolutionType === 'simulacro'
                  ? 'Describa el objetivo del simulacro, tiempos de evacuación registrados y comportamiento de cuadrillas...'
                  : resolutionType === 'falsa_alarma_sensor'
                  ? 'Indique si fue pin flotante 4095 ADC, desprendimiento de conector o suciedad en cámara óptica...'
                  : 'Describa los trabajos de mantenimiento realizados y verificación de parámetros basales...'
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
            />
          </div>

          {/* CUADRO DE TEXTO 2: MEDIDAS ADOPTADAS Y PROTOCOLO */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              3. Medidas Adoptadas y Acciones Correctivas (Opcional):
            </label>
            <input
              type="text"
              value={correctiveActions}
              onChange={(e) => setCorrectiveActions(e.target.value)}
              placeholder="Ej: Se forzó ventilación por 20 min, verificación con detector multigas Dräger, sensor sustituido."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* FIRMA Y SUPERVISOR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Supervisor / Prevencionista a Cargo:
              </label>
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200">
                <UserCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <input
                  type="text"
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  className="bg-transparent focus:outline-none w-full text-xs font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Fecha y Hora de Cierre:
              </label>
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-400">
                <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                <span>En vivo (al guardar)</span>
              </div>
            </div>
          </div>

          {/* MENSAJE DE VALIDACIÓN */}
          {errorNotice && (
            <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorNotice}</span>
            </div>
          )}

          {/* FOOTER ACTIONS */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-950 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Guardar Bitácora y Dar por Resuelta
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
