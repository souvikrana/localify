"""
Localify — YouTube extraction server.

Minimal FastAPI service that uses yt-dlp to resolve YouTube metadata
and stream audio. Designed to run on free hosting (Render, Fly.io, etc.).
"""

import asyncio
import os
import re
import tempfile
from pathlib import Path
from typing import Optional

import yt_dlp
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="Localify Extractor", version="1.0.0")

# Allow the GitHub Pages frontend (and local dev)
ALLOWED_ORIGINS = [
    "https://souvikrana.github.io",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:4173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _extract_video_id(url: str) -> Optional[str]:
    """Pull the 11-char video ID from any YouTube URL variant."""
    patterns = [
        r"(?:youtube\.com/watch\?.*v=|youtu\.be/|youtube\.com/shorts/|youtube\.com/embed/|youtube\.com/v/)([a-zA-Z0-9_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


def _make_ydl_opts(audio_format: str = "mp3", audio_quality: str = "192") -> dict:
    return {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "format": "bestaudio/best",
        # Extract audio as mp3 (most compatible) — yt-dlp + ffmpeg handle this
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": audio_format,
                "preferredquality": audio_quality,
            }
        ],
        # Concurrency safety: don't let yt-dlp touch the global cookie jar
        "cookiefile": None,
    }


# ── Metadata endpoint (fast, no audio download) ──────────────────────────


@app.get("/metadata")
async def get_metadata(url: str = Query(..., description="YouTube URL")):
    video_id = _extract_video_id(url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Not a valid YouTube URL")

    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "format": "bestaudio/best",
    }

    def _extract():
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            return info

    try:
        info = await asyncio.to_thread(_extract)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Extraction failed: {exc}")

    thumbnail = info.get("thumbnail") or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
    return {
        "videoId": video_id,
        "title": info.get("title") or f"YouTube Video ({video_id})",
        "artist": info.get("uploader") or info.get("channel"),
        "duration": info.get("duration"),
        "thumbnail": thumbnail,
    }


# ── Download endpoint (streams audio bytes) ──────────────────────────────


@app.get("/download")
async def download_audio(
    url: str = Query(..., description="YouTube URL"),
    format: str = Query("mp3", regex="^(mp3|opus|m4a)$"),
    quality: str = Query("192", regex="^(128|192|256|320)$"),
):
    video_id = _extract_video_id(url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Not a valid YouTube URL")

    with tempfile.TemporaryDirectory() as tmpdir:
        output_template = str(Path(tmpdir) / "audio.%(ext)s")

        opts = {
            "quiet": True,
            "no_warnings": True,
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": format,
                    "preferredquality": quality,
                }
            ],
            "cookiefile": None,
        }

        def _download():
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)
                return info

        try:
            info = await asyncio.to_thread(_download)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Download failed: {exc}")

        audio_path = Path(tmpdir) / f"audio.{format}"
        if not audio_path.exists():
            # Fallback: find whatever yt-dlp produced
            candidates = list(Path(tmpdir).glob("audio.*"))
            if candidates:
                audio_path = candidates[0]
            else:
                raise HTTPException(status_code=500, detail="Audio file not found after extraction")

        filename = f"{info.get('title', 'youtube-audio')}.{format}"
        # Sanitize filename
        filename = re.sub(r'[^\w\s\-.]', '', filename).strip()
        if not filename:
            filename = f"youtube-audio.{format}"

        content_type = {
            "mp3": "audio/mpeg",
            "opus": "audio/opus",
            "m4a": "audio/mp4",
        }[format]

        def iter_file():
            with open(audio_path, "rb") as f:
                while chunk := f.read(65536):
                    yield chunk

        return StreamingResponse(
            iter_file(),
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Video-Title": info.get("title", ""),
                "X-Video-Artist": info.get("uploader", ""),
                "X-Video-Duration": str(info.get("duration", "")),
                "X-Video-Thumbnail": info.get("thumbnail", ""),
            },
        )


# ── Health check ─────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "ok", "service": "localify-extractor"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
