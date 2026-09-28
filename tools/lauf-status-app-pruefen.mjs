#!/usr/bin/env node
/**
 * **Die Laufstatus-App — startet sie, gehen ihre Links hinaus, und zeigt sie das Richtige?**
 *
 * Seit dem 13.09.2026 läuft die Anzeige als eigenes Electron-Programm
 * (`C:\code\ai\__assets\tools\lauf-status\app\`), nicht mehr als Chrome-Fenster.
 * Anlass: `--window-size` aus dem alten Startskript galt für den ganzen
 * Chrome-Prozess, und Daniels normale Fenster erbten die 420 Pixel.
 *
 * Gemessen wird, was die Hülle leisten muss, und das meiste davon sieht man auf
 * keinem Bild:
 *
 * - Das Fenster hat seine Größe, und die Seite hat geladen.
 * - **Die Pillen öffnen im Standardbrowser.** Die Seite öffnet synchron ein
 *   leeres Fenster und setzt seine Adresse erst nach einem `fetch`. Geht das
 *   schief, navigiert die Anzeige selbst weg — oder der Link landet in einem
 *   Electron-Fenster ohne Daniels Anmeldung und ohne seine Erweiterung.
 * - Ein normaler Verweis mit `target="_blank"` geht ebenfalls hinaus.
 * - Die Anzeige selbst lässt sich nicht wegnavigieren.
 * - **Das Gitter zeigt jede Lauf-Art** (28.09.2026), ein Klick öffnet ihre Seite mit dem Verlauf,
 *   und der Weg zurück führt ins Gitter.
 * - **Antwortet der Dienst nicht, bleibt der letzte Stand sichtbar** — mit Hinweisbalken, Grund
 *   und der Uhrzeit, ab der es weitergeht.
 *
 * **Die Lauf-Art-Liste wird gegen die Workflows gehalten:** Die Anzeige führt sie fest (sie muss
 * auch ruhende Arten zeigen), der Worker kennt nur, was gelaufen ist. Läuft beides auseinander,
 * findet eine Kachel ihre Läufe nicht mehr — hier fällt es auf.
 *
 * **Der Standardbrowser wird dabei nie geöffnet:** `shell.openExternal` wird im
 * Hauptprozess durch einen Zähler ersetzt, bevor irgendetwas geklickt wird.
 *
 * **Der Stand kommt aus erfundenen Antworten, nicht vom echten Dienst:** Sonst hinge dieses
 * Werkzeug davon ab, wie es dem Worker gerade geht. Geprüft wird der echte Code; nur seine
 * Zulieferung ist gesetzt. Die Adressen fängt ein `route` ab, **beide** (`/lauf` und die Pillen) —
 * sonst sammelt der Prüflauf im Kontingent-Ausfall Fehlversuche beim echten Server.
 *
 * **Ein eigener Datenordner:** Electron gibt es nur einmal — `app.requestSingleInstanceLock()`
 * beendet einen zweiten Start sofort, und Daniel hat die Anzeige fast immer offen. Mit eigenem
 * `--user-data-dir` hat der Probelauf seinen eigenen Riegel und seinen eigenen Speicher.
 *
 * Aufruf: `node tools/lauf-status-app-pruefen.mjs`
 * Ergebnis: `docs/lauf-status-app.png`, `docs/lauf-status-app-detail.png`,
 *           `docs/lauf-status-app-ausfall.png`
 */
import { _electron as electron } from 'playwright'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = 'C:/code/ai/__assets/tools/lauf-status/app'
const ANZEIGE = 'C:/code/ai/__assets/tools/lauf-status/index.html'
const EXE = path.join(APP, 'node_modules/electron/dist/electron.exe')

if (!existsSync(EXE)) {
  console.error(`Electron fehlt: ${EXE} — vorher \`npm install\` im App-Ordner.`)
  process.exit(1)
}

const fehler = []
const pruefe = (was, ok, zusatz) => {
  console.log(`  ${ok ? 'ok  ' : 'FEHL'} ${was}${ok || zusatz === undefined ? '' : ` — ${zusatz}`}`)
  if (!ok) fehler.push(was)
}

