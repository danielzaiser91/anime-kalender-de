/*
  **Netflix-Prüfliste: Kopf in zwei Zeilen und die Ansicht der zurückgestellten Titel** (Daniel, 15.11.2026) —
  eigene Datei, weil `melder.js` über der Zeilengrenze liegt (check:umfang). Lädt laut Manifest vor `melder.js`;
  `dialogOeffnen()` ruft `akNetflixListeAnsicht.kopf()`. Stil: `netflix-liste.css`.

  Kopf: oben die Überschrift links, „nächste Übernahme“ und Schließen rechts; darunter das Suchfeld ganz links,
  dann die Knöpfe. „N zurückgestellt“ tauscht die Liste gegen eine Tabelle (zurück bis, letzte Messung, Grund),
  sortierbar über die Spaltenköpfe, filterbar über das Suchfeld (Titel oder Grund) und die Grund-Knöpfe.
  Die Zahl der Zurückgestellten steht nur am Knopf, nicht noch einmal in der Überschrift.
*/
const ANSICHT_SPALTEN = [
  { id: 'titel', text: 'Titel' },
  { id: 'bis', text: 'zurück bis' },
  { id: 'am', text: 'letzte Messung' },
  { id: 'grund', text: 'Grund' },
]
const ANSICHT_GRUENDE_HOECHSTENS = 4

/** Text in Europe/Berlin; `opt` wie bei `Intl.DateTimeFormat`. */
function ansichtFormat(ms, opt) {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', ...opt }).format(new Date(ms))
}

const ansichtTag = (ms) => ansichtFormat(ms, { year: 'numeric', month: 'numeric', day: 'numeric' })
const ansichtUhr = (ms) => ansichtFormat(ms, { hour: '2-digit', minute: '2-digit' })
/* de-DE liefert „20.11.“ samt Punkt. */
const ansichtDatum = (ms) => ansichtFormat(ms, { day: 'numeric', month: 'numeric' })

/** Ein lesbarer Zeitpunkt? Fehlende Angabe und unlesbarer Speicherwert sind keiner. */
const ansichtLesbar = (ms) => Number.isFinite(new Date(ms).getTime())

/** „14:30“ am selben Berliner Tag, sonst „20.11.“; ohne lesbaren Zeitpunkt `null`. */
function ansichtZeit(ms, jetzt) {
  if (!ansichtLesbar(ms)) return null
  return ansichtTag(ms) === ansichtTag(jetzt) ? ansichtUhr(ms) : ansichtDatum(ms)
}

/** „nächste Übernahme: 13:23“; liegt sie an einem anderen Berliner Tag, steht das Datum davor. */
function ansichtUebernahmeText(ziel, jetzt) {
  const tag = ansichtTag(ziel) === ansichtTag(jetzt) ? '' : `${ansichtDatum(ziel)} `
  return `nächste Übernahme: ${tag}${ansichtUhr(ziel)}`
}

/** Die zurückgestellten Einträge der Prüfliste als Tabellenzeilen; `infoVon(id)` = `zurueckInfo` der Merkliste. */
function ansichtZeilen(eintraege, infoVon) {
  return eintraege.flatMap(([id, eintrag]) => {
    const info = infoVon(id)
    if (!info) return []
    return [{ id: String(id), titel: eintrag.titel || `Titel ${id}`, grund: String(info.grund ?? ''), bis: info.bis, am: info.am }]
  })
}

/** Der Grund ohne Klammerzusatz („Netflix zeigt ihn nicht (E103)“ → „Netflix zeigt ihn nicht“): ein Filterknopf je Art. */
const ansichtGrundArt = (grund) => grund.replace(/\s*\(.*\)\s*$/, '')

