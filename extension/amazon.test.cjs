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

/**
 * **Eine Tonspur zählt auch dann, wenn Amazon viel dazwischenschreibt.**
 *
 * Bis zum 25.08.2026 verlangte der Leser, dass `audioTracks` und
 * `episodeNumber` höchstens 400 Zeichen auseinanderliegen. Bei „Babylon"
 * (`0J16B1NAB82TO0O5A5Q8TLG1VP`) liegen sie weiter auseinander: Die Seite führt
 * 15 Tonspurangaben, alle mit Deutsch, und 12 Folgennummern — gefunden wurden
 * **null** Paare, und der Knopf blieb auf „Tonspuren noch nicht geladen".
 *
 * Gepaart wird deshalb über die Reihenfolge: Zu einer Tonspurangabe gehört die
 * nächste Folgennummer dahinter, solange vorher keine weitere Tonspurangabe
 * kommt. Diese Zusicherung hält das gegen einen Abstand fest, der jede feste
 * Grenze reißt.
 */
function paare(text) {
  const alle = new Set()
  const nummern = new Set()
  const tonspuren = [...text.matchAll(/"audioTracks"\s*:\s*\[([^\]]*)\]/g)]
  const folgenNr = [...text.matchAll(/"episodeNumber"\s*:\s*(\d+)/g)]
  let nrIndex = 0
  for (let i = 0; i < tonspuren.length; i++) {
    const von = tonspuren[i].index ?? 0
    const bis = tonspuren[i + 1]?.index ?? text.length
    while (nrIndex < folgenNr.length && (folgenNr[nrIndex].index ?? 0) < von) nrIndex++
    const treffer = folgenNr[nrIndex]
    if (!treffer || (treffer.index ?? 0) >= bis) continue
    nummern.add(Number(treffer[1]))
    for (const s of tonspuren[i][1].split(',')) {
      const name = s.trim().replace(/^"|"$/g, '')
      if (name) alle.add(name)
    }
  }
  return { sprachen: [...alle], folgen: nummern.size }
}

{
  const fuellung = '"x":"' + 'y'.repeat(900) + '",'
  const weit =
    '"audioTracks":["Deutsch"],' + fuellung + '"episodeNumber":1,' +
    '"audioTracks":["Deutsch"],' + fuellung + '"episodeNumber":2,'
  const { sprachen, folgen } = paare(weit)
  pruefe('900 Zeichen Abstand: beide Folgen erkannt', folgen === 2, folgen)
  pruefe('900 Zeichen Abstand: Deutsch gefunden', sprachen.includes('Deutsch'), sprachen)
}

{
  // Und die Paarung greift nicht über die nächste Tonspurangabe hinweg: Eine
  // Angabe ohne eigene Folgennummer bleibt ohne — sonst erbte sie eine fremde.
  const ohneEigene = '"audioTracks":["日本語"],"audioTracks":["Deutsch"],"episodeNumber":7,'
  const { sprachen, folgen } = paare(ohneEigene)
  pruefe('ohne eigene Folgennummer keine Zuordnung', folgen === 1 && !sprachen.includes('日本語'), {
    sprachen,
    folgen,
  })
}

/**
 * **Eine Prime-Kennung hat nicht immer zehn Zeichen.**
 *
 * Prime Video führt neben ASIN-Kennungen (10 Zeichen, `B0…`) auch GTIs mit 26
 * Zeichen. Ein Muster auf `{10}` schneidet sie ab und macht jeden Abgleich
 * unmöglich — bei „Babylon" und „Akame ga Kill" blieb der Knopf deshalb auf
 * „Tonspuren noch nicht geladen" stehen, obwohl die Seite 15 Tonspurangaben mit
 * Deutsch führte (Daniel, 25.08.2026, gemessen in seiner Sitzung).
 */
{
  const kennung = (s) => /\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,32})(?:[/?]|$)/.exec(s)?.[1] ?? null
  pruefe('ASIN mit zehn Zeichen', kennung('/dp/B0CJXXV5DP') === 'B0CJXXV5DP', kennung('/dp/B0CJXXV5DP'))
  pruefe(
    'GTI mit sechsundzwanzig Zeichen bleibt ganz',
    kennung('/gp/video/detail/0J16B1NAB82TO0O5A5Q8TLG1VP') === '0J16B1NAB82TO0O5A5Q8TLG1VP',
    kennung('/gp/video/detail/0J16B1NAB82TO0O5A5Q8TLG1VP'),
  )
  pruefe(
    'und endet am Fragezeichen',
    kennung('/gp/video/detail/0HSXN9KO9VCAUTXWKIY203H5KV?ref_=x') === '0HSXN9KO9VCAUTXWKIY203H5KV',
    kennung('/gp/video/detail/0HSXN9KO9VCAUTXWKIY203H5KV?ref_=x'),
  )
}

