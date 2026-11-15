# P002 — Informe de estudio del código MineSafe

- **Agente** — Codex
- **Fecha** — 14 de noviembre de 2026
- **Tarea** — T01, ficha técnica del repositorio y preparación de defensa
- **Afecta a** — informe, manuales y defensa oral
- **Versión revisada** — [commit `4a976cc`][commit], *Improve per-user Equipos y Arriendos sub-window lock visibility in Control Maestro*
- **Informe de referencia** — `MineSafe_ProyectoTitulo_2026_14-11-26_18-41.md`, copia vigente indicada en `ESTADO_ACTUAL.md`. Las líneas del informe se refieren a esa copia de texto.

## Resumen

MineSafe es un prototipo de monitoreo ambiental para pequeña minería. Su web React recibe lecturas de Firebase Realtime Database (RTDB), muestra el estado del dispositivo y evalúa umbrales configurables. La arquitectura del informe describe un nodo ESP32 que transmite por ESP-NOW a un gateway y un gateway que publica hacia Firebase por Wi-Fi. En el repositorio web se puede seguir el flujo desde RTDB. La comprobación del tramo físico requiere el firmware y una prueba con el montaje.

Para una respuesta oral de 30 segundos, el equipo puede decir: «El nodo toma las mediciones y el gateway las lleva a la nube. La web escucha los cambios en Firebase y evalúa las lecturas de los dispositivos visibles. Si una variable alcanza un umbral, registra el evento y puede emitir un aviso. El repositorio también contiene una API experimental que analiza series históricas que se le entregan, con un flujo propio». [Suscripción de dispositivos][listener] · [Motor web][engine] · [API de análisis][api-readme]

## Detalle

### 1. Mapa del código y arquitectura

| Componente | Responsabilidad y punto de entrada | Fuente |
|---|---|---|
| Node.js, Vite y React | Vite sirve y empaqueta la aplicación. Su configuración sustituye la entrada HTML por `src/main.tsx`, que monta `App`. React maneja las vistas y TypeScript tipa los datos. Tailwind define estilos. | [package.json][pkg] · [vite.config.ts][vite] · [main.tsx][entry] |
| Aplicación React | `App.tsx` mantiene sesión, dispositivo seleccionado, telemetría, alertas, simulacros y navegación. `src/components/` contiene el panel, monitoreo, gateway, alertas, reportes, faenas, usuarios, equipos y Control Maestro. | [Estado y suscripciones][app-start] · [Componentes][components] |
| Firebase Authentication | Inicio con correo y contraseña o Google. La app escucha la sesión con `onAuthStateChanged` y resuelve el perfil de RTDB para obtener rol y estado. | [Resolución de perfil][profile] · [Login y sesión][auth] |
| Firebase Realtime Database | La web se conecta directamente mediante el SDK. Escucha dispositivos, usuarios, contratos, simulacros y configuración. También escribe eventos, cambios y órdenes que el hardware podría consumir. | [Inicialización Firebase][firebase-init] · [App.tsx][app-start] · [Comandos][commands] |
| Cloud Firestore y Storage | El servicio inicializa Firestore en una segunda aplicación Firebase. El flujo operativo revisado usa RTDB. El campo `storageBucket` de la configuración no implica una integración de carga de archivos. | [Inicialización Firebase][firebase-init] · [Servicio Firebase][firebase] |
| Nodo y gateway ESP32 | El informe atribuye la adquisición y alertas locales al nodo, el salto local a ESP-NOW y la subida del gateway a Wi-Fi. El código web permite comprobar el contrato con RTDB y sus campos. | Informe vigente, líneas 1047–1062 y 1107–1110 · [Lectura RTDB][mapper] · [Comandos][commands] |
| API `minesafe-ai/` | Servicio Python/FastAPI separado. Recibe una serie por HTTP, devuelve tendencias y anomalías. En este commit la web no llama a la API y la API no consulta Firebase. | [Main de la API][ai-main] · [Algoritmo][ai-analyze] · [Integración pendiente][api-readme] |
| Publicación web | La carpeta docs/ contiene la versión compilada de la plataforma web. | [Sitio compilado][docs] |

### 2. Cómo seguir una lectura hasta la pantalla

