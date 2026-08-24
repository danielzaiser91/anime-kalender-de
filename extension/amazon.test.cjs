/**
 * Zusicherungen für den Amazon-Leser.
 *
 * Geprüft wird die Auswertung, nicht die Oberfläche: Aus einem Stück
 * Seitenquelltext müssen dieselben Sprachen und Abos herauskommen, die am
 * 23.08.2026 an „Naruto Shippuden" gemessen wurden.
 *
 * Die Muster stehen doppelt — hier und in `amazon.js`. Das ist bewusst: Ein
 * Test, der die Funktion importiert, prüft nur, dass sie sich selbst treu
 * bleibt. Diese Zusicherungen halten sie gegen **echten Seitenquelltext**, und
 * der ändert sich, wenn Amazon etwas umbaut.
 */
const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Wie in `amazon.js` — Sprachen aus allen `audioTracks`-Feldern. */
function spuren(text) {
  const alle = new Set()
  let folgen = 0
  for (const m of text.matchAll(/"audioTracks"\s*:\s*\[([^\]]*)\]/g)) {
    folgen++
    for (const s of m[1].split(',')) {
      const name = s.trim().replace(/^"|"$/g, '')
      if (name) alle.add(name)
    }
  }
  return { sprachen: [...alle], folgen }
}

