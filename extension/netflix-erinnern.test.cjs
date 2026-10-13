/**
 * **Titelseite mit „Erinnern" und ohne Folgenliste: der Netflix-Durchgang geht sofort weiter** (13.10.2026).
 *
 * Daniel (4.30.4), Yu-Gi-Oh! `/title/70177034`: Das Modal zeigt nur „Erinnern", keine Folgenliste,
 * nur „Ähnliche Titel". Der Durchgang wartete die Frist auf die Liste (20 s plus Takt, gut 30 s).
 * Jetzt: nach der Schonzeit weiter, **ohne Meldung** (wie Disney+; ein Nein meldet nur der Klick „Keine Folge da").
 * Gegenprobe: ein normaler Titel ohne „Erinnern" wartet bis zur Frist wie bisher.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

console.log('Netflix: Erinnern statt Folgenliste')

const melderQuelle = readFileSync(resolve(__dirname, 'melder.js'), 'utf8')
const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
vm.runInContext(readFileSync(resolve(__dirname, 'netflix-erinnern.js'), 'utf8'), kontext)
const warte = kontext.akNetflixListeWarten
pruefe('Wartefunktion erreichbar', typeof warte === 'function')

/* Das Modal aus Daniels Bildschirmfoto (Yu-Gi-Oh!): „Erinnern", keine Folgenliste, Folgenzahlen nur bei „Ähnliche Titel". */
const MODAL_ERINNERN = [
  'Yu-Gi-Oh!',
  'Erinnern',
  'Als ein Fantasy-Kartenspiel für den jungen Yugi Muto und seine Freunde Joey, Tristan und Téa Realität wird, beginnt für sie ein völlig neues Leben.',
  'Genres: Für Kinder, Action-Anime, Japanisch',
  'Ähnliche Titel',
  '52 Folgen',
  '3 Staffeln',
  '60 Folgen',
].join('\n')
const MODAL_SERIE = ['Beispielserie', 'Abspielen', 'Folgen', '1. Folge', '2. Folge', 'Ähnliche Titel', '52 Folgen'].join('\n')

/* Die echte Erkennung des Knopfes aus `melder.js`, mit dem Seitentext als Fixture. */
const kopf = /\nfunction keineFolgeVorhanden\(\) \{[\s\S]*?\n\}\n/.exec(melderQuelle)?.[0]
pruefe('keineFolgeVorhanden() in melder.js auffindbar', Boolean(kopf))
const erkennt = (text) => new Function('document', `${kopf}; return keineFolgeVorhanden()`)({ body: { innerText: text } })
pruefe('Modal mit „Erinnern" wird erkannt', erkennt(MODAL_ERINNERN) === true)
pruefe('Modal einer Serie mit Folgenliste nicht', erkennt(MODAL_SERIE) === false)

/* Spiel: ein Titel, alle Takte eine Sekunde auseinander. `listeAb`: ab dieser Sekunde steht die Folgenliste da. */
async function spiel({ text, endeNach = 40, listeAb = null }) {
  const w = { spuren: [], uebersprungen: new Set(), weiter: 0, gemeldet: 0 }
  const tun = {
    spur: (was) => w.spuren.push(was),
    uebersprungen: w.uebersprungen,
    weiter: () => w.weiter++,
    /* Kein Teil des Vertrags mehr: würde der Durchgang melden, zählt es hier. */
    melde: async () => {
      w.gemeldet++
    },
  }
  let wartet = null
  let erstesWeiter = null
  for (let s = 0; s <= endeNach; s++) {
    /* Wie `selbstStartenSchritt`: steht die Liste da, wird nicht mehr gewartet. */
    if (listeAb !== null && s >= listeAb) {
      wartet = null
      continue
    }
    const vorher = w.weiter
    const ort = {
      seite: '70177034',
      reihe: '70177034',
      erinnern: erkennt(text),
      durchlauf: { folgen: [], listeFuer: null },
      jetzt: 1_000_000 + s * 1000,
      frist: 20000,
    }
    wartet = warte(wartet, ort, tun)
    await new Promise((fertig) => setImmediate(fertig))
    if (w.weiter > vorher && erstesWeiter === null) erstesWeiter = s
  }
  return { ...w, erstesWeiter }
}

