import { 
  SensorDevice, 
  DeviceThresholdsConfig, 
  AlertEventRecord, 
  AlertThresholdLevel 
} from '../types';
import { 
  saveAlertThresholdEvent, 
  updateAlertThresholdEvent,
  DEFAULT_GLOBAL_THRESHOLDS 
} from './firebase';
import { soundAlert } from './audioAlert';

interface ActiveIncident {
  id: string;
  deviceId: string;
  variable: 'pm25' | 'mq2' | 'temperatura' | 'humedad';
  severity: 'preventivo' | 'advertencia' | 'critico';
  thresholdExceeded: number;
  initialTimestamp: number;
  lastValue: number;
}

class AlertEngine {
  // Mapa de incidentes activos para prevenir alertas duplicadas (anti-flapping)
  private activeIncidents: Map<string, ActiveIncident> = new Map();

  // Memoria de configs por dispositivo
  private deviceConfigs: Map<string, DeviceThresholdsConfig> = new Map();
  private globalConfig: DeviceThresholdsConfig = DEFAULT_GLOBAL_THRESHOLDS;

  public setGlobalConfig(config: DeviceThresholdsConfig) {
    this.globalConfig = config;
  }

  public setDeviceConfig(deviceId: string, config: DeviceThresholdsConfig) {
    this.deviceConfigs.set(deviceId, config);
  }

  public removeDeviceConfig(deviceId: string) {
    this.deviceConfigs.delete(deviceId);
  }

  /**
   * Obtiene la configuración aplicable a un dispositivo:
   * Si existe una específica para el dispositivo la utiliza; de lo contrario usa la global.
   */
  public getConfigForDevice(deviceId: string): DeviceThresholdsConfig {
    return this.deviceConfigs.get(deviceId) || this.globalConfig;
  }

