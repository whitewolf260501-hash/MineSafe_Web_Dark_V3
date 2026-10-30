import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { MonitoringView } from './components/MonitoringView';
import { AlertsView } from './components/AlertsView';
import { DevicesAndRentalsView } from './components/DevicesAndRentalsView';
import { HistoricalReportsView } from './components/HistoricalReportsView';
import { MiningSectorsView } from './components/MiningSectorsView';
import { UsersManagementView } from './components/UsersManagementView';
import { MineSafeAIView } from './components/MineSafeAIView';
import { LoginModal } from './components/LoginModal';
import { EmergencyModal, DrillType } from './components/EmergencyModal';
import { recordRealTelemetryPoint } from './services/aiService';


import { 
  NavigationTab, 
  TelemetryVariable, 
  SensorDevice, 
  SafetyAlert, 
  DeviceRental, 
  WorkerAssignment, 
  MiningSite, 
  UserProfile,
  UserRole,
  AlertResolutionDetails,
  DrillDebriefRecord
} from './types';

import { 
  INITIAL_VARIABLES, 
  MINING_SITES, 
  INITIAL_DEVICES, 
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
  toggleGatewayLightInRTDB,
  resetGatewayDataInRTDB,
  broadcastDrillToRTDB,
  broadcastAlertToRTDB,
  subscribeToRTDBDrill,
  resolveAlertInRTDB,
  saveDrillDebriefInRTDB
} from './services/firebase';

