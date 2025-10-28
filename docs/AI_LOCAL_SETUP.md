# AI Local Setup (BLIP + NudeNet) for phoenix4ge

This guide runs the Python moderation API locally (BLIP captions, NudeNet NSFW, optional pose) and integrates it with phoenix4ge.

## Requirements
- Python 3.9+ (Apple Silicon supported)
- Virtualenv
- Node.js (for phoenix4ge)

## 1) Create venv and install requirements
```bash
cd phoenix4ge
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

## 3) Configure phoenix4ge to use AI
Create/update `.env` in phoenix4ge:
```
AI_SERVER_URL=http://localhost:5005
```

## 4) Start phoenix4ge
```bash
npm run dev
```

## 5) Verify health
- phoenix4ge: `http://localhost:3000/health`
- AI: `http://localhost:5005/health`
- Proxy (dev): `http://localhost:3000/_ai/health` (added by server)

## 6) Test end-to-end
- Use `tests/ui/test-upload.html` or admin queue pages to submit an image.
- Run JS smoke tests:
```bash
npm run ai:smoke
```

## Notes
- Models will be downloaded on first run (allow time).
- CPU mode works on Apple Silicon; for GPU enablement, extend the Python service accordingly.
- For production, use a managed service or containerized deployment and set `AI_SERVER_URL` to the secure endpoint. 