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

  // DMARC. Seit dem 24.08.2026 auf `quarantine`: Wer unter dieser Domain
  // schreibt, ohne SPF und DKIM zu bestehen, landet beim Empfänger im Spam.
  //
  // Die Grundlage sind 15 Google-Aggregatberichte vom 07. bis 22.08.2026:
  // 30 Mails, kein einziger dkim- oder spf-Fehlschlag, alle Absender-IPs aus
  // dem SES-Bereich (54.240.3.x / 54.240.6.x) — also aus Resends Versandweg.
  // Nach diesem Stand sortiert die schärfere Politik keine eigene Post aus.
  //
  // **`rua=` ist am 05.09.2026 entfallen, und der Grund ist der Ertrag.**
  // Hier stand vorher, die Berichte seien „das einzige Fenster darauf, ob die
  // Politik ankommt". Das stimmt so nicht: Ob sie veröffentlicht ist, sagt eine
  // DNS-Abfrage in drei Sekunden. Was die Berichte zusätzlich sagen, ist, ob
  // eine echte Mail durchfällt oder jemand Fremdes unter der Domain schreibt —
  // und über 15 Berichte war die Antwort **null und null**, bei zwei Mails am
  // Tag aus einer einzigen Quelle.
  //
  // Dafür kam täglich eine Mail bei Daniel an (05.09.2026: „ich hab dmarc
  // emails seit 24.08. jeden tag … abschalten das ich keine emails mehr
  // bekomme"). Eine Überwachung, die häufiger meldet, als sie etwas zu melden
  // hat, wird nicht mehr gelesen — dann ist sie schlechter als keine.
  //
  // **Der Schutz bleibt vollständig.** `p=quarantine` wirkt beim Empfänger,
  // nicht im Bericht; ohne `rua=` bekommen wir nur nichts mehr erzählt. Was in
  // den zwei Wochen seit der Umstellung passiert ist, liegt weiterhin in
  // Daniels Postfach, falls es je gebraucht wird.
  //
  // Wieder anschalten heißt: `rua=mailto:…` hier anhängen und `--apply`. Für
  // ein späteres `p=reject` wäre das der erste Schritt — dann aber befristet
  // und mit einem Datum, zu dem es wieder verschwindet.
  {
    name: '_dmarc',
    type: 'TXT',
    content: 'v=DMARC1; p=quarantine',
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

/**
 * Die Sorte eines TXT-Eintrags, erkennbar am `v=`-Praefix: `DMARC1`, `spf1`,
 * `DKIM1`. Ein Eintrag ohne solches Praefix (etwa die Google-Verifizierung)
 * hat keine Sorte und wird nie ersetzt, sondern immer danebengelegt.
 */
function sortePraefix(inhalt) {
  return /^v=([A-Za-z0-9]+)/.exec(inhalt ?? '')?.[1]
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

    // Gleicher Name und Typ, anderer Inhalt: ersetzen statt danebenlegen —
    // aber nur, wo ein zweiter Eintrag schadet.
    //
    // Bei TXT entscheidet nicht der Typ, sondern die Sorte. Die Wurzel traegt
    // SPF und die Google-Verifizierung nebeneinander, das ist richtig so. Zwei
    // Eintraege *derselben* Sorte sind dagegen ein Fehler: Bei DMARC verwirft
    // der Empfaenger nach RFC 7489 §6.6.3 beide und behandelt die Domain als
    // ungeschuetzt, bei DKIM und SPF ist das Verhalten ebenso unbestimmt.
    //
    // Gemessen am 24.08.2026: Ohne diese Unterscheidung haette das Heben der
    // DMARC-Politik einen zweiten _dmarc-Eintrag angelegt und den Schutz damit
    // abgeschaltet statt verschaerft.
    const singleton = ['CNAME'].includes(record.type)
    const sorte = sortePraefix(record.content)
    const conflict = singleton
      ? existing.find((e) => e.name === target && e.type === record.type)
      : record.type === 'TXT' && sorte
        ? existing.find(
            (e) => e.name === target && e.type === 'TXT' && sortePraefix(e.content) === sorte,
          )
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
