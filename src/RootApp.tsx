import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { UserProfile } from './types';
import {
  subscribeToFirebaseAuth,
  logoutFromFirebaseAuth,
} from './services/firebase';
import {
  AppRoute,
  parseAppRoute,
  navigateToAppRoute,
} from './utils/navigation';
import { PublicLanding } from './components/PublicLanding';
import { LoginView } from './components/LoginView';

const MineSafePanel = lazy(() => import('./App'));

export const RootApp: React.FC = () => {
  const [routeState, setRouteState] = useState<{ route: AppRoute; sectionId?: string }>(() => {
    if (typeof window === 'undefined') return { route: 'landing' };
    return parseAppRoute(window.location.pathname, window.location.hash);
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('minesafe_theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  // Sincroniza cambios de historial del navegador (/acceso, /panel, #/acceso, #/panel)
  useEffect(() => {
    const syncRoute = () => {
      setRouteState(parseAppRoute(window.location.pathname, window.location.hash));
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  // Aplica theme-light únicamente dentro del panel privado para no alterar la dirección visual de portada/acceso
  useEffect(() => {
    try {
      localStorage.setItem('minesafe_theme', theme);
    } catch { /* ignore */ }
    const root = document.documentElement;
    const isPanelLight = routeState.route === 'panel' && theme === 'light';
    if (isPanelLight) {
      root.classList.add('theme-light');
      root.setAttribute('data-theme', 'light');
    } else {
      root.classList.remove('theme-light');
      root.setAttribute('data-theme', routeState.route === 'panel' ? 'dark' : 'public');
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        'content',
        routeState.route === 'panel'
          ? theme === 'light'
            ? '#f1f5f9'
            : '#060b13'
          : '#131E31'
      );
    }
  }, [theme, routeState.route]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Verifica estado real de Firebase Authentication (sin iniciar suscripciones operativas RTDB hasta validar sesión)
  useEffect(() => {
    try {
      localStorage.removeItem('minesafe_active_user');
    } catch { /* ignore */ }

    const unsubAuth = subscribeToFirebaseAuth((user, err) => {
      setCurrentUser(user && user.status === 'activo' ? user : null);
      setAuthError(err || null);
      setIsAuthChecking(false);
    });

    return () => unsubAuth();
  }, []);

  // Redirecciones de control de ruta:
  // - /panel sin sesión activa -> /acceso
  // - /acceso con sesión activa -> /panel
  useEffect(() => {
    if (isAuthChecking) return;

    if (routeState.route === 'panel' && !currentUser) {
      navigateToAppRoute('login', { replace: true });
      setRouteState({ route: 'login' });
    } else if (routeState.route === 'login' && currentUser) {
      navigateToAppRoute('panel', { replace: true });
      setRouteState({ route: 'panel' });
    }
  }, [isAuthChecking, routeState.route, currentUser]);

  // Si la portada se cargó con ancla (#producto, #como-funciona, etc.), desplazar suavemente al montar
  useEffect(() => {
    if (routeState.route === 'landing' && routeState.sectionId) {
      const target = document.getElementById(routeState.sectionId);
      if (target) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      }
    }
  }, [routeState.route, routeState.sectionId]);

  const goToLanding = useCallback(() => {
    setAuthError(null);
    navigateToAppRoute('landing');
    setRouteState({ route: 'landing' });
  }, []);

  const goToLogin = useCallback(() => {
    if (currentUser) {
      navigateToAppRoute('panel');
      setRouteState({ route: 'panel' });
      return;
    }
    setAuthError(null);
    navigateToAppRoute('login');
    setRouteState({ route: 'login' });
  }, [currentUser]);

  const goToPanel = useCallback(() => {
    if (!currentUser) {
      navigateToAppRoute('login');
      setRouteState({ route: 'login' });
      return;
    }
    navigateToAppRoute('panel');
    setRouteState({ route: 'panel' });
  }, [currentUser]);

  const handleLoginSuccess = useCallback((user: UserProfile) => {
    if (user.status !== 'activo') {
      setAuthError('Tu cuenta se encuentra desactivada por administración.');
      return;
    }
    setAuthError(null);
    setCurrentUser(user);
    navigateToAppRoute('panel', { replace: true });
    setRouteState({ route: 'panel' });
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutFromFirebaseAuth().catch(() => {});
    try {
      localStorage.removeItem('minesafe_active_user');
    } catch { /* ignore */ }
    setCurrentUser(null);
    setAuthError(null);
    navigateToAppRoute('landing', { replace: true });
    setRouteState({ route: 'landing' });
  }, []);

  // 1. PORTADA PÚBLICA (/): nunca monta el panel privado ni inicia suscripciones operativas
  if (routeState.route === 'landing') {
    return (
      <PublicLanding
        onGoToLogin={goToLogin}
        onGoToPanel={currentUser ? goToPanel : undefined}
        isAuthenticated={Boolean(currentUser)}
        authenticatedUserName={currentUser?.name}
      />
    );
  }

  // 2. ESPERA DE VERIFICACIÓN SOLO EN RUTAS PRIVADAS (/acceso o /panel)
  if (isAuthChecking) {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-[#334155]">
        <div className="w-9 h-9 rounded-full border-2 border-[#0D9488] border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold text-[#0F172A]">
          Verificando sesión autorizada...
        </p>
        <p className="text-xs text-[#64748B] mt-1">MineSafe · Control de Acceso</p>
      </div>
    );
  }

  // 3. ACCESO PRIVADO (/acceso)
  if (routeState.route === 'login' || !currentUser) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        onBackToLanding={goToLanding}
        externalAuthError={authError}
      />
    );
  }

  // 4. PANEL OPERATIVO AUTENTICADO (/panel): solo se monta con sesión verificada y cuenta activa
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-300">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mb-4" />
          <p className="text-sm font-semibold text-white">Cargando panel operativo MineSafe...</p>
        </div>
      }
    >
      <MineSafePanel
        authenticatedUser={currentUser}
        onSessionUserUpdated={setCurrentUser}
        onLogoutRequest={handleLogout}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    </Suspense>
  );
};

export default RootApp;
