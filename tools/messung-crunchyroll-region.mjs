/**
 * Einmalige Messung: Lässt sich Crunchyrolls Content-API **ohne Anmeldung** dazu
 * bringen, den deutschen Katalog statt des US-Katalogs zu liefern?
 *
 * Warum das hier steht und nicht in `pipeline/`: Es ist kein Abruf, der etwas in
 * den Datensatz schreibt, sondern ein Versuchsaufbau. Er gehört in keinen
 * Workflow und in keine Frist — er wird von Hand gestartet, wenn jemand die
 * Frage erneut stellt. Das Ergebnis des Laufs vom 22.08.2026 steht in
 * `docs/messung-crunchyroll-region.md`.
 *
 * Der Prüfstein ist „Fairy Tail" (Serie G6DQDD3WR): In Deutschland tragen die
 * Folgen 1 bis 277 eine deutsche Tonspur (Daniel, 22.08.2026), in der
 * US-Antwort steht bei allen drei Blöcken nur `ja-JP, en-US`. Taucht in
 * `versions` der ersten beiden Blöcke ein `de-DE` auf, hat der Versuch die
 * deutsche Sicht erreicht — alles andere ist weiterhin US.
 *
 * Ein Parameter, den die API nicht kennt, wird stillschweigend ignoriert.
 * Deshalb entscheidet allein der Prüfstein, nie der HTTP-Status.
 *
 * Aufruf: node tools/messung-crunchyroll-region.mjs [--pause 500]
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
const SERIE = 'G6DQDD3WR'
const AUFWAERM_SEITE = 'https://www.crunchyroll.com/de/series/GRDV0019R'

const args = process.argv.slice(2)
const PAUSE_MS = args.indexOf('--pause') >= 0 ? Number(args[args.indexOf('--pause') + 1]) : 500
/** Crunchyroll sperrt nach rund 300 Serien; hier geht es um Erkenntnis, nicht um Menge. */
const OBERGRENZE = 40
/**
 * Nur die Nachfass-Abrufe (Schritt 6), ohne die ganze Matrix.
 *
 * Der Lauf vom 22.08.2026 hat die Matrix schon abgearbeitet; danach fehlten zwei
 * Antworten im Wortlaut. Sie einzeln nachzuholen kostet vier Abrufe statt 22 —
 * und die Obergrenze von 40 gilt für den Tag, nicht für den Aufruf.
 */
