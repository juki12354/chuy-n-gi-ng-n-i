# Sonix quota/workspace integration

## Implemented

- Sonix/AssemblyAI provider flow remains in `backend/services/transcriptionService.js`.
- Added Free/Premium quota controls:
  - Free default: 30 minutes.
  - Premium default: 50 hours.
  - Per-plan upload MB, max recording seconds, max file duration.
- Added backend quota endpoints:
  - `GET /api/quota`
  - `PATCH /api/quota/alert`
  - `POST /api/quota/upgrade` (mock upgrade for local/dev, replace with payment webhook later)
- Enforced quota in:
  - `POST /api/transcribe`
  - `POST /api/v1/transcribe`
- Added `processing_seconds` to transcription history.
- Frontend quota panel shows plan, remaining time, alert threshold, upgrade CTA.
- Upload validates file type, file size, and media duration before calling backend.
- Recording blocks when quota is exhausted and auto-stops at plan/session limit.

## Env controls

```env
FREE_PLAN_SECONDS=1800
FREE_MAX_UPLOAD_MB=25
FREE_MAX_RECORD_SECONDS=600
FREE_MAX_FILE_SECONDS=1800
PREMIUM_PLAN_SECONDS=180000
PREMIUM_MAX_UPLOAD_MB=200
PREMIUM_MAX_RECORD_SECONDS=7200
PREMIUM_MAX_FILE_SECONDS=10800
DEFAULT_QUOTA_ALERT_SECONDS=300
```

## Payment note

`POST /api/quota/upgrade` is intentionally a local/dev mock. In production, replace it with a real payment provider checkout and webhook that updates `users.plan` and `users.quota_seconds`.
