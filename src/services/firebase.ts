import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore 
} from 'firebase/firestore';
import { 
  getDatabase, 
  ref, 
  onValue, 
  set, 
  update, 
  get,
  Database 
} from 'firebase/database';
import { getAuth } from 'firebase/auth';

import firebaseConfig from '../../firebase-applet-config.json';
import { 
  SensorDevice, 
  UserProfile, 
  DeviceRental,
  UserRole,
  SafetyAlert,
  AlertResolutionDetails,
  DrillDebriefRecord
} from '../types';

export const USER_RTDB_URL = "https://minefase-fc5f5-default-rtdb.firebaseio.com/";

// Initialize Firebase App
const appConfig = {
  ...firebaseConfig,
  databaseURL: USER_RTDB_URL,
};

const app = !getApps().length ? initializeApp(appConfig) : getApp();

// Firebase Realtime Database connected to user's RTDB
export const rtdb: Database = getDatabase(app, USER_RTDB_URL);

// Firestore instance
export const db: Firestore = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

// Connection test for user's Realtime Database
export async function testConnection(): Promise<boolean> {
  try {
    const testRef = ref(rtdb, 'dispositivos');
    const snapshot = await get(testRef);
    return snapshot.exists();
  } catch (error) {
    console.warn('RTDB connection error:', error);
    return false;
  }
}

// -------------------------------------------------------------
// MAPPER UTILS FOR USER'S RTDB SCHEMA
// -------------------------------------------------------------
export function mapRTDBDeviceToSensorDevice(key: string, data: any): SensorDevice {
  const coVal = typeof data?.CO === 'number' ? data.CO : 12;
  const pmVal = typeof data?.PM2_5 === 'number' ? data.PM2_5 : 25;
  const tempVal = typeof data?.temperatura === 'number' ? data.temperatura : 22.4;
  const humVal = typeof data?.humedad === 'number' ? data.humedad : 48;
  const serverTime = Number(data?.last_update_server) || 0;

  // Connection check: under 15 seconds difference as requested
  const diffSeconds = serverTime > 0 ? Math.floor(Math.abs(Date.now() - serverTime) / 1000) : 999999;
  const isOnline = diffSeconds <= 15;

  // Determine status based on industrial safety thresholds:
  // If the device is offline (>15s without update), status is 'desconectado'
  // (Prevents disconnected pins / floating 4095 ADC from triggering false alarms)
  let status: 'normal' | 'advertencia' | 'critico' | 'desconectado' = 'normal';
  if (!isOnline) {
    status = 'desconectado';
  } else if (coVal >= 1000 || pmVal >= 500) {
    status = 'critico';
  } else if (coVal >= 300 || pmVal >= 150) {
    status = 'advertencia';
  }

  // Friendly sector and name mapping
  let deviceName = data?.name || key;
  let sectorName = 'Faena Central';
  let assigned = data?.userEmail ? 'Manuel Crisostomo' : 'Cuadrilla Operativa';

  if (key === 'device_38A839E81F84') {
    deviceName = 'Sensor Fase 1 (Chuquicamata - ESP32 Nodo A)';
    sectorName = 'Mina Chuquicamata - Rampa Principal';
    assigned = 'Manuel Crisostomo';
  } else if (key === 'device_A4CB2F124B00') {
    deviceName = 'Detector San José (Gateway ESP32 Nodo B)';
    sectorName = 'Mina San José - Nivel -400m';
    assigned = 'Gerardo Cuellar';
  } else if (key === 'NODO_U-01') {
    deviceName = 'Nodo Fijo Monitoreo U-01';
    sectorName = 'Socavón Norte Frente de Avance';
    assigned = 'Estación Automatizada';
  }

  return {
    id: key,
    code: key,
    name: deviceName,
    type: key.startsWith('NODO') ? 'estacion_fija' : 'multigas_portatil',
    sectorId: `sec-${key}`,
    sectorName: sectorName,
    batteryPct: key === 'device_38A839E81F84' ? 95 : 88,
    signalStrength: isOnline ? 'optima' : 'debil',
    lastPing: serverTime > 0 
      ? (diffSeconds < 60 ? `hace ${diffSeconds} seg` : `hace ${Math.floor(diffSeconds / 60)} min`)
      : 'en vivo (RTDB)',
    status: status,
    assignedTo: assigned,
    rawCO: coVal,
    rawPM25: pmVal,
    rawTemp: tempVal,
    rawHum: humVal,
    lastUpdateServer: serverTime,
    gatewayOnline: isOnline,
    metrics: {
      temperatura: Number(tempVal.toFixed(1)),
      humedad: Number(humVal.toFixed(0)),
      co2: 520,
      co: Number(coVal.toFixed(1)),
      ch4: 0.1,
      o2: 20.9,
      flujoAire: 1.25,
      ruido: 74,
      polvoPM: Number(pmVal.toFixed(0)),
    },
  };
}

