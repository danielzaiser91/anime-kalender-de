#!/usr/bin/env node
/**
 * **Wie der Trailer-Dialog wirklich aussieht — und ob er tut, was er soll.**
 *
 * Die Pille „Trailer anschauen" misst `panel-bild.mjs` mit. Was hinter ihrem
 * Klick liegt, sieht ein Bild vom Panel nie: Ein Lauf, der nie klickt, prüft
 * grundsätzlich nicht, was hinter einer Interaktion liegt — dieselbe Lehre wie
 * bei der Nachrichtenansicht am 12.09.2026.
 *
 * Gemessen wird, was Daniel am 12.09.2026 vorgegeben hat: „overlay dialog mit
 * 95% width und height", „ein x button oben rechts um es zu schließen", „über
 * dem embedded video steht was es ist (trailer für <titel des anime films>)",
 * „ein link-button element … mit label ‚in youtube öffnen'".
 *
 * **Das Video selbst wird nicht geladen.** Der Abruf an YouTube wird
 * abgewiesen und durch eine leere Seite ersetzt: Die Prüfung misst unseren
 * Rahmen, nicht YouTubes Player — und sie soll ohne Fremdabruf laufen. Dass
 * die Adresse stimmt, wird am `src` geprüft, nicht am Inhalt.
 *
 * Aufruf: `node tools/trailer-dialog-bild.mjs [titelId]` · `npm run check:trailer`
 * Ergebnis: `docs/trailer-dialog-<thema>.png`
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(WURZEL, 'dist')
const TYPEN = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
}

if (!existsSync(DIST)) {
  console.error('Kein dist/ — vorher `npm run build`.')
  process.exit(1)
}

/*
  **Die Titel werden gesucht, nicht festgeschrieben.**

  Eine feste Kennung koppelt die Prüfung an den Datenstand: Verliert „A New
  Dawn" seinen Trailer, wird sie rot, obwohl nichts kaputt ist — genau der
  Fehler, der am 25.08.2026 drei Deploys aufgehalten hat („Eine Prüfung, die rot
  wird, weil die Arbeit erledigt ist, misst das Falsche").

  Geprüft werden **beide** Fälle: ein deutscher Trailer (der Regelfall, für den
  das gebaut ist) und ein fremdsprachiger (56 gegen 442 im Bestand). Der zweite
  hat einen eigenen Text und eine eigene Farbe; ihn nicht zu prüfen hieße, die
  häufigere Hälfte ungesehen auszuliefern.
*/
const titles = JSON.parse(await readFile(path.join(DIST, 'data', 'titles.json'), 'utf8'))
const gewaehlt = Number(process.argv[2])
const FAELLE = gewaehlt
  ? [{ art: 'gewählt', id: gewaehlt }]
  : [
      { art: 'deutsch', id: titles.find((t) => t.trailer?.sprache === 'de')?.id },
      { art: 'fremd', id: titles.find((t) => t.trailer && t.trailer.sprache !== 'de')?.id },
    ].filter((f) => f.id)

/*
  Kein Titel mit Trailer heißt: Der Datenlauf war noch nicht dran. Das ist ein
  Zustand, kein Fehler — die Prüfung sagt es und endet grün.
*/
if (!FAELLE.length) {
  console.log('Kein Titel mit Trailer im Datensatz — nichts zu prüfen (`npm run data:trailer`).')
  process.exit(0)
}

const browser = await chromium.launch()
const seite = await browser.newPage({ viewportSize: { width: 1280, height: 900 } })

await seite.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  /* YouTube wird nicht gefragt — gemessen wird unser Rahmen. */
  if (/youtube(-nocookie)?\.com|ytimg\.com/.test(url.hostname)) {
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>—</title>' })
  }
  if (url.hostname !== 'ak.test') {
    return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) })
  }
  const datei = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname)
  if (!existsSync(datei)) {
    return route.fulfill({ status: 200, contentType: 'text/html', body: await readFile(path.join(DIST, 'index.html')) })
  }
  return route.fulfill({
    status: 200,
    contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream',
    body: await readFile(datei),
  })
})

const fehler = []
const pruefe = (was, ok, zusatz) => {
  console.log(`  ${ok ? 'ok  ' : 'FEHL'} ${was}${ok || zusatz === undefined ? '' : ` — ${zusatz}`}`)
  if (!ok) fehler.push(was)
}

/** Läuft im Browser: alles, was ein Bild nicht beantwortet. */
function messen() {
  const d = document.querySelector('[role="dialog"][aria-modal="true"]')
  const kasten = d?.firstElementChild
  const k = kasten?.getBoundingClientRect()
  const rahmen = d?.querySelector('iframe')
  const knopf = [...(d?.querySelectorAll('a') ?? [])].find((a) => /youtube/i.test(a.textContent ?? ''))
  const x = d?.querySelector('button[aria-label]')
  return {
    breite: Math.round(((k?.width ?? 0) / window.innerWidth) * 100),
    hoehe: Math.round(((k?.height ?? 0) / window.innerHeight) * 100),
    ueberschrift: d?.querySelector('h2')?.textContent?.trim() ?? '',
    src: rahmen?.getAttribute('src') ?? '',
    rahmenHoehe: Math.round(rahmen?.getBoundingClientRect().height ?? 0),
    youtubeKnopf: knopf?.textContent?.trim() ?? '',
    youtubeZiel: knopf?.getAttribute('href') ?? '',
    /* „oben rechts" wird gemessen, nicht geglaubt. */
    xRechts: Math.round((k?.right ?? 0) - (x?.getBoundingClientRect().right ?? 0)),
    xOben: Math.round((x?.getBoundingClientRect().top ?? 0) - (k?.top ?? 0)),
    /* Die Seite darunter darf nicht mitscrollen. */
    koerperGesperrt: getComputedStyle(document.body).overflow === 'hidden',
    /*
      **Die Lage, nicht nur die Größe.** Der erste Entwurf maß „95 % breit"
      und war zufrieden — auf dem Bild ragte der Dialog rechts aus dem
      Fenster, weil er im Panel hing statt am Körper. Eine Breite sagt
      nichts darüber, wo etwas anfängt.
    */
    linksFrei: Math.round(k?.left ?? 0),
    rechtsFrei: Math.round(window.innerWidth - (k?.right ?? 0)),
    obenFrei: Math.round(k?.top ?? 0),
  }
}

