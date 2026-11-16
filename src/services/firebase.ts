import { initializeApp, getApps } from 'firebase/app';
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
  remove,
  query,
  orderByKey,
  limitToLast,
  Database
} from 'firebase/database';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  FirebaseStorage
} from 'firebase/storage';
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
  AlertSeverity,
  AlertResolutionDetails,
  DrillDebriefRecord,
  DeviceThresholdsConfig,
  AlertEventRecord,
  AlarmAuditRecord,
  ControllableTab,
  EquiposSubTab,
  NavigationTab,
  PlatformConfig,
  WindowOverrideValue,
  RegisteredDeviceConfig,
  MiningSite,
  MiningSector,
  Organization,
  TelemetryHistoryPoint,
  AlertAttachment,
  WorkerAssignment
} from '../types';
import {
  canProvisionUserInOrganization,
  DEFAULT_ORGANIZATION_ID,
} from '../utils/accessControl';

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

export const DEFAULT_ORGANIZATION: Organization = {
  id: 'org-minesafe-principal',
  name: 'MineSafe Operaciones Centrales',
  rut: '76.420.110-K',
  industry: 'Minería Subterránea & Rajo',
  status: 'activa',
  createdAt: 1760000000000,
};

// Primary Firebase App connected to user's minefase-fc5f5 project (Auth + RTDB + Storage)
const minefaseApp = getApps().find((a) => a.name === 'minefase-primary')
  || initializeApp(minefaseConfig, 'minefase-primary');

// Default AI Studio Firestore app
const appletApp = getApps().find((a) => a.name === '[DEFAULT]')
  || initializeApp(firebaseConfig);

// Firebase Realtime Database, Auth & Storage connected strictly to minefase-fc5f5
export const rtdb: Database = getDatabase(minefaseApp, USER_RTDB_URL);
export const auth = getAuth(minefaseApp);
export const minefaseStorage: FirebaseStorage = getStorage(minefaseApp);

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
const lastPacketSignatureMap: Record<string, string> = {};

export function recordDevicePacketArrival(key: string, data?: any) {
  if (!data) {
    if (!lastPacketArrivalMap[key]) {
      lastPacketArrivalMap[key] = Date.now();
    }
    return;
  }
  const signature = JSON.stringify([
    data.CO ?? data.co ?? null,
    data.PM2_5 ?? data.pm25 ?? null,
    data.temperatura ?? data.temp ?? null,
    data.humedad ?? data.hum ?? null,
    data.last_update_server ?? data.timestamp_server ?? null,
    data.alarma_activa ?? data.alarma ?? null,
    data.luz ?? null,
    data.estado_adquisicion ?? null,
  ]);
  if (lastPacketSignatureMap[key] !== signature) {
    lastPacketSignatureMap[key] = signature;
    lastPacketArrivalMap[key] = Date.now();
  }
}

function readStrictBoundedNum(
  primary: unknown,
  secondary: unknown,
  minVal: number,
  maxVal: number
): number | null {
  const candidate = primary !== undefined ? primary : secondary;
  let num: number | null = null;
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    num = candidate;
  } else if (typeof candidate === 'string' && candidate.trim() !== '') {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) num = parsed;
  }
  if (num === null || num < minVal || num > maxVal) {
    return null;
  }
  return num;
}

export function mapRTDBDeviceToSensorDevice(
  key: string,
  data: any,
  timeoutSeconds: number = 20
): SensorDevice {
  const coVal = readStrictBoundedNum(data?.CO, data?.co, 0, 4095);
  const pmVal = readStrictBoundedNum(data?.PM2_5, data?.pm25, 0, 4095);
  const tempVal = readStrictBoundedNum(data?.temperatura, data?.temp, -40, 100);
  const humVal = readStrictBoundedNum(data?.humedad, data?.hum, 0, 100);

  const faultFields: ('CO' | 'PM2_5' | 'temperatura' | 'humedad')[] = [];
  if (coVal === null) faultFields.push('CO');
  if (pmVal === null) faultFields.push('PM2_5');
  if (tempVal === null) faultFields.push('temperatura');
  if (humVal === null) faultFields.push('humedad');
  const sensorFault = faultFields.length > 0;

  const effectiveTimeout = Math.max(5, Number(timeoutSeconds) || 20);
  const now = Date.now();
  const lastArrival = lastPacketArrivalMap[key] || 0;
  let serverTime = Number(data?.last_update_server) || Number(data?.timestamp_server) || 0;
  // 10 dígitos Unix epoch (>= año 2001) -> convertir a milisegundos
  if (serverTime >= 1000000000 && serverTime < 100000000000) {
    serverTime = serverTime * 1000;
  } else if (serverTime > 0 && serverTime < 1000000000) {
    // El firmware envió millis() de uptime en vez de época Unix:
    // usar la hora real de llegada del paquete RTDB para evitar fechas de 1970.
    serverTime = lastArrival > 0 ? lastArrival : now;
  }

  const diffSeconds = serverTime > 0 ? Math.floor(Math.abs(now - serverTime) / 1000) : 999999;
  const arrivalDiff = lastArrival > 0 ? Math.floor((now - lastArrival) / 1000) : 999999;

  const isOnline = diffSeconds <= effectiveTimeout || arrivalDiff <= effectiveTimeout;

  const alarmaActiva = Boolean(data?.alarma_activa);
  const origenAlarma = data?.origen_alarma || '';
  const descripcionMonitoreo = data?.descripcion_monitoreo || '';

  let status: AlertSeverity = 'normal';
  if (!isOnline) {
    status = 'desconectado';
  } else if (alarmaActiva || (coVal !== null && coVal >= 500) || (pmVal !== null && pmVal >= 150)) {
    status = 'critico';
  } else if ((coVal !== null && coVal >= 350) || (pmVal !== null && pmVal >= 55)) {
    status = 'advertencia';
  }

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
    organizationId: data?.organizationId || DEFAULT_ORGANIZATION.id,
    sectorId: `sec-${key}`,
    sectorName: sectorName,
    batteryPct: typeof data?.bateria === 'number' ? data.bateria : (key === 'device_38A839E81F84' ? 95 : 88),
    signalStrength: isOnline ? 'optima' : 'sin_conexion',
    lastPing: serverTime > 0
      ? (diffSeconds < 60 ? `hace ${diffSeconds} seg` : `hace ${Math.floor(diffSeconds / 60)} min`)
      : 'sin marca temporal',
    status: status,
    assignedTo: assigned,
    rawCO: coVal === null ? undefined : coVal,
    rawPM25: pmVal === null ? undefined : pmVal,
    rawTemp: tempVal === null ? undefined : tempVal,
    rawHum: humVal === null ? undefined : humVal,
    sensorFault: sensorFault,
    faultFields: faultFields,
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
      temperatura: tempVal === null ? 0 : Number(tempVal.toFixed(1)),
      humedad: humVal === null ? 0 : Number(humVal.toFixed(0)),
      co2: typeof data?.CO2 === 'number' ? data.CO2 : 0,
      co: coVal === null ? 0 : Number(coVal.toFixed(1)),
      ch4: typeof data?.CH4 === 'number' ? data.CH4 : 0,
      o2: typeof data?.O2 === 'number' ? data.O2 : 0,
      flujoAire: typeof data?.flujo_aire === 'number' ? data.flujo_aire : 0,
      ruido: typeof data?.ruido === 'number' ? data.ruido : 0,
      polvoPM: pmVal === null ? 0 : Number(pmVal.toFixed(0)),
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
        'El método de inicio de sesión con correo y contraseña no está habilitado en el proveedor de autenticación.',
        code
      );
    case 'auth/public-registration-disabled':
    case 'auth/unauthorized-profile':
      return new FirebaseAuthActionError(
        err?.message || 'El acceso requiere una cuenta habilitada por un responsable autorizado.',
        code
      );
    case 'auth/unauthorized-domain':
      return new FirebaseAuthActionError(
        'Este dominio no está autorizado para iniciar sesión en el proveedor de autenticación.',
        code
      );
    case 'auth/popup-closed-by-user':
      return new FirebaseAuthActionError('Se cerró la ventana emergente antes de completar el acceso.', code);
    case 'auth/popup-blocked':
      return new FirebaseAuthActionError('El navegador bloqueó la ventana emergente de acceso. Permite ventanas emergentes e intenta nuevamente.', code);
    case 'auth/network-request-failed':
      return new FirebaseAuthActionError('Error de red al conectar con el servicio de autenticación. Verifica tu conexión a Internet.', code);
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
    organizationId: data?.organizationId || DEFAULT_ORGANIZATION.id,
    name: data?.nombre || key,
    email: data?.email || `${key.toLowerCase().replace(/[^a-z0-9]/g, '')}@minesafe.cl`,
    role: role,
    roleLabel: roleLabel,
    rut: data?.codigoId || data?.telefono || 'No registrado',
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
        await signOut(auth).catch(() => {});
        throw new FirebaseAuthActionError('Tu cuenta se encuentra desactivada por administración.', 'auth/user-disabled');
      }
      return profile;
    }
  } catch (err: any) {
    if (err?.code === 'auth/user-disabled' || err?.message?.includes('desactivada')) throw err;
  }

  // 2. Buscar por email en /usuarios
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
          await signOut(auth).catch(() => {});
          throw new FirebaseAuthActionError('Tu cuenta se encuentra desactivada por administración.', 'auth/user-disabled');
        }
        return profile;
      }
    }
  } catch (err: any) {
    if (err?.code === 'auth/user-disabled' || err?.message?.includes('desactivada')) throw err;
  }

  // 3. Únicamente el SuperAdministrador canónico tiene respaldo automático; cualquier otra cuenta
  // debe contar con perfil autorizado y activo en /usuarios.
  if (emailLower === PRIMARY_SUPERADMIN_EMAIL) {
    return {
      id: PRIMARY_SUPERADMIN_UID,
      organizationId: DEFAULT_ORGANIZATION.id,
      name: fbUser.displayName || 'Manuel Crisostomo',
      email: fbUser.email || PRIMARY_SUPERADMIN_EMAIL,
      role: 'superadmin',
      roleLabel: 'Super Administrador de Seguridad Minera',
      rut: 'No registrado',
      shift: 'Turno Continuo A',
      status: 'activo',
      lastLogin: 'En línea (Firebase Auth)',
      assignedSector: 'Mina Chuquicamata',
      assignedDeviceCode: 'device_38A839E81F84',
    };
  }

  await signOut(auth).catch(() => {});
  throw new FirebaseAuthActionError(
    'Tu cuenta no se encuentra habilitada o asociada a una organización autorizada. Solicita el alta a un responsable.',
    'auth/unauthorized-profile'
  );
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
    // No auto-registra cuentas nuevas: exige perfil autorizado previo en /usuarios
    return await resolveUserProfileFromAuthUser(credential.user);
  } catch (err: any) {
    throw mapFirebaseAuthError(err);
  }
}

