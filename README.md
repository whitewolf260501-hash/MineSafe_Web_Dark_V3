# MineSafe IoT — Sistema de Monitoreo Ambiental y Seguridad Minera (DS 132)

Plataforma industrial para supervisión atmosférica en faenas subterráneas y a cielo abierto en tiempo real. Diseñada según los estándares del Reglamento de Seguridad Minera (**Decreto Supremo N° 132 / Sernageomin**).

---

## 🚀 Características Principales

- **Telemetría en Tiempo Real**: Sincronización continua de variables críticas (Monóxido de Carbono MQ-2, Polvo en Suspensión PM2.5, Temperatura, Humedad y Gases Explosivos).
- **Integración con Gateway ESP32**: Conexión directa mediante Firebase Realtime Database con nodos de sensores en terreno.
- **Actuación de Emergencia Físico-Virtual**: Disparo coordinado de alarma sonora (buzzer), baliza LED estroboscópica y conmutación de mangas de ventilación.
- **Modo Simulacro Minero DS 132**: Permite a SuperAdmins y Prevencionistas simular incidentes críticos (fuga de gas, incendios o evacuación general) con activación simultánea de sirenas y balizas en el hardware sin interrumpir faena real.
- **Control de Acceso Basado en Roles (RBAC)**:
  - `SuperAdmin` (Control total y auditoría).
  - `Admin` (Prevencionistas de riesgos / Sernageomin).
  - `Operador` (Personal de cuadrilla en faena).
- **Gestión de Cuadrillas y Equipos**: Arriendo y asignación de detectores de gases portátiles por sector y turno.
- **Historial y Reportes**: Exportación de bitácoras de incidentes y niveles de exposición para auditorías oficiales.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons.
- **Build Tool**: Vite.
- **Backend / Realtime**: Firebase Realtime Database & Cloud Firestore.
- **Hardware / IoT**: ESP32 WiFi/LoRa Gateway con sensores MQ-2, PM2.5 y actuadores.

---

## 📦 Instalación y Ejecución Local

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   cd TU_REPOSITORIO
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Variables de Entorno**:
   Copiar `.env.example` a `.env` y configurar las credenciales de Firebase en caso de usar un proyecto propio:
   ```bash
   cp .env.example .env
   ```

4. **Ejecutar servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   Abrir `http://localhost:3000` en tu navegador.

5. **Compilar para producción**:
   ```bash
   npm run build
   ```

---

## 📜 Licencia y Normativa
Diseñado en cumplimiento con la normativa chilena de seguridad minera **DS 132** y directrices técnicas de Sernageomin.
