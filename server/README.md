# Localify — YouTube Extractor Server

A tiny FastAPI service that uses yt-dlp to resolve YouTube metadata and stream
audio. Designed to run on free hosting (Render, Fly.io, Railway, etc.).

## Deploy to Render (recommended, free)

1. Push this repo to GitHub (already done)
2. Go to https://dashboard.render.com → **New** → **Web Service**
3. Connect your `souvikrana/localify` repo
4. Settings:
   - **Runtime**: Docker
   - **Dockerfile**: `server/Dockerfile`
   - **Plan**: Free
   - **Health Check Path**: `/health`
5. Click **Create Web Service**

Render builds the Docker image (installs ffmpeg + yt-dlp) and gives you a URL
like `https://localify-extractor.onrender.com`.

6. Paste that URL into **Settings → YouTube Server** in the Localify app.

## Deploy to Fly.io (alternative, free)

```bash
cd server
fly launch --name localify-extractor
fly deploy
fly certs add localify-extractor.fly.dev
```

## Deploy to Railway ($1 free credit/month)

```bash
cd server
railway login
railway init
railway up
```

## Run locally

```bash
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

Then set the server URL in Settings → YouTube Server to `http://localhost:8000`.

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check |
| `/metadata?url=...` | GET | Resolve YouTube video title/artist/duration/thumbnail |
| `/download?url=...&format=mp3&quality=192` | GET | Stream audio bytes with metadata headers |

## CORS

The server allows requests from:
- `https://souvikrana.github.io` (GitHub Pages)
- `http://localhost:5173` / `http://localhost:5174` (local dev)

To add more origins, edit the `ALLOWED_ORIGINS` list in `server.py`.