1. **Adquisición y envío.** En el diseño del informe el nodo mide temperatura, humedad, señal de material particulado y señal de gases. Envía al gateway por ESP-NOW. El gateway sube por Wi-Fi. La interfaz web espera valores como `CO`, `PM2_5`, `temperatura`, `humedad` y `last_update_server` bajo `dispositivos/{id}`. **PENDIENTE: cotejar el contrato contra el firmware y un registro real de una sesión de prueba.** Informe vigente, líneas 1047–1063. [Mapeo de telemetría][mapper]
2. **Recepción en el navegador.** `subscribeToRTDBDevices()` instala `onValue` en `dispositivos`. En cada snapshot transforma las entradas con `mapRTDBDeviceToSensorDevice()`. Este acepta alias y números en texto, aplica valores de respaldo y normaliza marcas de tiempo. El criterio escrito de conexión usa 20 segundos desde la hora reportada o la llegada registrada. La suscripción marca como recién llegadas todas las entradas del snapshot, incluso si cambió un solo dispositivo. Tampoco recalcula el estado global por el mero paso del tiempo. Para defender detección fiable de cortes hay que medirla. [Suscripción][listener] · [Mapeo y conexión][mapper]
3. **Selección y visualización.** `App` actualiza `devices`, combina telemetría con el registro de Control Maestro y calcula `visibleDevices`. También obtiene el dispositivo seleccionado y prepara las variables del panel. Hay valores iniciales y de ejemplo. Campos como CO₂, CH₄, O₂, ruido y flujo de aire aparecen como constantes en el mapeador. En la demostración conviene seguir los cuatro campos realmente consumidos desde RTDB. [Selección y panel][app-visible] · [Valores del mapeador][mapper]
4. **Evaluación y registro.** Un efecto de `App.tsx` llama a `alertEngine.processAllDevices(visibleDevices)`. El motor compara cada variable y produce un evento activo al primer cruce o al escalar. El servicio escribe en `eventos_umbrales`. Advertencia y crítico también pasan por `broadcastAlertToRTDB()`. La vista de configuración se suscribe al historial de `eventos_umbrales`. La lista principal `AlertsView` recibe `alerts` de `App`, inicializado con ejemplos, y añade una auditoría de alarmas del dispositivo. El padre no se suscribe a `/alertas` para poblar esa lista principal. [Efecto en App][app-engine] · [Motor][engine] · [Escritura][event-write] · [Vista de eventos][threshold-view] · [Listado y auditoría][alerts-view]
5. **Camino de vuelta.** La web puede escribir comandos de pausa, reanudación o ping, y cambios de alarma, luz o simulacro en RTDB. Esto demuestra la emisión de la orden desde la web. **PENDIENTE: demostrar que el gateway la recibe, que el nodo la aplica y que existe confirmación física o una respuesta verificable.** [Órdenes RTDB][commands] · [Simulacro][drill]

### 3. Motor de alertas y demostración en pizarra

La precedencia es configuración específica del dispositivo, luego global. `processDeviceTelemetry()` también permite pasar una configuración explícita. Los valores iniciales proceden de `DEFAULT_GLOBAL_THRESHOLDS`. El editor guarda los cambios por ámbito en RTDB y valida el orden de los tres umbrales cuando la variable está activa. La suscripción que instala las configuraciones de RTDB en el motor vive en `AlertConfigurationView`. `App` ejecuta la evaluación, pero no instala allí esa suscripción. En una sesión que jamás abre esa vista, el motor arranca con valores del código. Cambiar una configuración tampoco dispara por sí solo el efecto de evaluación dependiente de `visibleDevices`. [Motor][engine] · [Valores de fábrica][defaults] · [Guardado][threshold-save] · [Carga de configuraciones][threshold-view] · [Montaje de vistas][app-tabs]

| Variable | Preventivo | Advertencia | Crítico | Unidad que utiliza el motor |
|---|---:|---:|---:|---|
| Material particulado, `pm25` | 350 | 750 | 1200 | ADC crudo |
| Señal del MQ-2, `mq2` | 300 | 800 | 1200 | ADC crudo |
| Temperatura | 26 | 32 | 38 | °C |
| Humedad relativa | 70 | 80 | 90 | % |

Son valores iniciales de ejemplo del código. No hay una conversión calibrada que permita usar los números crudos de gas y polvo como ppm o µg/m³. Un valor igual al límite ya alcanza ese nivel. El motor prueba primero `crítico`, luego `advertencia` y luego `preventivo`. Por debajo del preventivo queda en `normal`. Omite variables inactivas o no numéricas. Si el dispositivo está marcado como desconectado o sin conexión, corta la evaluación antes de comparar. [Valores de fábrica][defaults] · [Comparaciones y filtro][engine] · [Límites del análisis][api-readme]

| Temperatura del ejemplo | Resultado con valores iniciales |
|---:|---|
| 23 °C | Normal, sin evento |
| 28 °C | Evento preventivo, sin audio automático del motor |
| 29 °C | Persiste el preventivo y se actualiza el último valor en memoria |
| 34 °C | Evento nuevo por escalamiento a advertencia, con audio si está habilitado |
| 40 °C | Evento nuevo por escalamiento a crítico, con audio si está habilitado |
| 22 °C | Vuelta a normal. El evento que quedó asociado al incidente se marca recuperado |

La deduplicación usa un mapa en memoria con clave dispositivo y variable. Recargar la página o abrir otro cliente crea otra memoria. Escalar genera otro ID y reemplaza el que guarda el mapa, por lo que al recuperar se actualiza el último evento. Las pruebas comprueban esa lógica con telemetría ficticia. El sonido web usa Web Audio y puede depender de que el usuario haya interactuado con la página. [Motor][engine] · [Audio][audio] · [Pruebas][tests]

**Si dos pantallas muestran estados distintos.** Hay tres comparaciones. El mapeador de estado usa gas/polvo desde 350/55 para advertencia y 500/150 para crítico. El banner de emergencia usa otros parámetros de Control Maestro, 1000/500 por defecto, para el dispositivo activo considerado en línea. El motor de eventos usa la tabla de cuatro variables de esta sección. El comentario del banner habla de 15 segundos. La bandera `gatewayOnline` que consume se calcula en el mapeador con 20 segundos. [Mapeador][mapper] · [Banner][banner] · [Parámetros de emergencia][master-metrics]

**Simulacro.** La web contiene casos de gas, incendio/polvo y evacuación. Cambia el estado visual, activa audio, incorpora una alerta de ejercicio y publica el simulacro en RTDB. La finalización exige verificación de SuperAdmin en el manejador web. La ventilación forzada que ofrece la web cambia el estado de un sector en React. **PENDIENTE: validar con el montaje qué órdenes llegan a la baliza y al buzzer, y si existe algún actuador de ventilación realmente conectado.** [Inicio y cierre][drill] · [Difusión RTDB][broadcast] · [Ventilación en la vista][ventilation]

### 4. Roles, permisos y alcance de la seguridad

