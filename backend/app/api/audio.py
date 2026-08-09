from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.services.audio import AudioService

logger = logging.getLogger("audio_api")
router = APIRouter()
_audio = AudioService()


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    voice: str | None = None
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    type: str = "Voice Over"
    duration: int | None = Field(default=None, ge=1, le=600)
    mood: str = Field(default="epic", min_length=1, max_length=32)


@router.get("/health")
async def audio_health():
    import shutil
    return {
        "success": True,
        "data": {
            "provider": settings.AUDIO_PROVIDER,
            "say_available": shutil.which("say") is not None,
            "afconvert_available": shutil.which("afconvert") is not None,
        },
    }


@router.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    try:
        result = await _audio.synthesize(
            text=req.text,
            voice=req.voice,
            speed=req.speed,
            audio_type=req.type,
            duration=req.duration,
            mood=req.mood,
        )
        return {"success": True, "data": result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        logger.error("Audio synthesis failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        logger.exception("Unexpected audio synthesis failure")
        raise HTTPException(status_code=500, detail="Audio synthesis failed. Check backend logs.")


@router.get("/files/{filename}")
async def get_audio_file(filename: str):
    output_dir = Path(settings.AUDIO_OUTPUT_DIR).resolve()
    file_path = (output_dir / filename).resolve()
    if output_dir not in file_path.parents:
        raise HTTPException(status_code=400, detail="Invalid audio path.")
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Audio file not found.")

    media_type = "audio/wav" if file_path.suffix.lower() == ".wav" else "audio/aiff"
    return FileResponse(file_path, media_type=media_type, filename=file_path.name)


@router.post("/transcribe")
async def transcribe():
    # Deliberately do not return fake transcription. A real transcription
    # provider can be added later without hiding backend failures.
    raise HTTPException(
        status_code=501,
        detail="Transcription provider is not configured yet."
    )
