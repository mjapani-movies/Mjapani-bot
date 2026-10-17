# MJAPANI BOT

WhatsApp bot with plugins, group tools, downloads and more.
Based on [Levanter](https://github.com/lyfe00011/levanter) by LyFE (MIT license). Session handling and deployment are customised for MJAPANI.

## 1. GET SESSION

1. Open **https://bot.mjapanimovies.online**
2. Tap **Phone number**, enter your WhatsApp number with country code (e.g. `255712345678`) and tap **Get pairing code**
3. In WhatsApp: **Settings → Linked devices → Link a device → Link with phone number instead**, enter the code
4. Copy your **Session ID** (it looks like `mjapani_...`). It is also sent to your own WhatsApp chat.

The Session ID stays valid for 24 hours or 5 downloads. Deploy right after you get it.

## 2. DEPLOY ON RAILWAY

1. Fork or import this repo into your own GitHub account (keep it **private** if you add secrets).
2. Railway → **New Project → Deploy from GitHub repo** → pick it.
3. In the same project tap **New → Database → PostgreSQL**. This keeps your bot's state between deploys.
4. Open the bot service → **Variables** and add:
   - `SESSION_ID` = your Session ID
   - `DATABASE_URL` = reference the Postgres service's `DATABASE_URL`
   - `VPS` = `true`
   - `AUTO_UPDATE` = `false`
5. Wait for the deploy to finish. Open **Deploy Logs**, then send `.ping` to yourself on WhatsApp.

## 3. DEPLOY ON A VPS

```bash
sudo apt update && sudo apt install -y git ffmpeg
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g yarn pm2
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git bot && cd bot
cp config.env.example config.env
nano config.env          # paste your SESSION_ID
yarn install
npm start                # starts with pm2, name: levanter
pm2 save && pm2 startup  # restart automatically after reboot
```

## Notes

- **Never commit `config.env` or your Session ID.** It gives full access to your WhatsApp.
- Keep `AUTO_UPDATE=false`, otherwise the bot may overwrite this customised code with the original.
- Your bot downloads the session from `bot.mjapanimovies.online` (change with `SESSION_API_HOST` if you host your own session site).
- YouTube downloads from datacenter servers may need extra setup (`.ytlogin` or `YT_COOKIE`).