| Rol | Qué permite la interfaz por defecto | Qué respalda el código |
|---|---|---|
| Operador | Panel, monitoreo, alertas, reportes y faenas. Configuración de umbrales, equipos y usuarios quedan ocultos por defecto. | Permisos de navegación con ajustes por rol, usuario o correo. [Control Maestro][roles] |
| Administrador | Agrega acceso a umbrales, equipos y usuarios. La vista de usuarios protege al SuperAdmin frente a modificaciones administrativas. | `saveThresholdConfig` valida el rol en el cliente. La gestión de usuarios aplica reglas adicionales en RTDB. El filtro por organización requerido en el informe no está implementado. [Permisos][roles] · [Usuarios][user-ui] · [Umbrales][threshold-save] · [Reglas RTDB][rules] |
| Superadministrador | Control Maestro, registro de equipos, ajustes de visibilidad y funciones de cierre o apagado reservadas. | La configuración maestra tiene controles de SuperAdmin en la web y en RTDB. Los comandos de apagado se revisan además desde `verifySuperAdminPrivileges()`. [Control Maestro][master] · [Verificación][verify-super] · [Reglas RTDB][rules] |

**Autenticación y autorización.** Firebase Auth identifica la cuenta. El perfil y Control Maestro determinan qué se muestra o se habilita en React. Las reglas de Firebase son la capa que puede impedir lecturas o escrituras fuera de la interfaz. En el archivo de RTDB, usuarios y dispositivos tienen lectura pública, y hay permisos amplios en alertas, simulacros, emergencias y umbrales. Los contratos exigen autenticación para leer y una condición de administración para escribir. El archivo de Firestore permite lectura y escritura de las colecciones listadas. Por eso RNF-10 a RNF-12 y el aislamiento multiempresa no se pueden declarar cumplidos. **PENDIENTE: obtener las reglas efectivamente desplegadas en el entorno de la demostración y validarlas en un proyecto de prueba.** [Reglas RTDB][rules] · [Reglas Firestore][fs-rules] · [Perfil y sesión][profile]

### 5. Qué hace el servicio llamado «IA»

`POST /v1/analyze` recibe un dispositivo y un conjunto de observaciones con marcas de tiempo únicas y zona horaria. Requiere una clave Bearer de la configuración del servicio. `GET /health` comprueba el proceso y `GET /` redirige a `/docs`. El análisis usa cinco observaciones como mínimo por defecto. Ordena por tiempo, descarta valores no finitos por métrica y calcula una regresión lineal simple, con pendiente por hora. Para detectar valores atípicos compara contra la mediana con la desviación absoluta mediana (MAD). El criterio es `abs(0.6745 × (valor - mediana) / MAD) >= 3.5`. Si MAD es cero no emite anomalías para esa métrica. El código de cálculo usa Python estándar aunque NumPy figure en las dependencias. [Endpoints][ai-main] · [Configuración][ai-config] · [Esquema][ai-schema] · [Cálculo][ai-analyze]

En una defensa es correcto decir «identifica valores atípicos dentro de una ventana y estima la dirección de una tendencia». Para afirmar predicción de incidentes, calibración física o integración con Firebase harían falta otras pruebas. FastAPI no gobierna actuadores ni participa en la ruta de alertas de React. El README de la API deja esas integraciones como pendientes. [Límites del servicio][api-readme]

### 6. Qué cubren las pruebas del repositorio

La prueba del motor sigue una secuencia de mediciones de ejemplo y sirve para estudiar el resultado esperado en cada estado. Sus comprobaciones cubren normal, preventivo, escalamiento, recuperación, deduplicación, desconexión y varias variables a la vez. El archivo llama al motor real, que intenta persistir eventos de forma asíncrona, y el proceso termina tras las aserciones. El resultado de esas aserciones no mide la entrega de Firebase ni el comportamiento físico. Las seis pruebas Python cubren tendencia y ventana, zona horaria, autenticación HTTP, salud, redirección y análisis autenticado. No ejercitan el prototipo de extremo a extremo. [Prueba web][tests] · [Pruebas API][ai-tests]

### 7. Contraste con el informe y con el README

#### Seguimiento de P004, sección 4

| Fila | Resultado de la revisión |
|---|---|
| 4.1 · API y Express | Confirmado para el camino de datos web–Firebase: el SDK conecta directamente. Existe FastAPI por separado, sin llamada desde `src/`. Express está declarado como dependencia. El código fuente usa el servidor de Vite para desarrollo y carece de un servidor Express operativo. [Dependencias][pkg] · [Vite][vite] · [Inicialización][firebase-init] · [API][ai-main] |
| 4.2 · Android | **Descartado para la entrega y la defensa**, según confirmó el equipo. El APK sigue en el commit revisado como archivo del repositorio. La interfaz que se presenta es la plataforma web. [APK en el repositorio][apk] |
| 4.3 · Simulacro y análisis | Simulacro comprobado en la web y difusión en RTDB. Análisis estadístico comprobado como servicio aparte. Alcance físico y conexión entre la web y el servicio requieren evidencia adicional. [Simulacro][drill] · [Difusión][broadcast] · [API][ai-main] |
| 4.4 · Organizaciones | Hay faenas, sectores, nombres de ubicación y un registro de dispositivos. La vista inicial parte de datos de ejemplo y el alta visible de faena modifica el estado de React. No se encuentra alta persistente de organizaciones ni un modelo con membresías y reglas de aislamiento. [Faenas][site-state] · [Vista de sectores][sites-view] · [Reglas][rules] |
| 4.5 · Lenguaje | La aplicación fuente es TypeScript y TSX, compila a JavaScript y declara React 19. El componente de análisis es Python. [Entrada web][entry] · [Dependencias][pkg] · [Cálculo][ai-analyze] |

