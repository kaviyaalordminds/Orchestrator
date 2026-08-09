from __future__ import annotations

import asyncio
import logging
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Any, Dict

from app.config import settings

logger = logging.getLogger("audio_service")


class AudioService:
    """Local audio synthesis service.

    The current local provider is macOS `say`, which gives us a real backend
    integration without inventing successful responses when no provider exists.
    It is intended for Voice Over/TTS. Music/sound-effect generation requires a
    dedicated provider and is reported as unsupported rather than faked.
    """

    async def synthesize(self, text: str, voice: str | None = None, speed: float = 1.0,
                         audio_type: str = "Voice Over", duration: int | None = None) -> Dict[str, Any]:
        text = (text or "").strip()
        if not text:
            raise ValueError("Audio text/prompt cannot be empty.")

        if audio_type and audio_type != "Voice Over":
            raise RuntimeError(
                f"Audio type '{audio_type}' is not supported by the configured local "
                "provider '{settings.AUDIO_PROVIDER}'. Select 'Voice Over' for local TTS."
            )

        provider = settings.AUDIO_PROVIDER.lower().strip()
        if provider != "macos_say":
            raise RuntimeError(f"Unsupported AUDIO_PROVIDER: {settings.AUDIO_PROVIDER}")

        if shutil.which("say") is None:
            raise RuntimeError(
                "The macOS 'say' command is not available. "
                "Use a supported audio provider or run the backend on macOS."
            )

        output_dir = Path(settings.AUDIO_OUTPUT_DIR).resolve()
        output_dir.mkdir(parents=True, exist_ok=True)

        file_id = uuid.uuid4().hex
        aiff_path = output_dir / f"{file_id}.aiff"
        wav_path = output_dir / f"{file_id}.wav"

        selected_voice = voice or settings.AUDIO_DEFAULT_VOICE
        try:
            speed_value = float(speed)
        except (TypeError, ValueError):
            speed_value = 1.0
        words_per_minute = max(80, min(300, round(settings.AUDIO_DEFAULT_SPEED * speed_value)))

        # `say` is synchronous; run it off the event loop.
        await asyncio.to_thread(
            self._run_say,
            text,
            selected_voice,
            words_per_minute,
            aiff_path,
        )

        # Convert to browser-friendly WAV when afconvert is available.
        if shutil.which("afconvert"):
            await asyncio.to_thread(
                self._run_afconvert,
                aiff_path,
                wav_path,
            )
            aiff_path.unlink(missing_ok=True)
            output_path = wav_path
            media_type = "audio/wav"
        else:
            # Keep AIFF as a truthful fallback. The frontend can still expose
            # the URL, but browsers may have limited AIFF support.
            output_path = aiff_path
            media_type = "audio/aiff"

        logger.info("Audio synthesized: file=%s provider=%s voice=%s", output_path.name, provider, selected_voice)

        return {
            "audio_url": f"/api/v1/audio/files/{output_path.name}",
            "filename": output_path.name,
            "media_type": media_type,
            "provider": provider,
        }

    @staticmethod
    def _run_say(text: str, voice: str, rate: int, output: Path) -> None:
        cmd = ["say", "-v", voice, "-r", str(rate), "-o", str(output), text]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "Unknown macOS speech error").strip()
            raise RuntimeError(f"macOS TTS failed: {detail}")

    @staticmethod
    def _run_afconvert(source: Path, output: Path) -> None:
        cmd = [
            "afconvert",
            "-f", "WAVE",
            "-d", "LEI16@44100",
            str(source),
            str(output),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "Unknown audio conversion error").strip()
            raise RuntimeError(f"Audio conversion failed: {detail}")