const NUR_NACHFASSEN = args.includes('--nur-nachfassen')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let abrufe = 0
const protokoll = []

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ userAgent: CHROME, locale: 'de-DE', viewport: { width: 1280, height: 900 } })

  /** Ein Aufruf im Kontext der geladenen Seite — ein direkter `fetch` bekommt Cloudflares 403. */
  const hole = async (url, { methode = 'GET', kopf = {}, koerper } = {}) => {
    if (++abrufe > OBERGRENZE) throw new Error(`Obergrenze von ${OBERGRENZE} Abrufen erreicht`)
    const antwort = await page
      .evaluate(
        async ([u, m, k, b]) => {
          const r = await fetch(u, { method: m, headers: k, body: b ?? undefined })
          return { status: r.status, text: await r.text() }
        },
        [url, methode, kopf, koerper ?? null],
      )
      .catch((err) => ({ status: 0, text: err.message }))
    await sleep(PAUSE_MS)
    return antwort
  }

  // Aufwärmen: eine Seite laden, damit `fetch` aus dem richtigen Ursprung kommt.
  await page.goto(AUFWAERM_SEITE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await sleep(PAUSE_MS)

  // ── Schritt 1: Was sagt das Token über die Region? ──────────────────────────
  const tokenAntwort = await hole('https://www.crunchyroll.com/auth/v1/token', {
    methode: 'POST',
    kopf: {
      authorization: 'Basic Y3Jfd2ViOg==',
      'content-type': 'application/x-www-form-urlencoded',
    },
    koerper: 'grant_type=client_id',
  })
  console.log('=== POST /auth/v1/token ===')
  console.log('HTTP', tokenAntwort.status)
  console.log(tokenAntwort.text)
  const token = JSON.parse(tokenAntwort.text).access_token
  protokoll.push({ versuch: 'POST /auth/v1/token', status: tokenAntwort.status, roh: tokenAntwort.text })

  // Dasselbe noch einmal, aber mit deutschen Sprach- und Herkunftsangaben im
  // Kopf. Wenn die Region am Token hängt, muss sie sich hier zeigen.
  if (!NUR_NACHFASSEN) {
    const tokenDe = await hole('https://www.crunchyroll.com/auth/v1/token', {
      methode: 'POST',
      kopf: {
        authorization: 'Basic Y3Jfd2ViOg==',
        'content-type': 'application/x-www-form-urlencoded',
        'accept-language': 'de-DE,de;q=0.9',
        'x-forwarded-for': '85.214.132.117',
        'cf-ipcountry': 'DE',
      },
      koerper: 'grant_type=client_id&device_type=Chrome%20on%20Windows',
    })
    console.log('\n=== POST /auth/v1/token (mit Accept-Language/X-Forwarded-For/CF-IPCountry) ===')
    console.log('HTTP', tokenDe.status)
    console.log(tokenDe.text)
    protokoll.push({ versuch: 'POST /auth/v1/token + de-Header', status: tokenDe.status, roh: tokenDe.text })
  }

  // ── Schritt 2: der CMS-Bucket aus /index/v2 ────────────────────────────────
  const index = await hole('https://www.crunchyroll.com/index/v2', {
    kopf: { authorization: `Bearer ${token}` },
  })
  console.log('\n=== GET /index/v2 ===')
  console.log('HTTP', index.status)
  console.log(index.text)
  protokoll.push({ versuch: 'GET /index/v2', status: index.status, roh: index.text })

  let signatur = null
  try {
    const j = JSON.parse(index.text)
    const cms = j.cms_web ?? j.cms ?? j.cms_beta
    if (cms) signatur = cms
  } catch {
    /* unten als Nichtauskunft sichtbar */
  }
  console.log('\nBucket:', signatur?.bucket ?? '(keiner)')

  // ── Schritt 3: die Parameter-Matrix am Prüfstein ───────────────────────────
  const basis = `https://www.crunchyroll.com/content/v2/cms/series/${SERIE}/seasons`
  const versuche = [
    ['Kontrolle: nur locale', `${basis}?locale=de-DE`, {}],
    ['preferred_audio_language', `${basis}?locale=de-DE&preferred_audio_language=de-DE`, {}],
    ['force_locale', `${basis}?locale=de-DE&force_locale=true`, {}],
    ['country', `${basis}?locale=de-DE&country=DE`, {}],
    ['region', `${basis}?locale=de-DE&region=DE`, {}],
    ['geo', `${basis}?locale=de-DE&geo=DE`, {}],
    ['eligible_region', `${basis}?locale=de-DE&eligible_region=DE`, {}],
    ['audio_locale', `${basis}?locale=de-DE&audio_locale=de-DE`, {}],
    ['alle Parameter zusammen', `${basis}?locale=de-DE&preferred_audio_language=de-DE&force_locale=true&country=DE&region=DE&geo=DE`, {}],
    ['Header Accept-Language', `${basis}?locale=de-DE`, { 'accept-language': 'de-DE,de;q=0.9' }],
    ['Header CR-Locale', `${basis}?locale=de-DE`, { 'cr-locale': 'de-DE' }],
    ['Header X-Forwarded-For (DE)', `${basis}?locale=de-DE`, { 'x-forwarded-for': '85.214.132.117' }],
    ['Header CF-IPCountry (DE)', `${basis}?locale=de-DE`, { 'cf-ipcountry': 'DE' }],
    ['Header X-Cr-Country', `${basis}?locale=de-DE`, { 'x-cr-country': 'DE' }],
  ]

  for (const [name, url, kopf] of NUR_NACHFASSEN ? [] : versuche) {
    const a = await hole(url, { kopf: { authorization: `Bearer ${token}`, ...kopf } })
    protokoll.push({ versuch: name, url, kopf, status: a.status, ...pruefstein(a) })
    melde(name, url, kopf, a)
  }

  // ── Schritt 4: der ältere CMS-Pfad mit Land im Bucket ──────────────────────
  if (signatur) {
    const sig = `Policy=${encodeURIComponent(signatur.policy)}&Signature=${encodeURIComponent(signatur.signature)}&Key-Pair-Id=${encodeURIComponent(signatur.key_pair_id)}`
    const eigen = `https://www.crunchyroll.com/cms/v2${signatur.bucket}/seasons?series_id=${SERIE}&locale=de-DE&${sig}`
    const deutsch = `https://www.crunchyroll.com/cms/v2${String(signatur.bucket).replace(/^\/[A-Z]{2}\//, '/DE/')}/seasons?series_id=${SERIE}&locale=de-DE&${sig}`
    for (const [name, url] of NUR_NACHFASSEN
      ? [['CMS v2, eigener Bucket', eigen]]
      : [
          ['CMS v2, eigener Bucket', eigen],
          ['CMS v2, Bucket auf DE gebogen', deutsch],
        ]) {
      const a = await hole(url, { kopf: { authorization: `Bearer ${token}` } })
      // Der ältere Pfad führt je Tonspur eine eigene Staffel — bei „Fairy Tail"
      // sechs statt drei. Abgeschnitten wäre der Befund „keine deutsche
      // Staffel" nur die halbe Liste.
      protokoll.push({ versuch: name, url, status: a.status, ...pruefstein(a), roh: kuerze(a.text, 60000) })
      melde(name, url, {}, a)
      /**
       * Der ältere Pfad antwortet in einer anderen Form.
       *
       * `pruefstein()` sucht `data` — das gibt es hier nicht, die Liste heißt
       * `items`. Ohne diese Ausgabe stand im ersten Lauf „(keine Staffel)", und
       * das hätte man für einen leeren Katalog halten können statt für ein
       * anderes Antwortschema.
       */
      if (name.includes('eigener')) console.log('  Rohantwort:', kuerze(a.text))
    }
  }

  // ── Schritt 5: was die Serienebene selbst sagt ─────────────────────────────
  const serie = await hole(`https://www.crunchyroll.com/content/v2/cms/series/${SERIE}?locale=de-DE`, {
    kopf: { authorization: `Bearer ${token}` },
  })
  console.log('\n=== GET /content/v2/cms/series/G6DQDD3WR ===')
  console.log('HTTP', serie.status)
  console.log(kuerze(serie.text))
  protokoll.push({ versuch: 'GET /content/v2/cms/series (Serienebene)', status: serie.status, roh: kuerze(serie.text) })

  /**
   * ── Schritt 6: die Folgenebene, wie sie der Datensatz sieht ────────────────
   *
   * Der erste Block von „Fairy Tail" (GYQ4KKN16, 175 Folgen). Hier steht
   * `eligible_region` — das Feld, an dem der Befund vom 21.08.2026 hängt. Ohne
   * diesen Abruf wäre der Bericht auf das Archiv angewiesen, und das ist einen
   * Tag alt.
   */
  const folgen = await hole('https://www.crunchyroll.com/content/v2/cms/seasons/GYQ4KKN16/episodes?locale=de-DE', {
    kopf: { authorization: `Bearer ${token}` },
  })
  const j = folgen.status === 200 ? JSON.parse(folgen.text) : { data: [] }
  const regionen = [...new Set((j.data ?? []).map((f) => f.eligible_region))]
  const deutsche = (j.data ?? []).filter((f) => (f.versions ?? []).some((v) => v.audio_locale === 'de-DE')).length
  console.log('\n=== GET /content/v2/cms/seasons/GYQ4KKN16/episodes (Fairy Tail, Block 1) ===')
  console.log(`HTTP ${folgen.status} — ${(j.data ?? []).length} Folgen, eligible_region: ${regionen.join(',')}, davon mit de-DE: ${deutsche}`)
  protokoll.push({
    versuch: 'GET /content/v2/cms/seasons/GYQ4KKN16/episodes',
    status: folgen.status,
    folgen: (j.data ?? []).length,
    regionen,
    mitDeutsch: deutsche,
  })

  await browser.close()
  writeFileSync('/tmp/messung-crunchyroll-region.json', JSON.stringify(protokoll, null, 2))
  console.log(`\n${abrufe} Abrufe. Protokoll: /tmp/messung-crunchyroll-region.json`)
}

