# MJAPANI BOT

Bot ya WhatsApp yenye auto-reply ya AI, ratiba za muda, menu yenye picha, na SESSION ID.

## Railway Variables
- PAIRING_NUMBER = namba yako bila + (mfano 255712345678)   -- au tumia SESSION_ID badala yake
- SESSION_ID = (baada ya kuunganisha mara ya kwanza, tumia !getsession kuipata; kisha deploy nyingine zijaze hii badala ya kuskani tena)
- GEMINI_API_KEY = (bure kutoka aistudio.google.com)  AU  ANTHROPIC_API_KEY
- OWNER_NAME = jina lako litakaloonekana kwenye menu
- DATA_DIR = /data
- TZ = Africa/Dar_es_Salaam

## Volume
Mount Volume kwenye `/data` (vinginevyo session na ratiba zitapotea kila deploy).

## Picha ya Menu
Faili `media/owner.jpg` ndiyo picha inayoonekana ukiandika `!menu`. Badilisha faili hili ukitaka picha nyingine (jina lazima libaki owner.jpg).

## Amri (andika kwenye chat yako mwenyewe - "Message yourself")
!menu / !help
!on  !off
!maelekezo <maandishi>
!maelekezo futa
!ratiba ongeza 22:00-06:00 <maelekezo>
!ratiba orodha
!ratiba futa <namba>
!getsession
!hali

Watu wanaozungumza na bot wanaweza pia kuandika !menu kuona huduma zinazopatikana.