#### Otras diferencias que conviene aclarar en la defensa

| Afirmación o etiqueta | Evidencia disponible |
|---|---|
| «React 18» | `package.json` declara React 19. [README][readme] · [package.json][pkg] |
| «Gateway Wi-Fi/LoRa» | El informe describe ESP-NOW y Wi-Fi. LoRa/LoRaWAN aparece en textos de la interfaz y del README. El repositorio web no aporta firmware para confirmar el protocolo de campo. [README][readme] · [Vista de sectores][sites-view] |
| «Monóxido de carbono MQ-2» y PM2.5 en unidades físicas | El motor usa valores crudos y algunos textos de tarjetas, reportes o simulacros muestran unidades físicas. Este código carece de una calibración validada y específica para convertir esas señales. [Umbrales][defaults] · [Mapeo][mapper] · [Simulacro][drill] · [Límites][api-readme] |
| «Disparo coordinado y ventilación física» | Se ven cambios de estado y escrituras en RTDB para alarmas, luces y simulacros. El botón de ventilación cambia estado en React. La activación física queda por comprobar. [Comandos][commands] · [Difusión][broadcast] · [Ventilación][ventilation] |
| «Historial y reportes de exposición para auditorías oficiales» | Hay exportación CSV de series del cliente y exportación de registros de alarma del dispositivo. `App` construye cinco puntos con horas fijas usando la lectura actual, ajustes aritméticos o constantes. El gráfico y el CSV consumen esa serie. El selector de rango cambia la interfaz y el nombre de archivo, sin filtrar los puntos. Cuando faltan puntos, la vista repite el valor con etiquetas de respaldo. [Construcción de la serie][history-app] · [Reporte CSV][reports] · [Registro del gateway][gateway-csv] |
| «Variables preparadas para Firebase propio y proxy seguro `/api/ai`» | La plantilla describe opciones que no usa la aplicación para cambiar la conexión. Vite tampoco registra ese proxy. [Plantilla][env] · [Firebase][firebase-init] · [Vite][vite] |
| «Cumplimiento DS 132» | El README lo afirma. La revisión de código acredita funciones del prototipo, no certificación, medición válida de exposición ni cobertura de exigencias operacionales. El propio informe limita el uso del prototipo y el README de FastAPI excluye umbrales normativos. [README][readme] · [Límites del servicio][api-readme] |

### 8. Trazabilidad de los requisitos del informe vigente

**Cumple** indica que se encontró la capacidad de software descrita. **Parcial** indica que existe una parte concreta del requisito. **No cumple en la versión revisada** indica una capacidad ausente o contradicha por el código. **PENDIENTE** indica que hace falta firmware, acceso controlado o evidencia experimental para resolver el veredicto. Las categorías de código no equivalen a una prueba de aceptación. La fuente de los identificadores es el informe vigente, líneas 1010–1165.

#### Funcionales

