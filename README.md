# MineSafe IoT — Sistema de Monitoreo Ambiental y Seguridad Minera (DS 132)

Plataforma industrial para supervisión atmosférica en faenas subterráneas y a cielo abierto en tiempo real, alineada con las prácticas de monitoreo y trazabilidad del Reglamento de Seguridad Minera (**Decreto Supremo N° 132 / Sernageomin**).

---

## 🚀 Características Principales

- **Telemetría en Tiempo Real e Historial Persistente**: Sincronización continua de canales MQ-2 (`ADC raw`), PM2.5 (`ADC raw`), Temperatura (`°C`) y Humedad (`%`) desde nodos ESP32 en Firebase Realtime Database (`/dispositivos` + `/historial_telemetria`), con detección de pérdida de señal configurable (`gatewayTimeoutSeconds`, por defecto `20s`) y marcado explícito de sensores en falla (`faultFields`).
- **Motor Dinámico de Umbrales (`alertEngine.ts`)**: Evaluación de 3 niveles (`preventivo`, `advertencia`, `critico`), anti-flapping entre lecturas, escalamiento automático con cierre de alertas previas, auto-recuperación y alertas sonoras Web Audio.
- **Actuación de Emergencia y Modo Simulacro DS 132**: Envío de comandos de sirena/baliza hacia RTDB, protocolo de simulacro coordinado y bitácora de evaluación post-simulacro (`/simulacros_bitacora`).
- **Auditoría, Cierre Documentado y Evidencia en Storage**: Cierre de alertas con título de cierre, tipo de resolución, acciones correctivas, adjuntos de evidencia en Firebase Storage (`/adjuntos`) e impresión de reporte formal sin depender de popups (`window.open`).
- **Multi-Organización y RBAC con Firebase Auth**:
  - `SuperAdmin` (Control maestro de ventanas, umbrales, dispositivos registrados y gestión multi-organización).
  - `Admin` (Prevencionistas de riesgos: gestión de alertas, umbrales, sectores y usuarios).
  - `Operador` (Consulta operacional, reconocimiento de alertas y monitoreo de cuadrillas).

---

## 🛠️ Arquitectura y Tecnologías

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, modo Oscuro y Claro.
- **Servidor Web (`server.ts`)**: Express + Vite en puerto `3000`.
- **Proyectos Firebase**:
  - `minefase-fc5f5`: Realtime Database (`dispositivos`, `alertas`, `eventos_umbrales`, `historial_telemetria`, `configuracion_alertas`, `configuracion_plataforma`, `faenas`, `usuarios`, `organizaciones`, `asignaciones`, `bitacora_contingencias`, `adjuntos`), Authentication y Storage.
  - `gen-lang-client-0751389499`: Cloud Firestore (respaldo y reglas definidas en `firestore.rules` y `firebase-blueprint.json`).
- **Nota de Alcance Hardware**: El firmware `.ino` para el microcontrolador físico ESP32 y sus pruebas eléctricas de banco/terreno se gestionan fuera de este repositorio web/backend.

---

## 📦 Instalación y Ejecución Local

1. **Instalar dependencias Node.js**:
   ```bash
   npm install
   ```

2. **Variables de Entorno**:
   Copiar `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

3. **Ejecutar servidor de desarrollo (Express + Vite en puerto 3000)**:
   ```bash
   npm run dev
   ```

4. **Pruebas, Lint y Compilación**:
   ```bash
   npm run test:alerts                 # Pruebas unitarias del motor de umbrales
   npx eslint firestore.rules          # Validación estática de reglas de Firestore
   npm run lint                        # Verificación TypeScript (tsc --noEmit)
   npm run build                       # Compilación de producción
   ```
   Para ejecutar la suite completa de reglas contra Firebase Emulator (`firestore.rules.test.ts`):
   ```bash
   firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
   ```

---

## 🔐 Despliegue Manual Pendiente en Consola Firebase (`minefase-fc5f5`)

Las reglas de Firestore (`firestore.rules`) corresponden al proyecto Firestore del applet (`gen-lang-client-0751389499`). Para endurecer completamente el proyecto `minefase-fc5f5` en producción debes publicar manualmente desde Firebase Console:
1. Las reglas de Realtime Database desde `/database.rules.json`.
2. Las reglas de Firebase Storage para la ruta `/adjuntos` autenticada y con límite de 5 MB (documentadas en `/security_spec.md` y `/SECURITY.md`).
