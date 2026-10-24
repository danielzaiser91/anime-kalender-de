/**
 * Prime: eine gemeldete Suche / Titelseite bleibt auch nach dem Seitenwechsel weg (4.31.10, 21.10.2026).
 *
 * Fall (Daniel, 21.10.2026, Diagnose 01:09 Z): Mission Mars und Die Boonies waren im Briefkasten
 * (01:04 Z), `lokalErledigt` stand, `frischGemeldet` war nach dem Seitenaufruf leer, der Stand
 * (`?stand=1`, fünf Minuten Edge-Cache) führte die Suchadresse noch → Zeile wieder offen.
 *
 * Geprüft wird durch Ausführen der echten `istGemeldet()` und `fertig()` aus `amazon.js` in einer
 * frischen Seite (leeres `frischGemeldet`); die Uhr kommt von außen.
 *
 * Aufruf: `node extension/prime-such-bruecke.test.cjs`
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}
const lies = (datei) => readFileSync(`${__dirname}/${datei}`, 'utf8')
const FEST = Date.parse('2026-10-21T01:10:00Z')
const MIN = 60 * 1000

function schneide(quelle, name) {
  const treffer = new RegExp(`\\n  function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`).exec(quelle)
  if (!treffer) throw new Error(`${name}() nicht im Quelltext`)
  return treffer[0]
}

const SUCHE = 'https://www.amazon.de/s?k=Bernard%20B%C3%A4r%3A%20Mission%20Mars&i=instant-video'
const TITEL = 'https://www.amazon.de/gp/video/detail/B0GXC6GGH6'

/** Eine frisch geladene Seite: Stand führt beide Adressen, `frischGemeldet` ist leer. */
function seite({ suchVermerk, titelVermerk, imStand = [SUCHE, TITEL], mitDatei = true }) {
  class FestDate extends Date {
    static now() {
      return FEST
    }
  }
  const k = vm.createContext({
    Date: FestDate,
    Set,
    standZiele: new Set(imStand),
    frischGemeldet: new Set(),
    suchliste: { [SUCHE]: { titel: 'Bernard Bär: Mission Mars' } },
    suchErledigt: suchVermerk === undefined ? {} : { [SUCHE]: suchVermerk },
    liste: { B0GXC6GGH6: { url: TITEL } },
    erledigt: titelVermerk === undefined ? {} : { B0GXC6GGH6: { zeit: titelVermerk } },
    erwartungZu: () => null,
    briefkastenSeiten: null,
    briefkastenAdressen: null,
    briefkastenSuchen: null,
    suchErledigtFrisch: () => false,
    vermerkVerwerfen: () => {},
  })
  k.globalThis = k
  if (mitDatei) vm.runInContext(lies('prime-such-bruecke.js'), k)
  const q = lies('amazon.js')
  vm.runInContext([schneide(q, 'istGemeldet'), schneide(q, 'fertig')].join('\n'), k)
  return {
    suche: () => vm.runInContext(`istGemeldet(${JSON.stringify(SUCHE)})`, k),
    titel: () => vm.runInContext("fertig('B0GXC6GGH6')", k),
  }
}
const vor = (minuten) => new Date(FEST - minuten * MIN).toISOString()

console.log('Zusicherungen: eigene Meldung überbrückt den Stand über Seitenwechsel (Prime, 21.10.2026)\n')

pruefe('Suche ohne Vermerk, Stand führt sie: offen', seite({}).suche() === false)
pruefe('Suche vor 6 Minuten gemeldet (neue Seite, leeres frischGemeldet): erledigt', seite({ suchVermerk: vor(6) }).suche() === true)
pruefe('Suche vor 1 Minute gemeldet: erledigt', seite({ suchVermerk: vor(1) }).suche() === true)
pruefe('Suche genau vor 10 Minuten: offen (Frist abgelaufen)', seite({ suchVermerk: vor(10) }).suche() === false)
pruefe('Suche vor 9 Minuten: erledigt', seite({ suchVermerk: vor(9) }).suche() === true)
pruefe('Suche vor 2 Stunden gemeldet, Stand führt sie noch: offen (der Worker entscheidet)', seite({ suchVermerk: vor(120) }).suche() === false)
pruefe('Vermerk aus der Zukunft zählt nicht', seite({ suchVermerk: new Date(FEST + 5 * MIN).toISOString() }).suche() === false)
pruefe('Alter Vermerk nur mit Datum (4.31.9 und früher): offen', seite({ suchVermerk: '2026-10-21' }).suche() === false)
pruefe('Kaputter Vermerk: offen', seite({ suchVermerk: 'gestern' }).suche() === false)
pruefe('Führt der Stand die Suche nicht mehr: erledigt, auch ohne Vermerk', seite({ imStand: [] }).suche() === true)

