import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  X,
  ArrowRight,
  Radio,
  Router,
  Monitor,
  Activity,
  Thermometer,
  Droplets,
  Bell,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Lock,
  Users,
  Camera,
  ChevronRight,
  LogIn,
} from 'lucide-react';
import {
  validateContactForm,
  buildContactMailtoHref,
  ContactFormPayload,
} from '../utils/contactValidation';

export interface TeamMemberSlot {
  id: string;
  name: string;
  role: string;
  bio?: string;
  photoUrl?: string;
}

/**
 * Espacio reservado para incorporar fotografías reales y nómina del equipo
 * únicamente cuando sean autorizadas para publicación pública.
 */
export const APPROVED_MEDIA = {
  heroPrototypePhotoUrl: '' as string,
  nodePhotoUrl: '' as string,
  gatewayPhotoUrl: '' as string,
};

export const APPROVED_TEAM_MEMBERS: TeamMemberSlot[] = [];

interface PublicLandingProps {
  onGoToLogin: () => void;
  onGoToPanel?: () => void;
  isAuthenticated?: boolean;
  authenticatedUserName?: string;
}

const OFFICIAL_CONTACT_EMAIL = (import.meta.env.VITE_PUBLIC_CONTACT_EMAIL || '').trim();
const OFFICIAL_CONTACT_ENDPOINT = (import.meta.env.VITE_PUBLIC_CONTACT_ENDPOINT || '').trim();

const NAV_ITEMS = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'producto', label: 'Nuestro producto' },
  { id: 'como-funciona', label: 'Cómo funciona' },
  { id: 'quienes-somos', label: 'Quiénes somos' },
  { id: 'contacto', label: 'Contacto' },
];