function abos(text) {
  return [...new Set([...text.matchAll(/"benefitId"\s*:\s*"([^"]+)"/g)].map((m) => m[1]))]
}

function asin(pfad) {
  return /\/(?:dp|detail)\/([A-Z0-9]{10})/.exec(pfad)?.[1] ?? null
}

console.log('Zusicherungen für den Amazon-Leser\n')

// Echter Ausschnitt, gemessen am 23.08.2026 an Naruto Shippuden, Staffel 4.
const echt =
  '"audioTracks":["Deutsch","日本語"],"duration":1355,"entityType":"TV Show","episodeNumber":1,' +
  '"audioTracks":["Deutsch","日本語"],"duration":1355,"episodeNumber":2,' +
  '"benefitId":"aniversede","entitlementType":"Unentitled"'

{
  const { sprachen, folgen } = spuren(echt)
  pruefe('zwei Folgen erkannt', folgen === 2, folgen)
  pruefe('Deutsch und Japanisch gefunden', sprachen.includes('Deutsch') && sprachen.includes('日本語'), sprachen)
  pruefe('das Abo steht da', abos(echt).join() === 'aniversede', abos(echt))
}

/**
 * Der wichtigste Fall: Eine Staffel **ohne** deutsche Tonspur darf nicht
 * versehentlich als deutsch gelten, nur weil das Wort anderswo auf der Seite
 * steht — Amazon nennt „Deutsch" auch in der Untertitelliste und im
 * Seitengerüst.
 */
{
  const nurJapanisch = '"subtitles":["Deutsch"],"audioTracks":["日本語"],"episodeNumber":5, Sprache: Deutsch'
  const { sprachen } = spuren(nurJapanisch)
  pruefe('Untertitel zählen nicht als Tonspur', !sprachen.some((s) => /deutsch/i.test(s)), sprachen)
}

{
  pruefe('ASIN aus /dp/', asin('/dp/B0CQ4VL364') === 'B0CQ4VL364')
  pruefe('ASIN aus /gp/video/detail/', asin('/gp/video/detail/B07VP6VPVR?ref_=x') === 'B07VP6VPVR')
  pruefe('Suchadresse trägt keine', asin('/s?k=Naruto&i=instant-video') === null)
}

/**
 * `entitlementType` ist eine Angabe über das Konto, nicht über den Titel —
 * anonym steht dort immer „Unentitled". Sie darf nirgends einfließen.
 */
{
  pruefe('entitlementType wird nicht als Abo gelesen', !abos(echt).includes('Unentitled'), abos(echt))
}

/**
 * Der Befund-Wert muss zu dem passen, was der Worker annimmt.
 *
 * Die erste Fassung schickte `ja`/`nein` und bekam HTTP 400 zurück — geraten
 * statt nachgesehen, obwohl die gültigen Werte in `worker/src/index.ts`
 * stehen. Diese Zusicherung liest sie **dort** und hält den Leser dagegen;
 * eine fest eingetragene Liste hier würde denselben Fehler nur wiederholen.
 */
{
  const fs = require('node:fs')
  const worker = fs.readFileSync(require('node:path').resolve(__dirname, '../worker/src/index.ts'), 'utf8')
  const m = /\[([^\]]*)\]\.includes\(befund\)/.exec(worker)
  const erlaubt = m ? m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')) : []
  const leser = fs.readFileSync(require('node:path').resolve(__dirname, 'amazon.js'), 'utf8')
  /**
   * Alle Zeichenketten der `befund:`-Zuweisung, nicht nur die eines
   * zweistelligen Fragezeichen-Ausdrucks.
   *
   * Das frühere Muster verlangte genau `befund: x ? 'a' : 'b'`. Als am
   * 24.08.2026 ein dritter Fall dazukam — `weg` für einen toten Verweis —,
   * traf es nicht mehr, `benutzt` blieb leer, und die Zusicherung meldete
   * einen Fehler, wo keiner war. Ein Muster, das an der Zahl der Zweige hängt,
   * bricht beim nächsten Zweig.
   */
  const zuweisung = /befund:([^,]*(?:,(?![\s\S]{0,40}:)[^,]*)*)/.exec(leser)?.[1] ?? ''
  const benutzt = [...zuweisung.matchAll(/'([^']+)'/g)].map((x) => x[1])
  pruefe(
    `die gemeldeten Befunde stehen in der Worker-Liste [${erlaubt.join(', ')}]`,
    erlaubt.length > 0 && benutzt.length > 0 && benutzt.every((b) => erlaubt.includes(b)),
    benutzt,
  )
}

/**
 * Aus einem Ausschnitt darf kein `kein_dub` werden.
 *
 * Amazon lädt lange Staffeln seitenweise. „Deutsch gefunden" bleibt auch bei
 * 24 von 51 Folgen wahr; „kein Deutsch" wäre eine Aussage über die ganze
 * Staffel aus der Hälfte. Geprüft wird am Quelltext, weil die Bedingung im
 * Klick-Zweig steht und sich nicht ohne Browser aufrufen lässt.
 */
{
  const fs = require('node:fs')
  const leser = fs.readFileSync(require('node:path').resolve(__dirname, 'amazon.js'), 'utf8')
  pruefe(
    'unvollständiger Stand ohne Deutsch führt zu keiner Meldung',
    /**
     * Vorangestellte Bedingungen sind erlaubt — die Sperre selbst muss stehen.
     *
     * Seit dem 24.08.2026 steht davor `!nichtAbrufbar &&`: Ein toter Verweis
     * hat naturgemäß keine vollständige Folgenliste, und „gibt es nicht" ist
     * eine andere Aussage als „kein Deutsch". Das Muster erlaubt deshalb
     * weitere Bedingungen davor, verlangt aber unverändert, dass ein
     * unvollständiger Stand ohne Deutsch nicht gemeldet wird.
     */
    /if\s*\([^)]*!deutsch\s*&&\s*!vollstaendig\s*\)[\s\S]{0,400}?return/.test(leser),
  )
  pruefe(
    'die Folgenzahl wird aus episodeNumber gewonnen, nicht aus allen audioTracks',
    /audioTracks[\s\S]{0,60}episodeNumber/.test(leser),
  )
}