export function mapRTDBUserToUserProfile(key: string, data: any): UserProfile {
  const isSuper = data?.isSuperUser === true || data?.email === 'manuelcrisostomovega@gmail.com';
  const isAdmin = isSuper || data?.isAdmin === true || data?.tipoUsuario === 'admin' || data?.cargo === 'Administrador' || data?.tipoUsuario === 'supervisor';

  let role: UserRole = 'operador';
  let roleLabel = 'Usuario Normal / Operador Minero';

  if (isSuper) {
    role = 'superadmin';
    roleLabel = 'Super Administrador de Seguridad Minera';
  } else if (isAdmin) {
    role = 'admin';
    roleLabel = 'Administrador / Prevencionista de Faena';
  }

  const assignedSector = data?.geoMina 
    || (data?.comuna ? `${data.comuna}, ${data.region || 'Chile'}` : 'Faena Minera');

  const assignedDev = data?.deviceId 
    || data?.dispositivo?.nombreDispositivo 
    || (key === 'manual_temp_uid_01' ? 'device_38A839E81F84' : '');

  return {
    id: key,
    name: data?.nombre || key,
    email: data?.email || `${key.toLowerCase().replace(/[^a-z0-9]/g, '')}@minesafe.cl`,
    role: role,
    roleLabel: roleLabel,
    rut: data?.codigoId || data?.telefono || '15.932.104-K',
    shift: data?.cargo || data?.tipoMina || 'Turno Continuo A',
    status: data?.isActive !== false ? 'activo' : 'inactivo',
    lastLogin: 'En línea (RTDB)',
    assignedSector: assignedSector,
    assignedDeviceCode: assignedDev,
  };
}

export function mapRTDBContractToRental(key: string, data: any): DeviceRental {
  const estadoGeneral = data?.estadoGeneral || data?.estadoArriendo || 'Activo';
  let paymentStatus: 'al_dia' | 'proximo_a_vencer' | 'pago_pendiente' | 'vencido' = 'al_dia';

  if (estadoGeneral === 'Por Vencer') {
    paymentStatus = 'proximo_a_vencer';
  } else if (estadoGeneral === 'Finalizado' || estadoGeneral === 'Vencido') {
    paymentStatus = 'vencido';
  } else if (data?.pagos_simulados?.some((p: any) => p.estadoPago === 'Pendiente' || p.estado === 'Pendiente')) {
    paymentStatus = 'pago_pendiente';
  }

  return {
    id: key,
    contractNumber: key,
    deviceCode: data?.deviceId || data?.idDispositivo || 'MS-IOT-REG',
    deviceType: 'Detector MultiGas Certificado DS 132',
    provider: data?.empresa || 'Dräger / MineSafe Mining Equipments',
    startDate: data?.fechaInicioArriendo || data?.fechaInicio || '2025-01-01',
    endDate: data?.fechaFinArriendo || data?.fechaFinContrato || data?.fechaTermino || '2026-12-31',
    monthlyCostClp: typeof data?.monto === 'number' ? data.monto : (typeof data?.monthlyCostClp === 'number' ? data.monthlyCostClp : 185000),
    paymentStatus: paymentStatus,
    lastPaymentDate: '2025-11-15',
    nextDueDate: data?.fechaFinArriendo || '2026-03-31',
    assignedTechnician: data?.tec || 'Ingeniería y Soporte MineSafe',
    notes: `Contrato sincronizado desde Realtime Database (${estadoGeneral}).`,
  };
}

