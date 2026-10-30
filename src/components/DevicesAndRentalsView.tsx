import React, { useState } from 'react';
import { 
  Cpu, 
  Users, 
  FileText, 
  CreditCard, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  DollarSign, 
  Calendar, 
  UserCheck, 
  Battery, 
  Phone,
  Shield,
  Download,
  X
} from 'lucide-react';
import { DeviceRental, WorkerAssignment, SensorDevice } from '../types';
import { soundAlert } from '../services/audioAlert';

interface DevicesAndRentalsViewProps {
  rentals: DeviceRental[];
  assignments: WorkerAssignment[];
  devices: SensorDevice[];
  onAddAssignment: (assignment: Omit<WorkerAssignment, 'id'>) => void;
  onAddRentalContract: (contract: Omit<DeviceRental, 'id'>) => void;
  onRecordPayment: (contractId: string) => void;
}

export const DevicesAndRentalsView: React.FC<DevicesAndRentalsViewProps> = ({
  rentals,
  assignments,
  devices,
  onAddAssignment,
  onAddRentalContract,
  onRecordPayment,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'asignaciones' | 'arriendos' | 'pagos' | 'inventario'>('asignaciones');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showNewContractModal, setShowNewContractModal] = useState(false);

  // New assignment form state
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerRut, setNewWorkerRut] = useState('');
  const [newRole, setNewRole] = useState('Operador Subterráneo');
  const [newCrew, setNewCrew] = useState('Cuadrilla Alfa - Turno A');
  const [newSector, setNewSector] = useState('Socavón Norte Frente de Avance');
  const [newSelectedDeviceCode, setNewSelectedDeviceCode] = useState(devices[0]?.code || 'MS-GAS-101');
  const [newEmergencyContact, setNewEmergencyContact] = useState('+56 9 8765 4321');

  // New contract form state
  const [newContractNumber, setNewContractNumber] = useState('');
  const [newDeviceCode, setNewDeviceCode] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('Detector Portátil MultiGas 4-Canales');
  const [newProvider, setNewProvider] = useState('Dräger Safety Chile S.A.');
  const [newCostClp, setNewCostClp] = useState(195000);
  const [newEndDate, setNewEndDate] = useState('2026-12-31');

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerName || !newWorkerRut) return;

    const selectedDev = devices.find(d => d.code === newSelectedDeviceCode) || devices[0];

    onAddAssignment({
      workerName: newWorkerName,
      workerRut: newWorkerRut,
      role: newRole,
      crew: newCrew,
      sectorName: newSector,
      assignedDeviceId: selectedDev.id,
      assignedDeviceCode: selectedDev.code,
      assignmentDate: new Date().toISOString().split('T')[0],
      deviceBattery: selectedDev.batteryPct,
      emergencyContact: newEmergencyContact,
    });

    soundAlert.playFeedbackBeep();
    setShowAssignModal(false);
    setNewWorkerName('');
    setNewWorkerRut('');
  };

  const handleCreateContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContractNumber || !newDeviceCode) return;

    onAddRentalContract({
      contractNumber: newContractNumber,
      deviceCode: newDeviceCode,
      deviceType: newDeviceType,
      provider: newProvider,
      startDate: new Date().toISOString().split('T')[0],
      endDate: newEndDate,
      monthlyCostClp: Number(newCostClp),
      paymentStatus: 'al_dia',
      lastPaymentDate: new Date().toISOString().split('T')[0],
      nextDueDate: '2026-10-30',
      assignedTechnician: 'Gonzalo Vergara',
      notes: 'Contrato nuevo incorporado al sistema de control MineSafe.',
    });

    soundAlert.playFeedbackBeep();
    setShowNewContractModal(false);
    setNewContractNumber('');
    setNewDeviceCode('');
  };

  const formatClp = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
  };

  const getPaymentStatusBadge = (status: DeviceRental['paymentStatus']) => {
    switch (status) {
      case 'al_dia':
        return (
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
            Al Día
          </span>
        );
      case 'proximo_a_vencer':
        return (
          <span className="text-[11px] font-semibold text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
            Próximo a Vencer
          </span>
        );
      case 'pago_pendiente':
        return (
          <span className="text-[11px] font-semibold text-rose-300 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">
            Pago Pendiente
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
            Vencido
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              Equipos de Seguridad y Gestión de Arriendos
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Control de detectores personales asignados a cuadrillas, contratos de arriendo y pagos con proveedores.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeSubTab === 'asignaciones' && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva Asignación
              </button>
            )}

            {(activeSubTab === 'arriendos' || activeSubTab === 'pagos') && (
              <button
                onClick={() => setShowNewContractModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nuevo Contrato
              </button>
            )}
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-6 border-t border-slate-800/80 mt-6">
          <button
            onClick={() => setActiveSubTab('asignaciones')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSubTab === 'asignaciones'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Asignaciones a Cuadrillas ({assignments.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('arriendos')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSubTab === 'arriendos'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Contratos de Arriendo ({rentals.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('pagos')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSubTab === 'pagos'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Estado de Pagos y Facturas</span>
          </button>

          <button
            onClick={() => setActiveSubTab('inventario')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSubTab === 'inventario'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Stock de Sensores IoT ({devices.length})</span>
          </button>
        </div>
      </div>

      {/* ==============================================================
          SUBTAB 1: ASIGNACIONES A TRABAJADORES
         ============================================================== */}
      {activeSubTab === 'asignaciones' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignments.map((item) => (
              <div 
                key={item.id}
                className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center justify-center font-bold text-xs">
                      {item.workerName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{item.workerName}</h3>
                      <span className="text-[11px] font-mono text-slate-400">{item.workerRut}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                    {item.assignedDeviceCode}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rol / Cargo:</span>
                    <span className="font-medium text-white">{item.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cuadrilla:</span>
                    <span className="text-slate-200">{item.crew}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sector:</span>
                    <span className="text-cyan-400">{item.sectorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Batería Detector:</span>
                    <span className="font-mono text-emerald-400 font-bold flex items-center gap-1">
                      <Battery className="w-3.5 h-3.5" />
                      {item.deviceBattery}%
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" />
                    {item.emergencyContact}
                  </span>
                  <span>Asignado: {item.assignmentDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==============================================================
          SUBTAB 2: CONTRATOS DE ARRIENDO
         ============================================================== */}
      {activeSubTab === 'arriendos' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Contrato #</th>
                    <th className="px-4 py-3">Dispositivo</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Costo Mensual</th>
                    <th className="px-4 py-3">Vigencia</th>
                    <th className="px-4 py-3">Estado Pago</th>
                    <th className="px-4 py-3">Técnico Asignado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {rentals.map((rental) => (
                    <tr key={rental.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-cyan-300">{rental.contractNumber}</td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white">{rental.deviceCode}</div>
                        <div className="text-[11px] text-slate-400">{rental.deviceType}</div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-200">{rental.provider}</td>
                      <td className="px-4 py-3.5 font-mono font-semibold text-white">{formatClp(rental.monthlyCostClp)}</td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {rental.startDate} al {rental.endDate}
                      </td>
                      <td className="px-4 py-3.5">{getPaymentStatusBadge(rental.paymentStatus)}</td>
                      <td className="px-4 py-3.5 text-slate-300">{rental.assignedTechnician}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          SUBTAB 3: PAGOS Y FACTURACIÓN
         ============================================================== */}
      {activeSubTab === 'pagos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rentals.map((rental) => (
              <div 
                key={rental.id}
                className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-cyan-300">{rental.contractNumber}</span>
                    <h3 className="text-sm font-bold text-white mt-0.5">{rental.provider}</h3>
                  </div>
                  <div>{getPaymentStatusBadge(rental.paymentStatus)}</div>
                </div>

                <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Equipo Arrendado:</span>
                    <span className="font-medium text-white">{rental.deviceCode} ({rental.deviceType})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Canon Mensual:</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">{formatClp(rental.monthlyCostClp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Último Pago Registrado:</span>
                    <span className="text-slate-300 font-mono">{rental.lastPaymentDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Próximo Vencimiento:</span>
                    <span className="text-amber-400 font-mono font-semibold">{rental.nextDueDate}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 italic">"{rental.notes}"</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400">Técnico: {rental.assignedTechnician}</span>
                  {rental.paymentStatus !== 'al_dia' ? (
                    <button
                      onClick={() => onRecordPayment(rental.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                    >
                      Registrar Pago
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Cuota al día
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==============================================================
          SUBTAB 4: INVENTARIO DE SENSORES
         ============================================================== */}
      {activeSubTab === 'inventario' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Modelo & Nombre</th>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3">Asignado a</th>
                  <th className="px-4 py-3">Batería</th>
                  <th className="px-4 py-3">Señal LoRa</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {devices.map((device) => (
                  <tr key={device.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-cyan-300">{device.code}</td>
                    <td className="px-4 py-3.5 font-semibold text-white">{device.name}</td>
                    <td className="px-4 py-3.5 text-slate-300">{device.sectorName}</td>
                    <td className="px-4 py-3.5 text-slate-400">{device.assignedTo || 'Sin asignar'}</td>
                    <td className="px-4 py-3.5 font-mono tabular-nums">
                      <span className={device.batteryPct < 25 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                        {device.batteryPct}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 capitalize text-slate-300">{device.signalStrength}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        device.status === 'normal' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        device.status === 'advertencia' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        device.status === 'critico' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        'bg-slate-900 text-slate-400 border border-slate-700'
                      }`}>
                        {device.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA ASIGNACIÓN */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Asignar Sensor a Trabajador
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Nombre Completo del Operador</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Marcelo Castro R."
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">RUT Operador</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 16.782.341-9"
                  value={newWorkerRut}
                  onChange={(e) => setNewWorkerRut(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">Cargo / Rol</label>
                  <input
                    type="text"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Cuadrilla / Turno</label>
                  <input
                    type="text"
                    value={newCrew}
                    onChange={(e) => setNewCrew(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Sensor IoT a Entregar</label>
                <select
                  value={newSelectedDeviceCode}
                  onChange={(e) => setNewSelectedDeviceCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                >
                  {devices.map(d => (
                    <option key={d.id} value={d.code}>{d.code} - {d.name} ({d.batteryPct}% bat)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Contacto de Emergencia</label>
                <input
                  type="text"
                  value={newEmergencyContact}
                  onChange={(e) => setNewEmergencyContact(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold"
                >
                  Registrar Asignación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO CONTRATO DE ARRIENDO */}
      {showNewContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Registrar Contrato de Arriendo
              </h3>
              <button onClick={() => setShowNewContractModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Número de Contrato</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: ARR-2026-150"
                  value={newContractNumber}
                  onChange={(e) => setNewContractNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Código del Dispositivo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: MS-GAS-110"
                  value={newDeviceCode}
                  onChange={(e) => setNewDeviceCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Proveedor Autorizado</label>
                <select
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                >
                  <option value="Dräger Safety Chile S.A.">Dräger Safety Chile S.A.</option>
                  <option value="Honeywell Mining Solutions">Honeywell Mining Solutions</option>
                  <option value="SICK Chile Instrumentación">SICK Chile Instrumentación</option>
                  <option value="FLIR Systems Industrial">FLIR Systems Industrial</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">Costo Mensual (CLP)</label>
                  <input
                    type="number"
                    value={newCostClp}
                    onChange={(e) => setNewCostClp(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Término de Vigencia</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewContractModal(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold"
                >
                  Guardar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
