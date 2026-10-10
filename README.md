# MJAPANI BOT

WhatsApp auto-reply bot with AI, schedules and menu.

## Railway Variables
- `SESSION_ID` = from the session website (recommended). A new value always replaces the old session.
- `PAIRING_NUMBER` = your number without + (only if you have no SESSION_ID; the code appears in Deploy Logs)
- `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY`)
- `GEMINI_MODEL` = optional, default `gemini-2.5-flash`
- `OWNER_NAME`, `DATA_DIR=/data`, `TZ=Africa/Dar_es_Salaam`

Mount a Volume at `/data` so schedules and history survive deploys.

## Owner commands (send in "Message yourself")
!menu  !on  !off  !hali  !getsession
!maelekezo <text> | !maelekezo futa
!ratiba ongeza 22:00-06:00 <text> | !ratiba orodha | !ratiba futa <n>

Health: `GET /` returns bot status (keeps the service alive on Railway).
