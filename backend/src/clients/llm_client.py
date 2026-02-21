"""
LLM Client — Gemini via LangChain.

llm_flash : Gemini 2.0 Flash — fast, for classification / query generation.
llm_pro   : Gemini 2.5 Flash — powerful, for structured extraction and analysis.
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

_backend_env = Path(__file__).resolve().parents[2] / ".env"
_root_env = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_backend_env)
load_dotenv(_root_env)

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

# Backwards-compatible alias used by Agent 1
llm = llm_flash
