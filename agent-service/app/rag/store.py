"""RAG store over the 45 saved Instagram card-news templates.

Strategy:
  1. If pgvector + DATABASE_URL are available, persist/query embeddings there.
  2. Otherwise keep an in-process numpy index built at startup.
  3. If there's no OpenAI key (no embeddings), fall back to a lexical
     (token-overlap) score so search still returns sensible exemplars in dev.

Each template `.jsonl` is a list of design elements (background/title/body/
graphic). We flatten it into a compact natural-language "design summary" that
becomes the retrieval document — we retrieve *real human-made designs* and feed
them to the copywriter/designer as few-shot grounding. That is the actual RAG.
"""
from __future__ import annotations

import glob
import json
import math
import os
import re
from dataclasses import dataclass, field
from typing import Optional

from ..config import get_settings
from ..models import embed


@dataclass
class TemplateDoc:
    template_id: str
    summary: str
    raw: list[dict]
    vector: Optional[list[float]] = None
    tokens: set[str] = field(default_factory=set)


_KO_EN = re.compile(r"[0-9A-Za-z가-힣]+")


def _tokenize(text: str) -> set[str]:
    words = [t.lower() for t in _KO_EN.findall(text) if len(t) > 1]
    tokens = set(words)
    # Korean has no whitespace morphology here, so add character bigrams over the
    # concatenated CJK/word stream — gives the lexical fallback real signal
    # (e.g. "흑돼지" vs "돼지" share bigrams) when embeddings are unavailable.
    joined = "".join(words)
    tokens.update(joined[i : i + 2] for i in range(len(joined) - 1))
    return tokens


def summarize_template(raw: list[dict]) -> str:
    """Flatten design elements into a one-line natural-language summary."""
    titles = [e.get("content", "") for e in raw if e.get("type") == "title"]
    bodies = [e.get("content", "") for e in raw if e.get("type") == "body"]
    colors = sorted({e.get("color", "") for e in raw if e.get("color", "").startswith("#")})
    bg = next((e.get("content", "") for e in raw if e.get("type") == "background"), "")
    parts = []
    if titles:
        parts.append("제목: " + " / ".join(t for t in titles if t)[:160])
    if bodies:
        parts.append("본문: " + " / ".join(b for b in bodies if b)[:160])
    if bg:
        parts.append(f"배경: {bg}")
    if colors:
        parts.append("팔레트: " + " ".join(colors[:5]))
    return " · ".join(parts) or "디자인 템플릿"


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


class TemplateStore:
    def __init__(self) -> None:
        self.docs: list[TemplateDoc] = []
        self._loaded = False

    def load(self) -> int:
        if self._loaded:
            return len(self.docs)
        s = get_settings()
        pattern = os.path.join(os.path.abspath(s.templates_dir), "*.jsonl")
        for path in sorted(glob.glob(pattern)):
            tid = os.path.splitext(os.path.basename(path))[0]
            rows: list[dict] = []
            with open(path, encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        rows.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
            if not rows:
                continue
            summary = summarize_template(rows)
            self.docs.append(
                TemplateDoc(template_id=tid, summary=summary, raw=rows, tokens=_tokenize(summary))
            )
        self._embed_all()
        self._loaded = True
        return len(self.docs)

    def _embed_all(self) -> None:
        vectors = embed([d.summary for d in self.docs])
        if len(vectors) == len(self.docs):
            for doc, vec in zip(self.docs, vectors):
                doc.vector = vec

    def search(self, query: str, top_k: Optional[int] = None) -> list[tuple[TemplateDoc, float]]:
        if not self._loaded:
            self.load()
        s = get_settings()
        k = top_k or s.rag_top_k
        q_vecs = embed([query])
        if q_vecs and all(d.vector for d in self.docs):
            q = q_vecs[0]
            scored = [(d, _cosine(q, d.vector)) for d in self.docs]  # type: ignore[arg-type]
        else:
            # Lexical fallback (Jaccard over tokens) — keeps dev usable without keys.
            q_tokens = _tokenize(query)
            scored = []
            for d in self.docs:
                inter = len(q_tokens & d.tokens)
                union = len(q_tokens | d.tokens) or 1
                scored.append((d, inter / union))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:k]


_STORE: Optional[TemplateStore] = None


def get_store() -> TemplateStore:
    global _STORE
    if _STORE is None:
        _STORE = TemplateStore()
        _STORE.load()
    return _STORE