/**
 * Region weg ist eine Auskunft, eine Stoerung ist keine.
 *
 * Beide Saetze am 24.08.2026 an "Chaika" belegt (Daniel, mit Bild, B07LHCSXV6):
 * Staffel 1 traegt "In deiner Region nicht mehr auf Prime Video verfuegbar" --
 * das ist available: false, und der Knopf wartete stattdessen auf Tonspuren,
 * die nie kommen. Staffel 2 trug "Bei der Verarbeitung deiner Anfrage ist ein
 * Fehler aufgetreten", obwohl sie mit Prime ansehbar ist -- der Knopf meldete
 * daraufhin "nicht abrufbar".
 *
 * **Geprueft wird hier der Quelltext, nicht das Verhalten.** Der Sandkasten der
 * Uebersichts-Zusicherungen rendert nichts und fuehrt keine Timer aus; ein
 * Durchspielen haette dort mehr ueber den Sandkasten ausgesagt als ueber die
 * Regel. Was diese Zeilen belegen: Beide Saetze werden unterschieden, und die
 * Stoerung fuehrt zu keiner Meldung. Ob es an der echten Seite greift, sagt
 * erst Daniels Blick -- das steht als offener Punkt in status.md.
 */
{
  const fs = require('node:fs')
  const leser = fs.readFileSync(require('node:path').resolve(__dirname, 'amazon.js'), 'utf8')
  pruefe(
    'der Regionshinweis wird erkannt',
    /In deiner Region nicht mehr auf Prime Video/.test(leser),
  )
  pruefe(
    'und fuehrt zu einem meldbaren Knopf, nicht zum Warten',
    /regionWeg[\s\S]{0,200}Region nicht mehr verf/.test(leser),
  )
  pruefe(
    'eine Amazon-Stoerung wird als solche erkannt',
    /Bei der Verarbeitung deiner Anfrage ist ein Fehler aufgetreten/.test(leser),
  )
  pruefe(
    'und sperrt den Knopf, statt einen Befund daraus zu machen',
    /if \(stoerung\)[\s\S]{0,220}knopf\.disabled = true/.test(leser),
  )
}

/**
 * Solange der Melde-Stand geladen wird, bietet der Knopf nichts an.
 *
 * Daniel am 24.08.2026, nach einem Klick auf einen Chaika-Link: "ohne was zu
 * machen nach paar sek steht da noch 1 staffel, warum? … dann sollte der button
 * vorher nicht klickbar sein sondern 'pruefe melde-status' oder so sagen."
 *
 * Er hat recht, und der Fall ist heikler als er aussieht: `speicherLesen` ist
 * asynchron, in den ersten Millisekunden ist der Stand leer, und der Knopf lud
 * zum Melden ein -- fuer einen Titel, der laengst durch war. Seit 0.66 wartet
 * der **Klick** auf den Stand, aber ein Knopf, der "melden" anbietet und dann
 * seine Meinung aendert, ist trotzdem falsch.
 */
{
  const fs = require('node:fs')
  const leser = fs.readFileSync(require('node:path').resolve(__dirname, 'amazon.js'), 'utf8')
  pruefe(
    'ohne geladenen Stand sagt der Knopf, dass er prueft',
    /if \(!standGeladen\)[\s\S]{0,300}pr(?:ü|ue)fe Melde-Status/.test(leser),
  )
  pruefe(
    'und ist dabei gesperrt',
    /if \(!standGeladen\)[\s\S]{0,200}knopf\.disabled = true/.test(leser),
  )
  pruefe(
    'der Klick wartet zusaetzlich auf den Stand',
    /await standFertig/.test(leser),
  )
}