/* — Was der Worker liefert, in erfundener Form (echte Feldnamen) — */
const VOR_12_MIN = new Date(Date.now() - 12 * 60000).toISOString()
const GUTER_STAND = {
  jetzt: new Date().toISOString(),
  laeufe: [{
    lauf_id: 'probe-1',
    repo: 'danielzaiser91/anime-kalender-de',
    workflow: 'Deploy auf GitHub Pages',
    auftrag: '',
    zweck: 'Veröffentlicht den aktuellen Stand von anime-kalender.de',
    ziel: 'Prüfkette grün, neuer Stand auf GitHub Pages',
    zustand: 'laeuft',
    begonnen_am: new Date(Date.now() - 78000).toISOString(),
    gemeldet_am: new Date().toISOString(),
    url: 'https://example.com/lauf-1',
    notiz: '',
    fortschritt: 6,
    fortschritt_gesamt: 6,
    fortschritt_text: 'Seite gebaut',
  }],
  verlauf: {
    'Deploy auf GitHub Pages': [
      { z: 'ok', am: VOR_12_MIN },
      { z: 'abgebrochen', am: VOR_12_MIN },
      { z: 'fehler', am: VOR_12_MIN },
    ],
    'Stündlich — Sendezeiten': [{ z: 'ok', am: VOR_12_MIN }],
  },
}
const VERLAUF_ANTWORT = {
  jetzt: new Date().toISOString(),
  laeufe: [
    {
      lauf_id: 'x-1', zustand: 'ok', auftrag: '', notiz: 'Probelauf fertig', url: 'https://example.com/x-1',
      begonnen_am: new Date(Date.now() - 95000).toISOString(), gemeldet_am: VOR_12_MIN,
    },
    {
      lauf_id: 'x-2', zustand: 'fehler', auftrag: '', notiz: 'Probelauf schiefgegangen', url: 'https://example.com/x-2',
      begonnen_am: new Date(Date.now() - 260000).toISOString(), gemeldet_am: VOR_12_MIN,
    },
  ],
}
const PILLEN = {
  offen: 1,
  anbieter: [{ name: 'Amazon', plattform: 'primevideo', titel: 1, ohneSeite: 0, unterwegs: 0, ziel: 'https://example.com/pille', ziele: [] }],
}

const WORKER_URL = 'https://newsletter.animekalender.workers.dev/lauf*'
const PILLEN_URL = 'https://newsletter.animekalender.workers.dev/pruefung?stand=1*'
const antworte = (r) =>
  r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(r.request().url().includes('verlauf=') ? VERLAUF_ANTWORT : GUTER_STAND),
  })

/*
  **Ein eigener Datenordner, damit die laufende Anzeige nicht stört** (28.09.2026).
*/
const PROBENORDNER = path.join(os.tmpdir(), 'laufstatus-probe')
const programm = await electron.launch({
  executablePath: EXE,
  args: [`--user-data-dir=${PROBENORDNER}`, APP],
})

/* Zuerst den Ausgang sperren — kein Test darf Daniels Browser öffnen. */
await programm.evaluate(({ shell }) => {
  globalThis.__extern = []
  shell.openExternal = async (url) => {
    globalThis.__extern.push(url)
  }
})

const seite = await programm.firstWindow()
await seite.waitForLoadState('domcontentloaded')
await seite.route(WORKER_URL, antworte)
await seite.route(PILLEN_URL, (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PILLEN) }))
await seite.reload({ waitUntil: 'domcontentloaded' })
/* Die Anzeige holt ihre Daten nach — ein Moment für den ersten Aufbau. */
await seite.waitForTimeout(1500)

console.log('Die Laufstatus-App:\n')

const fenster = await programm.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows().find((x) => x.isVisible())
  const [breite, hoehe] = w ? w.getSize() : [0, 0]
  return { breite, hoehe, titel: w?.getTitle() ?? '' }
})
pruefe('das Fenster ist 420 × 760 groß', fenster.breite === 420 && fenster.hoehe === 760, `${fenster.breite} × ${fenster.hoehe}`)
pruefe('es trägt den Titel der Seite', /^(● \d+ — |▲ )?Laufstatus$/.test(fenster.titel), fenster.titel)
pruefe('die Seite ist die aus dem Werkzeugordner', /lauf-status\/index\.html$/.test(seite.url()), seite.url())

await seite.screenshot({ path: path.join(WURZEL, 'docs', 'lauf-status-app.png') })

/* 1. Der Weg der Pillen: leeres Fenster jetzt, Adresse nach einem await. */
await seite.evaluate(async () => {
  const f = window.open('', '_blank')
  await new Promise((r) => setTimeout(r, 150))
  if (f) f.location.href = 'https://example.com/pille'
  else window.location.href = 'https://example.com/pille-rueckfall'
})
await seite.waitForTimeout(1200)

