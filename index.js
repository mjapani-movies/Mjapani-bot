import makeWASocket, {
  useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

// ================= CONFIG =================
const DATA = process.env.DATA_DIR || './data';
const TZ = process.env.TZ || 'Africa/Dar_es_Salaam';
const PAIRING_NUMBER = (process.env.PAIRING_NUMBER || '').replace(/\D/g, '');
const SESSION_ID_ENV = process.env.SESSION_ID || ''; // njia mbadala ya kuingiza session bila pairing
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const BOT_NAME = 'MJAPANI BOT';
const OWNER_TAG = process.env.OWNER_NAME || 'Mmiliki';
const HISTORY_LIMIT = 20;
const WAIT_MS = 4000;

const SESSION_DIR = path.join(DATA, 'session');
const CREDS_FILE = path.join(SESSION_DIR, 'creds.json');
const MENU_IMG = path.join(process.cwd(), 'media', 'owner.jpg');

fs.mkdirSync(SESSION_DIR, { recursive: true });

const BASE_PROMPT = `Wewe ni ${BOT_NAME}, msaidizi wa WhatsApp anayejibu kwa niaba ya ${OWNER_TAG}.
Sheria: jibu kwa lugha ambayo mtu anaitumia (Kiswahili au Kiingereza), fupi na wazi (sentensi 1-3), kirafiki, bila kurudia salamu kila mara.
Soma mazungumzo ya awali kabla ya kujibu. Kama hakuna mazungumzo, jibu kawaida kama msaidizi wa AI.
Usijifanye ni binadamu ukiulizwa moja kwa moja. Usibuni ahadi au taarifa usizozijua; kama huna uhakika sema ${OWNER_TAG} atajibu baadaye.`;

// ================= STORAGE =================
const stateFile = path.join(DATA, 'state.json');
const histFile = path.join(DATA, 'history.json');
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const save = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2));

let state = load(stateFile, { enabled: true, extra: '', rules: [] });
let history = load(histFile, {});

// ================= SESSION ID (paste-to-deploy) =================
function bootstrapSessionFromEnv() {
  if (SESSION_ID_ENV && !fs.existsSync(CREDS_FILE)) {
    try {
      const raw = SESSION_ID_ENV.replace(/^MJAPANI~/, '');
      const json = Buffer.from(raw, 'base64').toString('utf8');
      JSON.parse(json);
      fs.writeFileSync(CREDS_FILE, json);
      console.log('✅ Session imewekwa kutoka SESSION_ID.');
    } catch (e) {
      console.log('⚠️ SESSION_ID si sahihi, nitaendelea na pairing code. (' + e.message + ')');
    }
  }
}

function exportSessionId() {
  if (!fs.existsSync(CREDS_FILE)) return null;
  const json = fs.readFileSync(CREDS_FILE, 'utf8');
  return 'MJAPANI~' + Buffer.from(json).toString('base64');
}

// ================= TIME / RULES =================
const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); };
function nowMinutes() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date());
  return Number(p.find(x => x.type === 'hour').value) % 24 * 60 + Number(p.find(x => x.type === 'minute').value);
}
function activeRules() {
  const n = nowMinutes();
  return state.rules.filter(r => {
    const a = toMin(r.from), b = toMin(r.to);
    return a <= b ? (n >= a && n < b) : (n >= a || n < b);
  });
}
function systemPrompt() {
  const t = new Intl.DateTimeFormat('sw-TZ', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' }).format(new Date());
  let s = `${BASE_PROMPT}\n\nMuda wa sasa: ${t}.`;
  if (state.extra) s += `\n\nMaelekezo ya mmiliki (yanatumika wakati wote): ${state.extra}`;
  const act = activeRules();
  if (act.length) s += `\n\nMaelekezo ya muda huu (yafuate kwa kipaumbele):\n` + act.map(r => `- ${r.text}`).join('\n');
  return s;
}

// ================= AI =================
function buildTurns(chat) {
  const turns = [];
  for (const m of chat) {
    const role = m.role === 'me' ? 'assistant' : 'user';
    if (turns.length && turns.at(-1).role === role) turns.at(-1).text += '\n' + m.text;
    else turns.push({ role, text: m.text });
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return turns;
}
async function askAI(chat) {
  const turns = buildTurns(chat);
  if (!turns.length) return null;
  if (GEMINI_KEY) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents: turns.map(t => ({ role: t.role === 'user' ? 'user' : 'model', parts: [{ text: t.text }] })),
        generationConfig: { maxOutputTokens: 300 }
      })
    });
    const j = await r.json();
    return j.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim() || null;
  }
  if (ANTHROPIC_KEY) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-5-5', max_tokens: 300, system: systemPrompt(),
        messages: turns.map(t => ({ role: t.role, content: t.text }))
      })
    });
    const j = await r.json();
    return j.content?.map(c => c.text || '').join('').trim() || null;
  }
  console.log('Hakuna API key (GEMINI_API_KEY au ANTHROPIC_API_KEY)');
  return null;
}