export const PublicLanding: React.FC<PublicLandingProps> = ({
  onGoToLogin,
  onGoToPanel,
  isAuthenticated = false,
  authenticatedUserName,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formState, setFormState] = useState<ContactFormPayload>({
    name: '',
    organization: '',
    email: '',
    message: '',
    website: '',
  });
  const [formErrors, setFormErrors] = useState<
    Partial<Record<'name' | 'organization' | 'email' | 'message' | 'form', string>>
  >({});
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);
  const [isSendingContact, setIsSendingContact] = useState(false);
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const hasOfficialChannel = Boolean(OFFICIAL_CONTACT_EMAIL || OFFICIAL_CONTACT_ENDPOINT);
  const directMailtoHref = OFFICIAL_CONTACT_EMAIL
    ? buildContactMailtoHref(OFFICIAL_CONTACT_EMAIL)
    : '';

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus(null);

    const validation = validateContactForm(formState, lastSentRef.current);
    setFormErrors(validation.errors);
    if (!validation.valid) return;

    if (!hasOfficialChannel) {
      setSubmitStatus({
        type: 'info',
        text: 'El correo oficial de contacto aún está pendiente de confirmación por el equipo. No se registró ningún envío.',
      });
      return;
    }

    if (OFFICIAL_CONTACT_ENDPOINT) {
      setIsSendingContact(true);
      try {
        const response = await fetch(OFFICIAL_CONTACT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            name: formState.name.trim(),
            organization: formState.organization.trim(),
            email: formState.email.trim(),
            message: formState.message.trim(),
          }),
        });
        if (!response.ok) {
          throw new Error('No fue posible entregar la solicitud al canal configurado.');
        }
        lastSentRef.current = Date.now();
        setFormState({ name: '', organization: '', email: '', message: '', website: '' });
        setFormErrors({});
        setSubmitStatus({
          type: 'success',
          text: 'Consulta enviada correctamente al equipo de MineSafe.',
        });
      } catch (err: any) {
        setSubmitStatus({
          type: 'error',
          text:
            err?.message ||
            'Ocurrió un error al enviar el mensaje. Intenta nuevamente o utiliza el enlace de correo directo.',
        });
      } finally {
        setIsSendingContact(false);
      }
      return;
    }

    const composedHref = buildContactMailtoHref(OFFICIAL_CONTACT_EMAIL, formState);
    if (composedHref) {
      lastSentRef.current = Date.now();
      window.location.href = composedHref;
      setSubmitStatus({
        type: 'info',
        text: `Se abrirá tu cliente de correo para enviar la consulta a ${OFFICIAL_CONTACT_EMAIL}.`,
      });
    }
  };

  const focusRing =
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]';
  const lightFocusRing =
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 focus-visible:ring-offset-white';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-[#0D9488] selection:text-[#FFFFFF]">
      {/* Saltar al contenido principal (accesibilidad teclado) */}
      <a
        href="#inicio"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#0F172A] focus:text-[#FFFFFF] focus:ring-2 focus:ring-[#14B8A6] text-sm font-semibold"
      >
        Ir al contenido principal
      </a>

      {/* ================================================================
          ENCABEZADO (AZUL GRAFITO + ACENTO TURQUESA)
         ================================================================ */}
      <header className="sticky top-0 z-50 bg-[#131E31]/95 backdrop-blur-md border-b border-[#253349] text-[#F8FAFC] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between gap-4">
            {/* Logotipo MineSafe */}
            <a
              href="#inicio"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('inicio');
              }}
              className={`flex items-center gap-2.5 rounded-lg py-1 pr-2 ${focusRing}`}
            >
              <span
                aria-hidden="true"
                className="w-9 h-9 rounded-lg bg-[#0D9488] flex items-center justify-center text-[#FFFFFF] shadow-sm shrink-0"
              >
                <Radio className="w-5 h-5" />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-[#F8FAFC]">
                Mine<span className="text-[#2DD4BF]">Safe</span>
              </span>
            </a>

            {/* Navegación Desktop */}
            <nav aria-label="Navegación principal" className="hidden lg:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(item.id);
                  }}
                  className={`px-3 py-2 text-sm font-medium text-[#CBD5E1] hover:text-[#FFFFFF] hover:bg-[#1E293B] rounded-lg transition-colors whitespace-nowrap ${focusRing}`}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Acciones Desktop */}
            <div className="hidden md:flex items-center gap-2.5 shrink-0">
              {isAuthenticated && onGoToPanel ? (
                <button
                  type="button"
                  onClick={onGoToPanel}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#0D9488] hover:bg-[#0F766E] text-[#FFFFFF] transition-colors cursor-pointer ${focusRing}`}
                >
                  <LogIn className="w-4 h-4" />
                  <span>Ir al panel{authenticatedUserName ? ` (${authenticatedUserName.split(' ')[0]})` : ''}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onGoToLogin}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#0D9488] hover:bg-[#0F766E] text-[#FFFFFF] transition-colors shadow-sm cursor-pointer ${focusRing}`}
                >
                  <Lock className="w-4 h-4" />
                  <span>Iniciar sesión</span>
                </button>
              )}
            </div>

            {/* Botones Móvil */}
            <div className="flex md:hidden items-center gap-2">
              <button
                type="button"
                onClick={isAuthenticated && onGoToPanel ? onGoToPanel : onGoToLogin}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0D9488] hover:bg-[#0F766E] text-[#FFFFFF] transition-colors ${focusRing}`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isAuthenticated && onGoToPanel ? 'Ir al panel' : 'Iniciar sesión'}</span>
              </button>
              <button
                type="button"
                aria-expanded={mobileMenuOpen}
                aria-controls="public-mobile-nav"
                aria-label={mobileMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className={`p-2 rounded-lg text-[#CBD5E1] hover:text-[#FFFFFF] hover:bg-[#1E293B] ${focusRing}`}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Menú Móvil Desplegable */}
        {mobileMenuOpen && (
          <nav
            id="public-mobile-nav"
            aria-label="Navegación móvil"
            className="lg:hidden bg-[#0F172A] border-t border-[#253349] px-4 py-3 space-y-1"
          >
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(item.id);
                }}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#2DD4BF] transition-colors ${focusRing}`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        {/* ================================================================
            SECCIÓN PRINCIPAL (HERO)
           ================================================================ */}
        <section
          id="inicio"
          className="bg-gradient-to-b from-[#131E31] via-[#17253B] to-[#1E2E46] text-[#F8FAFC] border-b border-[#253349]"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Mensaje principal y acciones (primero en móvil y columna izquierda en escritorio) */}
              <div className="lg:col-span-6 space-y-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2DD4BF]">
                  Proyecto de título · Chile
                </p>

                <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight leading-[1.12] text-[#FFFFFF]">
                  MineSafe — Monitoreo ambiental IoT para la pequeña minería
                </h1>

                <p className="text-base sm:text-lg text-[#CBD5E1] leading-relaxed max-w-xl">
                  MineSafe es un prototipo que reúne lecturas ambientales, umbrales configurables y revisión de eventos en una plataforma web para equipos de faena.
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 pt-2">
                  <button
                    type="button"
                    onClick={() => scrollToSection('contacto')}
                    className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-[#0D9488] hover:bg-[#0F766E] text-[#FFFFFF] transition-colors shadow-sm cursor-pointer ${focusRing}`}
                  >
                    <span>Contactar al equipo</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <a
                    href="#producto"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection('producto');
                    }}
                    className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold border border-[#334155] bg-[#1E293B]/60 hover:bg-[#1E293B] text-[#E2E8F0] transition-colors ${focusRing}`}
                  >
                    <span>Conocer el producto</span>
                  </a>
                </div>
              </div>

              {/* Espacio visual del prototipo (debajo en móvil, derecha en escritorio) */}
              <div className="lg:col-span-6">
                <div className="rounded-2xl border border-[#2C3E57] bg-[#0F172A]/90 p-5 sm:p-6 shadow-xl space-y-4">
                  {APPROVED_MEDIA.heroPrototypePhotoUrl ? (
                    <figure className="space-y-2.5">
                      <img
                        src={APPROVED_MEDIA.heroPrototypePhotoUrl}
                        alt="Fotografía real del prototipo MineSafe en pruebas de laboratorio"
                        className="w-full aspect-[16/10] object-cover rounded-xl border border-[#253349]"
                      />
                      <figcaption className="text-xs text-[#94A3B8]">
                        Prototipo físico MineSafe (registro fotográfico autorizado del equipo).
                      </figcaption>
                    </figure>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#334155] bg-[#131E31] aspect-[16/10] flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-12 h-12 rounded-xl bg-[#0D9488]/15 border border-[#0D9488]/40 text-[#2DD4BF] flex items-center justify-center mb-3">
                        <Camera className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-[#F8FAFC]">
                        Fotografía real del prototipo pendiente de incorporación
                      </p>
                      <p className="text-xs text-[#94A3B8] mt-1.5 max-w-sm leading-relaxed">
                        Este espacio está reservado exclusivamente para fotografías propias y autorizadas del nodo ambiental y su gateway, sin usar imágenes generadas como si fueran hardware real.
                      </p>
                    </div>
                  )}

                  {/* Resumen de demostración ilustrativo (sin identificadores ni faenas reales) */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="rounded-xl bg-[#162235] border border-[#253349] p-3.5">
                      <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                        <span>Temperatura (demo)</span>
                        <Thermometer className="w-4 h-4 text-[#2DD4BF]" />
                      </div>
                      <p className="mt-1.5 text-xl font-bold font-mono text-[#FFFFFF] tabular-nums">
                        22.4 °C
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#162235] border border-[#253349] p-3.5">
                      <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                        <span>Humedad relativa (demo)</span>
                        <Droplets className="w-4 h-4 text-[#2DD4BF]" />
                      </div>
                      <p className="mt-1.5 text-xl font-bold font-mono text-[#FFFFFF] tabular-nums">
                        48 %
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#94A3B8]">
                    Valores ilustrativos de demostración para mostrar el formato de lectura ambiental.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            NUESTRO PRODUCTO
           ================================================================ */}
        <section id="producto" className="py-16 sm:py-20 bg-[#F8FAFC] border-b border-[#E2E8F0]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0F766E]">
                Nuestro producto
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
                Tres componentes integrados en una misma arquitectura
              </h2>
              <p className="mt-3 text-base text-[#475569] leading-relaxed">
                Cada parte cumple una función específica dentro del prototipo: capturar variables del entorno, concentrar su envío y disponibilizar la consulta para los equipos autorizados.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 01. Nodo ambiental */}
              <article className="lg:col-span-6 bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <span className="text-xs font-mono font-bold text-[#0F766E] tracking-widest">
                      01 · CAPTURA EN TERRENO
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] text-[#0F766E] flex items-center justify-center">
                      <Radio className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-[#0F172A]">Nodo ambiental</h3>
                  <p className="mt-2.5 text-sm sm:text-base text-[#475569] leading-relaxed">
                    Dispositivo encargado de capturar señales ambientales mediante sensores.
                  </p>
                </div>

                <div className="mt-6">
                  {APPROVED_MEDIA.nodePhotoUrl ? (
                    <img
                      src={APPROVED_MEDIA.nodePhotoUrl}
                      alt="Fotografía autorizada del nodo ambiental MineSafe"
                      className="w-full h-44 object-cover rounded-xl border border-[#E2E8F0]"
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 flex items-center gap-3 text-xs text-[#64748B]">
                      <Camera className="w-4 h-4 text-[#0F766E] shrink-0" />
                      <span>Espacio preparado para fotografía autorizada del nodo sensor físico.</span>
                    </div>
                  )}
                </div>
              </article>

              {/* 02. Gateway */}
              <article className="lg:col-span-6 bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <span className="text-xs font-mono font-bold text-[#0F766E] tracking-widest">
                      02 · CONCENTRACIÓN Y ENVÍO
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] text-[#0F766E] flex items-center justify-center">
                      <Router className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-[#0F172A]">Gateway</h3>
                  <p className="mt-2.5 text-sm sm:text-base text-[#475569] leading-relaxed">
                    Componente encargado de concentrar y transmitir las lecturas hacia la plataforma, conforme a la arquitectura realmente implementada.
                  </p>
                </div>

                <div className="mt-6">
                  {APPROVED_MEDIA.gatewayPhotoUrl ? (
                    <img
                      src={APPROVED_MEDIA.gatewayPhotoUrl}
                      alt="Fotografía autorizada del gateway MineSafe"
                      className="w-full h-44 object-cover rounded-xl border border-[#E2E8F0]"
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 flex items-center gap-3 text-xs text-[#64748B]">
                      <Camera className="w-4 h-4 text-[#0F766E] shrink-0" />
                      <span>Espacio preparado para fotografía autorizada del gateway de enlace.</span>
                    </div>
                  )}
                </div>
              </article>

              {/* 03. Plataforma web (bloque ancho con captura de demostración en Temperatura y Humedad) */}
              <article className="lg:col-span-12 bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 space-y-3">
                  <span className="text-xs font-mono font-bold text-[#0F766E] tracking-widest block">
                    03 · CONSULTA Y SEGUIMIENTO
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] text-[#0F766E] flex items-center justify-center shrink-0">
                      <Monitor className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-[#0F172A]">Plataforma web</h3>
                  </div>
                  <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
                    Sistema que permite consultar lecturas, revisar eventos, gestionar umbrales y utilizar las funcionalidades existentes que estén verificadas.
                  </p>
                  <ul className="pt-2 space-y-2 text-sm text-[#334155]">
                    <li className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#0D9488] shrink-0" />
                      <span>Visualización de variables ambientales recibidas desde terreno</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#0D9488] shrink-0" />
                      <span>Configuración de umbrales y registro de alertas</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#0D9488] shrink-0" />
                      <span>Acceso restringido por cuenta y organización autorizada</span>
                    </li>
                  </ul>
                </div>

                {/* Captura de demostración explícitamente identificada (Temperatura y Humedad, sin PII/IPs) */}
                <div className="lg:col-span-7">
                  <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4 sm:p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                          Vista de demostración · Temperatura y Humedad
                        </p>
                        <p className="text-[11px] text-[#64748B]">
                          Datos ilustrativos de ejemplo (sin nombres personales, faenas reales ni identificadores internos)
                        </p>
                      </div>
                      <span className="text-xs font-mono font-semibold text-[#0F766E] bg-[#CCFBF1] px-2.5 py-1 rounded-md">
                        Estado de ejemplo: Estable
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4">
                        <div className="flex items-center justify-between text-xs font-semibold text-[#475569]">
                          <span>Temperatura ambiente</span>
                          <Thermometer className="w-4 h-4 text-[#0D9488]" />
                        </div>
                        <p className="mt-2 text-2xl font-extrabold font-mono text-[#0F172A] tabular-nums">
                          22.4 °C
                        </p>
                        <p className="mt-1 text-xs text-[#64748B]">
                          Umbral preventivo de ejemplo: 28.0 °C
                        </p>
                      </div>

                      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4">
                        <div className="flex items-center justify-between text-xs font-semibold text-[#475569]">
                          <span>Humedad relativa</span>
                          <Droplets className="w-4 h-4 text-[#0D9488]" />
                        </div>
                        <p className="mt-2 text-2xl font-extrabold font-mono text-[#0F172A] tabular-nums">
                          48 %
                        </p>
                        <p className="mt-1 text-xs text-[#64748B]">
                          Umbral preventivo de ejemplo: 75 %
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ================================================================
            CÓMO FUNCIONA
           ================================================================ */}
        <section id="como-funciona" className="py-16 sm:py-20 bg-[#FFFFFF] border-b border-[#E2E8F0]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0F766E]">
                Cómo funciona
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
                Recorrido de la lectura desde el nodo hasta la consulta web
              </h2>
              <p className="mt-3 text-base text-[#475569] leading-relaxed">
                El nodo toma la lectura. El gateway la envía. La plataforma muestra el estado del dispositivo y permite revisar eventos.
              </p>
            </div>

            <ol
              aria-label="Flujo de arquitectura MineSafe"
              className="grid grid-cols-1 md:grid-cols-4 gap-4 relative"
            >
              {[
                {
                  step: '01',
                  title: 'Nodo ambiental',
                  desc: 'Captura las señales ambientales en el punto de monitoreo mediante sus sensores.',
                  icon: <Radio className="w-5 h-5" />,
                },
                {
                  step: '02',
                  title: 'Gateway',
                  desc: 'Concentra las lecturas recibidas desde el nodo y las transmite hacia el servicio en la nube.',
                  icon: <Router className="w-5 h-5" />,
                },
                {
                  step: '03',
                  title: 'Plataforma web',
                  desc: 'Recibe la información de forma autenticada, evalúa umbrales y actualiza el estado operativo.',
                  icon: <Monitor className="w-5 h-5" />,
                },
                {
                  step: '04',
                  title: 'Consulta de lecturas y eventos',
                  desc: 'El equipo autorizado revisa valores recientes, eventos registrados y estado del dispositivo.',
                  icon: <Activity className="w-5 h-5" />,
                },
              ].map((item, idx, arr) => (
                <li
                  key={item.step}
                  className="relative bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono font-bold text-[#0F766E]">{item.step}</span>
                      <span className="w-9 h-9 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-[#0D9488] flex items-center justify-center">
                        {item.icon}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#0F172A]">{item.title}</h3>
                    <p className="mt-2 text-sm text-[#475569] leading-relaxed">{item.desc}</p>
                  </div>

                  {idx < arr.length - 1 && (
                    <div
                      aria-hidden="true"
                      className="hidden md:flex items-center justify-center absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-[#FFFFFF] border border-[#CBD5E1] text-[#0D9488]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ================================================================
            QUIÉNES SOMOS
           ================================================================ */}
        <section id="quienes-somos" className="py-16 sm:py-20 bg-[#F8FAFC] border-b border-[#E2E8F0]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-6 space-y-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0F766E]">
                  Quiénes somos
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
                  Desarrollo universitario orientado a la pequeña minería
                </h2>
                <p className="text-base text-[#334155] leading-relaxed">
                  Somos un equipo de estudiantes de Ingeniería en Informática que desarrolla MineSafe como proyecto de título en Chile. Nuestro foco está en la pequeña minería y en hacer más fácil la consulta de datos ambientales en faena.
                </p>
              </div>

              <div className="lg:col-span-6">
                {APPROVED_TEAM_MEMBERS.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {APPROVED_TEAM_MEMBERS.map((member) => (
                      <div
                        key={member.id}
                        className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 flex items-start gap-3"
                      >
                        {member.photoUrl ? (
                          <img
                            src={member.photoUrl}
                            alt={member.name}
                            className="w-12 h-12 rounded-lg object-cover shrink-0 border border-[#E2E8F0]"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-[#F0FDFA] text-[#0F766E] flex items-center justify-center font-bold shrink-0">
                            {member.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 className="text-sm font-bold text-[#0F172A]">{member.name}</h3>
                          <p className="text-xs font-semibold text-[#0F766E]">{member.role}</p>
                          {member.bio && <p className="text-xs text-[#475569] mt-1">{member.bio}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 space-y-3">
                    <div className="flex items-center gap-2.5 text-[#0F172A] font-bold text-sm">
                      <Users className="w-5 h-5 text-[#0D9488]" />
                      <span>Ficha del equipo e información académica</span>
                    </div>
                    <p className="text-sm text-[#475569] leading-relaxed">
                      La nómina de integrantes, sus funciones específicas, fotografías autorizadas e información académica confirmada se publicarán en este apartado una vez que el equipo valide los datos a difundir.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            CONTACTO
           ================================================================ */}
        <section id="contacto" className="py-16 sm:py-20 bg-[#FFFFFF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-5 space-y-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0F766E]">
                  Contacto
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
                  Conversa con el equipo de MineSafe
                </h2>
                <p className="text-base text-[#475569] leading-relaxed">
                  ¿Quieres conocer el prototipo o conversar sobre un caso de monitoreo? Escríbenos.
                </p>

                {OFFICIAL_CONTACT_EMAIL ? (
                  <div className="p-4 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                      Correo oficial del equipo
                    </p>
                    <a
                      href={directMailtoHref}
                      className={`inline-flex items-center gap-2 text-sm font-bold text-[#0F172A] hover:text-[#0F766E] underline underline-offset-4 ${lightFocusRing}`}
                    >
                      <Mail className="w-4 h-4 text-[#0D9488]" />
                      <span>{OFFICIAL_CONTACT_EMAIL}</span>
                    </a>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#334155]">
                      Canal de correo institucional / equipo
                    </p>
                    <p className="text-sm text-[#475569]">
                      Configuración pendiente: el equipo definirá el correo electrónico oficial de contacto en la variable <code className="font-mono text-xs bg-[#E2E8F0] px-1.5 py-0.5 rounded">VITE_PUBLIC_CONTACT_EMAIL</code>.
                    </p>
                  </div>
                )}

                <div className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#475569] space-y-1.5">
                  <p className="font-semibold text-[#0F172A]">Acceso para organizaciones habilitadas</p>
                  <p>
                    El ingreso al panel de monitoreo utiliza cuentas creadas por un responsable autorizado. La consulta pública no crea cuentas ni entrega acceso a telemetría privada.
                  </p>
                </div>
              </div>

              {/* Formulario de contacto acotado a 4 campos (Nombre, Organización, Correo, Mensaje) */}
              <div className="lg:col-span-7">
                <form
                  onSubmit={handleContactSubmit}
                  noValidate
                  className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 space-y-4"
                >
                  {/* Campo trampa anti-spam oculto para lectores humanos */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="contact-website">Sitio web</label>
                    <input
                      id="contact-website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={formState.website}
                      onChange={(e) => setFormState((prev) => ({ ...prev, website: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-name" className="block text-xs font-semibold text-[#334155] mb-1.5">
                        Nombre
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        placeholder="Tu nombre completo"
                        value={formState.name}
                        onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                        className={`w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] border rounded-lg text-[#0F172A] placeholder-[#94A3B8] ${
                          formErrors.name ? 'border-[#E11D48]' : 'border-[#CBD5E1]'
                        } ${lightFocusRing}`}
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-xs text-[#BE123C]">{formErrors.name}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="contact-org" className="block text-xs font-semibold text-[#334155] mb-1.5">
                        Organización
                      </label>
                      <input
                        id="contact-org"
                        type="text"
                        required
                        placeholder="Faena, empresa o institución"
                        value={formState.organization}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, organization: e.target.value }))
                        }
                        className={`w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] border rounded-lg text-[#0F172A] placeholder-[#94A3B8] ${
                          formErrors.organization ? 'border-[#E11D48]' : 'border-[#CBD5E1]'
                        } ${lightFocusRing}`}
                      />
                      {formErrors.organization && (
                        <p className="mt-1 text-xs text-[#BE123C]">{formErrors.organization}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-semibold text-[#334155] mb-1.5">
                      Correo electrónico
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      placeholder="nombre@organizacion.cl"
                      value={formState.email}
                      onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
                      className={`w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] border rounded-lg text-[#0F172A] placeholder-[#94A3B8] ${
                        formErrors.email ? 'border-[#E11D48]' : 'border-[#CBD5E1]'
                      } ${lightFocusRing}`}
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-xs text-[#BE123C]">{formErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="block text-xs font-semibold text-[#334155] mb-1.5">
                      Mensaje
                    </label>
                    <textarea
                      id="contact-message"
                      rows={4}
                      required
                      placeholder="Cuéntanos brevemente tu interés en el prototipo o solicitud de información."
                      value={formState.message}
                      onChange={(e) => setFormState((prev) => ({ ...prev, message: e.target.value }))}
                      className={`w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] border rounded-lg text-[#0F172A] placeholder-[#94A3B8] resize-y ${
                        formErrors.message ? 'border-[#E11D48]' : 'border-[#CBD5E1]'
                      } ${lightFocusRing}`}
                    />
                    {formErrors.message && (
                      <p className="mt-1 text-xs text-[#BE123C]">{formErrors.message}</p>
                    )}
                  </div>

                  {formErrors.form && (
                    <div className="p-3 rounded-lg bg-[#FFF1F2] border border-[#FECDD3] text-xs text-[#BE123C] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formErrors.form}</span>
                    </div>
                  )}

                  {submitStatus && (
                    <div
                      role="status"
                      className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                        submitStatus.type === 'success'
                          ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]'
                          : submitStatus.type === 'error'
                          ? 'bg-[#FFF1F2] border-[#FECDD3] text-[#BE123C]'
                          : 'bg-[#F0FDFA] border-[#99F6E4] text-[#0F766E]'
                      }`}
                    >
                      {submitStatus.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{submitStatus.text}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <p className="text-[11px] text-[#64748B]">
                      {hasOfficialChannel
                        ? 'Los datos ingresados se utilizarán solo para responder tu consulta.'
                        : 'El envío permanecerá deshabilitado hasta confirmar el correo oficial de recepción.'}
                    </p>
                    <button
                      type="submit"
                      disabled={isSendingContact || !hasOfficialChannel}
                      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#0D9488] hover:bg-[#0F766E] disabled:bg-[#CBD5E1] disabled:text-[#475569] disabled:cursor-not-allowed text-[#FFFFFF] transition-colors cursor-pointer shrink-0 ${lightFocusRing}`}
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {isSendingContact
                          ? 'Enviando...'
                          : OFFICIAL_CONTACT_ENDPOINT
                          ? 'Enviar consulta'
                          : OFFICIAL_CONTACT_EMAIL
                          ? 'Preparar correo'
                          : 'Canal pendiente'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ================================================================
          PIE DE PÁGINA
         ================================================================ */}
      <footer className="bg-[#0F172A] border-t border-[#1E293B] text-[#CBD5E1] py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-bold text-[#F8FAFC]">
              <span>MineSafe</span>
              <span className="text-[#475569]">·</span>
              <span className="font-medium text-[#94A3B8]">Proyecto de título</span>
            </div>
            <p className="text-xs text-[#94A3B8] max-w-xl">
              Privacidad: esta portada pública no recopila telemetría operativa ni expone datos de faenas. Los eventuales datos de contacto se destinan únicamente a responder consultas sobre el prototipo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <a
              href="#contacto"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('contacto');
              }}
              className={`text-[#CBD5E1] hover:text-[#2DD4BF] transition-colors ${focusRing}`}
            >
              Contacto
            </a>
            <button
              type="button"
              onClick={isAuthenticated && onGoToPanel ? onGoToPanel : onGoToLogin}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] border border-[#334155] transition-colors cursor-pointer ${focusRing}`}
            >
              <Lock className="w-3.5 h-3.5 text-[#2DD4BF]" />
              <span>{isAuthenticated && onGoToPanel ? 'Ir al panel' : 'Iniciar sesión'}</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
