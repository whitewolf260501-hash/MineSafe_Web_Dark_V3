from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from .analyzer import analyze
from .config import settings
from .schemas import AnalyzeRequest, AnalyzeResponse

app = FastAPI(
    title="MineSafe AI Analysis API",
    version="0.1.1",
    description=(
        "Análisis estadístico de series temporales. Prototipo experimental; "
        "no es un sistema certificado de seguridad."
    ),
)

# Configuración de orígenes permitidos (CORS) para integración con la web MineSafe
origins = [origin.strip() for origin in settings.allowed_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if "*" not in origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_api_key(authorization: str | None = Header(default=None)) -> None:
    if not settings.api_key:
        raise HTTPException(status_code=503, detail="MINESAFE_AI_API_KEY no está configurada. Ejecuta setup_windows.bat o configura .env.")
    expected = f"Bearer {settings.api_key}"
    if authorization is None or authorization != expected:
        raise HTTPException(status_code=401, detail="No autorizado. En Swagger, pulsa Authorize e introduce: Bearer TU_CLAVE")


@app.get("/", include_in_schema=False)
def root():
    """Evita un Not Found al abrir la raíz y dirige a la documentación."""
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    return {"status": "ok", "service": "minesafe-ai-analysis", "version": "0.1.1"}


@app.post("/v1/analyze", response_model=AnalyzeResponse, dependencies=[Depends(require_api_key)])
def analyze_series(payload: AnalyzeRequest):
    if len(payload.observations) > settings.max_observations:
        raise HTTPException(status_code=413, detail="La serie supera el máximo permitido")
    try:
        return analyze(payload, settings.min_observations)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