// ================= MENU TEXT =================
function menuText() {
  const act = activeRules();
  return `╭──⦿【 *${BOT_NAME}* 】
│ 👤 ${OWNER_TAG}
│ 🕒 ${new Intl.DateTimeFormat('sw-TZ', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}
│ ⚙️ Hali: ${state.enabled ? 'ON ✅' : 'OFF ⛔'}
╰────────────

*AMRI ZA MSINGI*
!menu – onyesha menu hii
!hali – hali ya sasa ya bot

*UDHIBITI (mmiliki pekee)*
!on / !off
!maelekezo <maandishi>
!maelekezo futa
!ratiba ongeza HH:MM-HH:MM <maelekezo>
!ratiba orodha
!ratiba futa <namba>
!getsession – pata SESSION ID yako

Ratiba zinazotumika sasa: ${act.length ? act.map(r => `${r.from}-${r.to}`).join(', ') : 'hakuna'}

_${BOT_NAME} – auto-reply yenye akili_`;
}

// ================= OWNER COMMANDS =================
async function handleCommand(sock, jid, text) {
  const [cmd, ...rest] = text.trim().split(/\s+/);
  const arg = rest.join(' ');
  switch (cmd.toLowerCase()) {
    case '!menu': case '!start': case '!msaada': case '!help': {
      if (fs.existsSync(MENU_IMG)) {
        await sock.sendMessage(jid, { image: fs.readFileSync(MENU_IMG), caption: menuText() });
      } else {
        await sock.sendMessage(jid, { text: menuText() });
      }
      return;
    }
    case '!on':
      state.enabled = true; save(stateFile, state);
      return sock.sendMessage(jid, { text: '✅ Bot imewashwa.' });
    case '!off':
      state.enabled = false; save(stateFile, state);
      return sock.sendMessage(jid, { text: '⛔ Bot imezimwa.' });
    case '!maelekezo':
      state.extra = arg.toLowerCase() === 'futa' ? '' : arg; save(stateFile, state);
      return sock.sendMessage(jid, { text: state.extra ? '✅ Maelekezo yamehifadhiwa.' : '✅ Maelekezo yamefutwa.' });
    case '!hali': {
      const act = activeRules();
      return sock.sendMessage(jid, { text:
        `Bot: ${state.enabled ? 'ON' : 'OFF'}\nMaelekezo ya kudumu: ${state.extra || 'hakuna'}\nRatiba zinazofanya kazi sasa: ${act.length ? act.map(r => `${r.from}-${r.to}`).join(', ') : 'hakuna'}` });
    }
    case '!getsession': {
      const sid = exportSessionId();
      if (!sid) return sock.sendMessage(jid, { text: '⚠️ Bado hujaunganisha bot (hakuna session).' });
      return sock.sendMessage(jid, { text:
        `🔑 *SESSION ID yako*\n\nIHIFADHI SALAMA — yeyote mwenye hii anaweza kuingia WhatsApp yako.\nTumia kama Railway Variable: SESSION_ID\n\n${sid}` });
    }
    case '!ratiba': {
      const [sub, ...r2] = rest;
      if (sub === 'orodha') {
        const txt = state.rules.length
          ? state.rules.map((r, i) => `${i + 1}. ${r.from}-${r.to}: ${r.text}`).join('\n') : 'Hakuna ratiba.';
        return sock.sendMessage(jid, { text: txt });
      }
      if (sub === 'futa') {
        const i = Number(r2[0]) - 1;
        if (!state.rules[i]) return sock.sendMessage(jid, { text: 'Namba si sahihi.' });
        state.rules.splice(i, 1); save(stateFile, state);
        return sock.sendMessage(jid, { text: '✅ Ratiba imefutwa.' });
      }
      if (sub === 'ongeza') {
        const m = (r2[0] || '').match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
        const txt = r2.slice(1).join(' ');
        if (!m || !txt) return sock.sendMessage(jid, { text: 'Tumia: !ratiba ongeza 22:00-06:00 <maelekezo>' });
        state.rules.push({ from: m[1], to: m[2], text: txt }); save(stateFile, state);
        return sock.sendMessage(jid, { text: `✅ Imeongezwa: ${m[1]}-${m[2]}` });
      }
      return sock.sendMessage(jid, { text: menuText() });
    }
    default: return false;
  }
}