/* 2. Ein gewöhnlicher Verweis mit target=_blank. */
await seite.evaluate(() => {
  const a = document.createElement('a')
  a.href = 'https://example.com/verweis'
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
})
await seite.waitForTimeout(600)

/* 3. Der Versuch, die Anzeige selbst wegzunavigieren. */
await seite.evaluate(() => {
  window.location.href = 'https://example.com/weg'
})
await seite.waitForTimeout(800)

const extern = await programm.evaluate(() => globalThis.__extern)
const nochDa = seite.url()
const offen = await programm.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)

pruefe('eine Pille öffnet im Standardbrowser', extern.includes('https://example.com/pille'), JSON.stringify(extern))
pruefe('ohne den Rückfall der Seite auszulösen', !extern.includes('https://example.com/pille-rueckfall'))
pruefe('ein Verweis mit target=_blank ebenso', extern.includes('https://example.com/verweis'), JSON.stringify(extern))
pruefe('die Anzeige lässt sich nicht wegnavigieren', /lauf-status\/index\.html$/.test(nochDa), nochDa)
pruefe('und das Wegnavigieren geht stattdessen hinaus', extern.includes('https://example.com/weg'), JSON.stringify(extern))
pruefe('kein Hilfsfenster bleibt übrig', offen === 1, `${offen} Fenster`)

/*
  **4. Das Gitter: alle Lauf-Arten, immer sichtbar** (Daniel, 28.09.2026: „alle lauf-arten immer
  sichtbar", „kacheln, feste reihenfolge plus zähler").
*/
await seite.reload({ waitUntil: 'domcontentloaded' })
await seite.waitForTimeout(1200)
const gitter = await seite.evaluate(() => ({
  kacheln: document.querySelectorAll('.kachel').length,
  laeuft: document.querySelectorAll('.kachel.laeuft').length,
  balken: document.querySelectorAll('.kachel .balken').length,
  kaestchen: document.querySelectorAll('.kachel .reihe i').length,
  kopf: (document.getElementById('kopf') || {}).textContent || '',
  erste: document.querySelector('.kachel .kurz')?.textContent ?? '',
}))
pruefe('das Gitter zeigt jede Lauf-Art', gitter.kacheln === 17, String(gitter.kacheln))
pruefe('die erste Kachel ist der Deploy', gitter.erste === 'Deploy', gitter.erste)
pruefe('die laufende Art ist blau und trägt den Balken', gitter.laeuft === 1 && gitter.balken === 1)
pruefe('die Kästchenreihe zeigt den Verlauf', gitter.kaestchen >= 4, String(gitter.kaestchen))
pruefe('der Zähler nennt den laufenden Lauf', /1 läuft/.test(gitter.kopf), gitter.kopf)

/* 5. Klick öffnet die Seite der Lauf-Art — heute, letzter Lauf, Verlauf. */
await seite.click('.kachel.laeuft')
await seite.waitForTimeout(900)
const detail = await seite.evaluate(() => ({
  text: document.body.innerText,
  jetzt: Boolean(document.querySelector('.jetzt')),
  zeilen: document.querySelectorAll('.zeile').length,
  zurueck: Boolean(document.querySelector('.zurueck')),
}))
pruefe('der Klick öffnet die Detailseite', detail.jetzt && detail.zurueck)
pruefe('mit Ziel und Schritt', /Schritt 6 von 6/.test(detail.text), detail.text.slice(0, 120))
pruefe('und dem Verlauf', detail.zeilen >= 2, String(detail.zeilen))
pruefe('samt Grund des Fehlschlags', /schiefgegangen/.test(detail.text))
await seite.screenshot({ path: path.join(WURZEL, 'docs', 'lauf-status-app-detail.png') })

await seite.click('.zurueck')
await seite.waitForTimeout(700)
pruefe('der Weg zurück führt ins Gitter',
  (await seite.evaluate(() => document.querySelectorAll('.kachel').length)) === 17)

/*
  **6. Antwortet der Dienst nicht, bleibt der letzte Stand stehen** (Daniel: „status app zeigt
  fehler, warum? fix es" — und „so ein kontingent fehler sollte viel sichtbarer sein").
*/
const ausfallAntworten = (r) =>
  r.fulfill({ status: 500, contentType: 'text/html', body: '<html><body>error code: 1101</body></html>' })
