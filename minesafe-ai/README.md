# MineSafe AI Analysis API (prototipo listo para ejecutar)

Servicio separado de la web React/Vite para analizar series temporales que MineSafe entregue desde Firebase.

## Estado y límites

- Este servicio no modifica la web actual ni las reglas Firebase.
- La ruta real de histórico no está confirmada en el repositorio. No se inventa: el servicio recibe lecturas por `POST /v1/analyze` y permite conectar Firebase después de confirmar el esquema.
- La detección actual es estadística (mediana/MAD) y el análisis de tendencia es una regresión lineal simple. Es un punto de partida explicable, no un modelo validado ni un sistema certificado de seguridad.
- El CO del MQ-2 y el PM2.5 del firmware pueden ser valores ADC crudos. Enviar `unit="raw"` hasta calibrar el sensor; no se comparan contra umbrales normativos en unidades físicas.
- No controla sirenas, ventilación ni actuadores. Las alarmas de seguridad existentes deben seguir funcionando de forma independiente.

## Ejecutar en Windows (recomendado)

1. Descomprime el ZIP y abre esta carpeta en Visual Studio Code.
2. Haz doble clic en `setup_windows.bat` una sola vez. Este crea `.venv`, instala las dependencias y genera un `.env` con una clave aleatoria local si aún no existe.
3. Haz doble clic en `INICIAR_MineSafe_IA.bat`.
4. Abre `http://127.0.0.1:8000/docs`. La raíz `http://127.0.0.1:8000/` también redirige a la documentación.

También puedes ejecutar los comandos desde una terminal abierta en esta carpeta:

```powershell
py -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe scripts\create_env.py
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

En macOS/Linux, crea el entorno virtual con `python3 -m venv .venv`, instala con `.venv/bin/python -m pip install -r requirements.txt`, crea el `.env` con `.venv/bin/python scripts/create_env.py` y ejecuta `.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.

`MINESAFE_AI_API_KEY` se lee desde `.env`. El script de configuración genera una clave aleatoria local automáticamente. No compartas `.env` ni expongas este prototipo a internet; está enlazado solo a `127.0.0.1`.

## API

- `GET /`: redirige a la documentación interactiva `/docs`.

- `GET /health`: estado básico del proceso (sin datos de faena).
- `POST /v1/analyze`: analiza una serie entregada en el cuerpo JSON; requiere `Authorization: Bearer <MINESAFE_AI_API_KEY>`.

Ejemplo de cuerpo:

```json
{
  "device_id": "NODO_U-01",
  "observations": [
    {"timestamp": "2026-10-29T12:00:00Z", "pm25_raw": 450, "mq2_raw": 200, "temperature_c": 22.1, "humidity_pct": 48, "unit": "raw"},
    {"timestamp": "2026-10-29T12:00:05Z", "pm25_raw": 455, "mq2_raw": 203, "temperature_c": 22.2, "humidity_pct": 49, "unit": "raw"}
  ]
}
```

En `/docs`, pulsa **Authorize** y escribe `Bearer TU_CLAVE`, sustituyendo `TU_CLAVE` por el valor de `MINESAFE_AI_API_KEY` que aparece en el archivo local `.env`. Después usa **Try it out** en `POST /v1/analyze`. El archivo `EJEMPLO_SOLICITUD.json` contiene un cuerpo de ejemplo. La API exige al menos 5 observaciones para el análisis básico. El umbral estadístico requiere variación suficiente y no reemplaza un límite de seguridad configurado y validado por especialistas.

## Integración Firebase pendiente

1. Confirmar la estructura real y la retención del historial en Realtime Database/Firestore.
2. Añadir un repositorio de lectura con credenciales de servicio exclusivamente en backend (Application Default Credentials / identidad de servicio); nunca poner credenciales administrativas en Vite.
3. Persistir timestamps UTC en cada lectura y separar lecturas crudas de unidades calibradas.
4. Añadir autenticación Firebase ID token o API Gateway/IAM para producción, cuotas, logging sin datos sensibles y despliegue protegido.
5. Conectar un panel nuevo de resultados a esta API después de validar la respuesta y el control de acceso.
6. Validar detecciones con datos históricos etiquetados y revisión experta antes de llamar “predicción” a cualquier salida.

## Contrato de respuesta

Incluye dispositivo, ventana analizada, número de observaciones, tendencia lineal aproximada, anomalías estadísticas y limitaciones. Los resultados no deben usarse como único mecanismo de protección.
