"""Native Ollama embedder.

The langchain_openai.OpenAIEmbeddings client posts JSON with `input` as a list
of strings (OpenAI shape). Ollama's /v1/embeddings shim is finicky with that
shape for nomic-embed-text and returns HTTP 400 ('invalid input type').

This module talks to Ollama's *native* /api/embeddings endpoint (one prompt
per request) and exposes the small async surface our RAG layer needs:

    aembed_query(text)            -> list[float]
    aembed_documents([t1, t2,...]) -> list[list[float]]

That's all langchain_core uses, so it's a drop-in for OpenAIEmbeddings.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Sequence

import httpx

from app.core.logging import get_logger

log = get_logger("ollama_embed")

# nomic-embed-text returns 768-dim vectors.
NOMIC_EMBED_DIM = 768


@dataclass
class OllamaEmbedder:
    base_url: str = "http://localhost:11434"
    model: str = "nomic-embed-text"
    timeout: float = 30.0

    def _strip_v1(self, url: str) -> str:
        # Accept either http://host:11434 or http://host:11434/v1 and normalise.
        return url[:-3] if url.endswith("/v1") else url

    async def _embed_one(self, client: httpx.AsyncClient, text: str) -> list[float]:
        r = await client.post(
            f"{self._strip_v1(self.base_url)}/api/embeddings",
            json={"model": self.model, "prompt": text},
            timeout=self.timeout,
        )
        r.raise_for_status()
        data = r.json()
        vec = data.get("embedding") or []
        if not vec:
            raise RuntimeError(f"empty embedding from ollama: {data}")
        return vec

    async def aembed_query(self, text: str) -> list[float]:
        async with httpx.AsyncClient() as client:
            return await self._embed_one(client, text)

    async def aembed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        # Ollama embedding endpoint is single-prompt; fan-out concurrently but
        # cap so we don't melt the local GPU/CPU.
        sem = asyncio.Semaphore(4)

        async with httpx.AsyncClient() as client:
            async def _bounded(t: str) -> list[float]:
                async with sem:
                    return await self._embed_one(client, t)

            return await asyncio.gather(*(_bounded(t) for t in texts))