// -------------------------------------------------------------
// REALTIME LISTENERS (RTDB)
// -------------------------------------------------------------
export function subscribeToRTDBDevices(callback: (devices: SensorDevice[]) => void): () => void {
  const devicesRef = ref(rtdb, 'dispositivos');
  const precargaRef = ref(rtdb, 'precarga/usuarios_contratos');

  let liveTelemetryMap: Record<string, any> = {};
  let precargaMap: Record<string, any> = {};

  const emitCombined = () => {
    const combined: SensorDevice[] = [];
    const seenCodes = new Set<string>();

    // 1. First add live telemetry devices (highest priority)
    Object.keys(liveTelemetryMap).forEach((key) => {
      const dev = mapRTDBDeviceToSensorDevice(key, liveTelemetryMap[key]);
      combined.push(dev);
      seenCodes.add(key);
    });

    // 2. Add devices registered in precarga (fleet inventory)
    Object.keys(precargaMap).forEach((userKey) => {
      const u = precargaMap[userKey];
      const disp = u?.dispositivo;
      if (disp && disp.idDispositivo && disp.idDispositivo !== 'N/A' && !seenCodes.has(disp.idDispositivo)) {
        seenCodes.add(disp.idDispositivo);
        combined.push({
          id: disp.idDispositivo,
          code: disp.idDispositivo,
          name: disp.nombreDispositivo || disp.idDispositivo,
          type: 'multigas_portatil',
          sectorId: `sec-${disp.idDispositivo}`,
          sectorName: 'Faena Mina Central',
          batteryPct: 85,
          signalStrength: 'optima',
          lastPing: disp.ultimaConexion || 'En flota',
          status: 'normal',
          assignedTo: u.nombre || 'Operador',
          metrics: {
            temperatura: 22.0,
            humedad: 45,
            co2: 450,
            co: 10.5,
            ch4: 0.1,
            o2: 20.9,
            flujoAire: 1.3,
            ruido: 70,
            polvoPM: 30,
          },
        });
      }
    });

    callback(combined);
  };

  const unsub1 = onValue(devicesRef, (snapshot) => {
    if (snapshot.exists()) {
      liveTelemetryMap = snapshot.val() || {};
      emitCombined();
    }
  });

  const unsub2 = onValue(precargaRef, (snapshot) => {
    if (snapshot.exists()) {
      precargaMap = snapshot.val() || {};
      emitCombined();
    }
  });

  return () => {
    unsub1();
    unsub2();
  };
}

export function subscribeToRTDBUsers(callback: (users: UserProfile[]) => void): () => void {
  const usersRef = ref(rtdb, 'usuarios');
  const precargaRef = ref(rtdb, 'precarga/usuarios_contratos');

  let directUsers: Record<string, any> = {};
  let precargaUsers: Record<string, any> = {};

  const emitCombined = () => {
    const list: UserProfile[] = [];
    const seenEmails = new Set<string>();

    // 1. Process direct usuarios (e.g. Manuel Crisostomo, PEPE LOTA, Gerardo Cuellar, usr001-020)
    Object.keys(directUsers).forEach((key) => {
      const u = mapRTDBUserToUserProfile(key, directUsers[key]);
      if (u.email) seenEmails.add(u.email.toLowerCase());
      list.push(u);
    });

    // 2. Process precarga usuarios
    Object.keys(precargaUsers).forEach((key) => {
      const pu = precargaUsers[key];
      const email = (pu?.email || '').toLowerCase();
      if (!seenEmails.has(email)) {
        if (email) seenEmails.add(email);
        list.push(mapRTDBUserToUserProfile(key, pu));
      }
    });

    // Sort with superadmin first, then admin, then operador
    list.sort((a, b) => {
      if (a.role === 'superadmin') return -1;
      if (b.role === 'superadmin') return 1;
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (b.role === 'admin' && a.role !== 'admin') return 1;
      return a.name.localeCompare(b.name);
    });

    callback(list);
  };

  const unsub1 = onValue(usersRef, (snapshot) => {
    if (snapshot.exists()) {
      directUsers = snapshot.val() || {};
      emitCombined();
    }
  });

  const unsub2 = onValue(precargaRef, (snapshot) => {
    if (snapshot.exists()) {
      precargaUsers = snapshot.val() || {};
      emitCombined();
    }
  });

  return () => {
    unsub1();
    unsub2();
  };
}

