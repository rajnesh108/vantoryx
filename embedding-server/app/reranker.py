import os
import threading
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

MODEL_NAME = os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-base")

_model = None
_lock = threading.Lock()
_error: str | None = None


def get_model():
    global _model
    if _model is not None:
        return _model
    with _lock:
        if _model is None:
            from sentence_transformers import CrossEncoder

            _model = CrossEncoder(MODEL_NAME)
            print(f"Reranker ready: {MODEL_NAME}", flush=True)
        return _model


def model_status() -> dict:
    if _error:
        return {"status": "error", "model": MODEL_NAME, "error": _error}
    return {
        "status": "ok" if _model is not None else "loading",
        "model": MODEL_NAME,
    }


def rerank(query: str, texts: list[str]) -> list[float]:
    model = get_model()
    scores = model.predict(
        [[query, text] for text in texts],
        batch_size=16,
        show_progress_bar=False,
    )
    return [float(score) for score in scores]


def start_loading() -> None:
    def load() -> None:
        global _error
        try:
            get_model()
        except Exception as exc:
            _error = str(exc)
            print(f"Reranker failed to load: {exc}", flush=True)

    threading.Thread(target=load, daemon=True).start()
