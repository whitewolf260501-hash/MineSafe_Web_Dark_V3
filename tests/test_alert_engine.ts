import { alertEngine } from '../src/services/alertEngine';
import { SensorDevice, DeviceThresholdsConfig } from '../src/types';

const testConfig: DeviceThresholdsConfig = {
  dispositivo_id: 'device_TEST_01',
  dispositivo_nombre: 'Nodo de Pruebas',
  pm25: {
    activo: true,
    notificaciones: true,
    preventivo: 350,
    advertencia: 750,
    critico: 1200,
    unidad: 'ADC raw',
    minVal: 0,
    maxVal: 4095,
    label: 'Partículas PM2.5 (ADC)',
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
    label: 'Gases MQ-2 (ADC)',
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
    label: 'Temperatura DHT',
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
    label: 'Humedad DHT',
  },
  actualizado_en: Date.now(),
  actualizado_por: 'Test Suite',
};

function createMockDevice(overrides: Partial<SensorDevice> = {}): SensorDevice {
  return {
    id: 'device_TEST_01',
    code: 'device_TEST_01',
    name: 'Sensor Test 01',
    type: 'multigas_portatil',
    sectorId: 'sec-1',
    sectorName: 'Socavón Norte',
    batteryPct: 90,
    signalStrength: 'optima',
    lastPing: 'hace 2 seg',
    status: 'normal',
    rawCO: 100,
    rawPM25: 150,
    rawTemp: 22,
    rawHum: 50,
    metrics: {
      temperatura: 22,
      humedad: 50,
      co2: 400,
      co: 100,
      ch4: 0,
      o2: 20.9,
      flujoAire: 1.5,
      ruido: 55,
      polvoPM: 150
    },
    ...overrides
  };
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${msg}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${msg}`);
  }
}

console.log('--- INICIANDO PRUEBAS DEL MOTOR DE UMBRALES DINÁMICOS MINESAFE ---');

// Test 1: Estado Normal
alertEngine.clearActiveIncidents();
alertEngine.setDeviceConfig('device_TEST_01', testConfig);

const normalDev = createMockDevice({ rawCO: 150, rawPM25: 200, rawTemp: 23, rawHum: 55 });
const resNormal = alertEngine.processDeviceTelemetry(normalDev);
assert(resNormal.highestSeverity === 'normal', '1. Nivel inicial normal no genera incidentes');
assert(resNormal.newEvents.length === 0, '1.1 Sin eventos nuevos en nivel normal');

// Test 2: Umbral Preventivo en Temperatura (28°C >= 26°C preventivo)
const prevDev = createMockDevice({ rawTemp: 28 });
const resPrev = alertEngine.processDeviceTelemetry(prevDev);
assert(resPrev.highestSeverity === 'preventivo', '2. Detección correcta de nivel Preventivo');
assert(resPrev.newEvents.length === 1 && resPrev.newEvents[0].variable === 'temperatura', '2.1 Se genera evento de temperatura preventiva');
assert(resPrev.newEvents[0].umbral_superado === 26, '2.2 Umbral superado registrado es 26°C');

// Test 3: Anti-flapping / Deduplicación (misma condición no genera eventos repetidos)
const repeatDev = createMockDevice({ rawTemp: 29 }); // sigue en preventivo
const resRepeat = alertEngine.processDeviceTelemetry(repeatDev);
assert(resRepeat.newEvents.length === 0, '3. Anti-flapping: No genera alertas duplicadas mientras la condición persiste');

// Test 4: Escalamiento a Advertencia (rawTemp 34°C >= 32°C advertencia)
const advDev = createMockDevice({ rawTemp: 34 });
const resAdv = alertEngine.processDeviceTelemetry(advDev);
assert(resAdv.highestSeverity === 'advertencia', '4. Detección correcta de escalamiento a Advertencia');
assert(resAdv.newEvents.length === 1 && resAdv.newEvents[0].nivel === 'advertencia', '4.1 Evento emitido por escalamiento de nivel');

// Test 5: Escalamiento a Crítico (rawTemp 40°C >= 38°C critico)
const critDev = createMockDevice({ rawTemp: 40 });
const resCrit = alertEngine.processDeviceTelemetry(critDev);
assert(resCrit.highestSeverity === 'critico', '5. Detección de nivel Crítico');
assert(resCrit.newEvents.length === 1 && resCrit.newEvents[0].nivel === 'critico', '5.1 Evento emitido por escalamiento a crítico');

// Test 6: Mecanismo de Recuperación (temperatura baja a 22°C < 26°C preventivo)
const recDev = createMockDevice({ rawTemp: 22 });
const resRec = alertEngine.processDeviceTelemetry(recDev);
assert(resRec.highestSeverity === 'normal', '6. Vuelta a la normalidad detectada');
assert(resRec.recoveredEvents.length === 1, '6.1 Se emitió evento de recuperación');
assert(resRec.recoveredEvents[0].estado === 'recuperada', '6.2 El estado se marca como recuperada');

// Test 7: Protección contra lecturas falsas de dispositivos desconectados
const discDev = createMockDevice({ status: 'desconectado', rawCO: 4095, rawPM25: 4095 });
const resDisc = alertEngine.processDeviceTelemetry(discDev);
assert(resDisc.highestSeverity === 'normal' && resDisc.newEvents.length === 0, '7. Dispositivo desconectado no genera falsas alarmas por pin flotante');

// Test 8: Evaluación simultánea multivariable (Gas MQ-2 y Polvo PM2.5)
alertEngine.clearActiveIncidents();
const multiDev = createMockDevice({ rawCO: 950, rawPM25: 1400 }); // MQ-2 advertencia (800), PM2.5 crítico (1200)
const resMulti = alertEngine.processDeviceTelemetry(multiDev);
assert(resMulti.highestSeverity === 'critico', '8. Evaluación multivariable detecta la severidad mayor (crítico)');
assert(resMulti.newEvents.length === 2, '8.1 Se emiten eventos independientes por cada variable superada');

// Test 9: syncExistingActiveAlerts preserva severidad preventivo y evita duplicados tras recarga
alertEngine.clearActiveIncidents();
const savedIds: string[] = [];
const updatedEvents: Array<{ id: string; estado?: string }> = [];
const closedAlerts: Array<{ id: string; clearEmergencyIfNone?: boolean }> = [];
const playedSounds: Array<'advertencia' | 'critico'> = [];

alertEngine.setPersistenceHandlers({
  saveEvent: async (ev) => {
    savedIds.push(ev.id);
  },
  updateEvent: async (id, upd) => {
    updatedEvents.push({ id, estado: upd.estado });
  },
  closeAlert: async (id, _reason, opts) => {
    closedAlerts.push({ id, clearEmergencyIfNone: opts?.clearEmergencyIfNone });
  },
  playSound: (lvl) => {
    playedSounds.push(lvl);
  },
});

alertEngine.syncExistingActiveAlerts([
  {
    id: 'evt_device_TEST_01_temperatura_1700000000000',
    code: 'EVT-TEMP-000',
    title: 'Umbral Preventivo Temperatura',
    severity: 'preventivo',
    variableName: 'Temperatura DHT',
    sensorId: 'device_TEST_01',
    sensorCode: 'device_TEST_01',
    sectorName: 'Socavón Norte',
    recordedValue: '28 °C',
    safeLimit: '< 26 °C',
    timestamp: 'Reciente',
    acknowledged: false,
    resolved: false,
    suggestedAction: 'Revisar ventilación.',
  },
]);
const syncedSnapshot = alertEngine.getActiveIncidentsSnapshot();
assert(
  syncedSnapshot.length === 1 && syncedSnapshot[0].severity === 'preventivo',
  '9. syncExistingActiveAlerts conserva severidad preventivo en incidentes evt_*'
);
const repeatAfterSync = alertEngine.processDeviceTelemetry(createMockDevice({ rawTemp: 29 }));
assert(
  repeatAfterSync.newEvents.length === 0 && savedIds.length === 0,
  '9.1 Anti-duplicación activa tras recargar página con incidente preventivo en curso'
);

// Test 10: Escalamiento cierra incidente previo (clearEmergencyIfNone: false) y dispara sonido
const escalRes = alertEngine.processDeviceTelemetry(createMockDevice({ rawTemp: 34 }));
assert(escalRes.newEvents.length === 1 && escalRes.newEvents[0].nivel === 'advertencia', '10. Escalamiento a advertencia genera nuevo evento');
assert(
  updatedEvents.some((u) => u.id === 'evt_device_TEST_01_temperatura_1700000000000' && u.estado === 'recuperada'),
  '10.1 Escalamiento marca como recuperado el evento preventivo previo'
);
assert(
  closedAlerts.some((c) => c.id === 'evt_device_TEST_01_temperatura_1700000000000' && c.clearEmergencyIfNone === false),
  '10.2 Escalamiento cierra alerta previa en RTDB sin limpiar bandera global de emergencia'
);
assert(playedSounds.includes('advertencia'), '10.3 Escalamiento a advertencia dispara alerta sonora');

// Test 11: Recuperación a nivel normal limpia emergencia cuando no quedan críticos
const recSpyRes = alertEngine.processDeviceTelemetry(createMockDevice({ rawTemp: 22 }));
assert(recSpyRes.recoveredEvents.length === 1, '11. Recuperación emite evento recuperado');
assert(
  closedAlerts.some((c) => c.id === escalRes.newEvents[0].id && c.clearEmergencyIfNone === true),
  '11.1 Al volver a normal sin otros incidentes críticos se envía clearEmergencyIfNone: true'
);

// Test 12: Canales en falla (faultFields) son ignorados aunque reporten valores altos o NaN
alertEngine.clearActiveIncidents();
const faultDev = createMockDevice({
  rawCO: 4095,
  rawPM25: 4095,
  rawTemp: 23,
  rawHum: 50,
  faultFields: ['CO', 'PM2_5'],
  sensorFault: true,
});
const resFault = alertEngine.processDeviceTelemetry(faultDev);
assert(
  resFault.highestSeverity === 'normal' && resFault.newEvents.length === 0,
  '12. Canales declarados en faultFields (4095/ADC desconectado) no disparan falsas alarmas'
);

alertEngine.resetPersistenceHandlers();

console.log(`\nRESUMEN DE PRUEBAS: ${passedTests}/${totalTests} superadas exitosamente.`);
if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