/** Zeilen, deren Titel oder Grund das Suchwort enthält und deren Grund zur gewählten Art gehört (leer = alle). */
function ansichtGefiltert(zeilen, wort, art) {
  const w = wort.trim().toLowerCase()
  return zeilen.filter((z) => {
    if (art && ansichtGrundArt(z.grund) !== art) return false
    return !w || z.titel.toLowerCase().includes(w) || z.grund.toLowerCase().includes(w)
  })
}

/** Sortiert nach Spalte (`ab` = absteigend); Zeilen ohne lesbaren Zeitpunkt stehen immer am Ende, Gleichstand löst der Titel. */
function ansichtSortiert(zeilen, spalte, ab) {
  const text = (a, b) => a.localeCompare(b, 'de')
  const istZeit = spalte === 'bis' || spalte === 'am'
  const fehlt = (z) => Number(istZeit && !ansichtLesbar(z[spalte]))
  const vergleich = (a, b) => (istZeit ? a[spalte] - b[spalte] : text(a[spalte], b[spalte]))
  return [...zeilen].sort((a, b) => {
    if (fehlt(a) || fehlt(b)) return fehlt(a) - fehlt(b) || text(a.titel, b.titel)
    return (ab ? -1 : 1) * vergleich(a, b) || text(a.titel, b.titel)
  })
}

/** Die häufigsten Grund-Arten mit Zahl, größte zuerst (Gleichstand nach Name); bei nur einer Art gibt es nichts zu filtern. */
function ansichtGrundArten(zeilen) {
  const je = new Map()
  for (const z of zeilen) je.set(ansichtGrundArt(z.grund), (je.get(ansichtGrundArt(z.grund)) ?? 0) + 1)
  if (je.size < 2) return []
  return [...je]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
    .slice(0, ANSICHT_GRUENDE_HOECHSTENS)
    .map(([art, zahl]) => ({ art, zahl }))
}

function ansichtElement(tag, klasse, text) {
  const el = document.createElement(tag)
  if (klasse) el.className = klasse
  if (text !== undefined) el.textContent = text
  return el
}

/** Eine Tabellenzeile: Titel (Verweis auf die Titelseite), zurück bis, letzte Messung (fehlt sie: „—“), Grund. */
function ansichtZeile(z, jetzt) {
  const zeile = ansichtElement('tr')
  const titel = ansichtElement('td', 'ak-zurueck-titel')
  const link = ansichtElement('a', '', z.titel)
  link.href = `https://www.netflix.com/title/${z.id}`
  link.rel = 'noreferrer noopener'
  link.dataset.id = z.id
  titel.appendChild(link)
  const bis = ansichtElement('td', 'ak-zurueck-bis', ansichtZeit(z.bis, jetzt) ?? 'auf Weiteres')
  bis.dataset.name = 'bis'
  const am = ansichtElement('td', 'ak-zurueck-am', ansichtZeit(z.am, jetzt) ?? '—')
  am.dataset.name = 'gemessen'
  am.title = ansichtLesbar(z.am) ? `${ansichtDatum(z.am)} ${ansichtUhr(z.am)}` : 'Für diesen Titel ist keine Messung gespeichert.'
  for (const zelle of [titel, bis, am, ansichtElement('td', 'ak-zurueck-grund', z.grund)]) zeile.appendChild(zelle)
  return zeile
}

/** Die Kopfzeile der Tabelle: je Spalte ein Knopf; `waehle(id)` sortiert. Gibt die Zellen zurück (für `aria-sort`). */
function ansichtKopfzeile(tabelle, klick, waehle) {
  const kopf = ansichtElement('thead')
  const reihe = ansichtElement('tr')
  const zellen = ANSICHT_SPALTEN.map((spalte) => {
    const zelle = ansichtElement('th')
    zelle.scope = 'col'
    const knopf = ansichtElement('button', 'ak-sortierknopf', spalte.text)
    knopf.type = 'button'
    knopf.title = `Nach „${spalte.text}“ sortieren`
    klick(knopf, () => waehle(spalte.id))
    zelle.appendChild(knopf)
    reihe.appendChild(zelle)
    return { id: spalte.id, zelle }
  })
  kopf.appendChild(reihe)
  tabelle.appendChild(kopf)
  return zellen
}