export async function registerWithFirebaseAuth(
  _name: string,
  _email: string,
  _password: string,
  _rut: string,
  _shift: string
): Promise<UserProfile> {
  throw new FirebaseAuthActionError(
    'El autorregistro público está deshabilitado. Las cuentas deben ser habilitadas por un responsable autorizado de la organización.',
    'auth/public-registration-disabled'
  );
}

/**
 * Crea una cuenta real en Firebase Authentication desde la consola Admin/SuperAdmin
 * utilizando una instancia secundaria aislada para no cerrar ni alterar la sesión actual del administrador,
 * y envía opcionalmente el correo de restablecimiento/activación de contraseña.
 */
export async function createUserAccountByAdmin(params: {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'operador';
  rut: string;
  shift: string;
  assignedSector: string;
  assignedDeviceCode?: string;
  organizationId?: string;
  sendResetEmail?: boolean;
  actingUser?: UserProfile | null;
}): Promise<UserProfile> {
  const cleanEmail = params.email.trim();
  const cleanName = params.name.trim();
  if (!cleanName || !cleanEmail || params.password.length < 6) {
    throw new Error('Nombre, correo válido y contraseña inicial (mínimo 6 caracteres) son obligatorios.');
  }

  const safeRole: UserRole = params.role === 'admin' ? 'admin' : 'operador';
  const targetOrgId =
    params.actingUser?.role === 'admin'
      ? params.actingUser.organizationId || DEFAULT_ORGANIZATION_ID
      : params.organizationId || DEFAULT_ORGANIZATION.id;

  if (params.actingUser) {
    const check = canProvisionUserInOrganization(params.actingUser, targetOrgId, safeRole);
    if (!check.allowed) {
      throw new Error(check.reason || 'Permisos insuficientes para crear cuentas.');
    }
  }

  const secondaryApp =
    getApps().find((a) => a.name === 'admin-provisioner') ||
    initializeApp(minefaseConfig, 'admin-provisioner');
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, params.password);
    await updateProfile(credential.user, { displayName: cleanName }).catch(() => {});
    const newUid = credential.user.uid;
    if (params.sendResetEmail) {
      await sendPasswordResetEmail(secondaryAuth, cleanEmail).catch(() => {});
    }
    await signOut(secondaryAuth).catch(() => {});

    const createdProfile: UserProfile = {
      id: newUid,
      organizationId: targetOrgId,
      name: cleanName,
      email: cleanEmail,
      role: safeRole,
      roleLabel:
        safeRole === 'admin'
          ? 'Administrador / Prevencionista de Faena'
          : 'Operador / Minero en Faena',
      rut: params.rut.trim() || 'No registrado',
      shift: params.shift.trim() || 'Turno Continuo A',
      status: 'activo',
      lastLogin: 'Cuenta creada por administración',
      assignedSector: params.assignedSector || 'Faena Minera Central',
      assignedDeviceCode: params.assignedDeviceCode || '',
    };

    await addUserToRTDB(createdProfile, params.actingUser);
    return createdProfile;
  } catch (err: any) {
    await signOut(secondaryAuth).catch(() => {});
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

export function subscribeToFirebaseAuth(
  callback: (user: UserProfile | null, authError?: string | null) => void
): () => void {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      callback(null, null);
      return;
    }
    try {
      const profile = await resolveUserProfileFromAuthUser(fbUser);
      callback(profile, null);
    } catch (err: any) {
      callback(null, err?.message || 'Tu cuenta no está habilitada para acceder al panel.');
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
    organizationId: data?.organizationId || DEFAULT_ORGANIZATION.id,
    contractNumber: key,
    deviceCode: data?.deviceId || data?.idDispositivo || 'MS-IOT-REG',
    deviceType: 'Detector MultiGas Certificado DS 132',
    provider: data?.empresa || 'Dräger / MineSafe Mining Equipments',
    startDate: data?.fechaInicioArriendo || data?.fechaInicio || '2025-01-01',
    endDate: data?.fechaFinArriendo || data?.fechaFinContrato || data?.fechaTermino || '2026-12-31',
    monthlyCostClp: typeof data?.monto === 'number' ? data.monto : (typeof data?.monthlyCostClp === 'number' ? data.monthlyCostClp : 185000),
    paymentStatus: paymentStatus,
    lastPaymentDate: data?.fechaUltimoPago || '2025-11-15',
    nextDueDate: data?.fechaFinArriendo || '2026-03-31',
    assignedTechnician: data?.tec || 'Ingeniería y Soporte MineSafe',
    notes: `Contrato sincronizado desde Realtime Database (${estadoGeneral}).`,
  };
}