async function haupt() {
  const erinnern = await spiel({ text: MODAL_ERINNERN })
  pruefe('Erinnern: weiter nach der Schonzeit (spätestens Sekunde 5), nicht nach der Frist', erinnern.erstesWeiter !== null && erinnern.erstesWeiter <= 5, erinnern.erstesWeiter)
  await new Promise((fertig) => setImmediate(fertig))
  pruefe('Erinnern: genau einmal weiter und nie gemeldet', erinnern.gemeldet === 0 && erinnern.weiter === 1, [erinnern.gemeldet, erinnern.weiter])
  pruefe('Erinnern: die Spur nennt den Grund', erinnern.spuren.includes('Erinnern statt Folgenliste') && !erinnern.spuren.includes('keine Folgenliste'), erinnern.spuren)
  pruefe('Erinnern: der Titel gilt als übersprungen', erinnern.uebersprungen.has('70177034'))

  const vorSchonzeit = await spiel({ text: MODAL_ERINNERN, endeNach: 2 })
  pruefe('Erinnern: in den ersten Sekunden noch kein Urteil (Liste könnte noch kommen)', vorSchonzeit.weiter === 0 && vorSchonzeit.gemeldet === 0)

  /* Prüferbefund 2 (PR 1133): „Erinnern" irgendwo im Seitentext, die Folgenliste kommt aber doch. */
  const listeFrueh = await spiel({ text: MODAL_ERINNERN, listeAb: 2 })
  pruefe('Gegenprobe: Erinnern-Text, Folgenliste vor Ablauf der Schonzeit da: weder weiter noch Meldung', listeFrueh.weiter === 0 && listeFrueh.gemeldet === 0, [listeFrueh.weiter, listeFrueh.gemeldet])
  const listeSpaet = await spiel({ text: MODAL_ERINNERN, listeAb: 4 })
  pruefe('Gegenprobe: Erinnern-Text, Folgenliste erst nach 4 s: höchstens übersprungen, nie gemeldet', listeSpaet.gemeldet === 0 && listeSpaet.weiter <= 1, [listeSpaet.weiter, listeSpaet.gemeldet])

  const normal = await spiel({ text: MODAL_SERIE, endeNach: 19 })
  pruefe('Gegenprobe: normaler Titel wartet in den ersten 19 s weiter auf die Liste', normal.weiter === 0 && normal.gemeldet === 0, [normal.weiter, normal.gemeldet])
  const nachFrist = await spiel({ text: MODAL_SERIE, endeNach: 21 })
  pruefe('Gegenprobe: nach der Frist (20 s) gibt er auf wie bisher, ohne zu melden', nachFrist.weiter === 1 && nachFrist.gemeldet === 0 && nachFrist.spuren.includes('keine Folgenliste'), nachFrist)
  pruefe('Gegenprobe: ein Seitenwechsel beginnt die Wartezeit neu', warte({ seite: 'a', seit: 0 }, { seite: 'b', jetzt: 99, erinnern: true, frist: 20000 }, {}).seit === 99)

  /* Verdrahtung: `selbstStartenSchritt` ruft die Wartefunktion mit dem Merkmal des Knopfes. */
  const start = /\nasync function selbstStartenSchritt\(\)[\s\S]*?\n\}\n/.exec(melderQuelle)?.[0] ?? ''
  pruefe('selbstStartenSchritt fragt akNetflixListeWarten mit keineFolgeVorhanden()', /akNetflixListeWarten\(selbstWartet/.test(start) && /erinnern: keineFolgeVorhanden\(\)/.test(start))
  pruefe('… und übergibt keinen Meldeweg (im Erinnern-Fall meldet der Durchgang nichts)', !/melde:\s*melden\b/.test(start))
  pruefe('netflix-erinnern.js lädt im Manifest vor melder.js', (() => {
    const js = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8')).content_scripts.find((c) => c.js.includes('melder.js')).js
    return js.indexOf('netflix-erinnern.js') >= 0 && js.indexOf('netflix-erinnern.js') < js.indexOf('melder.js')
  })())

  console.log('')
  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) gerissen.`)
    process.exit(1)
  }
  console.log('Alle Zusicherungen zum Erinnern-Fall halten.')
}

haupt()