pruefe('Titelseite ohne Vermerk, Stand führt sie: offen', seite({}).titel() === false)
pruefe('Titelseite vor 6 Minuten gemeldet (neue Seite): erledigt', seite({ titelVermerk: vor(6) }).titel() === true)
pruefe('Titelseite vor 10 Minuten: offen', seite({ titelVermerk: vor(10) }).titel() === false)
pruefe('Titelseite vor 2 Stunden, Stand führt sie noch: offen', seite({ titelVermerk: vor(120) }).titel() === false)
pruefe('Titelseite: Vermerk nur mit Datum: offen', seite({ titelVermerk: '2026-10-21' }).titel() === false)
pruefe('Titelseite: der Vermerk der Suche überbrückt sie nicht', seite({ suchVermerk: vor(1) }).titel() === false)
pruefe('Suche: der Vermerk der Titelseite überbrückt sie nicht', seite({ titelVermerk: vor(1) }).suche() === false)

/* Schreibseite: suchAbhaken() legt den Vermerk so ab, dass die nächste Seite ihn als Überbrückung liest. */
async function schreibseite() {
  const q = lies('amazon.js')
  const abhaken = /\n  async function suchAbhaken\([^)]*\) \{[\s\S]*?\n  \}/.exec(q)?.[0]
  const geschrieben = []
  const k = vm.createContext({
    Date: class extends Date {
      static now() {
        return FEST
      }
    },
    frischGemeldet: new Set(),
    suchErledigt: {},
    briefkastenAdressen: null,
    speicherSchreiben: async (x) => geschrieben.push(x),
    briefkastenHolen: async () => {},
  })
  k.globalThis = k
  vm.runInContext(lies('prime-such-bruecke.js'), k)
  vm.runInContext(abhaken, k)
  await vm.runInContext(`suchAbhaken(${JSON.stringify(SUCHE)})`, k)
  const vermerk = geschrieben[0]?.amazonSuche?.[SUCHE]
  pruefe('suchAbhaken speichert die ISO-Zeit der Meldung', vermerk === new Date(FEST).toISOString(), vermerk)
  pruefe('suchAbhaken merkt die Adresse auch für diese Seite', k.frischGemeldet.has(SUCHE))
  const neu = seite({ suchVermerk: vermerk })
  pruefe('Rundlauf: gespeicherter Vermerk überbrückt auf der nächsten Seite', neu.suche() === true)
  pruefe('akPrimeVermerk gibt die ISO-Zeit zurück', k.akPrimeVermerk(FEST) === '2026-10-21T01:10:00.000Z', k.akPrimeVermerk(FEST))
  /* Dass die Titelseiten-Meldung diesen Vermerk schreibt, läuft in `amazon-melden-vermerk.test.cjs`. */
}

async function haupt() {
  await schreibseite()
  const js = JSON.parse(lies('manifest.json')).content_scripts.find((c) => c.js.includes('amazon.js')).js
  pruefe('Manifest: prime-such-bruecke.js lädt vor amazon.js', js.includes('prime-such-bruecke.js') && js.indexOf('prime-such-bruecke.js') < js.indexOf('amazon.js'), js)
  const schlecht = faelle.filter((x) => !x).length
  console.log(schlecht ? `\n${schlecht} Prüfung(en) fehlgeschlagen.` : `\nAlle ${faelle.length} Prüfungen bestanden.`)
  process.exit(schlecht ? 1 : 0)
}

haupt()
