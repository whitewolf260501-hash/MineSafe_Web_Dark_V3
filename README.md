# MineSafe IoT — Plataforma Web y Portada Pública de Monitoreo Ambiental

Plataforma web para monitoreo ambiental IoT enfocada en la pequeña minería en Chile, con separación arquitectónica entre la portada pública informativa (`/`), el acceso privado (`/acceso`) y el panel operativo autenticado (`/panel`).

---

## Arquitectura de Acceso (P013)

- **`/` (`PublicLanding.tsx`)**: Portada pública independiente del panel privado. No abre suscripciones privadas de Firebase ni expone telemetría operacional ni datos personales de usuarios.
- **`/acceso` (`LoginView.tsx`)**: Acceso privado mediante correo electrónico y contraseña con Firebase Authentication, recuperación de contraseña y retorno a la portada. El autorregistro público está deshabilitado en la interfaz y validado en sesión.
- **`/panel` (`App.tsx`, carga diferida vía `RootApp.tsx`)**: Panel operativo montado únicamente cuando existe sesión verificada de Firebase Authentication con ficha activa (`status === 'activo'`) autorizada en `/usuarios`.
- **Compatibilidad con subrutas / despliegue estático**: Cuando la aplicación se despliega bajo una subruta (por ejemplo GitHub Pages `/MineSafe_Web_Dark_V3/`), soporta rutas hash `#/acceso` y `#/panel` para preservar la carga de recursos `./`.

---

## Características del Panel Operativo

- **Telemetría en Tiempo Real e Historial Persistente**: Sincronización de canales MQ-2 (`ADC raw`), PM2.5 (`ADC raw`), Temperatura (`°C`) y Humedad (`%`) desde nodos ESP32 vía Firebase Realtime Database (`/dispositivos` + `/historial_telemetria`), con detección configurable de pérdida de señal (`gatewayTimeoutSeconds`) y marcado de sensores en falla (`faultFields`).
- **Motor Dinámico de Umbrales (`alertEngine.ts`)**: Evaluación de 3 niveles (`preventivo`, `advertencia`, `critico`), anti-flapping entre lecturas, escalamiento automático con cierre de alertas previas, auto-recuperación y alertas sonoras Web Audio.
- **Actuación de Emergencia y Simulacro DS 132**: Comandos de baliza/sirena hacia RTDB, protocolo de simulacro coordinado y bitácora de evaluación (`/simulacros_bitacora`).
- **Auditoría, Cierre Documentado y Evidencia en Storage**: Cierre de alertas con tipo de resolución, acciones correctivas, adjuntos en Firebase Storage (`/adjuntos`) e impresión de reporte formal.
- **Multi-Organización y RBAC**:
  - `SuperAdmin` (administración multi-organización, control de plataforma, umbrales y usuarios).
  - `Admin` (gestión de alertas, umbrales, sectores y usuarios restringida estrictamente a su propia `organizationId`).
  - `Operador` (consulta operacional, reconocimiento de alertas y monitoreo).

---

## Stack Tecnológico

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons.
- **Servidor Web (`server.ts`)**: Express + Vite en puerto `3000` (con fallback SPA para `/`, `/acceso`, `/panel`).
- **Firebase**:
  - `minefase-fc5f5`: Realtime Database, Authentication y Storage.
  - `gen-lang-client-0751389499`: Cloud Firestore (`firestore.rules`, `firebase-blueprint.json`).
- **Nota de Alcance Hardware**: El firmware `.ino` para el microcontrolador físico ESP32 y sus pruebas eléctricas de banco/terreno se gestionan fuera de este repositorio web/backend.

---

## Instalación y Ejecución Local

1. **Instalar dependencias Node.js**:
   ```bash
   npm install
   ```

2. **Variables de Entorno**:
   Copiar `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
   Si el equipo dispone de un correo oficial de contacto confirmado o endpoint seguro de envío, configurar opcionalmente en `.env`:
   ```env
   VITE_PUBLIC_CONTACT_EMAIL="correo@confirmado.cl"
   VITE_PUBLIC_CONTACT_ENDPOINT="https://..."
   ```
   Si no se configuran, la sección **Contacto** de la portada indicará explícitamente que el correo oficial está pendiente de configuración, sin inventar direcciones ni simular envíos.

3. **Ejecutar servidor de desarrollo (Express + Vite en puerto 3000)**:
   ```bash
   npm run dev
   ```

4. **Pruebas, Lint y Compilación**:
   ```bash
   npm test                            # Pruebas unitarias (alertEngine + P013 acceso/portada)
   npx eslint firestore.rules          # Validación estática de reglas de Firestore
   npm run lint                        # Verificación TypeScript (tsc --noEmit)
   npm run build                       # Compilación de producción en dist/
   ```
   Para ejecutar la suite de reglas contra Firebase Emulator (`firestore.rules.test.ts`):
   ```bash
   firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
   ```

---

## Despliegue Manual Pendiente en Consola Firebase

Los archivos locales `/database.rules.json` y `/firestore.rules` fueron endurecidos para bloquear lectura/escritura anónima, cuentas inactivas, autorregistro en cliente y cruces entre organizaciones, pero **no han sido publicados automáticamente** a Firebase sin autorización explícita:
1. Revisar y publicar `/database.rules.json` en **Firebase Console → Realtime Database → Reglas** (`minefase-fc5f5`) verificando que el firmware ESP32 autentique sus escrituras.
2. Revisar y publicar las reglas de **Firebase Storage** restringiendo `/adjuntos` a usuarios autenticados (`request.auth != null`), máximo `5 MB` y MIME permitido.
3. En **Firebase Console → Authentication → Settings → User actions**, deshabilitar el registro público si corresponde a la operación administrativa (manteniendo habilitado el inicio de sesión).
