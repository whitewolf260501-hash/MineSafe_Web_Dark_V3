import React, { useState, useEffect } from 'react';
import {
  Crown,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Sliders,
  Layout,
  Save,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  Flame,
  Wind,
  Thermometer,
  Droplets,
  Activity,
  Gauge,
  Megaphone,
  Shield,
  HardHat,
  Cpu,
  Volume2,
  Battery
} from 'lucide-react';
import {
  ControllableTab,
  PlatformConfig,
  UserProfile,
  WindowOverrideValue
} from '../types';
import {
  DEFAULT_PLATFORM_CONFIG,
  savePlatformConfig,
  resetPlatformConfigToDefault
} from '../services/firebase';
import { soundAlert } from '../services/audioAlert';

interface SuperAdminControlViewProps {
  currentUser: UserProfile;
  usersList: UserProfile[];
  platformConfig: PlatformConfig;
}

const CONTROLLABLE_WINDOWS: Array<{
  id: ControllableTab;
  label: string;
  description: string;
}> = [
  {
    id: 'dashboard',
    label: 'Dashboard Principal',
    description: 'Resumen operacional, tarjetas métricas, ESP32 Gateway y gráficos',
  },
  {
    id: 'monitoreo',
    label: 'Monitoreo IoT',
    description: 'Lectura detallada por sensor, simulaciones de gases y reset',
  },
  {
    id: 'alertas',
    label: 'Alertas y Auditoría',
    description: 'Incidencias activas, reconocimiento, cierre y registro /registro_alarmas',
  },
  {
    id: 'configuracion_alertas',
    label: 'Config. Umbrales',
    description: 'Ajuste de umbrales por dispositivo y bitácora de cambios',
  },
  {
    id: 'equipos',
    label: 'Equipos y Arriendos',
    description: 'Inventario de detectores, contratos de arriendo y cuadrillas',
  },
  {
    id: 'reportes',
    label: 'Historial y Reportes',
    description: 'Series históricas y exportación normativa DS 132',
  },
  {
    id: 'faenas',
    label: 'Faenas y Sectores',
    description: 'Sectores subterráneos, niveles de profundidad y ventilación',
  },
  {
    id: 'usuarios',
    label: 'Usuarios y Roles',
    description: 'Administración de cuentas RBAC, altas y permisos',
  },
];

