export type AlertSeverity = 'normal' | 'advertencia' | 'critico' | 'desconectado';

export interface TelemetryVariable {
  id: string;
  name: string;
  shortName: string;
  value: number;
  unit: string;
  trend: 'estable' | 'leve alza' | 'leve caida' | 'alza critica';
  status: AlertSeverity;
  statusLabel: string;
  thresholdMin?: number;
  thresholdMax?: number;
  lastUpdateSeconds: number;
  historical: { timestamp: string; value: number }[];
}

export interface SensorDevice {
  id: string;
  code: string;
  name: string;
  type: 'multigas_portatil' | 'estacion_fija' | 'flujo_ventilacion' | 'sensor_geomecanico' | 'camara_termica';
  sectorId: string;
  sectorName: string;
  batteryPct: number;
  signalStrength: 'optima' | 'media' | 'debil' | 'sin_conexion';
  lastPing: string;
  status: AlertSeverity;
  assignedTo?: string; // Operator name if assigned
  rawCO?: number;
  rawPM25?: number;
  rawTemp?: number;
  rawHum?: number;
  lastUpdateServer?: number;
  gatewayOnline?: boolean;
  metrics: {
    temperatura: number;
    humedad: number;
    co2: number;
    co: number;
    ch4: number;
    o2: number;
    flujoAire: number;
    ruido: number;
    polvoPM: number;
  };
}

export interface ESP32GatewayData {
  deviceId: string;
  name: string;
  co: number; // MQ-2 analog / PPM
  pm25: number; // PM2.5 analog / ug/m3
  temperature: number; // DHT11 °C
  humidity: number; // DHT11 %
  lastUpdateServer: number; // timestamp
  isOnline: boolean;
  secondsAgo: number;
  localIp: string;
  history?: { timestamp: number; co: number; pm25: number; temp: number; hum: number }[];
}

export interface MiningSector {
  id: string;
  name: string;
  code: string;
  depthMeters: number;
  type: 'socavon' | 'piquepal' | 'galeria_extraccion' | 'taller_mantencion' | 'chimenea_ventilacion';
  activeWorkers: number;
  sensorsCount: number;
  generalStatus: AlertSeverity;
  ventilationFanStatus: 'operativo_normal' | 'ventilacion_forzada' | 'en_mantencion' | 'detenido';
}

export interface MiningSite {
  id: string;
  name: string;
  company: string;
  location: string;
  region: string;
  type: 'subterranea' | 'rajo_abierto' | 'mixta';
  elevationMsl: number;
  activeSectors: MiningSector[];
}

export type AlertResolutionType = 
  | 'emergencia_real' 
  | 'simulacro' 
  | 'falsa_alarma_sensor' 
  | 'prueba_operativa';

export interface AlertResolutionDetails {
  resolutionType: AlertResolutionType;
  comment: string;
  correctiveActions?: string;
  resolvedBy: string;
  resolvedAt: string;
}

export interface DrillDebriefRecord {
  id: string;
  drillType: string;
  classification: 'simulacro_exitoso' | 'simulacro_con_observaciones' | 'falsa_alarma' | 'emergencia_real';
  notes: string;
  correctiveActions?: string;
  supervisorName: string;
  timestamp: number;
}

export interface SafetyAlert {
  id: string;
  code: string;
  title: string;
  severity: AlertSeverity;
  variableName: string;
  sensorId: string;
  sensorCode: string;
  sectorName: string;
  recordedValue: string;
  safeLimit: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  resolved: boolean;
  suggestedAction: string;
  resolutionDetails?: AlertResolutionDetails;
}


export interface DeviceRental {
  id: string;
  contractNumber: string;
  deviceCode: string;
  deviceType: string;
  provider: string;
  startDate: string;
  endDate: string;
  monthlyCostClp: number;
  paymentStatus: 'al_dia' | 'proximo_a_vencer' | 'pago_pendiente' | 'vencido';
  lastPaymentDate: string;
  nextDueDate: string;
  assignedTechnician: string;
  notes: string;
}

export interface WorkerAssignment {
  id: string;
  workerRut: string;
  workerName: string;
  role: string;
  crew: string; // e.g. "Cuadrilla Alfa - Turno A"
  sectorName: string;
  assignedDeviceId: string;
  assignedDeviceCode: string;
  assignmentDate: string;
  deviceBattery: number;
  emergencyContact: string;
}

export type UserRole = 'superadmin' | 'admin' | 'operador';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  rut: string;
  shift: string;
  avatarUrl?: string;
  status: 'activo' | 'inactivo';
  lastLogin?: string;
  assignedSector?: string;
  assignedDeviceCode?: string;
}

export type NavigationTab = 
  | 'dashboard'
  | 'monitoreo'
  | 'alertas'
  | 'ia'
  | 'equipos'
  | 'reportes'
  | 'faenas'
  | 'usuarios';

export type {
  Observation,
  AnalyzeRequest,
  AnalyzeResponse,
  MetricTrend,
  Anomaly,
  TrendDirection,
  HealthResponse
} from '../services/aiService';

