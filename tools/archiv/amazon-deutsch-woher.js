/**
 * Messskript für Daniels Browser — woher nimmt die Erweiterung „Deutsch"?
 *
 * Läuft in der Konsole einer geöffneten Prime-Video-Seite in seiner
 * angemeldeten Sitzung. Es ruft nichts ab und ändert nichts; es liest den
 * Quelltext, den die Seite ohnehin geladen hat.
 *
 * Anlass (25.08.2026): Für „Tensei Kenja no Isekai Life"
 * (`0RNU3R7XQ7HDN1EOCZRAFD5R5R`) meldete die Erweiterung neun Tonspuren
 * einschließlich Deutsch, und der Knopf war grün. Der Titel hat keine deutsche
 * Sprachausgabe (Daniel).
 *
 * Ein Abruf derselben Seite **ohne Anmeldung** zeigt etwas anderes: alle zwölf
 * Folgen tragen `"audioTracks":["日本語"]`, die einzige deutsche Angabe ist
 * `"subtitles":["Deutsch [UT]"]`. Die neun Sprachen stehen dort nirgends.
 *
 * Offen ist damit genau eine Frage, und dieses Skript beantwortet sie: **An
 * welcher Stelle in der angemeldeten Sitzung steht Deutsch in einem
 * `audioTracks`?** Dazu zeigt es jede Fundstelle mit ihrem Umfeld, damit
 * erkennbar wird, zu welchem Titel und zu welchem Angebot sie gehört.
 *
 * Aufruf: Konsole öffnen (F12), einfügen, Enter. Das Ergebnis liegt danach
 * auch in der Zwischenablage.
 */
;(async () => {
  const h = document.documentElement.innerHTML

  /* Dasselbe Muster wie in `spuren()` — gemessen wird, was die Erweiterung sieht. */
  const treffer = [...h.matchAll(/"audioTracks"\s*:\s*\[([^\]]*)\]/g)]
  const mitDeutsch = treffer.filter((m) => /Deutsch|German|de-de/i.test(m[1]))

  const ergebnis = {
    adresse: location.pathname + location.search,
    quelltextZeichen: h.length,
    audioTracksGesamt: treffer.length,
    audioTracksMitDeutsch: mitDeutsch.length,
    /* Welche Inhalte kommen überhaupt vor — der schnellste Blick auf die Lage. */
    inhalte: [...new Set(treffer.map((m) => m[1].slice(0, 120)))],
    /* Und die Untertitel daneben, denn die tragen hier das Deutsch. */
    subtitles: [...new Set([...h.matchAll(/"subtitles"\s*:\s*(\[.{0,200}?\]),"/gs)].map((m) => m[1]))].slice(0, 5),
  }

  /*
    Je deutscher Fundstelle 400 Zeichen davor und danach. Darin steht, zu
    welchem Titel sie gehört (`catalogId`, `title`) und ob sie aus der
    Folgenliste stammt oder aus einer Empfehlungsleiste.
  */
  ergebnis.umfeld = mitDeutsch.slice(0, 6).map((m) => ({
    stelle: m.index,
    inhalt: m[1].slice(0, 200),
    davor: h.slice(Math.max(0, m.index - 400), m.index),
    danach: h.slice(m.index + m[0].length, m.index + m[0].length + 400),
  }))

  /*
    **Die Zugänge — und wo sie stehen.**

    Ein Abruf derselben Seite ohne Anmeldung findet ausschließlich
    `"benefitId":"animedigitalde"`, 25-mal: ein reiner ADN-Kanal-Titel. Die
    Meldung aus der angemeldeten Sitzung nannte dagegen `Prime, FVOD` — und
    genau daran hängt der Kanal-Wächter: Weil „Prime" dabei war, blieb der
    Knopf grün statt ⚠, und Amazons Sprachangabe galt als Beleg.

    `abos()` sammelt jede `benefitId` im ganzen Quelltext. Die Frage ist
    deshalb, ob die fremden aus Empfehlungsleisten stammen — dann muss die
    Suche auf den Bereich des Haupttitels eingegrenzt werden.
  */
  ergebnis.benefitIds = {}
  for (const m of h.matchAll(/"benefitId"s*:s*"([^"]+)"/g)) {
    const b = (ergebnis.benefitIds[m[1]] ??= { anzahl: 0, ersteStelle: m.index, umfeld: null })
    b.anzahl++
    if (!b.umfeld) b.umfeld = h.slice(Math.max(0, m.index - 300), m.index + 200)
  }

  /* Welche Felder nennen Deutsch — die Gegenprobe, falls audioTracks sauber ist. */
  const felder = new Set()
  for (const m of h.matchAll(/"([a-zA-Z_]{3,30})"\s*:\s*(?:"[^"]{0,80}Deutsch|\[[^\]]{0,300}Deutsch)/g)) {
    felder.add(m[1])
  }
  ergebnis.felderMitDeutsch = [...felder]

  const text = JSON.stringify(ergebnis, null, 1)
  console.log(text)
  try {
    await navigator.clipboard.writeText(text)
    console.log('%c→ liegt in der Zwischenablage', 'color:#0a0')
  } catch {
    console.log('Zwischenablage nicht erlaubt — Text oben markieren und kopieren.')
  }
})()