  /**
   * Evalúa la telemetría recibida de un dispositivo contra los umbrales configurados
   */
  public processDeviceTelemetry(
    device: SensorDevice,
    customConfig?: DeviceThresholdsConfig
  ): {
    highestSeverity: AlertThresholdLevel;
    newEvents: AlertEventRecord[];
    recoveredEvents: AlertEventRecord[];
  } {
    const config = customConfig || this.getConfigForDevice(device.id);
    const newEvents: AlertEventRecord[] = [];
    const recoveredEvents: AlertEventRecord[] = [];

    // Si el dispositivo está desconectado, no emitir falsas alertas por pines flotantes (ej: 4095 ADC)
    if (device.status === 'desconectado' || device.signalStrength === 'sin_conexion') {
      return {
        highestSeverity: 'normal',
        newEvents: [],
        recoveredEvents: []
      };
    }

    const variablesToCheck: Array<{
      key: 'pm25' | 'mq2' | 'temperatura' | 'humedad';
      val: number | undefined;
    }> = [
      { key: 'mq2', val: device.rawCO },
      { key: 'pm25', val: device.rawPM25 },
      { key: 'temperatura', val: typeof device.rawTemp === 'number' ? device.rawTemp : device.metrics?.temperatura },
      { key: 'humedad', val: typeof device.rawHum === 'number' ? device.rawHum : device.metrics?.humedad },
    ];

    let highestSeverity: AlertThresholdLevel = 'normal';

    for (const item of variablesToCheck) {
      const { key, val } = item;
      const varConfig = config[key];

      if (!varConfig || !varConfig.activo || typeof val !== 'number' || isNaN(val)) {
        continue;
      }

      // Evaluar nivel de umbral
      let currentLevel: AlertThresholdLevel = 'normal';
      let exceededThreshold = 0;

      if (val >= varConfig.critico) {
        currentLevel = 'critico';
        exceededThreshold = varConfig.critico;
      } else if (val >= varConfig.advertencia) {
        currentLevel = 'advertencia';
        exceededThreshold = varConfig.advertencia;
      } else if (val >= varConfig.preventivo) {
        currentLevel = 'preventivo';
        exceededThreshold = varConfig.preventivo;
      }

      // Actualizar severidad máxima del dispositivo
      if (currentLevel === 'critico') {
        highestSeverity = 'critico';
      } else if (currentLevel === 'advertencia' && highestSeverity !== 'critico') {
        highestSeverity = 'advertencia';
      } else if (currentLevel === 'preventivo' && highestSeverity === 'normal') {
        highestSeverity = 'preventivo';
      }

      const incidentKey = `${device.id}:${key}`;
      const existingIncident = this.activeIncidents.get(incidentKey);

      if (currentLevel !== 'normal') {
        // ¿Debe generarse un nuevo evento de alerta?
        // Solo si: no existía incidente previo O hubo escalamiento de severidad (ej: preventivo -> advertencia -> critico)
        const isNewIncident = !existingIncident;
        const hasEscalated = existingIncident && this.getSeverityRank(currentLevel) > this.getSeverityRank(existingIncident.severity);

        if (isNewIncident || hasEscalated) {
          const now = Date.now();
          const eventId = `evt_${device.id}_${key}_${now}`;

          const eventRecord: AlertEventRecord = {
            id: eventId,
            dispositivo_id: device.id,
            dispositivo_nombre: device.name,
            sector_nombre: device.sectorName || 'Faena Central',
            variable: key,
            variable_label: varConfig.label,
            valor_detectado: Number(val.toFixed(1)),
            umbral_superado: exceededThreshold,
            nivel: currentLevel,
            unidad: varConfig.unidad,
            timestamp: now,
            fecha_hora: new Date(now).toLocaleTimeString('es-CL', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              day: '2-digit',
              month: '2-digit'
            }),
            estado: 'activa',
            origen: 'motor_umbrales'
          };

          this.activeIncidents.set(incidentKey, {
            id: eventId,
            deviceId: device.id,
            variable: key,
            severity: currentLevel,
            thresholdExceeded: exceededThreshold,
            initialTimestamp: now,
            lastValue: val
          });

          newEvents.push(eventRecord);

          // Si las notificaciones están habilitadas para la variable y es advertencia/crítico, reproducir audio
          if (varConfig.notificaciones && (currentLevel === 'advertencia' || currentLevel === 'critico')) {
            soundAlert.playAlert(currentLevel === 'critico' ? 'critico' : 'advertencia');
          }

          // Guardar de forma asíncrona en Firebase RTDB
          saveAlertThresholdEvent(eventRecord).catch((err) => {
            console.warn('Error saving threshold event to Firebase:', err);
          });
        } else if (existingIncident) {
          // Si la condición persiste sin escalar, actualizamos únicamente el último valor detectado
          // evitando generar spam de cientos de alertas repetidas
          existingIncident.lastValue = val;
        }
      } else {
        // La condición volvió a la normalidad: mecanismo de recuperación
        if (existingIncident) {
          const now = Date.now();
          const recoveredRecord: AlertEventRecord = {
            id: existingIncident.id,
            dispositivo_id: device.id,
            dispositivo_nombre: device.name,
            sector_nombre: device.sectorName || 'Faena Central',
            variable: key,
            variable_label: varConfig.label,
            valor_detectado: Number(val.toFixed(1)),
            umbral_superado: existingIncident.thresholdExceeded,
            nivel: existingIncident.severity,
            unidad: varConfig.unidad,
            timestamp: existingIncident.initialTimestamp,
            fecha_hora: new Date(existingIncident.initialTimestamp).toLocaleTimeString('es-CL'),
            estado: 'recuperada',
            recuperada_en: now,
            origen: 'motor_umbrales'
          };

          recoveredEvents.push(recoveredRecord);
          this.activeIncidents.delete(incidentKey);

          // Actualizar estado en Firebase RTDB a "recuperada"
          updateAlertThresholdEvent(existingIncident.id, {
            estado: 'recuperada',
            recuperada_en: now
          }).catch((err) => {
            console.warn('Error updating recovery state in Firebase:', err);
          });
        }
      }
    }

    return {
      highestSeverity,
      newEvents,
      recoveredEvents
    };
  }

  /**
   * Evalúa un lote de dispositivos completos
   */
  public processAllDevices(devices: SensorDevice[]): {
    newEvents: AlertEventRecord[];
    recoveredEvents: AlertEventRecord[];
  } {
    const allNew: AlertEventRecord[] = [];
    const allRecovered: AlertEventRecord[] = [];

    devices.forEach((dev) => {
      const res = this.processDeviceTelemetry(dev);
      allNew.push(...res.newEvents);
      allRecovered.push(...res.recoveredEvents);
    });

    return {
      newEvents: allNew,
      recoveredEvents: allRecovered
    };
  }

  /**
   * Resetea el estado de incidentes en memoria (útil en pruebas)
   */
  public clearActiveIncidents(): void {
    this.activeIncidents.clear();
  }

  /**
   * Lista los incidentes activos actualmente
   */
  public getActiveIncidentsCount(): number {
    return this.activeIncidents.size;
  }

  private getSeverityRank(sev: 'normal' | 'preventivo' | 'advertencia' | 'critico'): number {
    switch (sev) {
      case 'critico': return 3;
      case 'advertencia': return 2;
      case 'preventivo': return 1;
      default: return 0;
    }
  }
}

export const alertEngine = new AlertEngine();