const messungen = {}
for (const fall of FAELLE) {
  console.log(`\nFall „${fall.art}" an Titel ${fall.id}:\n`)
  for (const thema of ['dunkel', 'hell']) {
    await seite.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
    await seite.goto('about:blank')
    await seite.goto(`http://ak.test/#/datenbank?t=${fall.id}`, { waitUntil: 'networkidle' })

    /* Der Text wechselt mit der Sprache — gefunden wird über das gemeinsame Wort. */
    const pille = seite.getByRole('button', { name: /Trailer/ })
    await pille.waitFor({ state: 'visible', timeout: 15_000 })
    /* Ohne das Abspieldreieck aus dem Icon — `textContent` nimmt es mit. */
    const pillenText = ((await pille.textContent()) ?? '').replace(/[^\p{L}\p{N} ]+/gu, '').trim()
    await pille.click()

    const dialog = seite.getByRole('dialog', { name: /Trailer für/ })
    await dialog.waitFor({ state: 'visible', timeout: 10_000 })

    if (thema === 'dunkel') {
      messungen[fall.art] = { ...(await seite.evaluate(messen)), pillenText }
    }

    /* Nur der Regelfall wird abgebildet — zwei Bilder je Thema wären vier gleiche. */
    if (fall.art !== 'fremd') {
      await seite.screenshot({ path: path.join(WURZEL, 'docs', `trailer-dialog-${thema}.png`) })
    }

    /* Escape schließt — auf dem Handy ist das X weit weg vom Daumen. */
    await seite.keyboard.press('Escape')
    const wegDa = await seite
      .getByRole('dialog', { name: /Trailer für/ })
      .isVisible()
      .catch(() => false)
    if (thema === 'dunkel' && fall.art !== 'fremd') pruefe('Escape schließt den Dialog', !wegDa)
  }
}

await browser.close()

const mass = messungen.deutsch ?? messungen['gewählt'] ?? Object.values(messungen)[0]

pruefe('er ist 95 % breit', Math.abs(mass.breite - 95) <= 1, `${mass.breite} %`)
pruefe('er ist 95 % hoch', Math.abs(mass.hoehe - 95) <= 1, `${mass.hoehe} %`)
pruefe('die Überschrift nennt den Film', /^Trailer für .+/.test(mass.ueberschrift), mass.ueberschrift)
pruefe('das Video ist eingebettet', /youtube-nocookie\.com\/embed\//.test(mass.src), mass.src)
pruefe('es füllt den Dialog', mass.rahmenHoehe > 400, `${mass.rahmenHoehe} px`)
pruefe('der YouTube-Knopf trägt sein Label', /In YouTube öffnen/.test(mass.youtubeKnopf), mass.youtubeKnopf)
pruefe('und führt zum Video', /youtube\.com\/watch\?v=.+/.test(mass.youtubeZiel), mass.youtubeZiel)
pruefe(
  'das X steht oben rechts',
  mass.xRechts >= 0 && mass.xRechts < 40 && mass.xOben < 40,
  `${mass.xRechts}/${mass.xOben} px`,
)
pruefe('die Seite darunter scrollt nicht mit', mass.koerperGesperrt)
pruefe(
  'er steht mittig im Fenster, nicht im Panel',
  Math.abs(mass.linksFrei - mass.rechtsFrei) <= 2 && mass.linksFrei >= 0 && mass.obenFrei >= 0,
  `links ${mass.linksFrei}, rechts ${mass.rechtsFrei}, oben ${mass.obenFrei} px`,
)

/*
  **Und der häufigere Fall: ein Trailer, der nicht deutsch ist.** 442 der 498
  Einträge sind englisch oder japanisch. Die Pille muss es sagen, sonst
  verspricht sie etwas, das diese Seite nicht liefert.
*/
if (messungen.deutsch) {
  pruefe(
    'die deutsche Pille verspricht nichts Fremdes',
    messungen.deutsch.pillenText === 'Trailer anschauen',
    messungen.deutsch.pillenText,
  )
}
if (messungen.fremd) {
  pruefe(
    'die fremdsprachige Pille nennt die Sprache',
    /^Trailer auf (Englisch|Japanisch)$/.test(messungen.fremd.pillenText),
    messungen.fremd.pillenText,
  )
  pruefe(
    'und der Dialog sagt, dass ein deutscher noch fehlt',
    /noch nicht gefunden/.test(messungen.fremd.ueberschrift),
    messungen.fremd.ueberschrift,
  )
}

console.log('\n  Bilder: docs/trailer-dialog-dunkel.png · docs/trailer-dialog-hell.png')
process.exit(fehler.length ? 1 : 0)
