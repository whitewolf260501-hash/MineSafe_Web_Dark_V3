import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { MonitoringView } from './components/MonitoringView';
import { AlertsView } from './components/AlertsView';
import { DevicesAndRentalsView } from './components/DevicesAndRentalsView';
import { HistoricalReportsView } from './components/HistoricalReportsView';
import { MiningSectorsView } from './components/MiningSectorsView';
import { UsersManagementView } from './components/UsersManagementView';
import { AlertConfigurationView } from './components/AlertConfigurationView';
import { SuperAdminControlView } from './components/SuperAdminControlView';
import { LoginModal } from './components/LoginModal';
import { EmergencyModal, DrillType } from './components/EmergencyModal';
import { alertEngine } from './services/alertEngine';


import { 
  NavigationTab, 
  ControllableTab,
  TelemetryVariable, 
  SensorDevice, 
  SafetyAlert, 
  DeviceRental, 
  WorkerAssignment, 
  MiningSite, 
  UserProfile,
  UserRole,
  AlertResolutionDetails,
  DrillDebriefRecord,
  PlatformConfig
} from './types';

import { 
  INITIAL_VARIABLES, 
  MINING_SITES, 
  INITIAL_ALERTS, 
  INITIAL_RENTALS, 
  INITIAL_ASSIGNMENTS, 
  PRELOADED_USERS 
} from './data/mockData';

import { 
  testConnection, 
  subscribeToRTDBDevices, 
  subscribeToRTDBUsers, 
  subscribeToRTDBRentals,
  updateDeviceInRTDB,
  addUserToRTDB,
  updateUserInRTDB,
  addRentalContractToRTDB,
  recordPaymentInRTDB,
  USER_RTDB_URL,
  toggleGatewayAlarmInRTDB,
  shutdownAlarmCompletelyInRTDB,
  toggleGatewayLightInRTDB,
  resetGatewayDataInRTDB,
  broadcastDrillToRTDB,
  broadcastAlertToRTDB,
  subscribeToRTDBDrill,
  resolveAlertInRTDB,
  saveDrillDebriefInRTDB,
  DEFAULT_PLATFORM_CONFIG,
  subscribeToPlatformConfig,
  isTabVisibleForUser,
  subscribeToFirebaseAuth,
  logoutFromFirebaseAuth,
  verifySuperAdminPrivileges
} from './services/firebase';

import { soundAlert } from './services/audioAlert';
import { ShieldAlert, AlertTriangle, X, Megaphone, Lock, CheckCircle2 } from 'lucide-react';