/** Die Filterknöpfe je Grund-Art über der Tabelle; `waehle(art)` schaltet um. Gibt die Knöpfe zurück (für `aria-pressed`). */
function ansichtGrundKnoepfe(wurzel, zeilen, klick, waehle) {
  const arten = ansichtGrundArten(zeilen)
  if (!arten.length) return []
  const leiste = ansichtElement('div', 'ak-zurueck-gruende')
  const knoepfe = arten.map(({ art, zahl }) => {
    const knopf = ansichtElement('button', 'ak-zurueck-grundknopf', `${art} · ${zahl}`)
    knopf.type = 'button'
    knopf.title = 'Nur Titel mit diesem Grund zeigen'
    klick(knopf, () => waehle(art))
    leiste.appendChild(knopf)
    return { art, knopf }
  })
  wurzel.appendChild(leiste)
  return knoepfe
}

/**
 * Die Ansicht der zurückgestellten Titel. Anfangs nach „zurück bis“ aufsteigend: was als Nächstes wieder drankommt, steht oben.
 * `o`: `{ klick, jetzt, geoeffnet }`. Ergebnis `{ wurzel, filtern(wort) }`.
 */
function ansichtTabelle(zeilen, o) {
  const zustand = { spalte: 'bis', ab: false, art: '', wort: '' }
  const wurzel = ansichtElement('div', 'ak-zurueck-ansicht')
  const waehleArt = (art) => {
    zustand.art = zustand.art === art ? '' : art
    zeichne()
  }
  const knoepfe = ansichtGrundKnoepfe(wurzel, zeilen, o.klick, waehleArt)
  const tabelle = ansichtElement('table', 'ak-zurueck-tabelle')
  const waehleSpalte = (id) => {
    zustand.ab = zustand.spalte === id ? !zustand.ab : false
    zustand.spalte = id
    zeichne()
  }
  const koepfe = ansichtKopfzeile(tabelle, o.klick, waehleSpalte)
  const rumpf = ansichtElement('tbody')
  tabelle.appendChild(rumpf)
  wurzel.appendChild(tabelle)
  const leer = ansichtElement('p', 'ak-zurueck-leer', 'Kein Treffer')
  wurzel.appendChild(leer)
  /* Ein Klick auf einen Titel merkt sich wie in der Liste, welcher Auftrag geöffnet wurde (Weiterleitung auf andere Kennung). */
  o.klick(rumpf, (ereignis) => {
    const id = ereignis.target?.closest?.('a')?.dataset?.id
    if (id) o.geoeffnet?.(id)
  })
  function zeichne() {
    const sicht = ansichtSortiert(ansichtGefiltert(zeilen, zustand.wort, zustand.art), zustand.spalte, zustand.ab)
    rumpf.replaceChildren(...sicht.map((z) => ansichtZeile(z, o.jetzt())))
    leer.hidden = sicht.length > 0
    for (const { id, zelle } of koepfe) {
      zelle.setAttribute('aria-sort', id !== zustand.spalte ? 'none' : zustand.ab ? 'descending' : 'ascending')
    }
    for (const { art, knopf } of knoepfe) knopf.setAttribute('aria-pressed', String(art === zustand.art))
  }
  zeichne()
  return {
    wurzel,
    filtern: (wort) => {
      zustand.wort = wort
      zeichne()
    },
  }
}

/** Ein Umschalter im Kopf: `schalten()` wechselt den Zustand, `nachher()` gleicht alle Knöpfe ab (`aria-pressed`, an = hervorgehoben wie der laufende Durchgang). */
function ansichtSchalter(text, hinweis, klick, schalten, nachher) {
  const knopf = ansichtElement('button', 'ak-umschalter', text)
  knopf.type = 'button'
  knopf.title = hinweis
  knopf.setAttribute('aria-pressed', 'false')
  klick(knopf, () => {
    schalten()
    nachher()
  })
  return knopf
}

