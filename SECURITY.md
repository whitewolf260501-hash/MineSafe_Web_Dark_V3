# Política de Seguridad — MineSafe IoT

## Arquitectura de Seguridad y Separación Pública/Privada (P013)

MineSafe implementa controles en capas para separar la portada pública informativa de los datos operacionales de faena:

1. **Separación de Superficie Pública (`/` y `/acceso`) vs Panel Privado (`/panel`)**
   - `PublicLanding.tsx` (`/`) no importa SDK de Firebase ni datos operacionales, no inicia listeners de Realtime Database y no expone telemetría ni correos personales.
   - `RootApp.tsx` evalúa el estado real de autenticación (`subscribeToFirebaseAuth`) antes de cargar de forma diferida (`React.lazy`) el módulo privado `App.tsx`.
   - Al cerrar sesión o al detectarse desactivación de la cuenta (`status === 'inactivo'`) en tiempo real, se cancelan las suscripciones activas, se detienen alertas sonoras y se desmonta el panel privado volviendo a `/`.

2. **Autenticación y Control de Registro (Firebase Authentication)**
   - El autorregistro público fue eliminado de la interfaz (`LoginView.tsx` y `LoginModal.tsx`) y bloqueado en `registerWithFirebaseAuth`.
   - `resolveUserProfileFromAuthUser` únicamente autoriza acceso al panel a usuarios autenticados que posean ficha activa (`status !== 'inactivo'`) en `/usuarios` (o el SuperAdmin principal verificado). Cuentas desconocidas o desactivadas son desconectadas automáticamente con error explícito.
   - **Límite técnico sin backend privilegiado (Admin SDK)**: En Firebase Authentication, si **Enable create (sign-up)** se mantiene activo en el proyecto para que un `admin`/`superadmin` pueda crear cuentas desde la app secundaria del navegador (`createUserAccountByAdmin`), un atacante externo con la API key pública del proyecto aún podría invocar el endpoint REST de Firebase Auth para registrar una identidad vacía en Auth. No obstante, esa cuenta **no recibe acceso al panel** ni permisos en RTDB/Firestore porque carece de ficha válida en `/usuarios` y `/users`. Para impedir incluso la creación de cuentas huérfanas en Auth, se debe desactivar **User sign-up** en Firebase Console y gestionar altas desde un backend confiable con Firebase Admin SDK.

3. **Aislamiento de Organizaciones y Jerarquía RBAC**
   - `src/utils/accessControl.ts`, `UsersManagementView.tsx` y `src/services/firebase.ts` validan que un `admin` solo pueda consultar, crear, editar o desactivar cuentas dentro de su propia `organizationId` y nunca pueda asignar o modificar el rol `superadmin`.
   - **Realtime Database (`database.rules.json`)**:
     - Exige `auth != null` y cuenta activa (`status !== 'inactivo'`) en todos los nodos operativos.
     - Bloquea que un usuario no privilegiado sobreescriba su propia ficha en `/usuarios/$userId` para evitar auto-registro o auto-elevación de rol u organización.
     - Aplica aislamiento por `organizationId` en `/dispositivos`, `/usuarios`, `/contratos`, `/asignaciones`, `/alertas` y `/faenas` para usuarios con `organizationId` asignado.
   - **Cloud Firestore (`firestore.rules`)**:
     - Exige `request.auth != null`, correo verificado para escrituras, y **prohíbe el autorregistro en cliente** sobre `/users/{userId}` (`allow create: if isAdmin()`).
   - **Firebase Storage (`/adjuntos/{alertId}/...`)**: Valida en cliente tipo MIME permitido (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) y tamaño máximo de `5 MB`; requiere publicar reglas equivalentes en Firebase Console.

## Despliegues Manuales Pendientes en Producción

Los cambios en `database.rules.json` y `firestore.rules` permanecen locales en el repositorio y **requieren revisión y publicación explícita**:
1. Publicar `database.rules.json` en **Firebase Console → Realtime Database → Reglas** (`minefase-fc5f5`), validando primero que los nodos ESP32 autentiquen sus escrituras a `/dispositivos`.
2. Publicar las reglas de **Firebase Storage** en `minefase-fc5f5` restringiendo `/adjuntos` a usuarios autenticados (`request.auth != null`), tamaño `< 5 MB` y MIME de imagen/PDF.
3. Revisar en **Firebase Console → Authentication → Settings → User actions** la política de registro acorde al flujo administrativo elegido.

## Reporte de Vulnerabilidades

Si detectas una vulnerabilidad de seguridad en la aplicación web o reglas de Firebase:
1. **No** publiques credenciales, tokens o rutas explotables en issues públicos.
2. Documenta el vector de reproducción, el componente afectado (`src/`, `server.ts`, `database.rules.json` o `firestore.rules`) y el impacto estimado.
3. Notifica al responsable técnico del proyecto para emitir corrección y rotación de credenciales si aplica.