/**
 * **Die Zahl über der Folgenliste — gegen zwei Fallen im selben Text.**
 *
 * Beide Texte unten sind am 25.08.2026 aus Daniels Sitzung gemessen, nicht
 * ausgedacht: „Babylon" (die Falle) und „Bayonetta: Bloody Fate" (der Gegenfall,
 * ein Film ohne Folgenliste).
 */
function folgenAusText(text) {
  if (typeof text !== 'string') return null
  for (const m of text.matchAll(/(?:^|\n)[ \t]*(\d+)[ \t]*Folgen?\b/g)) {
    return Number(m[1]) || null
  }
  return null
}

{
  /*
    Alle Texte in Zeilenform — so liefert `body.innerText` sie, und darauf
    beruht die Erkennung. Die vier Fälle sind am 25.08.2026 aus Daniels Sitzung
    gemessen; jeder davon hat vorher eine falsche Zahl erzeugt.
  */
  const babylon =
    'Geschenkgutschein oder Promotioncode einlösen\nStaffel 1\nFolgen\nÄhnliches\nDetails\n' +
    '12 Folgen\n1. Verdacht\n25 Min. 6. Okt. 2019\n2. Zielperson'
  pruefe('„Staffel 1" plus Reiter „Folgen" zählt nicht', folgenAusText(babylon) === 12, folgenAusText(babylon))

  const jjk =
    '2026 4 Staffeln\nJUJUTSU KAISEN Season 3\nFolgen\nÄhnliches\nDetails\n12 Folgen\n1. Die Hinrichtung'
  pruefe('„Season 3" plus Reiter zählt nicht', folgenAusText(jjk) === 12, folgenAusText(jjk))

  const abyss = 'Staffel 1, Volume 2\nFolgen\nÄhnliches\nDetails\n6 Folgen\n1. Die Reise'
  pruefe('„Volume 2" plus Reiter zählt nicht', folgenAusText(abyss) === 6, folgenAusText(abyss))

  const conan =
    'Staffel 1\nFolgen\nÄhnliches\nDetails\n24 Folgen\n1. Die Bucht der Rache (1)\n' +
    'DETEKTIV CONAN TV-SERIE EPISODEN 231-254'
  pruefe('ein Folgenbereich im Titel zählt nicht', folgenAusText(conan) === 24, folgenAusText(conan))

  const ohneKopf = '1. Verdacht\n25 Min. 6. Okt. 2019\n2. Zielperson\n24 Min. 6. Okt. 2019'
  pruefe('ein Erscheinungsdatum liefert keine Folgenzahl', folgenAusText(ohneKopf) === null, folgenAusText(ohneKopf))

  pruefe(
    'ein Film ohne Folgenliste bleibt ohne Zahl',
    folgenAusText('Bayonetta: Bloody Fate\n1 Std. 26 Min.\n2013\nÄhnliches\nDetails') === null,
  )
  pruefe('die einzelne Folge zählt weiterhin', folgenAusText('Details\n1 Folge\n1. Der Anfang') === 1)
  pruefe('eine lange Reihe zählt weiterhin', folgenAusText('Details\n1122 Folgen\n1. Ich bin Ruffy') === 1122)
}

/**
 * **Ein Titelwechsel ohne Neuladen macht den Quelltext wertlos.**
 *
 * Gemessen am 25.08.2026 in Daniels Sitzung, über zwei Wechsel aus der
 * Prüfliste: Die Adresse wanderte von `0NWGEHP4…` über `0J16B1NAB8…` nach
 * `0OULQMP5Z…`, die Überschrift von „Armed Girl's Machiavellianism" über
 * „Babylon" nach „Bayonetta" — die Kennung im Quelltext blieb acht Sekunden
 * lang `B0CJPZFQ9H`. Der Knopf zeigte durchgehend denselben Text; seine
 * Datenquelle hatte sich nie geändert.
 *
 * Erkannt wird das am **Paar** aus Titel und Quelltext-Kennung: Wandert der
 * Titel, während die Kennung stehen bleibt, gehört der Quelltext zum vorigen
 * Titel.
 */