/** Klassen am Kasten je Ansicht; „gemeldet“ nutzt die Erledigten-Zeilen der Liste, blendet aber alle anderen aus. */
const ANSICHT_MODI = { zurueck: ['ak-ansicht-zurueck'], gemeldet: ['ak-ansicht-gemeldet', 'ak-mit-erledigten'] }
const ansichtModusAn = (kasten, modus) => ANSICHT_MODI[modus].every((k) => kasten.classList.contains(k))

/**
 * Genau eine Ansicht gilt (15.11.2026): der Klick setzt sie und schaltet die andere aus, ein zweiter Klick auf dieselbe kehrt zur
 * Liste zurück. Die Listen werden nie zusammengelegt. Gibt zurück, ob die Ansicht jetzt an ist.
 */
function ansichtModusSchalten(kasten, modus) {
  const war = ansichtModusAn(kasten, modus)
  for (const klassen of Object.values(ANSICHT_MODI)) for (const k of klassen) kasten.classList.remove(k)
  if (!war) for (const k of ANSICHT_MODI[modus]) kasten.classList.add(k)
  return !war
}

/**
 * „nächste Übernahme: 13:23“ — wann der stündliche Datenlauf das Gemeldete abholt; so lässt sich gegenprüfen, ob er
 * seine Arbeit getan hat (Daniel, 26.08.2026). Bleibt der Dialog offen, wandert die Uhrzeit im Minutentakt mit.
 */
function ansichtUebernahme(uebernahme, jetzt) {
  const lauf = ansichtElement('span', 'ak-lauf')
  lauf.title = 'Der stündliche Datenlauf holt die Meldungen ab und schreibt sie in den Kalender; Gemeldetes verschwindet dann aus dieser Liste. GitHub startet ihn oft ein paar Minuten später.'
  const zeige = () => (lauf.textContent = ansichtUebernahmeText(uebernahme(new Date(jetzt())).getTime(), jetzt()))
  zeige()
  const takt = setInterval(() => {
    if (!lauf.isConnected) return clearInterval(takt)
    zeige()
  }, 60000)
  return lauf
}

/** Die obere Kopfzeile: Überschrift links, rechts die nächste Übernahme (nur mit Gemeldetem) und Schließen. */
function ansichtOben(o, jetzt) {
  const oben = ansichtElement('div', 'ak-kopf-oben')
  oben.appendChild(ansichtElement('strong', '', o.titel))
  if (o.gemeldet > 0) oben.appendChild(ansichtUebernahme(o.uebernahme, jetzt))
  const zu = ansichtElement('button', 'ak-zu', '×')
  zu.type = 'button'
  zu.title = 'Schließen (Esc)'
  zu.setAttribute('aria-label', 'Schließen')
  o.klick(zu, o.zu)
  oben.appendChild(zu)
  return oben
}

/** „Stand von 20:15“ und ↻ (neu holen); während des Abrufs bleibt der alte Stand stehen, der Knopf zeigt „…“. `stand`: `akNetflixStand.neu()`. */
function ansichtStand(stand, klick) {
  const zeile = ansichtElement('div', 'ak-stand')
  zeile.appendChild(ansichtElement('span', 'ak-stand-text', stand.text()))
  const knopf = ansichtElement('button', 'ak-umschalter ak-stand-knopf', stand.laeuft() ? '…' : '↻')
  knopf.title = 'Gemeldetes jetzt neu laden'
  knopf.disabled = stand.laeuft()
  klick(knopf, () => void stand.auffrischen())
  zeile.appendChild(knopf)
  return zeile
}