await seite.unroute(WORKER_URL)
await seite.route(WORKER_URL, ausfallAntworten)
/* Beide Quellen hängen an derselben Datenbank — im echten Ausfall fallen sie zusammen aus. */
await seite.unroute(PILLEN_URL)
await seite.route(PILLEN_URL, ausfallAntworten)
await seite.reload({ waitUntil: 'domcontentloaded' })
await seite.waitForTimeout(1200)
const ausfall = await seite.evaluate(() => ({
  text: document.body.innerText,
  banner: Boolean(document.querySelector('.limit')),
  kacheln: document.querySelectorAll('.kachel').length,
  pillen: document.querySelectorAll('.pille').length,
  pillenTitel: (document.getElementById('pruefliste') || {}).title || '',
  kopf: (document.getElementById('kopf') || {}).textContent || '',
  stand: (document.getElementById('stand') || {}).textContent || '',
}))
pruefe('beim Ausfall steht ein Hinweisbalken oben', ausfall.banner)
pruefe('er nennt die Uhrzeit des Stands', /Stand von \d{2}:\d{2}/.test(ausfall.text), ausfall.text.slice(0, 120))
pruefe('und ab wann es weitergeht', /Neue Werte gibt es ab \d{2}:\d{2}/.test(ausfall.text))
pruefe('und dass nichts zu tun ist', /Nichts zu tun/.test(ausfall.text))
pruefe('die Kacheln bleiben stehen', ausfall.kacheln === 17, String(ausfall.kacheln))
pruefe('die Kopfzeile nennt den alten Stand', /^Stand von \d{2}:\d{2}$/.test(ausfall.kopf.trim()), ausfall.kopf)
pruefe('die Fußzeile sagt, dass der Dienst nicht antwortet',
  ausfall.stand.includes('der Dienst antwortet nicht'), ausfall.stand)
/* Die Pillen sind Daniels Arbeitsliste — sie kommen aus derselben Datenbank und müssen bleiben. */
pruefe('die Prüfliste bleibt stehen', ausfall.pillen === 1, String(ausfall.pillen))
pruefe('und ist als alter Stand gekennzeichnet', /Stand von vorhin/.test(ausfall.pillenTitel), ausfall.pillenTitel)
await seite.screenshot({ path: path.join(WURZEL, 'docs', 'lauf-status-app-ausfall.png') })

/* Und ohne gemerkten Stand: nur der Grund — ebenfalls lesbar. */
await seite.evaluate(() => localStorage.removeItem('laufstatus-letzter-stand'))
await seite.reload({ waitUntil: 'domcontentloaded' })
await seite.waitForTimeout(1200)
const ohneStand = await seite.evaluate(() => ({
  text: document.body.innerText,
  grundLang: Boolean(document.querySelector('.karte.fehler .unten.lang')),
}))
pruefe('ohne gemerkten Stand steht der Grund da', /Tageskontingent/.test(ohneStand.text), ohneStand.text.slice(0, 150))
pruefe('und auch dort nicht beschnitten', ohneStand.grundLang)

/*
  **7. Die feste Liste der Lauf-Arten gegen die Workflows.** Läuft beides auseinander, findet eine
  Kachel ihre Läufe nicht mehr — und zwar still.
*/
const ausDerAnzeige = [...readFileSync(ANZEIGE, 'utf8').matchAll(/\{ kurz: '[^']+', lang: '([^']+)' \}/g)].map((m) => m[1])
const ausDenWorkflows = readdirSync(path.join(WURZEL, '.github/workflows'))
  .filter((f) => f.endsWith('.yml'))
  .map((f) => /^name:\s*(.+)$/m.exec(readFileSync(path.join(WURZEL, '.github/workflows', f), 'utf8'))?.[1]?.trim())
  .filter(Boolean)
pruefe('die Anzeige kennt jede Lauf-Art der Workflows',
  ausDenWorkflows.every((n) => ausDerAnzeige.includes(n)),
  ausDenWorkflows.filter((n) => !ausDerAnzeige.includes(n)).join(', '))
pruefe('und keine, die es nicht gibt',
  ausDerAnzeige.every((n) => ausDenWorkflows.includes(n)),
  ausDerAnzeige.filter((n) => !ausDenWorkflows.includes(n)).join(', '))

await programm.close()
console.log('\n  Bilder: docs/lauf-status-app.png, docs/lauf-status-app-detail.png, docs/lauf-status-app-ausfall.png')
process.exit(fehler.length ? 1 : 0)
