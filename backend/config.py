import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Server Configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# API Configuration
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise ValueError("ANTHROPIC_API_KEY environment variable is required")

# Sessions Directory Configuration
# SECURE: Sessions should be OUTSIDE project directory for complete isolation
SESSIONS_DIR = os.getenv("SESSIONS_DIR")
if SESSIONS_DIR:
    # Use custom path from environment variable
    UPLOAD_DIR = Path(SESSIONS_DIR).expanduser().resolve()
else:
    # Default: parent directory, completely outside the codebase
    UPLOAD_DIR = Path(__file__).parent.parent.parent / "claude_sessions"

# Ensure sessions directory exists
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Logging Configuration
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Session Configuration
SESSION_TTL_HOURS = int(os.getenv("SESSION_TTL_HOURS", 24))

# CORS Settings
CORS_ORIGINS_ENV = os.getenv("CORS_ORIGINS", "*")
if CORS_ORIGINS_ENV == "*":
    CORS_ORIGINS = ["*"]  # Allow all origins (development)
else:
    CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS_ENV.split(",")]