const INITIAL_SINGLE_DEVICE: SensorDevice = {
  id: 'device_38A839E81F84',
  code: 'device_38A839E81F84',
  name: 'Nodo Sensor & Gateway Principal (1F84)',
  type: 'estacion_fija',
  sectorId: 'sec-device_38A839E81F84',
  sectorName: 'Mina Chuquicamata - Rampa Principal',
  batteryPct: 95,
  signalStrength: 'debil',
  lastPing: 'Conectando...',
  status: 'desconectado',
  assignedTo: 'Manuel Crisostomo',
  deviceCategory: 'gateway_sensor',
  localIp: '192.168.4.1',
  gatewayOnline: false,
  metrics: {
    temperatura: 22.4,
    humedad: 48,
    co2: 520,
    co: 12,
    ch4: 0.1,
    o2: 20.9,
    flujoAire: 1.25,
    ruido: 74,
    polvoPM: 25,
  },
};

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [variables, setVariables] = useState<TelemetryVariable[]>(INITIAL_VARIABLES);
  const [devices, setDevices] = useState<SensorDevice[]>([INITIAL_SINGLE_DEVICE]);
  const [alerts, setAlerts] = useState<SafetyAlert[]>(INITIAL_ALERTS);
  const [rentals, setRentals] = useState<DeviceRental[]>(INITIAL_RENTALS);
  const [assignments, setAssignments] = useState<WorkerAssignment[]>(INITIAL_ASSIGNMENTS);
  const [sites, setSites] = useState<MiningSite[]>(MINING_SITES);
  const [currentSite, setCurrentSite] = useState<MiningSite>(MINING_SITES[0]);
  const [usersList, setUsersList] = useState<UserProfile[]>(PRELOADED_USERS);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const [activeTelemetryDeviceId, setActiveTelemetryDeviceId] = useState<string>('device_38A839E81F84');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  const [evacuationActive, setEvacuationActive] = useState<boolean>(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);
  const [isAlarmActive, setIsAlarmActive] = useState<boolean>(false);
  const [isLightActive, setIsLightActive] = useState<boolean>(false);
  const [dismissEmergencyBanner, setDismissEmergencyBanner] = useState<boolean>(false);
  const [isDrillActive, setIsDrillActive] = useState<boolean>(false);
  const [drillType, setDrillType] = useState<DrillType | null>(null);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [alarmFeedback, setAlarmFeedback] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);

  const showAlarmFeedback = useCallback((message: string, tone: 'error' | 'success') => {
    setAlarmFeedback({ message, tone });
    setTimeout(() => {
      setAlarmFeedback((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  }, []);

  // Strict Firebase Authentication session listener (never trust localStorage alone)
  useEffect(() => {
    try {
      localStorage.removeItem('minesafe_active_user');
    } catch { /* ignore */ }
    const unsubAuth = subscribeToFirebaseAuth((authenticatedUser) => {
      setCurrentUser(authenticatedUser);
      setIsAuthChecking(false);
    });
    return () => unsubAuth();
  }, []);

  // Initialize and connect to user's Firebase Realtime Database
  useEffect(() => {
    let unsubDevices: (() => void) | null = null;
    let unsubUsers: (() => void) | null = null;
    let unsubRentals: (() => void) | null = null;
    let unsubDrill: (() => void) | null = null;
    let unsubPlatform: (() => void) | null = null;

    async function initRealtimeDatabase() {
      const connected = await testConnection();
      setIsFirebaseConnected(connected);

      // Realtime listener for Devices & live measurements
      unsubDevices = subscribeToRTDBDevices((remoteDevices) => {
        if (remoteDevices && remoteDevices.length > 0) {
          setDevices(remoteDevices);
          setIsFirebaseConnected(true);
        }
      });

      // Realtime listener for Users (syncs role/status updates for already-authenticated Firebase Auth user)
      unsubUsers = subscribeToRTDBUsers((remoteUsers) => {
        if (remoteUsers && remoteUsers.length > 0) {
          setUsersList(remoteUsers);
          setCurrentUser((prev) => {
            if (!prev) return null;
            const updated = remoteUsers.find(u => u.id === prev.id || u.email.toLowerCase() === prev.email.toLowerCase());
            return updated || prev;
          });
        }
      });

      // Realtime listener for Rentals
      unsubRentals = subscribeToRTDBRentals((remoteRentals) => {
        if (remoteRentals && remoteRentals.length > 0) {
          setRentals(remoteRentals);
        }
      });

      // Realtime listener for Drill & Emergency broadcasts (e.g., triggered from Android app)
      unsubDrill = subscribeToRTDBDrill((drillState) => {
        if (drillState.active) {
          setIsDrillActive(true);
          setDrillType((drillState.type as DrillType) || 'gas_critico');
          setIsAlarmActive(true);
          setIsLightActive(true);
          setDismissEmergencyBanner(false);
        }
      });

      // Realtime listener for SuperAdmin master platform configuration
      unsubPlatform = subscribeToPlatformConfig((cfg) => {
        setPlatformConfig(cfg);
      });
    }

    initRealtimeDatabase();

    return () => {
      if (unsubDevices) unsubDevices();
      if (unsubUsers) unsubUsers();
      if (unsubRentals) unsubRentals();
      if (unsubDrill) unsubDrill();
      if (unsubPlatform) unsubPlatform();
    };
  }, []);

  // Lista controlada de dispositivos visibles (por defecto solo device_38A839E81F84, editable desde Control Maestro)
  const visibleDevices = useMemo<SensorDevice[]>(() => {
    const rtdbMap = new Map<string, SensorDevice>(devices.map((d) => [d.id, d]));
    const regList = platformConfig.registeredDevices || DEFAULT_PLATFORM_CONFIG.registeredDevices;

    const buildFromRegistry = (reg: typeof regList[number]): SensorDevice => {
      const existing = rtdbMap.get(reg.id);
      if (existing) {
        return {
          ...existing,
          name: reg.name || existing.name,
          sectorName: reg.sectorName || existing.sectorName,
          deviceCategory: reg.category,
          parentGatewayId: reg.parentGatewayId || existing.parentGatewayId,
          localIp: reg.localIp || existing.localIp,
          type: reg.category === 'sensor' ? 'multigas_portatil' : 'estacion_fija',
        };
      }
      return {
        id: reg.id,
        code: reg.id,
        name: reg.name,
        type: reg.category === 'sensor' ? 'multigas_portatil' : 'estacion_fija',
        sectorId: `sec-${reg.id}`,
        sectorName: reg.sectorName || 'Faena Minera',
        batteryPct: 100,
        signalStrength: 'debil',
        lastPing: 'En espera de telemetría',
        status: 'desconectado',
        assignedTo: 'Pendiente de conexión',
        rawCO: 0,
        rawPM25: 0,
        rawTemp: 22.0,
        rawHum: 48,
        lastUpdateServer: 0,
        gatewayOnline: false,
        alarmaActiva: false,
        deviceCategory: reg.category,
        parentGatewayId: reg.parentGatewayId,
        localIp: reg.localIp,
        metrics: {
          temperatura: 22.0,
          humedad: 48,
          co2: 450,
          co: 0,
          ch4: 0,
          o2: 20.9,
          flujoAire: 1.25,
          ruido: 65,
          polvoPM: 0,
        },
      };
    };

    if (platformConfig.onlyShowRegisteredDevices) {
      const enabledRegs = regList.filter((r) => r.enabled !== false);
      const effectiveRegs = enabledRegs.length > 0 ? enabledRegs : regList.slice(0, 1);
      const mapped = effectiveRegs.map(buildFromRegistry);
      return mapped.length > 0 ? mapped : [INITIAL_SINGLE_DEVICE];
    }

    const regMap = new Map(regList.map((r) => [r.id, r]));
    const enrichedRTDB = devices.map((d) => {
      const reg = regMap.get(d.id);
      if (!reg) return d;
      return {
        ...d,
        name: reg.name || d.name,
        sectorName: reg.sectorName || d.sectorName,
        deviceCategory: reg.category,
        parentGatewayId: reg.parentGatewayId || d.parentGatewayId,
        localIp: reg.localIp || d.localIp,
      };
    });
    const missingEnabled = regList
      .filter((r) => r.enabled !== false && !rtdbMap.has(r.id))
      .map(buildFromRegistry);
    const combined = [...enrichedRTDB, ...missingEnabled];
    return combined.length > 0 ? combined : [INITIAL_SINGLE_DEVICE];
  }, [devices, platformConfig]);

  // Mantener siempre un dispositivo activo válido dentro de los dispositivos visibles
  useEffect(() => {
    if (visibleDevices.length > 0 && !visibleDevices.some((d) => d.id === activeTelemetryDeviceId)) {
      setActiveTelemetryDeviceId(visibleDevices[0].id);
    }
  }, [visibleDevices, activeTelemetryDeviceId]);

  // Evaluar mediciones en tiempo real únicamente sobre los dispositivos visibles
  useEffect(() => {
    if (visibleDevices.length > 0) {
      alertEngine.processAllDevices(visibleDevices);
    }
  }, [visibleDevices]);

  // Synchronize dashboard variables directly with the real active device from RTDB + SuperAdmin metrics config
  useEffect(() => {
    const targetDev = visibleDevices.find(d => d.id === activeTelemetryDeviceId) || visibleDevices[0];
    const m = platformConfig.metrics;
    if (targetDev && targetDev.metrics) {
      const tempVal = targetDev.metrics.temperatura;
      const humVal = targetDev.metrics.humedad;
      const coVal = targetDev.metrics.co;
      const pmVal = targetDev.metrics.polvoPM;
      const airVal = targetDev.metrics.flujoAire;
      const batVal = targetDev.batteryPct;

      setVariables([
        {
          id: 'temp',
          name: 'TEMPERATURA AMBIENTE',
          shortName: 'Temperatura',
          value: tempVal,
          unit: '°C',
          trend: tempVal >= m.tempPreventivo ? 'alza critica' : 'estable',
          status: tempVal >= m.tempCritico ? 'critico' : tempVal >= m.tempPreventivo ? 'advertencia' : 'normal',
          statusLabel: tempVal >= m.tempCritico ? 'Crítica' : tempVal >= m.tempPreventivo ? 'Alerta' : 'Estable',
          thresholdMin: m.tempMin,
          thresholdMax: m.tempPreventivo,
          lastUpdateSeconds: 0,
          historical: [
            { timestamp: '00:00', value: Number((tempVal - 1.2).toFixed(1)) },
            { timestamp: '04:00', value: Number((tempVal - 0.8).toFixed(1)) },
            { timestamp: '08:00', value: Number((tempVal - 0.3).toFixed(1)) },
            { timestamp: '12:00', value: Number((tempVal + 0.4).toFixed(1)) },
            { timestamp: '16:00', value: tempVal },
          ],
        },
        {
          id: 'hum',
          name: 'HUMEDAD RELATIVA',
          shortName: 'Humedad',
          value: humVal,
          unit: '%',
          trend: 'estable',
          status: humVal >= m.humCritico ? 'critico' : humVal >= m.humPreventivo ? 'advertencia' : 'normal',
          statusLabel: humVal >= m.humCritico ? 'Crítica' : humVal >= m.humPreventivo ? 'Elevada' : 'Normal',
          thresholdMin: m.humMin,
          thresholdMax: m.humCritico,
          lastUpdateSeconds: 0,
          historical: [
            { timestamp: '00:00', value: Math.max(0, humVal - 2) },
            { timestamp: '04:00', value: Math.max(0, humVal - 1) },
            { timestamp: '08:00', value: humVal },
            { timestamp: '12:00', value: humVal + 1 },
            { timestamp: '16:00', value: humVal },
          ],
        },
        {
          id: 'co2',
          name: 'MONÓXIDO DE CARBONO (CO)',
          shortName: 'Gas CO',
          value: coVal,
          unit: 'ppm',
          trend: coVal >= m.coChartSafeMax ? 'alza critica' : 'estable',
          status: coVal >= m.coChartSafeMax * 1.5 ? 'critico' : coVal >= m.coChartSafeMax ? 'advertencia' : 'normal',
          statusLabel: coVal >= m.coChartSafeMax * 1.5 ? 'Crítico (DS 132)' : coVal >= m.coChartSafeMax ? 'Preventivo' : 'Seguro',
          thresholdMin: 0,
          thresholdMax: m.coChartSafeMax,
          lastUpdateSeconds: 0,
          historical: [
            { timestamp: '00:00', value: Math.max(0, coVal - 10) },
            { timestamp: '04:00', value: Math.max(0, coVal - 5) },
            { timestamp: '08:00', value: coVal },
            { timestamp: '12:00', value: coVal },
            { timestamp: '16:00', value: coVal },
          ],
        },
        {
          id: 'lux',
          name: 'MATERIAL PARTICULADO (PM2.5)',
          shortName: 'Polvo PM2.5',
          value: pmVal,
          unit: 'µg/m³',
          trend: pmVal >= m.pm25Critico ? 'alza critica' : 'estable',
          status: pmVal >= m.pm25Critico ? 'critico' : pmVal >= m.pm25Preventivo ? 'advertencia' : 'normal',
          statusLabel: pmVal >= m.pm25Critico ? 'Polvo Elevado' : pmVal >= m.pm25Preventivo ? 'Preventivo' : 'Norma OK',
          thresholdMin: 0,
          thresholdMax: m.pm25ChartSafeMax,
          lastUpdateSeconds: 0,
          historical: [
            { timestamp: '00:00', value: Math.max(0, pmVal - 100) },
            { timestamp: '04:00', value: pmVal },
            { timestamp: '08:00', value: pmVal },
            { timestamp: '12:00', value: pmVal },
            { timestamp: '16:00', value: pmVal },
          ],
        },
        {
          id: 'kwh',
          name: 'BATERÍA DISPOSITIVO IoT',
          shortName: 'Batería Sensor',
          value: batVal,
          unit: '%',
          trend: 'estable',
          status: batVal < m.batteryMin ? 'advertencia' : 'normal',
          statusLabel: batVal >= m.batteryMin ? 'Óptima' : 'Recargar',
          thresholdMin: m.batteryMin,
          thresholdMax: 100,
          lastUpdateSeconds: 0,
          historical: [
            { timestamp: '00:00', value: 98 },
            { timestamp: '04:00', value: 97 },
            { timestamp: '08:00', value: 96 },
            { timestamp: '12:00', value: batVal },
            { timestamp: '16:00', value: batVal },
          ],
        },
        {
          id: 'air_flow',
          name: 'FLUJO DE VENTILACIÓN',
          shortName: 'Ventilación',
          value: airVal,
          unit: 'm/s',
          trend: 'estable',
          status: airVal < m.airFlowMin ? 'critico' : 'normal',
          statusLabel: airVal < m.airFlowMin ? 'Flujo Insuficiente' : 'Circulación Activa',
          thresholdMin: m.airFlowMin,
          thresholdMax: m.airFlowMax,
          lastUpdateSeconds: 0,
          historical: [
            { timestamp: '00:00', value: 1.2 },
            { timestamp: '04:00', value: 1.3 },
            { timestamp: '08:00', value: 1.25 },
            { timestamp: '12:00', value: airVal },
            { timestamp: '16:00', value: airVal },
          ],
        },
      ]);
    }
  }, [visibleDevices, activeTelemetryDeviceId, platformConfig]);

  // Second counter for last updated
  useEffect(() => {
    const secTimer = setInterval(() => {
      setVariables((prev) =>
        prev.map((v) => ({
          ...v,
          lastUpdateSeconds: v.lastUpdateSeconds + 1,
        }))
      );
    }, 1000);

    return () => clearInterval(secTimer);
  }, []);

  // Handlers
  const handleRefreshData = useCallback(() => {
    soundAlert.playFeedbackBeep();
    setVariables((prev) =>
      prev.map((v) => ({
        ...v,
        value: Number((v.value + (Math.random() - 0.5) * (v.value * 0.02)).toFixed(1)),
        lastUpdateSeconds: 0,
      }))
    );
  }, []);

  const handleAcknowledgeAlert = useCallback((alertId: string) => {
    soundAlert.playFeedbackBeep();
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? { ...a, acknowledged: true, acknowledgedBy: currentUser?.name || 'Operador' }
          : a
      )
    );
  }, [currentUser]);

  const handleResolveAlert = useCallback((alertId: string) => {
    soundAlert.playFeedbackBeep();
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? { ...a, resolved: true, acknowledged: true }
          : a
      )
    );
  }, []);

  const handleResolveAlertWithDetails = useCallback(async (alertId: string, details: AlertResolutionDetails) => {
    soundAlert.playFeedbackBeep();
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? {
              ...a,
              resolved: true,
              acknowledged: true,
              resolutionDetails: details,
            }
          : a
      )
    );
    await resolveAlertInRTDB(alertId, details);
  }, []);

  const handleSaveDrillDebrief = useCallback(async (record: DrillDebriefRecord) => {
    await saveDrillDebriefInRTDB(record);
  }, []);


  const handleTriggerForcedVentilation = useCallback((sectorName: string) => {
    soundAlert.playFeedbackBeep();
    setCurrentSite((prev) => ({
      ...prev,
      activeSectors: prev.activeSectors.map((s) =>
        s.name.includes(sectorName) || sectorName.includes(s.name)
          ? { ...s, ventilationFanStatus: 'ventilacion_forzada' }
          : s
      ),
    }));
  }, []);

  const handleSimulateGasSpike = useCallback(async (sensorId: string) => {
    soundAlert.playCriticalAlert();
    const targetDev = visibleDevices.find(d => d.id === sensorId) || visibleDevices[0];
    if (!targetDev) return;

    const updatedDevice: SensorDevice = {
      ...targetDev,
      status: 'critico',
      rawCO: 1250,
      metrics: {
        ...targetDev.metrics,
        co: 52.8,
        temperatura: 31.4,
      },
    };

    setDevices((prev) =>
      prev.some(d => d.id === sensorId)
        ? prev.map(d => d.id === sensorId ? updatedDevice : d)
        : [...prev, updatedDevice]
    );

    // Create a new safety alert
    const newAlert: SafetyAlert = {
      id: `alt-${Date.now()}`,
      code: `ALT-SIM-${Math.floor(Math.random() * 900 + 100)}`,
      title: 'Detección Crítica de Monóxido de Carbono (CO > 50 ppm)',
      severity: 'critico',
      variableName: 'Monóxido de Carbono (CO)',
      sensorId: sensorId,
      sensorCode: targetDev.code,
      sectorName: targetDev.sectorName,
      recordedValue: '52.8 ppm (1250 ADC)',
      safeLimit: '< 25.0 ppm',
      timestamp: 'Justo ahora',
      acknowledged: false,
      resolved: false,
      suggestedAction: 'Evacuar personal inmediatamente hacia zona segura y activar extractores al 100%.',
    };

    setAlerts((prev) => [newAlert, ...prev]);

    // Broadcast alert to Firebase RTDB so hardware ESP32 immediately reacts
    await broadcastAlertToRTDB(newAlert);
  }, [visibleDevices]);

  const handleResetSensor = useCallback(async (sensorId: string) => {
    soundAlert.playFeedbackBeep();
    const targetDev = visibleDevices.find(d => d.id === sensorId);
    if (!targetDev) return;

    const resetDevice: SensorDevice = {
      ...targetDev,
      status: 'normal',
      rawCO: 45,
      metrics: {
        ...targetDev.metrics,
        co: 8.5,
        temperatura: 22.4,
      },
    };

    setDevices((prev) =>
      prev.some(d => d.id === sensorId)
        ? prev.map(d => d.id === sensorId ? resetDevice : d)
        : [...prev, resetDevice]
    );
    await resetGatewayDataInRTDB(sensorId);
  }, [visibleDevices]);

  const handleShutdownAlarmCompletely = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'superadmin') {
      showAlarmFeedback('Acceso denegado: Solo el usuario SuperAdministrador autenticado puede apagar la alarma completamente.', 'error');
      return;
    }

    const isVerifiedSuper = await verifySuperAdminPrivileges(currentUser);
    if (!isVerifiedSuper) {
      showAlarmFeedback('Acceso denegado: Tu sesión de Firebase Auth no posee privilegios reales de SuperAdministrador.', 'error');
      return;
    }

    const wasDrill = isDrillActive;
    const targetId = activeTelemetryDeviceId || 'device_38A839E81F84';

    try {
      await shutdownAlarmCompletelyInRTDB(targetId, currentUser, {
        resetSensorBaselines: wasDrill,
      });

      soundAlert.stopContinuousAlarm();
      soundAlert.playFeedbackBeep();
      setIsAlarmActive(false);
      setIsLightActive(false);
      setIsDrillActive(false);
      setDrillType(null);
      setEvacuationActive(false);
      setDismissEmergencyBanner(true);

      setAlerts(prev => prev.map(a => ({ ...a, resolved: true, acknowledged: true })));
      setDevices(prev => prev.map(d => (d.id === targetId || d.id === 'device_38A839E81F84') ? {
        ...d,
        alarmaActiva: false,
        status: wasDrill ? 'normal' : d.status,
        rawCO: wasDrill ? 45 : d.rawCO,
        rawPM25: wasDrill ? 25 : d.rawPM25,
        metrics: wasDrill
          ? { ...d.metrics, co: 8.5, polvoPM: 25 }
          : d.metrics,
      } : d));

      showAlarmFeedback(`Alarma apagada: comando_web="APAGAR" y silencio_remoto=true escritos en /dispositivos/${targetId}.`, 'success');
    } catch (err: any) {
      showAlarmFeedback(err?.message || 'Error al escribir comando APAGAR en Firebase RTDB.', 'error');
    }
  }, [currentUser, isDrillActive, activeTelemetryDeviceId, showAlarmFeedback]);

  const handleResetPageLevels = useCallback(async () => {
    const dev = visibleDevices.find(d => d.id === activeTelemetryDeviceId) || visibleDevices[0];
    const hasActiveAlarm = Boolean(isAlarmActive || isDrillActive || dev?.alarmaActiva);
    if (hasActiveAlarm) {
      const isVerifiedSuper = currentUser?.role === 'superadmin' && await verifySuperAdminPrivileges(currentUser);
      if (!isVerifiedSuper) {
        showAlarmFeedback('Acción bloqueada: Solo el SuperAdministrador autenticado puede apagar o resetear una alarma activa.', 'error');
        return;
      }
    }

    try {
      await resetGatewayDataInRTDB(activeTelemetryDeviceId, currentUser);
      soundAlert.playFeedbackBeep();
      soundAlert.stopContinuousAlarm();
      setIsAlarmActive(false);
      setIsLightActive(false);
      setIsDrillActive(false);
      setDrillType(null);
      setEvacuationActive(false);
      setDismissEmergencyBanner(true);

      setAlerts(prev => prev.map(a => ({ ...a, resolved: true, acknowledged: true })));
      setVariables(INITIAL_VARIABLES);
      showAlarmFeedback('Niveles basales y comando APAGAR sincronizados en Firebase RTDB.', 'success');
    } catch (err: any) {
      showAlarmFeedback(err?.message || 'No se pudo resetear el nodo en Firebase RTDB.', 'error');
    }
  }, [visibleDevices, activeTelemetryDeviceId, isAlarmActive, isDrillActive, currentUser, showAlarmFeedback]);

  const handleTriggerSimulationEmergency = useCallback(async (type: DrillType) => {
    soundAlert.setMuted(false);
    soundAlert.startContinuousAlarm();
    setIsDrillActive(true);
    setDrillType(type);
    setIsAlarmActive(true);
    setIsLightActive(true);
    setDismissEmergencyBanner(false);

    const dev = visibleDevices.find(d => d.id === activeTelemetryDeviceId) || visibleDevices[0];
    if (dev) {
      if (type === 'gas_critico') {
        setDevices(prev => prev.map(d => d.id === dev.id ? {
          ...d,
          status: 'critico',
          rawCO: 1250,
          metrics: { ...d.metrics, co: 55.4 }
        } : d));
      } else if (type === 'incendio_polvo') {
        setDevices(prev => prev.map(d => d.id === dev.id ? {
          ...d,
          status: 'critico',
          rawPM25: 650,
          metrics: { ...d.metrics, polvoPM: 650 }
        } : d));
      }
    }

    const titleMap: Record<DrillType, string> = {
      gas_critico: '[SIMULACRO DS 132] Fuga Crítica de Monóxido de Carbono (CO > 50 ppm / 1250 ADC)',
      incendio_polvo: '[SIMULACRO DS 132] Principio de Incendio y Humo Denso (PM2.5 > 500 µg/m³)',
      evacuacion_sirena: '[SIMULACRO DS 132] Evacuación Inmediata de Faena por Alarma Sonora y Baliza',
    };

    const newAlert: SafetyAlert = {
      id: `alt-drill-${Date.now()}`,
      code: `SIM-DRILL-${Math.floor(Math.random() * 800 + 100)}`,
      title: titleMap[type],
      severity: 'critico',
      variableName: type === 'gas_critico' ? 'Monóxido de Carbono (CO)' : type === 'incendio_polvo' ? 'Polvo PM2.5' : 'Alarma General',
      sensorId: dev?.id || 'device_38A839E81F84',
      sensorCode: dev?.code || 'device_38A839E81F84',
      sectorName: dev?.sectorName || 'Mina Chuquicamata - Rampa Principal',
      recordedValue: type === 'gas_critico' ? '1250 ADC (55.4 ppm)' : type === 'incendio_polvo' ? '650 µg/m³' : 'Sirena y Baliza Activas',
      safeLimit: type === 'gas_critico' ? '< 25.0 ppm' : '< 50 µg/m³',
      timestamp: 'Simulacro en curso',
      acknowledged: false,
      resolved: false,
      suggestedAction: 'Protocolo de entrenamiento: desplazar cuadrilla hacia refugio hermético y activar mangas de ventilación.',
    };

    setAlerts(prev => [newAlert, ...prev]);

    // Broadcast drill to Firebase Realtime Database on active device and root /simulacro
    await broadcastDrillToRTDB(true, type, dev?.id || 'device_38A839E81F84');
  }, [visibleDevices, activeTelemetryDeviceId]);

  const handleStopDrill = useCallback(async () => {
    const isVerifiedSuper = currentUser?.role === 'superadmin' && await verifySuperAdminPrivileges(currentUser);
    if (!isVerifiedSuper) {
      showAlarmFeedback('Acción bloqueada: Solo el SuperAdministrador autenticado puede finalizar un simulacro y apagar la alarma.', 'error');
      return;
    }

    const dev = visibleDevices.find(d => d.id === activeTelemetryDeviceId) || visibleDevices[0];
    const targetId = dev?.id || 'device_38A839E81F84';

    try {
      await shutdownAlarmCompletelyInRTDB(targetId, currentUser, { resetSensorBaselines: true });
      soundAlert.stopContinuousAlarm();
      soundAlert.playFeedbackBeep();
      setIsDrillActive(false);
      setDrillType(null);
      setIsAlarmActive(false);
      setIsLightActive(false);
      setDismissEmergencyBanner(true);

      setDevices(prev => prev.map(d => (d.id === targetId || d.id === 'device_38A839E81F84') ? {
        ...d,
        status: 'normal',
        alarmaActiva: false,
        rawCO: 45,
        rawPM25: 25,
        metrics: { ...d.metrics, co: 8.5, polvoPM: 25 }
      } : d));

      setAlerts(prev => prev.map(a => a.id.startsWith('alt-drill-') ? { ...a, resolved: true, acknowledged: true } : a));
      showAlarmFeedback('Simulacro finalizado y comando_web="APAGAR" enviado a Firebase RTDB.', 'success');
    } catch (err: any) {
      showAlarmFeedback(err?.message || 'Error al detener el simulacro en Firebase RTDB.', 'error');
    }
  }, [currentUser, visibleDevices, activeTelemetryDeviceId, showAlarmFeedback]);

  const handleToggleAlarm = useCallback(async () => {
    const dev = visibleDevices.find(d => d.id === activeTelemetryDeviceId) || visibleDevices[0];
    const targetId = activeTelemetryDeviceId || dev?.id || 'device_38A839E81F84';
    const currentlyActive = Boolean(isAlarmActive || dev?.alarmaActiva);

    if (currentlyActive) {
      await handleShutdownAlarmCompletely();
      return;
    }

    try {
      await toggleGatewayAlarmInRTDB(targetId, true, currentUser);
      soundAlert.setMuted(false);
      soundAlert.startContinuousAlarm();
      setIsAlarmActive(true);
      setDismissEmergencyBanner(false);
      showAlarmFeedback(`Alarma activada: comando_web="ENCENDER" enviado a /dispositivos/${targetId}.`, 'success');
    } catch (err: any) {
      showAlarmFeedback(err?.message || 'Error al enviar comando ENCENDER a Firebase RTDB.', 'error');
    }
  }, [visibleDevices, activeTelemetryDeviceId, isAlarmActive, currentUser, showAlarmFeedback, handleShutdownAlarmCompletely]);

  const handleToggleLight = useCallback(async () => {
    const next = !isLightActive;
    setIsLightActive(next);
    soundAlert.playFeedbackBeep();
    await toggleGatewayLightInRTDB(activeTelemetryDeviceId, next);
  }, [isLightActive, activeTelemetryDeviceId]);

  const handleAddAssignment = useCallback((newAsg: Omit<WorkerAssignment, 'id'>) => {
    const created: WorkerAssignment = {
      ...newAsg,
      id: `asg-${Date.now()}`,
    };
    setAssignments((prev) => [created, ...prev]);
  }, []);

  const handleAddRentalContract = useCallback((newRent: Omit<DeviceRental, 'id'>) => {
    const created: DeviceRental = {
      ...newRent,
      id: `rent-${Date.now()}`,
    };
    setRentals((prev) => [created, ...prev]);
    addRentalContractToRTDB(created);
  }, []);

  const handleRecordPayment = useCallback((contractId: string) => {
    soundAlert.playFeedbackBeep();
    const today = new Date().toISOString().split('T')[0];
    setRentals((prev) =>
      prev.map((r) =>
        r.id === contractId
          ? { ...r, paymentStatus: 'al_dia', lastPaymentDate: today }
          : r
      )
    );
    recordPaymentInRTDB(contractId, 25000);
  }, []);

  const handleAddSite = useCallback((newSite: MiningSite) => {
    setSites((prev) => [...prev, newSite]);
    setCurrentSite(newSite);
  }, []);

  // User Management Handlers
  const handleAddUser = useCallback((newUser: UserProfile) => {
    // Regla: Solo existe un único SuperAdmin en toda la plataforma
    const safeRole: UserRole = newUser.role === 'superadmin' ? 'admin' : newUser.role;
    const safeUser: UserProfile = {
      ...newUser,
      role: safeRole,
      roleLabel:
        safeRole === 'admin'
          ? 'Administrador / Prevencionista Sernageomin'
          : 'Usuario Normal / Operador de Faena',
    };
    setUsersList((prev) => [safeUser, ...prev]);
    addUserToRTDB(safeUser);
  }, []);

  const handleUpdateUserRole = useCallback((userId: string, newRole: UserRole) => {
    if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'admin')) {
      return;
    }

    const targetUser = usersList.find((u) => u.id === userId);
    if (!targetUser) return;

    // Regla 1: Ningún Admin (ni otro usuario) puede quitarle permisos o cambiar el rol del SuperAdmin
    if (targetUser.role === 'superadmin') {
      console.warn('Acción bloqueada: No se pueden revocar ni modificar los permisos del único SuperAdministrador.');
      return;
    }

    // Regla 2: Solo puede existir un único SuperAdmin en toda la plataforma
    if (newRole === 'superadmin') {
      console.warn('Acción bloqueada: Solo existe un único SuperAdministrador en toda la plataforma.');
      return;
    }

    soundAlert.playFeedbackBeep();
    const roleLabels: Record<UserRole, string> = {
      superadmin: 'Super Administrador de Seguridad Minera',
      admin: 'Administrador / Prevencionista Sernageomin',
      operador: 'Usuario Normal / Operador de Faena',
    };

    setUsersList((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, role: newRole, roleLabel: roleLabels[newRole] }
          : u
      )
    );

    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) => prev ? ({
        ...prev,
        role: newRole,
        roleLabel: roleLabels[newRole],
      }) : null);
    }

    updateUserInRTDB(
      userId,
      {
        name: targetUser.name,
        email: targetUser.email,
        rut: targetUser.rut,
        role: newRole,
        roleLabel: roleLabels[newRole],
      },
      currentUser
    );
  }, [currentUser, usersList]);

  const handleToggleUserStatus = useCallback((userId: string) => {
    if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'admin')) {
      return;
    }

    const targetUser = usersList.find(u => u.id === userId);
    if (!targetUser) return;

    // Protección: Un admin no puede desactivar ni quitar acceso al único SuperAdmin
    if (targetUser.role === 'superadmin') {
      console.warn('Acción bloqueada: No se puede desactivar la cuenta del único SuperAdministrador.');
      return;
    }

    soundAlert.playFeedbackBeep();
    const nextStatus = targetUser.status === 'activo' ? 'inactivo' : 'activo';

    setUsersList((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, status: nextStatus }
          : u
      )
    );

    updateUserInRTDB(
      userId,
      {
        name: targetUser.name,
        email: targetUser.email,
        status: nextStatus,
      },
      currentUser
    );
  }, [currentUser, usersList]);

  const handleLogin = useCallback((user: UserProfile) => {
    setCurrentUser(user);
    setShowLoginModal(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutFromFirebaseAuth().catch(() => {});
    try {
      localStorage.removeItem('minesafe_active_user');
    } catch { /* ignore */ }
    setCurrentUser(null);
    setShowLoginModal(false);
  }, []);

  const activeAlerts = alerts.filter(a => !a.resolved);

  // Check if gas or dust in the active device is in critical threshold (Prompt Req 4)
  // An emergency in terrain MUST ONLY trigger if the device is ONLINE (transmitting live within 15 seconds).
  // If the device is disconnected/unplugged, floating ADC readings of 4095 (pins in the air) do NOT trigger alarms.
  const activeDevice = visibleDevices.find(d => d.id === activeTelemetryDeviceId) || visibleDevices[0];
  const isDeviceOnline = Boolean(activeDevice?.gatewayOnline);
  const rawGas = activeDevice?.rawCO !== undefined ? activeDevice.rawCO : activeDevice?.metrics?.co || 0;
  const rawDust = activeDevice?.rawPM25 !== undefined ? activeDevice.rawPM25 : activeDevice?.metrics?.polvoPM || 0;

  const isGasCritical = isDeviceOnline && rawGas >= platformConfig.metrics.emergencyGasThreshold;
  const isDustCritical = isDeviceOnline && rawDust >= platformConfig.metrics.emergencyDustThreshold;
  const isFieldEmergencyActive = (isGasCritical || isDustCritical || isAlarmActive || isDrillActive) && !dismissEmergencyBanner;

  const CONTROLLABLE_ORDER: ControllableTab[] = [
    'dashboard',
    'monitoreo',
    'alertas',
    'reportes',
    'faenas',
    'configuracion_alertas',
    'equipos',
    'usuarios',
  ];

  // Proteger todas las ventanas según las reglas dinámicas del SuperAdministrador
  useEffect(() => {
    if (!currentUser) return;
    if (!isTabVisibleForUser(currentTab, currentUser, platformConfig)) {
      const firstAllowed = CONTROLLABLE_ORDER.find((tab) =>
        isTabVisibleForUser(tab, currentUser, platformConfig)
      );
      if (firstAllowed && firstAllowed !== currentTab) {
        setCurrentTab(firstAllowed);
      }
    }
  }, [currentUser, currentTab, platformConfig]);

  const handleSelectTab = useCallback((tab: NavigationTab) => {
    if (!currentUser) return;
    if (tab === 'superadmin_panel' && currentUser.role !== 'superadmin') {
      return;
    }
    if (!isTabVisibleForUser(tab, currentUser, platformConfig)) {
      const firstAllowed = CONTROLLABLE_ORDER.find((t) =>
        isTabVisibleForUser(t, currentUser, platformConfig)
      );
      if (firstAllowed) {
        setCurrentTab(firstAllowed);
      }
      return;
    }
    setCurrentTab(tab);
  }, [currentUser, platformConfig]);

  // Wait for Firebase Authentication initialization before rendering gate or dashboard
  if (isAuthChecking) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-300">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold text-white">Verificando sesión en Firebase Authentication...</p>
        <p className="text-xs text-slate-400 mt-1">MineSafe IoT · Control de Acceso Seguro</p>
      </div>
    );
  }

  // GATEKEEPER: Require real Firebase Auth login before entering the application
  if (!currentUser) {
    return (
      <LoginModal
        isGateMode={true}
        currentUser={null}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onClose={() => {}}
        usersList={usersList}
        onRegisterUser={handleAddUser}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        activeAlertCount={activeAlerts.length}
        currentUser={currentUser}
        onChangeUser={() => setShowLoginModal(true)}
        onLogout={handleLogout}
        onTriggerEmergency={() => setShowEmergencyModal(true)}
        onRefreshData={handleRefreshData}
        isSimulating={isSimulating}
        onToggleSimulation={() => setIsSimulating(!isSimulating)}
        isFirebaseConnected={isFirebaseConnected}
        onResetPageLevels={handleResetPageLevels}
        isAlarmActive={Boolean(isAlarmActive || activeDevice?.alarmaActiva)}
        onToggleAlarm={handleToggleAlarm}
        isLightActive={isLightActive}
        onToggleLight={handleToggleLight}
        isDrillActive={isDrillActive}
        platformConfig={platformConfig}
      />

      {/* Feedback de Control de Alarma (Solo SuperAdmin puede apagarla) */}
      {alarmFeedback && (
        <div
          className={`px-4 py-2.5 border-b text-xs sm:text-sm font-semibold ${
            alarmFeedback.tone === 'error'
              ? 'bg-rose-950/95 border-rose-700 text-rose-100'
              : 'bg-emerald-950/95 border-emerald-700 text-emerald-100'
          }`}
        >
          <div className="max-w-[1850px] w-full mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {alarmFeedback.tone === 'error' ? (
                <Lock className="w-4 h-4 text-amber-300 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{alarmFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setAlarmFeedback(null)}
              className="p-1 hover:bg-black/20 rounded text-slate-300 hover:text-white"
              title="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Global Announcement Banner (Configurado por SuperAdministrador) */}
      {platformConfig.appearance.announcementEnabled && platformConfig.appearance.announcementText.trim() !== '' && (
        <div
          className={`px-4 py-2.5 border-b text-xs sm:text-sm font-semibold ${
            platformConfig.appearance.announcementTone === 'critical'
              ? 'bg-red-950/90 border-red-700 text-red-100'
              : platformConfig.appearance.announcementTone === 'warning'
              ? 'bg-amber-950/90 border-amber-700 text-amber-100'
              : 'bg-cyan-950/90 border-cyan-800 text-cyan-100'
          }`}
        >
          <div className="max-w-[1850px] w-full mx-auto flex items-center gap-2.5">
            <Megaphone className="w-4 h-4 shrink-0" />
            <span className="uppercase tracking-wider text-[10px] font-black px-2 py-0.5 rounded bg-black/30 border border-white/15 shrink-0">
              Aviso Dirección
            </span>
            <span>{platformConfig.appearance.announcementText}</span>
          </div>
        </div>
      )}

      {/* Global Emergency Banner (Prompt Req 4) */}
      {isFieldEmergencyActive && (
        <div className={`${
          isDrillActive 
            ? 'bg-amber-600 border-b-2 border-amber-900 shadow-amber-950' 
            : 'bg-red-600 border-b-2 border-red-900 shadow-red-950'
        } text-white font-black px-4 py-3 shadow-2xl animate-pulse`}>
          <div className="max-w-[1850px] w-full mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-3.5 w-3.5 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${isDrillActive ? 'bg-amber-300' : 'bg-yellow-300'}`}></span>
              </span>
              <ShieldAlert className="w-5 h-5 text-white shrink-0 animate-bounce" />
              <span className="text-xs sm:text-sm md:text-base tracking-wide uppercase font-black drop-shadow">
                {isDrillActive ? (
                  <>
                    <span className="bg-black/40 px-2 py-0.5 rounded mr-2 border border-white/40">
                      MODO SIMULACRO DS 132 ACTIVO (ENTRENAMIENTO)
                    </span>
                    Simulación de Emergencia en faena: sirenas y sensores forzados para validación operativa
                  </>
                ) : (
                  '¡ALERTA EN TERRENO: Baliza estroboscópica y sirena acústica activadas en el nodo sensor!'
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 text-xs font-mono font-bold bg-black/40 px-2.5 py-1 rounded border border-white/20">
                <span>{activeDevice?.name || activeDevice?.id}:</span>
                {isGasCritical && <span>MQ-2 Crítico ({activeDevice?.rawCO || activeDevice?.metrics?.co} ADC)</span>}
                {isGasCritical && isDustCritical && <span>•</span>}
                {isDustCritical && <span>Polvo PM2.5 ({activeDevice?.rawPM25 || activeDevice?.metrics?.polvoPM} µg/m³)</span>}
                {isDrillActive && <span>• [SIMULACRO OPERATIVO]</span>}
              </div>
              {currentUser.role === 'superadmin' ? (
                <button
                  type="button"
                  onClick={async () => {
                    await handleShutdownAlarmCompletely();
                  }}
                  className={`px-2.5 py-1 ${
                    isDrillActive ? 'bg-black text-amber-300 hover:bg-slate-900 border border-amber-400' : 'bg-white hover:bg-slate-100 text-red-700'
                  } text-xs font-black uppercase rounded shadow transition-colors whitespace-nowrap`}
                >
                  {isDrillActive ? 'Finalizar y Apagar Todo' : 'Apagar Alarma Completamente'}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/50 border border-white/25 text-[11px] font-bold text-amber-200 whitespace-nowrap">
                  <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  Solo SuperAdmin puede apagar
                </span>
              )}
              {currentUser.role === 'superadmin' && (
                <button
                  type="button"
                  onClick={() => setDismissEmergencyBanner(true)}
                  className="p-1 hover:bg-black/20 text-white rounded transition-colors"
                  title="Descartar banner"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Evacuation Alert Banner (if active) */}
      {evacuationActive && (
        <div className="bg-rose-950 border-b border-rose-800 text-rose-200 px-4 py-3 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 max-w-[1850px] w-full mx-auto text-xs sm:text-sm font-bold">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <span>ESTADO DE EVACUACIÓN ACTIVO EN FAENA — Todos los operadores deben dirigirse al refugio minero más cercano.</span>
          </div>
          <button 
            onClick={() => setEvacuationActive(false)}
            className="p-1 hover:text-white text-rose-400"
            title="Cancelar estado de evacuación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1850px] w-full mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8">

        {!isTabVisibleForUser(currentTab, currentUser, platformConfig) ? (
          <div className="p-8 text-center bg-slate-900/80 border border-red-900/50 rounded-2xl max-w-xl mx-auto my-12 shadow-xl">
            <Lock className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Ventana Bloqueada por el SuperAdministrador</h2>
            <p className="text-slate-400 text-sm mb-4">
              El SuperAdministrador ha restringido temporalmente el acceso a esta ventana para tu usuario o rol.
            </p>
            <p className="text-xs text-slate-500">
              Si necesitas acceso a este módulo operativo, comunícate con el SuperAdministrador de MineSafe IoT.
            </p>
          </div>
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                variables={variables}
                activeAlerts={activeAlerts}
                currentSite={currentSite}
                devices={visibleDevices}
                activeTelemetryDeviceId={activeTelemetryDeviceId}
                onSelectTelemetryDevice={setActiveTelemetryDeviceId}
                onNavigateTab={handleSelectTab}
                onSelectSensor={(sensorId) => {
                  setSelectedSensorId(sensorId);
                  handleSelectTab('monitoreo');
                }}
                onAcknowledgeAlert={handleAcknowledgeAlert}
                onResetPageLevels={handleResetPageLevels}
                isAlarmActive={isAlarmActive}
                onToggleAlarm={handleToggleAlarm}
                onShutdownAlarmCompletely={handleShutdownAlarmCompletely}
                isLightActive={isLightActive}
                onToggleLight={handleToggleLight}
                currentUser={currentUser}
                usersList={usersList}
                onChangeUserModal={() => setShowLoginModal(true)}
                platformConfig={platformConfig}
              />
            )}

            {currentTab === 'monitoreo' && (
              <MonitoringView
                devices={visibleDevices}
                currentSite={currentSite}
                selectedSensorId={selectedSensorId}
                onSelectSensor={setSelectedSensorId}
                onSimulateGasSpike={handleSimulateGasSpike}
                onResetSensor={handleResetSensor}
              />
            )}

            {currentTab === 'alertas' && (
              <AlertsView
                alerts={alerts}
                devices={visibleDevices}
                currentUser={currentUser}
                onAcknowledgeAlert={handleAcknowledgeAlert}
                onResolveAlert={handleResolveAlert}
                onResolveAlertWithDetails={handleResolveAlertWithDetails}
                onTriggerForcedVentilation={handleTriggerForcedVentilation}
                onNavigateTab={handleSelectTab}
                onSelectSensor={(sensorId) => {
                  setSelectedSensorId(sensorId);
                  handleSelectTab('monitoreo');
                }}
              />
            )}

            {currentTab === 'configuracion_alertas' && (
              <AlertConfigurationView
                devices={visibleDevices}
                currentUser={currentUser}
              />
            )}

            {currentTab === 'equipos' && (
              <DevicesAndRentalsView
                rentals={rentals}
                assignments={assignments}
                devices={visibleDevices}
                onAddAssignment={handleAddAssignment}
                onAddRentalContract={handleAddRentalContract}
                onRecordPayment={handleRecordPayment}
              />
            )}

            {currentTab === 'reportes' && (
              <HistoricalReportsView
                variables={variables}
                currentSite={currentSite}
              />
            )}

            {currentTab === 'faenas' && (
              <MiningSectorsView
                currentSite={currentSite}
                allSites={sites}
                onSelectSite={(siteId) => {
                  const found = sites.find(s => s.id === siteId);
                  if (found) setCurrentSite(found);
                }}
                onAddSite={handleAddSite}
                onNavigateTab={handleSelectTab}
              />
            )}

            {currentTab === 'usuarios' && (
              <UsersManagementView
                currentUser={currentUser}
                usersList={usersList}
                onAddUser={handleAddUser}
                onUpdateUserRole={handleUpdateUserRole}
                onToggleUserStatus={handleToggleUserStatus}
              />
            )}

            {currentTab === 'superadmin_panel' && currentUser.role === 'superadmin' && (
              <SuperAdminControlView
                currentUser={currentUser}
                usersList={usersList}
                platformConfig={platformConfig}
                rtdbDevices={devices}
              />
            )}
          </>
        )}

      </main>

      {/* Login & Role Switcher Modal */}
      {showLoginModal && (
        <LoginModal
          currentUser={currentUser}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onClose={() => setShowLoginModal(false)}
          usersList={usersList}
          onRegisterUser={handleAddUser}
        />
      )}

      {/* Emergency Evacuation & Drill Modal */}
      {showEmergencyModal && (
        <EmergencyModal
          onClose={() => setShowEmergencyModal(false)}
          onConfirmEvacuation={() => {
            setEvacuationActive(true);
            soundAlert.playCriticalAlert();
            setIsAlarmActive(true);
            setDismissEmergencyBanner(false);
            if (activeDevice) {
              toggleGatewayAlarmInRTDB(activeDevice.id, true, currentUser).catch((err: any) => {
                showAlarmFeedback(err?.message || 'Error al activar alarma de evacuación en Firebase RTDB.', 'error');
              });
            }
          }}
          currentUser={currentUser}
          onTriggerSimulationEmergency={handleTriggerSimulationEmergency}
          isSimulatingDrill={isDrillActive}
          onStopDrill={handleStopDrill}
          onSaveDrillDebrief={handleSaveDrillDebrief}
        />
      )}

      {/* Quiet Industrial Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
        <div className="max-w-[1850px] w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">MineSafe IoT</span>
            <span>·</span>
            <span>Sistema de Monitoreo y Alertas para Seguridad Minera</span>
          </div>
          <div>
            <span>{platformConfig.appearance.footerText}</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
