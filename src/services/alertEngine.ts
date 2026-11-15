import {
  SensorDevice,
  DeviceThresholdsConfig,
  AlertEventRecord,
  AlertThresholdLevel,
  SafetyAlert
} from '../types';
import {
  saveAlertThresholdEvent,
  updateAlertThresholdEvent,
  closeAlertLifecycleInRTDB,
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

export interface AlertEnginePersistenceHandlers {
  saveEvent?: (event: AlertEventRecord) => Promise<void>;
  updateEvent?: (eventId: string, updates: Partial<AlertEventRecord>) => Promise<void>;
  closeAlert?: (alertId: string, reason: string, options?: { clearEmergencyIfNone?: boolean }) => Promise<void>;
  playSound?: (level: 'advertencia' | 'critico') => void;
}

class AlertEngine {
  private activeIncidents: Map<string, ActiveIncident> = new Map();
  private deviceConfigs: Map<string, DeviceThresholdsConfig> = new Map();
  private globalConfig: DeviceThresholdsConfig = DEFAULT_GLOBAL_THRESHOLDS;

  private persistenceHandlers: Required<AlertEnginePersistenceHandlers> = {
    saveEvent: saveAlertThresholdEvent,
    updateEvent: updateAlertThresholdEvent,
    closeAlert: closeAlertLifecycleInRTDB,
    playSound: (level) => soundAlert.playAlert(level),
  };

  public setPersistenceHandlers(handlers: AlertEnginePersistenceHandlers): void {
    this.persistenceHandlers = {
      saveEvent: handlers.saveEvent || saveAlertThresholdEvent,
      updateEvent: handlers.updateEvent || updateAlertThresholdEvent,
      closeAlert: handlers.closeAlert || closeAlertLifecycleInRTDB,
      playSound: handlers.playSound || ((level) => soundAlert.playAlert(level)),
    };
  }

  public resetPersistenceHandlers(): void {
    this.persistenceHandlers = {
      saveEvent: saveAlertThresholdEvent,
      updateEvent: updateAlertThresholdEvent,
      closeAlert: closeAlertLifecycleInRTDB,
      playSound: (level) => soundAlert.playAlert(level),
    };
  }

  public setGlobalConfig(config: DeviceThresholdsConfig) {
    this.globalConfig = config;
  }

  public setDeviceConfig(deviceId: string, config: DeviceThresholdsConfig) {
    this.deviceConfigs.set(deviceId, config);
  }

  public removeDeviceConfig(deviceId: string) {
    this.deviceConfigs.delete(deviceId);
  }

  public getConfigForDevice(deviceId: string): DeviceThresholdsConfig {
    return this.deviceConfigs.get(deviceId) || this.globalConfig;
  }

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

    if (device.status === 'desconectado' || device.signalStrength === 'sin_conexion') {
      return {
        highestSeverity: 'normal',
        newEvents: [],
        recoveredEvents: []
      };
    }

    const faultSet = new Set(device.faultFields || []);

    const variablesToCheck: Array<{
      key: 'pm25' | 'mq2' | 'temperatura' | 'humedad';
      rawField: 'CO' | 'PM2_5' | 'temperatura' | 'humedad';
      val: number | undefined;
    }> = [
      { key: 'mq2', rawField: 'CO', val: faultSet.has('CO') ? undefined : device.rawCO },
      { key: 'pm25', rawField: 'PM2_5', val: faultSet.has('PM2_5') ? undefined : device.rawPM25 },
      {
        key: 'temperatura',
        rawField: 'temperatura',
        val: faultSet.has('temperatura') ? undefined : device.rawTemp,
      },
      {
        key: 'humedad',
        rawField: 'humedad',
        val: faultSet.has('humedad') ? undefined : device.rawHum,
      },
    ];

    let highestSeverity: AlertThresholdLevel = 'normal';

    for (const item of variablesToCheck) {
      const { key, val } = item;
      const varConfig = config[key];

      if (!varConfig || !varConfig.activo || typeof val !== 'number' || Number.isNaN(val)) {
        continue;
      }

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
        const isNewIncident = !existingIncident;
        const hasEscalated =
          Boolean(existingIncident) &&
          this.getSeverityRank(currentLevel) > this.getSeverityRank(existingIncident!.severity);

        if (isNewIncident || hasEscalated) {
          const now = Date.now();
          const eventId = `evt_${device.id}_${key}_${now}`;

          // Si hubo escalamiento de severidad, cerrar el incidente previo en RTDB para evitar alertas huérfanas
          if (hasEscalated && existingIncident) {
            this.persistenceHandlers
              .updateEvent(existingIncident.id, {
                estado: 'recuperada',
                recuperada_en: now,
              })
              .catch(() => {});
            this.persistenceHandlers
              .closeAlert(
                existingIncident.id,
                `Escalamiento automático a nivel ${currentLevel.toUpperCase()} (${eventId}).`,
                { clearEmergencyIfNone: false }
              )
              .catch(() => {});
          }

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

          if (varConfig.notificaciones && (currentLevel === 'advertencia' || currentLevel === 'critico')) {
            this.persistenceHandlers.playSound(currentLevel === 'critico' ? 'critico' : 'advertencia');
          }

          this.persistenceHandlers.saveEvent(eventRecord).catch((err) => {
            console.warn('Error saving threshold event:', err);
          });
        } else if (existingIncident) {
          existingIncident.lastValue = val;
        }
      } else {
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

          this.persistenceHandlers
            .updateEvent(existingIncident.id, {
              estado: 'recuperada',
              recuperada_en: now
            })
            .catch((err) => {
              console.warn('Error updating recovery state:', err);
            });

          const hasOtherCritical = Array.from(this.activeIncidents.values()).some(
            (inc) => inc.severity === 'critico'
          );

          this.persistenceHandlers
            .closeAlert(
              existingIncident.id,
              `Auto-recuperación de ${varConfig.label}: valor volvió a ${Number(val.toFixed(1))} ${varConfig.unidad} (< ${varConfig.preventivo} ${varConfig.unidad}).`,
              { clearEmergencyIfNone: !hasOtherCritical }
            )
            .catch((err) => {
              console.warn('Error closing recovered alert:', err);
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

  public clearActiveIncidents(): void {
    this.activeIncidents.clear();
  }

  public syncExistingActiveAlerts(existingAlerts: SafetyAlert[]): void {
    const validVars = new Set(['pm25', 'mq2', 'temperatura', 'humedad']);
    existingAlerts.forEach((a) => {
      if (a.resolved || !a.id.startsWith('evt_')) return;
      const parts = a.id.split('_');
      if (parts.length < 4) return;
      const tsStr = parts[parts.length - 1];
      const varKey = parts[parts.length - 2] as 'pm25' | 'mq2' | 'temperatura' | 'humedad';
      if (!validVars.has(varKey)) return;
      const deviceId = parts.slice(1, parts.length - 2).join('_');
      const incidentKey = `${deviceId}:${varKey}`;
      if (!this.activeIncidents.has(incidentKey)) {
        const mappedSeverity: 'preventivo' | 'advertencia' | 'critico' =
          a.severity === 'critico'
            ? 'critico'
            : a.severity === 'preventivo'
            ? 'preventivo'
            : 'advertencia';
        this.activeIncidents.set(incidentKey, {
          id: a.id,
          deviceId,
          variable: varKey,
          severity: mappedSeverity,
          thresholdExceeded: 0,
          initialTimestamp: Number(tsStr) || a.timestampMs || Date.now(),
          lastValue: 0,
        });
      }
    });
  }

  public getActiveIncidentsCount(): number {
    return this.activeIncidents.size;
  }

  public getActiveIncidentsSnapshot(): ActiveIncident[] {
    return Array.from(this.activeIncidents.values());
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
