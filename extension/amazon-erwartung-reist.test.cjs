/**
 * Die bestätigte Erwartung reist mit dem Auftrag auf die Titelseite.
 *
 * Daniel am 10.09.2026 an „Plus-Sized Elf", mit drei Bildern: Auf der Suchseite
 * standen beide Ausgaben angehakt („2 erwartet", `B0DY17414W` und
 * `B0DJM2FGH6`), auf **beiden** Titelseiten fehlte die Checkliste — „auf
 * suchseite auswahl bestätigt, auf #1 und #3 fehlen die checklisten".
 *
 * Die Checkliste hängt an `erwartet.length >= 2`, und diese Liste kommt aus
 * zwei Quellen: dem Briefkasten (auf einer frisch geladenen Seite noch stumm)
 * und dem Auftrag im `sessionStorage`. Der Auftrag stammt aus
 * `AK_OFFENE_AMAZON`, und die Prüfliste kennt keine Erwartung — die vier
 * Klickstellen schrieben ihn deshalb ohne. Der **Leser** war seit dem
 * 09.09.2026 gebaut, der **Schreiber** nicht.
 *
 * Geprüft wird an der einen Stelle, durch die jeder Weg geht.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Zusicherungen zur mitreisenden Erwartung (Plus-Sized Elf, 10.09.2026)\n')

const quelle = readFileSync(resolve(__dirname, 'amazon.js'), 'utf8')

const stueck = quelle.match(/function suchauftragMerken\(auftrag\) \{[\s\S]*?\n  \}/)
pruefe('suchauftragMerken() ist im Quelltext auffindbar', Boolean(stueck))

if (stueck) {
  /* Ein Sitzungsspeicher aus Papier — mehr braucht die Funktion nicht. */
  const bauen = (auftrag, bestaetigt) => {
    const abgelegt = {}
    const lauf = new Function(
      'auftrag',
      'bestaetigt',
      'abgelegt',
      `const sessionStorage = {
         getItem: (k) => abgelegt[k] ?? null,
         setItem: (k, v) => { abgelegt[k] = v },
         removeItem: (k) => { delete abgelegt[k] },
       }
       const WEGGELEGT_SCHLUESSEL = 'ak_weggelegt'
       const SUCH_SCHLUESSEL = 'ak_suchauftrag'
       function erwartungZu() { return bestaetigt }
       ${stueck[0]}
       suchauftragMerken(auftrag)
       return abgelegt[SUCH_SCHLUESSEL]`,
    )
    const roh = lauf(auftrag, bestaetigt, abgelegt)
    return roh ? JSON.parse(roh) : null
  }

  /* Daniels Fall: Auftrag aus der Prüfliste, Erwartung nur beim Briefkasten. */
  const ausKlick = bauen(
    { titel: 'Plus-Sized Elf', suchUrl: 'https://www.amazon.de/s?k=Plus%20Sized%20Elf', zielAsin: 'B0DJM2FGH6' },
    ['B0DY17414W', 'B0DJM2FGH6'],
  )
  pruefe(
    'Der Auftrag aus der Prüfliste bekommt die bestätigte Erwartung mit',
    Array.isArray(ausKlick?.erwartet) && ausKlick.erwartet.length === 2,
    ausKlick?.erwartet,
  )
  pruefe(
    'und zwar beide Kennungen aus der Aufnahme',
    ausKlick?.erwartet?.includes('B0DY17414W') && ausKlick?.erwartet?.includes('B0DJM2FGH6'),
    ausKlick?.erwartet,
  )
  pruefe('Titel und Ziel bleiben unangetastet', ausKlick?.titel === 'Plus-Sized Elf' && ausKlick?.zielAsin === 'B0DJM2FGH6')

  /* Trägt der Auftrag schon eine Erwartung, gewinnt sie — sie ist die genauere. */
  const eigene = bauen({ suchUrl: 'x', erwartet: ['B0AAA', 'B0BBB'] }, ['B0CCC', 'B0DDD'])
  pruefe(
    'Eine mitgegebene Erwartung wird nicht überschrieben',
    eigene?.erwartet?.join() === 'B0AAA,B0BBB',
    eigene?.erwartet,
  )

  /* Ohne Bestätigung wird nichts erfunden — eine einzelne Ausgabe hat keine Checkliste. */
  const ohne = bauen({ suchUrl: 'x', titel: 'Einzeln' }, null)
  pruefe('Ohne bestätigte Erwartung bleibt der Auftrag ohne', ohne?.erwartet === undefined, ohne)

  /* Der Merker trägt weiterhin seine Zeit — er verfällt nach zehn Minuten. */
  pruefe('Der Zeitstempel bleibt erhalten', typeof ausKlick?.zeit === 'number')
}

/*
  **Der sechste Fall der `let`-Klasse wird hier verhindert, nicht erlitten.**

  `suchauftragMerken()` liest jetzt `erwartungZu()`, und das liest
  `briefkastenErwartungen`. Die Deklaration stand rund 2.800 Zeilen **hinter**
  der Funktion; ein Klick hätte geworfen.
*/
const deklaration = quelle.indexOf('let briefkastenErwartungen = null')
const merker = quelle.indexOf('function suchauftragMerken(auftrag)')
pruefe('briefkastenErwartungen ist deklariert', deklaration > 0)
pruefe(
  'und zwar oberhalb von suchauftragMerken() — sonst wirft der Klick',
  deklaration > 0 && merker > 0 && deklaration < merker,
  { deklaration, merker },
)

/* Und die Titelseite liest genau diese Liste — beide Wege, in dieser Reihenfolge. */
const leser = quelle.includes(
  'const erwartet = erwartungZu(suchUrlHier) ?? (Array.isArray(a?.erwartet) ? a.erwartet : [])',
)
pruefe('Die Titelseite liest Briefkasten zuerst, dann den Merker', leser)

/*
  **Der Haken nach der eigenen Meldung.**

  Daniel am 10.09.2026, zweites Bild: „nach meldung muss checklisten eintrag den
  haken bekommen statt dem kreis … der haken kommt nach navigation zum 2.
  eintrag, also wird es ein ui update sein was fehlt."

  Die Überbrückung gab es — sie schrieb die eigene Kennung in
  `briefkastenSeiten`. Das hielt bis zum nächsten Abruf: `briefkastenHolen()`
  **ersetzt** diese Menge, und der Worker führt die frische Meldung noch nicht.
  Ein eigener Merker übersteht das Ersetzen.
*/
console.log('')
console.log('Zusicherungen zum Haken nach der eigenen Meldung\n')

const merkerDekl = quelle.indexOf('const selbstGemeldeteSeiten = new Set()')
pruefe('Es gibt einen eigenen Merker neben dem Briefkasten', merkerDekl > 0)
pruefe(
  'Der Melde-Handler trägt die eigene Seite dort ein',
  quelle.includes('selbstGemeldeteSeiten.add(String(hier))'),
)
pruefe(
  'Die Checkliste liest ihn zusätzlich zum Briefkasten',
  quelle.includes(
    "const fertig = (briefkastenSeiten?.has(String(k)) ?? false) || selbstGemeldeteSeiten.has(String(k))",
  ),
)
pruefe(
  'Der Merker steht oberhalb jeder Nutzung',
  merkerDekl > 0 &&
    merkerDekl < quelle.indexOf('selbstGemeldeteSeiten.add(') &&
    merkerDekl < quelle.indexOf('selbstGemeldeteSeiten.has('),
  { merkerDekl, add: quelle.indexOf('selbstGemeldeteSeiten.add('), has: quelle.indexOf('selbstGemeldeteSeiten.has(') },
)

/*
  **Und er bleibt bei der Anzeige.**

  `seiteOffen()` entscheidet, ob ein Verweis wirklich abgehakt ist — dort gilt
  der Briefkasten allein, denn eine Meldung, die nicht ankommt, darf nicht als
  erledigt zählen. Wer den Merker dort einbaut, macht aus einer Anzeige eine
  Behauptung.
*/
const seiteOffenBlock = quelle.match(/function seiteOffen\([\s\S]*?\n  \}/)
pruefe('seiteOffen() ist auffindbar', Boolean(seiteOffenBlock))
if (seiteOffenBlock) {
  pruefe(
    'seiteOffen() entscheidet weiter allein über den Briefkasten',
    !seiteOffenBlock[0].includes('selbstGemeldeteSeiten'),
  )
}

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zu Checkliste und Haken halten.')
