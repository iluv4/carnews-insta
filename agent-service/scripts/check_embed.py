"""Embedding health check.

Calls the real `embed()` path and reports whether the OpenAI embeddings API is
actually being hit — instead of silently falling back to lexical search.

Usage:
    OPENAI_API_KEY=sk-... python scripts/check_embed.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.models import embed  # noqa: E402
from app.rag.store import get_store  # noqa: E402


def main() -> int:
    s = get_settings()
    print(f"embed_model      : {s.embed_model}")
    print(f"OPENAI_API_KEY   : {'set' if s.has_openai else 'MISSING'}")

    vecs = embed(["전기차 보조금 정책이 바뀐다"])
    if vecs and vecs[0]:
        print(f"embedding call   : OK  (dim={len(vecs[0])})")
        called = True
    else:
        print("embedding call   : NOT CALLED — returning [] → lexical fallback")
        called = False

    store = get_store()
    print(f"templates loaded : {len(store.docs)}")
    print(f"vectors built    : {sum(1 for d in store.docs if d.vector)}/{len(store.docs)}")

    hits = store.search("신형 전기차 출시 소식", top_k=3)
    print("top-3 retrieval  :")
    for doc, score in hits:
        print(f"  {score:.4f}  {doc.template_id}  {doc.summary[:50]}")

    print("\nRESULT:", "EMBEDDINGS ACTIVE" if called else "LEXICAL FALLBACK (no live embedding)")
    return 0 if called else 1


if __name__ == "__main__":
    raise SystemExit(main())
