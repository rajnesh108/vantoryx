import os
import threading
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

MODEL_NAME = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-mpnet-base-v2")
DIMENSION = int(os.getenv("EMBEDDING_DIM", "768"))

_model = None
_lock = threading.Lock()
_error: str | None = None


def get_model():
    global _model
    if _model is not None:
        return _model
    with _lock:
        if _model is None:
            from sentence_transformers import SentenceTransformer

            model = SentenceTransformer(MODEL_NAME)
            actual = model.get_sentence_embedding_dimension()
            if actual != DIMENSION:
                raise RuntimeError(f"Model dimension {actual} does not match EMBEDDING_DIM {DIMENSION}")
            _model = model
            print(f"Embedding model ready: {MODEL_NAME} ({actual} dimensions)", flush=True)
        return _model


def model_status() -> dict:
    if _error:
        return {"status": "error", "model": MODEL_NAME, "dimension": DIMENSION, "error": _error}
    return {
        "status": "ok" if _model is not None else "loading",
        "model": MODEL_NAME,
        "dimension": DIMENSION,
    }


def embed_texts(texts: list[str]) -> list[list[float]]:
    model = get_model()
    vectors = model.encode(
        texts,
        batch_size=32,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return [vector.tolist() for vector in vectors]


def start_loading() -> None:
    def load() -> None:
        global _error
        try:
            get_model()
        except Exception as exc:
            _error = str(exc)
            print(f"Embedding model failed to load: {exc}", flush=True)

    threading.Thread(target=load, daemon=True).start()
