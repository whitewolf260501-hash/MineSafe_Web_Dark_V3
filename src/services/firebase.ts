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
import { 
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';

import firebaseConfig from '../../firebase-applet-config.json';
import { 
  SensorDevice, 
  UserProfile, 
  DeviceRental,
  UserRole,
  SafetyAlert,
  AlertResolutionDetails,
  DrillDebriefRecord,
  DeviceThresholdsConfig,
  ThresholdVariableConfig,
  AlertEventRecord,
  AlarmAuditRecord,
  ControllableTab,
  NavigationTab,
  PlatformConfig,
  WindowOverrideValue,
  RegisteredDeviceConfig
} from '../types';

export const USER_RTDB_URL = "https://minefase-fc5f5-default-rtdb.firebaseio.com/";

const minefaseConfig = {
  apiKey: "AIzaSyA14qbuEIlTtln7A0U5xJCzFtj9jIxDHCg",
  authDomain: "minefase-fc5f5.firebaseapp.com",
  databaseURL: USER_RTDB_URL,
  projectId: "minefase-fc5f5",
  storageBucket: "minefase-fc5f5.firebasestorage.app",
  messagingSenderId: "766582128927",
  appId: "1:766582128927:web:1cf296e3c84874221bb02a",
  measurementId: "G-DP6YY8GJWE"
};

// Primary Firebase App connected to user's minefase-fc5f5 project (Auth + RTDB)
const minefaseApp = getApps().find((a) => a.name === 'minefase-primary')
  || initializeApp(minefaseConfig, 'minefase-primary');

// Default AI Studio Firestore app
const appletApp = getApps().find((a) => a.name === '[DEFAULT]')
  || initializeApp(firebaseConfig);

// Firebase Realtime Database & Auth connected strictly to minefase-fc5f5
export const rtdb: Database = getDatabase(minefaseApp, USER_RTDB_URL);
export const auth = getAuth(minefaseApp);

// Firestore instance
export const db: Firestore = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(appletApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(appletApp);

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
// Cache of local reception times per device node to safeguard against NTP clock skew
const lastPacketArrivalMap: Record<string, number> = {};

export function recordDevicePacketArrival(key: string) {
  lastPacketArrivalMap[key] = Date.now();
}

function readNumField(val: any, fallback: number): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string' && val.trim() !== '' && !Number.isNaN(Number(val))) return Number(val);
  return fallback;
}

export function mapRTDBDeviceToSensorDevice(key: string, data: any): SensorDevice {
  const coVal = data?.CO !== undefined ? readNumField(data.CO, 12) : readNumField(data?.co, 12);
  const pmVal = data?.PM2_5 !== undefined ? readNumField(data.PM2_5, 25) : readNumField(data?.pm25, 25);
  const tempVal = data?.temperatura !== undefined ? readNumField(data.temperatura, 22.4) : readNumField(data?.temp, 22.4);
  const humVal = data?.humedad !== undefined ? readNumField(data.humedad, 48) : readNumField(data?.hum, 48);

  const now = Date.now();
  const lastArrival = lastPacketArrivalMap[key] || 0;
  let serverTime = Number(data?.last_update_server) || Number(data?.timestamp_server) || 0;
  // 10 dígitos Unix epoch (>= año 2001) -> convertir a milisegundos
  if (serverTime >= 1000000000 && serverTime < 100000000000) {
    serverTime = serverTime * 1000;
  } else if (serverTime > 0 && serverTime < 1000000000) {
    // El firmware envió millis() de uptime (ej: 141983 ms) en vez de época Unix:
    // usar la hora real de llegada del paquete RTDB para evitar fechas de 1970.
    serverTime = lastArrival > 0 ? lastArrival : now;
  }

  // Connection check: under 20 seconds difference or recent WebSocket RTDB packet
  const diffSeconds = serverTime > 0 ? Math.floor(Math.abs(now - serverTime) / 1000) : 999999;
  const arrivalDiff = lastArrival > 0 ? Math.floor((now - lastArrival) / 1000) : 999999;

  const isOnline = diffSeconds <= 20 || arrivalDiff <= 20;

  const alarmaActiva = Boolean(data?.alarma_activa);
  const origenAlarma = data?.origen_alarma || '';
  const descripcionMonitoreo = data?.descripcion_monitoreo || '';

  // Determine status based on industrial safety thresholds:
  // If the device is offline (>20s without update), status is 'desconectado'
  let status: 'normal' | 'advertencia' | 'critico' | 'desconectado' = 'normal';
  if (!isOnline) {
    status = 'desconectado';
  } else if (alarmaActiva || coVal >= 500 || pmVal >= 150) {
    status = 'critico';
  } else if (coVal >= 350 || pmVal >= 55) {
    status = 'advertencia';
  }

  // Friendly sector and name mapping
  let deviceName = data?.name || key;
  let sectorName = data?.sectorName || 'Faena Central';
  let assigned = data?.userEmail ? 'Manuel Crisostomo' : 'Cuadrilla Operativa';

  if (key === 'device_38A839E81F84') {
    deviceName = data?.name || 'Nodo Sensor & Gateway Principal (1F84)';
    sectorName = data?.sectorName || 'Mina Chuquicamata - Rampa Principal';
    assigned = 'Manuel Crisostomo';
  } else if (key === 'device_A4CB2F124B00') {
    deviceName = data?.name || 'Detector San José (Gateway ESP32 Nodo B)';
    sectorName = data?.sectorName || 'Mina San José - Nivel -400m';
    assigned = 'Gerardo Cuellar';
  } else if (key === 'NODO_U-01') {
    deviceName = data?.name || 'Nodo Fijo Monitoreo U-01';
    sectorName = data?.sectorName || 'Socavón Norte Frente de Avance';
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
    alarmaActiva: alarmaActiva,
    origenAlarma: origenAlarma,
    descripcionMonitoreo: descripcionMonitoreo,
    fecha: data?.fecha || '',
    hora: data?.hora || '',
    via: data?.via || '',
    localIp: data?.localIp || undefined,
    deviceCategory: data?.deviceCategory || undefined,
    parentGatewayId: data?.parentGatewayId || undefined,
    registroAlarmas: data?.registro_alarmas,
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

export const PRIMARY_SUPERADMIN_EMAIL = 'manuelcrisostomovega@gmail.com';
export const PRIMARY_SUPERADMIN_UID = 'manual_temp_uid_01';
export const FIREBASE_PROJECT_ID = minefaseConfig.projectId;

export class FirebaseAuthActionError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

function mapFirebaseAuthError(err: any): FirebaseAuthActionError {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new FirebaseAuthActionError('Correo o contraseña incorrectos en Firebase Authentication. Acceso denegado.', code);
    case 'auth/invalid-email':
      return new FirebaseAuthActionError('El formato del correo electrónico no es válido.', code);
    case 'auth/user-disabled':
      return new FirebaseAuthActionError('Esta cuenta ha sido deshabilitada en Firebase Authentication.', code);
    case 'auth/too-many-requests':
      return new FirebaseAuthActionError('Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.', code);
    case 'auth/email-already-in-use':
      return new FirebaseAuthActionError('Este correo electrónico ya está registrado en Firebase Authentication.', code);
    case 'auth/weak-password':
      return new FirebaseAuthActionError('La contraseña debe tener al menos 6 caracteres.', code);
    case 'auth/operation-not-allowed':
      return new FirebaseAuthActionError(
        `El proveedor "Correo electrónico/contraseña" está desactivado en Firebase Console (proyecto ${FIREBASE_PROJECT_ID}). Actívalo en Authentication → Sign-in method para poder crear cuentas con correo y clave.`,
        code
      );
    case 'auth/unauthorized-domain':
      return new FirebaseAuthActionError(
        `El dominio actual (${typeof window !== 'undefined' ? window.location.hostname : 'actual'}) no está autorizado en Firebase Console (${FIREBASE_PROJECT_ID} → Authentication → Settings → Dominios autorizados).`,
        code
      );
    case 'auth/popup-closed-by-user':
      return new FirebaseAuthActionError('Se cerró la ventana emergente de Google antes de completar el acceso.', code);
    case 'auth/popup-blocked':
      return new FirebaseAuthActionError('El navegador bloqueó la ventana emergente de Google. Permite ventanas emergentes e intenta nuevamente.', code);
    case 'auth/network-request-failed':
      return new FirebaseAuthActionError('Error de red al conectar con Firebase Authentication. Verifica tu conexión a Internet.', code);
    default:
      return new FirebaseAuthActionError(err?.message || 'Error al autenticar con Firebase Authentication.', code || 'auth/unknown');
  }
}

export function mapRTDBUserToUserProfile(key: string, data: any): UserProfile {
  const emailLower = (data?.email || '').toLowerCase();
  const isCanonicalSuper =
    emailLower === PRIMARY_SUPERADMIN_EMAIL ||
    key === PRIMARY_SUPERADMIN_UID;
  const isSuper = isCanonicalSuper || data?.isSuperUser === true || data?.tipoUsuario === 'superadmin';
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
    lastLogin: 'En línea (Firebase Auth)',
    assignedSector: assignedSector,
    assignedDeviceCode: assignedDev,
  };
}

export async function resolveUserProfileFromAuthUser(fbUser: FirebaseUser): Promise<UserProfile> {
  const emailLower = (fbUser.email || '').trim().toLowerCase();

  // 1. Buscar directamente por UID en /usuarios/{uid}
  try {
    const byUidSnap = await get(ref(rtdb, `usuarios/${fbUser.uid}`));
    if (byUidSnap.exists()) {
      const profile = mapRTDBUserToUserProfile(fbUser.uid, byUidSnap.val());
      if (profile.status === 'inactivo') {
        await signOut(auth);
        throw new Error('Tu cuenta se encuentra desactivada por administración.');
      }
      return profile;
    }
  } catch (err: any) {
    if (err?.message?.includes('desactivada')) throw err;
  }

  // 2. Buscar por email en /usuarios y /precarga/usuarios_contratos
  try {
    const allUsersSnap = await get(ref(rtdb, 'usuarios'));
    if (allUsersSnap.exists()) {
      const allUsers = allUsersSnap.val() || {};
      const matchedKey = Object.keys(allUsers).find(
        (k) => (allUsers[k]?.email || '').trim().toLowerCase() === emailLower
      );
      if (matchedKey) {
        const profile = mapRTDBUserToUserProfile(matchedKey, allUsers[matchedKey]);
        if (profile.status === 'inactivo') {
          await signOut(auth);
          throw new Error('Tu cuenta se encuentra desactivada por administración.');
        }
        return profile;
      }
    }
  } catch (err: any) {
    if (err?.message?.includes('desactivada')) throw err;
  }

  // 3. Fallback si fue creado directamente en Firebase Auth Console sin nodo previo en RTDB
  const isCanonicalSuper = emailLower === PRIMARY_SUPERADMIN_EMAIL;
  return {
    id: isCanonicalSuper ? PRIMARY_SUPERADMIN_UID : fbUser.uid,
    name: fbUser.displayName || (isCanonicalSuper ? 'Manuel Crisostomo' : (emailLower.split('@')[0] || 'Operador')),
    email: fbUser.email || '',
    role: isCanonicalSuper ? 'superadmin' : 'operador',
    roleLabel: isCanonicalSuper ? 'Super Administrador de Seguridad Minera' : 'Usuario Normal / Operador de Faena',
    rut: 'No registrado',
    shift: 'Turno Continuo A',
    status: 'activo',
    lastLogin: 'En línea (Firebase Auth)',
    assignedSector: 'Mina Chuquicamata',
    assignedDeviceCode: isCanonicalSuper ? 'device_38A839E81F84' : '',
  };
}

export async function loginWithFirebaseAuth(
  email: string,
  password: string,
  rememberMe: boolean = true
): Promise<UserProfile> {
  const cleanEmail = email.trim();
  if (!cleanEmail || !password) {
    throw new Error('Debes ingresar tu correo electrónico y contraseña.');
  }

  try {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence).catch(() => {});
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return await resolveUserProfileFromAuthUser(credential.user);
  } catch (err: any) {
    throw mapFirebaseAuthError(err);
  }
}