// ================= BOT =================
const textOf = (m) => m.message?.conversation || m.message?.extendedTextMessage?.text ||
  m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || '';

const timers = new Map();

async function start() {
  bootstrapSessionFromEnv();
  const { state: auth, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version, auth, logger: pino({ level: 'silent' }),
    printQRInTerminal: false, browser: [BOT_NAME, 'Chrome', '1.0.0'],
    syncFullHistory: false
  });
  sock.ev.on('creds.update', saveCreds);

  if (!sock.authState.creds.registered) {
    if (!PAIRING_NUMBER) console.log('Weka PAIRING_NUMBER (mfano 255712345678) au SESSION_ID kwenye Variables.');
    else setTimeout(async () => {
      try { console.log('\n===== PAIRING CODE:', await sock.requestPairingCode(PAIRING_NUMBER), '=====\n'); }
      catch (e) { console.log('Pairing error', e.message); }
    }, 4000);
  }

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') console.log(`✅ ${BOT_NAME} imeunganishwa`);
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) console.log('Umetoka (logged out). Futa folda ya session ujaribu tena.');
      else setTimeout(start, 3000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      try {
        const jid = m.key.remoteJid;
        if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@newsletter')) continue;
        const text = textOf(m).trim();
        if (!text) continue;
        const me = jidNormalizedUser(sock.user.id);

        // Amri za mmiliki: andika kwenye chat yako mwenyewe ("Message yourself")
        if (m.key.fromMe && jidNormalizedUser(jid) === me) {
          if (text.startsWith('!')) await handleCommand(sock, jid, text);
          continue;
        }

        // Hifadhi mazungumzo
        const chat = (history[jid] ||= []);
        chat.push({ role: m.key.fromMe ? 'me' : 'user', text, t: Date.now() });
        if (chat.length > HISTORY_LIMIT) chat.splice(0, chat.length - HISTORY_LIMIT);
        save(histFile, history);
        if (m.key.fromMe) continue;

        // !menu inaweza kutumiwa na mtu yeyote anayezungumza na bot pia
        if (text.toLowerCase() === '!menu') { await handleCommand(sock, jid, text); continue; }
        if (!state.enabled) continue;

        // Subiri kidogo ujumbe zaidi, kisha jibu mara moja
        clearTimeout(timers.get(jid));
        timers.set(jid, setTimeout(async () => {
          try {
            await sock.presenceSubscribe(jid);
            await sock.sendPresenceUpdate('composing', jid);
            const reply = await askAI(history[jid]);
            await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
            await sock.sendPresenceUpdate('paused', jid);
            if (reply) {
              await sock.sendMessage(jid, { text: reply });
              history[jid].push({ role: 'me', text: reply, t: Date.now() });
              save(histFile, history);
            }
          } catch (e) { console.log('Reply error', e.message); }
        }, WAIT_MS));
      } catch (e) { console.log('Error', e.message); }
    }
  });
}
start();
