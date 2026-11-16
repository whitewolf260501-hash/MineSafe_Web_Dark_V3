# P013 — Portada pública y acceso de organizaciones a MineSafe

- **Agente** — Codex
- **Fecha** — 15 de noviembre de 2026
- **Afecta a** — Primera pantalla web, presentación del producto y flujo de acceso
- **Base** — [Estado de funciones P012](P012_Codex_estado_funciones_web_tras_P011.md) y [web actual en `e0c846a`](https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/commit/e0c846affc318d680ab90a35e3be42b8d73e2f21).

## Resumen

La primera pantalla de MineSafe debe responder qué es, para quién sirve y cómo contactar al equipo. El panel de monitoreo se abre desde **Iniciar sesión**. Para el uso propuesto por empresas y faenas, recomiendo **cuentas asignadas por un responsable o invitaciones**, con organización y rol definidos antes de entrar al panel.

## Detalle

### Contenido de la portada

| Bloque | Contenido para la página | Acción o recurso |
|---|---|---|
| Encabezado | Logotipo MineSafe · Producto · Cómo funciona · Quiénes somos · Contacto. | **Iniciar sesión** abre el acceso al panel. En móvil, mantener el acceso fácil de encontrar. |
| Portada | **Monitoreo ambiental IoT para la pequeña minería.** «MineSafe es un prototipo que reúne lecturas ambientales, umbrales configurables y revisión de eventos en una plataforma web para equipos de faena». | Botón principal **Contactar al equipo**. Enlace secundario **Conocer el producto**. Foto propia y autorizada del nodo o del montaje. |
| Nuestro producto | Tres piezas en lenguaje simple. **Nodo ambiental** para capturar señales. **Gateway** para concentrar y enviar datos. **Plataforma web** para revisar lecturas, umbrales y registros de alarma. | Una imagen por bloque si hay material propio. Para la web, una captura con datos de demostración claramente identificados. |
| Cómo funciona | «El nodo toma la lectura. El gateway la envía. La plataforma muestra el estado del dispositivo y permite revisar eventos». | Una secuencia breve con imagen o diagrama propio. Evitar detalles de red o identificadores internos. |
| Quiénes somos | «Somos un equipo de estudiantes de Ingeniería en Informática que desarrolla MineSafe como proyecto de título en Chile. Nuestro foco está en la pequeña minería y en hacer más fácil la consulta de datos ambientales en faena». | Agregar nombres, funciones y foto del equipo cuando confirmen que se pueden publicar. Si se menciona la institución, presentarla como contexto académico del proyecto. |
| Contacto | «¿Quieres conocer el prototipo o conversar sobre un caso de monitoreo? Escríbenos». | Publicar un correo de equipo confirmado. Si acuerdan recibir solicitudes de demostración, usar **Solicitar demostración**. Partir con enlace al correo. Si implementan formulario, limitarlo a nombre, organización, correo y mensaje, con confirmación de envío. |
| Pie de página | MineSafe · Proyecto de título · Contacto. | Incluir acceso al panel o nota sobre tratamiento de datos si la página recoge información mediante formulario. |

### Dirección visual

- Dar prioridad a la foto real del prototipo y al mensaje de una línea. Usar azul grafito para la cabecera, fondo claro para las secciones informativas y un acento turquesa que se lea bien. Reutilizar el logotipo y colores de MineSafe cuando estén disponibles.
- En escritorio, poner el título y las acciones junto a la foto. En móvil, mostrar primero el mensaje y los botones y luego la imagen. Usar texto legible, navegación con teclado y foco visible en los enlaces.
- Elegir una captura pública a partir de la vista de temperatura y humedad, con datos de demostración y sin nombres, RUT, teléfonos, IP, identificadores o datos de una faena real. El sitio de presentación puede mostrarse sin iniciar sesión.
- Presentar capacidades con el nivel de evidencia de P012. Evitar promesas de certificación, cumplimiento normativo, concentraciones calibradas, respuesta garantizada o funciones físicas que el equipo aún no ha demostrado.

### Acceso al panel y alta de cuentas

| Persona | Qué debe poder hacer |
|---|---|
| Visitante | Leer la portada y contactar al equipo. Su consulta no crea una cuenta ni da acceso a telemetría. |
| Operador con cuenta | Pulsar **Iniciar sesión**, ingresar con su correo y contraseña y abrir las vistas permitidas de su organización. Puede usar **Recuperar contraseña**. |
| Responsable autorizado | Crear o invitar a una persona, asociarla a su organización y asignar su rol. El destinatario activa el acceso o establece su propia contraseña. |
| Usuario dado de baja | Pierde acceso al panel y a sus datos por las reglas aplicables. Los registros operacionales que deban conservarse siguen asociados a su identidad. |

**El botón «Registrarse» puede salir del acceso público.** Para una demo académica, el equipo puede dar de alta las cuentas por un medio administrativo autorizado y vincular sus perfiles antes de la presentación. Si se requiere que el administrador invite desde el panel, ese alta debe pasar por un servicio autorizado que valide quién invita, para qué organización y con qué rol. El correo de activación o recuperación permite que el invitado defina su contraseña.