function quelltextVeraltetTest(schritte) {
  let stand = null
  const ergebnis = []
  for (const { titel, kennung } of schritte) {
    if (!titel || !kennung) {
      ergebnis.push(false)
      continue
    }
    if (!stand || stand.kennung !== kennung) {
      stand = { titel, kennung }
      ergebnis.push(false)
      continue
    }
    ergebnis.push(stand.titel !== titel)
  }
  return ergebnis
}

{
  // Daniels Messung, Schritt für Schritt.
  const gemessen = quelltextVeraltetTest([
    { titel: "Armed Girl's Machiavellianism", kennung: 'B0CJPZFQ9H' },
    { titel: 'Babylon', kennung: 'B0CJPZFQ9H' },
    { titel: 'Bayonetta: Bloody Fate', kennung: 'B0CJPZFQ9H' },
  ])
  pruefe('der erste Stand gilt als frisch', gemessen[0] === false, gemessen)
  pruefe('nach dem Titelwechsel gilt der Quelltext als veraltet', gemessen[1] === true, gemessen)
  pruefe('und bleibt es beim zweiten Wechsel', gemessen[2] === true, gemessen)
}

{
  // Zieht der Quelltext nach, ist alles wieder in Ordnung — sonst bliebe die
  // Seite nach einem echten Neuladen für immer gesperrt.
  const nachgezogen = quelltextVeraltetTest([
    { titel: 'Babylon', kennung: 'B0AAAAAAA1' },
    { titel: 'Bayonetta', kennung: 'B0BBBBBBB2' },
    { titel: 'Bayonetta', kennung: 'B0BBBBBBB2' },
  ])
  pruefe('ein nachgezogener Quelltext gilt wieder als frisch', nachgezogen.every((x) => x === false), nachgezogen)
}

{
  // Ein leerer Titel darf nichts auslösen — bei „Oshi no Ko" Staffel 3 waren
  // og:title, twitter:title und h1 alle leer.
  const leer = quelltextVeraltetTest([
    { titel: 'Babylon', kennung: 'B0AAAAAAA1' },
    { titel: '', kennung: 'B0AAAAAAA1' },
    { titel: 'Babylon', kennung: 'B0AAAAAAA1' },
  ])
  pruefe('ein leerer Titel loest nichts aus', leer.every((x) => x === false), leer)
}

/**
 * **Ein frischer Quelltext darf nie als veraltet gelten.**
 *
 * Der Wächter merkt sich ein Paar aus Titel und Quelltext-Kennung. Beim
 * Rendern wechselt der Titel aber auch dann, wenn alles in Ordnung ist — erst
 * leer oder mit Shopnamen, dann der echte. Ohne den Kennungsvergleich davor
 * kam er nie wieder heraus, weil sein Paar nur ein Kennungswechsel erneuert.
 *
 * Belegt am 25.08.2026 durch das Diagnosefeld an „Clannad": `ausSeite` und
 * `ausAdresse` beide `B0FM2CDBWL`, `quelltextVeraltet` trotzdem `true`.
 */
function veraltetTest(schritte) {
  let stand = null
  return schritte.map(({ titel, kennung, ausAdresse }) => {
    if (kennung && ausAdresse && kennung === ausAdresse) return false
    if (!titel || !kennung) return false
    if (!stand || stand.kennung !== kennung) {
      stand = { titel, kennung }
      return false
    }
    return stand.titel !== titel
  })
}

{
  // Daniels Clannad-Fall: gleiche Kennung, Titel wechselt beim Rendern.
  const clannad = veraltetTest([
    { titel: '', kennung: 'B0FM2CDBWL', ausAdresse: 'B0FM2CDBWL' },
    { titel: 'Clannad', kennung: 'B0FM2CDBWL', ausAdresse: 'B0FM2CDBWL' },
    { titel: 'Clannad', kennung: 'B0FM2CDBWL', ausAdresse: 'B0FM2CDBWL' },
  ])
  pruefe('gleiche Kennung heisst nie veraltet', clannad.every((x) => x === false), clannad)
}

