import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Users, 
  Crown, 
  Shield, 
  HardHat, 
  Activity, 
  Cpu, 
  Radio, 
  BarChart3, 
  TrendingUp, 
  ChevronRight, 
  Search, 
  Flame, 
  Wind, 
  Droplets, 
  Thermometer, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Battery,
  Wifi,
  Sparkles,
  Layers,
  ArrowUpDown,
  Volume2,
  Zap,
  Gauge,
  Smartphone,
  Download,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { SensorDevice, UserProfile, UserRole } from '../types';
import { MobileAppDownloadModal } from './MobileAppDownloadModal';

interface InteractiveDeviceChartAndUsersProps {
  currentUser?: UserProfile | null;
  usersList: UserProfile[];
  devices: SensorDevice[];
  activeDeviceId?: string;
  onSelectDevice: (deviceId: string) => void;
  onSelectUser?: (user: UserProfile) => void;
  onChangeUserModal?: () => void;
  activeAlertCount?: number;
}

export const InteractiveDeviceChartAndUsers: React.FC<InteractiveDeviceChartAndUsersProps> = ({
  currentUser,
  usersList,
  devices,
  activeDeviceId,
  onSelectDevice,
  onSelectUser,
  onChangeUserModal,
  activeAlertCount = 0,
}) => {
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'todos' | UserRole>('todos');
  const [chartViewMode, setChartViewMode] = useState<'all_bars' | 'levels' | 'timeline'>('all_bars');
  const [timelineGroup, setTimelineGroup] = useState<'gases' | 'clima' | 'seguridad' | 'todos'>('gases');
  const [hoveredSensorId, setHoveredSensorId] = useState<string | null>(null);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [mobileModalTab, setMobileModalTab] = useState<'apk' | 'pwa' | 'qr'>('apk');
  const [cardQrUrl, setCardQrUrl] = useState<string>('');
  const [cardQrMode, setCardQrMode] = useState<'gdrive' | 'direct'>('gdrive');
  const [cardQrCopied, setCardQrCopied] = useState(false);
  const [directDownloadSuccess, setDirectDownloadSuccess] = useState(false);

  // Generate Scannable QR Code for the in-card section
  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const targetUrl = cardQrMode === 'gdrive'
      ? 'https://drive.google.com/file/d/1trG9ISNGFsg77aRpfW_pcqHXWzx_JQlh/view?usp=drive_link'
      : `${origin}/MineSafe_IoT_Mobile_v2.4.apk`;

    QRCode.toDataURL(targetUrl, {
      width: 256,
      margin: 1.5,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#030712',
        light: '#ffffff',
      },
    })
      .then((url) => setCardQrUrl(url))
      .catch((err) => console.error('Error generating card QR:', err));
  }, [cardQrMode]);

  const handleOpenMobileModal = (tab: 'apk' | 'pwa' | 'qr' = 'apk') => {
    setMobileModalTab(tab);
    setShowMobileModal(true);
  };

  // Direct APK download trigger
  const handleDirectApkDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = '/MineSafe_IoT_Mobile_v2.4.apk';
      link.download = 'MineSafe_IoT_Mobile_v2.4.apk';
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDirectDownloadSuccess(true);
      setTimeout(() => setDirectDownloadSuccess(false), 4500);
    } catch {
      handleOpenMobileModal('apk');
    }
  };

  const handleCopyCardQrUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const targetUrl = cardQrMode === 'gdrive'
      ? 'https://drive.google.com/file/d/1trG9ISNGFsg77aRpfW_pcqHXWzx_JQlh/view?usp=drive_link'
      : `${origin}/MineSafe_IoT_Mobile_v2.4.apk`;
    navigator.clipboard.writeText(targetUrl);
    setCardQrCopied(true);
    setTimeout(() => setCardQrCopied(false), 2500);
  };

  // Currently selected device for the chart
  const currentDevice = devices.find(d => d.id === activeDeviceId) || devices[0];

  // Helper for current user role theme
  const getRoleDetails = (role?: UserRole) => {
    switch (role) {
      case 'superadmin':
        return {
          label: 'Superadministrador',
          typeText: '(Superadmin)',
          bg: 'bg-purple-950/70 border-purple-600/70 text-purple-300 shadow-purple-950/40',
          badgeBg: 'bg-purple-900/60 border-purple-500/80 text-purple-200',
          avatarBg: 'bg-gradient-to-br from-purple-600 to-indigo-800 text-white border-purple-400',
          icon: <Crown className="w-4 h-4 text-purple-400" />,
          description: 'Control Total de Faena, Parámetros y Auditoría Sernageomin'
        };
      case 'admin':
        return {
          label: 'Administrador / Prevencionista',
          typeText: '(Admin)',
          bg: 'bg-cyan-950/70 border-cyan-600/70 text-cyan-300 shadow-cyan-950/40',
          badgeBg: 'bg-cyan-900/60 border-cyan-500/80 text-cyan-200',
          avatarBg: 'bg-gradient-to-br from-cyan-600 to-blue-800 text-white border-cyan-400',
          icon: <Shield className="w-4 h-4 text-cyan-400" />,
          description: 'Gestión de Alertas, Equipos, Reportes y Operaciones'
        };
      case 'operador':
      default:
        return {
          label: 'Operador de Terreno',
          typeText: '(Operador)',
          bg: 'bg-amber-950/70 border-amber-600/70 text-amber-300 shadow-amber-950/40',
          badgeBg: 'bg-amber-900/60 border-amber-500/80 text-amber-200',
          avatarBg: 'bg-gradient-to-br from-amber-600 to-orange-700 text-white border-amber-400',
          icon: <HardHat className="w-4 h-4 text-amber-400" />,
          description: 'Monitoreo de Variables Atmosféricas y Protocolo de Seguridad'
        };
    }
  };

  const userRoleInfo = getRoleDetails(currentUser?.role);

  // Filter users based on search query and role filter
  const filteredUsers = usersList.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      (user.rut && user.rut.toLowerCase().includes(userSearchTerm.toLowerCase())) ||
      (user.shift && user.shift.toLowerCase().includes(userSearchTerm.toLowerCase()));
    
    const matchesRole = selectedRoleFilter === 'todos' || user.role === selectedRoleFilter;
    return matchesSearch && matchesRole;
  });

  // Calculate stats for top quick widgets
  const totalUsersCount = usersList.length;
  const superadminCount = usersList.filter(u => u.role === 'superadmin').length;
  const adminCount = usersList.filter(u => u.role === 'admin').length;
  const operadorCount = usersList.filter(u => u.role === 'operador').length;
  const onlineDevicesCount = devices.filter(d => d.status !== 'desconectado').length;

  // Extract readings for the currently selected device
  const coValue = currentDevice?.rawCO !== undefined ? currentDevice.rawCO : (currentDevice?.metrics?.co ?? 8.2);
  const pm25Value = currentDevice?.rawPM25 !== undefined ? currentDevice.rawPM25 : (currentDevice?.metrics?.polvoPM ?? 22.0);
  const tempValue = currentDevice?.rawTemp !== undefined ? currentDevice.rawTemp : (currentDevice?.metrics?.temperatura ?? 22.4);
  const humValue = currentDevice?.rawHum !== undefined ? currentDevice.rawHum : (currentDevice?.metrics?.humedad ?? 54.0);
  const co2Value = currentDevice?.metrics?.co2 ?? 760;
  const airFlowValue = currentDevice?.metrics?.flujoAire ?? 0.85;
  const ch4Value = currentDevice?.metrics?.ch4 ?? 0.8;
  const noiseValue = currentDevice?.metrics?.ruido ?? 74;
  const o2Value = currentDevice?.metrics?.o2 ?? 20.8;
  const batteryPct = currentDevice?.batteryPct ?? 90;

  // Complete list of ALL 9 sensors with precise units, limits, and color themes
  const allSensorBars = [
    {
      id: 'temp',
      name: 'Temperatura',
      shortName: 'Temp',
      unit: '°C',
      value: Number(tempValue.toFixed(1)),
      safeMax: 28,
      criticalMax: 32,
      scaleMax: 40,
      icon: <Thermometer className="w-4 h-4 text-cyan-400" />,
      gradient: 'from-cyan-500 to-blue-600',
      glowColor: 'shadow-cyan-500/30',
      badgeColor: tempValue > 30 ? 'bg-rose-950 text-rose-300 border-rose-800' : tempValue > 28 ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-cyan-950 text-cyan-300 border-cyan-800',
      textColor: tempValue > 30 ? 'text-rose-400' : tempValue > 28 ? 'text-amber-400' : 'text-cyan-400',
      status: tempValue > 30 ? 'Calor' : tempValue > 28 ? 'Alerta' : 'Óptimo',
      norm: 'DS 132: 18° - 28°C'
    },
    {
      id: 'hum',
      name: 'Humedad',
      shortName: 'Humedad',
      unit: '%',
      value: Number(humValue.toFixed(1)),
      safeMax: 70,
      criticalMax: 85,
      scaleMax: 100,
      icon: <Droplets className="w-4 h-4 text-blue-400" />,
      gradient: 'from-blue-500 to-indigo-600',
      glowColor: 'shadow-blue-500/30',
      badgeColor: humValue > 85 ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-blue-950 text-blue-300 border-blue-800',
      textColor: humValue > 85 ? 'text-amber-400' : 'text-blue-400',
      status: humValue > 85 ? 'Elevada' : 'Normal',
      norm: 'DS 132: 40% - 70%'
    },
    {
      id: 'co',
      name: 'Monóxido CO (MQ-2)',
      shortName: 'CO (MQ2)',
      unit: 'ppm',
      value: Number(coValue.toFixed(1)),
      safeMax: 50,
      criticalMax: 100,
      scaleMax: 100,
      icon: <Flame className="w-4 h-4 text-orange-400" />,
      gradient: coValue > 50 ? 'from-rose-600 to-red-500' : coValue > 25 ? 'from-amber-500 to-orange-500' : 'from-emerald-500 to-teal-500',
      glowColor: coValue > 50 ? 'shadow-rose-500/40' : 'shadow-orange-500/30',
      badgeColor: coValue > 50 ? 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse' : coValue > 25 ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800',
      textColor: coValue > 50 ? 'text-rose-400' : coValue > 25 ? 'text-amber-400' : 'text-emerald-400',
      status: coValue > 50 ? 'Peligro' : coValue > 25 ? 'Alerta' : 'Seguro',
      norm: 'DS 132: LPP ≤ 50 ppm'
    },
    {
      id: 'co2',
      name: 'Dióxido CO2',
      shortName: 'CO2',
      unit: 'ppm',
      value: co2Value,
      safeMax: 1000,
      criticalMax: 2000,
      scaleMax: 2000,
      icon: <Wind className="w-4 h-4 text-emerald-400" />,
      gradient: co2Value > 1500 ? 'from-rose-500 to-red-600' : co2Value > 1000 ? 'from-amber-500 to-yellow-600' : 'from-emerald-500 to-green-600',
      glowColor: 'shadow-emerald-500/30',
      badgeColor: co2Value > 1500 ? 'bg-rose-950 text-rose-300 border-rose-800' : co2Value > 1000 ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800',
      textColor: co2Value > 1500 ? 'text-rose-400' : co2Value > 1000 ? 'text-amber-400' : 'text-emerald-400',
      status: co2Value > 1500 ? 'Ventilar' : co2Value > 1000 ? 'Atención' : 'Seguro',
      norm: 'DS 132: LPP ≤ 1000 ppm'
    },
    {
      id: 'pm25',
      name: 'Polvo en Suspensión',
      shortName: 'PM2.5',
      unit: 'µg/m³',
      value: Number(pm25Value.toFixed(1)),
      safeMax: 50,
      criticalMax: 150,
      scaleMax: 150,
      icon: <Layers className="w-4 h-4 text-amber-300" />,
      gradient: pm25Value > 150 ? 'from-rose-500 to-red-600' : pm25Value > 50 ? 'from-amber-500 to-yellow-500' : 'from-cyan-500 to-teal-500',
      glowColor: 'shadow-amber-500/30',
      badgeColor: pm25Value > 150 ? 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse' : pm25Value > 50 ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-cyan-950 text-cyan-300 border-cyan-800',
      textColor: pm25Value > 150 ? 'text-rose-400' : pm25Value > 50 ? 'text-amber-400' : 'text-cyan-400',
      status: pm25Value > 150 ? 'Crítico' : pm25Value > 50 ? 'Moderado' : 'Óptimo',
      norm: 'DS 132: LPP ≤ 50 µg/m³'
    },
    {
      id: 'ch4',
      name: 'Gas Metano (CH4)',
      shortName: 'CH4',
      unit: '% LEL',
      value: Number(ch4Value.toFixed(1)),
      safeMax: 1.5,
      criticalMax: 5.0,
      scaleMax: 5.0,
      icon: <Zap className="w-4 h-4 text-purple-400" />,
      gradient: ch4Value > 1.5 ? 'from-rose-600 to-red-600' : 'from-purple-500 to-pink-500',
      glowColor: 'shadow-purple-500/30',
      badgeColor: ch4Value > 1.5 ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-purple-950 text-purple-300 border-purple-800',
      textColor: ch4Value > 1.5 ? 'text-rose-400' : 'text-purple-400',
      status: ch4Value > 1.5 ? 'Crítico' : 'Seguro',
      norm: 'DS 132: Máx 1.5% LEL'
    },
    {
      id: 'airFlow',
      name: 'Flujo de Ventilación',
      shortName: 'Ventilación',
      unit: 'm/s',
      value: Number(airFlowValue.toFixed(2)),
      safeMax: 2.5,
      criticalMax: 0.5,
      scaleMax: 3.0,
      icon: <Wind className="w-4 h-4 text-teal-400" />,
      gradient: airFlowValue < 0.5 ? 'from-rose-600 to-red-500' : 'from-teal-500 to-emerald-500',
      glowColor: 'shadow-teal-500/30',
      badgeColor: airFlowValue < 0.5 ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-teal-950 text-teal-300 border-teal-800',
      textColor: airFlowValue < 0.5 ? 'text-rose-400' : 'text-teal-400',
      status: airFlowValue < 0.5 ? 'Bajo' : 'Óptimo',
      norm: 'DS 132: Mínimo 0.5 m/s'
    },
    {
      id: 'noise',
      name: 'Ruido Acústico',
      shortName: 'Ruido',
      unit: 'dB',
      value: Number(noiseValue.toFixed(0)),
      safeMax: 82,
      criticalMax: 90,
      scaleMax: 110,
      icon: <Volume2 className="w-4 h-4 text-rose-400" />,
      gradient: noiseValue > 85 ? 'from-rose-600 to-red-600' : 'from-rose-500 to-amber-500',
      glowColor: 'shadow-rose-500/30',
      badgeColor: noiseValue > 85 ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-slate-900 text-slate-300 border-slate-700',
      textColor: noiseValue > 85 ? 'text-rose-400' : 'text-slate-300',
      status: noiseValue > 85 ? 'Elevado' : 'Aceptable',
      norm: 'DS 132: LPP ≤ 82 dB(A)'
    },
    {
      id: 'o2',
      name: 'Oxígeno (O2)',
      shortName: 'Oxígeno',
      unit: '%',
      value: Number(o2Value.toFixed(1)),
      safeMax: 21.0,
      criticalMax: 19.5,
      scaleMax: 25.0,
      icon: <Activity className="w-4 h-4 text-emerald-400" />,
      gradient: o2Value < 19.5 ? 'from-rose-600 to-red-600' : 'from-emerald-400 to-teal-500',
      glowColor: 'shadow-emerald-500/30',
      badgeColor: o2Value < 19.5 ? 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse' : 'bg-emerald-950 text-emerald-300 border-emerald-800',
      textColor: o2Value < 19.5 ? 'text-rose-400' : 'text-emerald-400',
      status: o2Value < 19.5 ? 'Deficiente' : 'Normal',
      norm: 'DS 132: Mínimo 19.5% O2'
    }
  ];

  // Multi-sensor timeline readings for the shift
  const timelineReadings = [
    { 
      hour: '00:00', 
      temp: tempValue - 1.2, 
      hum: humValue - 3, 
      co: Math.max(2, coValue - 3.1), 
      co2: Math.max(450, co2Value - 60), 
      pm25: Math.max(5, pm25Value - 6.5),
      ch4: Math.max(0.1, ch4Value - 0.2),
      airFlow: airFlowValue + 0.15,
      noise: noiseValue - 5,
      o2: 20.9
    },
    { 
      hour: '04:00', 
      temp: tempValue - 0.8, 
      hum: humValue - 1, 
      co: Math.max(3, coValue - 2.0), 
      co2: Math.max(500, co2Value - 40), 
      pm25: Math.max(8, pm25Value - 4.0),
      ch4: Math.max(0.2, ch4Value - 0.1),
      airFlow: airFlowValue + 0.1,
      noise: noiseValue - 3,
      o2: 20.8
    },
    { 
      hour: '08:00', 
      temp: tempValue + 0.3, 
      hum: humValue + 2, 
      co: coValue + 1.2, 
      co2: co2Value + 50, 
      pm25: pm25Value + 3.0,
      ch4: ch4Value + 0.1,
      airFlow: airFlowValue,
      noise: noiseValue + 2,
      o2: 20.7
    },
    { 
      hour: '12:00', 
      temp: tempValue + 1.5, 
      hum: humValue + 4, 
      co: coValue + 3.8, 
      co2: co2Value + 120, 
      pm25: pm25Value + 7.5,
      ch4: ch4Value + 0.3,
      airFlow: airFlowValue - 0.05,
      noise: noiseValue + 4,
      o2: 20.6
    },
    { 
      hour: '16:00', 
      temp: tempValue + 0.8, 
      hum: humValue + 1, 
      co: coValue + 1.5, 
      co2: co2Value + 60, 
      pm25: pm25Value + 3.8,
      ch4: ch4Value + 0.1,
      airFlow: airFlowValue,
      noise: noiseValue + 1,
      o2: 20.8
    },
    { 
      hour: '20:00 (Actual)', 
      temp: tempValue, 
      hum: humValue, 
      co: coValue, 
      co2: co2Value, 
      pm25: pm25Value,
      ch4: ch4Value,
      airFlow: airFlowValue,
      noise: noiseValue,
      o2: o2Value
    },
  ];

  return (
    <div className="space-y-6">
      
      {/* ==============================================================
          1. WELCOME MESSAGE & USER ROLE BANNER (Inspirado en el diseño)
         ============================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 p-5 sm:p-6 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Welcome User info */}
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-bold text-lg sm:text-xl shadow-lg shrink-0 ${userRoleInfo.avatarBg}`}>
              {currentUser?.name?.charAt(0) || 'M'}
            </div>
            
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
                  Bienvenido, {currentUser?.name || 'Manuel Crisóstomo'} 👋
                </h2>
                
                {/* User Role highlighted badge */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${userRoleInfo.bg}`}>
                  {userRoleInfo.icon}
                  <span>{userRoleInfo.typeText}</span>
                </span>
              </div>
              
              <p className="mt-1 text-xs sm:text-sm text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{userRoleInfo.label}</span>
                <span>•</span>
                <span className="text-slate-300 font-medium">{currentUser?.shift || 'Turno Continuo 7x7'}</span>
                <span>•</span>
                <span className="text-cyan-400 font-mono">Faena El Teniente</span>
              </p>
            </div>
          </div>

          {/* Quick Actions: Mobile App Download & Role change button */}
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            <button
              onClick={() => setShowMobileModal(true)}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-950 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
              title="Descargar Aplicación Móvil Android (APK) y PWA"
            >
              <Smartphone className="w-3.5 h-3.5 text-cyan-200" />
              <span>App Móvil (APK)</span>
              <span className="text-[10px] bg-slate-950/70 text-cyan-300 px-1.5 py-0.2 rounded font-mono border border-cyan-400/40">
                v2.4
              </span>
            </button>

            {onChangeUserModal && (
              <button
                onClick={onChangeUserModal}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 transition-all flex items-center gap-2 shadow-sm"
              >
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Cambiar de Usuario</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Quick Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-5 border-t border-slate-800/80">
          
          {/* Card 1: Total Users */}
          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Total Usuarios</span>
              <div className="w-7 h-7 rounded-lg bg-blue-950/60 border border-blue-800/60 flex items-center justify-center text-blue-400">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-white tabular-nums">
              {totalUsersCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 truncate">
              <span className="text-purple-400 font-semibold">{superadminCount} Super</span> • 
              <span className="text-cyan-400 font-semibold">{adminCount} Adm</span> • 
              <span className="text-amber-400 font-semibold">{operadorCount} Op</span>
            </div>
          </div>

          {/* Card 2: Sensores IoT Online */}
          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Sensores IoT Online</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                <Cpu className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-400 tabular-nums">
              {onlineDevicesCount} <span className="text-xs font-normal text-slate-400">/ {devices.length}</span>
            </div>
            <div className="text-[11px] text-emerald-300 mt-0.5 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Transmisión en vivo RTDB</span>
            </div>
          </div>

          {/* Card 3: Dispositivo Seleccionado */}
          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Dispositivo Activo</span>
              <div className="w-7 h-7 rounded-lg bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                <Radio className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 text-sm sm:text-base font-bold text-white truncate" title={currentDevice?.name}>
              {currentDevice?.name || 'ESP32 Gateway'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">
              {currentDevice?.code || currentDevice?.id} · Batería: {batteryPct}%
            </div>
          </div>

          {/* Card 4: Alertas Activas */}
          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Alertas de Faena</span>
              <div className={`w-7 h-7 rounded-lg ${activeAlertCount > 0 ? 'bg-amber-950/80 border border-amber-800 text-amber-400' : 'bg-slate-900 border border-slate-800 text-slate-400'} flex items-center justify-center`}>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className={`mt-2 text-2xl font-black tabular-nums ${activeAlertCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {activeAlertCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {activeAlertCount === 0 ? 'Límites seguros bajo DS 132' : 'Verificar ventilación en galería'}
            </div>
          </div>

        </div>
      </div>

      {/* ==============================================================
          2. TWO-COLUMN INTERACTIVE SECTION:
             - LEFT: SENSOR LEVELS BAR CHART WITH ALL SENSORS & DEVICE SELECTOR
             - RIGHT: SCROLLABLE SYSTEM USERS LIST
         ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ============================================================
            COL 1: SENSOR LEVELS BAR CHART (7 / 12 cols)
           ============================================================ */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
          
          <div>
            {/* Header with Title and Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/80">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    Gráfico de Barras: Sensores IoT
                    <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                      {currentDevice?.code || currentDevice?.id}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Mediciones de todos los sensores (Temperatura, Humedad, CO, CO2, PM2.5, Metano, Flujo, Ruido, O2)
                  </p>
                </div>
              </div>

              {/* 3 View mode toggles */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-center shrink-0">
                <button
                  onClick={() => setChartViewMode('all_bars')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    chartViewMode === 'all_bars' 
                      ? 'bg-cyan-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Gráfico de barras vertical con todos los sensores medidos"
                >
                  Barras de Sensores
                </button>
                <button
                  onClick={() => setChartViewMode('levels')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    chartViewMode === 'levels' 
                      ? 'bg-cyan-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Indicadores horizontales con límites normativos DS 132"
                >
                  Niveles DS 132
                </button>
                <button
                  onClick={() => setChartViewMode('timeline')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    chartViewMode === 'timeline' 
                      ? 'bg-cyan-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Evolución temporal por turnos"
                >
                  Tendencia Temporal
                </button>
              </div>
            </div>

            {/* DEVICE SELECTOR: Direct buttons + dropdown for all devices */}
            <div className="mt-4 pt-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  Cambiar Dispositivo Sensor:
                </span>
                <span className="text-[11px] text-slate-400">
                  Ubicación: <strong className="text-slate-200">{currentDevice?.sectorName}</strong>
                </span>
              </div>

              {/* Quick Select Buttons for main Gateways / Detectors */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {devices.slice(0, 4).map((dev) => {
                  const isSelected = dev.id === currentDevice?.id;
                  const isDevOnline = dev.status !== 'desconectado';
                  return (
                    <button
                      key={dev.id}
                      onClick={() => onSelectDevice(dev.id)}
                      className={`flex flex-col text-left p-2.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-cyan-950/80 border-cyan-500 text-white shadow-md shadow-cyan-950/50 ring-1 ring-cyan-400/50'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold truncate">{dev.code || dev.id.slice(-6)}</span>
                        <span className={`w-2 h-2 rounded-full ${isDevOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      </div>
                      <span className="text-[10px] text-slate-400 truncate mt-0.5">{dev.name.split(' ')[0]} {dev.name.split(' ')[1] || ''}</span>
                    </button>
                  );
                })}
              </div>

              {/* Comprehensive Dropdown for ALL devices */}
              {devices.length > 4 && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-slate-400 shrink-0">O seleccionar otro equipo:</span>
                  <select
                    value={currentDevice?.id}
                    onChange={(e) => onSelectDevice(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {devices.map((dev) => (
                      <option key={dev.id} value={dev.id}>
                        {dev.code} - {dev.name} ({dev.sectorName})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* ========================================================
                CHART MODE 1: VERTICAL SENSOR BARS CHART (TODOS LOS SENSORES)
                (Temperatura, Humedad, CO, CO2, PM2.5, Metano, Flujo, Ruido, O2)
               ======================================================== */}
            {chartViewMode === 'all_bars' && (
              <div className="mt-3 bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 sm:p-5">
                
                <div className="flex items-center justify-between text-xs text-slate-400 mb-4 pb-2 border-b border-slate-800">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Comparativa de Sensores en Vivo ({allSensorBars.length} Variables)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Nodo: <strong className="text-cyan-300">{currentDevice?.code || currentDevice?.id}</strong>
                  </span>
                </div>

                {/* THE 9 VERTICAL SENSOR BARS */}
                <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 sm:gap-2.5 items-end pt-6 pb-2 min-h-[260px]">
                  {allSensorBars.map((sensor) => {
                    // Normalize bar height percentage for clear visual comparison
                    const pct = Math.min(100, Math.max(14, (sensor.value / sensor.scaleMax) * 100));
                    const isHovered = hoveredSensorId === sensor.id;
                    const isAlert = sensor.value > sensor.safeMax;

                    return (
                      <div 
                        key={sensor.id} 
                        className="flex flex-col items-center justify-end h-full group relative cursor-pointer"
                        onMouseEnter={() => setHoveredSensorId(sensor.id)}
                        onMouseLeave={() => setHoveredSensorId(null)}
                      >
                        {/* Hover Tooltip */}
                        {isHovered && (
                          <div className="absolute -top-12 z-20 bg-slate-900 border border-cyan-500/80 text-white text-[10px] py-1 px-2.5 rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
                            <p className="font-bold text-cyan-300">{sensor.name}</p>
                            <p className="text-slate-300">{sensor.value} {sensor.unit} · {sensor.norm}</p>
                          </div>
                        )}

                        {/* Numerical Value Badge on Top of Bar */}
                        <div className="mb-2 text-center">
                          <span className={`text-[11px] sm:text-xs font-mono font-black tabular-nums transition-transform duration-200 block ${sensor.textColor} ${isHovered ? 'scale-110 font-extrabold' : ''}`}>
                            {sensor.value}
                          </span>
                          <span className="text-[9px] text-slate-400 block -mt-0.5 font-mono">
                            {sensor.unit}
                          </span>
                        </div>

                        {/* Bar Pillar Track */}
                        <div className="w-full max-w-[38px] bg-slate-900/90 rounded-t-xl h-36 flex items-end p-1 border border-slate-800 group-hover:border-slate-700 transition-colors relative overflow-hidden">
                          {/* Safe limit line indicator */}
                          <div 
                            className="absolute left-0 right-0 h-0.5 bg-slate-700/60 z-10 pointer-events-none"
                            style={{ bottom: `${Math.min(95, (sensor.safeMax / sensor.scaleMax) * 100)}%` }}
                            title={`Límite seguro: ${sensor.safeMax} ${sensor.unit}`}
                          />

                          {/* Colored Vertical Bar */}
                          <div 
                            className={`w-full rounded-t-lg bg-gradient-to-t ${sensor.gradient} shadow-lg ${sensor.glowColor} transition-all duration-500 group-hover:brightness-125`}
                            style={{ height: `${pct}%` }}
                          />
                        </div>

                        {/* Sensor Bottom Label & Status Badge */}
                        <div className="mt-2 text-center w-full flex flex-col items-center">
                          <div className="flex items-center justify-center mb-0.5">
                            {sensor.icon}
                          </div>
                          <span className="text-[10px] sm:text-[11px] font-bold text-slate-300 truncate max-w-full">
                            {sensor.shortName}
                          </span>
                          
                          {/* Mini Status Pill */}
                          <span className={`mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${sensor.badgeColor}`}>
                            {sensor.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subtitle Guide */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Seguro</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Atención</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> Crítico</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">
                    Línea tenue = Límite normativo seguro DS 132
                  </span>
                </div>

              </div>
            )}

            {/* ========================================================
                CHART MODE 2: HORIZONTAL LEVELS & DS 132 LIMIT GAUGES
               ======================================================== */}
            {chartViewMode === 'levels' && (
              <div className="space-y-3 mt-3">
                {allSensorBars.map((metric) => {
                  const pct = Math.min(100, Math.max(5, (metric.value / metric.scaleMax) * 100));
                  const isAboveSafe = metric.value > metric.safeMax;

                  return (
                    <div 
                      key={metric.id}
                      className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          {metric.icon}
                          <span className="font-semibold text-slate-200">{metric.name}</span>
                          <span className="text-[10px] text-slate-400 hidden sm:inline">({metric.norm})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${metric.badgeColor}`}>
                            {metric.status}
                          </span>
                          <span className={`font-mono font-bold text-sm ${metric.textColor}`}>
                            {metric.value} <span className="text-xs text-slate-400 font-normal">{metric.unit}</span>
                          </span>
                        </div>
                      </div>

                      {/* Visual gauge bar */}
                      <div className="relative w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div 
                          className="absolute top-0 bottom-0 w-0.5 bg-slate-600 z-10"
                          style={{ left: `${(metric.safeMax / metric.scaleMax) * 100}%` }}
                          title={`Límite seguro: ${metric.safeMax} ${metric.unit}`}
                        />
                        <div 
                          className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${metric.gradient}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ========================================================
                CHART MODE 3: TIMELINE EVOLUTION WITH ALL SENSOR GROUPS
               ======================================================== */}
            {chartViewMode === 'timeline' && (
              <div className="mt-4 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5">
                
                {/* Metric group switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
                  <span className="font-semibold text-xs sm:text-sm text-slate-200">
                    Evolución Temporal en el Turno
                  </span>

                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                    <button
                      onClick={() => setTimelineGroup('gases')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        timelineGroup === 'gases' ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      CO & PM2.5
                    </button>
                    <button
                      onClick={() => setTimelineGroup('clima')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        timelineGroup === 'clima' ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      Temp & Humedad
                    </button>
                    <button
                      onClick={() => setTimelineGroup('seguridad')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        timelineGroup === 'seguridad' ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      CO2, Metano & Ruido
                    </button>
                    <button
                      onClick={() => setTimelineGroup('todos')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        timelineGroup === 'todos' ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      Todos
                    </button>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mb-4 px-1">
                  {(timelineGroup === 'gases' || timelineGroup === 'todos') && (
                    <>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Monóxido CO (ppm)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Polvo PM2.5 (µg/m³)</span>
                    </>
                  )}
                  {(timelineGroup === 'clima' || timelineGroup === 'todos') && (
                    <>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Temp (°C)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400" /> Humedad (%)</span>
                    </>
                  )}
                  {(timelineGroup === 'seguridad' || timelineGroup === 'todos') && (
                    <>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> CO2 (ppm/10)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Metano CH4 (%)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Ruido (dB)</span>
                    </>
                  )}
                </div>

                {/* Multi-Bar Timeline Chart */}
                <div className="h-44 w-full flex items-end justify-between gap-2 pt-2 px-1">
                  {timelineReadings.map((reading, index) => {
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                        <div className="w-full flex items-end justify-center gap-1 h-32 px-0.5">
                          {/* CO Bar */}
                          {(timelineGroup === 'gases' || timelineGroup === 'todos') && (
                            <div 
                              className="flex-1 max-w-[14px] bg-gradient-to-t from-orange-600 to-orange-400 rounded-t-sm transition-all duration-300 group-hover:brightness-125"
                              style={{ height: `${Math.min(100, Math.max(12, (reading.co / 50) * 100))}%` }}
                              title={`CO: ${reading.co.toFixed(1)} ppm`}
                            />
                          )}

                          {/* PM2.5 Bar */}
                          {(timelineGroup === 'gases' || timelineGroup === 'todos') && (
                            <div 
                              className="flex-1 max-w-[14px] bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-sm transition-all duration-300 group-hover:brightness-125"
                              style={{ height: `${Math.min(100, Math.max(12, (reading.pm25 / 100) * 100))}%` }}
                              title={`PM2.5: ${reading.pm25.toFixed(1)} µg/m³`}
                            />
                          )}

                          {/* Temp Bar */}
                          {(timelineGroup === 'clima' || timelineGroup === 'todos') && (
                            <div 
                              className="flex-1 max-w-[14px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm transition-all duration-300 group-hover:brightness-125"
                              style={{ height: `${Math.min(100, Math.max(12, (reading.temp / 35) * 100))}%` }}
                              title={`Temp: ${reading.temp.toFixed(1)} °C`}
                            />
                          )}

                          {/* Humedad Bar */}
                          {(timelineGroup === 'clima' || timelineGroup === 'todos') && (
                            <div 
                              className="flex-1 max-w-[14px] bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-sm transition-all duration-300 group-hover:brightness-125"
                              style={{ height: `${Math.min(100, Math.max(12, (reading.hum / 100) * 100))}%` }}
                              title={`Humedad: ${reading.hum.toFixed(0)} %`}
                            />
                          )}

                          {/* CO2 Bar */}
                          {(timelineGroup === 'seguridad' || timelineGroup === 'todos') && (
                            <div 
                              className="flex-1 max-w-[14px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all duration-300 group-hover:brightness-125"
                              style={{ height: `${Math.min(100, Math.max(12, (reading.co2 / 1500) * 100))}%` }}
                              title={`CO2: ${reading.co2} ppm`}
                            />
                          )}

                          {/* Metano CH4 Bar */}
                          {(timelineGroup === 'seguridad' || timelineGroup === 'todos') && (
                            <div 
                              className="flex-1 max-w-[14px] bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-sm transition-all duration-300 group-hover:brightness-125"
                              style={{ height: `${Math.min(100, Math.max(12, (reading.ch4 / 2) * 100))}%` }}
                              title={`CH4: ${reading.ch4.toFixed(1)} %`}
                            />
                          )}

                          {/* Ruido Bar */}
                          {(timelineGroup === 'seguridad') && (
                            <div 
                              className="flex-1 max-w-[14px] bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-sm transition-all duration-300 group-hover:brightness-125"
                              style={{ height: `${Math.min(100, Math.max(12, (reading.noise / 100) * 100))}%` }}
                              title={`Ruido: ${reading.noise} dB`}
                            />
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 text-center">{reading.hour}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer of device card */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Battery className="w-3.5 h-3.5 text-emerald-400" />
              <span>Batería: <strong className="text-slate-200">{batteryPct}%</strong></span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Transmisión activa · {currentDevice?.signalStrength || 'Óptima'}</span>
            </div>
          </div>
        </div>

        {/* ============================================================
            COL 2: SCROLLABLE SYSTEM USERS LIST BOX (5 / 12 cols)
           ============================================================ */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col">
          
          {/* Header of Users Box */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-950 text-purple-400 border border-purple-800/80">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Usuarios del Sistema
                  <span className="text-xs font-semibold bg-purple-950/80 text-purple-300 px-2 py-0.5 rounded-full border border-purple-800/60">
                    {filteredUsers.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Personal autorizado y roles en faena</p>
              </div>
            </div>
          </div>

          {/* Search Input & Role Filter Tabs */}
          <div className="my-3 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, RUT o cargo..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            {/* Quick role pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              {(['todos', 'superadmin', 'admin', 'operador'] as const).map((role) => {
                const isActive = selectedRoleFilter === role;
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRoleFilter(role)}
                    className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {role === 'todos' ? 'Todos' : role === 'superadmin' ? 'Superadmin' : role === 'admin' ? 'Admin' : 'Operadores'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SCROLLABLE USERS LIST CONTAINER (With prominent vertical scrollbar) */}
          <div className="flex-1 overflow-y-auto max-h-[380px] pr-1.5 space-y-2.5 custom-scrollbar">
            {filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800/60">
                No se encontraron usuarios con ese criterio.
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isCurrent = currentUser?.id === user.id || currentUser?.email.toLowerCase() === user.email.toLowerCase();
                const roleMeta = getRoleDetails(user.role);

                return (
                  <div
                    key={user.id}
                    onClick={() => onSelectUser?.(user)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-slate-950/90 border-cyan-500/70 shadow-md shadow-cyan-950/30 ring-1 ring-cyan-500/30'
                        : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      {/* Avatar and Main Info */}
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${roleMeta.avatarBg}`}>
                          {user.name.charAt(0)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                              {user.name}
                            </h4>
                            {isCurrent && (
                              <span className="text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-700 px-1.5 py-0.2 rounded font-semibold">
                                TÚ
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {user.email}
                          </p>

                          {user.rut && (
                            <p className="text-[10px] font-mono text-slate-500">
                              RUT: {user.rut}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Role Badge on the right */}
                      <div className="shrink-0 text-right">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleMeta.badgeBg}`}>
                          {roleMeta.icon}
                          <span>{roleMeta.typeText}</span>
                        </span>
                        
                        <div className="flex items-center justify-end gap-1 mt-1.5 text-[10px] text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>{user.status === 'activo' ? 'En Línea' : 'Inactivo'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Secondary details: Shift or Sector */}
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="truncate">
                        {user.shift || user.assignedSector || 'Turno General de Operaciones'}
                      </span>
                      <span className="text-cyan-400/80 font-medium shrink-0 flex items-center gap-0.5">
                        <span>Ver perfil</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note indicating scrollability */}
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Usa la barra para desplazar el listado</span>
            <span className="text-cyan-400 font-medium">Desplazamiento vertical activo</span>
          </div>

          {/* ==============================================================
              DESCARGABLE DE LA APLICACIÓN MÓVIL (APK & PWA)
             ============================================================== */}
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 border border-cyan-800/60 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-start justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-white shadow-md shadow-cyan-950 shrink-0">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-black text-white tracking-tight">
                      App Móvil MineSafe IoT
                    </h4>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                      v2.4 APK
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Instalador oficial para teléfonos Android y celulares de faena minera.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick feature pills */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-300 relative z-10">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300 flex items-center gap-1 font-mono">
                <Radio className="w-3 h-3 text-cyan-400" /> RTDB En Vivo
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> DS 132 Alertas
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> Sirena Acústica
              </span>
            </div>

            {/* SECCIÓN DEL CÓDIGO QR DIRECTO PARA CELULARES */}
            <div className="mt-3.5 p-3.5 rounded-xl bg-slate-950/90 border border-cyan-800/70 shadow-lg relative z-10">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                  Sección Código QR (Descarga en Celular)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-semibold">
                  100% Escaneable
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3.5">
                {/* Visual Scannable QR Frame */}
                <div className="p-2 bg-white rounded-xl shadow-md shrink-0 flex flex-col items-center justify-center border-2 border-cyan-500/50">
                  {cardQrUrl ? (
                    <img
                      src={cardQrUrl}
                      alt="Código QR MineSafe IoT"
                      className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded block"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center bg-slate-100 rounded text-slate-500 text-[10px]">
                      Generando QR...
                    </div>
                  )}
                  <span className="text-[8px] font-bold text-slate-900 tracking-wider font-mono mt-0.5">
                    ESCANEAR CON CELULAR
                  </span>
                </div>

                {/* QR Info and Actions */}
                <div className="space-y-1.5 flex-1 text-xs w-full">
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Apunta con la cámara de tu smartphone hacia el código QR para descargar el instalador APK directamente sin necesidad de cables.
                  </p>

                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400 font-medium">Origen:</span>
                    <button
                      type="button"
                      onClick={() => setCardQrMode('gdrive')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        cardQrMode === 'gdrive'
                          ? 'bg-purple-900/80 text-purple-200 border border-purple-500'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      Google Drive Oficial
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardQrMode('direct')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        cardQrMode === 'direct'
                          ? 'bg-cyan-900/80 text-cyan-200 border border-cyan-500'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      Servidor Directo
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyCardQrUrl}
                      className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10.5px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title="Copiar enlace codificado en el código QR"
                    >
                      {cardQrCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{cardQrCopied ? 'Copiado' : 'Copiar URL'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenMobileModal('qr')}
                      className="px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-[10.5px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title="Abrir el código QR ampliado en pantalla completa o descargar la imagen"
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>Ampliar QR</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {directDownloadSuccess && (
              <div className="mt-2.5 p-2 bg-emerald-950/90 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-1.5 animate-in fade-in relative z-10">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Descarga del APK iniciada correctamente. Revisa tus descargas.</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-3.5 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 relative z-10">
              <button
                onClick={handleDirectApkDownload}
                className="py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-950 flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                title="Descargar paquete instalador APK directo para Android"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar APK</span>
              </button>

              <button
                onClick={() => handleOpenMobileModal('qr')}
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Escanear código QR con el celular o instalar PWA"
              >
                <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Ver QR / PWA</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Modal de descarga de la aplicación móvil */}
      <MobileAppDownloadModal
        isOpen={showMobileModal}
        onClose={() => setShowMobileModal(false)}
        initialTab={mobileModalTab}
      />

    </div>
  );
};

