"""Configuration for the LLM Council."""

import os
from dotenv import load_dotenv

load_dotenv()

# OpenRouter API key
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Shared password gate. If unset/empty, the gate is OFF (local dev).
# In production set COUNCIL_PASSWORD so strangers can't spend your credits.
COUNCIL_PASSWORD = os.getenv("COUNCIL_PASSWORD")

# Comma-separated list of allowed CORS origins. Defaults to local dev.
# In production set e.g. ALLOWED_ORIGINS="https://council.shreevaidya.com"
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")
    if o.strip()
]

# Council members. Each member is one "thinker" persona backed by a model.
# Identity is the persona `key`/`name`, NOT the model, so two personas may
# share a model (cheap, and the persona prompts make them think differently).
# The persona instructions themselves live in backend/prompts.py (PERSONAS).
COUNCIL_MEMBERS = [
    {"key": "contrarian",        "name": "The Contrarian",              "model": "x-ai/grok-4.3"},
    {"key": "first_principles",  "name": "The First Principles Thinker", "model": "openai/gpt-5.1"},
    {"key": "expansionist",      "name": "The Expansionist",            "model": "google/gemini-3.1-pro-preview"},
    {"key": "outsider",          "name": "The Outsider",                "model": "anthropic/claude-sonnet-4.5"},
    {"key": "skeptic",           "name": "The Skeptic",                 "model": "openai/gpt-5.1"},
]

# Backwards-compatible list of model ids (some tooling may still read this).
COUNCIL_MODELS = [m["model"] for m in COUNCIL_MEMBERS]

# Chairman model - the Council that synthesizes the final balanced verdict.
CHAIRMAN_MODEL = "anthropic/claude-sonnet-4.5"

# OpenRouter API endpoint
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Data directory for conversation storage
DATA_DIR = "data/conversations"
