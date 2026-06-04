"""Podcast text-to-speech — turn a two-host dialogue script into one audio file.

The ``create-podcast`` skill (in agents_back) writes a dialogue script JSON
(``speakers`` + ``turns`` of spoken ``text``); this module renders it to a single
WAV using OpenAI's TTS API.

OpenAI TTS synthesizes ONE voice per call, so we render each turn separately with
the voice mapped to that speaker, then stitch the per-turn WAV clips into one WAV
with the stdlib ``wave`` module — every clip shares the model's sample format, so
no resampling/ffmpeg is needed. A short silence between turns gives natural pacing.
The output is written atomically (temp file + ``os.replace``) so a half-finished
file is never left where the learner UI could serve it.

Config (all optional, read from the environment loaded by ``app.config``):
- ``OPENAI_API_KEY``       — required for synthesis (else generation fails cleanly).
- ``PODCAST_TTS_MODEL``    — default ``gpt-4o-mini-tts`` (``tts-1`` / ``tts-1-hd`` also work).
- ``PODCAST_VOICE_HOST``   — default ``onyx``  (the ``host`` voice_role).
- ``PODCAST_VOICE_COHOST`` — default ``nova``  (the ``cohost`` voice_role).
"""
from __future__ import annotations

import io
import logging
import os
import re
import wave
from pathlib import Path

log = logging.getLogger("platform_back.tts")

DEFAULT_MODEL = "gpt-4o-mini-tts"
DEFAULT_VOICE_HOST = "onyx"
DEFAULT_VOICE_COHOST = "nova"

# OpenAI TTS hard input limit is 4096 chars/call; stay safely under it.
MAX_TTS_CHARS = 3500
# Silence between turns (seconds) for natural pacing.
GAP_SECONDS = 0.35

# Per-role delivery hints — only sent to gpt-4o-* models, which accept an
# `instructions` steering string (tts-1 / tts-1-hd ignore tone direction).
INSTRUCTIONS = {
    "host": "You are an upbeat, warm podcast host. Speak naturally and "
            "conversationally, with light energy — like a real audio show.",
    "cohost": "You are a friendly, curious podcast co-host. Speak naturally and "
              "conversationally, warm and engaged — like a real audio show.",
}


def _voice_map() -> dict[str, str]:
    return {
        "host": os.environ.get("PODCAST_VOICE_HOST", DEFAULT_VOICE_HOST),
        "cohost": os.environ.get("PODCAST_VOICE_COHOST", DEFAULT_VOICE_COHOST),
    }


def _split_text(text: str, max_len: int = MAX_TTS_CHARS) -> list[str]:
    """Split ``text`` into ``<= max_len`` chunks at sentence boundaries. Turns are
    usually short, so this normally returns a single chunk; it only kicks in for an
    unusually long single turn (and hard-splits a single over-long sentence)."""
    text = " ".join(text.split())
    if not text:
        return []
    if len(text) <= max_len:
        return [text]
    chunks: list[str] = []
    cur = ""

    def flush() -> None:
        nonlocal cur
        if cur:
            chunks.append(cur)
            cur = ""

    for sentence in re.split(r"(?<=[.!?])\s+", text):
        if len(sentence) > max_len:
            flush()
            for i in range(0, len(sentence), max_len):
                chunks.append(sentence[i:i + max_len])
            continue
        if not cur:
            cur = sentence
        elif len(cur) + 1 + len(sentence) <= max_len:
            cur += " " + sentence
        else:
            flush()
            cur = sentence
    flush()
    return chunks


def _synthesize_clip(client, model: str, voice: str, text: str, role: str) -> bytes:
    """Render one piece of text to WAV bytes with the given voice."""
    kwargs = {"model": model, "voice": voice, "input": text, "response_format": "wav"}
    if model.startswith("gpt-4o") and role in INSTRUCTIONS:
        kwargs["instructions"] = INSTRUCTIONS[role]
    with client.audio.speech.with_streaming_response.create(**kwargs) as response:
        return response.read()


def synthesize_podcast(script: dict, out_path: str | Path) -> Path:
    """Render a podcast dialogue ``script`` to a single WAV at ``out_path``.

    Raises on any failure (missing API key, no turns, TTS error) — the caller
    (the admin background worker) catches it and marks the podcast failed. On
    success the audio appears atomically at ``out_path``.
    """
    turns = script.get("turns") or []
    if not turns:
        raise ValueError("podcast script has no turns")

    # speaker id -> voice_role ("host"/"cohost"), then -> concrete voice.
    role_by_speaker: dict[str, str] = {}
    for sp in script.get("speakers") or []:
        sid = sp.get("id")
        if sid:
            role_by_speaker[sid] = sp.get("voice_role") or sid
    voices = _voice_map()
    model = os.environ.get("PODCAST_TTS_MODEL", DEFAULT_MODEL)

    # Import + construct lazily so a missing OPENAI_API_KEY fails only here (during
    # generation), never at app import/startup.
    from openai import OpenAI
    client = OpenAI()

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = out_path.with_name(out_path.name + ".tmp")

    writer: wave.Wave_write | None = None
    gap_frames = b""
    clips = 0
    try:
        for turn in turns:
            text = (turn.get("text") or "").strip()
            if not text:
                continue
            role = role_by_speaker.get(turn.get("speaker", ""), turn.get("speaker", "host"))
            if role not in ("host", "cohost"):
                role = "host"
            voice = voices[role]
            for chunk in _split_text(text):
                audio = _synthesize_clip(client, model, voice, chunk, role)
                with wave.open(io.BytesIO(audio), "rb") as clip:
                    cp = clip.getparams()
                    frames = clip.readframes(clip.getnframes())
                if writer is None:
                    writer = wave.open(str(tmp_path), "wb")
                    writer.setnchannels(cp.nchannels)
                    writer.setsampwidth(cp.sampwidth)
                    writer.setframerate(cp.framerate)
                    gap_frames = b"\x00" * (int(cp.framerate * GAP_SECONDS) * cp.nchannels * cp.sampwidth)
                writer.writeframes(frames)
                clips += 1
            if writer is not None:
                writer.writeframes(gap_frames)  # pause between turns
        if writer is None:
            raise ValueError("podcast script produced no audio (all turns empty)")
        writer.close()
        writer = None
        os.replace(tmp_path, out_path)  # atomic: file appears only when complete
        log.info("Synthesized %d clips from %d turns -> %s", clips, len(turns), out_path)
        return out_path
    finally:
        if writer is not None:
            writer.close()
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass
