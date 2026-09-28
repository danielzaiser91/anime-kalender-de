#!/usr/bin/env node
/**
 * **Die Laufstatus-App — startet sie, und gehen ihre Links in den richtigen Browser?**
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
 * - **Antwortet der Dienst nicht, bleibt der letzte Stand sichtbar** (seit 28.09.2026) —
 *   mit Grund und Uhrzeit statt eines leeren roten Kastens, und der Grund wird nicht auf eine
 *   Zeile beschnitten.
 *
 * **Der Standardbrowser wird dabei nie geöffnet:** `shell.openExternal` wird im
 * Hauptprozess durch einen Zähler ersetzt, bevor irgendetwas geklickt wird.
 *
 * Aufruf: `node tools/lauf-status-app-pruefen.mjs`
 * Ergebnis: `docs/lauf-status-app.png`, `docs/lauf-status-app-ausfall.png`
 */
import { _electron as electron } from 'playwright'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = 'C:/code/ai/__assets/tools/lauf-status/app'
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

/*
  **Ein eigener Datenordner, damit die laufende Anzeige nicht stört** (28.09.2026).

  Electron gibt es nur einmal: `app.requestSingleInstanceLock()` beendet einen zweiten Start
  sofort — und Daniel hat die Anzeige fast immer offen, der Prüflauf brach dann mit „Target …
  has been closed" ab. Mit eigenem `--user-data-dir` hat der Probelauf seinen eigenen Riegel und
  seinen eigenen Speicher; die laufende Anzeige bleibt unangetastet.
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

/*
  **Der Stand kommt aus einer festen Antwort, nicht vom echten Dienst** (28.09.2026).

  Sonst hinge dieses Werkzeug davon ab, wie es dem Worker gerade geht: Ist das
  Datenbank-Kontingent erschöpft, zeigt die Anzeige den letzten Stand mit Begründung — richtig
  so, aber keine Grundlage für „der Titel ist Laufstatus". Geprüft wird der echte Code; nur
  seine Zulieferung ist hier gesetzt.
*/
const WORKER_URL = 'https://newsletter.animekalender.workers.dev/lauf*'
/*
  **Auch die Pillen kommen aus einer festen Antwort** (28.09.2026).

  Sie hat eine eigene Adresse (`?stand=1`) und lief beim Prüflauf bisher gegen den echten
  Dienst — im tail war zu sehen, wie der Lauf während des Kontingent-Ausfalls dort Fehlversuche
  sammelte. Jetzt ist der ganze Abruf des Werkzeugs erfunden und niemand sonst wird belastet.
*/
const PILLEN_URL = 'https://newsletter.animekalender.workers.dev/pruefung?stand=1*'
const PILLEN = {
  offen: 1,
  anbieter: [{ name: 'Amazon', plattform: 'primevideo', titel: 1, ohneSeite: 0, unterwegs: 0, ziel: 'https://example.com/pille', ziele: [] }],
}
const GUTER_STAND = {
  jetzt: new Date().toISOString(),
  laeufe: [{
    lauf_id: 'probe-1',
    auftrag: 'Probelauf',
    workflow: 'Probe',
    zustand: 'ok',
    begonnen_am: new Date(Date.now() - 600000).toISOString(),
    gemeldet_am: new Date().toISOString(),
  }],
}
const gutAntworten = (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GUTER_STAND) })
await seite.route(WORKER_URL, gutAntworten)
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
pruefe('es trägt den Titel der Seite', fenster.titel === 'Laufstatus', fenster.titel)
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
  **4. Antwortet der Dienst nicht, bleibt der letzte Stand stehen** (28.09.2026).

  Anlass: Daniel sah „Statusdienst nicht erreichbar" und fragte „warum? fix es". Die Ursache war
  das erschöpfte Tageskontingent der Datenbank (HTTP 500), kein Fehler der Anzeige — aber die
  Anzeige stand dann bis 02:00 leer, obwohl sie den Stand von vor einer Stunde schon kannte.
  Geprüft wird beides: der gemerkte Stand bleibt sichtbar, und der Grund steht lesbar dabei.
*/
const ausfallAntworten = (r) =>
  r.fulfill({ status: 500, contentType: 'text/html', body: '<html><body>error code: 1101</body></html>' })

/* Ein guter Abruf zuerst — das ist der Stand, den es zu behalten gilt. */
await seite.unroute(WORKER_URL)
await seite.route(WORKER_URL, gutAntworten)
await seite.reload({ waitUntil: 'domcontentloaded' })
await seite.waitForTimeout(1200)
pruefe('der gute Abruf zeigt seine Läufe', (await seite.getByText('Probelauf').count()) >= 1)
pruefe('der gute Stand wird gemerkt',
  await seite.evaluate(() => Boolean(localStorage.getItem('laufstatus-letzter-stand'))))

/* Jetzt derselbe Abruf, aber mit Ausfall. */
await seite.unroute(WORKER_URL)
await seite.route(WORKER_URL, ausfallAntworten)
await seite.reload({ waitUntil: 'domcontentloaded' })
await seite.waitForTimeout(1200)
const ausfall = await seite.evaluate(() => ({
  text: document.body.innerText,
  kopf: (document.getElementById('kopf') || {}).textContent || '',
  stand: (document.getElementById('stand') || {}).textContent || '',
  grundLang: Boolean(document.querySelector('.karte.alt .unten.lang')),
}))
pruefe('beim Ausfall steht der letzte Stand weiter da', ausfall.text.includes('Probelauf'), ausfall.text.slice(0, 150))
pruefe('der Kasten nennt Grund und Uhrzeit',
  /Der Statusdienst antwortet nicht — Stand von \d{2}:\d{2}/.test(ausfall.text), ausfall.text.slice(0, 150))
pruefe('die Kopfzeile nennt den alten Stand statt laufender Zahlen',
  /^Stand von \d{2}:\d{2}$/.test(ausfall.kopf.trim()), ausfall.kopf)
pruefe('die Fußzeile sagt, dass der Dienst nicht antwortet',
  ausfall.stand.includes('der Dienst antwortet nicht'), ausfall.stand)
pruefe('der Grund wird nicht auf eine Zeile beschnitten', ausfall.grundLang)
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

await programm.close()
console.log('\n  Bilder: docs/lauf-status-app.png, docs/lauf-status-app-ausfall.png')
process.exit(fehler.length ? 1 : 0)