/**
 * Der Serienname zum Wiederfinden ist der von Amazon, nicht unserer.
 *
 * Nach einem Neuladen auf einer Staffel-Seite findet die Erweiterung ihren
 * Listeneintrag ueber den Serientitel wieder -- verglichen wird mit
 * `seitenTitel()`. Wer beim Speichern etwas anderes ablegt, findet nie etwas.
 *
 * Real am 24.08.2026 an "Chaika": Unsere Liste fuehrt ihn als "Hitsugi no
 * Chaika: AVENGING BATTLE", Amazon nennt beide Staffeln schlicht "Chaika".
 * Daniel meldete beide Staffeln, der Knopf sagte weiter "noch 1 Staffel" --
 * die zweite Meldung war unter einer fremden Kennung gelandet.
 */
{
  const fs = require('node:fs')
  const leser = fs.readFileSync(require('node:path').resolve(__dirname, 'amazon.js'), 'utf8')
  pruefe(
    'gespeichert wird der Seitentitel, nicht der Listenname',
    /bisher\.serie = seitenTitel\(\)/.test(leser),
  )
  pruefe(
    'und genau damit wird spaeter gesucht',
    /const serie = seitenTitel\(\)[\s\S]{0,240}erledigt\[k\]\?\.serie === serie/.test(leser),
  )
}

/**
 * Der Serientitel kommt aus einer Quelle, die DIESE Seite benennt.
 *
 * Das Auswahlfeld-Muster sucht "<Titel> - Staffel N" im gesamten HTML. Wo das
 * echte Auswahlfeld nur "Staffel 1" traegt -- ohne Serienname davor --, trifft
 * es den ersten passenden Text irgendwo sonst: eine Empfehlungskachel.
 *
 * Gemessen am 24.08.2026 an der Chaika-Seite B07LHFLDBS:
 *
 *     Auswahlfeld-Muster -> "DanMachi - Is It Wrong to Try to Pick Up Girls..."
 *     og:title           -> leer
 *     h1                 -> "Chaika"
 *
 * In Daniels Tooltip stand an derselben Stelle "Ragna Crimson" -- je nachdem,
 * welche Kachel gerade geladen war. Und weil der Serientitel seit 0.72
 * Meldungen einem Listeneintrag zuordnet, haette das den Befund einer Serie an
 * eine andere geschrieben.
 */
{
  const fs = require("node:fs")
  const leser = fs.readFileSync(require("node:path").resolve(__dirname, "amazon.js"), "utf8")
  const stelleOg = leser.indexOf("og:title")
  const stelleMuster = leser.indexOf("const ausAuswahl =")
  pruefe(
    "og:title und h1 werden vor dem Auswahlfeld-Muster gelesen",
    stelleOg > 0 && stelleMuster > 0 && stelleOg < stelleMuster,
    { og: stelleOg, muster: stelleMuster },
  )
}

/**
 * "Nicht mehr in deiner Region" gilt vor jeder Folgenzaehlung.
 *
 * Die Pruefung stand im Zweig fuer "keine Folgen geladen" und wurde damit nur
 * erreicht, wenn der Quelltext gar nichts hergab. Bei "Chaika" Staffel 1
 * stehen zehn Folgen darin, waehrend die Seite darueber den Regionshinweis
 * traegt: Der Knopf verlangte "10 von 12 -- Abschnitte selbst oeffnen" fuer
 * Abschnitte, die es hier nicht mehr gibt (Daniel, 24.08.2026).
 */
{
  const fs = require("node:fs")
  const leser = fs.readFileSync(require("node:path").resolve(__dirname, "amazon.js"), "utf8")
  const stelleRegion = leser.indexOf("if (regionWeg) {")
  const stelleVollstaendig = leser.indexOf("if (!vollstaendig) {")
  pruefe(
    "der Regionshinweis wird vor der Vollstaendigkeit geprueft",
    stelleRegion > 0 && stelleVollstaendig > 0 && stelleRegion < stelleVollstaendig,
    { region: stelleRegion, vollstaendig: stelleVollstaendig },
  )
  pruefe(
    "und laesst das Melden zu, statt zu sperren",
    leser.slice(stelleRegion, stelleRegion + 400).includes('knopf.disabled = false'),
  )
}

console.log(fehler.length ? `\n${fehler.length} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler.length ? 1 : 0)
