"""
LLM client — Gemini 1.5 Flash via LangChain.
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

# Load .env from backend/ or project root
_env_backend = Path(__file__).resolve().parents[2] / ".env"
_env_root = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_env_backend) or load_dotenv(_env_root)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    google_api_key=GOOGLE_API_KEY,
    temperature=0,
) if GOOGLE_API_KEY else None