| RF | Resultado | Evidencia y límite |
|---|---|---|
| 01 · Iniciar sesión | Cumple | Login con Firebase Auth, por correo y contraseña o Google. [Auth][auth] |
| 02 · Diferenciar roles | Cumple | Mapea los perfiles a operador, admin y superadmin. [Perfil][profile] |
| 03 · Restringir funciones y datos | Parcial | Navegación por permisos y reglas en algunas rutas. Las reglas de datos son más amplias que la interfaz. [Roles][roles] · [RTDB][rules] |
| 04 · Administrar usuarios de la organización | Parcial | Existe gestión de perfiles, con cambio de estado. Falta delimitación por organización. Crear un perfil RTDB desde administración no equivale a provisionar credenciales Auth. [Usuarios][user-ui] · [Alta web][site-state] · [Auth][auth] |
| 05 · Administración global de organizaciones y admins | Parcial | Control Maestro y gestión de perfiles administrativos. PENDIENTE: gestión de organizaciones, ausente en la versión revisada. [Control Maestro][master] · [Perfil][profile] |
| 06 · Desactivar cuenta y conservar datos | Parcial | Guarda estado del perfil y lo consulta al resolver la sesión. PENDIENTE: verificar efecto inmediato en sesiones ya abiertas y permisos de datos de la cuenta desactivada. [Usuarios][user-ui] · [Perfil][profile] · [Actualización de perfiles][app-start] |
| 07 · Alta de organizaciones | No cumple en la versión revisada | La función de alta visible agrega faenas al estado local de React. [Alta de faena][site-state] |
| 08 · Organización con una o más faenas | No cumple en la versión revisada | El modelo de faenas de la web carece de asociación con una organización. [Alta de faena][site-state] · [Vista][sites-view] |
| 09 · Faena con zonas | Parcial | Una faena contiene sectores para la interfaz. Parte de datos de ejemplo y el alta local no prueba persistencia. [Estado][app-start] · [Vista][sites-view] |
| 10 · Zona con dispositivos | Parcial | Hay nombre de sector y configuración del dispositivo. Falta asociación persistente a una entidad zona dentro de la jerarquía del informe. [Registro][master] · [Mapeador][mapper] |
| 11 · Aislar organizaciones | No cumple en la versión revisada | Las estructuras y reglas versionadas carecen de ámbito por organización. [RTDB][rules] · [Firestore][fs-rules] |
| 12 · Registrar dispositivo único | Cumple | Control Maestro comprueba el ID contra el registro y guarda la configuración. El identificador corresponde a la clave usada en RTDB. [Registro][master] · [Persistencia][reg-save] |
| 13 · Asociarlo a organización, faena y zona | Parcial | Se guarda el sector como nombre y se puede asociar a un gateway. Falta la jerarquía completa. [Registro][master] |
| 14 · Editar datos administrativos o ubicación | Cumple | Formulario de edición de nombre, sector y otros campos de registro. [Registro][master] · [Persistencia][reg-save] |
| 15 · Deshabilitar o eliminar | Parcial | Puede deshabilitar o quitar una entrada del registro. El efecto de visibilidad depende del modo de dispositivos registrados. Falta confirmar la eliminación de telemetría y la deshabilitación física. [Registro][master] · [Filtro de dispositivos][app-visible] |
| 16 · Mostrar conexión | Parcial | Hay estado conectado o desconectado con un criterio de 20 s. Puede quedar obsoleto o renovarse por snapshots de otros equipos. [Mapeador][mapper] · [Suscripción][listener] |
| 17 · Adquirir temperatura | PENDIENTE | La web consume el campo. Se requiere código o prueba de la adquisición periódica en el nodo. [Mapeo][mapper] |
| 18 · Adquirir humedad | PENDIENTE | La web consume el campo. Se requiere código o prueba de la periodicidad en el nodo. [Mapeo][mapper] |
| 19 · Adquirir señal de material particulado | PENDIENTE | La web consume `PM2_5` como dato crudo en el motor. Se requiere verificar protocolo, sensor y unidad de salida. [Mapeo][mapper] · [Umbrales][defaults] |
| 20 · Adquirir señal de gases | PENDIENTE | La web consume `CO` como valor MQ-2 crudo para alertas. Se requiere verificar captura y unidad en el firmware. [Mapeo][mapper] · [Umbrales][defaults] |
| 21 · Validar lecturas en el nodo | PENDIENTE | La web normaliza valores y existen validaciones de estructura de RTDB. Se requiere confirmar descarte en el nodo. [Mapeo][mapper] · [Reglas][rules] |
| 22 · Continuar medición y alerta local sin conexión | PENDIENTE | Se requiere firmware y prueba de corte con el nodo alimentado. Informe vigente, línea 1052. |
| 23 · Comunicar por ESP-NOW | PENDIENTE | Es el protocolo del diseño del informe. Se requiere firmware de ambos ESP32 y prueba. Informe vigente, línea 1058. |
| 24 · Enviar medición hacia el gateway | PENDIENTE | Se requiere captura de paquetes o registro emparejado en nodo y gateway. Informe vigente, línea 1059. |
| 25 · Identificar origen en gateway | PENDIENTE | La web usa la clave de RTDB. Falta confirmar cómo el gateway vincula ese ID con el nodo físico. [Mapeo][mapper] |
| 26 · Subir a la nube por Wi-Fi | PENDIENTE | El receptor web está implementado. Falta verificar el salto gateway–Firebase con firmware y prueba. [Receptor][listener] |
| 27 · Configurar remotamente hasta el nodo | Parcial | Los umbrales se guardan en RTDB. PENDIENTE: consumo en gateway, reenvío y confirmación en nodo. [Guardado][threshold-save] |
| 28 · Guardar mediciones con tiempo y jerarquía | Parcial | La web lee la última medición y su marca de tiempo por dispositivo. Falta registro persistente por muestra con la jerarquía solicitada. [Mapeo][mapper] · [Suscripción][listener] |
| 29 · Conservar histórico de mediciones | No cumple en la versión revisada | El panel construye puntos de ejemplo a partir de la lectura actual. El historial de alarmas se maneja por separado. [Construcción de la serie][history-app] · [Exportación de alarmas][gateway-csv] |
| 30 · Almacenar adjuntos | No cumple en la versión revisada | No se ve flujo de subida a Firebase Storage en la aplicación. [Inicialización Firebase][firebase-init] · [Código de Firebase][firebase] |
| 31 · Proveer web para usuarios autorizados | Cumple | La interfaz de uso presenta un acceso con Auth. El acceso directo a datos se evalúa en RNF-10. [Auth][auth] · [Acceso a la interfaz][login-gate] |
| 32 · Mostrar resumen y últimas lecturas | Cumple | Panel a partir del dispositivo seleccionado y sus variables. [Datos del panel][history-app] · [Vistas][app-tabs] |
| 33 · Navegar organización → faena → zona → dispositivo | Parcial | Hay vistas de faenas, sectores y monitoreo. Falta el primer nivel y el recorrido enlazado de toda la jerarquía. [Faenas][sites-view] · [Vistas][app-tabs] |
| 34 · Historial filtrado por rango, zona o dispositivo | Parcial | Hay selección de variable y botones de períodos. La serie proviene del estado del panel y los períodos no filtran las muestras. [Reportes][reports] |
| 35 · Graficar variables | Cumple | La vista dibuja una serie en SVG. La serie del panel contiene puntos derivados con horas fijas. [Construcción de la serie][history-app] [Reportes][reports] |
| 36 · Exportar históricos o reportes | Parcial | Genera CSV con los puntos mostrados y hay exportación de alarmas del gateway. Falta histórico persistente de lecturas filtradas. [CSV web][reports] · [CSV de alarmas][gateway-csv] |
| 37 · Configurar umbrales web | Cumple | Editor y guardado de preventivo, advertencia y crítico. [Editor][threshold-view] · [Guardado][threshold-save] |
| 38 · Umbral por variable y ámbito | Cumple | Configuración por variable y por dispositivo, con valores globales de respaldo. [Editor][threshold-view] · [Motor][engine] |
| 39 · Guardar y sincronizar umbral al nodo | Parcial | Persiste en RTDB. PENDIENTE: confirmar aplicación local con firmware y prueba de sincronización. [Guardado][threshold-save] |
| 40 · Generar alerta automática | Cumple | El navegador procesa el dispositivo visible y escribe eventos al alcanzar el umbral. La ejecución autónoma sin navegador es parte de RF-47. [Llamada][app-engine] · [Motor][engine] · [Registro][event-write] |
| 41 · Visualizar severidad de alertas | Parcial | Distingue niveles y presenta eventos en configuración. La lista principal no se alimenta con una suscripción directa a alertas automáticas. [Vista de eventos][threshold-view] · [Lista][alerts-view] · [Suscripciones][app-start] |
| 42 · Guardar y mostrar contexto completo de alerta | Parcial | El evento incluye dispositivo, sector, variable, valor y timestamp. Falta la jerarquía de organización y faena del requisito. [Motor][engine] · [Guardado][event-write] |
| 43 · Reconocer con quién y cuándo | Parcial | Se muestra reconocimiento con nombre en estado local. Falta marca temporal y persistencia del reconocimiento. [Reconocimiento][app-resolution] |
| 44 · Cerrar una alerta | Parcial | Existe resolución local y se intenta escribir un cierre detallado y su bitácora. El archivo de reglas RTDB no concede acceso explícito a `bitacora_contingencias`. PENDIENTE: confirmar persistencia y permisos en el entorno de prueba. [Reglas][rules] [Cierre web][app-resolution] · [Cierre RTDB][resolution] |
| 45 · Añadir título y descripción de cierre | Parcial | El modal exige una descripción y admite acciones correctivas. El campo de título opcional del requisito no aparece en el formulario. [Formulario de resolución][resolve-modal] · [Cierre RTDB][resolution] |
| 46 · Historial completo de alertas y estados | Parcial | Hay eventos, bitácora y auditoría del gateway. El reconocimiento local y los estados de los incidentes escalados dejan huecos. [Reconocimiento][app-resolution] · [Motor][engine] · [Cierre][resolution] |
| 47 · Evaluar umbrales localmente sin Internet | PENDIENTE | Se necesita firmware y un ensayo con Wi-Fi/Internet interrumpido. El motor revisado corre en navegador. [Motor web][app-engine] |
| 48 · Encender luz de alarma local | PENDIENTE | Hay comandos y estado de luz en la web. Falta comprobar activación autónoma por parte del nodo. [Comandos][commands] |
| 49 · Activar buzzer local | PENDIENTE | Hay emisión de órdenes de alarma y audio de navegador. Falta validar el buzzer del nodo. [Comandos][commands] · [Audio web][audio] |
| 50 · Mostrar lecturas en pantalla física | PENDIENTE | Requiere código de pantalla y demostración del nodo. Informe vigente, línea 1110. |

