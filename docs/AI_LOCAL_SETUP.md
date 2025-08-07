# AI Local Setup (BLIP + NudeNet) for MuseNest

This guide runs the Python moderation API locally (BLIP captions, NudeNet NSFW, optional pose) and integrates it with MuseNest.

## Requirements
- Python 3.9+ (Apple Silicon supported)
- Virtualenv
- Node.js (for MuseNest)

## 1) Create venv and install requirements
```bash
cd musenest
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements_v3.txt
```

## 2) Start the AI service
Choose one:
```bash
# Minimal configurable
python enhanced_minimal_v4_configurable.py --port 5005

# Moderation API v2
python enhanced_moderation_api_v2.py --port 5005
```
The service should listen on `http://localhost:5005` and expose `/health`.

## 3) Configure MuseNest to use AI
Create/update `.env` in musenest:
```
AI_SERVER_URL=http://localhost:5005
```

## 4) Start MuseNest
```bash
npm run dev
```

## 5) Verify health
- MuseNest: `http://localhost:3000/health`
- AI: `http://localhost:5005/health`
- Proxy (dev): `http://localhost:3000/_ai/health` (added by server)

## 6) Test end-to-end
- Use `test-upload.html` or admin queue pages to submit an image.
- Run JS test probes:
```bash
node test-raw-ai-response.js
node test-face-only.js
```

## Notes
- Models will be downloaded on first run (allow time).
- CPU mode works on Apple Silicon; for GPU enablement, extend the Python service accordingly.
- For production, use a managed service or containerized deployment and set `AI_SERVER_URL` to the secure endpoint. 