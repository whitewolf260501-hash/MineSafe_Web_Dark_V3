import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Smartphone, 
  Download, 
  QrCode, 
  CheckCircle2, 
  ShieldCheck, 
  Wifi, 
  Radio, 
  Zap, 
  X, 
  ArrowRight, 
  Copy, 
  Check, 
  Share2, 
  HelpCircle,
  ExternalLink,
  Flame,
  Layers,
  Sparkles,
  Globe,
  HardDriveDownload
} from 'lucide-react';

interface MobileAppDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'apk' | 'pwa' | 'qr';
}

const GDRIVE_APK_URL = 'https://drive.google.com/file/d/1trG9ISNGFsg77aRpfW_pcqHXWzx_JQlh/view?usp=drive_link';
const LOCAL_APK_URL = '/MineSafe_IoT_Mobile_v2.4.apk';

export const MobileAppDownloadModal: React.FC<MobileAppDownloadModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'apk',
}) => {
  const [activeTab, setActiveTab] = useState<'apk' | 'pwa' | 'qr'>(initialTab);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Synchronize activeTab when initialTab or isOpen changes
  useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // QR Code States
  const [qrTarget, setQrTarget] = useState<'apk' | 'pwa'>('apk');
  const [qrApkMode, setQrApkMode] = useState<'gdrive' | 'direct'>('gdrive');
  const [apkQrDataUrl, setApkQrDataUrl] = useState<string>('');
  const [pwaQrDataUrl, setPwaQrDataUrl] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopiedQr, setIsCopiedQr] = useState<boolean>(false);

  // Capture PWA install prompt if available in browser
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Generate real, high-resolution scannable QR Codes for APK and PWA
  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://whitewolf260501-hash.github.io/MineSafe_Web_Dark_V2';
    const apkTarget = qrApkMode === 'gdrive' ? GDRIVE_APK_URL : `${origin}${LOCAL_APK_URL}`;
    const pwaTarget = origin;

    // Generate APK QR
    QRCode.toDataURL(apkTarget, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#030712',
        light: '#ffffff',
      },
    })
      .then((url) => {
        setApkQrDataUrl(url);
        if (qrTarget === 'apk') {
          setQrDataUrl(url);
        }
      })
      .catch((err) => {
        console.error('Error generating APK QR code:', err);
      });

    // Generate PWA QR
    QRCode.toDataURL(pwaTarget, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#030712',
        light: '#ffffff',
      },
    })
      .then((url) => {
        setPwaQrDataUrl(url);
        if (qrTarget === 'pwa') {
          setQrDataUrl(url);
        }
      })
      .catch((err) => {
        console.error('Error generating PWA QR code:', err);
      });
  }, [qrApkMode, qrTarget]);

  if (!isOpen) return null;

  const appUrl = typeof window !== 'undefined' ? (window.location.origin || 'https://whitewolf260501-hash.github.io/MineSafe_Web_Dark_V2/') : 'https://whitewolf260501-hash.github.io/MineSafe_Web_Dark_V2/';

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(appUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Trigger PWA installation directly
  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setActiveTab('pwa');
    }
  };

  // Direct APK download from local server bundle with safety fallbacks
  const handleDownloadApk = () => {
    setIsDownloading(true);
    setDownloadSuccess(false);

    try {
      const downloadLink = document.createElement('a');
      downloadLink.href = LOCAL_APK_URL;
      downloadLink.setAttribute('download', 'MineSafe_IoT_Mobile_v2.4.apk');
      downloadLink.setAttribute('target', '_blank');
      downloadLink.rel = 'noopener noreferrer';
      document.body.appendChild(downloadLink);
      downloadLink.click();

      setTimeout(() => {
        if (document.body.contains(downloadLink)) {
          document.body.removeChild(downloadLink);
        }
      }, 300);

      setTimeout(() => {
        setIsDownloading(false);
        setDownloadSuccess(true);
      }, 700);
    } catch {
      setIsDownloading(false);
      window.open(GDRIVE_APK_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const getCurrentQrUrl = (): string => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://whitewolf260501-hash.github.io/MineSafe_Web_Dark_V2';
    if (qrTarget === 'apk') {
      return qrApkMode === 'gdrive' ? GDRIVE_APK_URL : `${origin}${LOCAL_APK_URL}`;
    }
    return origin;
  };

  const handleCopyQrUrl = () => {
    navigator.clipboard.writeText(getCurrentQrUrl());
    setIsCopiedQr(true);
    setTimeout(() => setIsCopiedQr(false), 2500);
  };

  const handleDownloadQrImage = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `MineSafe_QR_${qrTarget === 'apk' ? 'Descarga_APK' : 'WebApp'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md p-3 sm:p-6 flex items-center justify-center animate-in fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6">
        
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-800 flex items-start justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/20 shrink-0">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  MineSafe Móvil para Teléfonos
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-mono">
                  v2.4.0 APK
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Control de gases, sirenas de alerta y monitoreo de faenas en tu bolsillo.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="px-5 sm:px-6 pt-3 relative z-10">
          <div className="grid grid-cols-3 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('apk')}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'apk'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar APK</span>
            </button>
            <button
              onClick={() => setActiveTab('pwa')}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'pwa'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Instalar PWA</span>
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'qr'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Código QR</span>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 space-y-4 relative z-10">

          {/* TAB 1: DESCARGAR APK ANDROID */}
          {activeTab === 'apk' && (
            <div className="space-y-4">
              
              {/* App Summary Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">MineSafe_IoT_Mobile_v2.4.apk</span>
                    <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800 font-mono font-semibold">
                      26.6 MB
                    </span>
                    <span className="text-[10px] text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800 font-mono">
                      Oficial
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Paquete oficial de instalación para Android 8.0 o superior (Smartphones y Rugged Phones industriales).
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> Compatible con celulares mineros
                    </span>
                    <span className="flex items-center gap-1 text-cyan-400">
                      <Radio className="w-3 h-3" /> RTDB minefase-fc5f5
                    </span>
                    <span className="flex items-center gap-1 text-purple-400">
                      <ShieldCheck className="w-3 h-3" /> Verificado por Google Drive
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <button
                    onClick={handleDownloadApk}
                    disabled={isDownloading}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-950 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-75 cursor-pointer"
                  >
                    <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                    <span>{isDownloading ? 'Iniciando descarga...' : 'Descargar APK Directo'}</span>
                  </button>

                  <a
                    href={GDRIVE_APK_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2.5 rounded-xl bg-purple-950/70 hover:bg-purple-900/80 text-purple-200 border border-purple-700/60 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm shadow-purple-950"
                    title="Descargar paquete oficial desde Google Drive"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                    <span>Descargar desde Google Drive</span>
                  </a>
                </div>
              </div>

              {/* Seguridad y Certificación del Paquete */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-start gap-2.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-200 text-xs">Descarga Segura y Verificada</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    El archivo <code className="text-cyan-300 font-mono text-[10px]">MineSafe_IoT_Mobile_v2.4.apk</code> es el binario oficial compilado para celulares Android. No expone código fuente, no altera las credenciales de la plataforma ni compromete la seguridad del sitio web.
                  </p>
                </div>
              </div>

              {downloadSuccess && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>¡Descarga iniciada con éxito! Revisa la barra de descargas o carpeta de descargas de tu dispositivo.</span>
                </div>
              )}

              {/* SECCIÓN DEL CÓDIGO QR PARA CELULAR (INTEGRADA EN TAB APK) */}
              <div className="bg-slate-950/80 border border-cyan-800/50 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 relative overflow-hidden shadow-md">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />

                <div className="p-2.5 bg-white rounded-xl shadow-xl shrink-0 flex flex-col items-center justify-center border-2 border-cyan-500/40 relative z-10">
                  {apkQrDataUrl || qrDataUrl ? (
                    <img
                      src={apkQrDataUrl || qrDataUrl}
                      alt="Código QR Descarga APK MineSafe"
                      className="w-32 h-32 object-contain rounded block"
                    />
                  ) : (
                    <div className="w-32 h-32 flex items-center justify-center bg-slate-100 rounded text-slate-500 text-[10px]">
                      Generando QR...
                    </div>
                  )}
                  <span className="text-[9px] font-bold text-slate-900 tracking-wider font-mono mt-1">
                    ESCANEAR CON CELULAR
                  </span>
                </div>

                <div className="space-y-2 flex-1 text-xs w-full relative z-10">
                  <div>
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-cyan-400 shrink-0" />
                      <h4 className="font-bold text-white text-xs sm:text-sm">
                        ¿Quieres el APK directo en tu teléfono?
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700 font-mono">
                        100% Escaneable
                      </span>
                    </div>
                    <p className="text-slate-400 mt-1 text-[11px] leading-relaxed">
                      Apunta la cámara de tu teléfono Android hacia este código QR. Tu teléfono detectará el enlace oficial y comenzará la descarga de MineSafe inmediatamente sin pasar cables desde el computador.
                    </p>
                  </div>

                  {/* Selector de fuente del QR */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[10px] text-slate-400 font-semibold">Destino del QR:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setQrTarget('apk');
                        setQrApkMode('gdrive');
                      }}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        qrApkMode === 'gdrive'
                          ? 'bg-purple-900/80 text-purple-200 border border-purple-500'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      Google Drive Oficial (Recomendado)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQrTarget('apk');
                        setQrApkMode('direct');
                      }}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        qrApkMode === 'direct'
                          ? 'bg-cyan-900/80 text-cyan-200 border border-cyan-500'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      Descarga Directa Servidor
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={handleCopyQrUrl}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-[10.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isCopiedQr ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{isCopiedQr ? 'Enlace Copiado' : 'Copiar Enlace'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('qr')}
                      className="px-2.5 py-1 bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/80 rounded-lg text-[10.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>Ver Panel QR Ampliado</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 3 Step Installation Guide */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                  Pasos para Instalar el APK en Android:
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-cyan-900/60 text-cyan-300 border border-cyan-700/60 flex items-center justify-center font-bold text-[11px]">
                      1
                    </span>
                    <p className="font-semibold text-white">Descargar</p>
                    <p className="text-slate-400 text-[11px]">
                      Haz clic en "Descargar APK" y espera que finalice la descarga del archivo en tu teléfono.
                    </p>
                  </div>

                  <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-cyan-900/60 text-cyan-300 border border-cyan-700/60 flex items-center justify-center font-bold text-[11px]">
                      2
                    </span>
                    <p className="font-semibold text-white">Permitir Origen</p>
                    <p className="text-slate-400 text-[11px]">
                      Si Android pregunta, activa "Permitir instalar aplicaciones de este origen".
                    </p>
                  </div>

                  <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-cyan-900/60 text-cyan-300 border border-cyan-700/60 flex items-center justify-center font-bold text-[11px]">
                      3
                    </span>
                    <p className="font-semibold text-white">Abrir e Ingresar</p>
                    <p className="text-slate-400 text-[11px]">
                      Abre MineSafe IoT, ingresa tus credenciales y activa las alertas sonoras y vibración.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: INSTALAR PWA (APLICACIÓN WEB PROGRESIVA) */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    Instalación Inmediata sin Archivos APK
                  </span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    Cero Espacio
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Puedes instalar MineSafe directamente en la pantalla de inicio de tu celular mediante tecnología PWA (Progressive Web App). Funciona de forma idéntica a una aplicación nativa, con icono propio, pantalla completa y soporte sin conexión.
                </p>

                {deferredPrompt && (
                  <button
                    onClick={handleInstallPWA}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Instalar en Este Dispositivo Ahora</span>
                  </button>
                )}
              </div>

              {/* SECCIÓN DEL CÓDIGO QR PARA INSTALAR PWA DESDE CELULAR */}
              <div className="bg-slate-950/80 border border-emerald-800/60 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 relative overflow-hidden shadow-md">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />

                <div className="p-2.5 bg-white rounded-xl shadow-xl shrink-0 flex flex-col items-center justify-center border-2 border-emerald-500/40 relative z-10">
                  {pwaQrDataUrl ? (
                    <img
                      src={pwaQrDataUrl}
                      alt="Código QR PWA MineSafe"
                      className="w-32 h-32 object-contain rounded block"
                    />
                  ) : (
                    <div className="w-32 h-32 flex items-center justify-center bg-slate-100 rounded text-slate-500 text-[10px]">
                      Generando QR...
                    </div>
                  )}
                  <span className="text-[9px] font-bold text-slate-900 tracking-wider font-mono mt-1">
                    ESCANEAR PARA PWA
                  </span>
                </div>

                <div className="space-y-2 flex-1 text-xs w-full relative z-10">
                  <div>
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-emerald-400 shrink-0" />
                      <h4 className="font-bold text-white text-xs sm:text-sm">
                        Escanear para abrir en tu celular
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono">
                        iOS & Android
                      </span>
                    </div>
                    <p className="text-slate-400 mt-1 text-[11px] leading-relaxed">
                      Apunta con la cámara de tu smartphone hacia el código QR. Se abrirá MineSafe en tu navegador móvil (Chrome o Safari) listo para añadir a la pantalla de inicio con un solo toque.
                    </p>
                  </div>

                  {/* URL Display and Copy */}
                  <div className="space-y-1 pt-1 border-t border-slate-800/80">
                    <span className="text-[10.5px] text-slate-400">Enlace de la aplicación web:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={appUrl}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-[10.5px] text-slate-300 font-mono truncate"
                      />
                      <button
                        type="button"
                        onClick={handleCopyUrl}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-[10.5px] font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{isCopied ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={appUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-[10.5px] font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 text-cyan-400" />
                      <span>Abrir en nueva pestaña</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setQrTarget('pwa');
                        setActiveTab('qr');
                      }}
                      className="px-2.5 py-1 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/80 rounded-lg text-[10.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>Ver Panel QR Ampliado</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step-by-step guides for Android & iPhone */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Instrucciones según tu teléfono:
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Android Instructions */}
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1.5">
                    <p className="font-bold text-cyan-400 flex items-center gap-1.5">
                      <span>📱 En Android (Chrome / Edge):</span>
                    </p>
                    <ol className="list-decimal list-inside text-slate-300 space-y-1 text-[11px] leading-relaxed">
                      <li>Toca los tres puntos <strong>(⋮)</strong> arriba a la derecha.</li>
                      <li>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</li>
                      <li>Confirma y el icono de MineSafe aparecerá en tu teléfono.</li>
                    </ol>
                  </div>

                  {/* iPhone Instructions */}
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1.5">
                    <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <span>🍏 En iPhone (Safari):</span>
                    </p>
                    <ol className="list-decimal list-inside text-slate-300 space-y-1 text-[11px] leading-relaxed">
                      <li>Toca el botón <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba).</li>
                      <li>Desliza hacia abajo y pulsa <strong>"Agregar al inicio" (+)</strong>.</li>
                      <li>Toca <strong>"Agregar"</strong> en la esquina superior derecha.</li>
                    </ol>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: CÓDIGO QR PARA CELULARES */}
          {activeTab === 'qr' && (
            <div className="space-y-4">

              {/* Selector de objetivo del código QR */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setQrTarget('apk')}
                  className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    qrTarget === 'apk'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Descargar APK (Android)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQrTarget('pwa')}
                  className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    qrTarget === 'pwa'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Abrir Web App (PWA)</span>
                </button>
              </div>

              {/* Subselector para fuente del APK */}
              {qrTarget === 'apk' && (
                <div className="flex items-center justify-between px-3 py-2 bg-slate-950/50 border border-slate-800/80 rounded-lg text-xs">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    Destino del QR:
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQrApkMode('gdrive')}
                      className={`px-2.5 py-1 rounded text-[10.5px] font-semibold transition-colors ${
                        qrApkMode === 'gdrive'
                          ? 'bg-purple-900/60 text-purple-300 border border-purple-700/80'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      Google Drive Oficial
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrApkMode('direct')}
                      className={`px-2.5 py-1 rounded text-[10.5px] font-semibold transition-colors ${
                        qrApkMode === 'direct'
                          ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-700/80'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      Descarga Directa Servidor
                    </button>
                  </div>
                </div>
              )}
              
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-5">
                
                {/* Real High-Resolution Scannable QR Code */}
                <div className="p-3 bg-white rounded-2xl shadow-2xl shrink-0 flex flex-col items-center justify-center border-4 border-slate-700/30">
                  {(qrTarget === 'apk' ? apkQrDataUrl : pwaQrDataUrl) || qrDataUrl ? (
                    <img
                      src={(qrTarget === 'apk' ? apkQrDataUrl : pwaQrDataUrl) || qrDataUrl}
                      alt="Código QR Real MineSafe IoT"
                      className="w-40 h-40 object-contain rounded-lg block"
                    />
                  ) : (
                    <div className="w-40 h-40 flex items-center justify-center bg-slate-100 rounded-lg text-slate-500 text-xs">
                      Generando QR...
                    </div>
                  )}
                  <span className="text-[10px] font-bold text-slate-800 tracking-wider font-mono mt-1">
                    {qrTarget === 'apk' ? 'ESCANEAR PARA APK' : 'ESCANEAR PARA PWA'}
                  </span>
                </div>

                {/* QR Guide & Action Controls */}
                <div className="space-y-3 flex-1 text-xs w-full">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm">
                        {qrTarget === 'apk' 
                          ? 'Escanea para descargar el APK en tu celular' 
                          : 'Escanea para abrir la app en tu navegador'}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        100% Escaneable
                      </span>
                    </div>
                    <p className="text-slate-400 mt-1 text-[11px] leading-relaxed">
                      {qrTarget === 'apk'
                        ? 'Abre la cámara de tu teléfono Android o iPhone y apunta hacia la pantalla. Tu teléfono detectará el enlace y comenzará la descarga de MineSafe inmediatamente.'
                        : 'Apunta tu cámara al código para abrir MineSafe directamente en Chrome o Safari móvil e instalar el acceso directo sin cables.'}
                    </p>
                  </div>

                  {/* URL Display */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <span className="text-[11px] text-slate-400">Enlace codificado en el QR:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={getCurrentQrUrl()}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 font-mono truncate"
                      />
                      <button
                        type="button"
                        onClick={handleCopyQrUrl}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                        title="Copiar enlace"
                      >
                        {isCopiedQr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopiedQr ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadQrImage}
                      className="px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/80 rounded-lg font-medium text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Descargar la imagen del código QR en formato PNG para imprimirlo o compartirlo"
                    >
                      <Download className="w-3 h-3" />
                      <span>Descargar imagen QR (.PNG)</span>
                    </button>

                    <a
                      href={getCurrentQrUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg font-medium text-[11px] flex items-center gap-1.5 transition-colors"
                      title="Probar el enlace en una nueva pestaña"
                    >
                      <ExternalLink className="w-3 h-3 text-cyan-400" />
                      <span>Probar enlace</span>
                    </a>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* Features Highlights Grid */}
          <div className="pt-2 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px]">
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="block font-bold text-emerald-400">Sincronización RTDB</span>
              <span className="text-slate-400">Enlace en tiempo real</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="block font-bold text-amber-400">Sirena & Vibración</span>
              <span className="text-slate-400">Alerta de gases críticos</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="block font-bold text-cyan-400">Modo Subterráneo</span>
              <span className="text-slate-400">Cache offline sin señal</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="block font-bold text-rose-400">Evacuación SOS</span>
              <span className="text-slate-400">Protocolo DS 132</span>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Certificado para Operaciones Mineras Sernageomin DS 132</span>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