#### No funcionales

| RNF | Resultado | Evidencia y límite |
|---|---|---|
| 01 · Navegación intuitiva | PENDIENTE | Las vistas y menús existen. La facilidad de uso se verifica con usuarios y tareas representativas. [Vistas][app-tabs] |
| 02 · Estados distinguibles | Cumple en interfaz | Hay estados, iconos y color en monitoreo y alertas. La exactitud del estado de conexión se revisa en RF-16. [Monitoreo][components] · [Alertas][alerts-view] |
| 03 · Prevenir errores de operación | Parcial | Los umbrales validan orden y las operaciones críticas tienen controles en sus vistas. Falta comprobar cobertura de confirmaciones y errores en operaciones críticas. [Validación][threshold-save] · [Control Maestro][master] · [Cierre de simulacro][drill] |
| 04 · Diseño responsivo | Parcial | Las vistas usan clases responsivas. PENDIENTE: comprobar navegadores y resoluciones de escritorio y móvil. [Reportes][reports] · [Vistas][app-tabs] |
| 05 · Latencia compatible | PENDIENTE | Hace falta medir de extremo a extremo con marcas de tiempo y condiciones de prueba. Informe vigente, KPI-03 y KPI-04. [Listener][listener] |
| 06 · Actualización sin recarga | Parcial | Las mediciones y la vista de eventos usan suscripciones. El listado principal de alertas tiene estado local. [Telemetría][listener] · [Vista de eventos][threshold-view] · [Estado de alertas][app-start] |
| 07 · Estabilidad con carga simultánea | PENDIENTE | No se cuenta con prueba de carga con la cantidad de equipos del prototipo. [Pruebas del motor][tests] · [Pruebas API][ai-tests] |
| 08 · Distinguir pérdida de comunicación y fallo de sensor | Parcial | Hay desconexión y estado ambiental, pero el mapeo usa respaldos para entradas inválidas y no verifica un estado separado de fallo por sensor. [Mapeo][mapper] |
| 09 · Reconectar nodo y gateway | PENDIENTE | Se requiere desconectar el enlace de campo o Wi-Fi y observar recuperación en firmware. Informe vigente, línea 1137. |
| 10 · Autenticar todo acceso | Parcial | La interfaz exige sesión. Las reglas versionadas admiten lecturas y algunas escrituras sin sesión. [Auth][auth] · [RTDB][rules] · [Firestore][fs-rules] |
| 11 · Validar rol y organización en reglas | No cumple en la versión revisada | Hay algunos controles Auth/rol. Falta autorización por organización y por rol en rutas relevantes. [RTDB][rules] · [Firestore][fs-rules] |
| 12 · Restringir administración y umbrales | Parcial | Hay controles de cliente y reglas de configuración maestra. Las reglas de umbrales no exigen rol admin/superadmin. [Guardado web][threshold-save] · [Reglas][rules] |
| 13 · Arquitectura multi-organización | No cumple en la versión revisada | El esquema y las rutas revisadas no incluyen membresías ni ámbito por organización. [RTDB][rules] · [Faenas][site-state] |
| 14 · RTDB principal y Storage para adjuntos | Parcial | RTDB es el motor activo. No se observa integración con Storage. [Firebase][firebase-init] · [Servicio][firebase] |
| 15 · Capacidad máxima de nodos ensayada | PENDIENTE | Falta ensayo incremental de concurrencia por gateway y resultados. Informe vigente, línea 1156. |
| 16 · Desacoplar las cuatro capas | Parcial | La web divide vistas y operaciones de datos, usa RTDB como interfaz y FastAPI está separado. Falta revisar adquisición y transporte del firmware. [Suscripción][listener] · [Entrada][entry] · [API][ai-main] |
| 17 · Sustituir o calibrar sensores con poco impacto | PENDIENTE | El mapeo web espera campos concretos. Se requiere comprobar modularidad o sustitución en nodo sin romper el contrato. [Mapeo][mapper] |
| 18 · Ajustarse a pantalla del nodo | PENDIENTE | Requiere firmware, modelo y verificación visual en el dispositivo. Informe vigente, línea 1165. |