**Dependencia del código actual.** El formulario público y el llamado «alta administrativa» usan creación de cuentas desde el cliente. Si mantienen Firebase Auth, quitar la opción de registro de la interfaz y cerrar el alta pública en el proveedor son cambios distintos. Antes de deshabilitar el alta de usuarios finales, reemplazar o retirar el alta administrativa cliente para que un responsable conserve un camino autorizado. La creación por consola puede ser suficiente para el prototipo. Una gestión desde el panel requiere un backend autorizado o un mecanismo equivalente, con sus credenciales fuera del navegador. [Registro público actual](https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/e0c846affc318d680ab90a35e3be42b8d73e2f21/src/components/LoginModal.tsx#L132-L164) · [Alta administrativa actual](https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/e0c846affc318d680ab90a35e3be42b8d73e2f21/src/services/firebase.ts#L549-L605) · [Configuración de autoservicio](https://firebase.google.com/docs/auth/users#user_self-service) · [Gestión de usuarios desde servidor](https://firebase.google.com/docs/auth/admin/manage-users)

### Cómo llevarlo a la aplicación que ya tienen

| Orden | Trabajo propuesto | Criterio de aceptación |
|---|---|---|
| 1 | Crear `PublicLanding` como vista separada y hacer que `src/main.tsx` monte una raíz que elija portada o acceso/panel. La entrada pública abre sin montar el componente operativo ni inicializar sus conexiones de datos. Reutilizar el panel de `App.tsx` para la zona autenticada. | Al abrir la URL raíz sin sesión aparecen producto, equipo y contacto. La portada no inicia suscripciones de telemetría, usuarios, contratos o alertas. [Entrada actual](https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/e0c846affc318d680ab90a35e3be42b8d73e2f21/src/main.tsx#L1-L10) · [Suscripciones actuales](https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/e0c846affc318d680ab90a35e3be42b8d73e2f21/src/App.tsx#L196-L248) |
| 2 | Conectar **Iniciar sesión** a una vista de acceso con correo, contraseña y recuperación. La zona operativa espera la confirmación de la sesión antes de montar sus lecturas. Al salir, limpiar el estado del panel y volver a la portada. | Entrar directamente a una vista privada sin sesión lleva al acceso. Una cuenta habilitada entra al panel. Salir vuelve a la portada. [Acceso actual](https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/e0c846affc318d680ab90a35e3be42b8d73e2f21/src/App.tsx#L1364-L1392) · [Conexiones operativas](https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/e0c846affc318d680ab90a35e3be42b8d73e2f21/src/App.tsx#L344-L379) |
| 3 | Elegir navegación según el despliegue. Si el host es estático y no resuelve rutas internas, usar rutas con fragmento, por ejemplo `/#/acceso` y `/#/panel`. Si Express sirve la web y tiene configurado el retorno a la aplicación, pueden usarse `/acceso` y `/panel`. Definirlo con la URL que realmente publicarán. | Abrir o recargar un enlace directo conserva la navegación y la base del proyecto. [Servidor actual](https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/e0c846affc318d680ab90a35e3be42b8d73e2f21/server.ts#L23-L41) |
| 4 | Retirar del acceso público la pestaña y ruta de autorregistro. Mantener recuperación, y preservar un proceso autorizado de alta para el administrador. Proteger los permisos de lectura y escritura en las reglas, incluidos organización y estado de cuenta. | El visitante no puede obtener una cuenta por el flujo público. El responsable da acceso al usuario autorizado. El usuario accede solo a su ámbito. |
| 5 | Preparar recursos para el sitio público. Mantener en el área privada los datos operativos y excluir de la publicación capturas con datos personales, llaves, configuraciones privadas o documentación interna que no haga falta exponer. | La portada y los recursos publicados contienen solo materiales aprobados para visitantes. El contacto funciona en escritorio y móvil. |

### Referencias de sitios públicos

- **Blackline Safety** usa una portada de producto con una acción de demostración. **Blackline Live** explica para qué sirve el software y dirige a cuentas asociadas a sus clientes. Para MineSafe, tomar la separación entre contacto comercial y acceso operativo. [Portada pública](https://www.blacklinesafety.com/) · [Blackline Live](https://www.blacklinesafety.com/solutions/software/blackline-live)
- **Trolex** combina fotos propias de instrumentos, categorías de producto y un canal de consulta comercial. Para MineSafe, tomar la idea de mostrar el montaje y la plataforma como partes visibles del mismo producto. [Catálogo oficial de Trolex](https://trolex.com/products/)
- **Industrial Scientific** tiene un proceso específico de alta de iNet que identifica a un responsable de la organización. Para MineSafe, tomar la idea de que el acceso se activa con un contacto autorizado. [Alta de cuenta iNet](https://www.indsci.com/activatedsx)

## Pendientes y dudas

- **PENDIENTE: correo de contacto aprobado** y persona responsable de responder.
- **PENDIENTE: fotos, nombres y materiales aprobados** para publicar.
- **PENDIENTE: quién administrará las cuentas y dónde se publicará la web.** Para el prototipo, comenzar con alta administrada y login. Agregar invitaciones dentro del panel si el equipo necesita delegar la gestión.

## Decisión del grupo

- [ ] Aceptada
- [ ] Aceptada con cambios
- [ ] Rechazada

