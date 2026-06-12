# Backend image for LinkedIn Council (deploy target: Fly.io).
# The frontend deploys separately to Vercel; this image is the FastAPI API only.
FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

# Install dependencies first for better layer caching.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

# Copy application code.
COPY backend ./backend
COPY main.py ./

# Install the project itself.
RUN uv sync --frozen --no-dev

# Conversation storage lives here (ephemeral on Fly unless a volume is mounted).
RUN mkdir -p data/conversations

ENV PORT=8080
EXPOSE 8080

# Bind to 0.0.0.0 and the platform-provided port.
CMD ["sh", "-c", "uv run uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
