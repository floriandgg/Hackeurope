"""
LLM Client — Gemini via LangChain.

GOOGLE_API_KEY  : used by Agent 1, Agent 2 (grounded searches + extraction)
GOOGLE_API_KEY1 : used by Agent 3, Agent 4 (independent quota, runs in parallel)

llm_flash / llm_pro : use GOOGLE_API_KEY (Agent 1, 2)
llm_flash_alt       : uses GOOGLE_API_KEY1 (Agent 3, 4)
llm                 : alias for llm_flash (backwards compat with Agent 1)
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

_env_cwd = Path.cwd() / ".env"
_env_backend = Path(__file__).resolve().parents[2] / ".env"
_env_root = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_env_cwd) or load_dotenv(_env_backend) or load_dotenv(_env_root)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_API_KEY1 = os.getenv("GOOGLE_API_KEY1") or GOOGLE_API_KEY

# --- Key 1: Agent 1 + Agent 2 ---
llm_flash = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=GOOGLE_API_KEY,
    temperature=0,
) if GOOGLE_API_KEY else None

llm_pro = ChatGoogleGenerativeAI(
    model="gemini-3-flash-preview",
    google_api_key=GOOGLE_API_KEY,
    temperature=0,
) if GOOGLE_API_KEY else None

# --- Key 2: Agent 3 + Agent 4 (parallel, no rate-limit collision) ---
llm_flash_alt = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=GOOGLE_API_KEY1,
    temperature=0,
) if GOOGLE_API_KEY1 else None

llm_pro_alt = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro",
    google_api_key=GOOGLE_API_KEY1,
    temperature=0,
) if GOOGLE_API_KEY1 else None

# Backwards-compatible alias used by Agent 1
llm = llm_flash
