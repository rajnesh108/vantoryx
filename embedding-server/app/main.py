import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.embedder import embed_texts, model_status, start_loading
from app.extractor import extract_pages
from app.reranker import model_status as reranker_status
from app.reranker import rerank, start_loading as start_reranker


@asynccontextmanager
async def lifespan(_app: FastAPI):
    start_loading()
    start_reranker()
    yield


app = FastAPI(title="MedRAG embeddings", version="1.0.0", lifespan=lifespan)


class ExtractRequest(BaseModel):
    path: str


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=64)


class RerankRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    texts: list[str] = Field(min_length=1, max_length=32)


@app.get("/health")
def health() -> dict:
    status = model_status()
    status["reranker"] = reranker_status()
    return status


@app.post("/extract")
def extract(body: ExtractRequest) -> dict:
    try:
        pages = extract_pages(resolve_pdf(body.path))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"pages": pages, "pageCount": len(pages)}


@app.post("/embed")
def embed(body: EmbedRequest) -> dict:
    try:
        vectors = embed_texts(body.texts)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not vectors:
        raise HTTPException(status_code=503, detail="Embedding model returned no vectors")
    return {
        "embeddings": vectors,
        "model": model_status()["model"],
        "dimension": len(vectors[0]),
    }


@app.post("/rerank")
def rerank_texts(body: RerankRequest) -> dict:
    try:
        scores = rerank(body.query, body.texts)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if len(scores) != len(body.texts):
        raise HTTPException(status_code=503, detail="Reranker returned an unexpected number of scores")
    return {"scores": scores, "model": reranker_status()["model"]}


def resolve_pdf(raw_path: str) -> Path:
    target = Path(raw_path).expanduser().resolve()
    if target.suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files can be extracted")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="PDF not found")

    upload_dir = os.getenv("UPLOAD_DIR", "").strip()
    if upload_dir:
        root = Path(upload_dir).expanduser().resolve()
        if root != target and root not in target.parents:
            raise HTTPException(status_code=400, detail="PDF path is outside UPLOAD_DIR")

    if target.read_bytes()[:5] != b"%PDF-":
        raise HTTPException(status_code=400, detail="File is not a PDF")
    return target