export async function loginWithGoogleFirebaseAuth(rememberMe: boolean = true): Promise<UserProfile> {
  try {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence).catch(() => {});
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await signInWithPopup(auth, provider);
    const fbUser = credential.user;

    // Registrar ficha básica en RTDB si es la primera vez que ingresa por Google (solo si no es el SuperAdmin canónico con nodo manual_temp_uid_01)
    const byUidSnap = await get(ref(rtdb, `usuarios/${fbUser.uid}`)).catch(() => null);
    const isCanonicalSuper = (fbUser.email || '').trim().toLowerCase() === PRIMARY_SUPERADMIN_EMAIL;
    if ((!byUidSnap || !byUidSnap.exists()) && !isCanonicalSuper) {
      await set(ref(rtdb, `usuarios/${fbUser.uid}`), {
        nombre: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'Usuario'),
        email: fbUser.email || '',
        isAdmin: false,
        isSuperUser: false,
        tipoUsuario: 'operador',
        isActive: true,
        telefono: 'No registrado',
        cargo: 'Turno Continuo A',
        geoMina: 'Faena Minera Central',
        deviceId: '',
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    return await resolveUserProfileFromAuthUser(fbUser);
  } catch (err: any) {
    throw mapFirebaseAuthError(err);
  }
}

export async function registerWithFirebaseAuth(
  name: string,
  email: string,
  password: string,
  rut: string,
  shift: string
): Promise<UserProfile> {
  const cleanEmail = email.trim();
  const cleanName = name.trim();
  if (!cleanName || !cleanEmail || !password) {
    throw new FirebaseAuthActionError('Nombre, correo y contraseña (mínimo 6 caracteres) son obligatorios.', 'auth/invalid-input');
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    await updateProfile(credential.user, { displayName: cleanName }).catch(() => {});
    const uid = credential.user.uid;
    const isCanonicalSuper = cleanEmail.toLowerCase() === PRIMARY_SUPERADMIN_EMAIL;
    const safeRole: UserRole = isCanonicalSuper ? 'superadmin' : 'operador';

    const newUser: UserProfile = {
      id: isCanonicalSuper ? PRIMARY_SUPERADMIN_UID : uid,
      name: cleanName,
      email: cleanEmail,
      role: safeRole,
      roleLabel: isCanonicalSuper
        ? 'Super Administrador de Seguridad Minera'
        : 'Usuario Normal / Operador de Faena',
      rut: rut.trim() || 'No registrado',
      shift: shift.trim() || 'Turno Mañana',
      status: 'activo',
      lastLogin: 'En línea (Firebase Auth)',
      assignedSector: 'Faena Minera Central',
      assignedDeviceCode: isCanonicalSuper ? 'device_38A839E81F84' : '',
    };

    if (!isCanonicalSuper) {
      await set(ref(rtdb, `usuarios/${uid}`), {
        nombre: newUser.name,
        email: newUser.email,
        isAdmin: false,
        isSuperUser: false,
        tipoUsuario: 'operador',
        isActive: true,
        telefono: newUser.rut,
        cargo: newUser.shift,
        geoMina: newUser.assignedSector,
        deviceId: '',
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    return newUser;
  } catch (err: any) {
    throw mapFirebaseAuthError(err);
  }
}

export async function sendPasswordResetWithFirebase(email: string): Promise<void> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    throw new FirebaseAuthActionError('Ingresa tu correo electrónico registrado.', 'auth/invalid-input');
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err: any) {
    throw mapFirebaseAuthError(err);
  }
}

export async function logoutFromFirebaseAuth(): Promise<void> {
  await signOut(auth);
}

export function subscribeToFirebaseAuth(callback: (user: UserProfile | null) => void): () => void {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      callback(null);
      return;
    }
    try {
      const profile = await resolveUserProfileFromAuthUser(fbUser);
      callback(profile);
    } catch {
      callback(null);
    }
  });
}

