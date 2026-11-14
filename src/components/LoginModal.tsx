import React, { useState, useRef } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  Shield, 
  KeyRound, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  X,
  Crown,
  HardHat,
  Eye,
  EyeOff,
  Radio,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  Loader2
} from 'lucide-react';
import { UserProfile } from '../types';
import { 
  loginWithFirebaseAuth,
  registerWithFirebaseAuth,
  sendPasswordResetWithFirebase
} from '../services/firebase';
import { soundAlert } from '../services/audioAlert';

interface LoginModalProps {
  currentUser: UserProfile | null;
  onLogin: (user: UserProfile) => void;
  onLogout: () => void;
  onClose: () => void;
  usersList: UserProfile[];
  onRegisterUser: (newUser: UserProfile) => void;
  isGateMode?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  currentUser,
  onLogin,
  onLogout,
  onClose,
  usersList,
  onRegisterUser,
  isGateMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'recover'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Security Controls
  const [selectedProfileForAuth, setSelectedProfileForAuth] = useState<UserProfile | null>(null);
  const [hideQuickProfiles, setHideQuickProfiles] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regRut, setRegRut] = useState('');
  const [regShift, setRegShift] = useState('Turno Mañana (07:00 - 15:30)');

  // When clicking on a quick profile card: fills email only and requires real Firebase Auth password
  const handleSelectQuickProfile = (targetUser: UserProfile) => {
    setSelectedProfileForAuth(targetUser);
    setEmail(targetUser.email);
    setPassword('');
    setErrorMessage('');
    setSuccessMessage('');
    soundAlert.playFeedbackBeep();

    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 100);
  };

  // Submit login strictly via Firebase Authentication signInWithEmailAndPassword
  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Por favor ingrese su correo electrónico corporativo.');
      return;
    }

    if (!password) {
      soundAlert.playFeedbackBeep();
      setErrorMessage('Por seguridad (DS 132), debe ingresar su contraseña de Firebase Auth.');
      passwordInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const authenticatedUser = await loginWithFirebaseAuth(cleanEmail, password, rememberMe);
      soundAlert.playFeedbackBeep();
      onLogin(authenticatedUser);
      if (!isGateMode) onClose();
    } catch (err: any) {
      soundAlert.playFeedbackBeep();
      setErrorMessage(err?.message || 'Credenciales inválidas en Firebase Authentication. Acceso denegado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit registration strictly via Firebase Authentication createUserWithEmailAndPassword
  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setErrorMessage('Nombre, correo electrónico y contraseña (mínimo 6 caracteres) son obligatorios.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage('La contraseña de Firebase Authentication debe tener al menos 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const createdUser = await registerWithFirebaseAuth(
        regName,
        regEmail,
        regPassword,
        regRut,
        regShift
      );
      onRegisterUser(createdUser);
      onLogin(createdUser);
      soundAlert.playFeedbackBeep();
      setSuccessMessage('Cuenta verificada y creada en Firebase Authentication con rol Operador.');
      if (!isGateMode) {
        setTimeout(() => onClose(), 1000);
      }
    } catch (err: any) {
      soundAlert.playFeedbackBeep();
      setErrorMessage(err?.message || 'No se pudo registrar la cuenta en Firebase Authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit password recovery via Firebase Authentication
  const handleSubmitRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (!email.trim()) {
      setErrorMessage('Ingrese su correo corporativo registrado en Firebase Auth.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordResetWithFirebase(email);
      soundAlert.playFeedbackBeep();
      setSuccessMessage(`Se ha enviado un enlace de restablecimiento de Firebase Auth a ${email.trim()}.`);
      setTimeout(() => {
        setActiveTab('login');
        setSuccessMessage('');
      }, 2500);
    } catch (err: any) {
      soundAlert.playFeedbackBeep();
      setErrorMessage(err?.message || 'No se pudo enviar el correo de recuperación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find the 3 featured real accounts from RTDB
  const manuelUser = usersList.find(u => u.email.includes('manuelcrisostomo') || u.name.includes('Manuel Crisostomo')) || usersList[0];
  const pepeUser = usersList.find(u => u.email.includes('white.wolf') || u.name.includes('PEPE')) || usersList.find(u => u.role === 'admin');
  const gerardoUser = usersList.find(u => u.email.includes('geencuve') || u.name.includes('Gerardo')) || usersList.find(u => u.role === 'operador');

  const cardContent = (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl max-w-lg w-full shadow-2xl backdrop-blur-md relative z-10 flex flex-col max-h-[min(88vh,720px)] sm:max-h-[min(90vh,760px)]">
      
      {/* Header - Fixed at top */}
      <div className="flex items-start justify-between p-5 sm:p-6 pb-4 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center shadow-lg shadow-cyan-950/50 shrink-0">
            <Lock className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Autenticación MineSafe
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                DS 132
              </span>
            </h2>
            <p className="text-xs text-slate-400">Control de Acceso, Monitoreo IoT y Seguridad Minera</p>
          </div>
        </div>

        {/* Close button only in modal mode */}
        {!isGateMode && (
          <button 
            onClick={onClose} 
            aria-label="Cerrar modal"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0 -mr-1 -mt-1"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Scrollable Body Container */}
      <div className="p-5 sm:p-6 pt-4 overflow-y-auto space-y-4">
        {/* Security Banner: Anti-Impersonation */}
        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Validación estricta con Firebase Authentication (Email y Contraseña).</span>
          </div>
          <button
            type="button"
            onClick={() => setHideQuickProfiles(!hideQuickProfiles)}
            className="text-cyan-400 hover:underline text-[10px] font-medium whitespace-nowrap ml-2"
          >
            {hideQuickProfiles ? 'Mostrar atajos' : 'Ocultar atajos'}
          </button>
        </div>

      {/* Current User Session Status (If logged in in modal mode) */}
      {currentUser && !isGateMode && (
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center justify-center font-bold">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <span className="font-bold text-white block">{currentUser.name}</span>
              <span className="text-[10px] text-cyan-400 uppercase font-semibold">
                {currentUser.role === 'superadmin' ? 'SuperAdmin' : currentUser.role === 'admin' ? 'Admin' : 'Usuario Normal'}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              onLogout();
              soundAlert.playFeedbackBeep();
            }}
            className="px-2.5 py-1 text-xs font-semibold text-rose-300 bg-rose-950/80 hover:bg-rose-900 rounded border border-rose-800 transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      )}

      {/* Tab switchers */}
      <div className="flex items-center p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
        <button
          onClick={() => {
            setActiveTab('login');
            setErrorMessage('');
          }}
          className={`flex-1 py-1.5 font-semibold rounded-md transition-colors ${
            activeTab === 'login' ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Iniciar Sesión
        </button>
        <button
          onClick={() => {
            setActiveTab('register');
            setErrorMessage('');
          }}
          className={`flex-1 py-1.5 font-semibold rounded-md transition-colors ${
            activeTab === 'register' ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Registrarse
        </button>
        <button
          onClick={() => {
            setActiveTab('recover');
            setErrorMessage('');
          }}
          className={`flex-1 py-1.5 font-semibold rounded-md transition-colors ${
            activeTab === 'recover' ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Recuperar
        </button>
      </div>

      {/* Feedback messages */}
      {errorMessage && (
        <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ==============================================================
          TAB 1: INICIAR SESIÓN
         ============================================================== */}
      {activeTab === 'login' && (
        <div className="space-y-4">
          
          {/* Quick Profile Selection (With password protection) */}
          {!hideQuickProfiles && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Seleccionar Perfil de Faena (Requiere Clave)</span>
                <span className="text-emerald-400 font-mono text-[9px]">Protegido con Contraseña</span>
              </span>

              <div className="grid grid-cols-1 gap-2">
                {/* SuperAdmin: Manuel Crisostomo */}
                {manuelUser && (
                  <button
                    type="button"
                    onClick={() => handleSelectQuickProfile(manuelUser)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-colors flex items-center justify-between group ${
                      selectedProfileForAuth?.id === manuelUser.id
                        ? 'border-purple-500 bg-purple-950/70 shadow-md shadow-purple-950'
                        : 'border-purple-800/80 bg-purple-950/30 hover:bg-purple-950/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-900/80 text-purple-300 flex items-center justify-center font-bold">
                        <Crown className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">{manuelUser.name}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900 text-purple-200 font-mono font-bold">SuperAdmin</span>
                        </div>
                        <span className="text-[10px] text-purple-300/80 block">
                          {manuelUser.email} • {manuelUser.assignedSector || 'Mina Chuquicamata'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-purple-400 text-[11px] font-semibold">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Pedir Clave</span>
                    </div>
                  </button>
                )}

                {/* Admin: PEPE LOTA */}
                {pepeUser && (
                  <button
                    type="button"
                    onClick={() => handleSelectQuickProfile(pepeUser)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-colors flex items-center justify-between group ${
                      selectedProfileForAuth?.id === pepeUser.id
                        ? 'border-cyan-500 bg-cyan-950/70 shadow-md shadow-cyan-950'
                        : 'border-cyan-800/80 bg-cyan-950/30 hover:bg-cyan-950/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-cyan-900/80 text-cyan-300 flex items-center justify-center font-bold">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">{pepeUser.name}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-900 text-cyan-200 font-mono font-bold">Admin</span>
                        </div>
                        <span className="text-[10px] text-cyan-300/80 block">
                          {pepeUser.email} • Prevención de Riesgos
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-cyan-400 text-[11px] font-semibold">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Pedir Clave</span>
                    </div>
                  </button>
                )}

                {/* Operator: Gerardo Cuellar */}
                {gerardoUser && (
                  <button
                    type="button"
                    onClick={() => handleSelectQuickProfile(gerardoUser)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-colors flex items-center justify-between group ${
                      selectedProfileForAuth?.id === gerardoUser.id
                        ? 'border-amber-500 bg-amber-950/70 shadow-md shadow-amber-950'
                        : 'border-amber-800/80 bg-amber-950/30 hover:bg-amber-950/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-900/80 text-amber-300 flex items-center justify-center font-bold">
                        <HardHat className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">{gerardoUser.name}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-900 text-amber-200 font-mono font-bold">Operador</span>
                        </div>
                        <span className="text-[10px] text-amber-300/80 block">
                          {gerardoUser.email} • {gerardoUser.assignedSector || 'Mina San José'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-semibold">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Pedir Clave</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              {selectedProfileForAuth ? `Ingresar contraseña para ${selectedProfileForAuth.name}` : 'o ingresar credenciales manualmente'}
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmitLogin} className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Correo Electrónico Corporativo
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="manuelcrisostomovega@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (selectedProfileForAuth && e.target.value !== selectedProfileForAuth.email) {
                      setSelectedProfileForAuth(null);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium block">
                  Contraseña Obligatoria
                </label>
                {selectedProfileForAuth && (
                  <span className="text-[10px] text-cyan-400 font-mono">
                    Validando: {selectedProfileForAuth.name}
                  </span>
                )}
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Ingrese contraseña o PIN..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 bg-slate-950 border border-cyan-700/60 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-cyan-600 focus:ring-0 w-3.5 h-3.5"
                />
                <span>Recordar sesión en este equipo</span>
              </label>

              <button
                type="button"
                onClick={() => setActiveTab('recover')}
                className="text-cyan-400 hover:underline"
              >
                ¿Olvidó contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-900 disabled:text-cyan-300 text-white rounded-lg transition-colors shadow-md shadow-cyan-950 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
              <span>{isSubmitting ? 'Validando en Firebase Auth...' : 'Verificar Identidad e Ingresar'}</span>
            </button>
          </form>

        </div>
      )}

      {/* ==============================================================
          TAB 2: REGISTRO DE NUEVO USUARIO
         ============================================================== */}
      {activeTab === 'register' && (
        <form onSubmit={handleSubmitRegister} className="space-y-3 text-xs">
          <div>
            <label className="text-slate-300 block mb-1">Nombre Completo</label>
            <input
              type="text"
              required
              placeholder="Ej: Carolina Morales Silva"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="text-slate-300 block mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              placeholder="cmorales@minesafe.cl"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="text-slate-300 block mb-1">Contraseña (mínimo 6 caracteres)</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type={showRegPassword ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres..."
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full pl-9 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowRegPassword(!showRegPassword)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-300 block mb-1">RUT</label>
              <input
                type="text"
                placeholder="17.432.189-2"
                value={regRut}
                onChange={(e) => setRegRut(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1 flex items-center justify-between">
                <span>Rol Asignado</span>
                <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Fijo
                </span>
              </label>
              <div className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-amber-300 text-xs font-semibold flex items-center justify-between">
                <span className="truncate">Usuario Normal / Operador</span>
                <span className="text-[9px] bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded border border-amber-800 font-mono shrink-0 ml-1">
                  DS 132
                </span>
              </div>
            </div>
          </div>

          {/* Nota de seguridad sobre asignación de roles */}
          <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-2.5 text-[11px] text-amber-300/90 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Protocolo de credenciales:</strong> Todo registro nuevo inicia únicamente como <strong>Usuario Normal / Operador</strong>. Solo un <strong>Administrador</strong> o <strong>SuperAdmin</strong> puede otorgar permisos superiores desde Gestión de Usuarios.
            </p>
          </div>

          <div>
            <label className="text-slate-300 block mb-1">Turno de Faena</label>
            <input
              type="text"
              value={regShift}
              onChange={(e) => setRegShift(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-3 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-900 text-white rounded-lg transition-colors mt-2 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isSubmitting ? 'Registrando en Firebase Auth...' : 'Crear Cuenta en Firebase Auth'}</span>
          </button>
        </form>
      )}

      {/* ==============================================================
          TAB 3: RECUPERAR CONTRASEÑA
         ============================================================== */}
      {activeTab === 'recover' && (
        <form onSubmit={handleSubmitRecover} className="space-y-3 text-xs">
          <p className="text-slate-400">
            Ingrese su correo corporativo registrado para recibir el enlace de recuperación y reseteo de credenciales de acceso.
          </p>
          <div>
            <label className="text-slate-300 block mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              placeholder="ejemplo@minesafe.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-3 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-900 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isSubmitting ? 'Enviando enlace...' : 'Enviar Enlace de Recuperación'}</span>
          </button>
        </form>
      )}

      </div>
    </div>
  );

  // If in Gate mode, render full-screen gateway with scroll support
  if (isGateMode) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-6 relative overflow-y-auto py-8 sm:py-12">
        
        {/* Background glow and industrial grid decorations */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Portal Branding Top Header */}
        <div className="text-center mb-5 relative z-10 max-w-md shrink-0">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 mb-3 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono font-semibold text-emerald-400">
              minefase-fc5f5-default-rtdb (En Línea)
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/30">
              <Radio className="w-6 h-6 text-slate-950" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wider">
              MINESAFE <span className="text-cyan-400">IOT</span>
            </h1>
          </div>

          <p className="text-xs text-slate-400 font-medium">
            Control Atmosférico, Detección de Gases y Seguridad Minera DS 132
          </p>
        </div>

        {/* The Login Card */}
        {cardContent}

        {/* Portal Footer Notice */}
        <div className="mt-5 text-center text-[11px] text-slate-400 relative z-10 max-w-md shrink-0">
          <p className="flex items-center justify-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Certificado Sernageomin DS 132 — Monitoreo Continuo 24/7</span>
          </p>
          <p className="mt-1 text-[10px] text-slate-400">
            Todos los accesos son auditados y sincronizados con Firebase Realtime Database.
          </p>
        </div>

      </div>
    );
  }

  // Otherwise, render as standard modal overlay with centered scrollable view
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in">
      <div className="min-h-full flex items-center justify-center py-4">
        {cardContent}
      </div>
    </div>
  );
};