### 9. Preguntas probables de la comisión

| Pregunta | Respuesta breve y respaldo que conviene abrir |
|---|---|
| ¿Por qué tienen nodo y gateway? | Según el diseño del informe, el nodo está cerca de los sensores y el gateway centraliza la comunicación local y la salida a Internet. En la web puedo mostrar el punto de llegada a RTDB. Para demostrar cómo se reparten las tareas, usaría los registros de ambos ESP32. [Contrato web][listener] |
| ¿Dónde aparece por primera vez una lectura en la web? | En `subscribeToRTDBDevices()`. El listener toma un snapshot, lo mapea y lo pasa a `App`. A partir de ahí se actualizan el panel y el motor. [Suscripción][listener] · [App][app-start] |
| ¿Cómo sabe la web que se desconectó un sensor? | Usa una ventana de unos 20 segundos y la última marca de tiempo o llegada. El listener actualiza la llegada de todo el snapshot y la conexión se recalcula en ese flujo. Por eso probaría el caso de dos dispositivos, uno activo y uno detenido. [Mapeo][mapper] · [Suscripción][listener] |
| ¿Dónde nace la alerta y qué pasa con la web cerrada? | El motor revisado vive en el navegador. La adquisición y la alerta autónoma son funciones que el informe asigna al nodo. Su operación con la web cerrada requiere una demostración del hardware. [Motor web][app-engine] · [Motor][engine] |
| ¿Qué pasa si llega exactamente a 32 °C? | Con valores de fábrica entra en advertencia porque la condición usa `>=`. Si venía de preventivo crea un evento nuevo por escalamiento. [Valores][defaults] · [Comparación][engine] |
| ¿Qué evita recibir cien alertas por la misma lectura? | Un mapa en memoria del cliente por dispositivo y variable. Emite al entrar o escalar. Ese límite de deduplicación se reinicia al recargar y es independiente en cada navegador. [Motor][engine] |
| ¿En qué se diferencian recuperación, reconocimiento y cierre? | Recuperación es una vuelta a normal detectada por el motor. Reconocimiento es una acción que hoy se guarda en el estado de la interfaz. Cierre con detalle intenta guardar una bitácora y la resolución en RTDB. [Recuperación][engine] · [Acciones web][app-resolution] · [Persistencia][resolution] |
| ¿Cómo llega un umbral nuevo al nodo? | La web valida y guarda el cambio en `configuracion_alertas`. El paso desde RTDB hasta la aplicación local en el nodo está pendiente de demostración. [Guardado][threshold-save] |
| ¿Pueden reportar CO en ppm o polvo en µg/m³? | El motor de esta versión trabaja con canales crudos para MQ-2 y material particulado. Para reportar concentraciones hace falta un sensor y una calibración apropiados con evidencia. [Umbrales][defaults] · [Alcance de la API][api-readme] |
| ¿Qué guarda Firebase y qué guarda React? | Firebase aporta el estado operativo y los eventos que se escriben. React mantiene la selección y los estados de pantalla. Con la última lectura genera puntos con horarios fijos para el gráfico. El CSV del panel sale de esos puntos y debe tratarse como un reporte de demostración. [RTDB][firebase] · [Serie][history-app] · [CSV][reports] |
| ¿Por qué Firebase, y qué papel tiene Firestore? | El flujo web usa listeners de RTDB y evita mantener un servidor web intermedio para el monitoreo. Firestore se inicializa en otra app del SDK. El camino de telemetría revisado usa RTDB. [Firebase][firebase-init] · [Suscripción][listener] |
| ¿Ocultar un botón impide que un usuario acceda a los datos? | Lo que ve el usuario lo define React. Los permisos reales de lectura y escritura se aplican en Firebase. Las reglas guardadas en el repo todavía son más amplias que los permisos de pantalla. [Visibilidad][roles] · [Reglas][rules] |
| ¿Se puede usar el sistema para dos empresas con datos aislados? | Puede representar faenas, sectores y dispositivos, pero esta versión carece de un modelo de organización con membresías y reglas de aislamiento. [Faenas][sites-view] · [Reglas][rules] |
| ¿Qué diferencia hay entre una anomalía del análisis y una alarma? | La anomalía depende de la distribución de la ventana, con mediana y MAD. La alarma del navegador compara contra límites configurados. Un valor puede resultar atípico sin alcanzar un límite, o alcanzar un límite en una serie donde todos los valores son altos. [API][ai-analyze] · [Motor][engine] |
| ¿Qué prueba que el sistema completo funciona? | Las pruebas del repositorio cubren piezas de software. La demostración de extremo a extremo debe unir una medición identificada en el nodo, su recepción en gateway, el registro en RTDB y su aparición en la web. Para validar alarmas locales debe incluir además prueba de desconexión con el nodo alimentado. [Pruebas web][tests] · [Pruebas API][ai-tests] |