export function subscribeToRTDBRentals(callback: (rentals: DeviceRental[]) => void): () => void {
  const contractsRef = ref(rtdb, 'contratos');
  const precargaRef = ref(rtdb, 'precarga/usuarios_contratos');

  let directContracts: Record<string, any> = {};
  let precargaData: Record<string, any> = {};

  const emitCombined = () => {
    const list: DeviceRental[] = [];
    const seenContracts = new Set<string>();

    // 1. Direct contratos (CONTRATO-001 to 004)
    Object.keys(directContracts).forEach((key) => {
      const r = mapRTDBContractToRental(key, directContracts[key]);
      list.push(r);
      seenContracts.add(key);
    });

    // 2. Precarga arriendos (ARR-A001, ARR-U004, etc.)
    Object.keys(precargaData).forEach((userKey) => {
      const u = precargaData[userKey];
      const arr = u?.arriendo;
      if (arr && arr.idArriendo && !seenContracts.has(arr.idArriendo)) {
        seenContracts.add(arr.idArriendo);
        list.push({
          id: arr.idArriendo,
          contractNumber: arr.idArriendo,
          deviceCode: u?.dispositivo?.nombreDispositivo || u?.dispositivo?.idDispositivo || 'DS-FLEET',
          deviceType: 'Detector Portátil MultiGas Certificado DS 132',
          provider: u.empresa || 'MineSafe / Dräger Mining',
          startDate: arr.fechaInicioArriendo || '2025-01-01',
          endDate: arr.fechaTerminoArriendo || '2026-01-01',
          monthlyCostClp: 220000,
          paymentStatus: arr.estadoArriendo === 'Vigente' ? 'al_dia' : (arr.estadoArriendo === 'Vencido' ? 'vencido' : 'proximo_a_vencer'),
          lastPaymentDate: '2025-11-20',
          nextDueDate: arr.fechaTerminoArriendo || '2026-03-31',
          assignedTechnician: u.tec || 'Ingeniería MineSafe',
          notes: `Arriendo de ${u.nombre || 'Trabajador'} (${u.cargo || 'Operador'}).`,
        });
      }
    });

    callback(list);
  };

  const unsub1 = onValue(contractsRef, (snapshot) => {
    if (snapshot.exists()) {
      directContracts = snapshot.val() || {};
      emitCombined();
    }
  });

  const unsub2 = onValue(precargaRef, (snapshot) => {
    if (snapshot.exists()) {
      precargaData = snapshot.val() || {};
      emitCombined();
    }
  });

  return () => {
    unsub1();
    unsub2();
  };
}

// -------------------------------------------------------------
// WRITE OPERATIONS TO RTDB
// -------------------------------------------------------------
export async function updateDeviceInRTDB(
  deviceId: string, 
  data: { 
    CO?: number; 
    PM2_5?: number; 
    temperatura?: number; 
    humedad?: number;
    alarma?: boolean;
    buzzer?: boolean;
    luz?: boolean;
    iluminacion_led?: boolean;
    estado_adquisicion?: string;
  }
): Promise<void> {
  try {
    const devRef = ref(rtdb, `dispositivos/${deviceId}`);
    await update(devRef, {
      ...data,
      last_update_server: Date.now(),
    });
  } catch (err) {
    console.warn('Error updating device in RTDB:', err);
  }
}

