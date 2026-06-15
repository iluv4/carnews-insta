# Build context = repo ROOT (not agent-service/), so the RAG corpus in
# src/templates can be baked into the image. Without this, the in-process index
# boots empty on Railway (no volume mounts) → templates_indexed: 0 → embeddings
# have nothing to embed. docker-compose builds with the same root context.
#
# Railway: set this service's Root Directory to the repo root and Dockerfile
# Path to `agent-service/Dockerfile`.
FROM python:3.11-slim

WORKDIR /srv

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    AGENT_TEMPLATES_DIR=/srv/src/templates

COPY agent-service/requirements.txt .
RUN pip install -r requirements.txt

COPY agent-service/app ./app
# RAG corpus — the 45 saved Instagram templates the retriever embeds.
COPY src/templates ./src/templates

EXPOSE 8000
# Railway injects $PORT; fall back to 8000 for local `docker run`.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
