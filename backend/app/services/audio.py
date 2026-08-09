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


# The local macOS TTS provider cannot understand semantic mood names by itself.
# These profiles deliberately change audible TTS characteristics (rate and
# voice where available) instead of merely recording the selected mood in the
# UI. The frontend sends the same canonical mood values defined in index.html.
MOOD_PROFILES: dict[str, dict[str, Any]] = {
    "epic": {
        "rate": 155,
        "voices": ["Daniel", "Alex", "Samantha"],
    },
    "calm": {
        "rate": 125,
        "voices": ["Samantha", "Moira", "Karen", "Alex"],
    },
    "upbeat": {
        "rate": 210,
        "voices": ["Samantha", "Karen", "Alex"],
    },
    "dark": {
        "rate": 105,
        "voices": ["Alex", "Daniel", "Moira", "Samantha"],
    },
    "corporate": {
        "rate": 165,
        "voices": ["Alex", "Samantha", "Karen"],
    },
    "playful": {
        "rate": 195,
        "voices": ["Samantha", "Karen", "Moira", "Alex"],
    },
}


class AudioService:
    """Local audio synthesis service using macOS `say`.

    Mood is now a real backend input. For Voice Over, each mood selects a
    distinct TTS profile (rate + best available voice), so changing Mood
    changes the generated audio rather than only changing the history label.

    The local provider is still TTS-only. Music/sound-effect generation is
    rejected explicitly because macOS `say` cannot truthfully generate those
    media types.
    """

    _available_voices: set[str] | None = None

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        speed: float = 1.0,
        audio_type: str = "Voice Over",
        duration: int | None = None,
        mood: str = "epic",
    ) -> Dict[str, Any]:
        text = (text or "").strip()
        if not text:
            raise ValueError("Audio text/prompt cannot be empty.")

        mood_key = (mood or "epic").strip().lower()
        if mood_key not in MOOD_PROFILES:
            raise ValueError(
                f"Unsupported mood '{mood}'. Available moods: "
                + ", ".join(MOOD_PROFILES.keys())
            )

        if audio_type and audio_type != "Voice Over":
            raise RuntimeError(
                f"Audio type '{audio_type}' is not supported by the configured local "
                f"provider '{settings.AUDIO_PROVIDER}'. Select 'Voice Over' for local TTS."
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

        profile = MOOD_PROFILES[mood_key]
        selected_voice = await self._select_voice(voice, profile["voices"])
        try:
            speed_value = float(speed)
        except (TypeError, ValueError):
            speed_value = 1.0

        words_per_minute = max(
            80,
            min(300, round(profile["rate"] * speed_value)),
        )

        file_id = uuid.uuid4().hex
        aiff_path = output_dir / f"{file_id}.aiff"
        wav_path = output_dir / f"{file_id}.wav"

        await asyncio.to_thread(
            self._run_say,
            text,
            selected_voice,
            words_per_minute,
            aiff_path,
        )

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
            output_path = aiff_path
            media_type = "audio/aiff"

        logger.info(
            "Audio synthesized: file=%s provider=%s mood=%s voice=%s rate=%s",
            output_path.name,
            provider,
            mood_key,
            selected_voice,
            words_per_minute,
        )

        return {
            "audio_url": f"/api/v1/audio/files/{output_path.name}",
            "filename": output_path.name,
            "media_type": media_type,
            "provider": provider,
            "mood": mood_key,
            "voice": selected_voice,
            "rate": words_per_minute,
        }

    async def _select_voice(self, requested: str | None, candidates: list[str]) -> str:
        available = await self._get_available_voices()

        if requested and requested in available:
            return requested

        for candidate in candidates:
            if candidate in available:
                return candidate

        if settings.AUDIO_DEFAULT_VOICE in available:
            return settings.AUDIO_DEFAULT_VOICE

        # `say` normally always exposes at least one voice. If voice discovery
        # returns nothing, keep the configured name so the command reports the
        # real OS error rather than silently faking success.
        return settings.AUDIO_DEFAULT_VOICE

    async def _get_available_voices(self) -> set[str]:
        if self._available_voices is not None:
            return self._available_voices

        def discover() -> set[str]:
            result = subprocess.run(
                ["say", "-v", "?"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode != 0:
                return set()

            voices = set()
            for line in result.stdout.splitlines():
                name = line.strip().split(maxsplit=1)
                if name:
                    voices.add(name[0])
            return voices

        self._available_voices = await asyncio.to_thread(discover)
        return self._available_voices

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
