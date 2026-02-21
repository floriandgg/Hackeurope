"""
Client LLM — Gemini 1.5 Flash via LangChain.
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_env_path)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    google_api_key=GOOGLE_API_KEY,
    temperature=0,
) if GOOGLE_API_KEY else None
