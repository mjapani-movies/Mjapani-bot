'use strict'
// MJAPANI: redirects Levanter's session download from LyFE's server to your own session site.
// Only the session request (/json/<SESSION_ID>/qwertyuiopop) is redirected; everything else is untouched.
const https = require('https')
const { urlToHttpOptions } = require('url')

const FROM = 'api.levanter.site'
const TARGET = (process.env.SESSION_API_HOST || 'bot.mjapanimovies.online')
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '')
const [TARGET_HOST, TARGET_PORT] = TARGET.split(':')
const SESSION_PATH = /^\/json\/[^/]+\/qwertyuiopop/

function rewrite(o) {
  const host = o.hostname || String(o.host || '').split(':')[0]
  if (host !== FROM || !SESSION_PATH.test(o.path || '')) return o
  const headers = {}
  for (const k of Object.keys(o.headers || {})) if (k.toLowerCase() !== 'host') headers[k] = o.headers[k]
  headers.Host = TARGET
  return Object.assign({}, o, {
    hostname: TARGET_HOST,
    host: TARGET_HOST,
    port: TARGET_PORT ? Number(TARGET_PORT) : o.port,
    servername: TARGET_HOST,
    headers,
  })
}

function normalize(args) {
  const [a0, a1, a2] = args
  let opts
  let cb
  if (typeof a0 === 'string' || a0 instanceof URL) {
    opts = Object.assign(urlToHttpOptions(new URL(a0)), a1 && typeof a1 === 'object' ? a1 : {})
    cb = typeof a1 === 'function' ? a1 : a2
  } else {
    opts = a0 || {}
    cb = typeof a1 === 'function' ? a1 : undefined
  }
  return [rewrite(opts), cb].filter((x) => x !== undefined)
}

for (const fn of ['request', 'get']) {
  const orig = https[fn]
  https[fn] = function (...args) {
    return orig.apply(this, normalize(args))
  }
}

console.log('[mjapani] session source: ' + TARGET)