export const SuperAdminControlView: React.FC<SuperAdminControlViewProps> = ({
  currentUser,
  usersList,
  platformConfig,
}) => {
  const [subTab, setSubTab] = useState<'windows' | 'metrics' | 'page'>('windows');
  const [draftConfig, setDraftConfig] = useState<PlatformConfig>(platformConfig);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearch, setUserSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setDraftConfig(JSON.parse(JSON.stringify(platformConfig)));
  }, [platformConfig]);

  // Seguridad estricta: solo el único SuperAdmin puede ver/usar este panel
  if (currentUser.role !== 'superadmin') {
    return (
      <div className="p-8 text-center bg-slate-900/80 border border-rose-800/60 rounded-2xl max-w-xl mx-auto my-12 shadow-xl">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Acceso Exclusivo del SuperAdministrador</h2>
        <p className="text-slate-400 text-sm">
          Esta consola maestra solo está disponible para el único SuperAdministrador de la plataforma.
        </p>
      </div>
    );
  }

  const nonSuperUsers = usersList.filter((u) => u.role !== 'superadmin');
  const filteredUsers = nonSuperUsers.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.rut && u.rut.toLowerCase().includes(q))
    );
  });

  const activeTargetUser =
    nonSuperUsers.find((u) => u.id === selectedUserId) || filteredUsers[0] || null;

  const showNotice = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleToggleRoleWindow = (role: 'admin' | 'operador', tabId: ControllableTab) => {
    soundAlert.playFeedbackBeep();
    setDraftConfig((prev) => ({
      ...prev,
      visibility: {
        ...prev.visibility,
        rolePermissions: {
          ...prev.visibility.rolePermissions,
          [role]: {
            ...prev.visibility.rolePermissions[role],
            [tabId]: !prev.visibility.rolePermissions[role][tabId],
          },
        },
      },
    }));
  };

  const handleSetAllRoleWindows = (role: 'admin' | 'operador', allowed: boolean) => {
    soundAlert.playFeedbackBeep();
    const updated: Record<ControllableTab, boolean> = {
      dashboard: allowed || true, // Mantener dashboard como mínimo seguro si se bloquean todas
      monitoreo: allowed,
      alertas: allowed,
      configuracion_alertas: allowed,
      equipos: allowed,
      reportes: allowed,
      faenas: allowed,
      usuarios: allowed,
    };
    if (!allowed) {
      updated.dashboard = false;
    }
    setDraftConfig((prev) => ({
      ...prev,
      visibility: {
        ...prev.visibility,
        rolePermissions: {
          ...prev.visibility.rolePermissions,
          [role]: updated,
        },
      },
    }));
  };

  const handleUserWindowOverride = (
    userId: string,
    tabId: ControllableTab,
    value: WindowOverrideValue
  ) => {
    soundAlert.playFeedbackBeep();
    setDraftConfig((prev) => {
      const nextOverrides = { ...(prev.visibility.userOverrides || {}) };
      const userMap = { ...(nextOverrides[userId] || {}) };
      if (value === 'inherit') {
        delete userMap[tabId];
      } else {
        userMap[tabId] = value;
      }
      if (Object.keys(userMap).length === 0) {
        delete nextOverrides[userId];
      } else {
        nextOverrides[userId] = userMap;
      }
      return {
        ...prev,
        visibility: {
          ...prev.visibility,
          userOverrides: nextOverrides,
        },
      };
    });
  };

  const handleClearUserOverrides = (userId: string) => {
    soundAlert.playFeedbackBeep();
    setDraftConfig((prev) => {
      const nextOverrides = { ...(prev.visibility.userOverrides || {}) };
      delete nextOverrides[userId];
      return {
        ...prev,
        visibility: {
          ...prev.visibility,
          userOverrides: nextOverrides,
        },
      };
    });
  };

  const handleMetricChange = (key: keyof PlatformConfig['metrics'], value: number) => {
    setDraftConfig((prev) => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        [key]: isNaN(value) ? 0 : value,
      },
    }));
  };

  const handleAppearanceChange = <K extends keyof PlatformConfig['appearance']>(
    key: K,
    value: PlatformConfig['appearance'][K]
  ) => {
    setDraftConfig((prev) => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        [key]: value,
      },
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await savePlatformConfig(draftConfig, currentUser);
      soundAlert.playFeedbackBeep();
      showNotice(
        'success',
        'Configuración maestra guardada en Firebase RTDB. Los permisos de ventanas, métricas y ajustes de página ya están activos para todos los usuarios.'
      );
    } catch (err: any) {
      soundAlert.playFeedbackBeep();
      showNotice('error', err?.message || 'Error al guardar la configuración maestra.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    setIsResetting(true);
    try {
      const restored = await resetPlatformConfigToDefault(currentUser);
      setDraftConfig(restored);
      soundAlert.playFeedbackBeep();
      showNotice('success', 'Se restauraron todas las métricas, bloqueos y ajustes de página a los valores predeterminados.');
    } catch (err: any) {
      showNotice('error', err?.message || 'Error al restaurar valores.');
    } finally {
      setIsResetting(false);
    }
  };

  const m = draftConfig.metrics;
  const metricErrors: string[] = [];
  if (m.coPreventivo >= m.coAdvertencia || m.coAdvertencia >= m.coCritico) {
    metricErrors.push('Gas CO (MQ-2): debe cumplirse Preventivo < Advertencia < Crítico.');
  }
  if (m.pm25Preventivo >= m.pm25Advertencia || m.pm25Advertencia >= m.pm25Critico) {
    metricErrors.push('Polvo PM2.5: debe cumplirse Preventivo < Advertencia < Crítico.');
  }
  if (m.tempPreventivo >= m.tempAdvertencia || m.tempAdvertencia >= m.tempCritico) {
    metricErrors.push('Temperatura: debe cumplirse Preventivo < Advertencia < Crítico.');
  }
  if (m.humPreventivo >= m.humAdvertencia || m.humAdvertencia >= m.humCritico) {
    metricErrors.push('Humedad: debe cumplirse Preventivo < Advertencia < Crítico.');
  }

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-purple-950/50 border border-purple-700/50 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-purple-950 border border-purple-600/80 flex items-center justify-center text-purple-300 shadow-lg shadow-purple-950/60 shrink-0">
              <Crown className="w-6 h-6 text-purple-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Control Maestro SuperAdministrador
                </h1>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-purple-950 text-purple-200 border border-purple-600">
                  Exclusivo SuperAdmin Único
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Ajusta todas las métricas operacionales, configura la plataforma completa y decide qué ventanas pueden ver o tienen bloqueadas los demás usuarios en tiempo real.
              </p>
              <p className="text-[11px] text-slate-400 font-mono mt-1.5">
                Última actualización: {platformConfig.actualizado_por || 'Sistema'} ·{' '}
                {platformConfig.actualizado_en
                  ? new Date(platformConfig.actualizado_en).toLocaleString('es-CL')
                  : 'Ahora'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={isResetting || isSaving}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>{isResetting ? 'Restaurando...' : 'Restaurar Fábrica'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || metricErrors.length > 0}
              className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-950 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Guardando en Firebase...' : 'Guardar Todos los Cambios'}</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation Pills */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('windows')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${
              subTab === 'windows'
                ? 'bg-purple-950/90 text-purple-200 border-purple-500 shadow-sm'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4 text-purple-400" />
            <span>Visibilidad y Bloqueo de Ventanas</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('metrics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${
              subTab === 'metrics'
                ? 'bg-cyan-950/90 text-cyan-200 border-cyan-500 shadow-sm'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Métricas y Umbrales de la Plataforma</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('page')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${
              subTab === 'page'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500 shadow-sm'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Layout className="w-4 h-4 text-emerald-400" />
            <span>Configuración General de la Página</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'error'
              ? 'bg-rose-950/80 border-rose-700 text-rose-200'
              : 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-[11px] underline opacity-80 hover:opacity-100">
            Cerrar
          </button>
        </div>
      )}

      {/* VALIDATION ERRORS */}
      {metricErrors.length > 0 && (
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-200 text-xs space-y-1">
          <div className="font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>Corrige las métricas antes de guardar:</span>
          </div>
          {metricErrors.map((err, i) => (
            <p key={i} className="pl-6">• {err}</p>
          ))}
        </div>
      )}

      {/* =====================================================================
          TAB 1: VISIBILIDAD Y BLOQUEO DE VENTANAS POR ROL Y POR USUARIO
         ===================================================================== */}
      {subTab === 'windows' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* LEFT: MATRIX BY ROLE */}
          <div className="xl:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-purple-400" />
                  Permisos de Ventanas por Tipo de Usuario (Rol)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Activa o bloquea cualquier pestaña para Administradores y Operadores. El SuperAdmin siempre ve todas las ventanas.
                </p>
              </div>
            </div>

            {/* Quick Bulk Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-900/40 flex items-center justify-between gap-2">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Administradores
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSetAllRoleWindows('admin', true)}
                    className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/60"
                  >
                    Ver todas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllRoleWindows('admin', false)}
                    className="px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900/60"
                  >
                    Bloquear todas
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 flex items-center justify-between gap-2">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <HardHat className="w-3.5 h-3.5" /> Usuarios Normales
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSetAllRoleWindows('operador', true)}
                    className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/60"
                  >
                    Ver todas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllRoleWindows('operador', false)}
                    className="px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900/60"
                  >
                    Bloquear todas
                  </button>
                </div>
              </div>
            </div>

            {/* Table of Controllable Windows */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Ventana de la Plataforma</th>
                    <th className="px-4 py-3 text-center">Administrador</th>
                    <th className="px-4 py-3 text-center">Operador (Normal)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {CONTROLLABLE_WINDOWS.map((win) => {
                    const adminVisible = draftConfig.visibility.rolePermissions.admin[win.id];
                    const opVisible = draftConfig.visibility.rolePermissions.operador[win.id];

                    return (
                      <tr key={win.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-bold text-white block">{win.label}</span>
                          <span className="text-[11px] text-slate-400">{win.description}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleRoleWindow('admin', win.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] border transition-colors ${
                              adminVisible
                                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700 hover:bg-emerald-900/60'
                                : 'bg-rose-950/70 text-rose-300 border-rose-700 hover:bg-rose-900/60'
                            }`}
                          >
                            {adminVisible ? (
                              <>
                                <Unlock className="w-3.5 h-3.5" />
                                <span>Visible</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>Bloqueada</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleRoleWindow('operador', win.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] border transition-colors ${
                              opVisible
                                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700 hover:bg-emerald-900/60'
                                : 'bg-rose-950/70 text-rose-300 border-rose-700 hover:bg-rose-900/60'
                            }`}
                          >
                            {opVisible ? (
                              <>
                                <Unlock className="w-3.5 h-3.5" />
                                <span>Visible</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>Bloqueada</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: PER-USER SPECIFIC WINDOW LOCKS / OVERRIDES */}
          <div className="xl:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 flex flex-col">
            <div className="pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Bloqueo Individual por Usuario
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Selecciona cualquier usuario para bloquearle o habilitarle ventanas puntuales por encima de las reglas de su rol.
              </p>
            </div>

            {/* Search & User Selector */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar usuario por nombre, correo o RUT..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {filteredUsers.map((u) => {
                  const isSelected = activeTargetUser?.id === u.id;
                  const customCount = Object.keys(
                    draftConfig.visibility.userOverrides?.[u.id] || {}
                  ).length;

                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-purple-950/60 border-purple-500 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-bold block truncate">{u.name}</span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {u.email} · {u.role === 'admin' ? 'Admin' : 'Operador'}
                        </span>
                      </div>
                      {customCount > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-900/70 text-purple-200 border border-purple-700 shrink-0 ml-2">
                          {customCount} regla{customCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Target User Override Matrix */}
            {activeTargetUser ? (
              <div className="flex-1 bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">
                      {activeTargetUser.name}
                    </span>
                    <span className="text-[10px] text-cyan-400 font-semibold uppercase">
                      Rol base: {activeTargetUser.role === 'admin' ? 'Administrador' : 'Usuario Normal (Operador)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleClearUserOverrides(activeTargetUser.id)}
                    className="text-[11px] text-slate-400 hover:text-white underline shrink-0"
                  >
                    Restablecer al Rol
                  </button>
                </div>

                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {CONTROLLABLE_WINDOWS.map((win) => {
                    const roleKey = activeTargetUser.role === 'admin' ? 'admin' : 'operador';
                    const roleDefault = draftConfig.visibility.rolePermissions[roleKey][win.id];
                    const currentOverride: WindowOverrideValue =
                      draftConfig.visibility.userOverrides?.[activeTargetUser.id]?.[win.id] ||
                      'inherit';

                    return (
                      <div
                        key={win.id}
                        className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-slate-200 block truncate">
                            {win.label}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Por rol: {roleDefault ? 'Visible' : 'Bloqueada'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() =>
                              handleUserWindowOverride(activeTargetUser.id, win.id, 'inherit')
                            }
                            className={`px-2 py-1 rounded border transition-colors ${
                              currentOverride === 'inherit'
                                ? 'bg-slate-700 text-white border-slate-500'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            Rol
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleUserWindowOverride(activeTargetUser.id, win.id, 'allow')
                            }
                            className={`px-2 py-1 rounded border transition-colors ${
                              currentOverride === 'allow'
                                ? 'bg-emerald-600 text-white border-emerald-400'
                                : 'bg-slate-950 text-emerald-400/70 border-slate-800 hover:text-emerald-300'
                            }`}
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleUserWindowOverride(activeTargetUser.id, win.id, 'block')
                            }
                            className={`px-2 py-1 rounded border flex items-center gap-1 transition-colors ${
                              currentOverride === 'block'
                                ? 'bg-rose-600 text-white border-rose-400'
                                : 'bg-slate-950 text-rose-400/70 border-slate-800 hover:text-rose-300'
                            }`}
                          >
                            <Lock className="w-2.5 h-2.5" />
                            <span>Bloquear</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800">
                No hay otros usuarios disponibles para personalizar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: AJUSTE DE TODAS LAS MÉTRICAS Y UMBRALES DE LA PLATAFORMA
         ===================================================================== */}
      {subTab === 'metrics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Gas CO / MQ-2 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-lg bg-amber-950 border border-amber-800 text-amber-400">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Gas Monóxido / Combustibles (MQ-2)</h3>
                <p className="text-[11px] text-slate-400">Umbrales ADC / motor de alertas y límite seguro de gráficos (ppm)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Preventivo (ADC)</label>
                <input
                  type="number"
                  value={m.coPreventivo}
                  onChange={(e) => handleMetricChange('coPreventivo', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Advertencia (ADC)</label>
                <input
                  type="number"
                  value={m.coAdvertencia}
                  onChange={(e) => handleMetricChange('coAdvertencia', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-amber-300 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Crítico (ADC)</label>
                <input
                  type="number"
                  value={m.coCritico}
                  onChange={(e) => handleMetricChange('coCritico', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-rose-300 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Límite Gráfico (ppm)</label>
                <input
                  type="number"
                  value={m.coChartSafeMax}
                  onChange={(e) => handleMetricChange('coChartSafeMax', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-cyan-300 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Polvo PM2.5 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Material Particulado (Polvo PM2.5)</h3>
                <p className="text-[11px] text-slate-400">Umbrales ópticos ESP32 y límite de referencia normativa (µg/m³)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Preventivo</label>
                <input
                  type="number"
                  value={m.pm25Preventivo}
                  onChange={(e) => handleMetricChange('pm25Preventivo', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Advertencia</label>
                <input
                  type="number"
                  value={m.pm25Advertencia}
                  onChange={(e) => handleMetricChange('pm25Advertencia', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-amber-300 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Crítico</label>
                <input
                  type="number"
                  value={m.pm25Critico}
                  onChange={(e) => handleMetricChange('pm25Critico', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-rose-300 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Límite Gráfico (µg/m³)</label>
                <input
                  type="number"
                  value={m.pm25ChartSafeMax}
                  onChange={(e) => handleMetricChange('pm25ChartSafeMax', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-cyan-300 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Temperatura & Humedad */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-lg bg-blue-950 border border-blue-800 text-blue-400">
                <Thermometer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Clima Subterráneo: Temperatura (°C) y Humedad (%)</h3>
                <p className="text-[11px] text-slate-400">Rangos térmicos e higrométricos para el Dashboard y alertas DHT</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Temp. Mín (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={m.tempMin}
                  onChange={(e) => handleMetricChange('tempMin', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Temp. Preventivo</label>
                <input
                  type="number"
                  step="0.5"
                  value={m.tempPreventivo}
                  onChange={(e) => handleMetricChange('tempPreventivo', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Temp. Advertencia</label>
                <input
                  type="number"
                  step="0.5"
                  value={m.tempAdvertencia}
                  onChange={(e) => handleMetricChange('tempAdvertencia', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-amber-300 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Temp. Crítico</label>
                <input
                  type="number"
                  step="0.5"
                  value={m.tempCritico}
                  onChange={(e) => handleMetricChange('tempCritico', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-rose-300 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Humedad Mín (%)</label>
                <input
                  type="number"
                  value={m.humMin}
                  onChange={(e) => handleMetricChange('humMin', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Hum. Preventivo</label>
                <input
                  type="number"
                  value={m.humPreventivo}
                  onChange={(e) => handleMetricChange('humPreventivo', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Hum. Advertencia</label>
                <input
                  type="number"
                  value={m.humAdvertencia}
                  onChange={(e) => handleMetricChange('humAdvertencia', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-amber-300 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Hum. Crítico</label>
                <input
                  type="number"
                  value={m.humCritico}
                  onChange={(e) => handleMetricChange('humCritico', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-rose-300 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Gases Secundarios, Ventilación, O2, Ruido y Emergencia */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Ventilación, Gases Secundarios y Emergencia Global</h3>
                <p className="text-[11px] text-slate-400">Parámetros para CO₂, CH₄, O₂, Ruido, Flujo de Aire, Batería y Gateway ESP32</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Flujo Aire Mín (m/s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={m.airFlowMin}
                  onChange={(e) => handleMetricChange('airFlowMin', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Flujo Aire Máx (m/s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={m.airFlowMax}
                  onChange={(e) => handleMetricChange('airFlowMax', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 flex items-center gap-1">
                  <Battery className="w-3 h-3 text-emerald-400" /> Batería Mín (%)
                </label>
                <input
                  type="number"
                  value={m.batteryMin}
                  onChange={(e) => handleMetricChange('batteryMin', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">CO₂ Seguro (ppm)</label>
                <input
                  type="number"
                  value={m.co2SafeMax}
                  onChange={(e) => handleMetricChange('co2SafeMax', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Metano CH₄ (% LEL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={m.ch4SafeMax}
                  onChange={(e) => handleMetricChange('ch4SafeMax', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Oxígeno O₂ Mín (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={m.o2MinSafe}
                  onChange={(e) => handleMetricChange('o2MinSafe', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-rose-400" /> Ruido Máx (dB)
                </label>
                <input
                  type="number"
                  value={m.noiseSafeMax}
                  onChange={(e) => handleMetricChange('noiseSafeMax', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-cyan-400" /> Timeout ESP32 (s)
                </label>
                <input
                  type="number"
                  value={m.gatewayTimeoutSeconds}
                  onChange={(e) => handleMetricChange('gatewayTimeoutSeconds', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-cyan-300 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Banner Gas Crítico</label>
                <input
                  type="number"
                  value={m.emergencyGasThreshold}
                  onChange={(e) => handleMetricChange('emergencyGasThreshold', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-rose-300 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Banner Polvo Crítico</label>
                <input
                  type="number"
                  value={m.emergencyDustThreshold}
                  onChange={(e) => handleMetricChange('emergencyDustThreshold', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-rose-300 font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: CONFIGURACIÓN GENERAL DE LA PÁGINA
         ===================================================================== */}
      {subTab === 'page' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Identity & Texts */}
          <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 text-xs">
            <div className="pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layout className="w-4 h-4 text-emerald-400" />
                Textos e Identidad de la Página
              </h2>
              <p className="text-slate-400 mt-0.5">
                Personaliza encabezados, etiqueta de faena activa y comunicado superior para todo el personal conectado.
              </p>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Título Principal del Dashboard</label>
              <input
                type="text"
                value={draftConfig.appearance.platformTitle}
                onChange={(e) => handleAppearanceChange('platformTitle', e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Subtítulo Operacional</label>
              <textarea
                rows={2}
                value={draftConfig.appearance.platformSubtitle}
                onChange={(e) => handleAppearanceChange('platformSubtitle', e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Etiqueta de Faena (Barra Superior)</label>
                <input
                  type="text"
                  value={draftConfig.appearance.siteBadgeText}
                  onChange={(e) => handleAppearanceChange('siteBadgeText', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-cyan-300 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Texto Normativo (Pie de Página)</label>
                <input
                  type="text"
                  value={draftConfig.appearance.footerText}
                  onChange={(e) => handleAppearanceChange('footerText', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300"
                />
              </div>
            </div>

            {/* Global Announcement Banner */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-400" />
                  Aviso / Comunicado Global en Cabecera
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleAppearanceChange('announcementEnabled', !draftConfig.appearance.announcementEnabled)
                  }
                  className={`px-3 py-1 rounded-lg font-bold text-[11px] border ${
                    draftConfig.appearance.announcementEnabled
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  {draftConfig.appearance.announcementEnabled ? 'Activado' : 'Desactivado'}
                </button>
              </div>

              <input
                type="text"
                placeholder="Ej: Mantención programada de sensores en Nivel -510m de 14:00 a 15:00 hrs."
                value={draftConfig.appearance.announcementText}
                onChange={(e) => handleAppearanceChange('announcementText', e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
              />

              <div className="flex items-center gap-2">
                <span className="text-slate-400">Nivel del aviso:</span>
                {(['info', 'warning', 'critical'] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => handleAppearanceChange('announcementTone', tone)}
                    className={`px-2.5 py-1 rounded border text-[11px] font-semibold ${
                      draftConfig.appearance.announcementTone === tone
                        ? 'bg-cyan-950 text-cyan-200 border-cyan-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {tone === 'info' ? 'Informativo' : tone === 'warning' ? 'Preventivo' : 'Crítico'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dashboard Modules & Operational Controls */}
          <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3 text-xs">
            <div className="pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Módulos Visibles y Controles de la Página
              </h2>
              <p className="text-slate-400 mt-0.5">
                Activa o desactiva bloques completos del Dashboard y funciones operativas para el resto de la plataforma.
              </p>
            </div>

            {(
              [
                {
                  key: 'showChartsAndUsers',
                  title: 'Panel de Gráficos de Sensores y Listado de Usuarios',
                  desc: 'Muestra la bienvenida, gráfico de barras de 9 sensores y directorio en vivo en el Dashboard.',
                },
                {
                  key: 'showESP32Section',
                  title: 'Sección Gateway ESP32 en Tiempo Real',
                  desc: 'Control de conexión ESP-NOW, estado del enlace y botón de auditoría CSV.',
                },
                {
                  key: 'showDualSensorCards',
                  title: 'Tarjetas de Lectura Dual (Amigable vs. Técnica)',
                  desc: 'Comparativa simplificada para operadores junto con lectura ADC/ppm técnica.',
                },
                {
                  key: 'showHeroMetricCards',
                  title: '6 Tarjetas Principales de Métricas (Clima, CO, Polvo, Batería, Flujo)',
                  desc: 'Grilla superior de indicadores numéricos con tendencias en vivo.',
                },
                {
                  key: 'showCapabilitiesGrid',
                  title: 'Grilla de 12 Capacidades Operacionales',
                  desc: 'Tarjetas de acceso rápido a módulos y protocolos DS 132.',
                },
                {
                  key: 'showAdditionalGasesRow',
                  title: 'Fila de Atmósferas Explosivas y Ruido Subterráneo',
                  desc: 'Indicadores complementarios de Metano (CH4), CO, PM2.5 y dB al final del Dashboard.',
                },
                {
                  key: 'allowHardwareControlsForNonSuperAdmin',
                  title: 'Controles Rápidos de Hardware (Luz / Alarma / Reset) en Barra Superior',
                  desc: 'Permite que Admin y Operador vean los botones rápidos de baliza/sirena en el Navbar.',
                },
                {
                  key: 'allowEmergencyButtonForOperador',
                  title: 'Botón de Evacuación / Emergencia para Operadores',
                  desc: 'Si se desactiva, el botón rojo de emergencia en el Navbar solo lo ven Admin y SuperAdmin.',
                },
              ] as Array<{
                key: keyof PlatformConfig['appearance'];
                title: string;
                desc: string;
              }>
            ).map((item) => {
              const active = Boolean(draftConfig.appearance[item.key]);
              return (
                <div
                  key={item.key}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="font-bold text-slate-200 block">{item.title}</span>
                    <span className="text-[11px] text-slate-400">{item.desc}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAppearanceChange(item.key, !active as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] border shrink-0 flex items-center gap-1.5 transition-colors ${
                      active
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {active ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Oculto</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
