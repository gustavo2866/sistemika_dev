from __future__ import annotations

import os

from openai import APIConnectionError, APIStatusError, AsyncOpenAI, AuthenticationError


class AudioTranscriptionService:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        language: str | None = None,
    ) -> None:
        api_key_raw = api_key or os.getenv("OPENAI_API_KEY") or ""
        self.api_key = api_key_raw.strip() or None
        self.model = model or os.getenv("OPENAI_AUDIO_TRANSCRIPTION_MODEL", "whisper-1")
        self.language = language if language is not None else os.getenv("OPENAI_AUDIO_TRANSCRIPTION_LANGUAGE", "es")
        self._client: AsyncOpenAI | None = None

    async def transcribe_bytes(
        self,
        audio_bytes: bytes,
        *,
        filename: str,
        mime_type: str | None = None,
    ) -> str:
        if not audio_bytes:
            raise ValueError("Audio vacio")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY no configurada")
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self.api_key)

        file_payload = (filename, audio_bytes, mime_type or "application/octet-stream")
        kwargs = {
            "model": self.model,
            "file": file_payload,
            "response_format": "text",
        }
        if self.language:
            kwargs["language"] = self.language

        try:
            result = await self._client.audio.transcriptions.create(**kwargs)
        except APIConnectionError as exc:
            raise ValueError("No se pudo conectar a OpenAI para transcribir audio") from exc
        except AuthenticationError as exc:
            raise ValueError("OPENAI_API_KEY invalida") from exc
        except APIStatusError as exc:
            raise ValueError(f"OpenAI transcripcion error HTTP {exc.status_code}") from exc

        if isinstance(result, str):
            return result.strip()
        text = str(getattr(result, "text", "") or "").strip()
        if not text:
            raise ValueError("OpenAI no devolvio transcripcion")
        return text


audio_transcription_service = AudioTranscriptionService()