/**
 * Verifica contra Firebase Authentication y la base de datos RTDB si el usuario autenticado
 * posee privilegios reales de SuperAdministrador.
 */
export async function verifySuperAdminPrivileges(actingUser?: UserProfile | null): Promise<boolean> {
  const fbUser = auth.currentUser;
  if (!fbUser) {
    return false;
  }

  const fbEmail = (fbUser.email || '').trim().toLowerCase();
  if (actingUser && actingUser.role !== 'superadmin') {
    return false;
  }

  try {
    const byUidSnap = await get(ref(rtdb, `usuarios/${fbUser.uid}`));
    if (byUidSnap.exists()) {
      const data = byUidSnap.val();
      if (data?.isActive === false) return false;
      if (data?.isSuperUser === true || data?.tipoUsuario === 'superadmin') {
        return true;
      }
    }

    const allUsersSnap = await get(ref(rtdb, 'usuarios'));
    if (allUsersSnap.exists()) {
      const allUsers = allUsersSnap.val() || {};
      const matchedKey = Object.keys(allUsers).find(
        (k) => (allUsers[k]?.email || '').trim().toLowerCase() === fbEmail
      );
      if (matchedKey) {
        const u = allUsers[matchedKey];
        if (u?.isActive === false) return false;
        if (u?.isSuperUser === true || u?.tipoUsuario === 'superadmin' || matchedKey === PRIMARY_SUPERADMIN_UID) {
          return true;
        }
        return false;
      }
    }
  } catch (err) {
    console.warn('Error verificando privilegios SuperAdmin en RTDB:', err);
  }

  return fbEmail === PRIMARY_SUPERADMIN_EMAIL;
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

  const unsub1 = onValue(devicesRef, (snapshot) => {
    if (snapshot.exists()) {
      const incoming = snapshot.val() || {};
      const combined: SensorDevice[] = [];
      Object.keys(incoming).forEach((key) => {
        recordDevicePacketArrival(key);
        combined.push(mapRTDBDeviceToSensorDevice(key, incoming[key]));
      });
      callback(combined);
    } else {
      callback([]);
    }
  });

  return () => {
    unsub1();
  };
}

export function extractAlarmAuditRecords(devices: SensorDevice[]): AlarmAuditRecord[] {
  const records: AlarmAuditRecord[] = [];

  devices.forEach((dev) => {
    if (dev.registroAlarmas && typeof dev.registroAlarmas === 'object') {
      Object.keys(dev.registroAlarmas).forEach((alarmKey) => {
        const item = dev.registroAlarmas![alarmKey];
        if (item) {
          records.push({
            id: alarmKey,
            deviceId: dev.id,
            deviceName: dev.name,
            fecha: item.fecha || dev.fecha || '11/11/2026',
            hora: item.hora || dev.hora || '00:00:00',
            origen: item.origen || item.origen_alarma || dev.origenAlarma || 'CAUSA_NATURAL_SENSORES',
            descripcion: item.descripcion || item.descripcion_monitoreo || dev.descripcionMonitoreo || 'Alarma registrada en nodo ESP32',
            co: typeof item.CO === 'number' ? item.CO : (typeof item.co === 'number' ? item.co : (dev.rawCO || 0)),
            pm25: typeof item.PM2_5 === 'number' ? item.PM2_5 : (typeof item.pm25 === 'number' ? item.pm25 : (dev.rawPM25 || 0)),
            temperatura: typeof item.temperatura === 'number' ? item.temperatura : (typeof item.temp === 'number' ? item.temp : (dev.rawTemp || 0)),
            humedad: typeof item.humedad === 'number' ? item.humedad : (typeof item.hum === 'number' ? item.hum : (dev.rawHum || 0)),
            via: item.via || 'WIFI_DIRECTO',
            timestampServer: item.timestamp_server || item.last_update_server || 0,
          });
        }
      });
    }
  });

  return records.sort((a, b) => {
    if (b.timestampServer && a.timestampServer) {
      return b.timestampServer - a.timestampServer;
    }
    return b.hora.localeCompare(a.hora);
  });
}

