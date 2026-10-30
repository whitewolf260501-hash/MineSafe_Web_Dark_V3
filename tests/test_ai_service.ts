/**
 * Automated Verification Suite for MineSafe AI Service
 * Ejecuta pruebas unitarias e integración simulada sobre el servicio TypeScript.
 */

import { 
  Observation, 
  AnalyzeRequest, 
  requestAIAnalysis, 
  checkAIHealth, 
  recordRealTelemetryPoint, 
  getBufferedObservations, 
  clearBufferedObservations,
  AIAnalysisError 
} from '../src/services/aiService';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASÓ: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FALLÓ: ${testName} ${detail ? `(${detail})` : ''}`);
    testsFailed++;
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 EJECUTANDO SUITE DE PRUEBAS DE MINESAFE IA SERVICE');
  console.log('======================================================\n');

  // -----------------------------------------------------------
  // 1. Prueba de validación de observaciones mínimas (< 5)
  // -----------------------------------------------------------
  console.log('📦 1. Validación de observaciones mínimas requeridas');
  try {
    await requestAIAnalysis({
      device_id: 'TEST_NODE_01',
      observations: [
        { timestamp: '2026-10-29T12:00:00Z', mq2_raw: 120, unit: 'raw' },
        { timestamp: '2026-10-29T12:00:10Z', mq2_raw: 125, unit: 'raw' }
      ]
    });
    assert(false, 'Debe rechazar solicitudes con menos de 5 observaciones');
  } catch (err: any) {
    assert(
      err instanceof AIAnalysisError && err.statusCode === 422,
      'Rechaza correctamente con HTTP 422 cuando hay < 5 observaciones',
      err.message
    );
  }

  // -----------------------------------------------------------
  // 2. Prueba de validación de identificador de dispositivo
  // -----------------------------------------------------------
  console.log('\n🆔 2. Validación de device_id obligatorio');
  try {
    await requestAIAnalysis({
      device_id: '',
      observations: [
        { timestamp: '2026-10-29T12:00:00Z', mq2_raw: 100 },
        { timestamp: '2026-10-29T12:00:05Z', mq2_raw: 101 },
        { timestamp: '2026-10-29T12:00:10Z', mq2_raw: 102 },
        { timestamp: '2026-10-29T12:00:15Z', mq2_raw: 103 },
        { timestamp: '2026-10-29T12:00:20Z', mq2_raw: 104 },
      ]
    });
    assert(false, 'Debe rechazar device_id vacío');
  } catch (err: any) {
    assert(
      err instanceof AIAnalysisError && err.statusCode === 400,
      'Rechaza correctamente con HTTP 400 cuando falta device_id',
      err.message
    );
  }

  // -----------------------------------------------------------
  // 3. Prueba de deduplicación de marcas temporales
  // -----------------------------------------------------------
  console.log('\n⏱️ 3. Deduplicación de marcas temporales idénticas');
  try {
    // Se envían 5 elementos pero 2 tienen la misma marca temporal
    await requestAIAnalysis({
      device_id: 'NODO_U-01',
      observations: [
        { timestamp: '2026-10-29T12:00:00Z', mq2_raw: 100 },
        { timestamp: '2026-10-29T12:00:00Z', mq2_raw: 105 }, // duplicado
        { timestamp: '2026-10-29T12:00:10Z', mq2_raw: 102 },
        { timestamp: '2026-10-29T12:00:15Z', mq2_raw: 103 },
        { timestamp: '2026-10-29T12:00:20Z', mq2_raw: 104 },
      ]
    });
    assert(false, 'Debe detectar que tras deduplicar quedan solo 4 observaciones');
  } catch (err: any) {
    assert(
      err instanceof AIAnalysisError && err.statusCode === 422,
      'Deduplica marcas temporales y valida cantidad efectiva resultante',
      err.message
    );
  }

  // -----------------------------------------------------------
  // 4. Prueba del búfer de telemetría real en memoria
  // -----------------------------------------------------------
  console.log('\n💾 4. Búfer de telemetría real en memoria');
  const testDevId = 'TEST_BUFFER_DEV';
  clearBufferedObservations(testDevId);

  const initialBuffer = getBufferedObservations(testDevId);
  assert(initialBuffer.length === 0, 'El búfer inicial está vacío');

  const baseTime = Date.now();
  recordRealTelemetryPoint(testDevId, {
    coRaw: 210,
    pm25Raw: 45,
    temperature: 22.5,
    humidity: 48,
    timestamp: baseTime,
  });
  recordRealTelemetryPoint(testDevId, {
    coRaw: 212,
    pm25Raw: 46,
    temperature: 22.5,
    humidity: 48.2,
    timestamp: baseTime + 5000,
  });
  recordRealTelemetryPoint(testDevId, {
    coRaw: 215,
    pm25Raw: 47,
    temperature: 22.6,
    humidity: 48.5,
    timestamp: baseTime + 10000,
  });

  const updatedBuffer = getBufferedObservations(testDevId);
  assert(updatedBuffer.length === 3, 'El búfer acumuló exactamente 3 observaciones reales');
  assert(updatedBuffer[0].unit === 'raw', 'Las observaciones se etiquetan estrictamente como raw');
  assert(updatedBuffer[0].mq2_raw === 210, 'La medición analógica MQ-2 coincide');

  clearBufferedObservations(testDevId);

  // -----------------------------------------------------------
  // 5. Prueba de resiliencia ante backend fuera de línea
  // -----------------------------------------------------------
  console.log('\n🛡️ 5. Resiliencia ante servicio de IA fuera de línea / no bloqueante');
  const health = await checkAIHealth(1000);
  assert(
    typeof health.ok === 'boolean',
    'checkAIHealth retorna estructura uniforme sin lanzar excepciones no controladas'
  );
  if (!health.ok) {
    assert(
      Boolean(health.error),
      'Si el backend no está disponible en este entorno, reporta diagnóstico claro y no cuelga el hilo'
    );
  }

  console.log('\n======================================================');
  console.log(`📊 RESULTADO FINAL: ${testsPassed} Pasadas, ${testsFailed} Falladas`);
  console.log('======================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Error no controlado en la ejecución del test runner:', err);
  process.exit(1);
});