// -------------------------------------------------------------
// REALTIME LISTENERS (RTDB)
// -------------------------------------------------------------
export function subscribeToRTDBDevicesRaw(
  callback: (rawDevices: Record<string, any>) => void
): () => void {
  const devicesRef = ref(rtdb, 'dispositivos');
  const unsub = onValue(devicesRef, (snapshot) => {
    if (snapshot.exists()) {
      const incoming = snapshot.val() || {};
      Object.keys(incoming).forEach((key) => {
        recordDevicePacketArrival(key, incoming[key]);
      });
      callback(incoming);
    } else {
      callback({});
    }
  }, (err) => {
    console.warn('Error subscribing to RTDB /dispositivos:', err);
  });
  return unsub;
}

export function subscribeToRTDBDevices(
  callback: (devices: SensorDevice[]) => void,
  timeoutSeconds: number = 20
): () => void {
  return subscribeToRTDBDevicesRaw((incoming) => {
    const combined: SensorDevice[] = Object.keys(incoming).map((key) =>
      mapRTDBDeviceToSensorDevice(key, incoming[key], timeoutSeconds)
    );
    callback(combined);
  });
}

export async function forceRefreshDevicesFromRTDB(
  timeoutSeconds: number = 20
): Promise<{ raw: Record<string, any>; devices: SensorDevice[] }> {
  const snapshot = await get(ref(rtdb, 'dispositivos'));
  if (!snapshot.exists()) {
    return { raw: {}, devices: [] };
  }
  const incoming = snapshot.val() || {};
  const devices = Object.keys(incoming).map((key) => {
    recordDevicePacketArrival(key, incoming[key]);
    return mapRTDBDeviceToSensorDevice(key, incoming[key], timeoutSeconds);
  });
  return { raw: incoming, devices };
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
            sourceKind: 'esp32',
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

export function buildAuditRecordsFromAlerts(alerts: SafetyAlert[]): AlarmAuditRecord[] {
  const originMap: Record<string, string> = {
    emergencia_real: 'BITACORA_EMERGENCIA_REAL',
    simulacro: 'BITACORA_SIMULACRO',
    falsa_alarma_sensor: 'BITACORA_FALSA_ALARMA',
    prueba_operativa: 'BITACORA_PRUEBA_OPERATIVA',
  };

  return alerts
    .filter((a) => a.resolved || Boolean(a.resolutionDetails?.comment))
    .map((a) => {
      const dateSource = a.resolutionDetails?.resolvedAt || a.timestamp || '';
      const parts = dateSource.split(',').map((p) => p.trim());
      const fecha = parts[0] || dateSource || 'Reciente';
      const hora = parts[1] || (a.timestampMs ? new Date(a.timestampMs).toLocaleTimeString('es-CL') : '—');
      const origen = a.resolutionDetails?.resolutionType
        ? originMap[a.resolutionDetails.resolutionType] || 'BITACORA_CONSOLIDADA'
        : 'BITACORA_CONSOLIDADA';

      return {
        id: a.code ? `${a.code} (${a.id})` : a.id,
        deviceId: a.sensorCode || a.sensorId,
        deviceName: a.sectorName || a.sensorCode || a.sensorId,
        fecha,
        hora,
        origen,
        alertTitle: a.title,
        closingTitle: a.resolutionDetails?.closingTitle,
        attachments: a.resolutionDetails?.attachments,
        descripcion:
          a.resolutionDetails?.comment ||
          a.suggestedAction ||
          'Alerta cerrada y documentada en bitácora.',
        correctiveActions: a.resolutionDetails?.correctiveActions,
        resolvedBy: a.resolutionDetails?.resolvedBy || a.acknowledgedBy || 'Supervisor',
        metricSummary: `${a.variableName}: ${a.recordedValue} (Límite: ${a.safeLimit})`,
        co: 0,
        pm25: 0,
        temperatura: 0,
        humedad: 0,
        via: 'BITACORA_WEB_RTDB',
        timestampServer: a.timestampMs || 0,
        sourceKind: 'bitacora_web' as const,
      };
    });
}

export function subscribeToRTDBAlarmRecords(callback: (records: AlarmAuditRecord[]) => void): () => void {
  const devicesRef = ref(rtdb, 'dispositivos');
  const unsub = onValue(devicesRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val() || {};
      const devList: SensorDevice[] = Object.keys(data).map((k) => {
        recordDevicePacketArrival(k, data[k]);
        return mapRTDBDeviceToSensorDevice(k, data[k]);
      });
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

    // 1. Process direct usuarios (priorizar UIDs reales de Firebase Auth / manual_temp_uid_01 frente a llaves temporales usr-*)
    const sortedDirectKeys = Object.keys(directUsers).sort((a, b) => {
      const aTemp = a.startsWith('usr-') || a.startsWith('usr0') ? 1 : 0;
      const bTemp = b.startsWith('usr-') || b.startsWith('usr0') ? 1 : 0;
      return aTemp - bTemp;
    });
    sortedDirectKeys.forEach((key) => {
      const u = mapRTDBUserToUserProfile(key, directUsers[key]);
      const emailLower = (u.email || '').trim().toLowerCase();
      if (emailLower && seenEmails.has(emailLower)) {
        return;
      }
      if (emailLower) seenEmails.add(emailLower);
      list.push(u);
    });

    // 2. Process precarga usuarios
    Object.keys(precargaUsers).forEach((key) => {
      const pu = precargaUsers[key];
      const email = (pu?.email || '').trim().toLowerCase();
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

  const unsub1 = onValue(
    usersRef,
    (snapshot) => {
      if (snapshot.exists()) {
        directUsers = snapshot.val() || {};
        emitCombined();
      }
    },
    (err) => {
      console.warn('Acceso restringido o error leyendo /usuarios en RTDB:', err?.message || err);
    }
  );

  const unsub2 = onValue(
    precargaRef,
    (snapshot) => {
      if (snapshot.exists()) {
        precargaUsers = snapshot.val() || {};
        emitCombined();
      }
    },
    () => {
      // Precarga es opcional y puede estar restringida por reglas
    }
  );

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

export async function addUserToRTDB(
  user: UserProfile,
  actingUser?: UserProfile | null
): Promise<void> {
  try {
    // Regla de plataforma: Solo existe un único SuperAdmin; nuevos usuarios nunca pueden crearse como superadmin
    const isCanonicalSuper =
      user.id === PRIMARY_SUPERADMIN_UID || user.email.toLowerCase() === PRIMARY_SUPERADMIN_EMAIL;
    const safeRole: UserRole =
      user.role === 'superadmin' && !isCanonicalSuper ? 'admin' : user.role;

    const targetOrgId =
      actingUser?.role === 'admin'
        ? actingUser.organizationId || DEFAULT_ORGANIZATION_ID
        : user.organizationId || DEFAULT_ORGANIZATION.id;

    if (actingUser) {
      const check = canProvisionUserInOrganization(actingUser, targetOrgId, safeRole);
      if (!check.allowed) {
        throw new Error(check.reason || 'Permisos insuficientes para crear el usuario.');
      }
    }

    const userRef = ref(rtdb, `usuarios/${user.id}`);
    await set(userRef, {
      nombre: user.name,
      email: user.email,
      organizationId: targetOrgId,
      isAdmin: safeRole === 'superadmin' || safeRole === 'admin',
      isSuperUser: safeRole === 'superadmin',
      tipoUsuario: safeRole,
      isActive: user.status === 'activo',
      telefono: user.rut,
      cargo: user.shift || 'Turno Continuo A',
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
  if (actingUser && actingUser.role !== 'superadmin' && actingUser.role !== 'admin') {
    throw new Error('Permisos insuficientes para modificar usuarios.');
  }

  const userRef = ref(rtdb, `usuarios/${userId}`);
  const existingSnap = await get(userRef).catch(() => null);
  const existingData = existingSnap?.exists() ? existingSnap.val() : null;

  const existingEmail = (existingData?.email || updates.email || '').trim().toLowerCase();
  const isTargetSuperAdmin =
    userId === PRIMARY_SUPERADMIN_UID ||
    existingEmail === PRIMARY_SUPERADMIN_EMAIL ||
    existingData?.isSuperUser === true ||
    existingData?.tipoUsuario === 'superadmin';

  // Protección absoluta: Nadie (ni un admin) puede quitarle permisos ni desactivar al único SuperAdmin
  if (isTargetSuperAdmin) {
    if ((updates.role && updates.role !== 'superadmin') || updates.status === 'inactivo') {
      throw new Error('Acción denegada: No se pueden quitar permisos ni desactivar al SuperAdministrador.');
    }
  }

  // Regla: Solo existe un SuperAdmin en toda la plataforma (no se puede promover a otro usuario a superadmin)
  if (updates.role === 'superadmin' && !isTargetSuperAdmin) {
    throw new Error('Acción denegada: Solo puede existir un único SuperAdministrador en toda la plataforma.');
  }

  // Aislamiento de organización: un Administrador no puede modificar usuarios de otra organización
  if (actingUser && actingUser.role === 'admin') {
    const actorOrg = actingUser.organizationId || DEFAULT_ORGANIZATION_ID;
    const targetOrg = existingData?.organizationId || DEFAULT_ORGANIZATION_ID;
    if (actorOrg !== targetOrg) {
      throw new Error('Acción denegada: No puedes modificar usuarios de otra organización.');
    }
    if (updates.organizationId && updates.organizationId !== actorOrg) {
      throw new Error('Acción denegada: Un Administrador no puede reasignar usuarios a otra organización.');
    }
  }

  const rtdbUpdates: any = {
    updatedAt: new Date().toISOString(),
  };
  if (updates.name) rtdbUpdates.nombre = updates.name;
  if (updates.email) rtdbUpdates.email = updates.email;
  if (updates.organizationId && actingUser?.role === 'superadmin') {
    rtdbUpdates.organizationId = updates.organizationId;
  }
  if (updates.rut) rtdbUpdates.codigoId = updates.rut;
  if (updates.role) {
    rtdbUpdates.tipoUsuario = updates.role;
    rtdbUpdates.isAdmin = updates.role === 'admin' || updates.role === 'superadmin';
    rtdbUpdates.isSuperUser = updates.role === 'superadmin';
  }
  if (updates.status) rtdbUpdates.isActive = updates.status === 'activo';
  if (updates.assignedSector) rtdbUpdates.geoMina = updates.assignedSector;
  if (updates.assignedDeviceCode !== undefined) rtdbUpdates.deviceId = updates.assignedDeviceCode;

  try {
    await update(userRef, rtdbUpdates);

    // Sincronizar también cualquier otro nodo duplicado con el mismo correo en /usuarios
    if (existingEmail) {
      const allSnap = await get(ref(rtdb, 'usuarios')).catch(() => null);
      if (allSnap?.exists()) {
        const allUsers = allSnap.val() || {};
        const siblingKeys = Object.keys(allUsers).filter(
          (k) => k !== userId && (allUsers[k]?.email || '').trim().toLowerCase() === existingEmail
        );
        for (const sibKey of siblingKeys) {
          await update(ref(rtdb, `usuarios/${sibKey}`), rtdbUpdates).catch(() => {});
        }
      }
    }
  } catch (err: any) {
    console.warn('Error updating user in RTDB:', err);
    const rawMsg = String(err?.message || err || '');
    if (rawMsg.toLowerCase().includes('permission') || rawMsg.toLowerCase().includes('denied')) {
      throw new Error(
        'Firebase RTDB rechazó actualizar el usuario (PERMISSION_DENIED). Verifica las Reglas de Realtime Database para el SuperAdmin.'
      );
    }
    throw err;
  }
}

export async function addRentalContractToRTDB(rental: DeviceRental): Promise<void> {
  try {
    const contractRef = ref(rtdb, `contratos/${rental.contractNumber}`);
    await set(contractRef, {
      deviceId: rental.deviceCode,
      organizationId: rental.organizationId || DEFAULT_ORGANIZATION.id,
      empresa: rental.provider,
      monto: rental.monthlyCostClp,
      tec: rental.assignedTechnician,
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

function formatAlertTimestamp(ts: unknown, fallbackText?: string): string {
  if (typeof ts === 'number' && !isNaN(ts) && ts > 0) {
    return new Date(ts).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (typeof ts === 'string' && ts.trim()) {
    return ts;
  }
  return fallbackText || 'Reciente';
}

function buildAlertBasePayload(alert: SafetyAlert, now: number): Record<string, any> {
  return {
    id: alert.id,
    codigo: alert.code,
    organizationId: alert.organizationId || DEFAULT_ORGANIZATION.id,
    titulo: alert.title,
    severidad: alert.severity,
    variable: alert.variableName,
    sensorId: alert.sensorId,
    sensorCode: alert.sensorCode,
    sector: alert.sectorName,
    valor: alert.recordedValue,
    limite: alert.safeLimit,
    atendida: Boolean(alert.acknowledged),
    ...(alert.acknowledgedBy ? { atendida_por: alert.acknowledgedBy } : {}),
    ...(alert.acknowledgedAt ? { timestamp_atendida: alert.acknowledgedAt } : {}),
    resuelta: Boolean(alert.resolved),
    accionSugerida: alert.suggestedAction || '',
    creado_en_texto: alert.timestamp || formatAlertTimestamp(alert.timestampMs || now),
    timestamp: alert.timestampMs || now,
  };
}

export async function broadcastAlertToRTDB(alert: SafetyAlert): Promise<void> {
  try {
    const now = alert.timestampMs || Date.now();
    const alertRef = ref(rtdb, `alertas/${alert.id}`);
    const payload = buildAlertBasePayload(alert, now);
    if (alert.resolutionDetails) {
      payload.tipo_resolucion = alert.resolutionDetails.resolutionType;
      if (alert.resolutionDetails.closingTitle) {
        payload.titulo_cierre = alert.resolutionDetails.closingTitle;
      }
      payload.descripcion_cierre = alert.resolutionDetails.comment;
      payload.acciones_correctivas = alert.resolutionDetails.correctiveActions || '';
      payload.resuelto_por = alert.resolutionDetails.resolvedBy;
      payload.resuelto_en = alert.resolutionDetails.resolvedAt;
      payload.timestamp_cierre = now;
      if (alert.resolutionDetails.attachments?.length) {
        payload.adjuntos = alert.resolutionDetails.attachments;
      }
    }
    await set(alertRef, payload);

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

export async function acknowledgeAlertInRTDB(
  alertOrId: SafetyAlert | string,
  acknowledgedBy: string
): Promise<void> {
  const alertId = typeof alertOrId === 'string' ? alertOrId : alertOrId.id;
  const now = Date.now();
  const baseFields =
    typeof alertOrId === 'object' && alertOrId !== null
      ? buildAlertBasePayload(alertOrId, alertOrId.timestampMs || now)
      : {};

  await update(ref(rtdb, `alertas/${alertId}`), {
    ...baseFields,
    id: alertId,
    atendida: true,
    atendida_por: acknowledgedBy,
    timestamp_atendida: now,
  });
}

export function subscribeToRTDBAlerts(callback: (alerts: SafetyAlert[]) => void): () => void {
  let rawAlertas: Record<string, any> = {};
  let rawBitacora: Record<string, any> = {};
  let alertasReady = false;

  const emitCombined = () => {
    if (!alertasReady) return;
    const allIds = new Set([...Object.keys(rawAlertas), ...Object.keys(rawBitacora)]);
    const mapped: SafetyAlert[] = [];

    allIds.forEach((id) => {
      const data = rawAlertas[id] || {};
      const bit = rawBitacora[id] || {};
      if (!data && !bit) return;

      const resolved = Boolean(data.resuelta || bit.descripcion || bit.tipoResolucion);
      const comment = data.descripcion_cierre || bit.descripcion || '';
      const hasResolution =
        resolved ||
        Boolean(comment) ||
        Boolean(data.tipo_resolucion) ||
        Boolean(bit.tipoResolucion);

      const attachmentsRaw = data.adjuntos || bit.adjuntos;
      const attachments: AlertAttachment[] | undefined = Array.isArray(attachmentsRaw)
        ? attachmentsRaw
        : attachmentsRaw && typeof attachmentsRaw === 'object'
        ? (Object.values(attachmentsRaw) as AlertAttachment[])
        : undefined;

      const tsNum = Math.max(
        typeof data.timestamp_cierre === 'number' ? data.timestamp_cierre : 0,
        typeof bit.timestamp === 'number' ? bit.timestamp : 0,
        typeof data.timestamp === 'number' ? data.timestamp : 0
      );

      const mappedAlert: SafetyAlert = {
        id,
        code: data.codigo || id,
        organizationId: data.organizationId || DEFAULT_ORGANIZATION.id,
        title: data.titulo || (bit.idAlerta ? `Contingencia Registrada (${bit.idAlerta})` : 'Alerta de Seguridad'),
        severity: (data.severidad as SafetyAlert['severity']) || 'advertencia',
        variableName: data.variable || 'Variable Ambiental',
        sensorId: data.sensorId || 'device_38A839E81F84',
        sensorCode: data.sensorCode || data.sensorId || 'ESP32',
        sectorName: data.sector || 'Mina Chuquicamata - Rampa Principal',
        recordedValue: data.valor || '-',
        safeLimit: data.limite || '-',
        timestamp: data.creado_en_texto || formatAlertTimestamp(tsNum, bit.fecha),
        timestampMs: tsNum,
        acknowledged: Boolean(data.atendida || resolved),
        acknowledgedBy: data.atendida_por,
        acknowledgedAt: typeof data.timestamp_atendida === 'number' ? data.timestamp_atendida : undefined,
        resolved,
        suggestedAction:
          data.accionSugerida ||
          data.descripcion ||
          'Verificar condiciones del sector y registrar medidas de control.',
        ...(hasResolution
          ? {
              resolutionDetails: {
                resolutionType: data.tipo_resolucion || bit.tipoResolucion || 'simulacro',
                closingTitle: data.titulo_cierre || bit.tituloCierre || undefined,
                comment,
                correctiveActions: data.acciones_correctivas || bit.accionesCorrectivas || '',
                resolvedBy: data.resuelto_por || bit.supervisor || 'Supervisor de Turno',
                resolvedAt:
                  data.resuelto_en ||
                  bit.fecha ||
                  formatAlertTimestamp(data.timestamp_cierre || bit.timestamp),
                attachments,
              },
            }
          : {}),
      };

      mapped.push(mappedAlert);
    });

    mapped.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));

    const seenActiveEvtKeys = new Set<string>();
    const deduped: SafetyAlert[] = [];

    for (const item of mapped) {
      const isAutoThresholdEvent =
        item.id.startsWith('evt_') && !item.resolved && !item.acknowledged && !item.resolutionDetails?.comment;
      if (isAutoThresholdEvent) {
        const dedupKey = `${item.sensorId}::${item.variableName}`;
        if (seenActiveEvtKeys.has(dedupKey)) {
          continue;
        }
        seenActiveEvtKeys.add(dedupKey);
      }
      deduped.push(item);
    }

    callback(deduped);
  };

  const unsubAlertas = onValue(
    ref(rtdb, 'alertas'),
    (snapshot) => {
      rawAlertas = snapshot.exists() ? snapshot.val() || {} : {};
      alertasReady = true;
      emitCombined();
    },
    (err) => {
      console.warn('Error subscribing to RTDB /alertas:', err);
      alertasReady = true;
      emitCombined();
    }
  );

  const unsubBitacora = onValue(
    ref(rtdb, 'bitacora_contingencias'),
    (snapshot) => {
      rawBitacora = snapshot.exists() ? snapshot.val() || {} : {};
      emitCombined();
    },
    (err) => {
      console.warn('Error subscribing to RTDB /bitacora_contingencias:', err);
    }
  );

  return () => {
    unsubAlertas();
    unsubBitacora();
  };
}

export function subscribeToRTDBDrill(
  callback: (drillState: { active: boolean; type?: string; nombre?: string }) => void
): () => void {
  const simulacroRef = ref(rtdb, 'simulacro');
  return onValue(simulacroRef, (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      callback({
        active: val?.activo === true,
        type: val?.tipo,
        nombre: val?.nombre,
      });
    } else {
      callback({ active: false });
    }
  });
}

/**
 * Registra el cierre y clasificación de una alerta en Firebase RTDB
 */
export async function resolveAlertInRTDB(
  alertOrId: SafetyAlert | string,
  details: AlertResolutionDetails
): Promise<void> {
  const alertId = typeof alertOrId === 'string' ? alertOrId : alertOrId.id;
  const now = Date.now();
  const baseFields =
    typeof alertOrId === 'object' && alertOrId !== null
      ? buildAlertBasePayload(alertOrId, alertOrId.timestampMs || now)
      : {};

  const cleanAttachments = (details.attachments || []).map((a) => ({ ...a }));

  const alertRef = ref(rtdb, `alertas/${alertId}`);
  await update(alertRef, {
    ...baseFields,
    id: alertId,
    resuelta: true,
    atendida: true,
    tipo_resolucion: details.resolutionType,
    ...(details.closingTitle ? { titulo_cierre: details.closingTitle } : {}),
    descripcion_cierre: details.comment,
    acciones_correctivas: details.correctiveActions || '',
    resuelto_por: details.resolvedBy,
    resuelto_en: details.resolvedAt,
    timestamp_cierre: now,
    ...(cleanAttachments.length > 0 ? { adjuntos: cleanAttachments } : {}),
  });

  const bitacoraRef = ref(rtdb, `bitacora_contingencias/${alertId}`);
  await set(bitacoraRef, {
    alertaId: alertId,
    idAlerta: alertId,
    titulo: details.closingTitle || (typeof alertOrId === 'object' ? alertOrId.title : 'Contingencia Resuelta'),
    estado: 'resuelta',
    tipoResolucion: details.resolutionType,
    ...(details.closingTitle ? { tituloCierre: details.closingTitle } : {}),
    descripcion: details.comment,
    accionesCorrectivas: details.correctiveActions || '',
    supervisor: details.resolvedBy,
    fecha: details.resolvedAt,
    timestamp: now,
    ...(cleanAttachments.length > 0 ? { adjuntos: cleanAttachments } : {}),
  }).catch((err) => {
    console.warn('Warning saving copy to bitacora_contingencias:', err);
  });
}

export async function closeAlertLifecycleInRTDB(
  alertId: string,
  reason: string,
  options?: { clearEmergencyIfNone?: boolean }
): Promise<void> {
  const now = Date.now();
  const alertRef = ref(rtdb, `alertas/${alertId}`);
  try {
    const snap = await get(alertRef).catch(() => null);
    if (snap && snap.exists()) {
      await update(alertRef, {
        resuelta: true,
        atendida: true,
        auto_recuperada: true,
        descripcion_cierre: reason,
        resuelto_por: 'Motor Automático MineSafe',
        resuelto_en: formatAlertTimestamp(now),
        timestamp_cierre: now,
      });
    }
    if (options?.clearEmergencyIfNone) {
      await update(ref(rtdb, 'emergencia'), {
        activa: false,
        recuperado_en: now,
        timestamp: now,
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Error closing alert lifecycle in RTDB:', err);
  }
}

export async function resolveActiveAlertsInRTDB(
  alertsToClose: SafetyAlert[],
  reasonText: string,
  resolvedBy: string
): Promise<void> {
  const unresolved = alertsToClose.filter((a) => !a.resolved);
  if (unresolved.length === 0) return;
  const now = Date.now();
  const resolvedAt = formatAlertTimestamp(now);

  await Promise.all(
    unresolved.map(async (alert) => {
      const baseFields = buildAlertBasePayload(alert, alert.timestampMs || now);
      await update(ref(rtdb, `alertas/${alert.id}`), {
        ...baseFields,
        id: alert.id,
        resuelta: true,
        atendida: true,
        tipo_resolucion: alert.id.startsWith('alt-drill-') ? 'simulacro' : 'prueba_operativa',
        descripcion_cierre: reasonText,
        acciones_correctivas: 'Restablecimiento de niveles normales y silenciamiento desde consola central.',
        resuelto_por: resolvedBy,
        resuelto_en: resolvedAt,
        timestamp_cierre: now,
      }).catch(() => {});
    })
  );
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

  // Si es SuperAdmin y editó 'global', sincronizar también /configuracion_plataforma/metrics
  if (targetId === 'global' && user.role === 'superadmin') {
    await update(ref(rtdb, 'configuracion_plataforma/metrics'), {
      coPreventivo: payload.mq2.preventivo,
      coAdvertencia: payload.mq2.advertencia,
      coCritico: payload.mq2.critico,
      pm25Preventivo: payload.pm25.preventivo,
      pm25Advertencia: payload.pm25.advertencia,
      pm25Critico: payload.pm25.critico,
      tempPreventivo: payload.temperatura.preventivo,
      tempAdvertencia: payload.temperatura.advertencia,
      tempCritico: payload.temperatura.critico,
      humPreventivo: payload.humedad.preventivo,
      humAdvertencia: payload.humedad.advertencia,
      humCritico: payload.humedad.critico,
    }).catch(() => {});
  }
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
    userOverridesByEmail: {},
    equiposSubTabRolePermissions: {
      admin: {
        asignaciones: true,
        arriendos: true,
        pagos: true,
        inventario: true,
      },
      operador: {
        asignaciones: true,
        arriendos: true,
        pagos: true,
        inventario: true,
      },
    },
    equiposSubTabUserOverrides: {},
    equiposSubTabUserOverridesByEmail: {},
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
      organizationId: DEFAULT_ORGANIZATION.id,
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

export function normalizeEmailOverrideKey(email?: string | null): string {
  if (!email) return '';
  return email.trim().toLowerCase().replace(/[.#$/[\]]/g, '_');
}

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
  const emailKey = normalizeEmailOverrideKey(user.email);
  const byIdOverride: WindowOverrideValue | undefined =
    config?.visibility?.userOverrides?.[user.id]?.[controllableTab];
  const byEmailOverride: WindowOverrideValue | undefined =
    emailKey ? config?.visibility?.userOverridesByEmail?.[emailKey]?.[controllableTab] : undefined;

  const userOverride: WindowOverrideValue | undefined =
    byIdOverride && byIdOverride !== 'inherit'
      ? byIdOverride
      : byEmailOverride;

  if (userOverride === 'allow') return true;
  if (userOverride === 'block') return false;

  const roleKey = user.role === 'admin' ? 'admin' : 'operador';
  const configuredRoleVal = config?.visibility?.rolePermissions?.[roleKey]?.[controllableTab];
  if (typeof configuredRoleVal === 'boolean') {
    return configuredRoleVal;
  }

  return DEFAULT_PLATFORM_CONFIG.visibility.rolePermissions[roleKey][controllableTab];
}

export function isEquiposSubTabVisibleForUser(
  subTab: EquiposSubTab,
  user: UserProfile | null,
  config?: PlatformConfig | null
): boolean {
  if (!user) return false;
  if (user.role === 'superadmin') {
    return true;
  }

  const emailKey = normalizeEmailOverrideKey(user.email);
  const byIdOverride: WindowOverrideValue | undefined =
    config?.visibility?.equiposSubTabUserOverrides?.[user.id]?.[subTab];
  const byEmailOverride: WindowOverrideValue | undefined =
    emailKey ? config?.visibility?.equiposSubTabUserOverridesByEmail?.[emailKey]?.[subTab] : undefined;

  const userOverride: WindowOverrideValue | undefined =
    byIdOverride && byIdOverride !== 'inherit'
      ? byIdOverride
      : byEmailOverride;

  if (userOverride === 'allow') return true;
  if (userOverride === 'block') return false;

  const roleKey = user.role === 'admin' ? 'admin' : 'operador';
  const configuredRoleVal = config?.visibility?.equiposSubTabRolePermissions?.[roleKey]?.[subTab];
  if (typeof configuredRoleVal === 'boolean') {
    return configuredRoleVal;
  }

  return DEFAULT_PLATFORM_CONFIG.visibility.equiposSubTabRolePermissions![roleKey][subTab];
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
      userOverridesByEmail: raw?.visibility?.userOverridesByEmail || {},
      equiposSubTabRolePermissions: {
        admin: {
          ...DEFAULT_PLATFORM_CONFIG.visibility.equiposSubTabRolePermissions!.admin,
          ...(raw?.visibility?.equiposSubTabRolePermissions?.admin || {}),
        },
        operador: {
          ...DEFAULT_PLATFORM_CONFIG.visibility.equiposSubTabRolePermissions!.operador,
          ...(raw?.visibility?.equiposSubTabRolePermissions?.operador || {}),
        },
      },
      equiposSubTabUserOverrides: raw?.visibility?.equiposSubTabUserOverrides || {},
      equiposSubTabUserOverridesByEmail: raw?.visibility?.equiposSubTabUserOverridesByEmail || {},
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

  const payload: PlatformConfig = JSON.parse(
    JSON.stringify({
      ...config,
      actualizado_en: Date.now(),
      actualizado_por: `${actingUser.name} (SuperAdmin)`,
    })
  );

  try {
    await set(ref(rtdb, 'configuracion_plataforma'), payload);
  } catch (err: any) {
    const rawMsg = String(err?.message || err || '');
    if (rawMsg.toLowerCase().includes('permission') || rawMsg.toLowerCase().includes('denied')) {
      throw new Error(
        'Firebase RTDB rechazó guardar en /configuracion_plataforma (PERMISSION_DENIED). Verifica en Realtime Database → Reglas del proyecto minefase-fc5f5 que el SuperAdmin tenga permiso de escritura.'
      );
    }
    throw err;
  }

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

/**
 * ============================================================================
 * PERSISTENCIA DE FAENAS MINERAS, SECTORES Y CUADRILLAS ASIGNADAS (/faenas)
 * ============================================================================
 */
const FAENAS_CACHE_KEY = 'minesafe_saved_faenas_v1';

function normalizeSector(raw: any, index: number): MiningSector {
  const crewsRaw = raw?.assignedCrews;
  const assignedCrews: string[] = Array.isArray(crewsRaw)
    ? crewsRaw.filter((c) => typeof c === 'string' && c.trim() !== '')
    : crewsRaw && typeof crewsRaw === 'object'
    ? (Object.values(crewsRaw).filter((c) => typeof c === 'string' && c.trim() !== '') as string[])
    : [];

  return {
    id: raw?.id || `sec-${Date.now()}-${index}`,
    name: raw?.name || `Sector ${index + 1}`,
    code: raw?.code || `SEC-0${index + 1}`,
    depthMeters: typeof raw?.depthMeters === 'number' ? raw.depthMeters : Number(raw?.depthMeters) || 200,
    type: raw?.type || 'socavon',
    activeWorkers: typeof raw?.activeWorkers === 'number' ? raw.activeWorkers : Number(raw?.activeWorkers) || 0,
    sensorsCount: typeof raw?.sensorsCount === 'number' ? raw.sensorsCount : Number(raw?.sensorsCount) || 1,
    generalStatus: raw?.generalStatus || 'normal',
    ventilationFanStatus: raw?.ventilationFanStatus || 'operativo_normal',
    assignedCrews,
  };
}

export function normalizeMiningSite(raw: any, fallbackId?: string): MiningSite {
  const rawSectors = raw?.activeSectors;
  const sectorsArr: any[] = Array.isArray(rawSectors)
    ? rawSectors
    : rawSectors && typeof rawSectors === 'object'
    ? Object.values(rawSectors)
    : [];

  return {
    id: raw?.id || fallbackId || `site-${Date.now()}`,
    organizationId: raw?.organizationId || DEFAULT_ORGANIZATION.id,
    name: raw?.name || 'Faena Minera',
    company: raw?.company || 'Empresa Minera',
    location: raw?.location || (raw?.comuna && raw?.region ? `${raw.comuna}, ${raw.region}` : 'Chile'),
    comuna: raw?.comuna || undefined,
    region: raw?.region || 'Antofagasta',
    type: raw?.type || 'subterranea',
    elevationMsl: typeof raw?.elevationMsl === 'number' ? raw.elevationMsl : Number(raw?.elevationMsl) || 2400,
    isPreloaded: Boolean(raw?.isPreloaded),
    activeSectors: sectorsArr.map((s, idx) => normalizeSector(s, idx)),
  };
}

export function loadCachedSites(): MiningSite[] {
  try {
    const raw = localStorage.getItem(FAENAS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s) => normalizeMiningSite(s));
  } catch {
    return [];
  }
}

export function saveCachedSites(sites: MiningSite[]): void {
  try {
    localStorage.setItem(FAENAS_CACHE_KEY, JSON.stringify(sites));
  } catch {
    // ignore storage quota errors
  }
}

export function mergeMiningSites(baseSites: MiningSite[], incomingSites: MiningSite[]): MiningSite[] {
  const map = new Map<string, MiningSite>();
  baseSites.forEach((s) => map.set(s.id, normalizeMiningSite(s, s.id)));
  incomingSites.forEach((s) => map.set(s.id, normalizeMiningSite(s, s.id)));
  return Array.from(map.values());
}

export async function saveSiteToRTDB(
  site: MiningSite
): Promise<{ savedToRTDB: boolean; error?: string }> {
  const cleanSite: MiningSite = JSON.parse(JSON.stringify(normalizeMiningSite(site, site.id)));
  const cached = loadCachedSites();
  saveCachedSites(mergeMiningSites(cached, [cleanSite]));

  try {
    await set(ref(rtdb, `faenas/${cleanSite.id}`), {
      ...cleanSite,
      updatedAt: Date.now(),
    });
    return { savedToRTDB: true };
  } catch (err: any) {
    console.warn('Error saving site to RTDB (/faenas):', err);
    return {
      savedToRTDB: false,
      error: err?.message || 'Guardado en respaldo local (sin permisos en /faenas de RTDB).',
    };
  }
}

export function subscribeToRTDBSites(
  callback: (sites: MiningSite[]) => void
): () => void {
  const sitesRef = ref(rtdb, 'faenas');
  return onValue(
    sitesRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val() || {};
        const remoteList = Object.keys(val).map((k) => normalizeMiningSite(val[k], k));
        callback(remoteList);
      } else {
        callback([]);
      }
    },
    (err) => {
      console.warn('Error subscribing to RTDB /faenas:', err);
      callback([]);
    }
  );
}

/**
 * ============================================================================
 * ORGANIZACIONES MULTI-EMPRESA (/organizaciones)
 * ============================================================================
 */
export function subscribeToRTDBOrganizations(
  callback: (orgs: Organization[]) => void
): () => void {
  const orgsRef = ref(rtdb, 'organizaciones');
  return onValue(
    orgsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val() || {};
        const list: Organization[] = Object.keys(val).map((k) => ({
          id: k,
          name: val[k]?.name || k,
          rut: val[k]?.rut || '',
          industry: val[k]?.industry || 'Minería',
          status: val[k]?.status === 'suspendida' ? 'suspendida' : 'activa',
          createdAt: typeof val[k]?.createdAt === 'number' ? val[k].createdAt : Date.now(),
          updatedAt: val[k]?.updatedAt,
          createdBy: val[k]?.createdBy,
        }));
        if (!list.some((o) => o.id === DEFAULT_ORGANIZATION.id)) {
          list.unshift(DEFAULT_ORGANIZATION);
        }
        callback(list);
      } else {
        callback([DEFAULT_ORGANIZATION]);
      }
    },
    () => {
      callback([DEFAULT_ORGANIZATION]);
    }
  );
}

export async function saveOrganizationToRTDB(
  org: Organization,
  actingUser: UserProfile
): Promise<void> {
  if (actingUser.role !== 'superadmin') {
    throw new Error('Solo el SuperAdministrador puede crear o editar organizaciones.');
  }
  const cleanId = org.id.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  await set(ref(rtdb, `organizaciones/${cleanId}`), {
    id: cleanId,
    name: org.name.trim(),
    rut: org.rut?.trim() || '',
    industry: org.industry?.trim() || 'Minería',
    status: org.status || 'activa',
    createdAt: org.createdAt || Date.now(),
    updatedAt: Date.now(),
    createdBy: actingUser.email || actingUser.name,
  });
}

export async function deleteOrganizationFromRTDB(
  orgId: string,
  actingUser: UserProfile
): Promise<void> {
  if (actingUser.role !== 'superadmin') {
    throw new Error('Solo el SuperAdministrador puede eliminar organizaciones.');
  }
  if (orgId === DEFAULT_ORGANIZATION.id) {
    throw new Error('No se puede eliminar la organización principal por defecto.');
  }
  await remove(ref(rtdb, `organizaciones/${orgId}`));
}

/**
 * ============================================================================
 * ASIGNACIONES DE PERSONAL (/asignaciones)
 * ============================================================================
 */
export function subscribeToRTDBAssignments(
  callback: (assignments: WorkerAssignment[]) => void
): () => void {
  const assignRef = ref(rtdb, 'asignaciones');
  return onValue(
    assignRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val() || {};
        const list: WorkerAssignment[] = Object.keys(val).map((k) => ({
          id: k,
          organizationId: val[k]?.organizationId || DEFAULT_ORGANIZATION.id,
          workerRut: val[k]?.workerRut || '',
          workerName: val[k]?.workerName || 'Operador',
          role: val[k]?.role || 'Operador Mina',
          crew: val[k]?.crew || 'Cuadrilla Alfa',
          sectorName: val[k]?.sectorName || 'Faena Central',
          assignedDeviceId: val[k]?.assignedDeviceId || '',
          assignedDeviceCode: val[k]?.assignedDeviceCode || '',
          assignmentDate: val[k]?.assignmentDate || new Date().toISOString().split('T')[0],
          deviceBattery: typeof val[k]?.deviceBattery === 'number' ? val[k].deviceBattery : 100,
          emergencyContact: val[k]?.emergencyContact || '',
        }));
        callback(list);
      } else {
        callback([]);
      }
    },
    () => callback([])
  );
}

export async function saveAssignmentToRTDB(assignment: WorkerAssignment): Promise<void> {
  const cleanId = assignment.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  await set(ref(rtdb, `asignaciones/${cleanId}`), {
    ...assignment,
    id: cleanId,
    organizationId: assignment.organizationId || DEFAULT_ORGANIZATION.id,
    updatedAt: Date.now(),
  });
}

/**
 * ============================================================================
 * HISTORIAL REAL DE TELEMETRÍA (/historial_telemetria/{deviceId}/{timestamp})
 * ============================================================================
 */
const lastTelemetryWriteMap: Record<string, { ts: number; sig: string }> = {};

export async function recordTelemetryHistoryPoint(device: SensorDevice): Promise<void> {
  if (!device.gatewayOnline || device.status === 'desconectado') return;
  if (
    device.rawCO === undefined &&
    device.rawPM25 === undefined &&
    device.rawTemp === undefined &&
    device.rawHum === undefined
  ) {
    return;
  }

  const now = Date.now();
  const prev = lastTelemetryWriteMap[device.id];
  const sig = `${device.rawCO ?? 'x'}|${device.rawPM25 ?? 'x'}|${device.rawTemp ?? 'x'}|${device.rawHum ?? 'x'}`;

  // Throttling: mínimo 5 segundos entre puntos; si no cambiaron los valores, guardar latido cada 30s
  if (prev) {
    const elapsed = now - prev.ts;
    if (elapsed < 5000) return;
    if (prev.sig === sig && elapsed < 30000) return;
  }

  lastTelemetryWriteMap[device.id] = { ts: now, sig };
  const sample: TelemetryHistoryPoint = {
    timestamp: now,
    co: device.rawCO ?? null,
    pm25: device.rawPM25 ?? null,
    temperatura: device.rawTemp ?? null,
    humedad: device.rawHum ?? null,
  };

  try {
    await set(ref(rtdb, `historial_telemetria/${device.id}/${now}`), sample);
  } catch (err) {
    console.warn('Error persisting telemetry history sample:', err);
  }
}

export function subscribeToTelemetryHistory(
  deviceId: string,
  rangeHours: number,
  callback: (points: TelemetryHistoryPoint[]) => void
): () => void {
  if (!deviceId) {
    callback([]);
    return () => {};
  }
  const histQuery = query(
    ref(rtdb, `historial_telemetria/${deviceId}`),
    orderByKey(),
    limitToLast(600)
  );
  return onValue(
    histQuery,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      const cutoff = Date.now() - rangeHours * 3600 * 1000;
      const raw = snapshot.val() || {};
      const points: TelemetryHistoryPoint[] = Object.keys(raw)
        .map((k) => {
          const item = raw[k];
          const ts = typeof item?.timestamp === 'number' ? item.timestamp : Number(k);
          return {
            timestamp: ts,
            co: typeof item?.co === 'number' ? item.co : null,
            pm25: typeof item?.pm25 === 'number' ? item.pm25 : null,
            temperatura: typeof item?.temperatura === 'number' ? item.temperatura : null,
            humedad: typeof item?.humedad === 'number' ? item.humedad : null,
          };
        })
        .filter((p) => Number.isFinite(p.timestamp) && p.timestamp >= cutoff)
        .sort((a, b) => a.timestamp - b.timestamp);
      callback(points);
    },
    (err) => {
      console.warn('Error subscribing to telemetry history:', err);
      callback([]);
    }
  );
}

/**
 * ============================================================================
 * ADJUNTOS DE EVIDENCIA EN FIREBASE STORAGE (/adjuntos)
 * ============================================================================
 */
const ALLOWED_ATTACHMENT_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB

export async function uploadAlertAttachmentToStorage(
  alertId: string,
  file: File,
  uploadedBy: string
): Promise<AlertAttachment> {
  if (!ALLOWED_ATTACHMENT_MIME.has(file.type)) {
    throw new Error('Formato no permitido. Solo se aceptan imágenes JPG, PNG, WEBP o documentos PDF.');
  }
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('El archivo supera el límite máximo permitido de 5 MB.');
  }

  const safeAlertId = alertId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const attId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const storagePath = `adjuntos/${safeAlertId}/${attId}_${safeName}`;
  const fileRef = storageRef(minefaseStorage, storagePath);

  try {
    await uploadBytes(fileRef, file, { contentType: file.type });
    const downloadUrl = await getDownloadURL(fileRef);

    const attachment: AlertAttachment = {
      id: attId,
      alertId: safeAlertId,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      downloadUrl,
      storagePath,
      uploadedBy,
      createdAt: Date.now(),
    };

    await set(ref(rtdb, `adjuntos/${attId}`), attachment).catch(() => {});
    return attachment;
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'storage/unauthorized' || String(err?.message || '').includes('permission')) {
      throw new Error(
        'Firebase Storage rechazó la subida de evidencia (storage/unauthorized). Configura las reglas de Storage para usuarios autenticados en minefase-fc5f5.'
      );
    }
    throw new Error(err?.message || 'No se pudo subir el archivo de evidencia a Firebase Storage.');
  }
}

export async function deleteAlertAttachment(attachment: AlertAttachment): Promise<void> {
  if (attachment.storagePath) {
    await deleteObject(storageRef(minefaseStorage, attachment.storagePath)).catch(() => {});
  }
  await remove(ref(rtdb, `adjuntos/${attachment.id}`)).catch(() => {});
}







