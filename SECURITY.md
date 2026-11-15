# Política de Seguridad — MineSafe IoT

## Arquitectura de Seguridad

MineSafe implementa controles en capas para proteger la telemetría minera, la bitácora de incidentes DS 132 y la gestión de usuarios:

1. **Autenticación Real (Firebase Authentication)**
   - El acceso a la aplicación web exige sesión activa verificada por Firebase Auth (`subscribeToFirebaseAuth` en `src/services/firebase.ts`).
   - Los privilegios administrativos y de `SuperAdmin` se verifican contra la sesión activa de Firebase Auth y su ficha en RTDB (`/usuarios`), nunca confiando en valores manipulables de `localStorage`.
   - El alta de cuentas desde administración utiliza una instancia secundaria aislada (`createUserAccountByAdmin`) para no alterar la sesión del administrador y permite envío de restablecimiento de contraseña.

2. **Reglas de Base de Datos y Almacenamiento**
   - **Realtime Database (`database.rules.json`)**: Define reglas diferenciadas por ruta (`/dispositivos`, `/usuarios`, `/faenas`, `/alertas`, `/eventos_umbrales`, `/historial_telemetria`, `/configuracion_alertas`, `/configuracion_plataforma`, `/bitacora_contingencias`, `/organizaciones`, `/asignaciones`, `/adjuntos`) y validación estricta de tipos y rangos numéricos en `/dispositivos` (`CO` y `PM2_5` entre `0..4095`, `temperatura` `-40..100`, `humedad` `0..100`).
   - **Cloud Firestore (`firestore.rules`)**: Exige `request.auth != null`, aislamiento por pertenencia o rol (`superadmin`/`admin`/`operador`) y validación de esquema documentada en `firebase-blueprint.json`.
   - **Firebase Storage (`/adjuntos/{alertId}/...`)**: Valida en cliente tipo MIME permitido (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) y tamaño máximo de `5 MB`; requiere publicar reglas equivalentes en la consola de Firebase Storage del proyecto `minefase-fc5f5`.

## Despliegues Externos Requeridos en Producción

- Publicar `database.rules.json` en **Firebase Console → Realtime Database → Reglas** del proyecto `minefase-fc5f5`, una vez que el firmware del ESP32 autentique su escritura hacia `/dispositivos`.
- Publicar las reglas de **Firebase Storage** en `minefase-fc5f5` restringiendo lectura/escritura bajo `/adjuntos` a usuarios autenticados (`request.auth != null`), tamaño `< 5 MB` y MIME de imagen/PDF.

## Reporte de Vulnerabilidades

Si detectas una vulnerabilidad de seguridad en la aplicación web o reglas de Firebase:
1. **No** publiques credenciales, tokens o rutas explotables en issues públicos.
2. Documenta el vector de reproducción, el componente afectado (`src/`, `server.ts`, `database.rules.json` o `firestore.rules`) y el impacto estimado.
3. Notifica al responsable técnico del proyecto para emitir corrección y rotación de credenciales si aplica.