export async function addUserToRTDB(user: UserProfile): Promise<void> {
  try {
    const userRef = ref(rtdb, `usuarios/${user.id}`);
    await set(userRef, {
      nombre: user.name,
      email: user.email,
      isAdmin: user.role === 'superadmin' || user.role === 'admin',
      isSuperUser: user.role === 'superadmin',
      tipoUsuario: user.role,
      isActive: user.status === 'activo',
      telefono: user.rut,
      geoMina: user.assignedSector || 'Mina Chuquicamata',
      deviceId: user.assignedDeviceCode || '',
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Error adding user to RTDB:', err);
  }
}

export async function updateUserInRTDB(userId: string, updates: Partial<UserProfile>): Promise<void> {
  try {
    const userRef = ref(rtdb, `usuarios/${userId}`);
    const rtdbUpdates: any = {
      updatedAt: new Date().toISOString(),
    };
    if (updates.name) rtdbUpdates.nombre = updates.name;
    if (updates.email) rtdbUpdates.email = updates.email;
    if (updates.role) {
      rtdbUpdates.tipoUsuario = updates.role;
      rtdbUpdates.isAdmin = updates.role === 'admin' || updates.role === 'superadmin';
      rtdbUpdates.isSuperUser = updates.role === 'superadmin';
    }
    if (updates.status) rtdbUpdates.isActive = updates.status === 'activo';
    if (updates.assignedSector) rtdbUpdates.geoMina = updates.assignedSector;
    if (updates.assignedDeviceCode) rtdbUpdates.deviceId = updates.assignedDeviceCode;

    await update(userRef, rtdbUpdates);
  } catch (err) {
    console.warn('Error updating user in RTDB:', err);
  }
}

export async function addRentalContractToRTDB(rental: DeviceRental): Promise<void> {
  try {
    const contractRef = ref(rtdb, `contratos/${rental.contractNumber}`);
    await set(contractRef, {
      deviceId: rental.deviceCode,
      estadoGeneral: rental.paymentStatus === 'al_dia' ? 'Activo' : 'Por Vencer',
      fechaInicioArriendo: rental.startDate,
      fechaFinArriendo: rental.endDate,
      fechaInicioContrato: rental.startDate,
      fechaFinContrato: rental.endDate,
    });
  } catch (err) {
    console.warn('Error adding contract to RTDB:', err);
  }
}

export async function recordPaymentInRTDB(contractId: string, amount: number): Promise<void> {
  try {
    const pagoId = `PAGO-${Date.now().toString().slice(-4)}`;
    const pagoRef = ref(rtdb, `pagos/${pagoId}`);
    await set(pagoRef, {
      idContrato: contractId,
      monto: amount,
      estado: 'Pagado',
      fechaPago: new Date().toISOString().split('T')[0],
      referencia: `REF-${pagoId}`,
    });
  } catch (err) {
    console.warn('Error recording payment in RTDB:', err);
  }
}

export async function sendESP32Command(deviceId: string, command: 'pause' | 'resume' | 'ping'): Promise<void> {
  try {
    const devRef = ref(rtdb, `dispositivos/${deviceId}`);
    const updates: any = {
      estado_adquisicion: command === 'pause' ? 'pausado' : 'activo',
    };
    if (command === 'ping') {
      updates.last_update_server = Date.now();
    }
    await update(devRef, updates);
  } catch (err) {
    console.warn('Error sending ESP32 command:', err);
  }
}

export async function resetGatewayDataInRTDB(deviceId?: string): Promise<void> {
  try {
    const now = Date.now();
    const resetPayload = {
      CO: 45, // safe clean air baseline
      PM2_5: 25, // safe low particle baseline
      temperatura: 21.5,
      humedad: 48,
      last_update_server: now,
      alarma: false,
      buzzer: false,
      luz: false,
      iluminacion_led: false,
      estado_adquisicion: 'activo',
      simulacro_activo: false,
    };

    // Update target device, Android primary device, and gateway in RTDB
    const devIds = Array.from(new Set([deviceId, 'device_38A839E81F84', 'device_A4CB2F124B00', 'gateway'].filter(Boolean)));
    for (const id of devIds) {
      const devRef = ref(rtdb, `dispositivos/${id}`);
      await update(devRef, resetPayload).catch(() => {});
    }

    // Reset root alert/drill indicators
    const rootRef = ref(rtdb);
    await update(rootRef, {
      alarma: false,
      buzzer: false,
      luz: false,
      simulacro: { activo: false, finalizado: true, timestamp: now },
      emergencia: { activa: false, timestamp: now }
    }).catch(() => {});
  } catch (err) {
    console.warn('Error resetting gateway in RTDB:', err);
  }
}

export async function toggleGatewayAlarmInRTDB(deviceId: string, active: boolean): Promise<void> {
  try {
    const now = Date.now();
    const payload = {
      alarma: active,
      buzzer: active,
      last_update_server: now,
    };

    const devIds = Array.from(new Set([deviceId, 'device_38A839E81F84', 'device_A4CB2F124B00', 'gateway'].filter(Boolean)));
    for (const id of devIds) {
      const devRef = ref(rtdb, `dispositivos/${id}`);
      await update(devRef, payload).catch(() => {});
    }

    // Update root level alarm for quick Android listeners
    const rootRef = ref(rtdb);
    await update(rootRef, {
      alarma: active,
      buzzer: active,
    }).catch(() => {});
  } catch (err) {
    console.warn('Error toggling alarm in RTDB:', err);
  }
}

export async function toggleGatewayLightInRTDB(deviceId: string, active: boolean): Promise<void> {
  try {
    const now = Date.now();
    const payload = {
      luz: active,
      iluminacion_led: active,
      last_update_server: now,
    };

    const devIds = Array.from(new Set([deviceId, 'device_38A839E81F84', 'device_A4CB2F124B00', 'gateway'].filter(Boolean)));
    for (const id of devIds) {
      const devRef = ref(rtdb, `dispositivos/${id}`);
      await update(devRef, payload).catch(() => {});
    }

    const rootRef = ref(rtdb);
    await update(rootRef, { luz: active }).catch(() => {});
  } catch (err) {
    console.warn('Error toggling light in RTDB:', err);
  }
}

// -------------------------------------------------------------
// BROADCAST DRILL AND ALERTS FOR ANDROID APP & HARDWARE SYNC
// -------------------------------------------------------------
export async function broadcastDrillToRTDB(
  active: boolean, 
  drillType: string | null = 'gas_critico',
  primaryDeviceId: string = 'device_38A839E81F84'
): Promise<void> {
  try {
    const now = Date.now();
    const devIds = Array.from(new Set([primaryDeviceId, 'device_38A839E81F84', 'device_A4CB2F124B00', 'gateway']));

    if (active) {
      const isGas = drillType === 'gas_critico';
      const isPolvo = drillType === 'incendio_polvo';

      const drillPayload = {
        CO: isGas ? 1250 : 45,
        PM2_5: isPolvo ? 650 : 25,
        temperatura: isGas ? 31.4 : 24.5,
        alarma: true,
        buzzer: true,
        luz: true,
        iluminacion_led: true,
        estado_adquisicion: 'simulacro',
        simulacro_activo: true,
        tipo_simulacro: drillType || 'gas_critico',
        last_update_server: now,
      };

      for (const id of devIds) {
        const devRef = ref(rtdb, `dispositivos/${id}`);
        await update(devRef, drillPayload).catch(() => {});
      }

      // Root level broadcast for Android and ESP32
      const rootRef = ref(rtdb);
      await update(rootRef, {
        alarma: true,
        buzzer: true,
        luz: true,
        simulacro: {
          activo: true,
          tipo: drillType || 'gas_critico',
          nombre: drillType === 'gas_critico' 
            ? 'Simulacro de Fuga de Monóxido de Carbono (DS 132)'
            : drillType === 'incendio_polvo'
            ? 'Simulacro de Incendio y Humo Denso (DS 132)'
            : 'Simulacro General de Evacuación Minera (DS 132)',
          iniciadoPor: 'Consola Central MineSafe',
          timestamp: now,
        },
        emergencia: {
          activa: true,
          esSimulacro: true,
          tipo: drillType || 'gas_critico',
          timestamp: now,
        }
      }).catch(() => {});
    } else {
      // Deactivate drill across all nodes
      await resetGatewayDataInRTDB(primaryDeviceId);
    }
  } catch (err) {
    console.warn('Error broadcasting drill to RTDB:', err);
  }
}

export async function broadcastAlertToRTDB(alert: SafetyAlert): Promise<void> {
  try {
    const now = Date.now();
    // 1. Store in RTDB /alertas
    const alertRef = ref(rtdb, `alertas/${alert.id}`);
    await set(alertRef, {
      id: alert.id,
      codigo: alert.code,
      titulo: alert.title,
      severidad: alert.severity,
      variable: alert.variableName,
      sensorId: alert.sensorId,
      sensorCode: alert.sensorCode,
      sector: alert.sectorName,
      valor: alert.recordedValue,
      limite: alert.safeLimit,
      atendida: alert.acknowledged,
      resuelta: alert.resolved,
      accionSugerida: alert.suggestedAction,
      timestamp: now,
    });

    // 2. If it's a critical alert, activate alarma and buzzer on RTDB devices so Android sounds siren
    if (alert.severity === 'critico') {
      const devIds = Array.from(new Set([alert.sensorId, 'device_38A839E81F84', 'gateway']));
      for (const id of devIds) {
        const devRef = ref(rtdb, `dispositivos/${id}`);
        await update(devRef, {
          alarma: true,
          buzzer: true,
          luz: true,
          last_update_server: now,
        }).catch(() => {});
      }
      const rootRef = ref(rtdb);
      await update(rootRef, {
        alarma: true,
        buzzer: true,
        luz: true,
        alerta_activa: {
          id: alert.id,
          titulo: alert.title,
          severidad: alert.severity,
          sensor: alert.sensorCode,
          timestamp: now,
        }
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Error broadcasting alert to RTDB:', err);
  }
}

export function subscribeToRTDBDrill(callback: (drillState: { active: boolean; type?: string; nombre?: string }) => void): () => void {
  const simulacroRef = ref(rtdb, 'simulacro');
  return onValue(simulacroRef, (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      callback({
        active: val?.activo === true,
        type: val?.tipo,
        nombre: val?.nombre,
      });
    }
  });
}

/**
 * Registra el cierre y clasificación de una alerta en Firebase RTDB
 * Guarda si fue una emergencia real, simulacro, falla de sensor o prueba operativa,
 * junto con la descripción y medidas adoptadas por el usuario/supervisor.
 */
export async function resolveAlertInRTDB(alertId: string, details: AlertResolutionDetails): Promise<void> {
  try {
    const alertRef = ref(rtdb, `alertas/${alertId}`);
    await update(alertRef, {
      resuelta: true,
      atendida: true,
      tipo_resolucion: details.resolutionType,
      descripcion_cierre: details.comment,
      acciones_correctivas: details.correctiveActions || '',
      resuelto_por: details.resolvedBy,
      resuelto_en: details.resolvedAt,
      timestamp_cierre: Date.now(),
    });

    // Guardar copia histórica en la bitácora de contingencias
    const bitacoraRef = ref(rtdb, `bitacora_contingencias/${alertId}`);
    await set(bitacoraRef, {
      idAlerta: alertId,
      tipoResolucion: details.resolutionType,
      descripcion: details.comment,
      accionesCorrectivas: details.correctiveActions || '',
      supervisor: details.resolvedBy,
      fecha: details.resolvedAt,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn('Error saving alert resolution to RTDB:', err);
  }
}

/**
 * Registra la bitácora de evaluación y observaciones de un simulacro finalizado
 */
export async function saveDrillDebriefInRTDB(record: DrillDebriefRecord): Promise<void> {
  try {
    const debriefRef = ref(rtdb, `simulacros_bitacora/${record.id}`);
    await set(debriefRef, {
      id: record.id,
      tipoSimulacro: record.drillType,
      clasificacion: record.classification,
      observaciones: record.notes,
      accionesCorrectivas: record.correctiveActions || '',
      supervisor: record.supervisorName,
      timestamp: record.timestamp,
    });
  } catch (err) {
    console.warn('Error saving drill debrief to RTDB:', err);
  }
}