/**
 * Wirft Bilder und Fließtext heraus, damit die Sprachfelder sichtbar bleiben.
 *
 * Im ersten Lauf war die Antwort auf 4.000 Zeichen abgeschnitten — davon gingen
 * 3.400 für Bildadressen in acht Auflösungen drauf, und `audio_locales` stand
 * dahinter. Abschneiden ohne Ausdünnen misst die Bildergalerie, nicht die
 * Auskunft.
 */
function kuerze(text, grenze = 6000) {
  try {
    const j = JSON.parse(text)
    const ohne = (o) => {
      if (Array.isArray(o)) return o.map(ohne)
      if (o && typeof o === 'object') {
        return Object.fromEntries(
          Object.entries(o)
            .filter(([k]) => !['images', 'description', 'extended_description', 'keywords'].includes(k))
            .map(([k, v]) => [k, ohne(v)]),
        )
      }
      return o
    }
    return JSON.stringify(ohne(j), null, 1).slice(0, grenze)
  } catch {
    return text.slice(0, 1000)
  }
}

/**
 * Der Prüfstein: Steht in `versions` der ersten beiden Blöcke ein `de-DE`?
 *
 * Zusätzlich festgehalten wird, ob irgendwo in der Rohantwort ein `de-DE`
 * vorkommt — sonst hinge der Befund an der Annahme, dass die Blockreihenfolge
 * stabil ist.
 */
function pruefstein(antwort) {
  let staffeln = []
  try {
    staffeln = JSON.parse(antwort.text).data ?? []
  } catch {
    return { gefunden: false, tonspuren: '(keine JSON-Antwort)', irgendwoDe: false }
  }
  const tonspuren = staffeln.map((s) => (s.versions ?? []).map((v) => v.audio_locale).join(','))
  return {
    gefunden: tonspuren.slice(0, 2).some((t) => t.includes('de-DE')),
    tonspuren: tonspuren.join(' | ') || '(keine Staffel)',
    irgendwoDe: antwort.text.includes('de-DE'),
  }
}

function melde(name, url, kopf, antwort) {
  const p = pruefstein(antwort)
  console.log(
    `\n[${p.gefunden ? 'DEUTSCH' : 'US'}] ${name}\n  ${url}\n  Header: ${JSON.stringify(kopf)}\n  HTTP ${antwort.status} — versions: ${p.tonspuren}` +
      (p.gefunden ? '' : p.irgendwoDe ? '  (de-DE kommt irgendwo in der Antwort vor)' : ''),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
