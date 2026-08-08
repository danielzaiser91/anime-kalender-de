/**
 * Setzt die DNS-Einträge für anime-kalender.de über die INWX-API.
 *
 * Zweck: Die Zone gehört zum Betrieb dieses Projekts — Webseite, Newsletter-
 * Versand und Zustellbarkeit hängen daran. Sie soll deshalb hier nachlesbar
 * und wiederholbar sein statt nur in einer Weboberfläche zu existieren.
 *
 * Das Skript ist idempotent: Ein Eintrag, der schon mit demselben Wert
 * existiert, wird übersprungen; ein abweichender wird aktualisiert.
 *
 * Aufruf:
 *   INWX_USER=… INWX_PASS=… node tools/inwx-dns.mjs           # nur anzeigen
 *   INWX_USER=… INWX_PASS=… node tools/inwx-dns.mjs --apply   # schreiben
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://api.domrobot.com/jsonrpc/'
const DOMAIN = 'anime-kalender.de'
const APPLY = process.argv.includes('--apply')

// GitHub Pages: feste Adressen, siehe
// https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site
const GITHUB_A = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153']
const GITHUB_AAAA = [
  '2606:50c0:8000::153',
  '2606:50c0:8001::153',
  '2606:50c0:8002::153',
  '2606:50c0:8003::153',
]

const DKIM =
  'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCx7DPnNDXTT7c5uEGBNav5+GG01AwN9xhm9U54kXmmc2Tg3' +
  'tcu1+kPFUFjviXb6iGir4iLFCnh3KzqXb6kt2tWChL3Kk5hqz/Pk490N6X/f3o5FOHYOltK8hG7SmsvI0Eh8QJg' +
  '1tKQsIAe+yi6Fzj90fik0aovG1JCOizpvogJxQIDAQAB'

/** name = '' bedeutet die Domain selbst. */
const RECORDS = [
  ...GITHUB_A.map((content) => ({ name: '', type: 'A', content })),
  ...GITHUB_AAAA.map((content) => ({ name: '', type: 'AAAA', content })),
  { name: 'www', type: 'CNAME', content: 'danielzaiser91.github.io' },

  // Resend: DKIM-Schlüssel, SPF und der Rückweg für Unzustellbarkeiten.
  { name: 'resend._domainkey.send', type: 'TXT', content: DKIM },
  { name: 'send.send', type: 'TXT', content: 'v=spf1 include:amazonses.com ~all' },
  { name: 'send.send', type: 'MX', content: 'feedback-smtp.eu-west-1.amazonses.com', prio: 10 },

  // Beobachtender DMARC-Eintrag: blockiert nichts, liefert aber Berichte und
  // verbessert die Zustellung bei Gmail spürbar.
  {
    name: '_dmarc',
    type: 'TXT',
    content: 'v=DMARC1; p=none; rua=mailto:danielzaiser91@googlemail.com',
  },

  // Nachweis der Domaininhaberschaft für die Google Search Console. Muss stehen
  // bleiben: Google prüft ihn nicht nur einmal, sondern von Zeit zu Zeit erneut
  // — verschwindet er, verliert das Konto den Zugriff auf die Property.
  {
    name: '',
    type: 'TXT',
    content: 'google-site-verification=dWETkl59VJiWDuqu6oZRrCbHP8YaxvJ8F07K-MmwRtM',
  },
]

function loadEnv() {
  const envPath = resolve(ROOT, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

let cookie = ''

async function call(method, params = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ method, params }),
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  const json = await res.json()
  if (json.code !== 1000 && json.code !== 1500) throw new Error(`${method}: ${json.code} ${json.msg ?? ''}`)
  return json.resData
}

/** Vergleichsform: INWX liefert den vollen Namen, wir pflegen relative. */
function fullName(name) {
  return name ? `${name}.${DOMAIN}` : DOMAIN
}

async function main() {
  loadEnv()
  const user = process.env.INWX_USER
  const pass = process.env.INWX_PASS
  if (!user || !pass) {
    console.error('INWX_USER und INWX_PASS fehlen (Umgebungsvariable oder .env)')
    process.exit(1)
  }

  await call('account.login', { user, pass })
  const info = await call('nameserver.info', { domain: DOMAIN })
  const existing = info.record ?? []

  let created = 0
  let updated = 0
  let unchanged = 0
  let removed = 0

  // INWX legt bei jeder neuen Domain drei A-Einträge auf seine Parkseite an.
  // Bleiben sie stehen, wechselt der Aufruf zufällig zwischen GitHub Pages und
  // dem Platzhalter — und der A-Eintrag auf www verhindert den nötigen CNAME.
  const PARKING_IP = '185.181.104.242'
  for (const record of existing) {
    if (record.type !== 'A' || record.content !== PARKING_IP) continue
    if (!APPLY) {
      console.log(`  -  ${record.type.padEnd(5)} ${record.name} (Parkseite von INWX)`)
      removed++
      continue
    }
    await call('nameserver.deleteRecord', { id: record.id })
    removed++
    console.log(`  -  ${record.type.padEnd(5)} ${record.name} entfernt (Parkseite)`)
  }

  for (const record of RECORDS) {
    const target = fullName(record.name)
    const match = existing.find(
      (e) => e.name === target && e.type === record.type && e.content === record.content,
    )
    if (match) {
      unchanged++
      console.log(`  =  ${record.type.padEnd(5)} ${target}`)
      continue
    }

    // Gleicher Name und Typ, anderer Inhalt: bei einzigartigen Typen ersetzen,
    // bei mehrfach erlaubten (A, AAAA, MX, TXT) zusätzlich anlegen.
    const singleton = ['CNAME'].includes(record.type)
    const conflict = singleton
      ? existing.find((e) => e.name === target && e.type === record.type)
      : undefined

    if (!APPLY) {
      console.log(`  ${conflict ? '~' : '+'}  ${record.type.padEnd(5)} ${target} → ${record.content.slice(0, 60)}`)
      conflict ? updated++ : created++
      continue
    }

    if (conflict) {
      await call('nameserver.updateRecord', {
        id: conflict.id,
        content: record.content,
        ...(record.prio !== undefined ? { prio: record.prio } : {}),
      })
      updated++
      console.log(`  ~  ${record.type.padEnd(5)} ${target} aktualisiert`)
    } else {
      await call('nameserver.createRecord', {
        domain: DOMAIN,
        type: record.type,
        name: record.name,
        content: record.content,
        ttl: 3600,
        ...(record.prio !== undefined ? { prio: record.prio } : {}),
      })
      created++
      console.log(`  +  ${record.type.padEnd(5)} ${target} angelegt`)
    }
  }

  await call('account.logout')
  console.log(
    APPLY
      ? `\nFertig: ${created} neu, ${updated} aktualisiert, ${removed} entfernt, ${unchanged} unverändert.`
      : `\nVorschau: ${created} würden angelegt, ${updated} aktualisiert, ${removed} entfernt, ${unchanged} sind schon richtig.\nZum Schreiben: node tools/inwx-dns.mjs --apply`,
  )
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
