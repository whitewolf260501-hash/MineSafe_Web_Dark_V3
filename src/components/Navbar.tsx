import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Radio, 
  FileText, 
  MapPin, 
  Cpu, 
  Volume2, 
  VolumeX, 
  AlertTriangle,
  Menu, 
  X, 
  UserCheck, 
  ChevronDown,
  RefreshCw,
  Users,
  Crown,
  Shield,
  HardHat,
  LogOut,
  Lightbulb,
  LightbulbOff,
  BellRing,
  BellOff,
  RotateCcw,
  Smartphone,
  Sparkles
} from 'lucide-react';
import { NavigationTab, UserProfile } from '../types';
import { soundAlert } from '../services/audioAlert';
import { MobileAppDownloadModal } from './MobileAppDownloadModal';

interface NavbarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  activeAlertCount: number;
  currentUser: UserProfile;
  onChangeUser: () => void;
  onLogout?: () => void;
  onTriggerEmergency: () => void;
  onRefreshData: () => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  isFirebaseConnected?: boolean;
  onResetPageLevels?: () => void;
  isAlarmActive?: boolean;
  onToggleAlarm?: () => void;
  isLightActive?: boolean;
  onToggleLight?: () => void;
  isDrillActive?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  activeAlertCount,
  currentUser,
  onChangeUser,
  onLogout,
  onTriggerEmergency,
  onRefreshData,
  isSimulating,
  onToggleSimulation,
  isFirebaseConnected = true,
  onResetPageLevels,
  isAlarmActive = false,
  onToggleAlarm,
  isLightActive = false,
  onToggleLight,
  isDrillActive = false,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [isMuted, setIsMuted] = useState(soundAlert.getMutedState());

  const handleToggleSound = () => {
    const muted = soundAlert.toggleMute();
    setIsMuted(muted);
    if (!muted) soundAlert.playFeedbackBeep();
  };

  const isSuperOrAdmin = currentUser.role === 'superadmin' || currentUser.role === 'admin';

  const navLinks: { id: NavigationTab; label: string; shortLabel: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: <Activity className="w-4 h-4 shrink-0" /> },
    { id: 'monitoreo', label: 'Monitoreo IoT', shortLabel: 'Monitoreo', icon: <Radio className="w-4 h-4 shrink-0" /> },
    { 
      id: 'alertas', 
      label: 'Alertas', 
      shortLabel: 'Alertas',
      icon: <AlertTriangle className="w-4 h-4 shrink-0" />, 
      badge: activeAlertCount > 0 ? activeAlertCount : undefined 
    },
    { id: 'ia', label: 'MineSafe IA', shortLabel: 'IA Series', icon: <Sparkles className="w-4 h-4 shrink-0 text-cyan-400" /> },
    { id: 'equipos', label: 'Equipos y Arriendos', shortLabel: 'Equipos', icon: <Cpu className="w-4 h-4 shrink-0" /> },
    { id: 'reportes', label: 'Historial y Reportes', shortLabel: 'Reportes', icon: <FileText className="w-4 h-4 shrink-0" /> },
    { id: 'faenas', label: 'Faenas y Sectores', shortLabel: 'Sectores', icon: <MapPin className="w-4 h-4 shrink-0" /> },
    ...(isSuperOrAdmin ? [
      { id: 'usuarios' as NavigationTab, label: 'Usuarios y Roles', shortLabel: 'Usuarios', icon: <Users className="w-4 h-4 shrink-0" /> }
    ] : [])
  ];

  const getRoleTheme = () => {
    switch (currentUser.role) {
      case 'superadmin':
        return {
          bg: 'bg-purple-950/80 border-purple-800 text-purple-200',
          avatarBg: 'bg-purple-900 text-purple-200 border-purple-700',
          badgeText: 'SuperAdmin',
          icon: <Crown className="w-3 h-3 text-purple-400" />
        };
      case 'admin':
        return {
          bg: 'bg-cyan-950/80 border-cyan-800 text-cyan-200',
          avatarBg: 'bg-cyan-900 text-cyan-200 border-cyan-700',
          badgeText: 'Admin',
          icon: <Shield className="w-3 h-3 text-cyan-400" />
        };
      default:
        return {
          bg: 'bg-amber-950/80 border-amber-800 text-amber-200',
          avatarBg: 'bg-amber-900 text-amber-200 border-amber-700',
          badgeText: 'Usuario Normal',
          icon: <HardHat className="w-3 h-3 text-amber-400" />
        };
    }
  };

  const roleTheme = getRoleTheme();

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 shadow-lg shadow-black/40">
      <div className="w-full max-w-[1850px] mx-auto px-3 sm:px-4 lg:px-6">
        
        {/* ROW 1: BRAND, RTDB STATUS, HARDWARE CONTROLS, PROFILE & EVACUATION */}
        <div className="flex items-center justify-between h-14 gap-2">
          
          {/* ZONE 1: BRAND WORDMARK & RTDB STATUS */}
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => onSelectTab('dashboard')} 
              className="flex items-center gap-2 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-md"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform duration-150 shrink-0">
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5 whitespace-nowrap">
                Mine<span className="text-cyan-400">Safe</span>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-700/50 font-medium">IoT</span>
              </span>
            </button>

            {/* Firebase Realtime Database Status */}
            <div 
              title={isFirebaseConnected ? "Conectado a Firebase Realtime Database: https://minefase-fc5f5-default-rtdb.firebaseio.com/" : "Conectando a RTDB..."}
              className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 shrink-0"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${isFirebaseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="font-semibold text-emerald-400">RTDB: minefase-fc5f5</span>
            </div>
          </div>

          {/* ZONE 2: DESKTOP CONTROLS, PROFILE & EVACUATION ACTION */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            
            {/* Quick Hardware & Simulation Control Group */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 shrink-0">
              {/* Simulation stream toggle */}
              <button
                onClick={onToggleSimulation}
                title={isSimulating ? 'Pausar simulación IoT' : 'Activar simulación IoT'}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md border transition-colors shrink-0 ${
                  isSimulating 
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/50' 
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${isSimulating ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-[11px] font-medium">{isSimulating ? 'En Vivo' : 'Pausado'}</span>
              </button>

              {/* Manual refresh button */}
              <button
                onClick={onRefreshData}
                title="Actualizar mediciones ahora"
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              {/* Audio chime mute button */}
              <button
                onClick={handleToggleSound}
                title={isMuted ? 'Activar sirena de alertas' : 'Silenciar sirena de alertas'}
                className={`p-1 rounded transition-colors shrink-0 ${
                  isMuted 
                    ? 'text-slate-500 hover:bg-slate-800' 
                    : 'text-cyan-400 bg-cyan-950/60 hover:bg-cyan-900/50'
                }`}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {/* Quick Toggle Light Button */}
              {onToggleLight && (
                <button
                  onClick={onToggleLight}
                  className={`px-1.5 py-1 rounded text-xs flex items-center gap-1 transition-colors shrink-0 ${
                    isLightActive
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm shadow-amber-500/50'
                      : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
                  }`}
                  title={isLightActive ? 'Luz / Baliza encendida - Clic para apagar' : 'Luz apagada - Clic para encender'}
                >
                  {isLightActive ? <Lightbulb className="w-3.5 h-3.5 fill-current" /> : <LightbulbOff className="w-3.5 h-3.5" />}
                  <span className="text-[11px] font-bold">{isLightActive ? 'Luz ON' : 'Luz'}</span>
                </button>
              )}

              {/* Quick Toggle Alarm Siren Button */}
              {onToggleAlarm && (
                <button
                  onClick={onToggleAlarm}
                  className={`px-1.5 py-1 rounded text-xs flex items-center gap-1 transition-colors shrink-0 ${
                    isAlarmActive
                      ? 'bg-rose-600 text-white animate-pulse font-bold shadow-sm shadow-rose-950'
                      : 'text-slate-400 hover:text-rose-300 hover:bg-slate-800'
                  }`}
                  title={isAlarmActive ? 'Alarma activa - Clic para desactivar sirena' : 'Alarma inactiva - Clic para activar sirena'}
                >
                  {isAlarmActive ? <BellRing className="w-3.5 h-3.5 animate-bounce" /> : <BellOff className="w-3.5 h-3.5" />}
                  <span className="text-[11px] font-bold">{isAlarmActive ? 'Alarma ON' : 'Alarma'}</span>
                </button>
              )}

              {/* Quick Reset Baseline Button */}
              {onResetPageLevels && (
                <button
                  onClick={onResetPageLevels}
                  className="px-1.5 py-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 text-xs flex items-center gap-1 transition-colors shrink-0"
                  title="Resetear niveles de la página a condiciones basales seguras (DS 132)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px]">Reset</span>
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="h-5 w-px bg-slate-800" />

            {/* User Account / Role switcher button */}
            <button
              onClick={onChangeUser}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs transition-colors hover:scale-102 shrink-0 ${roleTheme.bg}`}
              title="Clic para cambiar de usuario o iniciar sesión"
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] border shrink-0 ${roleTheme.avatarBg}`}>
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left">
                <p className="font-semibold text-white truncate max-w-[110px] text-xs leading-tight">{currentUser.name.split(' ')[0]}</p>
                <p className="text-[9px] font-bold flex items-center gap-0.5 uppercase tracking-wider leading-none">
                  {roleTheme.icon}
                  {roleTheme.badgeText}
                </p>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {/* Logout button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-rose-950/40 hover:border-rose-800/60 text-slate-400 hover:text-rose-300 text-xs transition-colors shrink-0"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-[11px] font-medium">Salir</span>
              </button>
            )}

            {/* Emergency Protocol Trigger */}
            <button
              onClick={onTriggerEmergency}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg shadow-md transition-all whitespace-nowrap shrink-0 ${
                isDrillActive
                  ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse shadow-amber-950 ring-2 ring-amber-400'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950 hover:shadow-rose-900'
              }`}
              title="Protocolo de Evacuación y Simulacro DS 132"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                {isDrillActive 
                  ? 'Simulacro Activo' 
                  : (currentUser?.role === 'superadmin' || currentUser?.role === 'admin' ? 'Simulacro / Evacuación' : 'Evacuación')}
              </span>
            </button>
          </div>

          {/* Mobile menu trigger button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={handleToggleSound}
              className="p-2 text-slate-400 hover:text-white"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white focus:outline-none"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>

        {/* ROW 2: INDUSTRIAL MODULE NAVIGATION TABS */}
        <div className="hidden md:flex items-center justify-between border-t border-slate-800/80 py-1.5 overflow-x-auto no-scrollbar gap-2">
          <nav className="flex items-center gap-1 sm:gap-1.5">
            {navLinks.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    soundAlert.playFeedbackBeep();
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs lg:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/70 shadow-sm shadow-cyan-950/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                  }`}
                  title={item.label}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-1 px-1.5 py-0.2 text-[11px] font-bold rounded-full bg-rose-950 text-rose-300 border border-rose-800/80">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Subterranean shift info status indicator & Mobile App Button */}
          <div className="hidden lg:flex items-center gap-3 shrink-0 pl-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Faena El Teniente · Nivel -510m</span>
            </div>

            <button
              onClick={() => setShowMobileModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-cyan-950/70 border border-cyan-800/80 text-cyan-300 hover:bg-cyan-900/80 hover:text-cyan-200 transition-colors shadow-sm"
              title="Descargar Aplicación Móvil Android (APK) y PWA"
            >
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>App Móvil (APK)</span>
            </button>
          </div>
        </div>

      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-3 pb-5 space-y-3">
          <div className="grid grid-cols-1 gap-1">
            {navLinks.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    setMobileMenuOpen(false);
                    soundAlert.playFeedbackBeep();
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
            <button
              onClick={() => {
                setShowMobileModal(true);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg border border-cyan-800 bg-cyan-950/70 text-cyan-300 hover:bg-cyan-900"
            >
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>Descargar App Móvil APK / PWA</span>
            </button>

            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  onChangeUser();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800 px-3 py-2 rounded-lg"
              >
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <span>{currentUser.name} ({roleTheme.badgeText})</span>
              </button>
              <button
                onClick={() => {
                  onTriggerEmergency();
                  setMobileMenuOpen(false);
                }}
                className={`px-3 py-2 text-xs font-semibold rounded-lg text-white ${
                  isDrillActive ? 'bg-amber-600 animate-pulse' : 'bg-rose-600'
                }`}
              >
                {isDrillActive ? 'Simulacro Activo' : (currentUser?.role === 'superadmin' || currentUser?.role === 'admin' ? 'Simulacro / Evacuación' : 'Evacuación')}
              </button>
            </div>

            {onLogout && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg border border-rose-800 bg-rose-950/60 text-rose-300 hover:bg-rose-900"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar Sesión</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal de descarga de la aplicación móvil */}
      <MobileAppDownloadModal
        isOpen={showMobileModal}
        onClose={() => setShowMobileModal(false)}
      />
    </header>
  );
};