{
  // Der echte SPA-Wechsel: Adresse wandert, Quelltext bleibt stehen.
  const spa = veraltetTest([
    { titel: "Armed Girl's", kennung: 'B0CJPZFQ9H', ausAdresse: '0NWGEHP42S9O06TJ2YXLUU3M3D' },
    { titel: 'Babylon', kennung: 'B0CJPZFQ9H', ausAdresse: '0J16B1NAB82TO0O5A5Q8TLG1VP' },
    { titel: 'Bayonetta', kennung: 'B0CJPZFQ9H', ausAdresse: '0OULQMP5ZBDUJWENT9UIT0CBW9' },
  ])
  pruefe('der echte SPA-Wechsel wird weiterhin erkannt', spa[1] === true && spa[2] === true, spa)
}

/**
 * **Was an einem Titel hängt, endet mit ihm.**
 *
 * Drei Zustände sind titelbezogen: der Zählstand, die zuletzt gezielt geholte
 * Kennung (`frischeStaffel`) und das Titel-Kennung-Paar des Veraltet-Wächters.
 * Blieb einer davon stehen, war `quelltextPasst()` dauerhaft falsch — und der
 * Knopf las nie wieder aus dem Quelltext.
 *
 * Daniels Diagnose vom 25.08.2026 nach mehreren Wechseln zwischen Serien:
 * `frischeStaffel` stand auf Clannads GTI, während Adresse und Quelltext
 * beide `B0FZLQTT9W` sagten; der Zählstand führte neun Sprachen des vorigen
 * Titels und null Folgen.
 */
{
  // Geprueft wird die Quelle selbst — eine nachgebaute Attrappe wuerde nur sich
  // selbst bestaetigen. Alle drei Zustaende muessen im Wechsel-Zweig enden.
  const fs = require('node:fs')
  const quelle = fs.readFileSync(require('node:path').resolve(__dirname, 'amazon.js'), 'utf8')
  const von = quelle.indexOf('function beiStaffelwechsel()')
  /*
    Das Fenster misst den Zweig, nicht die Zeichen: Es wächst mit, wenn dort
    eine Rücksetzung dazukommt. Am 27.08.2026 fiel es dreimal rot aus, weil eine
    einzige neue Zeile es sprengte — die Zusicherung prüft die Absicht, nicht
    die Länge.
  */
  const zweig = quelle.slice(von, von + 3200)
  pruefe('beiStaffelwechsel leert den Zaehlstand', /gesehen = leererStand\(\)/.test(zweig))
  pruefe('beiStaffelwechsel leert frischeStaffel', /frischeStaffel = null/.test(zweig))
  pruefe('beiStaffelwechsel leert das Titel-Kennung-Paar', /titelZuQuelltext = null/.test(zweig))
}

/**
 * **Der Adressvergleich muss zwei verschiedene Quellen vergleichen.**
 *
 * `asin()` liefert `asinAusSeite() ?? asinAusAdresse()` — also zuerst den
 * Quelltext. Wer damit gegen `asinAusSeite()` prüft, fragt zweimal dasselbe und
 * bekommt immer „gleich" heraus.
 *
 * Real am 25.08.2026 beim Wechsel von „Darwin Jihen" zu „Clannad": Die Adresse
 * lautete `…/detail/0FQH6UJI…`, das Diagnosefeld meldete als `ausAdresse`
 * trotzdem `B0FZLQTT9W` — die Kennung aus dem alten Quelltext. Der Wächter hielt
 * ihn für frisch, und der Knopf zeigte dessen dreizehn Folgen und neun Sprachen,
 * obwohl Clannad nur Deutsch und Japanisch führt.
 */
{
  const ausAdresse = (p) => /\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,32})(?:[/?]|$)/.exec(p)?.[1] ?? null
  const gehoertZurSeite = (quelltext, pfad) => {
    const a = ausAdresse(pfad)
    return Boolean(quelltext && a && quelltext === a)
  }
  pruefe(
    'alter Quelltext bei neuer Adresse gilt nicht als frisch',
    gehoertZurSeite('B0FZLQTT9W', '/gp/video/detail/0FQH6UJINFTOTF1LP1IH1VQ7T5') === false,
  )
  pruefe(
    'derselbe Titel gilt als frisch',
    gehoertZurSeite('B0FZLQTT9W', '/gp/video/detail/B0FZLQTT9W') === true,
  )
  const quelle = require('node:fs').readFileSync(require('node:path').resolve(__dirname, 'amazon.js'), 'utf8')
  const block = quelle.slice(quelle.indexOf('function quelltextGehoertZurSeite()'), quelle.indexOf('function quelltextGehoertZurSeite()') + 1400)
  pruefe('und die Quelle nimmt dafuer asinAusAdresse()', /const ausAdresse = asinAusAdresse\(\)/.test(block))
}

