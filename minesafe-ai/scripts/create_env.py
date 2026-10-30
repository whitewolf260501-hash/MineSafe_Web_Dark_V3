"""Create a local .env file with a random API key if none exists."""
from pathlib import Path
import secrets

root = Path(__file__).resolve().parents[1]
env_path = root / ".env"
if env_path.exists():
    print("Ya existe .env; no se modificó.")
else:
    key = secrets.token_urlsafe(32)
    env_path.write_text(
        "# Configuración local generada automáticamente. No compartas este archivo.\n"
        f"MINESAFE_AI_API_KEY={key}\n"
        "MINESAFE_AI_MIN_OBSERVATIONS=5\n"
        "MINESAFE_AI_MAX_OBSERVATIONS=10000\n",
        encoding="utf-8",
    )
    print("Se creó .env con una clave aleatoria privada para este equipo.")
    print("La clave se encuentra en .env; no la publiques ni la subas a Git.")
