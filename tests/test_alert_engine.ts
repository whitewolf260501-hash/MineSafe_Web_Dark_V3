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

console.log(`\nRESUMEN DE PRUEBAS: ${passedTests}/${totalTests} superadas exitosamente.`);
if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