/**
 * **Eine späte Antwort des vorigen Titels gehört nicht in den neuen Zählstand.**
 *
 * Daniel hat den Wettlauf am 25.08.2026 durch Abwarten eingekreist: Lädt ein
 * Titel noch — Amazons Abspiel-Knopf zeigt dabei rund zwanzig Sekunden eine
 * Ladeanimation — und wechselt man in dieser Zeit, kommen dessen
 * Nachlade-Antworten nach dem Wechsel an. „13 von 24" bei Clannad, wo die
 * dreizehn zu „Darwin Jihen" gehörten. Nach dem Abwarten stimmten die 24.
 */
{
  const nimmAn = (fuerAdresse, jetzt) =>
    !(typeof fuerAdresse === 'string' && fuerAdresse !== jetzt)
  const clannad = '/gp/video/detail/0FQH6UJINFTOTF1LP1IH1VQ7T5'
  const darwin = '/gp/video/detail/B0FZLQTT9W'
  pruefe('die Antwort zur jetzigen Seite zaehlt', nimmAn(clannad, clannad) === true)
  pruefe('die verspaetete des vorigen Titels nicht', nimmAn(darwin, clannad) === false)
  pruefe('eine Meldung ohne Adresse zaehlt weiterhin', nimmAn(undefined, clannad) === true)

  const quelle = require('node:fs').readFileSync(require('node:path').resolve(__dirname, 'amazon.js'), 'utf8')
  pruefe('der Empfaenger prueft die Adresse', /e\.data\.fuerAdresse !== location\.pathname/.test(quelle))
  const leser = require('node:fs').readFileSync(require('node:path').resolve(__dirname, 'amazon-leser.js'), 'utf8')
  /*
    **Gezählt wird nicht, verglichen wird.**

    Bis zum 25.08.2026 stand hier `=== 2` — die Zahl der Sendestellen von damals.
    Als der Film-Weg zwei weitere brachte, wurde die Zusicherung rot, obwohl alle
    vier die Adresse korrekt mitschicken. Eine Prüfung, die an der Anzahl hängt,
    misst den Umbau statt der Regel.
  */
  const sendeStellen = (leser.match(/window\.postMessage\(/g) ?? []).length
  /*
    **Gestempelt wird mit der Abruf-Adresse, nicht mit `location` beim Senden.**

    Zwischen Abruf und Auswertung liegen Sekunden; wechselt Daniel in dieser Zeit
    die Staffel, trägt die Antwort sonst die neue Adresse und der Empfänger sieht
    keinen Grund zu leeren. Bei „Space Dandy" standen so 26 Folgen aus Staffel 1
    unter der Adresse von Staffel 2 (31.08.2026).
  */
  const mitAdresse = (leser.match(/fuerAdresse: abrufAdresse/g) ?? []).length
  pruefe('jede Sendestelle haengt die Adresse an', sendeStellen > 0 && mitAdresse === sendeStellen, {
    sendeStellen,
    mitAdresse,
  })
}

/**
 * **„Season 3" zählt so wenig als Folgenzahl wie „Staffel 1".**
 *
 * Amazon nennt Staffeln auch auf Englisch. Die Seite zu „JUJUTSU KAISEN
 * Season 3" ergab `lautSeite: 3`, obwohl darunter „12 Folgen" stand — sichtbar
 * im Diagnosefeld als `folgen: 12, gesamt: 3`. Der Zählstand hatte alle zwölf
 * gelesen, der Umfang deckelte sie auf drei, und der Knopf bot „3 Folgen" zum
 * Melden an (Daniel, 25.08.2026).
 */
// (Der Season-Fall steht jetzt oben bei den anderen drei, in Zeilenform.)

/**
 * **Der Titel-Rückfall liefert dasselbe wie vorher — nur nicht mehr in 25 ms.**
 *
 * Das alte Muster `([^<>"]{3,120}?)\s+[-–—]\s+(?:Staffel|Season)\s+\d+` war mit
 * 81 ms je Durchlauf der teuerste Posten der Erweiterung (Review 25.08.2026),
 * und ein Takt ruft die Funktion bis zu fünfmal auf. Ursache war das faule
 * Zählquantiv: An jeder Startstelle probiert der Motor die Längen 3, 4, 5 …
 *
 * Jetzt sucht ein billiges Muster den Anker, und der Titel wird aus den 120
 * Zeichen davor gelesen. Gemessen an 1.032.526 Zeichen: 24,83 ms gegen 0,89 ms
 * bei identischem Ergebnis.
 */
{
  const alt = (h) => /([^<>"]{3,120}?)\s+[-–—]\s+(?:Staffel|Season)\s+\d+/i.exec(h)?.[1]
  const neu = (h) => {
    const anker = /\s+[-–—]\s+(?:Staffel|Season)\s+\d+/i.exec(h)
    if (!anker) return undefined
    return /([^<>"]{3,120})$/.exec(h.slice(Math.max(0, anker.index - 120), anker.index))?.[1]
  }
  const faelle = [
    '<div>Jujutsu Kaisen – Staffel 3</div>',
    '<span>Detektiv Conan - Season 12</span>',
    '<p>Dan Da Dan — Staffel 2</p>',
    '<div>ohne Trennzeichen Staffel 3</div>',
    '<div>gar nichts</div>',
  ]
  let gleich = 0
  for (const f of faelle) if (alt(f) === neu(f)) gleich++
  pruefe('beide Fassungen liefern dasselbe', gleich === faelle.length, { gleich, von: faelle.length })
  pruefe('und der Titel wird erkannt', neu(faelle[0]) === 'Jujutsu Kaisen', neu(faelle[0]))
  // Eine Zusicherung auf den Quelltext waere hier untauglich: Das alte Muster
  // steht weiterhin im Kommentar, der erklaert, warum es weg ist.

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
     * **Das Fenster misst die Absicht, nicht die Länge.** Am 28.08.2026 sprengte
     * ein erklärender Kommentar im Zweig die bisherigen 400 Zeichen, und die
     * Zusicherung wurde rot, obwohl die Sperre unverändert dastand — dieselbe
     * Falle wie beim `beiStaffelwechsel`-Test. Geprüft wird, dass zwischen
     * Bedingung und `return` nichts anderes passiert; dafür genügt ein
     * großzügiges Fenster.
     */
    /if\s*\([^)]*!deutsch\s*&&\s*!vollstaendig\s*\)[\s\S]{0,2500}?return/.test(leser),
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
 * "Nicht mehr in deiner Region" gilt vor jeder Folgenzaehlung -- und nur bei
 * unvollstaendiger Liste.
 *
 * Zwei Faelle, beide von Daniel belegt, und der Satz ist in beiden derselbe:
 *
 * - **Die ganze Seite** -- "Chaika" Staffel 1 (24.08.2026): zehn Folgen im
 *   Quelltext, zwoelf laut Zaehlwerk. Die Pruefung stand damals im Zweig fuer
 *   "keine Folgen geladen" und wurde nie erreicht; der Knopf verlangte "10 von
 *   12 -- Abschnitte selbst oeffnen" fuer Abschnitte, die es nicht mehr gibt.
 * - **Eine einzelne Folge** -- "Mahouka" Staffel 2 (25.08.2026, mit Bild):
 *   Folge 1 und 2 tragen den Satz in ihrer Kachel, die uebrigen elf sind
 *   abspielbar, alle dreizehn stehen in der Liste. Der Knopf bot trotzdem an,
 *   die ganze Reihe als verschwunden zu melden.
 *
 * Beide Zeilen zusammen halten die Regel fest: Der Zweig steht **vor** der
 * Zaehlung (sonst Fall eins), und er greift nur, wenn Folgen fehlen (sonst
 * Fall zwei). Wer eine der beiden loest, holt sich den anderen Fehler zurueck.
 */
{
  const fs = require("node:fs")
  const leser = fs.readFileSync(require("node:path").resolve(__dirname, "amazon.js"), "utf8")
  const stelleRegion = leser.indexOf("if (regionWeg && !vollstaendig && !deutsch) {")
  const stelleVollstaendig = leser.indexOf("if (!vollstaendig && !(regionWeg && deutsch)) {")
  pruefe(
    "der Regionshinweis wird vor der Vollstaendigkeit geprueft",
    stelleRegion > 0 && stelleVollstaendig > 0 && stelleRegion < stelleVollstaendig,
    { region: stelleRegion, vollstaendig: stelleVollstaendig },
  )
  /**
   * Drei Bedingungen, drei reale Faelle — wer eine loest, holt sich einen zurueck:
   *
   * - ohne `regionWeg`: "Chaika" Staffel 1 wartete auf Tonspuren, die nie kommen
   * - ohne `!vollstaendig`: "Mahouka" bot an, eine vollstaendige Staffel als
   *   verschwunden zu melden, weil zwei Folgen den Hinweis in ihrer Kachel tragen
   * - ohne `!deutsch`: dieselbe Staffel mit drei gesperrten Folgen -- zehn davon
   *   mit deutschem Ton -- galt als unvollstaendig und damit als verschwunden
   */
  pruefe(
    "und gilt nur, solange Folgen fehlen und nichts belegt ist",
    stelleRegion > 0,
  )
  pruefe(
    "ein gefundener deutscher Ton schlaegt ihn",
    /regionWeg && !vollstaendig && !deutsch/.test(leser) &&
      /!vollstaendig && !\(regionWeg && deutsch\)/.test(leser),
  )
  pruefe(
    "und laesst das Melden zu, statt zu sperren",
    leser.slice(stelleRegion, stelleRegion + 400).includes('knopf.disabled = false'),
  )
}

/**
 * Der Quelltext wird einmal gelesen und festgehalten, nicht in jedem Durchlauf.
 *
 * `document.documentElement.innerHTML` baut die Zeichenkette **jedes Mal neu
 * auf** — bei einer Prime-Video-Seite rund 1,6 MB. Zweimal je Sekunde, auf
 * einer Seite, die stundenlang offen ist, und Chrome haelt alle Tabs derselben
 * Site in einem Renderer-Prozess.
 *
 * Zweimal hat das Daniels Tab beendet, mit demselben "Aw, Snap! Out of Memory":
 * am 24.08.2026 nach einer Handvoll Wechsel, am 25.08.2026 "nach ca 20
 * meldungen in a row". Beim ersten Mal war die Antwort "einmal je Durchlauf",
 * beim zweiten Mal eine Frist von zwei Sekunden.
 *
 * Diese drei Zeilen halten fest, was dabei gilt: **eine** Stelle liest den
 * Quelltext, sie hat eine Frist, und der Dauertakt umgeht sie nicht.
 */
{
  const fs = require('node:fs')
  const leser = fs.readFileSync(require('node:path').resolve(__dirname, 'amazon.js'), 'utf8')
  const lesungen = (leser.match(/documentElement\?\.innerHTML/g) ?? []).length
  pruefe('nur eine einzige Stelle liest den Quelltext', lesungen === 1, { lesungen })
  pruefe('und sie haelt ihn eine Frist lang fest', /HTML_FRIST_MS/.test(leser))
  const takt = leser.slice(leser.lastIndexOf('setInterval(() => {'))
  pruefe(
    'der Dauertakt wirft den Zwischenspeicher nicht weg',
    !takt.slice(0, 300).includes('htmlNeuLesen()'),
  )
  pruefe(
    'body.innerText wird ebenfalls nur an einer Stelle gelesen',
    (leser.match(/body\?\.innerText/g) ?? []).length === 1,
  )
}

/**
 * Nachgeladen wird nach der Kennung, nicht nach der Staffelnummer.
 *
 * `getDetailWidgets?titleID=<ASIN>` liefert die Folgenliste zu genau dieser
 * Kennung. Fuehrt eine Serie je Staffel eine eigene (High School DxD, GOSICK,
 * Captain Tsubasa), trifft der Aufruf; teilen sich mehrere Staffeln eine
 * (JoJo, Jujutsu Kaisen, Marco), kann er nur immer dieselbe liefern.
 *
 * Bis zum 25.08.2026 entschied das die Staffelnummer aus der Adresse: geholt
 * wurde nur bei `_s1`. Der Sammelfall war damit richtig abgedeckt, der
 * haeufigere aber gleich mit erschlagen -- jeder Wechsel auf Staffel 2 oder
 * hoeher verlangte ein Neuladen. Daniel: "neu lade zwang bug ... muss jedesmal
 * neuladen nervt".
 *
 * Wer die Nummer wieder einbaut, holt sich das zurueck.
 */
{
  const fs = require('node:fs')
  const leser = fs.readFileSync(require('node:path').resolve(__dirname, 'amazon-leser.js'), 'utf8')
  pruefe(
    'die Staffelnummer aus der Adresse steuert das Nachladen nicht mehr',
    !/staffelInAdresse/.test(leser),
  )
  pruefe(
    'der Zaehlstand merkt sich, zu welcher Kennung er gehoert',
    /geholteStaffel\s*=[\s\S]{0,200}location\.pathname/.test(leser),
  )
  pruefe(
    'und ein misslungener Abruf gibt die Kennung wieder frei',
    /if \(!ankam\) geholteStaffel = vorher/.test(leser),
  )
}

/* ══ Beim Fernsehen ist die Erweiterung unsichtbar ════════════════════ */
{
  /*
    **Der Player wird gemessen, nicht am Klassennamen erkannt.**

    Am 02.09.2026 lief „Vom Landei zum Schwertheiligen" S2F9 im Vollbild auf
    einer `/gp/video/detail/`-Adresse, und über dem Bild standen Prüflisten-Knopf
    und Ruhemodus-Zeile — Amazon hängt den Player dort ohne
    `.webPlayerSDKContainer` ein. Daniel: „in watch mode no extension should be
    visible."

    Die Funktion wird aus `amazon.js` geholt statt nachgebaut — eine zweite
    Fassung liefe unweigerlich auseinander (dieselbe Bauweise wie in
    `uebersicht.test.cjs`).
  */
  const quelle = require('node:fs').readFileSync(require('node:path').resolve(__dirname, 'amazon.js'), 'utf8')
  const von = quelle.indexOf('function imPlayer')
  const bis = quelle.indexOf('\n  }\n', von) + 4
  let document
  let window
  const imPlayerCode = quelle.slice(von, bis).replace(/^  /gm, '')
  // eslint-disable-next-line no-eval
  eval(imPlayerCode)

  const kulisse = ({ container = null, videos = [], hoehe = 900 }) => {
    window = { innerHeight: hoehe }
    document = {
      querySelector: () => container,
      querySelectorAll: () => videos,
    }
  }

  kulisse({})
  pruefe('ohne Player und ohne Video ist es kein Player', !imPlayer())

  kulisse({ container: { offsetHeight: 700 } })
  pruefe('der bekannte Player-Container zählt weiter', imPlayer())

  kulisse({ container: { offsetHeight: 40 } })
  pruefe('… aber nur mit Höhe — auf der Übersicht steht er ohne', !imPlayer())

  /* Der Fall vom 02.09.2026: Vollbild ohne den bekannten Container. */
  kulisse({ videos: [{ muted: false, readyState: 4, offsetHeight: 820 }] })
  pruefe('ein großes laufendes Video ist ein Player, auch ohne Container', imPlayer())

  /*
    Und der Riegel dagegen: Das Hintergrundvideo einer Übersicht ist stumm.
    Ohne diese Bedingung verschwand der Listen-Knopf auf jeder Übersichtsseite
    (Daniel, 27.08.2026) — der Fehler, den die erste Fassung dieser Funktion
    gemacht hat.
  */
  kulisse({ videos: [{ muted: true, readyState: 4, offsetHeight: 820 }] })
  pruefe('ein stummes Hintergrundvideo ist keiner', !imPlayer())

  kulisse({ videos: [{ muted: false, readyState: 4, offsetHeight: 120 }] })
  pruefe('ein kleines Video in einer Kachel auch nicht', !imPlayer())

  kulisse({ videos: [{ muted: false, readyState: 0, offsetHeight: 820 }] })
  pruefe('und eins, das nie geladen hat, ebenso wenig', !imPlayer())
}

console.log(fehler.length ? `\n${fehler.length} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler.length ? 1 : 0)
