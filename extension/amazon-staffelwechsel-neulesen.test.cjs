/**
 * Staffelwechsel auf einer Prime-Seite: der Leser liest die neue Seite neu (Bungo Stray Dogs, 15.09.2026).
 *
 * Amazon tauscht beim Wechsel über das Auswahlfeld nur Adresse und Folgenliste, nicht den Hydration-Block
 * im DOM. Daniel sah danach Staffel 1 mit den Daten von Staffel 3. Heute holt `amazon-leser.js` die Seite
 * der neuen Adresse selbst (`ausNachgeholterSeite`) und schickt Block-Daten und Quelltext mit der neuen
 * Adresse. Der Test spielt den Wechsel durch: Start auf Staffel 1 mit ihrem DOM-Block, dann wandert die
 * Adresse, das DOM-Element bleibt das alte, `fetch` liefert die Seite von Staffel 2.
 *
 * Die Kennungen B0BZGQZCFT (Staffel 1) und B0CHL21CT2 (Staffel 2) stammen aus Daniels Aufnahme vom
 * 10.09.2026. Eine Roh-Seite liegt nicht im Repo (kein Abruf von Amazon); die Blöcke sind nach dem Muster
 * von `amazon-nachladen.test.cjs` gebaut, mit genau den Feldern, die `ausHydration` liest.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Zusicherungen für den Staffelwechsel (Neulesen der Seite)\n')

const PFAD_1 = '/gp/video/detail/B0BZGQZCFT/'
const PFAD_2 = '/gp/video/detail/B0CHL21CT2/'

const blockFuer = (kennung, staffel, sprache) =>
  JSON.stringify({
    init: {
      preparations: {
        body: {
          atf: {
            state: {
              pageTitleId: kennung,
              detail: {
                headerDetail: {
                  [kennung]: {
                    entityType: 'TV Show',
                    titleType: 'season',
                    title: `Bungo Stray Dogs Staffel ${staffel}`,
                    seasonNumber: staffel,
                    audioTracks: [{ displayName: sprache }],
                  },
                },
              },
            },
          },
          btf: { state: { detail: { detail: {} } } },
        },
      },
    },
  })

const block1 = blockFuer('B0BZGQZCFT', 1, 'Japanisch')
const block2 = blockFuer('B0CHL21CT2', 2, 'Deutsch')
const seite2 =
  `<html><body><script type="application/json" id="dv-web-page-hydration-data">${block2}</script>` +
  '<script type="text/template">{"pageTitleId":"B0CHL21CT2"}</script></body></html>'

const nachrichten = []
const abgerufen = []
const sandkasten = {
  window: {
    addEventListener() {},
    postMessage: (n) => nachrichten.push({ ...n, pfadBeimSenden: sandkasten.location.pathname }),
    fetch: async (adresse) => {
      abgerufen.push(String(adresse))
      return { ok: true, status: 200, text: async () => seite2 }
    },
  },
  location: { pathname: PFAD_1, search: '', href: `https://www.amazon.de${PFAD_1}` },
  document: {
    /* Das DOM-Element bleibt nach dem Wechsel das alte — so tauscht Amazon die Seite. */
    documentElement: { innerHTML: `<html><script id="dv-web-page-hydration-data">${block1}</script></html>` },
    getElementById: (id) =>
      id === 'dv-web-page-hydration-data' ? { textContent: block1, firstChild: { length: block1.length } } : null,
  },
  setTimeout,
  setInterval,
  clearInterval,
  console,
}
sandkasten.globalThis = sandkasten
vm.createContext(sandkasten)
vm.runInContext(readFileSync(__dirname + '/amazon-leser.js', 'utf8'), sandkasten)

const staffelDerNachrichten = (pfad) =>
  nachrichten.filter((n) => n.fuerAdresse === pfad && n.seite).map((n) => n.seite.staffel)

setTimeout(() => {
  pruefe('vor dem Wechsel: Staffel 1 aus dem DOM-Block', staffelDerNachrichten(PFAD_1).includes(1), staffelDerNachrichten(PFAD_1))
  pruefe('vor dem Wechsel wird keine Seite nachgeholt', abgerufen.length === 0, abgerufen)
  sandkasten.location.pathname = PFAD_2
  sandkasten.location.href = `https://www.amazon.de${PFAD_2}`
}, 1000)

setTimeout(() => {
  const nach = nachrichten.filter((n) => n.fuerAdresse === PFAD_2)
  const mitSeite = nach.filter((n) => n.seite)
  pruefe('nach dem Wechsel wird die Seite der neuen Adresse abgerufen', abgerufen.length === 1 && abgerufen[0] === PFAD_2, abgerufen)
  pruefe('Nachricht der neuen Adresse trägt die Seite von Staffel 2', mitSeite.length > 0 && mitSeite.every((n) => n.seite.staffel === 2 && n.seite.kennung === 'B0CHL21CT2'), mitSeite.map((n) => n.seite.kennung))
  pruefe('die neue Seite trägt „Deutsch" aus Staffel 2, nicht „Japanisch" aus Staffel 1', mitSeite.every((n) => n.seite.sprachen.includes('Deutsch') && !n.seite.sprachen.includes('Japanisch')), mitSeite.map((n) => n.seite.sprachen))
  const mitText = nach.find((n) => typeof n.quelltext === 'string')
  pruefe('der nachgeholte Quelltext geht für die neue Adresse an amazon.js', mitText?.quelltextFuer === PFAD_2 && mitText.quelltext === seite2, mitText?.quelltextFuer)
  pruefe('keine Nachricht trägt Staffel-1-Daten unter der Adresse von Staffel 2', !nach.some((n) => n.seite?.staffel === 1))
  const spaeterAlt = nachrichten.filter((n) => n.pfadBeimSenden === PFAD_2 && n.fuerAdresse === PFAD_1 && n.seite)
  pruefe('nach dem Wechsel sendet der Leser Staffel 1 nicht erneut', spaeterAlt.length === 0, spaeterAlt.length)

  console.log()
  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) verletzt.`)
    process.exit(1)
  }
  console.log('Alle Zusicherungen erfüllt.')
  process.exit(0)
}, 3200)