/**
 * Der Kopf der Prüfliste. `o`: `{ kasten, titel, selbst (Knopf des Durchgangs), zurueck (Zeilen aus `zeilen()`),
 * gemeldet (Zahl), uebernahme(jetzt: Date) → Date, zu(), klick (= `akKlick`), geoeffnet(id), jetzt? }`.
 * Ergebnis `{ kopf, suche, tabelle }`; `tabelle` (oder `null`) hängt der Aufrufer hinter die Liste.
 */
function ansichtKopf(o) {
  const jetzt = o.jetzt ?? Date.now
  const kopf = ansichtElement('div', 'ak-kopf ak-kopf-zeilen')
  kopf.appendChild(ansichtOben(o, jetzt))
  const unten = ansichtElement('div', 'ak-kopf-unten')
  const suche = ansichtElement('input', 'ak-suche')
  suche.type = 'search'
  suche.placeholder = 'Suchen'
  suche.setAttribute('aria-label', 'Suchen')
  unten.appendChild(suche)
  unten.appendChild(o.selbst)
  let tabelle = null
  const schalter = []
  const abgleich = () => schalter.forEach(([k, modus]) => k.setAttribute('aria-pressed', String(ansichtModusAn(o.kasten, modus))))
  const neu = (modus, text, hinweis) => {
    const knopf = ansichtSchalter(text, hinweis, o.klick, () => ansichtModusSchalten(o.kasten, modus), abgleich)
    schalter.push([knopf, modus])
    unten.appendChild(knopf)
  }
  if (o.zurueck.length) {
    tabelle = ansichtTabelle(o.zurueck, { klick: o.klick, jetzt, geoeffnet: o.geoeffnet })
    neu('zurueck', `${o.zurueck.length} zurückgestellt`, 'Zurückgestellte Titel kommen zu ihrem Termin wieder dran. Hier siehst du sie samt Grund.')
    suche.addEventListener('input', () => tabelle.filtern(suche.value))
  }
  if (o.gemeldet > 0) neu('gemeldet', `${o.gemeldet} gemeldet`, 'Nur die gemeldeten Titel zeigen')
  kopf.appendChild(unten)
  if (globalThis.akNetflixStand?.aktuell) kopf.appendChild(ansichtStand(globalThis.akNetflixStand.aktuell, o.klick))
  return { kopf, suche, tabelle: tabelle?.wurzel ?? null }
}

/**
 * In einem Tab, der den Durchgang nicht führt (`hinweis` aus `akNetflixStartHinweis`, 4071): „nichts da?“ und „Staffel melden“ sind gesperrt, mit der
 * Begründung am Knopf, ebenso `selbst` (der Durchgangs-Knopf); ein kurzer Satz kommt in den `kopf`. Die Titel-Links bleiben (Nachsehen von Hand muss gehen).
 */
function ansichtSperren(wurzel, kopf, selbst, hinweis) {
  if (!hinweis) return
  for (const knopf of wurzel.querySelectorAll('.ak-tot, .ak-staffel-weg')) {
    knopf.disabled = true
    knopf.title = hinweis.title
  }
  kopf.appendChild(ansichtElement('div', 'ak-hinweis ak-gesperrt', 'Der Durchgang läuft in einem anderen Tab — melden und starten geht dort.'))
  Object.assign(selbst, { disabled: true, textContent: hinweis.text, title: hinweis.title })
}

/** Das Suchfeld filtert die Zeilen der Liste nach ihrem Suchtext. */
function ansichtSuchen(suche, liste) {
  suche.addEventListener('input', () => {
    const wort = suche.value.trim().toLowerCase()
    for (const zeile of liste.children) {
      zeile.style.display = !wort || zeile.dataset.suchtext.includes(wort) ? '' : 'none'
    }
  })
}

globalThis.akNetflixListeAnsicht = {
  sperren: ansichtSperren,
  suchen: ansichtSuchen,
  kopf: ansichtKopf,
  zeilen: ansichtZeilen,
  uebernahmeText: ansichtUebernahmeText,
  sortiert: ansichtSortiert,
  gefiltert: ansichtGefiltert,
}