export function subscribeToRTDBAlarmRecords(callback: (records: AlarmAuditRecord[]) => void): () => void {
  const devicesRef = ref(rtdb, 'dispositivos');
  const unsub = onValue(devicesRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val() || {};
      const devList: SensorDevice[] = Object.keys(data).map(k => mapRTDBDeviceToSensorDevice(k, data[k]));
      const records = extractAlarmAuditRecords(devList);
      callback(records);
    } else {
      callback([]);
    }
  });
  return unsub;
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

    // Garantizar que solo exista un único SuperAdministrador en toda la plataforma
    const hasCanonicalSuper = list.some(
      (u) => u.id === PRIMARY_SUPERADMIN_UID || u.email.toLowerCase() === PRIMARY_SUPERADMIN_EMAIL
    );
    let superAssigned = false;
    const normalizedList = list.map((u) => {
      const isCanonical = u.id === PRIMARY_SUPERADMIN_UID || u.email.toLowerCase() === PRIMARY_SUPERADMIN_EMAIL;
      if (hasCanonicalSuper) {
        if (isCanonical) {
          superAssigned = true;
          return {
            ...u,
            role: 'superadmin' as UserRole,
            roleLabel: 'Super Administrador de Seguridad Minera',
          };
        }
        if (u.role === 'superadmin') {
          return {
            ...u,
            role: 'admin' as UserRole,
            roleLabel: 'Administrador / Prevencionista de Faena',
          };
        }
        return u;
      }

      if (u.role === 'superadmin') {
        if (!superAssigned) {
          superAssigned = true;
          return u;
        }
        return {
          ...u,
          role: 'admin' as UserRole,
          roleLabel: 'Administrador / Prevencionista de Faena',
        };
      }
      return u;
    });

    // Sort with superadmin first, then admin, then operador
    normalizedList.sort((a, b) => {
      if (a.role === 'superadmin') return -1;
      if (b.role === 'superadmin') return 1;
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (b.role === 'admin' && a.role !== 'admin') return 1;
      return a.name.localeCompare(b.name);
    });

    callback(normalizedList);
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
    // Regla de plataforma: Solo existe un único SuperAdmin; nuevos usuarios nunca pueden crearse como superadmin
    const isCanonicalSuper =
      user.id === PRIMARY_SUPERADMIN_UID || user.email.toLowerCase() === PRIMARY_SUPERADMIN_EMAIL;
    const safeRole: UserRole =
      user.role === 'superadmin' && !isCanonicalSuper ? 'admin' : user.role;

    const userRef = ref(rtdb, `usuarios/${user.id}`);
    await set(userRef, {
      nombre: user.name,
      email: user.email,
      isAdmin: safeRole === 'superadmin' || safeRole === 'admin',
      isSuperUser: safeRole === 'superadmin',
      tipoUsuario: safeRole,
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

export async function updateUserInRTDB(
  userId: string,
  updates: Partial<UserProfile>,
  actingUser?: UserProfile | null
): Promise<void> {
  try {
    if (actingUser && actingUser.role !== 'superadmin' && actingUser.role !== 'admin') {
      throw new Error('Permisos insuficientes para modificar usuarios.');
    }

    const userRef = ref(rtdb, `usuarios/${userId}`);
    const existingSnap = await get(userRef).catch(() => null);
    const existingData = existingSnap?.exists() ? existingSnap.val() : null;

    const existingEmail = (existingData?.email || updates.email || '').toLowerCase();
    const isTargetSuperAdmin =
      userId === PRIMARY_SUPERADMIN_UID ||
      existingEmail === PRIMARY_SUPERADMIN_EMAIL ||
      existingData?.isSuperUser === true ||
      existingData?.tipoUsuario === 'superadmin';

    // Protección absoluta: Nadie (ni un admin) puede quitarle permisos ni desactivar al único SuperAdmin
    if (isTargetSuperAdmin) {
      if ((updates.role && updates.role !== 'superadmin') || updates.status === 'inactivo') {
        throw new Error('Acción denegada: Un administrador no puede quitarle permisos ni desactivar al SuperAdministrador.');
      }
    }

    // Regla: Solo existe un SuperAdmin en toda la plataforma (no se puede promover a otro usuario a superadmin)
    if (updates.role === 'superadmin' && !isTargetSuperAdmin) {
      throw new Error('Acción denegada: Solo puede existir un único SuperAdministrador en toda la plataforma.');
    }

    const rtdbUpdates: any = {
      updatedAt: new Date().toISOString(),
    };
    if (updates.name) rtdbUpdates.nombre = updates.name;
    if (updates.email) rtdbUpdates.email = updates.email;
    if (updates.rut) rtdbUpdates.codigoId = updates.rut;
    if (updates.role) {
      rtdbUpdates.tipoUsuario = updates.role;
      rtdbUpdates.isAdmin = updates.role === 'admin' || updates.role === 'superadmin';
      rtdbUpdates.isSuperUser = updates.role === 'superadmin';
    }
    if (updates.status) rtdbUpdates.isActive = updates.status === 'activo';
    if (updates.assignedSector) rtdbUpdates.geoMina = updates.assignedSector;
    if (updates.assignedDeviceCode !== undefined) rtdbUpdates.deviceId = updates.assignedDeviceCode;

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

async function ensureValidDevicePayload(
  deviceId: string,
  payload: Record<string, any>
): Promise<void> {
  const devRef = ref(rtdb, `dispositivos/${deviceId}`);
  const snap = await get(devRef).catch(() => null);
  const existing = snap?.exists() ? snap.val() : null;

  const finalPayload: Record<string, any> = { ...payload };
  // Si el nodo aún no existe o le falta/excede alguno de los campos obligatorios de validación RTDB,
  // los completamos para garantizar que update() nunca sea rechazado por .validate
  const validCO = typeof existing?.CO === 'number' && existing.CO >= 0 && existing.CO <= 4095;
  const validPM = typeof existing?.PM2_5 === 'number' && existing.PM2_5 >= 0 && existing.PM2_5 <= 4095;
  const validTemp = typeof existing?.temperatura === 'number' && existing.temperatura >= -40 && existing.temperatura <= 100;
  const validHum = typeof existing?.humedad === 'number' && existing.humedad >= 0 && existing.humedad <= 100;

  if (!validCO && finalPayload.CO === undefined) finalPayload.CO = 45;
  if (!validPM && finalPayload.PM2_5 === undefined) finalPayload.PM2_5 = 25;
  if (!validTemp && finalPayload.temperatura === undefined) finalPayload.temperatura = 22.0;
  if (!validHum && finalPayload.humedad === undefined) finalPayload.humedad = 48;

  await update(devRef, finalPayload);
}

export async function resetGatewayDataInRTDB(
  deviceId?: string,
  actingUser?: UserProfile | null
): Promise<void> {
  if (actingUser && actingUser.role !== 'superadmin') {
    const isSuper = await verifySuperAdminPrivileges(actingUser);
    if (!isSuper) {
      throw new Error('Acceso denegado: Solo el SuperAdministrador autenticado puede resetear o apagar alarmas en RTDB.');
    }
  }
  const now = Date.now();
  const resetPayload = {
    CO: 45,
    PM2_5: 25,
    temperatura: 21.5,
    humedad: 48,
    last_update_server: now,
    alarma: false,
    alarma_activa: false,
    buzzer: false,
    luz: false,
    iluminacion_led: false,
    comando_web: 'APAGAR',
    silencio_remoto: true,
    origen_alarma: 'NINGUNO',
    estado_adquisicion: 'activo',
    simulacro_activo: false,
  };

  const targetId = deviceId || 'device_38A839E81F84';
  await update(ref(rtdb, `dispositivos/${targetId}`), resetPayload);

  if (targetId !== 'device_38A839E81F84') {
    await ensureValidDevicePayload('device_38A839E81F84', {
      comando_web: 'APAGAR',
      silencio_remoto: true,
      alarma: false,
      alarma_activa: false,
      buzzer: false,
      luz: false,
      iluminacion_led: false,
      last_update_server: now,
    }).catch(() => {});
  }

  await update(ref(rtdb, 'simulacro'), { activo: false, finalizado: true, timestamp: now }).catch(() => {});
  await update(ref(rtdb, 'emergencia'), { activa: false, timestamp: now }).catch(() => {});
}

export async function toggleGatewayAlarmInRTDB(
  deviceId: string,
  active: boolean,
  actingUser?: UserProfile | null
): Promise<void> {
  if (!active) {
    const isSuper = await verifySuperAdminPrivileges(actingUser);
    if (!isSuper) {
      throw new Error('Acceso denegado: Solo un SuperAdministrador autenticado en Firebase Auth puede apagar la alarma.');
    }
  }

  const now = Date.now();
  const payload: Record<string, any> = {
    comando_web: active ? 'ENCENDER' : 'APAGAR',
    silencio_remoto: !active,
    alarma: active,
    alarma_activa: active,
    buzzer: active,
    origen_alarma: active ? 'ACTIVACION_MANUAL_WEB' : 'NINGUNO',
    last_update_server: now,
  };

  const targetId = deviceId || 'device_38A839E81F84';
  await ensureValidDevicePayload(targetId, payload);

  if (targetId !== 'device_38A839E81F84') {
    await ensureValidDevicePayload('device_38A839E81F84', payload).catch(() => {});
  }
}

export async function shutdownAlarmCompletelyInRTDB(
  deviceId: string,
  actingUser: UserProfile | null,
  options?: { resetSensorBaselines?: boolean }
): Promise<void> {
  const isSuper = await verifySuperAdminPrivileges(actingUser);
  if (!isSuper) {
    throw new Error('Acceso denegado: Se requieren privilegios reales de SuperAdministrador en Firebase Auth para apagar la alarma.');
  }

  const now = Date.now();
  const targetId = deviceId || 'device_38A839E81F84';
  const devPayload: Record<string, any> = {
    comando_web: 'APAGAR',
    silencio_remoto: true,
    alarma: false,
    alarma_activa: false,
    buzzer: false,
    luz: false,
    iluminacion_led: false,
    simulacro_activo: false,
    origen_alarma: 'NINGUNO',
    descripcion_monitoreo: `Alarma apagada completamente por SuperAdmin (${actingUser?.name || auth.currentUser?.email || 'SuperAdmin'}).`,
    last_update_server: now,
  };

  if (options?.resetSensorBaselines) {
    devPayload.CO = 45;
    devPayload.PM2_5 = 25;
    devPayload.estado_adquisicion = 'activo';
  }

  await ensureValidDevicePayload(targetId, devPayload);

  if (targetId !== 'device_38A839E81F84') {
    await ensureValidDevicePayload('device_38A839E81F84', devPayload).catch(() => {});
  }

  await update(ref(rtdb, 'simulacro'), {
    activo: false,
    finalizado: true,
    detenidoPor: actingUser?.name || auth.currentUser?.email || 'SuperAdmin',
    timestamp: now,
  }).catch(() => {});

  await update(ref(rtdb, 'emergencia'), {
    activa: false,
    detenidoPor: actingUser?.name || auth.currentUser?.email || 'SuperAdmin',
    timestamp: now,
  }).catch(() => {});
}

export async function toggleGatewayLightInRTDB(deviceId: string, active: boolean): Promise<void> {
  const now = Date.now();
  const payload = {
    luz: active,
    iluminacion_led: active,
    last_update_server: now,
  };

  const targetId = deviceId || 'device_38A839E81F84';
  await ensureValidDevicePayload(targetId, payload);
}

// -------------------------------------------------------------
// BROADCAST DRILL AND ALERTS FOR HARDWARE SYNC
// -------------------------------------------------------------
export async function broadcastDrillToRTDB(
  active: boolean, 
  drillType: string | null = 'gas_critico',
  primaryDeviceId: string = 'device_38A839E81F84'
): Promise<void> {
  try {
    const now = Date.now();
    const devIds = [primaryDeviceId || 'device_38A839E81F84'];

    if (active) {
      const isGas = drillType === 'gas_critico';
      const isPolvo = drillType === 'incendio_polvo';

      const drillPayload = {
        CO: isGas ? 1250 : 45,
        PM2_5: isPolvo ? 650 : 25,
        temperatura: isGas ? 31.4 : 24.5,
        comando_web: 'ENCENDER',
        silencio_remoto: false,
        alarma: true,
        alarma_activa: true,
        buzzer: true,
        luz: true,
        iluminacion_led: true,
        estado_adquisicion: 'simulacro',
        simulacro_activo: true,
        tipo_simulacro: drillType || 'gas_critico',
        last_update_server: now,
      };

      for (const id of devIds) {
        await ensureValidDevicePayload(id, drillPayload).catch(() => {});
      }

      await update(ref(rtdb, 'simulacro'), {
        activo: true,
        tipo: drillType || 'gas_critico',
        nombre: drillType === 'gas_critico' 
          ? 'Simulacro de Fuga de Monóxido de Carbono (DS 132)'
          : drillType === 'incendio_polvo'
          ? 'Simulacro de Incendio y Humo Denso (DS 132)'
          : 'Simulacro General de Evacuación Minera (DS 132)',
        iniciadoPor: 'Consola Central MineSafe',
        timestamp: now,
      }).catch(() => {});

      await update(ref(rtdb, 'emergencia'), {
        activa: true,
        esSimulacro: true,
        tipo: drillType || 'gas_critico',
        timestamp: now,
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

    // 2. If it's a critical alert, activate alarma and buzzer on RTDB devices so hardware/web react
    if (alert.severity === 'critico') {
      const devIds = Array.from(new Set([alert.sensorId, 'device_38A839E81F84']));
      for (const id of devIds) {
        await ensureValidDevicePayload(id, {
          comando_web: 'ENCENDER',
          silencio_remoto: false,
          alarma: true,
          alarma_activa: true,
          buzzer: true,
          luz: true,
          last_update_server: now,
        }).catch(() => {});
      }
      await update(ref(rtdb, 'emergencia'), {
        activa: true,
        esSimulacro: false,
        alertaId: alert.id,
        titulo: alert.title,
        timestamp: now,
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

/**
 * ============================================================================
 * CONFIGURACIÓN DINÁMICA DE UMBRALES DE ALERTA (RTDB)
 * ============================================================================
 */

export const DEFAULT_GLOBAL_THRESHOLDS: DeviceThresholdsConfig = {
  dispositivo_id: 'global',
  dispositivo_nombre: 'Configuración Global (Todos los Sensores por Defecto)',
  pm25: {
    activo: true,
    notificaciones: true,
    preventivo: 350,
    advertencia: 750,
    critico: 1200,
    unidad: 'ADC raw',
    minVal: 0,
    maxVal: 4095,
    label: 'Partículas PM2.5 (Sensor Óptico ADC)',
    descripcion: 'Lectura analógica bruta de 12 bits (0-4095) del ESP32. Valores de ejemplo referenciales sin calibración gravimétrica oficial.'
  },
  mq2: {
    activo: true,
    notificaciones: true,
    preventivo: 300,
    advertencia: 800,
    critico: 1200,
    unidad: 'ADC raw',
    minVal: 0,
    maxVal: 4095,
    label: 'Gases Combustibles y Humos (MQ-2 ADC)',
    descripcion: 'Lectura analógica bruta de 12 bits (0-4095). Valores de ejemplo referenciales; no representan PPM certificados sin calibración con gas patrón.'
  },
  temperatura: {
    activo: true,
    notificaciones: true,
    preventivo: 26,
    advertencia: 32,
    critico: 38,
    unidad: '°C',
    minVal: -20,
    maxVal: 80,
    label: 'Temperatura Ambiental (DHT)',
    descripcion: 'Monitoreo térmico en galerías subterráneas y frentes de avance. Valores de ejemplo según protocolo de estrés térmico.'
  },
  humedad: {
    activo: true,
    notificaciones: true,
    preventivo: 70,
    advertencia: 80,
    critico: 90,
    unidad: '%',
    minVal: 0,
    maxVal: 100,
    label: 'Humedad Relativa (DHT)',
    descripcion: 'Humedad relativa ambiental. Valores de ejemplo referenciales para control de ventilación y saturación ambiental.'
  },
  actualizado_en: Date.now(),
  actualizado_por: 'Sistema MineSafe (Valores Iniciales)',
  notas: 'Límites iniciales configurables de ejemplo. Modificar según protocolos de seguridad de la faena.'
};

/**
 * Escucha la configuración de umbrales para un dispositivo específico o 'global'
 */
export function subscribeToAlertThresholds(
  targetId: string, 
  callback: (config: DeviceThresholdsConfig) => void
): () => void {
  const path = `configuracion_alertas/${targetId}`;
  const configRef = ref(rtdb, path);

  return onValue(configRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback({
        dispositivo_id: targetId,
        dispositivo_nombre: data.dispositivo_nombre || targetId,
        pm25: { ...DEFAULT_GLOBAL_THRESHOLDS.pm25, ...(data.pm25 || {}) },
        mq2: { ...DEFAULT_GLOBAL_THRESHOLDS.mq2, ...(data.mq2 || {}) },
        temperatura: { ...DEFAULT_GLOBAL_THRESHOLDS.temperatura, ...(data.temperatura || {}) },
        humedad: { ...DEFAULT_GLOBAL_THRESHOLDS.humedad, ...(data.humedad || {}) },
        actualizado_en: data.actualizado_en || Date.now(),
        actualizado_por: data.actualizado_por || 'Desconocido',
        notas: data.notas || ''
      });
    } else {
      callback({
        ...DEFAULT_GLOBAL_THRESHOLDS,
        dispositivo_id: targetId,
        dispositivo_nombre: targetId === 'global' ? DEFAULT_GLOBAL_THRESHOLDS.dispositivo_nombre : `Dispositivo ${targetId}`
      });
    }
  }, (err) => {
    console.warn(`Error subscribing to thresholds for ${targetId}:`, err);
    callback({
      ...DEFAULT_GLOBAL_THRESHOLDS,
      dispositivo_id: targetId
    });
  });
}

/**
 * Escucha todas las configuraciones de umbrales existentes en la base de datos
 */
export function subscribeToAllThresholdConfigs(
  callback: (configs: Record<string, DeviceThresholdsConfig>) => void
): () => void {
  const configsRef = ref(rtdb, 'configuracion_alertas');

  return onValue(configsRef, (snapshot) => {
    const result: Record<string, DeviceThresholdsConfig> = {};
    if (snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach((key) => {
        const item = data[key];
        result[key] = {
          dispositivo_id: key,
          dispositivo_nombre: item.dispositivo_nombre || key,
          pm25: { ...DEFAULT_GLOBAL_THRESHOLDS.pm25, ...(item.pm25 || {}) },
          mq2: { ...DEFAULT_GLOBAL_THRESHOLDS.mq2, ...(item.mq2 || {}) },
          temperatura: { ...DEFAULT_GLOBAL_THRESHOLDS.temperatura, ...(item.temperatura || {}) },
          humedad: { ...DEFAULT_GLOBAL_THRESHOLDS.humedad, ...(item.humedad || {}) },
          actualizado_en: item.actualizado_en || Date.now(),
          actualizado_por: item.actualizado_por || 'Desconocido',
          notas: item.notas || ''
        };
      });
    }
    if (!result['global']) {
      result['global'] = { ...DEFAULT_GLOBAL_THRESHOLDS };
    }
    callback(result);
  }, (err) => {
    console.warn('Error subscribing to all threshold configs:', err);
    callback({ global: DEFAULT_GLOBAL_THRESHOLDS });
  });
}

/**
 * Guarda o actualiza los umbrales de alerta en Firebase RTDB
 * Valida que el usuario tenga rol de administrador o superadmin
 */
export async function saveThresholdConfig(
  targetId: string, 
  config: DeviceThresholdsConfig, 
  user: UserProfile
): Promise<void> {
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    throw new Error('Permisos insuficientes: Solo los usuarios con rol Administrador o SuperAdmin pueden modificar los umbrales de seguridad operacional.');
  }

  // Validación de consistencia matemática: preventivo < advertencia < critico
  const variables: ('pm25' | 'mq2' | 'temperatura' | 'humedad')[] = ['pm25', 'mq2', 'temperatura', 'humedad'];
  for (const v of variables) {
    const cfg = config[v];
    if (cfg.activo) {
      if (cfg.preventivo >= cfg.advertencia) {
        throw new Error(`En la variable ${cfg.label}: El umbral preventivo (${cfg.preventivo}) debe ser menor que el umbral de advertencia (${cfg.advertencia}).`);
      }
      if (cfg.advertencia >= cfg.critico) {
        throw new Error(`En la variable ${cfg.label}: El umbral de advertencia (${cfg.advertencia}) debe ser menor que el umbral crítico (${cfg.critico}).`);
      }
    }
  }

  const payload: DeviceThresholdsConfig = {
    ...config,
    dispositivo_id: targetId,
    actualizado_en: Date.now(),
    actualizado_por: user.name ? `${user.name} (${user.role})` : user.email,
  };

  const targetRef = ref(rtdb, `configuracion_alertas/${targetId}`);
  await set(targetRef, payload);

  // Registro de auditoría inmutable en la bitácora de configuraciones
  const auditKey = `${targetId}_${Date.now()}`;
  const auditRef = ref(rtdb, `bitacora_configuracion_umbrales/${auditKey}`);
  await set(auditRef, {
    targetId,
    configGuardada: payload,
    modificadoPor: payload.actualizado_por,
    timestamp: Date.now(),
    fecha: new Date().toISOString()
  }).catch((err) => console.warn('Error saving audit log:', err));
}

/**
 * Restaura los valores de umbrales a los predeterminados de fábrica
 */
export async function resetThresholdConfigToDefault(
  targetId: string, 
  user: UserProfile
): Promise<DeviceThresholdsConfig> {
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    throw new Error('Permisos insuficientes: Solo los administradores pueden restaurar valores de seguridad.');
  }

  const restoredConfig: DeviceThresholdsConfig = {
    ...DEFAULT_GLOBAL_THRESHOLDS,
    dispositivo_id: targetId,
    dispositivo_nombre: targetId === 'global' ? DEFAULT_GLOBAL_THRESHOLDS.dispositivo_nombre : `Dispositivo ${targetId}`,
    actualizado_en: Date.now(),
    actualizado_por: `${user.name} (${user.role}) [Restauración a Fábrica]`,
    notas: 'Configuración restaurada a valores de ejemplo por defecto.'
  };

  const targetRef = ref(rtdb, `configuracion_alertas/${targetId}`);
  await set(targetRef, restoredConfig);

  return restoredConfig;
}

/**
 * Registra un evento de superación o recuperación de umbral en Firebase RTDB
 */
export async function saveAlertThresholdEvent(event: AlertEventRecord): Promise<void> {
  try {
    const eventRef = ref(rtdb, `eventos_umbrales/${event.id}`);
    await set(eventRef, event);

    // Si el evento está activo y es de advertencia o crítico, reflejarlo en la lista de alertas activas
    if (event.estado === 'activa' && (event.nivel === 'advertencia' || event.nivel === 'critico')) {
      const safetyAlert: SafetyAlert = {
        id: event.id,
        code: `EVT-${event.variable.toUpperCase()}-${event.id.slice(-6)}`,
        title: `Umbral ${event.nivel.toUpperCase()}: ${event.variable_label}`,
        severity: event.nivel === 'critico' ? 'critico' : 'advertencia',
        variableName: event.variable_label,
        sensorId: event.dispositivo_id,
        sensorCode: event.dispositivo_nombre || event.dispositivo_id,
        sectorName: event.sector_nombre || 'Faena Central',
        recordedValue: `${event.valor_detectado} ${event.unidad}`,
        safeLimit: `< ${event.umbral_superado} ${event.unidad}`,
        timestamp: event.fecha_hora,
        acknowledged: false,
        resolved: false,
        suggestedAction: event.nivel === 'critico'
          ? 'Evacuar el área inmediata, activar ventilación forzada y notificar a brigada de rescate.'
          : 'Inspeccionar sensores del sector, verificar ductos de ventilación y advertir a la cuadrilla.'
      };
      await broadcastAlertToRTDB(safetyAlert);
    }
  } catch (err) {
    console.warn('Error saving alert event in RTDB:', err);
  }
}

/**
 * Actualiza el estado de un evento de umbral (por ejemplo, al recuperarse a la normalidad)
 */
export async function updateAlertThresholdEvent(
  eventId: string, 
  updates: Partial<AlertEventRecord>
): Promise<void> {
  try {
    const eventRef = ref(rtdb, `eventos_umbrales/${eventId}`);
    await update(eventRef, updates);
  } catch (err) {
    console.warn('Error updating alert event in RTDB:', err);
  }
}

/**
 * Suscribe a los eventos históricos y en vivo generados por el motor de umbrales
 */
export function subscribeToAlertEvents(
  callback: (events: AlertEventRecord[]) => void
): () => void {
  const eventsRef = ref(rtdb, 'eventos_umbrales');

  return onValue(eventsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const list: AlertEventRecord[] = Object.keys(data).map(k => ({
        id: k,
        ...data[k]
      }));
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      callback(list);
    } else {
      callback([]);
    }
  }, (err) => {
    console.warn('Error subscribing to alert events:', err);
    callback([]);
  });
}

/**
 * ============================================================================
 * CONFIGURACIÓN MAESTRA DE PLATAFORMA Y VISIBILIDAD DE VENTANAS (SOLO SUPERADMIN)
 * ============================================================================
 */

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  visibility: {
    rolePermissions: {
      admin: {
        dashboard: true,
        monitoreo: true,
        alertas: true,
        configuracion_alertas: true,
        equipos: true,
        reportes: true,
        faenas: true,
        usuarios: true,
      },
      operador: {
        dashboard: true,
        monitoreo: true,
        alertas: true,
        configuracion_alertas: false,
        equipos: false,
        reportes: true,
        faenas: true,
        usuarios: false,
      },
    },
    userOverrides: {},
  },
  metrics: {
    coPreventivo: 300,
    coAdvertencia: 800,
    coCritico: 1200,
    coChartSafeMax: 50,
    pm25Preventivo: 350,
    pm25Advertencia: 750,
    pm25Critico: 1200,
    pm25ChartSafeMax: 50,
    tempMin: 10,
    tempPreventivo: 26,
    tempAdvertencia: 32,
    tempCritico: 38,
    humMin: 30,
    humPreventivo: 70,
    humAdvertencia: 80,
    humCritico: 90,
    airFlowMin: 0.5,
    airFlowMax: 3.0,
    batteryMin: 20,
    co2SafeMax: 1000,
    co2CriticalMax: 2000,
    ch4SafeMax: 1.5,
    ch4CriticalMax: 5.0,
    o2MinSafe: 19.5,
    noiseSafeMax: 82,
    noiseCriticalMax: 90,
    gatewayTimeoutSeconds: 20,
    emergencyGasThreshold: 1000,
    emergencyDustThreshold: 500,
  },
  appearance: {
    platformTitle: 'MineSafe: Monitoreo IoT y Seguridad Minera',
    platformSubtitle: 'Supervisión ambiental subterránea continua, control de gases críticos, ventilación de galerías y respuesta temprana ante incidentes.',
    siteBadgeText: 'Faena El Teniente · Nivel -510m',
    footerText: 'Cumplimiento Normativo DS 132 / Sernageomin · Plataforma Industrial',
    announcementEnabled: false,
    announcementText: '',
    announcementTone: 'info',
    showChartsAndUsers: true,
    showESP32Section: true,
    showDualSensorCards: true,
    showHeroMetricCards: true,
    showCapabilitiesGrid: true,
    showAdditionalGasesRow: true,
    allowHardwareControlsForNonSuperAdmin: true,
    allowEmergencyButtonForOperador: true,
  },
  registeredDevices: [
    {
      id: 'device_38A839E81F84',
      name: 'Nodo Sensor & Gateway Principal (1F84)',
      category: 'gateway_sensor',
      sectorName: 'Mina Chuquicamata - Rampa Principal',
      localIp: '192.168.4.1',
      enabled: true,
      createdAt: 1763000000000,
    },
  ],
  onlyShowRegisteredDevices: true,
  actualizado_en: Date.now(),
  actualizado_por: 'SuperAdmin (Por defecto)',
};

export function isTabVisibleForUser(
  tab: NavigationTab,
  user: UserProfile | null,
  config?: PlatformConfig | null
): boolean {
  if (!user) return false;
  if (tab === 'superadmin_panel') {
    return user.role === 'superadmin';
  }
  if (user.role === 'superadmin') {
    return true;
  }

  const controllableTab = tab as ControllableTab;
  const userOverride: WindowOverrideValue | undefined =
    config?.visibility?.userOverrides?.[user.id]?.[controllableTab];

  if (userOverride === 'allow') return true;
  if (userOverride === 'block') return false;

  const roleKey = user.role === 'admin' ? 'admin' : 'operador';
  const configuredRoleVal = config?.visibility?.rolePermissions?.[roleKey]?.[controllableTab];
  if (typeof configuredRoleVal === 'boolean') {
    return configuredRoleVal;
  }

  return DEFAULT_PLATFORM_CONFIG.visibility.rolePermissions[roleKey][controllableTab];
}

function mergePlatformConfig(raw: any): PlatformConfig {
  return {
    visibility: {
      rolePermissions: {
        admin: {
          ...DEFAULT_PLATFORM_CONFIG.visibility.rolePermissions.admin,
          ...(raw?.visibility?.rolePermissions?.admin || {}),
        },
        operador: {
          ...DEFAULT_PLATFORM_CONFIG.visibility.rolePermissions.operador,
          ...(raw?.visibility?.rolePermissions?.operador || {}),
        },
      },
      userOverrides: raw?.visibility?.userOverrides || {},
    },
    metrics: {
      ...DEFAULT_PLATFORM_CONFIG.metrics,
      ...(raw?.metrics || {}),
    },
    appearance: {
      ...DEFAULT_PLATFORM_CONFIG.appearance,
      ...(raw?.appearance || {}),
    },
    registeredDevices: Array.isArray(raw?.registeredDevices)
      ? raw.registeredDevices
      : DEFAULT_PLATFORM_CONFIG.registeredDevices,
    onlyShowRegisteredDevices:
      typeof raw?.onlyShowRegisteredDevices === 'boolean'
        ? raw.onlyShowRegisteredDevices
        : true,
    actualizado_en: raw?.actualizado_en || Date.now(),
    actualizado_por: raw?.actualizado_por || 'SuperAdmin',
  };
}

export async function initializeRegisteredDeviceInRTDB(
  device: RegisteredDeviceConfig,
  actingUser: UserProfile
): Promise<void> {
  if (actingUser.role !== 'superadmin') {
    throw new Error('Acceso denegado: Solo el SuperAdministrador puede inicializar dispositivos en Firebase.');
  }
  const cleanId = device.id.trim().replace(/[.#$/[\]]/g, '_');
  const devRef = ref(rtdb, `dispositivos/${cleanId}`);
  const snap = await get(devRef).catch(() => null);
  const now = Date.now();
  const baseMetadata = {
    name: device.name,
    sectorName: device.sectorName,
    deviceCategory: device.category,
    parentGatewayId: device.parentGatewayId || '',
    localIp: device.localIp || '192.168.4.1',
  };

  if (snap && snap.exists()) {
    await update(devRef, baseMetadata);
  } else {
    await set(devRef, {
      ...baseMetadata,
      CO: 45,
      PM2_5: 25,
      temperatura: 22.0,
      humedad: 48,
      alarma_activa: false,
      alarma: false,
      buzzer: false,
      luz: false,
      iluminacion_led: false,
      estado_adquisicion: 'activo',
      origen_alarma: 'NINGUNO',
      descripcion_monitoreo: `Nodo ${device.name} inicializado por SuperAdmin, en espera de telemetría ESP32.`,
      via: device.category === 'sensor' && device.parentGatewayId ? 'ESP_NOW_GATEWAY' : 'WIFI_DIRECTO',
      last_update_server: now,
    });
  }
}

export function subscribeToPlatformConfig(
  callback: (config: PlatformConfig) => void
): () => void {
  const cfgRef = ref(rtdb, 'configuracion_plataforma');
  return onValue(
    cfgRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(mergePlatformConfig(snapshot.val()));
      } else {
        callback(DEFAULT_PLATFORM_CONFIG);
      }
    },
    (err) => {
      console.warn('Error subscribing to platform config:', err);
      callback(DEFAULT_PLATFORM_CONFIG);
    }
  );
}

export async function savePlatformConfig(
  config: PlatformConfig,
  actingUser: UserProfile
): Promise<void> {
  if (actingUser.role !== 'superadmin') {
    throw new Error('Acceso denegado: Solo el SuperAdministrador puede modificar la configuración maestra de la plataforma.');
  }

  const m = config.metrics;
  if (m.coPreventivo >= m.coAdvertencia || m.coAdvertencia >= m.coCritico) {
    throw new Error('En Gas CO (MQ-2): Preventivo debe ser menor que Advertencia y éste menor que Crítico.');
  }
  if (m.pm25Preventivo >= m.pm25Advertencia || m.pm25Advertencia >= m.pm25Critico) {
    throw new Error('En Polvo PM2.5: Preventivo debe ser menor que Advertencia y éste menor que Crítico.');
  }
  if (m.tempPreventivo >= m.tempAdvertencia || m.tempAdvertencia >= m.tempCritico) {
    throw new Error('En Temperatura: Preventivo debe ser menor que Advertencia y éste menor que Crítico.');
  }
  if (m.humPreventivo >= m.humAdvertencia || m.humAdvertencia >= m.humCritico) {
    throw new Error('En Humedad: Preventivo debe ser menor que Advertencia y éste menor que Crítico.');
  }

  const payload: PlatformConfig = {
    ...config,
    actualizado_en: Date.now(),
    actualizado_por: `${actingUser.name} (SuperAdmin)`,
  };

  await set(ref(rtdb, 'configuracion_plataforma'), payload);

  // Sincronizar también umbrales globales en /configuracion_alertas/global para el motor de alertas
  try {
    const existingGlobalSnap = await get(ref(rtdb, 'configuracion_alertas/global')).catch(() => null);
    const baseGlobal = existingGlobalSnap?.exists() ? existingGlobalSnap.val() : DEFAULT_GLOBAL_THRESHOLDS;
    await set(ref(rtdb, 'configuracion_alertas/global'), {
      ...baseGlobal,
      dispositivo_id: 'global',
      mq2: {
        ...DEFAULT_GLOBAL_THRESHOLDS.mq2,
        ...(baseGlobal.mq2 || {}),
        preventivo: m.coPreventivo,
        advertencia: m.coAdvertencia,
        critico: m.coCritico,
      },
      pm25: {
        ...DEFAULT_GLOBAL_THRESHOLDS.pm25,
        ...(baseGlobal.pm25 || {}),
        preventivo: m.pm25Preventivo,
        advertencia: m.pm25Advertencia,
        critico: m.pm25Critico,
      },
      temperatura: {
        ...DEFAULT_GLOBAL_THRESHOLDS.temperatura,
        ...(baseGlobal.temperatura || {}),
        preventivo: m.tempPreventivo,
        advertencia: m.tempAdvertencia,
        critico: m.tempCritico,
      },
      humedad: {
        ...DEFAULT_GLOBAL_THRESHOLDS.humedad,
        ...(baseGlobal.humedad || {}),
        preventivo: m.humPreventivo,
        advertencia: m.humAdvertencia,
        critico: m.humCritico,
      },
      actualizado_en: Date.now(),
      actualizado_por: `${actingUser.name} (SuperAdmin Maestro)`,
    });
  } catch (syncErr) {
    console.warn('Error syncing global alert thresholds from platform config:', syncErr);
  }
}

export async function resetPlatformConfigToDefault(
  actingUser: UserProfile
): Promise<PlatformConfig> {
  if (actingUser.role !== 'superadmin') {
    throw new Error('Acceso denegado: Solo el SuperAdministrador puede restaurar la configuración maestra.');
  }
  const restored: PlatformConfig = {
    ...DEFAULT_PLATFORM_CONFIG,
    actualizado_en: Date.now(),
    actualizado_por: `${actingUser.name} (Restauración SuperAdmin)`,
  };
  await set(ref(rtdb, 'configuracion_plataforma'), restored);
  return restored;
}





