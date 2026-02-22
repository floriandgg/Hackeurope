"""
LLM Client — Gemini via LangChain.

llm_flash : Gemini 2.5 Flash — fast, for classification / query generation.
llm_pro   : Gemini 2.5 Pro — powerful, for structured extraction and analysis.
llm       : alias for llm_flash (backwards compat with Agent 1, 3).
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

# Load .env (cwd, backend/, project root)
_env_cwd = Path.cwd() / ".env"
_env_backend = Path(__file__).resolve().parents[2] / ".env"
_env_root = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_env_cwd) or load_dotenv(_env_backend) or load_dotenv(_env_root)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

llm_flash = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=GOOGLE_API_KEY,
    temperature=0,
) if GOOGLE_API_KEY else None

llm_pro = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro",
    google_api_key=GOOGLE_API_KEY,
    temperature=0,
) if GOOGLE_API_KEY else None

# Backwards-compatible alias used by Agent 1, 3
llm = llm_flash
