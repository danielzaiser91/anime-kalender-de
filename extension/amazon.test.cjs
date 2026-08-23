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

console.log(fehler.length ? `\n${fehler.length} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler.length ? 1 : 0)