import { soundAlert } from './services/audioAlert';
import { ShieldAlert, AlertTriangle, X } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [variables, setVariables] = useState<TelemetryVariable[]>(INITIAL_VARIABLES);
  const [devices, setDevices] = useState<SensorDevice[]>(INITIAL_DEVICES);
  const [alerts, setAlerts] = useState<SafetyAlert[]>(INITIAL_ALERTS);
  const [rentals, setRentals] = useState<DeviceRental[]>(INITIAL_RENTALS);
  const [assignments, setAssignments] = useState<WorkerAssignment[]>(INITIAL_ASSIGNMENTS);
  const [sites, setSites] = useState<MiningSite[]>(MINING_SITES);
  const [currentSite, setCurrentSite] = useState<MiningSite>(MINING_SITES[0]);
  const [usersList, setUsersList] = useState<UserProfile[]>(PRELOADED_USERS);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('minesafe_active_user');
      if (saved) return JSON.parse(saved);
    } catch {
      return null;
    }
    return null;
  });

  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const [activeTelemetryDeviceId, setActiveTelemetryDeviceId] = useState<string>('device_A4CB2F124B00');
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

  // Initialize and connect to user's Firebase Realtime Database
  useEffect(() => {
    let unsubDevices: (() => void) | null = null;
    let unsubUsers: (() => void) | null = null;
    let unsubRentals: (() => void) | null = null;
    let unsubDrill: (() => void) | null = null;

    async function initRealtimeDatabase() {
      const connected = await testConnection();
      setIsFirebaseConnected(connected);

      // Realtime listener for Devices & live measurements
      unsubDevices = subscribeToRTDBDevices((remoteDevices) => {
        if (remoteDevices && remoteDevices.length > 0) {
          setDevices(remoteDevices);
          setIsFirebaseConnected(true);

          // Alimentar el búfer de series temporales de MineSafe IA con datos reales
          remoteDevices.forEach((dev) => {
            recordRealTelemetryPoint(dev.id, {
              coRaw: dev.rawCO,
              pm25Raw: dev.rawPM25,
              temperature: dev.rawTemp,
              humidity: dev.rawHum,
              timestamp: dev.lastUpdateServer && dev.lastUpdateServer > 0 ? dev.lastUpdateServer : Date.now(),
            });
          });
        }
      });

      // Realtime listener for Users
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
    }

    initRealtimeDatabase();

    return () => {
      if (unsubDevices) unsubDevices();
      if (unsubUsers) unsubUsers();
      if (unsubRentals) unsubRentals();
      if (unsubDrill) unsubDrill();
    };
  }, []);

  // Synchronize dashboard variables directly with the real active device from RTDB
  useEffect(() => {
    const targetDev = devices.find(d => d.id === activeTelemetryDeviceId) || devices[0];
    if (targetDev && targetDev.metrics) {
      setVariables([
        {
          id: 'temp',
          name: 'TEMPERATURA AMBIENTE',
          shortName: 'Temperatura',
          value: targetDev.metrics.temperatura,
          unit: '°C',
          trend: 'estable',
          status: targetDev.metrics.temperatura > 30 ? 'critico' : 'normal',
          statusLabel: targetDev.metrics.temperatura > 30 ? 'Alerta' : 'Estable',
          thresholdMin: 10,
          thresholdMax: 28,
          lastUpdateSeconds: 0,
          historical: [
            { timestamp: '00:00', value: Number((targetDev.metrics.temperatura - 1.2).toFixed(1)) },
            { timestamp: '04:00', value: Number((targetDev.metrics.temperatura - 0.8).toFixed(1)) },
            { timestamp: '08:00', value: Number((targetDev.metrics.temperatura - 0.3).toFixed(1)) },
            { timestamp: '12:00', value: Number((targetDev.metrics.temperatura + 0.4).toFixed(1)) },
            { timestamp: '16:00', value: targetDev.metrics.temperatura },
          ],
        },
        {
          id: 'hum',
          name: 'HUMEDAD RELATIVA',
          shortName: 'Humedad',
          value: targetDev.metrics.humedad,
          unit: '%',
          trend: 'estable',
          status: 'normal',
          statusLabel: 'Normal',
          thresholdMin: 30,
          thresholdMax: 75,
          lastUpdateSeconds: 0,
          historical: [
            { timestamp: '00:00', value: Math.max(0, targetDev.metrics.humedad - 2) },
            { timestamp: '04:00', value: Math.max(0, targetDev.metrics.humedad - 1) },
            { timestamp: '08:00', value: targetDev.metrics.humedad },
            { timestamp: '12:00', value: targetDev.metrics.humedad + 1 },
            { timestamp: '16:00', value: targetDev.metrics.humedad },
          ],
        },
        {
          id: 'co2',
          name: 'MONÓXIDO DE CARBONO (CO)',
          shortName: 'Gas CO',
          value: targetDev.metrics.co,
          unit: 'ppm',
          trend: targetDev.metrics.co > 50 ? 'alza critica' : 'estable',
          status: targetDev.metrics.co > 50 ? 'critico' : 'normal',
          statusLabel: targetDev.metrics.co > 50 ? 'Crítico (DS 132)' : 'Seguro',
          thresholdMin: 0,
          thresholdMax: 25,
          lastUpdateSeconds: 0,
          historical: [
            { timestamp: '00:00', value: Math.max(0, targetDev.metrics.co - 10) },
            { timestamp: '04:00', value: Math.max(0, targetDev.metrics.co - 5) },
            { timestamp: '08:00', value: targetDev.metrics.co },
            { timestamp: '12:00', value: targetDev.metrics.co },
            { timestamp: '16:00', value: targetDev.metrics.co },
          ],
        },
        {
          id: 'lux',
          name: 'MATERIAL PARTICULADO (PM2.5)',
          shortName: 'Polvo PM2.5',
          value: targetDev.metrics.polvoPM,
          unit: 'µg/m³',
          trend: targetDev.metrics.polvoPM > 1000 ? 'alza critica' : 'estable',
          status: targetDev.metrics.polvoPM > 1000 ? 'critico' : 'normal',
          statusLabel: targetDev.metrics.polvoPM > 1000 ? 'Polvo Elevado' : 'Norma OK',
          thresholdMin: 0,
          thresholdMax: 500,
          lastUpdateSeconds: 0,
          historical: [
            { timestamp: '00:00', value: Math.max(0, targetDev.metrics.polvoPM - 100) },
            { timestamp: '04:00', value: targetDev.metrics.polvoPM },
            { timestamp: '08:00', value: targetDev.metrics.polvoPM },
            { timestamp: '12:00', value: targetDev.metrics.polvoPM },
            { timestamp: '16:00', value: targetDev.metrics.polvoPM },
          ],
        },
        {
          id: 'kwh',
          name: 'BATERÍA DISPOSITIVO IoT',
          shortName: 'Batería Sensor',
          value: targetDev.batteryPct,
          unit: '%',
          trend: 'estable',
          status: targetDev.batteryPct < 20 ? 'advertencia' : 'normal',
          statusLabel: targetDev.batteryPct > 50 ? 'Óptima' : 'Recargar',
          thresholdMin: 20,
          thresholdMax: 100,
          lastUpdateSeconds: 0,
          historical: [
            { timestamp: '00:00', value: 98 },
            { timestamp: '04:00', value: 97 },
            { timestamp: '08:00', value: 96 },
            { timestamp: '12:00', value: targetDev.batteryPct },
            { timestamp: '16:00', value: targetDev.batteryPct },
          ],
        },
        {
          id: 'air_flow',
          name: 'FLUJO DE VENTILACIÓN',
          shortName: 'Ventilación',
          value: targetDev.metrics.flujoAire,
          unit: 'm/s',
          trend: 'estable',
          status: targetDev.metrics.flujoAire < 0.5 ? 'critico' : 'normal',
          statusLabel: 'Circulación Activa',
          thresholdMin: 0.5,
          thresholdMax: 3.0,
          lastUpdateSeconds: 0,
          historical: [
            { timestamp: '00:00', value: 1.2 },
            { timestamp: '04:00', value: 1.3 },
            { timestamp: '08:00', value: 1.25 },
            { timestamp: '12:00', value: targetDev.metrics.flujoAire },
            { timestamp: '16:00', value: targetDev.metrics.flujoAire },
          ],
        },
      ]);
    }
  }, [devices, activeTelemetryDeviceId]);

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
    const targetDev = devices.find(d => d.id === sensorId) || devices[0];
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

    setDevices((prev) => prev.map(d => d.id === sensorId ? updatedDevice : d));

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

    // Broadcast alert to Firebase RTDB so Android App and hardware ESP32 immediately react
    await broadcastAlertToRTDB(newAlert);
  }, [devices]);

  const handleResetSensor = useCallback(async (sensorId: string) => {
    soundAlert.playFeedbackBeep();
    const targetDev = devices.find(d => d.id === sensorId);
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

    setDevices((prev) => prev.map(d => d.id === sensorId ? resetDevice : d));
    await resetGatewayDataInRTDB(sensorId);
  }, [devices]);

  const handleResetPageLevels = useCallback(async () => {
    soundAlert.playFeedbackBeep();
    soundAlert.stopContinuousAlarm();
    setIsAlarmActive(false);
    setIsLightActive(false);
    setIsDrillActive(false);
    setDrillType(null);
    setEvacuationActive(false);
    setDismissEmergencyBanner(true);
    
    // Clear and resolve all active alerts
    setAlerts(prev => prev.map(a => ({ ...a, resolved: true, acknowledged: true })));
    
    // Reset variables to clean industrial baselines
    setVariables(INITIAL_VARIABLES);

    // Reset all nodes in Firebase RTDB
    await resetGatewayDataInRTDB(activeTelemetryDeviceId);
  }, [activeTelemetryDeviceId]);

  const handleTriggerSimulationEmergency = useCallback(async (type: DrillType) => {
    soundAlert.startContinuousAlarm();
    setIsDrillActive(true);
    setDrillType(type);
    setIsAlarmActive(true);
    setIsLightActive(true);
    setDismissEmergencyBanner(false);

    const dev = devices.find(d => d.id === activeTelemetryDeviceId) || devices[0];
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

    // Broadcast drill to Firebase Realtime Database across all nodes:
    // updates device_38A839E81F84 (monitored by Android APK), gateway, and root /simulacro
    await broadcastDrillToRTDB(true, type, dev?.id || 'device_38A839E81F84');
  }, [devices, activeTelemetryDeviceId]);

  const handleStopDrill = useCallback(async () => {
    soundAlert.stopContinuousAlarm();
    soundAlert.playFeedbackBeep();
    setIsDrillActive(false);
    setDrillType(null);
    setIsAlarmActive(false);
    setIsLightActive(false);
    setDismissEmergencyBanner(true);

    const dev = devices.find(d => d.id === activeTelemetryDeviceId) || devices[0];
    if (dev) {
      setDevices(prev => prev.map(d => d.id === dev.id ? {
        ...d,
        status: 'normal',
        rawCO: 45,
        rawPM25: 25,
        metrics: { ...d.metrics, co: 8.5, polvoPM: 25 }
      } : d));
    }

    setAlerts(prev => prev.map(a => a.id.startsWith('alt-drill-') ? { ...a, resolved: true, acknowledged: true } : a));

    // Clear drill and reset all devices in Firebase Realtime Database
    await broadcastDrillToRTDB(false, null, dev?.id || 'device_38A839E81F84');
  }, [devices, activeTelemetryDeviceId]);

  const handleToggleAlarm = useCallback(async () => {
    const next = !isAlarmActive;
    setIsAlarmActive(next);
    if (next) {
      soundAlert.startContinuousAlarm();
    } else {
      soundAlert.stopContinuousAlarm();
    }
    await toggleGatewayAlarmInRTDB(activeTelemetryDeviceId, next);
  }, [isAlarmActive, activeTelemetryDeviceId]);

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
    setUsersList((prev) => [newUser, ...prev]);
    addUserToRTDB(newUser);
  }, []);

  const handleUpdateUserRole = useCallback((userId: string, newRole: UserRole) => {
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

    updateUserInRTDB(userId, { role: newRole, roleLabel: roleLabels[newRole] });
  }, [currentUser]);

  const handleToggleUserStatus = useCallback((userId: string) => {
    soundAlert.playFeedbackBeep();
    const targetUser = usersList.find(u => u.id === userId);
    const nextStatus = targetUser?.status === 'activo' ? 'inactivo' : 'activo';

    setUsersList((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, status: nextStatus }
          : u
      )
    );

    updateUserInRTDB(userId, { status: nextStatus });
  }, [usersList]);

  const handleLogin = useCallback((user: UserProfile) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('minesafe_active_user', JSON.stringify(user));
    } catch (e) {
      console.warn('Storage error:', e);
    }
    setShowLoginModal(false);
  }, []);

  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem('minesafe_active_user');
    } catch (e) {
      console.warn('Storage error:', e);
    }
    setCurrentUser(null);
    setShowLoginModal(false);
  }, []);

  const activeAlerts = alerts.filter(a => !a.resolved);

  // Check if gas or dust in the active device is in critical threshold (Prompt Req 4)
  // An emergency in terrain MUST ONLY trigger if the device is ONLINE (transmitting live within 15 seconds).
  // If the device is disconnected/unplugged, floating ADC readings of 4095 (pins in the air) do NOT trigger alarms.
  const activeDevice = devices.find(d => d.id === activeTelemetryDeviceId) || devices[0];
  const isDeviceOnline = Boolean(activeDevice?.gatewayOnline);
  const rawGas = activeDevice?.rawCO !== undefined ? activeDevice.rawCO : activeDevice?.metrics?.co || 0;
  const rawDust = activeDevice?.rawPM25 !== undefined ? activeDevice.rawPM25 : activeDevice?.metrics?.polvoPM || 0;

  const isGasCritical = isDeviceOnline && rawGas >= 1000;
  const isDustCritical = isDeviceOnline && rawDust >= 500;
  const isFieldEmergencyActive = (isGasCritical || isDustCritical || isAlarmActive || isDrillActive) && !dismissEmergencyBanner;

  // GATEKEEPER: Require login before entering the application
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
        onSelectTab={setCurrentTab}
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
        isAlarmActive={isAlarmActive}
        onToggleAlarm={handleToggleAlarm}
        isLightActive={isLightActive}
        onToggleLight={handleToggleLight}
        isDrillActive={isDrillActive}
      />

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
              <button
                type="button"
                onClick={async () => {
                  if (isDrillActive) {
                    await handleStopDrill();
                  } else {
                    soundAlert.stopContinuousAlarm();
                    setIsAlarmActive(false);
                    setDismissEmergencyBanner(true);
                    if (activeDevice) {
                      await resetGatewayDataInRTDB(activeDevice.id);
                    }
                    handleResetPageLevels();
                  }
                }}
                className={`px-2.5 py-1 ${
                  isDrillActive ? 'bg-black text-amber-300 hover:bg-slate-900 border border-amber-400' : 'bg-white hover:bg-slate-100 text-red-700'
                } text-xs font-black uppercase rounded shadow transition-colors whitespace-nowrap`}
              >
                {isDrillActive ? 'Finalizar Simulacro' : 'Resetear Alerta'}
              </button>
              <button
                type="button"
                onClick={() => setDismissEmergencyBanner(true)}
                className="p-1 hover:bg-black/20 text-white rounded transition-colors"
                title="Descartar banner"
              >
                <X className="w-4 h-4" />
              </button>
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
        
        {currentTab === 'dashboard' && (
          <DashboardView
            variables={variables}
            activeAlerts={activeAlerts}
            currentSite={currentSite}
            devices={devices}
            activeTelemetryDeviceId={activeTelemetryDeviceId}
            onSelectTelemetryDevice={setActiveTelemetryDeviceId}
            onNavigateTab={setCurrentTab}
            onSelectSensor={(sensorId) => {
              setSelectedSensorId(sensorId);
              setCurrentTab('monitoreo');
            }}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onResetPageLevels={handleResetPageLevels}
            isAlarmActive={isAlarmActive}
            onToggleAlarm={handleToggleAlarm}
            isLightActive={isLightActive}
            onToggleLight={handleToggleLight}
            currentUser={currentUser}
            usersList={usersList}
            onChangeUserModal={() => setShowLoginModal(true)}
          />
        )}

        {currentTab === 'monitoreo' && (
          <MonitoringView
            devices={devices}
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
            currentUser={currentUser}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onResolveAlert={handleResolveAlert}
            onResolveAlertWithDetails={handleResolveAlertWithDetails}
            onTriggerForcedVentilation={handleTriggerForcedVentilation}
            onNavigateTab={setCurrentTab}
            onSelectSensor={(sensorId) => {
              setSelectedSensorId(sensorId);
              setCurrentTab('monitoreo');
            }}
          />
        )}

        {currentTab === 'ia' && (
          <MineSafeAIView
            devices={devices}
            activeDeviceId={activeTelemetryDeviceId}
            onSelectDevice={setActiveTelemetryDeviceId}
            currentSite={currentSite}
          />
        )}

        {currentTab === 'equipos' && (
          <DevicesAndRentalsView
            rentals={rentals}
            assignments={assignments}
            devices={devices}
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
            onNavigateTab={setCurrentTab}
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
              toggleGatewayAlarmInRTDB(activeDevice.id, true);
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
            <span>Cumplimiento Normativo DS 132 / Sernageomin · Plataforma Industrial</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