### 10. Orden de estudio para la defensa

1. **Seguir una muestra.** Abrir `firebase.ts` en el listener y el mapeador, luego `App.tsx` en el efecto del motor. Practicar el recorrido usando temperatura para evitar problemas de unidades. [Suscripción][listener] · [Mapeo][mapper] · [Evaluación en App][app-engine]
2. **Explicar el motor a mano.** Recorrer 23 → 28 → 29 → 34 → 40 → 22 °C. Señalar cuándo hay evento, cuándo hay audio y qué queda recuperado. [Pruebas][tests] · [Motor][engine]
3. **Preparar la evidencia del montaje.** Asociar el mismo ID y marca de tiempo entre nodo, gateway, RTDB y web. Medir tiempo por tramo según el KPI del informe. Usar el simulacro y cualquier comando físico en un montaje controlado. [Contrato web][mapper] · [Simulacro][drill]
4. **Repartir respuestas del grupo.** Una persona puede cubrir sensores y radio, otra datos y seguridad, y otra interfaz, alertas y pruebas. Los tres deberían poder explicar el recorrido completo y los límites del prototipo.

## Pendientes y dudas

- **PENDIENTE: ubicación y versión del firmware del nodo y del gateway.** Compartir el repositorio o una copia lectura de la versión que se presentará.
- **PENDIENTE: reglas desplegadas y entorno de demostración.** Compartir las reglas versionadas del proyecto de prueba, sin credenciales, si se defenderá el control de acceso o la integración completa.
- **PENDIENTE: resultados del montaje.** Vincular evidencia del enlace, carga por gateway, desconexión, latencia, alertas locales, calibración y sincronización de umbrales con los objetivos del capítulo XI. Los KPI del informe son metas de aceptación del prototipo.

## Observaciones

El equipo puede usar las diferencias de las secciones 7 y 8 para decidir qué capacidades entran en el alcance que defenderá. Conviene identificar la versión exacta del firmware y la web en las capturas y resultados que se anexen.

## Decisión del grupo

- [ ] Aceptada
- [ ] Aceptada con cambios
- [ ] Rechazada

Comentario:

[commit]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/commit/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a
[components]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/tree/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/components
[docs]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/tree/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/docs
[pkg]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/package.json#L6-L39
[readme]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/README.md
[vite]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/vite.config.ts#L6-L58
[entry]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/main.tsx#L1-L10
[app-start]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/App.tsx#L101-L213
[app-visible]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/App.tsx#L215-L309
[app-engine]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/App.tsx#L303-L308
[history-app]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/App.tsx#L310-L443
[app-tabs]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/App.tsx#L1210-L1352
[banner]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/App.tsx#L959-L971
[ventilation]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/App.tsx#L517-L527
[drill]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/App.tsx#L676-L750
[site-state]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/App.tsx#L819-L846
[app-resolution]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/App.tsx#L473-L510
[profile]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L262-L357
[auth]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L359-L502
[verify-super]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L504-L545
[firebase-init]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L52-L90
[firebase]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts
[mapper]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L104-L209
[listener]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L579-L599
[commands]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L987-L1170
[broadcast]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L1173-L1300
[resolution]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L1302-L1333
[defaults]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L1358-L1412
[threshold-save]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L1495-L1538
[event-write]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L1569-L1615
[master-metrics]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L1705-L1725
[roles]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L1648-L1828
[reg-save]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/firebase.ts#L1878-L2024
[rules]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/database.rules.json#L1-L84
[fs-rules]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/firestore.rules#L1-L33
[engine]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/alertEngine.ts#L24-L222
[audio]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/services/audioAlert.ts#L1-L150
[tests]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/tests/test_alert_engine.ts#L76-L151
[env]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/.env.example
[apk]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/MineSafe_IoT_Mobile_v2.4.apk
[threshold-view]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/components/AlertConfigurationView.tsx#L71-L232
[alerts-view]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/components/AlertsView.tsx#L53-L117
[user-ui]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/components/UsersManagementView.tsx#L49-L106
[master]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/components/SuperAdminControlView.tsx#L487-L619
[sites-view]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/components/MiningSectorsView.tsx#L31-L84
[reports]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/components/HistoricalReportsView.tsx#L29-L179
[gateway-csv]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/components/ESP32GatewaySection.tsx#L187-L231
[api-readme]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/minesafe-ai/README.md
[ai-main]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/minesafe-ai/app/main.py#L20-L55
[ai-config]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/minesafe-ai/app/config.py
[ai-schema]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/minesafe-ai/app/schemas.py#L6-L34
[ai-analyze]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/minesafe-ai/app/analyzer.py#L15-L93
[ai-tests]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/minesafe-ai/tests/test_analyzer.py#L28-L80
[login-gate]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/App.tsx#L1014-L1040
[resolve-modal]: https://github.com/whitewolf260501-hash/MineSafe_Web_Dark_V3/blob/4a976ccbdd88aa1da3613a4162f61ecbe1b75c7a/src/components/AlertResolutionModal.tsx#L22-L58
